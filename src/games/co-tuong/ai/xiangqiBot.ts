import {
  applyXiangqiMoveToBoard,
  generateLegalRawXiangqiMoves,
  generateLegalXiangqiMoves,
  hasCrossedRiver,
  idxToRc,
  oppositeXiangqiColor,
  XIANGQI_NAME_VI,
  type RawXiangqiMove,
} from '../engine/rules';
import type {
  XiangqiBoard,
  XiangqiBotDifficulty,
  XiangqiColor,
  XiangqiMove,
  XiangqiPieceType,
  XiangqiState,
} from '../engine/types';

export interface XiangqiHintResult {
  move: XiangqiMove;
  explanationVi: string;
}

const BASE_VALUE: Record<XiangqiPieceType, number> = {
  k: 20_000,
  r: 900,
  c: 460,
  n: 410,
  e: 210,
  a: 205,
  p: 110,
};

function positionalBonus(type: XiangqiPieceType, color: XiangqiColor, idx: number): number {
  const { row, col } = idxToRc(idx);
  // Chuẩn hóa hàng theo góc nhìn của phe sở hữu (0 = hàng đáy nhà, 9 = hàng đáy địch)
  const forwardRow = color === 'red' ? 9 - row : row;
  const centerDist = Math.abs(col - 4);

  if (type === 'p') {
    if (hasCrossedRiver(color, row)) {
      // Tốt qua sông cực giá trị, áp sát cung Tướng càng mạnh!
      return 115 + (forwardRow - 5) * 26 + (4 - centerDist) * 14;
    }
    return forwardRow * 8;
  }
  if (type === 'c') {
    // Pháo đầu cột giữa (col 4) rất mạnh trong khai cuộc/trung cuộc
    return (4 - centerDist) * 14 + (forwardRow >= 2 && forwardRow <= 7 ? 12 : 0);
  }
  if (type === 'n') {
    // Mã thoáng trung tâm mạnh hơn Mã biên
    return (4 - centerDist) * 16 + (forwardRow >= 2 && forwardRow <= 7 ? 18 : -10);
  }
  if (type === 'r') {
    // Xe thông thoáng, áp sát hàng tuần hà & cửu cung
    return (4 - centerDist) * 6 + (forwardRow >= 3 ? 20 : 0);
  }
  if (type === 'a' || type === 'e') {
    // Sĩ/Tượng đứng trung tâm cung bảo vệ Tướng
    return (col === 4 ? 18 : 6);
  }
  return col === 4 && forwardRow === 0 ? 15 : 0;
}

function evaluateXiangqiBoard(board: XiangqiBoard, perspective: XiangqiColor): number {
  let score = 0;
  for (let i = 0; i < 90; i += 1) {
    const p = board[i];
    if (!p) continue;
    const v = BASE_VALUE[p.type] + positionalBonus(p.type, p.color, i);
    score += p.color === perspective ? v : -v;
  }
  return score;
}

function orderXiangqiMoves(moves: RawXiangqiMove[]): RawXiangqiMove[] {
  return [...moves].sort((a, b) => {
    const sc = (m: RawXiangqiMove) =>
      m.captured ? BASE_VALUE[m.captured] * 10 - BASE_VALUE[m.piece] : 0;
    return sc(b) - sc(a);
  });
}

function negamaxXiangqi(
  board: XiangqiBoard,
  turn: XiangqiColor,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = generateLegalRawXiangqiMoves(board, turn);
  if (moves.length === 0) {
    // Trong Cờ Tướng hết nước đi hợp lệ luôn là THUA!
    return -90_000 - depth * 100;
  }
  if (depth <= 0) {
    return evaluateXiangqiBoard(board, turn);
  }

  let best = -Infinity;
  const ordered = orderXiangqiMoves(moves);

  for (const m of ordered) {
    const nextBoard = applyXiangqiMoveToBoard(board, m);
    const val = -negamaxXiangqi(nextBoard, oppositeXiangqiColor(turn), depth - 1, -beta, -alpha);
    if (val > best) best = val;
    if (val > alpha) alpha = val;
    if (alpha >= beta) break;
  }
  return best;
}

export function computeXiangqiBotMove(
  state: XiangqiState,
  difficulty: XiangqiBotDifficulty,
): XiangqiMove | null {
  const legal = generateLegalXiangqiMoves(state.board, state.turn, state.checkRepeatCounts);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const enemy = oppositeXiangqiColor(state.turn);

  // Luôn bắt lấy nước Chiếu Bí (ưu tiên tuyệt sát chiếu trước, rồi tới Khốn Bí) thắng ngay trong 1 nước!
  let stalemateWinMove: XiangqiMove | null = null;
  for (const m of legal) {
    const next = applyXiangqiMoveToBoard(state.board, m);
    if (generateLegalRawXiangqiMoves(next, enemy).length === 0) {
      if (m.givesCheck) return m;
      if (!stalemateWinMove) stalemateWinMove = m;
    }
  }
  if (stalemateWinMove) return stalemateWinMove;

  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const noiseAmp = difficulty === 'easy' ? 140 : difficulty === 'medium' ? 28 : 4;

  const scored = legal.map((m) => {
    const next = applyXiangqiMoveToBoard(state.board, m);
    const val =
      -negamaxXiangqi(next, enemy, depth - 1, -100_000, 100_000) +
      (Math.random() - 0.5) * noiseAmp;
    return { move: m, score: val };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.move ?? legal[0];
}

export function computeXiangqiHint(state: XiangqiState): XiangqiHintResult | null {
  const best = computeXiangqiBotMove(state, 'hard');
  if (!best) return null;

  const enemy = oppositeXiangqiColor(state.turn);
  const next = applyXiangqiMoveToBoard(state.board, best);
  const winsNow = generateLegalRawXiangqiMoves(next, enemy).length === 0;

  let explanationVi = `Đi ${best.notationVi} để chiếm trục tốt và củng cố trận hình.`;
  if (winsNow && best.givesCheck) {
    explanationVi = `Đi ${best.notationVi} để CHIẾU BÍ (tuyệt sát) và giành chiến thắng ngay lập tức!`;
  } else if (winsNow) {
    explanationVi = `Đi ${best.notationVi} để KHỐN BÍ (khóa hết nước đi hợp lệ của đối phương) và thắng ngay!`;
  } else if (best.captured && best.givesCheck) {
    explanationVi = `Đi ${best.notationVi} ăn ${XIANGQI_NAME_VI[best.captured]} đồng thời CHIẾU TƯỚNG đối phương!`;
  } else if (best.captured) {
    explanationVi = `Đi ${best.notationVi} để ăn quân ${XIANGQI_NAME_VI[best.captured]} giành ưu thế lớn!`;
  } else if (best.givesCheck) {
    explanationVi = `Đi ${best.notationVi} để CHIẾU TƯỚNG, ép đối phương phải phòng thủ!`;
  }

  return { move: best, explanationVi };
}
