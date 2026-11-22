import { COLOR_GROUPS, isOwnableTile } from '../data/boardData';
import type {
  BoardTile,
  EdgeIndex,
  PlayerState,
  WinConditionType,
} from './types';

export const STARTING_CASH = 25_000_000;
export const GO_PASS_REWARD = 3_000_000;
export const HERITAGE_REWARD = 1_000_000;
export const JAIL_VISIT_FEE = 500_000;
export const JAIL_BAIL_FEE = 1_000_000;
export const AUCTION_START_PRICE = 2_000_000;
export const AUCTION_BID_INCREMENT = 200_000;
export const JAIL_TILE_INDEX = 16;
export const GO_TO_JAIL_TILE_INDEX = 42;

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
}

export function formatShortVnd(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const text = Number.isInteger(millions)
      ? millions.toFixed(0)
      : millions.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
    return `${sign}${text} Tr đ`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)} Nghìn đ`;
  }
  return `${sign}${abs} đ`;
}

export function getTileEffectiveOwnerId(tile: BoardTile): string | null {
  if (tile.kind === 'AUCTION_STATION') {
    return tile.auctionState?.status === 'CLOSED' ? tile.auctionState.finalOwnerId : null;
  }
  return tile.ownerId;
}

export function playerOwnsFullColorGroup(
  tiles: readonly BoardTile[],
  playerId: string,
  colorGroup: number,
): boolean {
  const groupTiles = tiles.filter((t) => t.kind === 'PROPERTY' && t.colorGroup === colorGroup);
  return groupTiles.length >= 2 && groupTiles.every((t) => t.ownerId === playerId);
}

export function getColorGroupLabel(colorGroup?: number): string {
  if (!colorGroup) return '';
  return COLOR_GROUPS[colorGroup]?.name ?? '';
}

export function calculatePropertyRent(
  tiles: readonly BoardTile[],
  players: readonly PlayerState[],
  tile: BoardTile,
): number {
  if (tile.kind !== 'PROPERTY' || !tile.ownerId || !tile.basePrice) return 0;
  const owner = players.find((p) => p.id === tile.ownerId);
  if (!owner || owner.isBankrupt || owner.inJail) return 0;

  const multipliers = [0.25, 0.5, 1, 1.5, 2, 3] as const;
  const baseRent = Math.round(tile.basePrice * multipliers[tile.buildingLevel]);
  const hasMonopoly =
    tile.colorGroup !== undefined && playerOwnsFullColorGroup(tiles, tile.ownerId, tile.colorGroup);
  return hasMonopoly ? baseRent * 2 : baseRent;
}

export function calculateUtilityRent(
  tiles: readonly BoardTile[],
  players: readonly PlayerState[],
  tile: BoardTile,
  diceTotal: number,
): number {
  if (tile.kind !== 'UTILITY' || !tile.ownerId) return 0;
  const owner = players.find((p) => p.id === tile.ownerId);
  if (!owner || owner.isBankrupt || owner.inJail) return 0;

  const utilityCount = tiles.filter(
    (t) => t.kind === 'UTILITY' && t.ownerId === tile.ownerId,
  ).length;
  const perPip = utilityCount >= 2 ? 250_000 : 100_000;
  return Math.max(1, diceTotal) * perPip;
}

export function calculateStationRent(players: readonly PlayerState[], tile: BoardTile): number {
  if (tile.kind !== 'AUCTION_STATION') return 0;
  const auc = tile.auctionState;
  if (!auc || auc.status !== 'CLOSED' || !auc.finalOwnerId) return 0;
  const owner = players.find((p) => p.id === auc.finalOwnerId);
  if (!owner || owner.isBankrupt || owner.inJail) return 0;
  return Math.floor(auc.finalPrice / 2);
}

export function getUpgradeCost(tile: BoardTile): number {
  if (tile.kind !== 'PROPERTY' || !tile.basePrice || tile.buildingLevel >= 5) return 0;
  if (tile.buildingLevel === 4) return tile.basePrice;
  return Math.floor(tile.basePrice / 2);
}

export function getSellBuildingValue(tile: BoardTile): number {
  if (tile.kind !== 'PROPERTY' || !tile.basePrice || tile.buildingLevel <= 0) return 0;
  if (tile.buildingLevel === 5) return Math.floor(tile.basePrice / 2);
  return Math.floor(tile.basePrice / 4);
}

export function getSellPropertyValue(tile: BoardTile): number {
  if (tile.kind === 'PROPERTY') {
    if (!tile.ownerId || tile.buildingLevel > 0 || !tile.basePrice) return 0;
    return Math.floor(tile.basePrice / 2);
  }
  if (tile.kind === 'UTILITY') {
    if (!tile.ownerId || !tile.basePrice) return 0;
    return Math.floor(tile.basePrice / 2);
  }
  if (tile.kind === 'AUCTION_STATION') {
    if (tile.auctionState?.status !== 'CLOSED' || !tile.auctionState.finalOwnerId) return 0;
    return Math.floor(tile.auctionState.finalPrice / 2);
  }
  return 0;
}

export function getTotalLiquidatableValue(tiles: readonly BoardTile[], playerId: string): number {
  let total = 0;
  for (const tile of tiles) {
    if (tile.kind === 'PROPERTY' && tile.ownerId === playerId && tile.basePrice) {
      let lvl = tile.buildingLevel;
      while (lvl > 0) {
        total += lvl === 5 ? Math.floor(tile.basePrice / 2) : Math.floor(tile.basePrice / 4);
        lvl -= 1;
      }
      total += Math.floor(tile.basePrice / 2);
    } else if (tile.kind === 'UTILITY' && tile.ownerId === playerId && tile.basePrice) {
      total += Math.floor(tile.basePrice / 2);
    } else if (
      tile.kind === 'AUCTION_STATION' &&
      tile.auctionState?.status === 'CLOSED' &&
      tile.auctionState.finalOwnerId === playerId
    ) {
      total += Math.floor(tile.auctionState.finalPrice / 2);
    }
  }
  return total;
}

export function countPlayerBuildings(
  tiles: readonly BoardTile[],
  playerId: string,
): { houses: number; villas: number } {
  let houses = 0;
  let villas = 0;
  for (const t of tiles) {
    if (t.kind === 'PROPERTY' && t.ownerId === playerId) {
      if (t.buildingLevel === 5) villas += 1;
      else houses += t.buildingLevel;
    }
  }
  return { houses, villas };
}

export function calculatePropertyTax(tiles: readonly BoardTile[], playerId: string): number {
  const { houses, villas } = countPlayerBuildings(tiles, playerId);
  if (houses === 0 && villas === 0) return 50_000;
  return houses * 200_000 + villas * 1_000_000;
}

export function calculateRepairFee(
  tiles: readonly BoardTile[],
  playerId: string,
  houseFee: number,
  villaFee: number,
): number {
  const { houses, villas } = countPlayerBuildings(tiles, playerId);
  return houses * houseFee + villas * villaFee;
}

export function computePlayerNetWorth(
  tiles: readonly BoardTile[],
  player: PlayerState,
): number {
  if (player.isBankrupt) return 0;
  let total = player.cash;
  for (const t of tiles) {
    if (t.kind === 'PROPERTY' && t.ownerId === player.id && t.basePrice) {
      total += t.basePrice;
      const houses = Math.min(4, t.buildingLevel);
      total += houses * Math.floor(t.basePrice / 2);
      if (t.buildingLevel === 5) total += t.basePrice;
    } else if (t.kind === 'UTILITY' && t.ownerId === player.id && t.basePrice) {
      total += t.basePrice;
    } else if (t.kind === 'AUCTION_STATION' && t.auctionState) {
      if (t.auctionState.status === 'CLOSED' && t.auctionState.finalOwnerId === player.id) {
        total += t.auctionState.finalPrice;
      } else if (t.auctionState.deposits[player.id]) {
        total += t.auctionState.deposits[player.id];
      }
    }
  }
  return total;
}

export function evaluateEdgeProgress(
  tiles: readonly BoardTile[],
  edge: EdgeIndex,
): { ownerCounts: Record<string, number>; ownableTotal: number } {
  const ownables = tiles.filter((t) => t.edge === edge && isOwnableTile(t));
  const ownerCounts: Record<string, number> = {};
  for (const tile of ownables) {
    const owner = getTileEffectiveOwnerId(tile);
    if (owner) {
      ownerCounts[owner] = (ownerCounts[owner] ?? 0) + 1;
    }
  }
  return { ownerCounts, ownableTotal: ownables.length };
}

export function checkVictory(
  tiles: readonly BoardTile[],
  players: readonly PlayerState[],
): { winnerId: string; condition: WinConditionType; edge: EdgeIndex | null } | null {
  const alivePlayers = players.filter((p) => !p.isBankrupt);
  if (alivePlayers.length === 1) {
    return { winnerId: alivePlayers[0].id, condition: 'LAST_MAN_STANDING', edge: null };
  }
  if (alivePlayers.length === 0) return null;

  const aliveSet = new Set(alivePlayers.map((p) => p.id));

  // 1. Thắng 1 Đường Thẳng (9 ô có thể mua trên cùng 1 cạnh)
  for (const edge of [0, 1, 2, 3] as const) {
    const { ownerCounts, ownableTotal } = evaluateEdgeProgress(tiles, edge);
    for (const [ownerId, count] of Object.entries(ownerCounts)) {
      if (count >= ownableTotal && aliveSet.has(ownerId)) {
        return { winnerId: ownerId, condition: 'LINE_VICTORY', edge };
      }
    }
  }

  // 2. Thắng Trọn 4 Ô Đấu Giá (4 Bến Xe Lớn)
  const stations = tiles.filter((t) => t.kind === 'AUCTION_STATION');
  const closedOwners = stations
    .map((s) => (s.auctionState?.status === 'CLOSED' ? s.auctionState.finalOwnerId : null))
    .filter((id): id is string => Boolean(id));
  if (closedOwners.length === 4 && new Set(closedOwners).size === 1 && aliveSet.has(closedOwners[0])) {
    return { winnerId: closedOwners[0], condition: 'FOUR_AUCTIONS', edge: null };
  }

  return null;
}

export function getAuctionBidDelta(tile: BoardTile, playerId: string): { nextBid: number; deltaNeeded: number } {
  const auc = tile.auctionState;
  if (!auc || auc.status === 'UNOPENED') {
    return { nextBid: AUCTION_START_PRICE, deltaNeeded: AUCTION_START_PRICE };
  }
  const nextBid = auc.currentBid + AUCTION_BID_INCREMENT;
  const existingDeposit = auc.deposits[playerId] ?? 0;
  return { nextBid, deltaNeeded: Math.max(0, nextBid - existingDeposit) };
}
