import { cryptoRandomInt } from '@/shared/crypto/random';
import { executeSowMove } from '../engine/reducer';
import {
  getLegalMoves,
  getOwnedPitIndices,
  MANDARIN_LEFT_INDEX,
  MANDARIN_RIGHT_INDEX,
} from '../engine/rules';
import type {
  BotDifficulty,
  OAnQuanState,
  PitState,
  PlayerSide,
  SowDirection,
} from '../engine/types';

export interface EvaluatedMoveChoice {
  pitIndex: number;
  direction: SowDirection;
  heuristicScore: number;
  immediatePointsGain: number;
  immediateMandarinGain: number;
  chainPickRounds: number;
  comboCount: number;
  resultingPits: PitState[];
  explanationVi: string;
}

const MAX_EVALUATED_NODES = 8_000;

/**
 * Hàm lượng giá thế trận cho phe `maximizingSide`.
 * Lưu ý: 1 Depth (1 Ply) trong Minimax là 1 lượt đi hoàn chỉnh gọi qua `executeSowMove`
 * (bao gồm toàn bộ các vòng bốc rải nối tiếp và chuỗi ăn liên hoàn của lượt đó).
 */
export function evaluateBoardState(state: OAnQuanState, maximizingSide: PlayerSide): number {
  const oppSide: PlayerSide = maximizingSide === 0 ? 1 : 0;
  const me = state.players[maximizingSide];
  const opp = state.players[oppSide];
  const qVal = state.rules.mandarinPointValue === 5 ? 5 : 10;

  if (state.phase === 'GAME_OVER' && state.finalSummary) {
    const diff = state.finalSummary.scores[maximizingSide] - state.finalSummary.scores[oppSide];
    if (diff > 0) return 10_000 + diff * 50;
    if (diff < 0) return -10_000 + diff * 50;
    return 0;
  }

  // 1. Hiệu số điểm quy đổi ròng đã nằm trong giỏ
  const netScoreDiff = (me.score - opp.score) * 12.0;

  // 2. Ưu thế sỏi dân vật lý sẵn có để tránh bị trống 5 ô phải vay nợ hoặc bế tắc
  const myBoardDan = getOwnedPitIndices(maximizingSide).reduce(
    (sum, idx) => sum + state.pits[idx].stones,
    0,
  );
  const oppBoardDan = getOwnedPitIndices(oppSide).reduce(
    (sum, idx) => sum + state.pits[idx].stones,
    0,
  );
  const boardControlDiff = (myBoardDan - oppBoardDan) * 2.2;
  const reserveBonus = (me.capturedDan >= 5 ? 6 : 0) - (opp.capturedDan >= 5 ? 6 : 0);

  // 3. Cảnh giác nguy cơ để hở ô trống sát ô Quan còn nhiều điểm
  let mandarinExposurePenalty = 0;
  const rightQuanVal =
    (state.pits[MANDARIN_RIGHT_INDEX].hasMandarin ? qVal : 0) +
    state.pits[MANDARIN_RIGHT_INDEX].stones;
  const leftQuanVal =
    (state.pits[MANDARIN_LEFT_INDEX].hasMandarin ? qVal : 0) +
    state.pits[MANDARIN_LEFT_INDEX].stones;

  if (rightQuanVal >= qVal) {
    if (state.pits[4].stones === 0 || state.pits[6].stones === 0) {
      mandarinExposurePenalty += state.currentSide === oppSide ? -rightQuanVal * 1.4 : rightQuanVal * 0.6;
    }
  }
  if (leftQuanVal >= qVal) {
    if (state.pits[0].stones === 0 || state.pits[10].stones === 0) {
      mandarinExposurePenalty += state.currentSide === oppSide ? -leftQuanVal * 1.4 : leftQuanVal * 0.6;
    }
  }

  return netScoreDiff + boardControlDiff + reserveBonus + mandarinExposurePenalty;
}

interface SearchTracker {
  nodesVisited: number;
}

function minimaxAlphaBeta(
  state: OAnQuanState,
  depthPliesLeft: number,
  alpha: number,
  beta: number,
  maximizingSide: PlayerSide,
  tracker: SearchTracker,
): number {
  tracker.nodesVisited += 1;
  if (
    depthPliesLeft <= 0 ||
    state.phase === 'GAME_OVER' ||
    tracker.nodesVisited >= MAX_EVALUATED_NODES
  ) {
    return evaluateBoardState(state, maximizingSide);
  }

  const legalMoves = getLegalMoves(state, state.currentSide);
  if (legalMoves.length === 0) {
    return evaluateBoardState(state, maximizingSide);
  }

  const qVal = state.rules.mandarinPointValue === 5 ? 5 : 10;
  const simulatedBranches = legalMoves
    .map((m) => {
      const { state: next } = executeSowMove(state, m.pitIndex, m.direction);
      const gain =
        (next.lastMove?.capturedQuanGain ?? 0) * qVal + (next.lastMove?.capturedDanGain ?? 0);
      return { move: m, nextState: next, immediateGain: gain };
    })
    .sort((a, b) => b.immediateGain - a.immediateGain);

  const isMaximizingTurn = state.currentSide === maximizingSide;

  if (isMaximizingTurn) {
    let best = -Infinity;
    for (const branch of simulatedBranches) {
      const val = minimaxAlphaBeta(
        branch.nextState,
        depthPliesLeft - 1,
        alpha,
        beta,
        maximizingSide,
        tracker,
      );
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha || tracker.nodesVisited >= MAX_EVALUATED_NODES) break;
    }
    return best;
  }

  let best = Infinity;
  for (const branch of simulatedBranches) {
    const val = minimaxAlphaBeta(
      branch.nextState,
      depthPliesLeft - 1,
      alpha,
      beta,
      maximizingSide,
      tracker,
    );
    if (val < best) best = val;
    if (best < beta) beta = best;
    if (beta <= alpha || tracker.nodesVisited >= MAX_EVALUATED_NODES) break;
  }
  return best;
}

function buildMoveExplanation(
  pitIndex: number,
  direction: SowDirection,
  immediatePointsGain: number,
  immediateMandarinGain: number,
  chainPickRounds: number,
  comboCount: number,
): string {
  const dirLabel = direction === 'CCW' ? 'sang Phải ►' : 'sang Trái ◄';
  const pitLabel = `Ô ${pitIndex + 1}`;
  if (immediateMandarinGain > 0 && comboCount >= 2) {
    return `Rải ${pitLabel} ${dirLabel} để ăn Combo ×${comboCount} hốt trọn Quan lớn (+${immediatePointsGain} điểm)!`;
  }
  if (immediateMandarinGain > 0) {
    return `Rải ${pitLabel} ${dirLabel} để ăn Quan lớn (+${immediatePointsGain} điểm)!`;
  }
  if (comboCount >= 2) {
    return `Rải ${pitLabel} ${dirLabel} để ăn liên hoàn Combo ×${comboCount} (+${immediatePointsGain} điểm)!`;
  }
  if (immediatePointsGain > 0) {
    return chainPickRounds > 0
      ? `Rải ${pitLabel} ${dirLabel} nối ${chainPickRounds} vòng để ăn +${immediatePointsGain} điểm!`
      : `Rải ${pitLabel} ${dirLabel} để ăn ngay +${immediatePointsGain} điểm!`;
  }
  if (chainPickRounds > 0) {
    return `Rải ${pitLabel} ${dirLabel} nối ${chainPickRounds} vòng giữ thế chủ động và khóa đường ăn Quan của đối thủ.`;
  }
  return `Rải ${pitLabel} ${dirLabel} là nước đi an toàn nhất để bảo vệ 2 ô Quan.`;
}

/**
 * Cân chỉnh lại 3 cấp độ Máy AI thật sự phân hóa rõ rệt và vui khi chơi:
 * - easy (Tập Chơi): Đánh thoải mái như người mới chơi!
 *   + 55% chọn ngẫu nhiên một nước hợp lệ bất kỳ (hay bỏ lỡ nước ăn Quan nối dài vòng).
 *   + 45% chỉ đánh giá đơn giản kèm nhiễu lớn (±75 điểm đánh giá) và bốc trong Top 4 -> rất dễ thắng & tập Combo!
 * - medium (Thách Đấu): Cân sức 50/50 như đấu với bạn chơi khá!
 *   + Tính 2 Plies kèm nhiễu tự nhiên (±28 điểm đánh giá) + 25% chọn nước đứng thứ 2 thay vì lúc nào cũng đánh tuyệt đối.
 * - hard (Cao Thủ Làng): Tối ưu 100% Minimax + Alpha-Beta 4–5 Plies, 0 nhiễu.
 */
export function computeBotMove(
  state: OAnQuanState,
  difficulty: BotDifficulty = 'medium',
): EvaluatedMoveChoice | null {
  const side = state.currentSide;
  const legalMoves = getLegalMoves(state, side);
  if (legalMoves.length === 0) return null;

  const qVal = state.rules.mandarinPointValue === 5 ? 5 : 10;
  const nonEmptyDanPits = state.pits.filter((p) => p.kind === 'DAN' && p.stones > 0).length;
  const targetDepthPlies =
    difficulty === 'easy'
      ? 1
      : difficulty === 'medium'
        ? 2
        : nonEmptyDanPits <= 6
          ? 5
          : 4;

  const tracker: SearchTracker = { nodesVisited: 0 };
  const candidates: EvaluatedMoveChoice[] = [];

  for (const m of legalMoves) {
    const { state: next } = executeSowMove(state, m.pitIndex, m.direction);
    const last = next.lastMove;
    const immediateMandarinGain = last?.capturedQuanGain ?? 0;
    const immediatePointsGain = immediateMandarinGain * qVal + (last?.capturedDanGain ?? 0);
    const chainPickRounds = last?.chainPickCount ?? 0;
    const comboCount = last?.comboCount ?? 0;

    let score = 0;
    if (difficulty === 'easy') {
      // Cấp Tập Chơi: chỉ nhìn thấy nước ăn trực tiếp không nối vòng (chainPickRounds === 0), bỏ qua phần tính nối nhiều vòng phức tạp!
      const simpleSightGain = chainPickRounds === 0 ? immediatePointsGain * 7 : Math.min(immediatePointsGain, 3) * 3;
      const bigJitter = cryptoRandomInt(-75, 75);
      score = simpleSightGain + bigJitter;
    } else {
      score = minimaxAlphaBeta(next, targetDepthPlies - 1, -Infinity, Infinity, side, tracker);
      if (difficulty === 'medium') {
        score += cryptoRandomInt(-28, 28);
      }
    }

    candidates.push({
      pitIndex: m.pitIndex,
      direction: m.direction,
      heuristicScore: score,
      immediatePointsGain,
      immediateMandarinGain,
      chainPickRounds,
      comboCount,
      resultingPits: next.pits.map((p) => ({ ...p })),
      explanationVi: buildMoveExplanation(
        m.pitIndex,
        m.direction,
        immediatePointsGain,
        immediateMandarinGain,
        chainPickRounds,
        comboCount,
      ),
    });
  }

  // Cấp Tập Chơi: 55% đi hoàn toàn ngẫu nhiên như trẻ nhỏ mới tập chơi
  if (difficulty === 'easy' && candidates.length > 1 && cryptoRandomInt(1, 100) <= 55) {
    return candidates[cryptoRandomInt(0, candidates.length - 1)];
  }

  candidates.sort((a, b) => {
    if (b.heuristicScore !== a.heuristicScore) return b.heuristicScore - a.heuristicScore;
    return b.immediatePointsGain - a.immediatePointsGain;
  });

  if (difficulty === 'easy' && candidates.length >= 3) {
    const pickPool = Math.min(4, candidates.length);
    return candidates[cryptoRandomInt(0, pickPool - 1)];
  }

  if (difficulty === 'medium' && candidates.length >= 2 && cryptoRandomInt(1, 100) <= 25) {
    return candidates[1];
  }

  return candidates[0] ?? null;
}

/**
 * Tính năng 💡 Gợi ý nước đi cho người chơi (luôn dùng phân tích chuẩn nhất của Cao Thủ).
 */
export function computeBestHint(state: OAnQuanState): EvaluatedMoveChoice | null {
  return computeBotMove(state, 'hard');
}
