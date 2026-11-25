import { cryptoRandomInt } from '@/shared/crypto/random';
import {
  HORSE_COLOR_CONFIG,
  progressToTrackIndex,
  SAFE_DOOR_PROGRESS,
  WINNING_STAIR_STEPS,
} from './boardGeometry';
import type {
  CoCaNguaState,
  HorseColor,
  HorsePiece,
  HorseRankingRow,
  LegalHorseMove,
} from './types';

/** Cả mặt 1 và mặt 6 đều cho phép xuất chuồng VÀ thưởng thêm 1 lượt tung xúc xắc (luật chuẩn Việt Nam) */
export function isDeployAndBonusDice(diceValue: number): boolean {
  return diceValue === 1 || diceValue === 6;
}

/**
 * Kiểm tra xem phe `color` có đang "kẹt chuồng" (chưa có ngựa nào chạy trên đường đua
 * và cũng không có ngựa kẹt bậc 1–2 cần đổi bụt, trong khi vẫn còn ngựa chờ xuất chuồng).
 */
export function shouldBoostDeployDice(horses: readonly HorsePiece[], color: HorseColor): boolean {
  const own = horses.filter((h) => h.color === color);
  const hasStableHorse = own.some((h) => h.zone === 'STABLE');
  if (!hasStableHorse) return false;
  const hasTrackHorse = own.some((h) => h.zone === 'TRACK');
  if (hasTrackHorse) return false;
  const hasLowStairHorse = own.some((h) => h.zone === 'HOME_STAIRS' && h.stairStep <= 2);
  return !hasLowStairHorse;
}

/**
 * Tung xúc xắc thông minh cho Cờ Cá Ngựa (áp dụng công bằng chung cho cả bàn để đẩy tiến độ mượt mà, giữ 100% luật 4 ngựa 3–4–5–6):
 * 1. Khi chưa có ngựa ra đường đua (đang cần 1 hoặc 6 để xuất chuồng): tỉ lệ ra {1, 6} = 60% (30% ra 1, 30% ra 6).
 * 2. Khi mới có 1 ngựa ngoài đường đua & vẫn còn >= 2 ngựa trong chuồng: tăng nhẹ {1, 6} lên ~44% để ra quân đều tay hơn.
 * 3. Khi có ngựa áp sát Cửa Lên Bụt ★ (cách 1..6 ô), đang đứng tại Cửa ★ chờ leo bậc thắng 3–6 trống,
 *    hoặc kẹt bậc 1–2 cần đổi lên bậc 3–6 trống: tăng nhẹ trọng số (×1.65) cho các mặt giúp về cửa / lên bậc thắng!
 */
export function rollSmartHorseDice(state: CoCaNguaState): number {
  const current = state.players[state.currentPlayerIndex];
  if (!current) return cryptoRandomInt(1, 6);

  if (shouldBoostDeployDice(state.horses, current.color)) {
    const r = cryptoRandomInt(1, 100);
    if (r <= 30) return 1;
    if (r <= 60) return 6;
    if (r <= 70) return 2;
    if (r <= 80) return 3;
    if (r <= 90) return 4;
    return 5;
  }

  const own = state.horses.filter((h) => h.color === current.color);
  const stableCount = own.filter((h) => h.zone === 'STABLE').length;
  const trackCount = own.filter((h) => h.zone === 'TRACK').length;

  const weights = [100, 100, 100, 100, 100, 100];
  if (trackCount === 1 && stableCount >= 2) {
    // 157*2 / (157*2 + 100*4) ≈ 44% cho {1, 6}
    weights[0] = 157;
    weights[5] = 157;
  }

  const hasDoorOrStairGoal = own.some(
    (h) =>
      (h.zone === 'TRACK' && h.progress >= SAFE_DOOR_PROGRESS - 6) ||
      (h.zone === 'HOME_STAIRS' && h.stairStep <= 2),
  );

  if (hasDoorOrStairGoal) {
    for (let face = 1; face <= 6; face += 1) {
      const legal = computeLegalHorseMoves(state.horses, current.color, face);
      const hitsGoal = legal.some(
        (m) =>
          (m.kind === 'ADVANCE_TRACK' && m.toProgress === SAFE_DOOR_PROGRESS) ||
          (m.kind === 'ENTER_STAIRS' && m.toStairStep >= 3) ||
          (m.kind === 'CLIMB_STAIRS' && m.fromStairStep <= 2 && m.toStairStep >= 3),
      );
      if (hitsGoal) {
        weights[face - 1] = Math.round(weights[face - 1] * 1.65);
      }
    }
  }

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let pick = cryptoRandomInt(1, totalWeight);
  for (let i = 0; i < 6; i += 1) {
    pick -= weights[i];
    if (pick <= 0) return i + 1;
  }
  return 6;
}

/** Tìm quân ngựa đang đứng tại 1 ô cụ thể trên vòng đường đua 52 ô (mỗi ô tối đa 1 quân!) */
export function getHorseAtTrackIndex(
  horses: readonly HorsePiece[],
  trackIndex: number,
): HorsePiece | null {
  for (const h of horses) {
    if (h.zone === 'TRACK' && progressToTrackIndex(h.color, h.progress) === trackIndex) {
      return h;
    }
  }
  return null;
}

/** Tìm quân ngựa của 1 màu đang đứng trên bậc bụt `stairStep` (1..6) */
export function getHorseAtStairStep(
  horses: readonly HorsePiece[],
  color: HorseColor,
  stairStep: number,
): HorsePiece | null {
  for (const h of horses) {
    if (h.color === color && h.zone === 'HOME_STAIRS' && h.stairStep === stairStep) {
      return h;
    }
  }
  return null;
}

/**
 * Kiểm tra chiến thắng chuẩn Cờ Cá Ngựa Việt Nam:
 * Phải xếp kín chính xác 4 bậc đỉnh {3, 4, 5, 6} bằng đủ 4 quân ngựa!
 * Nếu vẫn còn quân kẹt ở bậc 1 hoặc 2 -> CHƯA THẮNG, phải quay xúc xắc đổi bụt lên!
 */
export function hasColorWon(horses: readonly HorsePiece[], color: HorseColor): boolean {
  const occupiedWinSteps = new Set<number>();
  for (const h of horses) {
    if (h.color === color && h.zone === 'HOME_STAIRS' && h.stairStep >= 3 && h.stairStep <= 6) {
      occupiedWinSteps.add(h.stairStep);
    }
  }
  return WINNING_STAIR_STEPS.every((step) => occupiedWinSteps.has(step));
}

/** Đếm số quân của 1 màu đã đứng yên trên các bậc chiến thắng 3..6 */
export function countWinStairHorses(horses: readonly HorsePiece[], color: HorseColor): number {
  let count = 0;
  for (const h of horses) {
    if (h.color === color && h.zone === 'HOME_STAIRS' && h.stairStep >= 3 && h.stairStep <= 6) {
      count += 1;
    }
  }
  return count;
}

/**
 * Sinh toàn bộ nước đi hợp lệ cho phe `color` với kết quả xúc xắc `diceValue` (1..6)
 * theo đúng 100% luật Cờ Cá Ngựa chuẩn Việt Nam:
 * 1. STABLE: chỉ xuất chuồng khi dice = 1 hoặc 6; cấm nếu ô xuất phát có quân cùng màu; đá quân địch nếu có.
 * 2. TRACK (progress < 51):
 *    - Cấm đi lố cửa chuồng (progress + dice > 51).
 *    - Cấm nhảy qua BẤT KỲ quân ngựa nào ở các ô trung gian 1..dice-1 (cả cùng màu lẫn khác màu).
 *    - Ô đích: cấm nếu có quân cùng màu; mọi ô trên vòng đua 52 ô (KỂ CẢ 4 Ô ★ Cửa Lên Bụt {12, 25, 38, 51}) đều ĐÁ ĐƯỢC quân địch! Chỉ bậc bụt 1..6 trong chuồng đích mới bất khả xâm phạm.
 * 3. TRACK (progress === 51 — đang đứng tại Ô ★ Cửa Lên Bụt):
 *    - Gieo k (1..6) -> nhảy thẳng lên bậc k nếu toàn bộ bậc 1..k đều trống (cấm nhảy qua quân mình!).
 * 4. HOME_STAIRS (stairStep = a ∈ [1..6]):
 *    - Đổi bụt theo ĐÚNG SỐ XÚC XẮC (lên HOẶC xuống!): đi được khi diceValue = b ≠ a và toàn bộ bậc nằm giữa & bậc b đều trống!
 */
export function computeLegalHorseMoves(
  horses: readonly HorsePiece[],
  color: HorseColor,
  diceValue: number,
): LegalHorseMove[] {
  if (diceValue < 1 || diceValue > 6) return [];
  const moves: LegalHorseMove[] = [];
  const ownHorses = horses.filter((h) => h.color === color);
  const startTrack = HORSE_COLOR_CONFIG[color].startTrackIndex;

  // Chỉ cho phép xuất tối đa 1 đại diện trong chuồng (nhưng đánh dấu từng quân trong chuồng đều hợp lệ để người chơi chạm con nào cũng xuất được!)
  for (const horse of ownHorses) {
    // 1. NGỰA TRONG CHUỒNG -> XUẤT CHUỒNG (chỉ khi gieo 1 hoặc 6)
    if (horse.zone === 'STABLE') {
      if (!isDeployAndBonusDice(diceValue)) continue;
      const occupant = getHorseAtTrackIndex(horses, startTrack);
      if (occupant && occupant.color === color) {
        // Ô xuất phát đang bị quân cùng màu chiếm -> không được chồng quân
        continue;
      }
      // Ô xuất phát (0, 13, 26, 39) không nằm trong 4 Ô An Toàn Lên Bụt (51, 12, 25, 38) -> đá được quân địch!
      moves.push({
        horseId: horse.id,
        color,
        kind: 'DEPLOY',
        diceValue,
        fromProgress: -1,
        toProgress: 0,
        fromTrackIndex: null,
        toTrackIndex: startTrack,
        fromStairStep: 0,
        toStairStep: 0,
        kickedHorseId: occupant ? occupant.id : null,
        kickedColor: occupant ? occupant.color : null,
        stepTrackPath: [startTrack],
      });
      continue;
    }

    // 2. NGỰA ĐANG CHẠY TRÊN ĐƯỜNG ĐUA 52 Ô
    if (horse.zone === 'TRACK') {
      // 2a. Đang đứng ngay Ô An Toàn Lên Bụt (progress === 51) -> leo thẳng lên bậc `diceValue` (1..6)
      if (horse.progress === SAFE_DOOR_PROGRESS) {
        let blocked = false;
        for (let step = 1; step <= diceValue; step += 1) {
          if (getHorseAtStairStep(horses, color, step)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          moves.push({
            horseId: horse.id,
            color,
            kind: 'ENTER_STAIRS',
            diceValue,
            fromProgress: SAFE_DOOR_PROGRESS,
            toProgress: -1,
            fromTrackIndex: progressToTrackIndex(color, SAFE_DOOR_PROGRESS),
            toTrackIndex: null,
            fromStairStep: 0,
            toStairStep: diceValue,
            kickedHorseId: null,
            kickedColor: null,
            stepTrackPath: [],
          });
        }
        continue;
      }

      // 2b. Đang trên vòng đua (0..50) -> tiến thêm `diceValue` ô
      const targetProgress = horse.progress + diceValue;
      // Bắt buộc phải dừng ĐÚNG Ô Lên Bụt (51), cấm đi lố quá cửa chuồng!
      if (targetProgress > SAFE_DOOR_PROGRESS) continue;

      // Kiểm tra mọi ô trung gian (1 .. diceValue - 1): CẤM NHẢY QUA BẤT KỲ QUÂN NGỰA NÀO!
      let pathBlocked = false;
      const stepTrackPath: number[] = [];
      for (let s = 1; s < diceValue; s += 1) {
        const midIdx = progressToTrackIndex(color, horse.progress + s);
        if (getHorseAtTrackIndex(horses, midIdx)) {
          pathBlocked = true;
          break;
        }
        stepTrackPath.push(midIdx);
      }
      if (pathBlocked) continue;

      // Kiểm tra ô đích
      const destTrackIndex = progressToTrackIndex(color, targetProgress);
      stepTrackPath.push(destTrackIndex);
      const occupant = getHorseAtTrackIndex(horses, destTrackIndex);

      if (occupant) {
        // Cấm đứng chung ô với quân cùng màu; mọi ô trên vòng đua 52 ô (KỂ CẢ 4 Ô ★ Cửa Lên Bụt) đều ĐÁ ĐƯỢC quân địch!
        // Chỉ khi quân đã leo lên bậc bụt 1–6 (HOME_STAIRS) mới bất khả xâm phạm.
        if (occupant.color === color) continue;
      }

      moves.push({
        horseId: horse.id,
        color,
        kind: 'ADVANCE_TRACK',
        diceValue,
        fromProgress: horse.progress,
        toProgress: targetProgress,
        fromTrackIndex: progressToTrackIndex(color, horse.progress),
        toTrackIndex: destTrackIndex,
        fromStairStep: 0,
        toStairStep: 0,
        kickedHorseId: occupant ? occupant.id : null,
        kickedColor: occupant ? occupant.color : null,
        stepTrackPath,
      });
      continue;
    }

    // 3. NGỰA ĐANG TRÊN CẦU THANG BỤT (HOME_STAIRS: bậc 1..6) -> ĐỔI BỤT LÊN HOẶC XUỐNG THEO ĐÚNG SỐ XÚC XẮC (b ≠ a)
    if (horse.zone === 'HOME_STAIRS' && horse.stairStep >= 1 && horse.stairStep <= 6) {
      if (diceValue === horse.stairStep) continue;
      const dir = diceValue > horse.stairStep ? 1 : -1;
      // Cấm nhảy qua ngựa cùng màu trên các bậc nằm giữa và cấm đứng chung bậc đích!
      let blocked = false;
      for (
        let step = horse.stairStep + dir;
        dir > 0 ? step <= diceValue : step >= diceValue;
        step += dir
      ) {
        if (getHorseAtStairStep(horses, color, step)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        moves.push({
          horseId: horse.id,
          color,
          kind: 'CLIMB_STAIRS',
          diceValue,
          fromProgress: -1,
          toProgress: -1,
          fromTrackIndex: null,
          toTrackIndex: null,
          fromStairStep: horse.stairStep,
          toStairStep: diceValue,
          kickedHorseId: null,
          kickedColor: null,
          stepTrackPath: [],
        });
      }
    }
  }

  return moves;
}

/** Tính bảng xếp hạng 2–4 người chơi khi kết thúc ván */
export function computeRankings(state: CoCaNguaState): HorseRankingRow[] {
  const rows = state.players.map((p) => {
    const own = state.horses.filter((h) => h.color === p.color);
    const winStairCount = countWinStairHorses(own, p.color);
    const totalStairPoints = own.reduce((s, h) => s + (h.zone === 'HOME_STAIRS' ? h.stairStep : 0), 0);
    const totalTrackProgress = own.reduce(
      (s, h) => s + (h.zone === 'HOME_STAIRS' ? 52 + h.stairStep : h.zone === 'TRACK' ? h.progress + 1 : 0),
      0,
    );
    return {
      rank: 1,
      color: p.color,
      name: p.name,
      isBot: p.isBot,
      winStairCount,
      totalStairPoints,
      totalTrackProgress,
      kicksCount: p.kicksCount,
    };
  });

  rows.sort((a, b) => {
    if (state.winnerColor === a.color) return -1;
    if (state.winnerColor === b.color) return 1;
    if (b.winStairCount !== a.winStairCount) return b.winStairCount - a.winStairCount;
    if (b.totalStairPoints !== a.totalStairPoints) return b.totalStairPoints - a.totalStairPoints;
    if (b.totalTrackProgress !== a.totalTrackProgress) return b.totalTrackProgress - a.totalTrackProgress;
    return b.kicksCount - a.kicksCount;
  });

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Kiểm tra bất biến toàn vẹn bàn cờ (dùng trong Unit Test & kiểm chứng chống lỗi) */
export function assertHorseBoardInvariants(state: CoCaNguaState): void {
  if (state.horses.length !== state.players.length * 4) {
    throw new Error(`Số quân ngựa sai lệch: ${state.horses.length} !== ${state.players.length * 4}`);
  }
  const trackOccupancy = new Set<number>();
  const stairOccupancy = new Set<string>();
  for (const h of state.horses) {
    if (h.zone === 'TRACK') {
      if (h.progress < 0 || h.progress > SAFE_DOOR_PROGRESS) {
        throw new Error(`Progress không hợp lệ cho ${h.id}: ${h.progress}`);
      }
      const idx = progressToTrackIndex(h.color, h.progress);
      if (trackOccupancy.has(idx)) {
        throw new Error(`Vi phạm chồng quân tại ô đường đua ${idx}`);
      }
      trackOccupancy.add(idx);
    } else if (h.zone === 'HOME_STAIRS') {
      if (h.stairStep < 1 || h.stairStep > 6) {
        throw new Error(`Bậc bụt không hợp lệ cho ${h.id}: ${h.stairStep}`);
      }
      const key = `${h.color}:${h.stairStep}`;
      if (stairOccupancy.has(key)) {
        throw new Error(`Vi phạm chồng quân tại bậc bụt ${key}`);
      }
      stairOccupancy.add(key);
    }
  }
}
