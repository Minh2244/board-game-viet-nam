import {
  CLOCKWISE_COLORS,
  HORSE_COLOR_CONFIG,
  SAFE_DOOR_PROGRESS,
} from './boardGeometry';
import {
  computeLegalHorseMoves,
  computeRankings,
  hasColorWon,
  isDeployAndBonusDice,
  rollSmartHorseDice,
} from './rules';
import type {
  CoCaNguaAction,
  CoCaNguaState,
  HorseAnimStep,
  HorseColor,
  HorseLogEntry,
  HorsePiece,
  HorsePlayerState,
} from './types';

let logUid = 1;
function appendLog(
  state: CoCaNguaState,
  text: string,
  tone: HorseLogEntry['tone'] = 'info',
): void {
  state.logs.unshift({
    id: `ccn_${logUid++}`,
    turn: state.turnCount,
    text,
    tone,
  });
  if (state.logs.length > 40) {
    state.logs.length = 40;
  }
}

export interface CreateCoCaNguaOptions {
  players: {
    color: HorseColor;
    name: string;
    isBot: boolean;
  }[];
  startingPlayerIndex?: number;
  roomCode?: string;
}

export function createInitialCoCaNguaState(options: CreateCoCaNguaOptions): CoCaNguaState {
  // Sắp xếp lại người chơi theo đúng chiều kim đồng hồ chuẩn bàn cờ
  const sortedPlayers: HorsePlayerState[] = [...options.players]
    .sort((a, b) => CLOCKWISE_COLORS.indexOf(a.color) - CLOCKWISE_COLORS.indexOf(b.color))
    .map((p) => ({
      color: p.color,
      name: p.name.trim() || `Phe ${HORSE_COLOR_CONFIG[p.color].nameVi}`,
      isBot: p.isBot,
      kicksCount: 0,
    }));

  const horses: HorsePiece[] = [];
  for (const p of sortedPlayers) {
    for (let slot = 0 as 0 | 1 | 2 | 3; slot < 4; slot = (slot + 1) as 0 | 1 | 2 | 3) {
      horses.push({
        id: `${p.color}_${slot}`,
        color: p.color,
        slotIndex: slot,
        zone: 'STABLE',
        progress: -1,
        stairStep: 0,
      });
    }
  }

  const startIdx =
    options.startingPlayerIndex !== undefined
      ? Math.max(0, Math.min(sortedPlayers.length - 1, options.startingPlayerIndex))
      : 0;

  const state: CoCaNguaState = {
    version: 1,
    roomCode: options.roomCode,
    phase: 'WAIT_ROLL',
    turnCount: 1,
    players: sortedPlayers,
    currentPlayerIndex: startIdx,
    horses,
    lastDiceValue: null,
    pendingExtraTurn: false,
    legalMoves: [],
    winnerColor: null,
    rankings: [],
    lastMoveSummary: null,
    logs: [],
  };

  appendLog(
    state,
    `Ván Cờ Cá Ngựa bắt đầu (${sortedPlayers.length} màu)! Lượt của ${sortedPlayers[startIdx].name}.`,
    'good',
  );
  return state;
}

export function validateCoCaNguaAction(
  state: CoCaNguaState,
  action: CoCaNguaAction,
  actorColor?: HorseColor,
): { valid: boolean; reason?: string } {
  if (state.phase === 'GAME_OVER') {
    return { valid: false, reason: 'Ván đấu đã kết thúc.' };
  }
  const current = state.players[state.currentPlayerIndex];
  if (actorColor && actorColor !== current.color) {
    return { valid: false, reason: 'Chưa tới lượt của màu này.' };
  }
  if (action.type === 'ROLL_DICE') {
    if (state.phase !== 'WAIT_ROLL') {
      return { valid: false, reason: 'Đang chờ chọn quân ngựa để di chuyển.' };
    }
    if (action.diceValue !== undefined && (action.diceValue < 1 || action.diceValue > 6)) {
      return { valid: false, reason: 'Giá trị xúc xắc không hợp lệ.' };
    }
    return { valid: true };
  }
  if (action.type === 'EXECUTE_MOVE') {
    if (state.phase !== 'SELECT_HORSE') {
      return { valid: false, reason: 'Hãy tung xúc xắc trước khi chọn quân.' };
    }
    const found = state.legalMoves.some((m) => m.horseId === action.horseId);
    if (!found) {
      return { valid: false, reason: 'Quân ngựa này không có nước đi hợp lệ.' };
    }
    return { valid: true };
  }
  return { valid: false, reason: 'Hành động không hợp lệ.' };
}

/**
 * Pure Reducer Cờ Cá Ngựa: xử lý tung xúc xắc & di chuyển quân, trả về trạng thái mới + mảng hoạt ảnh tuần tự.
 */
export function reduceCoCaNguaAction(
  prevState: CoCaNguaState,
  action: CoCaNguaAction,
): { state: CoCaNguaState; steps: HorseAnimStep[] } {
  const check = validateCoCaNguaAction(prevState, action);
  if (!check.valid) {
    return { state: prevState, steps: [] };
  }

  const state: CoCaNguaState = structuredClone(prevState);
  const steps: HorseAnimStep[] = [];
  const current = state.players[state.currentPlayerIndex];

  if (action.type === 'ROLL_DICE') {
    const diceValue = action.diceValue ?? rollSmartHorseDice(state);
    const bonusTurn = isDeployAndBonusDice(diceValue);
    const legalMoves = computeLegalHorseMoves(state.horses, current.color, diceValue);

    state.lastDiceValue = diceValue;
    state.pendingExtraTurn = bonusTurn;
    state.legalMoves = legalMoves;

    steps.push({
      type: 'DICE_ROLLED',
      color: current.color,
      diceValue,
      bonusTurn,
      hasLegalMoves: legalMoves.length > 0,
    });

    if (legalMoves.length > 0) {
      state.phase = 'SELECT_HORSE';
      state.lastMoveSummary = `${current.name} đổ được ${diceValue} nút${bonusTurn ? ' (thưởng thêm lượt!)' : ''} — Chọn quân ngựa đi!`;
      appendLog(
        state,
        `🎲 ${current.name} đổ được ${diceValue} nút${bonusTurn ? ' (được thêm lượt!)' : ''}.`,
        bonusTurn ? 'good' : 'info',
      );
      return { state, steps };
    }

    // Không có nước đi hợp lệ nào
    steps.push({
      type: 'NO_MOVES_SKIP',
      color: current.color,
      diceValue,
      keepsTurn: bonusTurn,
    });

    if (bonusTurn) {
      state.phase = 'WAIT_ROLL';
      state.legalMoves = [];
      state.pendingExtraTurn = false;
      state.lastMoveSummary = `${current.name} đổ ${diceValue} (không có nước đi) nhưng vẫn được tung thêm lượt!`;
      appendLog(state, state.lastMoveSummary, 'warn');
    } else {
      state.phase = 'WAIT_ROLL';
      state.legalMoves = [];
      state.pendingExtraTurn = false;
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      state.turnCount += 1;
      const nextPlayer = state.players[state.currentPlayerIndex];
      state.lastMoveSummary = `${current.name} đổ ${diceValue} không đi được — chuyển lượt cho ${nextPlayer.name}.`;
      appendLog(state, state.lastMoveSummary, 'warn');
    }
    return { state, steps };
  }

  // EXECUTE_MOVE
  const move = state.legalMoves.find((m) => m.horseId === action.horseId);
  if (!move) return { state: prevState, steps: [] };

  const horse = state.horses.find((h) => h.id === move.horseId)!;

  // Xử lý đá ngựa đối phương (nếu có)
  if (move.kickedHorseId) {
    const victim = state.horses.find((h) => h.id === move.kickedHorseId);
    if (victim) {
      victim.zone = 'STABLE';
      victim.progress = -1;
      victim.stairStep = 0;
      current.kicksCount += 1;
    }
  }

  // Cập nhật vị trí quân ngựa vừa đi
  if (move.kind === 'DEPLOY') {
    horse.zone = 'TRACK';
    horse.progress = 0;
    horse.stairStep = 0;
    steps.push({
      type: 'HORSE_DEPLOY',
      horseId: horse.id,
      color: horse.color,
      toTrackIndex: move.toTrackIndex!,
      kickedHorseId: move.kickedHorseId,
      kickedColor: move.kickedColor,
    });
    const kickTxt = move.kickedColor
      ? ` và ĐÁ ngựa ${HORSE_COLOR_CONFIG[move.kickedColor].nameVi} về chuồng!`
      : '!';
    state.lastMoveSummary = `🐎 ${current.name} xuất chuồng (nút ${move.diceValue})${kickTxt}`;
    appendLog(state, state.lastMoveSummary, move.kickedColor ? 'kick' : 'good');
  } else if (move.kind === 'ADVANCE_TRACK') {
    horse.zone = 'TRACK';
    horse.progress = move.toProgress;
    horse.stairStep = 0;
    const reachedSafeDoor = move.toProgress === SAFE_DOOR_PROGRESS;
    steps.push({
      type: 'HORSE_HOP',
      horseId: horse.id,
      color: horse.color,
      trackPath: move.stepTrackPath,
      kickedHorseId: move.kickedHorseId,
      kickedColor: move.kickedColor,
      reachedSafeDoor,
    });
    if (move.kickedColor) {
      state.lastMoveSummary = `💥 ${current.name} tiến ${move.diceValue} ô và ĐÁ bay ngựa ${HORSE_COLOR_CONFIG[move.kickedColor].nameVi} về chuồng!`;
      appendLog(state, state.lastMoveSummary, 'kick');
    } else if (reachedSafeDoor) {
      state.lastMoveSummary = `★ ${current.name} đưa ngựa về tới Ô Cửa Lên Bụt ★!`;
      appendLog(state, state.lastMoveSummary, 'good');
    } else {
      state.lastMoveSummary = `${current.name} tiến ngựa ${move.diceValue} ô trên đường đua.`;
      appendLog(state, state.lastMoveSummary, 'info');
    }
  } else {
    // ENTER_STAIRS hoặc CLIMB_STAIRS (cho phép cả đi lên lẫn lùi xuống!)
    const fromSafeDoor = move.kind === 'ENTER_STAIRS';
    const climbedDown = !fromSafeDoor && move.toStairStep < move.fromStairStep;
    horse.zone = 'HOME_STAIRS';
    horse.progress = -1;
    horse.stairStep = move.toStairStep;
    steps.push({
      type: 'HORSE_CLIMB',
      horseId: horse.id,
      color: horse.color,
      fromStairStep: move.fromStairStep,
      toStairStep: move.toStairStep,
      fromSafeDoor,
    });
    state.lastMoveSummary = fromSafeDoor
      ? `🏆 ${current.name} đưa ngựa leo thẳng lên Bụt số ${move.toStairStep}!`
      : climbedDown
        ? `⬇️ ${current.name} đổi bụt xuống từ bậc ${move.fromStairStep} về Bụt số ${move.toStairStep}.`
        : `⬆️ ${current.name} đổi bụt từ bậc ${move.fromStairStep} lên Bụt số ${move.toStairStep}!`;
    appendLog(state, state.lastMoveSummary, climbedDown ? 'info' : 'good');
  }

  state.legalMoves = [];

  // Kiểm tra điều kiện chiến thắng: đủ 4 quân xếp kín 4 bậc 3–4–5–6!
  if (hasColorWon(state.horses, current.color)) {
    state.phase = 'GAME_OVER';
    state.winnerColor = current.color;
    state.pendingExtraTurn = false;
    state.rankings = computeRankings(state);
    steps.push({
      type: 'VICTORY',
      winnerColor: current.color,
      winnerName: current.name,
    });
    state.lastMoveSummary = `👑 ${current.name.toUpperCase()} XẾP KÍN BỤT 3–4–5–6 VÀ CHIẾN THẮNG!`;
    appendLog(state, state.lastMoveSummary, 'good');
    return { state, steps };
  }

  // Thưởng thêm lượt nếu vừa gieo được 1 hoặc 6
  if (state.pendingExtraTurn) {
    state.phase = 'WAIT_ROLL';
    state.pendingExtraTurn = false;
    appendLog(state, `✨ ${current.name} được thưởng thêm 1 lượt tung xúc xắc!`, 'good');
  } else {
    state.phase = 'WAIT_ROLL';
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    state.turnCount += 1;
  }

  return { state, steps };
}
