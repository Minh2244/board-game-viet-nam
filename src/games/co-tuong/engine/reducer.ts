import {
  applyXiangqiMoveToBoard,
  createInitialXiangqiBoard,
  generateLegalXiangqiMoves,
  getXiangqiPositionHash,
  isGeneralInCheck,
  isInsufficientXiangqiAttack,
  oppositeXiangqiColor,
} from './rules';
import type {
  XiangqiAction,
  XiangqiColor,
  XiangqiState,
  XiangqiUndoSnapshot,
} from './types';

export interface CreateXiangqiOptions {
  redName: string;
  redIsBot: boolean;
  greenName: string;
  greenIsBot: boolean;
  roomCode?: string;
}

export function createInitialXiangqiState(options: CreateXiangqiOptions): XiangqiState {
  const board = createInitialXiangqiBoard();
  const hash = getXiangqiPositionHash(board, 'red');

  return {
    version: 1,
    roomCode: options.roomCode,
    phase: 'PLAYING',
    turn: 'red',
    players: {
      red: { name: options.redName.trim() || 'Bên Đỏ', isBot: options.redIsBot },
      green: { name: options.greenName.trim() || 'Bên Xanh', isBot: options.greenIsBot },
    },
    board,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    inCheck: false,
    winner: null,
    endReason: null,
    lastMove: null,
    history: [],
    capturedByRed: [],
    capturedByGreen: [],
    positionCounts: { [hash]: 1 },
    checkRepeatCounts: {},
    pendingDrawOfferFrom: null,
    undoStack: [],
  };
}

function makeUndoSnapshot(state: XiangqiState): XiangqiUndoSnapshot {
  return {
    turn: state.turn,
    board: state.board.map((p) => (p ? { ...p } : null)),
    halfMoveClock: state.halfMoveClock,
    fullMoveNumber: state.fullMoveNumber,
    inCheck: state.inCheck,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    history: state.history.map((m) => ({ ...m })),
    capturedByRed: [...state.capturedByRed],
    capturedByGreen: [...state.capturedByGreen],
    positionCounts: { ...state.positionCounts },
    checkRepeatCounts: { ...state.checkRepeatCounts },
  };
}

export function reduceXiangqiAction(
  prevState: XiangqiState,
  action: XiangqiAction,
): XiangqiState {
  if (action.type === 'UNDO') {
    if (prevState.undoStack.length === 0) return prevState;
    const plies = Math.min(action.plies ?? 1, prevState.undoStack.length);
    const targetIdx = prevState.undoStack.length - plies;
    const snap = prevState.undoStack[targetIdx];
    return {
      ...prevState,
      phase: 'PLAYING',
      turn: snap.turn,
      board: snap.board.map((p) => (p ? { ...p } : null)),
      halfMoveClock: snap.halfMoveClock,
      fullMoveNumber: snap.fullMoveNumber,
      inCheck: snap.inCheck,
      winner: null,
      endReason: null,
      lastMove: snap.lastMove ? { ...snap.lastMove } : null,
      history: snap.history.map((m) => ({ ...m })),
      capturedByRed: [...snap.capturedByRed],
      capturedByGreen: [...snap.capturedByGreen],
      positionCounts: { ...snap.positionCounts },
      checkRepeatCounts: { ...snap.checkRepeatCounts },
      pendingDrawOfferFrom: null,
      undoStack: prevState.undoStack.slice(0, targetIdx),
    };
  }

  if (prevState.phase === 'GAME_OVER') return prevState;

  if (action.type === 'RESIGN') {
    return {
      ...prevState,
      phase: 'GAME_OVER',
      winner: oppositeXiangqiColor(action.color),
      endReason: 'RESIGN',
      pendingDrawOfferFrom: null,
    };
  }

  if (action.type === 'OFFER_DRAW') {
    return { ...prevState, pendingDrawOfferFrom: action.from };
  }

  if (action.type === 'RESPOND_DRAW') {
    if (!prevState.pendingDrawOfferFrom) return prevState;
    if (action.accept) {
      return {
        ...prevState,
        phase: 'GAME_OVER',
        winner: 'DRAW',
        endReason: 'DRAW_AGREED',
        pendingDrawOfferFrom: null,
      };
    }
    return { ...prevState, pendingDrawOfferFrom: null };
  }

  // MOVE
  const legal = generateLegalXiangqiMoves(
    prevState.board,
    prevState.turn,
    prevState.checkRepeatCounts,
  );
  const chosen = legal.find((m) => m.from === action.from && m.to === action.to);
  if (!chosen) return prevState;

  const undoSnap = makeUndoSnapshot(prevState);
  const nextBoard = applyXiangqiMoveToBoard(prevState.board, chosen);
  const nextTurn: XiangqiColor = oppositeXiangqiColor(prevState.turn);
  const nextHalfMove = chosen.captured ? 0 : prevState.halfMoveClock + 1;
  const nextFullMove =
    prevState.turn === 'green' ? prevState.fullMoveNumber + 1 : prevState.fullMoveNumber;

  const capturedByRed = [...prevState.capturedByRed];
  const capturedByGreen = [...prevState.capturedByGreen];
  if (chosen.captured) {
    if (chosen.color === 'red') capturedByRed.push(chosen.captured);
    else capturedByGreen.push(chosen.captured);
  }

  const nextHash = getXiangqiPositionHash(nextBoard, nextTurn);
  const nextPosCounts = {
    ...prevState.positionCounts,
    [nextHash]: (prevState.positionCounts[nextHash] ?? 0) + 1,
  };

  const nextCheckRepeats = { ...prevState.checkRepeatCounts };
  if (chosen.givesCheck) {
    const checkKey = `${prevState.turn}:${nextHash}`;
    nextCheckRepeats[checkKey] = (nextCheckRepeats[checkKey] ?? 0) + 1;
  }

  const nextInCheck = isGeneralInCheck(nextBoard, nextTurn);
  const nextReplies = generateLegalXiangqiMoves(nextBoard, nextTurn, nextCheckRepeats);

  let phase: XiangqiState['phase'] = 'PLAYING';
  let winner: XiangqiState['winner'] = null;
  let endReason: XiangqiState['endReason'] = null;

  if (nextReplies.length === 0) {
    // Trong Cờ Tướng: cả Chiếu Bí lẫn Khốn Bí (hết nước đi hợp lệ) đều xử THUA!
    phase = 'GAME_OVER';
    winner = prevState.turn;
    endReason = nextInCheck ? 'CHECKMATE' : 'STALEMATE_LOSS';
  } else if (isInsufficientXiangqiAttack(nextBoard)) {
    phase = 'GAME_OVER';
    winner = 'DRAW';
    endReason = 'INSUFFICIENT_ATTACK';
  } else if (nextPosCounts[nextHash] >= 3 && !chosen.givesCheck) {
    phase = 'GAME_OVER';
    winner = 'DRAW';
    endReason = 'THREEFOLD_REPETITION';
  } else if (nextHalfMove >= 120) {
    phase = 'GAME_OVER';
    winner = 'DRAW';
    endReason = 'SIXTY_MOVE_RULE';
  }

  const nextUndo = [...prevState.undoStack, undoSnap];
  if (nextUndo.length > 40) nextUndo.shift();

  return {
    ...prevState,
    phase,
    turn: nextTurn,
    board: nextBoard,
    halfMoveClock: nextHalfMove,
    fullMoveNumber: nextFullMove,
    inCheck: nextInCheck,
    winner,
    endReason,
    lastMove: chosen,
    history: [...prevState.history, chosen],
    capturedByRed,
    capturedByGreen,
    positionCounts: nextPosCounts,
    checkRepeatCounts: nextCheckRepeats,
    pendingDrawOfferFrom: null,
    undoStack: nextUndo,
  };
}
