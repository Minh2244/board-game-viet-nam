import type {
  OAnQuanRulesConfig,
  OAnQuanState,
  PitState,
  PlayerMatchState,
  PlayerSide,
  SowDirection,
} from './types';

export const TOTAL_BOARD_PITS = 12;
export const MANDARIN_RIGHT_INDEX = 5;
export const MANDARIN_LEFT_INDEX = 11;
export const INITIAL_DAN_PER_PIT = 5;
export const MANDARIN_POINT_VALUE = 10;
export const TOTAL_PHYSICAL_DAN = 50;
export const TOTAL_PHYSICAL_QUAN = 2;
export const TOTAL_GAME_POINTS = 70;
export const MAX_CHAIN_PICKS_PER_TURN = 64;

export const DEFAULT_O_AN_QUAN_RULES: OAnQuanRulesConfig = {
  mandarinPointValue: 10,
  mandarinYouthRule: false,
  minStonesForMandarin: 5,
};

export function getTotalGamePoints(rules: OAnQuanRulesConfig): number {
  return TOTAL_PHYSICAL_DAN + TOTAL_PHYSICAL_QUAN * (rules.mandarinPointValue ?? MANDARIN_POINT_VALUE);
}

export function getOwnedPitIndices(side: PlayerSide): readonly number[] {
  return side === 0 ? [0, 1, 2, 3, 4] : [6, 7, 8, 9, 10];
}

export function isMandarinPitIndex(index: number): boolean {
  return index === MANDARIN_RIGHT_INDEX || index === MANDARIN_LEFT_INDEX;
}

export function getPitStep(direction: SowDirection): 1 | -1 {
  return direction === 'CCW' ? 1 : -1;
}

export function getNextPitIndex(currentIndex: number, direction: SowDirection): number {
  const step = getPitStep(direction);
  return (currentIndex + step + TOTAL_BOARD_PITS) % TOTAL_BOARD_PITS;
}

export function isPitEmpty(pit: PitState): boolean {
  return !pit.hasMandarin && pit.stones === 0;
}

export function computePlayerScore(
  player: PlayerMatchState,
  mandarinPointValue: 5 | 10 = MANDARIN_POINT_VALUE,
): number {
  return (
    player.capturedQuan * mandarinPointValue +
    player.capturedDan +
    player.sweptDanNet -
    player.borrowedDan +
    player.loanedDan
  );
}

/**
 * Kiểm tra một nước đi (pitIndex, direction) có hợp lệ cho phe `side` ở trạng thái hiện tại không.
 */
export function validateSowAction(
  state: OAnQuanState,
  side: PlayerSide,
  pitIndex: number,
  direction: SowDirection,
): { valid: boolean; reason?: string } {
  if (state.phase !== 'WAITING_MOVE') {
    return { valid: false, reason: 'Ván đấu đã kết thúc.' };
  }
  if (state.currentSide !== side) {
    return { valid: false, reason: 'Chưa tới lượt của bạn.' };
  }
  if (direction !== 'CCW' && direction !== 'CW') {
    return { valid: false, reason: 'Hướng rải không hợp lệ.' };
  }
  if (!Number.isInteger(pitIndex) || pitIndex < 0 || pitIndex >= TOTAL_BOARD_PITS) {
    return { valid: false, reason: 'Ô chọn nằm ngoài bàn cờ.' };
  }
  const pit = state.pits[pitIndex];
  if (!pit || pit.kind !== 'DAN' || pit.ownerSide !== side) {
    return { valid: false, reason: 'Chỉ được chọn 1 trong 5 ô dân thuộc phần sân của mình.' };
  }
  if (pit.stones <= 0) {
    return { valid: false, reason: 'Ô dân đang trống, hãy chọn ô có ít nhất 1 viên sỏi.' };
  }
  return { valid: true };
}

/**
 * Trả về danh sách toàn bộ các nước đi hợp lệ của phe đang tới lượt.
 */
export function getLegalMoves(
  state: OAnQuanState,
  side: PlayerSide = state.currentSide,
): { pitIndex: number; direction: SowDirection }[] {
  if (state.phase !== 'WAITING_MOVE' || state.currentSide !== side) return [];
  const moves: { pitIndex: number; direction: SowDirection }[] = [];
  for (const idx of getOwnedPitIndices(side)) {
    const pit = state.pits[idx];
    if (pit && pit.stones > 0) {
      moves.push({ pitIndex: idx, direction: 'CCW' });
      moves.push({ pitIndex: idx, direction: 'CW' });
    }
  }
  return moves;
}

/**
 * Ánh xạ thứ tự hiển thị 12 ô trên màn hình theo góc nhìn POV 180° (chỉ đổi vị trí hiển thị, giữ nguyên index 0..11).
 * - viewerSide = 0 (Chủ phòng / Offline): Hàng dưới [0,1,2,3,4], Hàng trên [10,9,8,7,6], Quan Trái = 11, Quan Phải = 5
 * - viewerSide = 1 (Khách Online):        Hàng dưới [6,7,8,9,10], Hàng trên [4,3,2,1,0], Quan Trái = 5, Quan Phải = 11
 */
export function getVisualBoardLayout(viewerSide: PlayerSide): {
  bottomRowIndices: number[];
  topRowIndices: number[];
  leftMandarinIndex: number;
  rightMandarinIndex: number;
} {
  if (viewerSide === 1) {
    return {
      bottomRowIndices: [6, 7, 8, 9, 10],
      topRowIndices: [4, 3, 2, 1, 0],
      leftMandarinIndex: MANDARIN_RIGHT_INDEX, // 5
      rightMandarinIndex: MANDARIN_LEFT_INDEX, // 11
    };
  }
  return {
    bottomRowIndices: [0, 1, 2, 3, 4],
    topRowIndices: [10, 9, 8, 7, 6],
    leftMandarinIndex: MANDARIN_LEFT_INDEX, // 11
    rightMandarinIndex: MANDARIN_RIGHT_INDEX, // 5
  };
}

/**
 * Chuyển nút bấm "Trái" / "Phải" trên màn hình sang SowDirection ('CCW' | 'CW')
 * dựa trên hàng hiển thị của ô đó dưới góc nhìn `viewerSide`.
 */
export function visualHorizontalToSowDirection(
  pitIndex: number,
  visualChoice: 'LEFT' | 'RIGHT',
  viewerSide: PlayerSide = 0,
): SowDirection {
  const layout = getVisualBoardLayout(viewerSide);
  const isOnVisualBottomRow = layout.bottomRowIndices.includes(pitIndex);
  if (isOnVisualBottomRow) {
    // Ở hàng dưới trên màn hình: Rải Phải ► luôn là CCW (+1), ◄ Rải Trái luôn là CW (-1)
    return visualChoice === 'RIGHT' ? 'CCW' : 'CW';
  }
  // Ở hàng trên trên màn hình (chế độ 2 Người 1 Máy): ◄ Rải Trái là CCW (+1), Rải Phải ► là CW (-1)
  return visualChoice === 'LEFT' ? 'CCW' : 'CW';
}

/**
 * Kiểm tra toàn bộ định luật bảo toàn Quân Vật Lý (50 Dân, 2 Quan), Sổ Nợ Ròng Một Chiều & Tổng Điểm 70.
 */
export function assertBoardInvariants(state: OAnQuanState): void {
  if (state.pits.length !== TOTAL_BOARD_PITS) {
    throw new Error(`Số lượng ô bàn cờ phải là 12, nhận được ${state.pits.length}`);
  }
  for (const pit of state.pits) {
    if (pit.stones < 0 || !Number.isInteger(pit.stones)) {
      throw new Error(`Số sỏi tại ô ${pit.index} không hợp lệ: ${pit.stones}`);
    }
    if (pit.kind === 'DAN' && pit.hasMandarin) {
      throw new Error(`Ô dân ${pit.index} không thể chứa viên Quan lớn`);
    }
  }

  const boardDan = state.pits.reduce((sum, p) => sum + p.stones, 0);
  const boardQuan = state.pits.reduce((sum, p) => sum + (p.hasMandarin ? 1 : 0), 0);

  const p0 = state.players[0];
  const p1 = state.players[1];

  const totalPhysicalDan =
    boardDan + p0.capturedDan + p0.sweptDanNet + p1.capturedDan + p1.sweptDanNet;
  const totalPhysicalQuan = boardQuan + p0.capturedQuan + p1.capturedQuan;

  if (totalPhysicalDan !== TOTAL_PHYSICAL_DAN) {
    throw new Error(
      `Vi phạm bảo toàn Dân vật lý: expected ${TOTAL_PHYSICAL_DAN}, got ${totalPhysicalDan}`,
    );
  }
  if (totalPhysicalQuan !== TOTAL_PHYSICAL_QUAN) {
    throw new Error(
      `Vi phạm bảo toàn Quan vật lý: expected ${TOTAL_PHYSICAL_QUAN}, got ${totalPhysicalQuan}`,
    );
  }
  if (p0.borrowedDan < 0 || p1.borrowedDan < 0 || p0.loanedDan < 0 || p1.loanedDan < 0) {
    throw new Error('Số nợ vay hoặc cho vay không được âm');
  }
  if (p0.borrowedDan !== p1.loanedDan || p1.borrowedDan !== p0.loanedDan) {
    throw new Error(
      `Vi phạm tính đối xứng công nợ vay dân: p0(B=${p0.borrowedDan},L=${p0.loanedDan}) vs p1(B=${p1.borrowedDan},L=${p1.loanedDan})`,
    );
  }
  if (Math.min(p0.borrowedDan, p1.borrowedDan) !== 0) {
    throw new Error('Vi phạm quy tắc Sổ Nợ Ròng Một Chiều: hai bên không thể cùng lúc nợ nhau');
  }

  const qVal: 5 | 10 = state.rules.mandarinPointValue === 5 ? 5 : 10;
  const expectedScore0 = computePlayerScore(p0, qVal);
  const expectedScore1 = computePlayerScore(p1, qVal);
  if (p0.score !== expectedScore0 || p1.score !== expectedScore1) {
    throw new Error(
      `Điểm quy đổi không khớp công thức: p0(${p0.score} vs ${expectedScore0}), p1(${p1.score} vs ${expectedScore1})`,
    );
  }

  if (state.phase === 'GAME_OVER') {
    const stonesInMandarinPits =
      state.pits[MANDARIN_RIGHT_INDEX].stones + state.pits[MANDARIN_LEFT_INDEX].stones;
    const mandarinsOnBoard =
      (state.pits[MANDARIN_RIGHT_INDEX].hasMandarin ? 1 : 0) +
      (state.pits[MANDARIN_LEFT_INDEX].hasMandarin ? 1 : 0);

    const endDanTotal =
      p0.capturedDan + p1.capturedDan + p0.sweptDanNet + p1.sweptDanNet + stonesInMandarinPits;
    const endQuanTotal = p0.capturedQuan + p1.capturedQuan + mandarinsOnBoard;

    if (endDanTotal !== TOTAL_PHYSICAL_DAN) {
      throw new Error(`Vi phạm bảo toàn 50 Dân sau khi trả nợ cuối ván: got ${endDanTotal}`);
    }
    if (endQuanTotal !== TOTAL_PHYSICAL_QUAN) {
      throw new Error(`Vi phạm bảo toàn 2 Quan sau khi kết thúc ván: got ${endQuanTotal}`);
    }
    if (!state.finalSummary) {
      throw new Error('Trạng thái GAME_OVER bắt buộc phải có finalSummary');
    }
    const [s0, s1] = state.finalSummary.scores;
    const sNeutral = state.finalSummary.neutralScore;
    const expectedTotalPoints = getTotalGamePoints(state.rules);
    if (s0 + s1 + sNeutral !== expectedTotalPoints) {
      throw new Error(
        `Vi phạm bảo toàn tổng điểm ${expectedTotalPoints} khi kết thúc ván: ${s0} + ${s1} + ${sNeutral} !== ${expectedTotalPoints}`,
      );
    }
  }
}
