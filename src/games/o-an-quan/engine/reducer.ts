import {
  assertBoardInvariants,
  computePlayerScore,
  DEFAULT_O_AN_QUAN_RULES,
  getNextPitIndex,
  getOwnedPitIndices,
  INITIAL_DAN_PER_PIT,
  isMandarinPitIndex,
  isPitEmpty,
  MANDARIN_LEFT_INDEX,
  MANDARIN_RIGHT_INDEX,
  MAX_CHAIN_PICKS_PER_TURN,
  TOTAL_BOARD_PITS,
  validateSowAction,
} from './rules';
import type {
  CharacterId,
  MoveHistoryEntry,
  OAnQuanAnimStep,
  OAnQuanRulesConfig,
  OAnQuanState,
  PitState,
  PlayerMatchState,
  PlayerSide,
  SowDirection,
} from './types';

function clonePits(pits: readonly PitState[]): PitState[] {
  return pits.map((p) => ({ ...p }));
}

function clonePlayers(
  players: readonly [PlayerMatchState, PlayerMatchState],
): [PlayerMatchState, PlayerMatchState] {
  return [{ ...players[0] }, { ...players[1] }];
}

function syncPlayerScores(
  players: [PlayerMatchState, PlayerMatchState],
  mandarinPointValue: 5 | 10 = 10,
): void {
  players[0].score = computePlayerScore(players[0], mandarinPointValue);
  players[1].score = computePlayerScore(players[1], mandarinPointValue);
}

export interface CreateInitialOAnQuanOptions {
  player0?: { name?: string; characterId?: CharacterId; isBot?: boolean };
  player1?: { name?: string; characterId?: CharacterId; isBot?: boolean };
  startingSide?: PlayerSide;
  rules?: Partial<OAnQuanRulesConfig>;
  roomCode?: string;
}

export function createInitialOAnQuanState(options: CreateInitialOAnQuanOptions = {}): OAnQuanState {
  const pits: PitState[] = Array.from({ length: TOTAL_BOARD_PITS }, (_, idx) => {
    if (isMandarinPitIndex(idx)) {
      return {
        index: idx,
        kind: 'QUAN',
        ownerSide: null,
        stones: 0,
        hasMandarin: true,
      };
    }
    const ownerSide: PlayerSide = idx < 5 ? 0 : 1;
    return {
      index: idx,
      kind: 'DAN',
      ownerSide,
      stones: INITIAL_DAN_PER_PIT,
      hasMandarin: false,
    };
  });

  const p0: PlayerMatchState = {
    side: 0,
    name: options.player0?.name?.trim() || 'Cu Tí',
    characterId: options.player0?.characterId ?? 'cu_ti',
    isBot: options.player0?.isBot ?? false,
    capturedDan: 0,
    capturedQuan: 0,
    borrowedDan: 0,
    loanedDan: 0,
    sweptDanGross: 0,
    sweptDanNet: 0,
    score: 0,
  };

  const p1: PlayerMatchState = {
    side: 1,
    name: options.player1?.name?.trim() || 'Bé Mít',
    characterId: options.player1?.characterId ?? 'be_mit',
    isBot: options.player1?.isBot ?? true,
    capturedDan: 0,
    capturedQuan: 0,
    borrowedDan: 0,
    loanedDan: 0,
    sweptDanGross: 0,
    sweptDanNet: 0,
    score: 0,
  };

  const rules: OAnQuanRulesConfig = {
    ...DEFAULT_O_AN_QUAN_RULES,
    ...options.rules,
  };

  const state: OAnQuanState = {
    pits,
    players: [p0, p1],
    currentSide: options.startingSide ?? 0,
    turnCount: 1,
    rules,
    phase: 'WAITING_MOVE',
    moveHistory: [],
    lastMove: null,
    finalSummary: null,
    roomCode: options.roomCode,
  };

  assertBoardInvariants(state);
  return state;
}

/**
 * Thu quân cuối ván, tách sweptDanGross / sweptDanNet, xử lý trả nợ vật lý theo thứ tự cố định
 * (chỉ xử lý duy nhất 1 khoản nợ ròng đang tồn tại), tách điểm trung lập S_neutral và chốt điểm chung cuộc.
 */
export function finalizeGameOverAndSweep(
  mutState: OAnQuanState,
  endReason: 'BOTH_MANDARINS_EMPTY' | 'NO_LEGAL_MOVES_STALEMATE',
  steps: OAnQuanAnimStep[],
): void {
  if (mutState.phase === 'GAME_OVER') return;

  // Bước 1: Thu toàn bộ dân trên 5 ô mỗi bên vào sweptDanGross
  let gross0 = 0;
  for (const idx of getOwnedPitIndices(0)) {
    gross0 += mutState.pits[idx].stones;
    mutState.pits[idx].stones = 0;
  }
  let gross1 = 0;
  for (const idx of getOwnedPitIndices(1)) {
    gross1 += mutState.pits[idx].stones;
    mutState.pits[idx].stones = 0;
  }

  let net0 = gross0;
  let net1 = gross1;
  let repaidBy0 = 0;
  let repaidBy1 = 0;

  const p0 = mutState.players[0];
  const p1 = mutState.players[1];

  // Bước 2: Xử lý trả nợ vật lý theo thứ tự cố định (vì Sổ Nợ Ròng Một Chiều nên chỉ tối đa 1 bên có borrowedDan > 0)
  if (p0.borrowedDan > 0) {
    repaidBy0 = Math.min(net0, p0.borrowedDan);
    net0 -= repaidBy0;
    p1.capturedDan += repaidBy0;
    p0.borrowedDan -= repaidBy0;
    p1.loanedDan -= repaidBy0;
  } else if (p1.borrowedDan > 0) {
    repaidBy1 = Math.min(net1, p1.borrowedDan);
    net1 -= repaidBy1;
    p0.capturedDan += repaidBy1;
    p1.borrowedDan -= repaidBy1;
    p0.loanedDan -= repaidBy1;
  }

  p0.sweptDanGross = gross0;
  p0.sweptDanNet = net0;
  p1.sweptDanGross = gross1;
  p1.sweptDanNet = net1;

  // Bước 3: Ghi nhận Quân Trung Lập còn lại trong 2 ô Quan (5 & 11)
  const qVal: 5 | 10 = mutState.rules.mandarinPointValue === 5 ? 5 : 10;
  const pit5 = mutState.pits[MANDARIN_RIGHT_INDEX];
  const pit11 = mutState.pits[MANDARIN_LEFT_INDEX];
  const neutralQuan = (pit5.hasMandarin ? 1 : 0) + (pit11.hasMandarin ? 1 : 0);
  const neutralDan = pit5.stones + pit11.stones;
  const neutralScore = neutralQuan * qVal + neutralDan;

  // Bước 4: Tính điểm chung cuộc chỉ dùng sweptDanNet và dư nợ còn lại
  syncPlayerScores(mutState.players, qVal);
  const s0 = p0.score;
  const s1 = p1.score;
  const winnerSide: PlayerSide | 'DRAW' = s0 > s1 ? 0 : s1 > s0 ? 1 : 'DRAW';

  mutState.phase = 'GAME_OVER';
  mutState.finalSummary = {
    endReason,
    winnerSide,
    scores: [s0, s1],
    sweptStonesGross: [gross0, gross1],
    sweptStonesNet: [net0, net1],
    repaidFromSwept: [repaidBy0, repaidBy1],
    neutralQuan,
    neutralDan,
    neutralScore,
  };

  steps.push({
    type: 'SWEEP_REMAINING',
    endReason,
    sweptGrossBySide0: gross0,
    sweptGrossBySide1: gross1,
    sweptNetBySide0: net0,
    sweptNetBySide1: net1,
    repaidFromSweptBySide0: repaidBy0,
    repaidFromSweptBySide1: repaidBy1,
    neutralScore,
    finalScores: [s0, s1],
    winnerSide,
    pitsSnapshot: clonePits(mutState.pits),
    playersSnapshot: clonePlayers(mutState.players),
  });

  assertBoardInvariants(mutState);
}

/**
 * Kiểm tra đầu lượt của phe `mutState.currentSide`:
 * 1. Nếu cả 2 ô Quan đã trống sạch -> Kết thúc ván ('BOTH_MANDARINS_EMPTY').
 * 2. Nếu cả 5 ô dân của phe currentSide đều trống (0 quân):
 *    - Nếu tổng capturedDan của cả 2 giỏ < 5 -> Không đủ 5 dân vật lý để rải lại -> Kết thúc ván do Bế Tắc ('NO_LEGAL_MOVES_STALEMATE').
 *    - Nếu tổng capturedDan >= 5 -> Trích capturedDan của mình + vay phần thiếu từ capturedDan đối thủ, rải đủ 1 viên/ô vào cả 5 ô dân.
 */
export function ensureCurrentTurnReady(
  mutState: OAnQuanState,
  steps: OAnQuanAnimStep[] = [],
): { refilledFromSelf: number; borrowedFromOpponent: number; offsetOldDebt: number } {
  if (mutState.phase === 'GAME_OVER') {
    return { refilledFromSelf: 0, borrowedFromOpponent: 0, offsetOldDebt: 0 };
  }

  const bothQuanEmpty =
    isPitEmpty(mutState.pits[MANDARIN_RIGHT_INDEX]) &&
    isPitEmpty(mutState.pits[MANDARIN_LEFT_INDEX]);
  if (bothQuanEmpty) {
    finalizeGameOverAndSweep(mutState, 'BOTH_MANDARINS_EMPTY', steps);
    return { refilledFromSelf: 0, borrowedFromOpponent: 0, offsetOldDebt: 0 };
  }

  const side = mutState.currentSide;
  const ownedIndices = getOwnedPitIndices(side);
  const hasAnyStone = ownedIndices.some((idx) => mutState.pits[idx].stones > 0);
  if (hasAnyStone) {
    return { refilledFromSelf: 0, borrowedFromOpponent: 0, offsetOldDebt: 0 };
  }

  const opp: PlayerSide = side === 0 ? 1 : 0;
  const pSelf = mutState.players[side];
  const pOpp = mutState.players[opp];

  const totalAvailableDan = pSelf.capturedDan + pOpp.capturedDan;
  if (totalAvailableDan < 5) {
    finalizeGameOverAndSweep(mutState, 'NO_LEGAL_MOVES_STALEMATE', steps);
    return { refilledFromSelf: 0, borrowedFromOpponent: 0, offsetOldDebt: 0 };
  }

  const fromSelf = Math.min(5, pSelf.capturedDan);
  pSelf.capturedDan -= fromSelf;

  const needFromOpp = 5 - fromSelf;
  let offsetOldDebt = 0;
  let newBorrowed = 0;

  if (needFromOpp > 0) {
    pOpp.capturedDan -= needFromOpp;
    if (pOpp.borrowedDan > 0) {
      offsetOldDebt = Math.min(needFromOpp, pOpp.borrowedDan);
      pOpp.borrowedDan -= offsetOldDebt;
      pSelf.loanedDan -= offsetOldDebt;
    }
    newBorrowed = needFromOpp - offsetOldDebt;
    if (newBorrowed > 0) {
      pSelf.borrowedDan += newBorrowed;
      pOpp.loanedDan += newBorrowed;
    }
  }

  for (const idx of ownedIndices) {
    mutState.pits[idx].stones = 1;
  }

  const qVal: 5 | 10 = mutState.rules.mandarinPointValue === 5 ? 5 : 10;
  syncPlayerScores(mutState.players, qVal);

  steps.push({
    type: 'REFILL_FIVE_PITS',
    side,
    fromSelf,
    borrowedFromOpponent: newBorrowed,
    offsetOldDebt,
    pitsSnapshot: clonePits(mutState.pits),
    playersSnapshot: clonePlayers(mutState.players),
  });

  assertBoardInvariants(mutState);
  return {
    refilledFromSelf: fromSelf,
    borrowedFromOpponent: newBorrowed,
    offsetOldDebt,
  };
}

/**
 * Chuẩn bị trạng thái đầu lượt trên một bản sao bất biến (hữu ích khi khởi tạo thế cờ test có 5 ô dân trống).
 */
export function prepareTurnState(prevState: OAnQuanState): {
  state: OAnQuanState;
  steps: OAnQuanAnimStep[];
} {
  const nextState: OAnQuanState = {
    ...prevState,
    pits: clonePits(prevState.pits),
    players: clonePlayers(prevState.players),
    moveHistory: [...prevState.moveHistory],
  };
  const steps: OAnQuanAnimStep[] = [];
  ensureCurrentTurnReady(nextState, steps);
  return { state: nextState, steps };
}

/**
 * Thực thi trọn vẹn 1 lượt đi của người chơi hiện tại (1 Ply):
 * - Bốc & rải từng viên qua mọi ô (kể cả > 12 viên giáp nhiều vòng).
 * - Nối lượt khi viên cuối dừng trước Ô Dân có quân.
 * - Dừng lượt khi viên cuối dừng trước Ô Quan đang có quân.
 * - Xét Ăn & Ăn Liên Hoàn (Combo) khi viên cuối dừng trước Ô Trống (bắt buộc dừng lượt ngay sau chuỗi ăn).
 * - Tự động hoàn trả nợ vật lý ngay cuối lượt nếu người đang nợ ăn được dân.
 * - Kiểm tra kết thúc ván Hết 2 Quan hoặc chuẩn bị Rải Dân / Vay Nợ (hoặc Bế Tắc) cho lượt kế tiếp.
 */
export function executeSowMove(
  prevState: OAnQuanState,
  pitIndex: number,
  direction: SowDirection,
  actorSide: PlayerSide = prevState.currentSide,
): { state: OAnQuanState; steps: OAnQuanAnimStep[] } {
  const nextState: OAnQuanState = {
    ...prevState,
    pits: clonePits(prevState.pits),
    players: clonePlayers(prevState.players),
    moveHistory: [...prevState.moveHistory],
  };
  const steps: OAnQuanAnimStep[] = [];

  // Đảm bảo đầu lượt hiện tại đã được kiểm tra rải dân / bế tắc (nếu thế cờ tùy chỉnh chưa gọi prepareTurnState)
  const preRefill = ensureCurrentTurnReady(nextState, steps);
  if (nextState.phase === 'GAME_OVER') {
    return { state: nextState, steps };
  }

  const check = validateSowAction(nextState, actorSide, pitIndex, direction);
  if (!check.valid) {
    throw new Error(check.reason || 'Nước đi không hợp lệ.');
  }

  const side = nextState.currentSide;
  const opp: PlayerSide = side === 0 ? 1 : 0;
  const player = nextState.players[side];
  const opponent = nextState.players[opp];
  const { pits, rules } = nextState;

  let cursor = pitIndex;
  let hand = pits[cursor].stones;
  pits[cursor].stones = 0;

  steps.push({
    type: 'PICKUP_PIT',
    side,
    pitIndex: cursor,
    stoneCount: hand,
    isChainContinue: false,
    pitsSnapshot: clonePits(pits),
  });

  let chainPickCount = 0;
  let capturedDanGain = 0;
  let capturedQuanGain = 0;
  let comboCount = 0;
  let repaidDebtInTurn = 0;

  while (true) {
    // 1. Rải từng viên một qua tất cả các ô liên tiếp (không bỏ sót ô nào, kể cả ô Quan và ô xuất phát khi >= 12 viên)
    while (hand > 0) {
      cursor = getNextPitIndex(cursor, direction);
      pits[cursor].stones += 1;
      hand -= 1;

      steps.push({
        type: 'DROP_STONE',
        side,
        pitIndex: cursor,
        remainingInHand: hand,
        pitsSnapshot: clonePits(pits),
      });
    }

    // 2. Chỉ khi hết sạch quân trên tay (hand === 0) tại lastIdx = cursor mới kiểm tra ô kế tiếp nextIdx
    const nextIdx = getNextPitIndex(cursor, direction);
    const nextPit = pits[nextIdx];

    // Trường hợp A: Ô kế tiếp là Ô Dân đang có quân -> Bốc toàn bộ số dân hiện có trong nextIdx để rải tiếp!
    if (nextPit.kind === 'DAN' && nextPit.stones > 0) {
      if (chainPickCount >= MAX_CHAIN_PICKS_PER_TURN) {
        steps.push({
          type: 'STOP_TURN',
          side,
          stopPitIndex: nextIdx,
          reason: 'MAX_CHAIN_GUARD',
        });
        break;
      }
      chainPickCount += 1;
      cursor = nextIdx;
      hand = nextPit.stones;
      nextPit.stones = 0;

      steps.push({
        type: 'PICKUP_PIT',
        side,
        pitIndex: cursor,
        stoneCount: hand,
        isChainContinue: true,
        pitsSnapshot: clonePits(pits),
      });
      continue;
    }

    // Trường hợp B: Ô kế tiếp là Ô Quan đang có quân -> Dừng lượt ngay lập tức (không được bốc ô Quan)
    if (nextPit.kind === 'QUAN' && !isPitEmpty(nextPit)) {
      steps.push({
        type: 'STOP_TURN',
        side,
        stopPitIndex: nextIdx,
        reason: 'HIT_MANDARIN_PIT',
      });
      break;
    }

    // Trường hợp C: Ô kế tiếp TRỐNG (0 Quan, 0 dân) -> Xét chuỗi Ăn Liên Hoàn
    let emptyIdx = nextIdx;
    while (comboCount < 6) {
      const emptyPit = pits[emptyIdx];
      if (!isPitEmpty(emptyPit)) {
        // (a) Ô ngay sau ô vừa ăn đang có quân -> Dừng chuỗi ăn ngay (Cấm bốc rải tiếp!)
        steps.push({
          type: 'STOP_TURN',
          side,
          stopPitIndex: emptyIdx,
          reason: 'AFTER_CAPTURE_NON_EMPTY',
        });
        break;
      }

      const targetIdx = getNextPitIndex(emptyIdx, direction);
      const targetPit = pits[targetIdx];

      if (isPitEmpty(targetPit)) {
        // (b) Gặp 2 ô trống liên tiếp -> Dừng chuỗi ăn
        steps.push({
          type: 'STOP_TURN',
          side,
          stopPitIndex: targetIdx,
          reason: 'TWO_EMPTY',
        });
        break;
      }

      if (
        rules.mandarinYouthRule &&
        targetPit.kind === 'QUAN' &&
        targetPit.hasMandarin &&
        targetPit.stones < rules.minStonesForMandarin
      ) {
        // (c) Đụng Quan Non khi đang bật Luật Quan Non -> Không được ăn, dừng chuỗi ăn
        steps.push({
          type: 'STOP_TURN',
          side,
          stopPitIndex: targetIdx,
          reason: 'BLOCKED_BY_YOUTH_MANDARIN',
        });
        break;
      }

      // Ăn trọn bộ quân trong targetPit
      const stonesTaken = targetPit.stones;
      const mandarinTaken = targetPit.hasMandarin;

      player.capturedDan += stonesTaken;
      if (mandarinTaken) {
        player.capturedQuan += 1;
        capturedQuanGain += 1;
      }
      capturedDanGain += stonesTaken;
      targetPit.stones = 0;
      targetPit.hasMandarin = false;
      comboCount += 1;

      syncPlayerScores(nextState.players, rules.mandarinPointValue === 5 ? 5 : 10);

      steps.push({
        type: 'CAPTURE_PIT',
        side,
        emptyPitIndex: emptyIdx,
        capturedPitIndex: targetIdx,
        stonesTaken,
        mandarinTaken,
        comboIndex: comboCount,
        pitsSnapshot: clonePits(pits),
        playersSnapshot: clonePlayers(nextState.players),
      });

      // Dịch con trỏ sang ô đứng NGAY SAU targetIdx (tuyệt đối không dùng targetIdx vừa bị ăn làm ô trống bàn đạp!)
      emptyIdx = getNextPitIndex(targetIdx, direction);
    }

    // 3. Tự động hoàn trả nợ vật lý ngay cuối lượt nếu người chơi đang nợ (borrowedDan > 0) và có dân trong giỏ
    if (player.borrowedDan > 0 && player.capturedDan > 0) {
      const repay = Math.min(player.capturedDan, player.borrowedDan);
      player.capturedDan -= repay;
      opponent.capturedDan += repay;
      player.borrowedDan -= repay;
      opponent.loanedDan -= repay;
      repaidDebtInTurn = repay;
      syncPlayerScores(nextState.players, rules.mandarinPointValue === 5 ? 5 : 10);

      steps.push({
        type: 'AUTO_REPAY_DEBT',
        debtorSide: side,
        creditorSide: opp,
        repaidDan: repay,
        playersSnapshot: clonePlayers(nextState.players),
      });
    }

    // Đã bước vào pha Xét Ăn thì sau khi thoát vòng ăn BẮT BUỘC kết thúc lượt!
    break;
  }

  syncPlayerScores(nextState.players, rules.mandarinPointValue === 5 ? 5 : 10);

  const historyEntry: MoveHistoryEntry = {
    turnNumber: nextState.turnCount,
    side,
    pitIndex,
    direction,
    refilledFromSelf: preRefill.refilledFromSelf,
    borrowedFromOpponent: preRefill.borrowedFromOpponent,
    chainPickCount,
    capturedDanGain,
    capturedQuanGain,
    repaidDebtInTurn,
    comboCount,
  };
  nextState.lastMove = historyEntry;
  nextState.moveHistory.push(historyEntry);

  assertBoardInvariants(nextState);

  // 4. Sau khi hoàn tất toàn bộ lượt đi (và chuỗi ăn liên hoàn), kiểm tra điều kiện Hết Cả 2 Ô Quan
  const bothQuanEmpty =
    isPitEmpty(pits[MANDARIN_RIGHT_INDEX]) && isPitEmpty(pits[MANDARIN_LEFT_INDEX]);
  if (bothQuanEmpty) {
    finalizeGameOverAndSweep(nextState, 'BOTH_MANDARINS_EMPTY', steps);
    return { state: nextState, steps };
  }

  // 5. Chuyển lượt sang đối thủ và kiểm tra ngay đầu lượt đối thủ (Rải dân / Vay nợ hoặc Bế tắc nếu < 5 dân)
  nextState.currentSide = opp;
  nextState.turnCount += 1;
  ensureCurrentTurnReady(nextState, steps);

  assertBoardInvariants(nextState);
  return { state: nextState, steps };
}
