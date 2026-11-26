import { cryptoRandomInt } from '@/shared/crypto/random';
import { getUpgradeCost, playerOwnsFullColorGroup } from './rules';
import type { BoardTile, GameState, PlayerState } from './types';

/** Mốc lượt kích hoạt giai đoạn Tăng Tốc âm thầm (từ Lượt 101+ trở đi) */
export const LATE_GAME_TURNS_THRESHOLD = 100;

/** Ngưỡng rollPower (từ handleCenterPointerUp) tương ứng giữ thanh lực >= 90% */
export const MAX_CHARGE_POWER_THRESHOLD = 0.95;

/** Xác suất Đổ Đôi khi người chơi tụ lực tối đa (chuẩn 2 xúc xắc là 16.7%) */
export const MAX_CHARGE_DOUBLE_RATE = 0.38;

/** Xác suất thoát tù (đổ đôi / mặt 6) khi tụ lực tối đa trong Trại Giam */
export const MAX_CHARGE_JAIL_ESCAPE_RATE = 0.3;

function cryptoRandomFloat01(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

function pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
  let totalWeight = 0;
  for (let i = 0; i < weights.length; i += 1) {
    totalWeight += Math.max(0, weights[i]);
  }
  if (totalWeight <= 0) {
    return items[cryptoRandomInt(0, items.length - 1)];
  }
  let r = cryptoRandomFloat01() * totalWeight;
  for (let i = 0; i < items.length; i += 1) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Kiểm tra ô đất trống / Bến Xe có phải ô thiếu chốt Thắng Hàng, Bộ Màu ×2 hoặc 4/4 Bến Xe hay không */
function isMissingKeyObjectiveTile(
  state: GameState,
  player: PlayerState,
  tile: BoardTile,
): boolean {
  if (tile.kind === 'PROPERTY' && !tile.ownerId) {
    const price = tile.basePrice ?? 1_000_000;
    if (player.cash < price) return false;

    if (tile.edge !== null) {
      const edgeProps = state.tiles.filter((t) => t.edge === tile.edge && t.kind === 'PROPERTY');
      if (
        edgeProps.length >= 2 &&
        edgeProps.every((t) => t.index === tile.index || t.ownerId === player.id)
      ) {
        return true;
      }
    }

    if (tile.colorGroup !== undefined) {
      const groupProps = state.tiles.filter(
        (t) => t.kind === 'PROPERTY' && t.colorGroup === tile.colorGroup,
      );
      if (
        groupProps.length >= 2 &&
        groupProps.every((t) => t.index === tile.index || t.ownerId === player.id)
      ) {
        return true;
      }
    }
    return false;
  }

  if (tile.kind === 'AUCTION_STATION' && tile.auctionState?.status !== 'CLOSED') {
    const closedOwnedCount = state.tiles.filter(
      (t) =>
        t.kind === 'AUCTION_STATION' &&
        t.auctionState?.status === 'CLOSED' &&
        t.auctionState.finalOwnerId === player.id,
    ).length;
    return closedOwnedCount === 3;
  }

  return false;
}

/** Trọng số Giai đoạn Tăng Tốc Lượt 101+ (âm thầm, áp dụng công bằng cho cả Người & Máy AI) */
function getLateGameLandingTileWeight(
  state: GameState,
  player: PlayerState,
  tile: BoardTile,
): number {
  switch (tile.kind) {
    case 'PROPERTY': {
      if (!tile.ownerId) {
        if (isMissingKeyObjectiveTile(state, player, tile)) {
          return 3.2;
        }
        const price = tile.basePrice ?? 1_000_000;
        return player.cash >= price ? 2.2 : 1.0;
      }

      if (tile.ownerId === player.id) {
        if (tile.buildingLevel < 5) {
          const upgradeCost = getUpgradeCost(tile);
          return player.cash >= upgradeCost ? 2.6 : 1.1;
        }
        return 1.0;
      }

      const owner = state.players.find((p) => p.id === tile.ownerId);
      if (!owner || owner.isBankrupt || owner.inJail) {
        return 1.0;
      }

      const hasMonopoly =
        tile.colorGroup !== undefined &&
        playerOwnsFullColorGroup(state.tiles, tile.ownerId, tile.colorGroup);
      if (tile.buildingLevel >= 3 || hasMonopoly) {
        return 1.35;
      }
      return 1.15;
    }

    case 'AIRPORT':
      return 2.8;

    case 'AUCTION_STATION': {
      const auc = tile.auctionState;
      if (!auc || auc.status !== 'CLOSED' || !auc.finalOwnerId) {
        return isMissingKeyObjectiveTile(state, player, tile) ? 3.2 : 2.2;
      }
      if (auc.finalOwnerId === player.id) {
        return 1.0;
      }
      const owner = state.players.find((p) => p.id === auc.finalOwnerId);
      if (!owner || owner.isBankrupt || owner.inJail) {
        return 1.0;
      }
      return 1.15;
    }

    case 'UTILITY': {
      if (!tile.ownerId) {
        return 1.8;
      }
      if (tile.ownerId === player.id) {
        return 1.0;
      }
      const owner = state.players.find((p) => p.id === tile.ownerId);
      if (!owner || owner.isBankrupt || owner.inJail) {
        return 1.0;
      }
      return 1.15;
    }

    case 'HERITAGE':
      return 1.6;

    case 'CHANCE':
    case 'FATE':
      return 1.35;

    case 'GO_TO_JAIL':
      return 0.75;

    case 'TAX':
    case 'VISIT_JAIL':
    case 'GO':
    case 'FREE_PARKING':
    default:
      return 1.0;
  }
}

/**
 * Trọng số ô đích:
 * - Lượt 1–100: giữ nguyên 100% Gói A cho Người chơi thật (ưu tiên đất trống/nhà mình & giảm nhà đối thủ, kèm Anti-Streak).
 * - Từ Lượt 101+ (turnCount > 100): kích hoạt âm thầm Tăng Tốc Kịch Tính (tắt né nhà đối thủ & đẩy mạnh ô thiếu thắng Hàng/Bộ Màu/Bến Xe, Sân Bay, nâng Biệt Thự).
 */
export function getHumanLandingTileWeight(
  state: GameState,
  player: PlayerState,
  targetTileIndex: number,
  antiStreakActive: boolean,
): number {
  const tile = state.tiles[targetTileIndex];
  if (!tile) return 1.0;

  if (state.turnCount > LATE_GAME_TURNS_THRESHOLD) {
    return getLateGameLandingTileWeight(state, player, tile);
  }

  switch (tile.kind) {
    case 'PROPERTY': {
      if (!tile.ownerId) {
        const price = tile.basePrice ?? 1_000_000;
        if (player.cash >= price) {
          return antiStreakActive ? 2.4 : 1.8;
        }
        return 1.15;
      }

      if (tile.ownerId === player.id) {
        if (tile.buildingLevel < 5) {
          const upgradeCost = getUpgradeCost(tile);
          if (player.cash >= upgradeCost) {
            return antiStreakActive ? 2.8 : 2.35;
          }
          return antiStreakActive ? 1.4 : 1.2;
        }
        return 1.0;
      }

      // Nhà đối thủ: kiểm tra chủ đất có đang ở tù (miễn thuê) không
      const owner = state.players.find((p) => p.id === tile.ownerId);
      if (!owner || owner.isBankrupt || owner.inJail) {
        return 1.0;
      }

      const hasMonopoly =
        tile.colorGroup !== undefined &&
        playerOwnsFullColorGroup(state.tiles, tile.ownerId, tile.colorGroup);
      if (tile.buildingLevel >= 3 || hasMonopoly) {
        return antiStreakActive ? 0.18 : 0.42;
      }
      if (tile.buildingLevel === 0) {
        return antiStreakActive ? 0.25 : 0.58;
      }
      return antiStreakActive ? 0.22 : 0.5;
    }

    case 'AIRPORT':
      return antiStreakActive ? 2.6 : 2.3;

    case 'CHANCE':
    case 'FATE':
      return antiStreakActive ? 1.35 : 1.25;

    case 'HERITAGE':
      return antiStreakActive ? 1.75 : 1.5;

    case 'UTILITY': {
      if (!tile.ownerId) {
        return antiStreakActive ? 1.75 : 1.5;
      }
      if (tile.ownerId === player.id) {
        return 1.0;
      }
      const owner = state.players.find((p) => p.id === tile.ownerId);
      if (!owner || owner.isBankrupt || owner.inJail) {
        return 1.0;
      }
      return antiStreakActive ? 0.22 : 0.5;
    }

    case 'AUCTION_STATION': {
      const auc = tile.auctionState;
      if (!auc || auc.status !== 'CLOSED' || !auc.finalOwnerId) {
        return antiStreakActive ? 1.75 : 1.5;
      }
      if (auc.finalOwnerId === player.id) {
        return 1.0;
      }
      const owner = state.players.find((p) => p.id === auc.finalOwnerId);
      if (!owner || owner.isBankrupt || owner.inJail) {
        return 1.0;
      }
      return antiStreakActive ? 0.22 : 0.5;
    }

    case 'GO_TO_JAIL':
      return antiStreakActive ? 0.4 : 0.55;

    case 'TAX':
      return antiStreakActive ? 0.6 : 0.75;

    case 'VISIT_JAIL': {
      const hasPrisoner = state.players.some(
        (p) => !p.isBankrupt && p.inJail && p.id !== player.id,
      );
      return hasPrisoner ? (antiStreakActive ? 0.6 : 0.75) : 1.0;
    }

    case 'GO':
    case 'FREE_PARKING':
    default:
      return 1.0;
  }
}

/**
 * Quay xúc xắc thông minh cho Người chơi thật:
 * - Gói A (tăng đất trống/nhà mình & ô sự kiện, giảm nhà đối thủ, vẫn luôn có tỉ lệ hụt tự nhiên).
 * - Anti-Streak: nếu vừa dính trả tiền thuê đối thủ >= 2 lượt liên tiếp, cắt chuỗi xui ở lượt sau.
 * - Tụ lực tối đa (rollPower >= 0.95): tăng tỉ lệ Đổ Đôi lên ~38% (tự tắt ở lần đôi thứ 3 để tránh vô tù!).
 */
export function rollSmartHumanDice(
  state: GameState,
  player: PlayerState,
  options?: { rollPower?: number; forJail?: boolean },
): number[] {
  const rollPower = options?.rollPower ?? 0.56;
  const forJail = Boolean(options?.forJail);
  const isMaxCharge = rollPower >= MAX_CHARGE_POWER_THRESHOLD;
  const antiStreakActive = (player.consecutiveRentHits ?? 0) >= 2;

  // 1. Trường hợp đang thử vận may thoát tù (ROLL_FOR_JAIL)
  if (forJail) {
    if (!isMaxCharge) {
      return Array.from({ length: state.diceCount }, () => cryptoRandomInt(1, 6));
    }

    if (state.diceCount === 1) {
      if (cryptoRandomFloat01() < MAX_CHARGE_JAIL_ESCAPE_RATE) {
        return [6];
      }
      return [cryptoRandomInt(1, 5)];
    }

    // 2 xúc xắc trong tù khi tụ lực tối đa -> ~30% ra đôi (ưu tiên cặp đôi hạ cánh vào ô tốt)
    if (cryptoRandomFloat01() < MAX_CHARGE_JAIL_ESCAPE_RATE) {
      const doubles: [number, number][] = [
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
        [5, 5],
        [6, 6],
      ];
      const weights = doubles.map(([d1, d2]) =>
        getHumanLandingTileWeight(state, player, (player.position + d1 + d2) % 52, antiStreakActive),
      );
      return [...pickWeighted(doubles, weights)];
    }

    const nonDoubles: [number, number][] = [];
    for (let d1 = 1; d1 <= 6; d1 += 1) {
      for (let d2 = 1; d2 <= 6; d2 += 1) {
        if (d1 !== d2) nonDoubles.push([d1, d2]);
      }
    }
    return [...nonDoubles[cryptoRandomInt(0, nonDoubles.length - 1)]];
  }

  // 2. Tung 1 xúc xắc thông thường (6 mặt, trọng số theo Gói A + Anti-Streak)
  if (state.diceCount === 1) {
    const faces = [1, 2, 3, 4, 5, 6];
    const weights = faces.map((v) =>
      getHumanLandingTileWeight(state, player, (player.position + v) % 52, antiStreakActive),
    );
    return [pickWeighted(faces, weights)];
  }

  // 3. Tung 2 xúc xắc (36 cặp tự nhiên)
  const doubles: [number, number][] = [];
  const doubleWeights: number[] = [];
  const nonDoubles: [number, number][] = [];
  const nonDoubleWeights: number[] = [];

  for (let d1 = 1; d1 <= 6; d1 += 1) {
    for (let d2 = 1; d2 <= 6; d2 += 1) {
      const targetIdx = (player.position + d1 + d2) % 52;
      const w = getHumanLandingTileWeight(state, player, targetIdx, antiStreakActive);
      if (d1 === d2) {
        doubles.push([d1, d2]);
        doubleWeights.push(w);
      } else {
        nonDoubles.push([d1, d2]);
        nonDoubleWeights.push(w);
      }
    }
  }

  // Tụ lực tối đa (>= 90% thanh lực) & chưa đổ đôi 2 lần liên tiếp -> ~38% chọn cặp Đổ Đôi (theo trọng số ô tốt!)
  if (isMaxCharge && player.consecutiveDoubles < 2) {
    if (cryptoRandomFloat01() < MAX_CHARGE_DOUBLE_RATE) {
      return [...pickWeighted(doubles, doubleWeights)];
    }
    return [...pickWeighted(nonDoubles, nonDoubleWeights)];
  }

  // Bình thường (hoặc đã đổ đôi 2 lần liên tiếp — tránh tự đẩy vào tù):
  // gộp cả 36 cặp theo trọng số Gói A (giữ nguyên xác suất hụt & đường cong tự nhiên 2 xúc xắc)
  const allPairs = [...doubles, ...nonDoubles];
  const allWeights = [...doubleWeights, ...nonDoubleWeights];
  return [...pickWeighted(allPairs, allWeights)];
}

/**
 * Hàm tung xúc xắc thống nhất cho cả Người chơi thật lẫn Máy AI (Offline & Online):
 * - Lượt 1–100: Người thật dùng Gói A + Tụ lực; Máy AI giữ random 100%.
 * - Từ Lượt 101+ (turnCount > 100): Cả Người lẫn Máy AI dùng chung trọng số Tăng Tốc Kịch Tính.
 */
export function rollMonopolyDice(
  state: GameState,
  player: PlayerState,
  options?: { rollPower?: number; forJail?: boolean; isBot?: boolean },
): number[] {
  const isBot = options?.isBot ?? player.isBot;
  if (isBot && state.turnCount <= LATE_GAME_TURNS_THRESHOLD) {
    return Array.from({ length: state.diceCount }, () => cryptoRandomInt(1, 6));
  }
  return rollSmartHumanDice(state, player, {
    rollPower: isBot ? Math.min(options?.rollPower ?? 0.56, 0.9) : options?.rollPower,
    forJail: options?.forJail,
  });
}
