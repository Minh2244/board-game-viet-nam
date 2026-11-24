import {
  applyMoveToBoard,
  createInitialChessBoard,
  generateLegalMoves,
  getPositionHash,
  isInsufficientMaterial,
  isKingInCheck,
  oppositeColor,
} from './rules';
import type { ChessAction, ChessColor, ChessState, ChessUndoSnapshot } from './types';

export interface CreateChessOptions {
  whiteName: string;
  whiteIsBot: boolean;
  blackName: string;
  blackIsBot: boolean;
  roomCode?: string;
}

export function createInitialChessState(options: CreateChessOptions): ChessState {
  const board = createInitialChessBoard();
  const castling = { wK: true, wQ: true, bK: true, bQ: true };
  const initialHash = getPositionHash(board, 'white', castling, null);

  return {
    version: 1,
    roomCode: options.roomCode,
    phase: 'PLAYING',
    turn: 'white',
    players: {
      white: { name: options.whiteName.trim() || 'Bên Trắng', isBot: options.whiteIsBot },
      black: { name: options.blackName.trim() || 'Bên Đen', isBot: options.blackIsBot },
    },
    board,
    castling,
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    inCheck: false,
    winner: null,
    endReason: null,
    lastMove: null,
    history: [],
    capturedByWhite: [],
    capturedByBlack: [],
    positionCounts: { [initialHash]: 1 },
    pendingDrawOfferFrom: null,
    undoStack: [],
  };
}

function makeUndoSnapshot(state: ChessState): ChessUndoSnapshot {
  return {
    turn: state.turn,
    board: state.board.map((p) => (p ? { ...p } : null)),
    castling: { ...state.castling },
    enPassantTarget: state.enPassantTarget,
    halfMoveClock: state.halfMoveClock,
    fullMoveNumber: state.fullMoveNumber,
    inCheck: state.inCheck,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    history: state.history.map((m) => ({ ...m })),
    capturedByWhite: [...state.capturedByWhite],
    capturedByBlack: [...state.capturedByBlack],
    positionCounts: { ...state.positionCounts },
  };
}

export function reduceChessAction(prevState: ChessState, action: ChessAction): ChessState {
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
      castling: { ...snap.castling },
      enPassantTarget: snap.enPassantTarget,
      halfMoveClock: snap.halfMoveClock,
      fullMoveNumber: snap.fullMoveNumber,
      inCheck: snap.inCheck,
      winner: null,
      endReason: null,
      lastMove: snap.lastMove ? { ...snap.lastMove } : null,
      history: snap.history.map((m) => ({ ...m })),
      capturedByWhite: [...snap.capturedByWhite],
      capturedByBlack: [...snap.capturedByBlack],
      positionCounts: { ...snap.positionCounts },
      pendingDrawOfferFrom: null,
      undoStack: prevState.undoStack.slice(0, targetIdx),
    };
  }

  if (prevState.phase === 'GAME_OVER') return prevState;

  if (action.type === 'RESIGN') {
    return {
      ...prevState,
      phase: 'GAME_OVER',
      winner: oppositeColor(action.color),
      endReason: 'RESIGN',
      pendingDrawOfferFrom: null,
    };
  }

  if (action.type === 'OFFER_DRAW') {
    return {
      ...prevState,
      pendingDrawOfferFrom: action.from,
    };
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
    return {
      ...prevState,
      pendingDrawOfferFrom: null,
    };
  }

  // MOVE
  const legalMoves = generateLegalMoves(
    prevState.board,
    prevState.turn,
    prevState.castling,
    prevState.enPassantTarget,
  );
  const chosen = legalMoves.find(
    (m) =>
      m.from === action.from &&
      m.to === action.to &&
      (m.promotion ? m.promotion === (action.promotion ?? 'q') : true),
  );
  if (!chosen) return prevState;

  const undoSnap = makeUndoSnapshot(prevState);
  const { nextBoard, nextCastling, nextEnPassant } = applyMoveToBoard(
    prevState.board,
    chosen,
    prevState.castling,
  );

  const nextTurn: ChessColor = oppositeColor(prevState.turn);
  const nextHalfMove =
    chosen.piece === 'p' || chosen.captured ? 0 : prevState.halfMoveClock + 1;
  const nextFullMove =
    prevState.turn === 'black' ? prevState.fullMoveNumber + 1 : prevState.fullMoveNumber;

  const capturedByWhite = [...prevState.capturedByWhite];
  const capturedByBlack = [...prevState.capturedByBlack];
  if (chosen.captured) {
    if (chosen.color === 'white') capturedByWhite.push(chosen.captured);
    else capturedByBlack.push(chosen.captured);
  }

  const nextHash = getPositionHash(nextBoard, nextTurn, nextCastling, nextEnPassant);
  const nextPosCounts = {
    ...prevState.positionCounts,
    [nextHash]: (prevState.positionCounts[nextHash] ?? 0) + 1,
  };

  const nextInCheck = isKingInCheck(nextBoard, nextTurn);
  const nextLegalReplies = generateLegalMoves(nextBoard, nextTurn, nextCastling, nextEnPassant);

  let phase: ChessState['phase'] = 'PLAYING';
  let winner: ChessState['winner'] = null;
  let endReason: ChessState['endReason'] = null;

  if (nextLegalReplies.length === 0) {
    phase = 'GAME_OVER';
    if (nextInCheck) {
      winner = prevState.turn;
      endReason = 'CHECKMATE';
    } else {
      winner = 'DRAW';
      endReason = 'STALEMATE';
    }
  } else if (isInsufficientMaterial(nextBoard)) {
    phase = 'GAME_OVER';
    winner = 'DRAW';
    endReason = 'INSUFFICIENT_MATERIAL';
  } else if (nextPosCounts[nextHash] >= 3) {
    phase = 'GAME_OVER';
    winner = 'DRAW';
    endReason = 'THREEFOLD_REPETITION';
  } else if (nextHalfMove >= 100) {
    phase = 'GAME_OVER';
    winner = 'DRAW';
    endReason = 'FIFTY_MOVE_RULE';
  }

  const nextUndoStack = [...prevState.undoStack, undoSnap];
  if (nextUndoStack.length > 40) nextUndoStack.shift();

  return {
    ...prevState,
    phase,
    turn: nextTurn,
    board: nextBoard,
    castling: nextCastling,
    enPassantTarget: nextEnPassant,
    halfMoveClock: nextHalfMove,
    fullMoveNumber: nextFullMove,
    inCheck: nextInCheck,
    winner,
    endReason,
    lastMove: chosen,
    history: [...prevState.history, chosen],
    capturedByWhite,
    capturedByBlack,
    positionCounts: nextPosCounts,
    pendingDrawOfferFrom: null,
    undoStack: nextUndoStack,
  };
}
