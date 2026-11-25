import { cryptoRandomInt } from '@/shared/crypto/random';
import {
  AUCTION_START_PRICE,
  calculatePropertyRent,
  calculateStationRent,
  getAuctionBidDelta,
  getTileEffectiveOwnerId,
  getTotalLiquidatableValue,
  getUpgradeCost,
  JAIL_BAIL_FEE,
  playerOwnsFullColorGroup,
} from '../engine/rules';
import type { BoardTile, GameAction, GameState, PlayerState } from '../engine/types';

function computeMaxThreatAhead(state: GameState, bot: PlayerState): number {
  const maxStep = state.diceCount === 2 ? 12 : 6;
  let maxRent = 0;
  let totalWeightedThreat = 0;

  for (let step = 1; step <= maxStep; step += 1) {
    const tile = state.tiles[(bot.position + step) % 52];
    const ownerId = getTileEffectiveOwnerId(tile);
    if (!ownerId || ownerId === bot.id) continue;

    let rent = 0;
    if (tile.kind === 'PROPERTY') {
      rent = calculatePropertyRent(state.tiles, state.players, tile);
    } else if (tile.kind === 'AUCTION_STATION') {
      rent = calculateStationRent(state.players, tile);
    } else if (tile.kind === 'UTILITY') {
      rent = (state.diceCount === 2 ? 7 : 3) * 150_000;
    }

    if (rent > maxRent) maxRent = rent;
    totalWeightedThreat += rent * (1 / maxStep);
  }

  return Math.round(Math.max(maxRent * 0.65, totalWeightedThreat * 1.4));
}

function getColorGroupCounts(
  tiles: readonly BoardTile[],
  colorGroup: number,
  botId: string,
): { own: number; maxEnemy: number } {
  let own = 0;
  const enemyMap = new Map<string, number>();
  for (const t of tiles) {
    if (t.kind === 'PROPERTY' && t.colorGroup === colorGroup && t.ownerId) {
      if (t.ownerId === botId) {
        own += 1;
      } else {
        enemyMap.set(t.ownerId, (enemyMap.get(t.ownerId) ?? 0) + 1);
      }
    }
  }
  const maxEnemy = Math.max(0, ...enemyMap.values());
  return { own, maxEnemy };
}

function getEdgeThreatsAndOwn(
  tiles: readonly BoardTile[],
  edge: number | null,
  botId: string,
): { botCount: number; maxEnemyCount: number; totalOwnable: number } {
  if (edge === null) return { botCount: 0, maxEnemyCount: 0, totalOwnable: 6 };
  const edgeProps = tiles.filter((t) => t.edge === edge && t.kind === 'PROPERTY');
  let botCount = 0;
  const enemies = new Map<string, number>();
  for (const t of edgeProps) {
    if (!t.ownerId) continue;
    if (t.ownerId === botId) botCount += 1;
    else enemies.set(t.ownerId, (enemies.get(t.ownerId) ?? 0) + 1);
  }
  return {
    botCount,
    maxEnemyCount: Math.max(0, ...enemies.values()),
    totalOwnable: edgeProps.length,
  };
}

function getStationCounts(tiles: readonly BoardTile[], botId: string): {
  botStations: number;
  maxEnemyStations: number;
} {
  let botStations = 0;
  const enemies = new Map<string, number>();
  for (const t of tiles) {
    if (t.kind === 'AUCTION_STATION' && t.auctionState?.status === 'CLOSED' && t.auctionState.finalOwnerId) {
      const owner = t.auctionState.finalOwnerId;
      if (owner === botId) botStations += 1;
      else enemies.set(owner, (enemies.get(owner) ?? 0) + 1);
    }
  }
  return {
    botStations,
    maxEnemyStations: Math.max(0, ...enemies.values()),
  };
}

function scoreAssetKeepPriority(tiles: readonly BoardTile[], tile: BoardTile, ownerId: string): number {
  let score = tile.basePrice ?? 2_000_000;
  if (tile.kind === 'AUCTION_STATION') {
    score += 5_500_000;
  } else if (tile.kind === 'PROPERTY' && tile.colorGroup) {
    const groupTiles = tiles.filter((t) => t.kind === 'PROPERTY' && t.colorGroup === tile.colorGroup);
    const ownCount = groupTiles.filter((t) => t.ownerId === ownerId).length;
    if (groupTiles.length >= 2 && ownCount >= groupTiles.length) score += 8_000_000;
    else if (ownCount >= groupTiles.length - 1) score += 3_000_000;
    score += tile.buildingLevel * 1_400_000;
  }
  return score;
}

/**
 * Bộ não Bot SmartAI chạy hoàn toàn cục bộ, mọi quyết định có xác suất biến thiên nhẹ
 * bằng Web Crypto để tránh đánh máy móc rập khuôn giữa các ván.
 */
export function computeBotAction(state: GameState, forceActAsBot = false): GameAction | null {
  if (state.phase === 'GAME_OVER') return null;

  if (state.phase === 'DEBT_LIQUIDATION' && state.debtQueue.length > 0) {
    const debt = state.debtQueue[0];
    const debtor = state.players.find((p) => p.id === debt.debtorId);
    if (!debtor || (!debtor.isBot && !forceActAsBot)) return null;

    if (debtor.cash + getTotalLiquidatableValue(state.tiles, debtor.id) < debt.amount) {
      return { type: 'DECLARE_BANKRUPTCY' };
    }

    // Ưu tiên bán nhà trên ô ít giá trị chiến lược trước, rồi mới bán đất
    const ownedWithBuildings = state.tiles
      .filter((t) => t.kind === 'PROPERTY' && t.ownerId === debtor.id && t.buildingLevel > 0)
      .sort((a, b) => scoreAssetKeepPriority(state.tiles, a, debtor.id) - scoreAssetKeepPriority(state.tiles, b, debtor.id));

    if (ownedWithBuildings.length > 0) {
      return { type: 'SELL_BUILDING', tileIndex: ownedWithBuildings[0].index };
    }

    const sellableProps = state.tiles
      .filter((t) => {
        if (t.kind === 'AUCTION_STATION') {
          return t.auctionState?.status === 'CLOSED' && t.auctionState.finalOwnerId === debtor.id;
        }
        return t.ownerId === debtor.id && t.buildingLevel === 0;
      })
      .sort((a, b) => scoreAssetKeepPriority(state.tiles, a, debtor.id) - scoreAssetKeepPriority(state.tiles, b, debtor.id));

    if (sellableProps.length > 0) {
      return { type: 'SELL_PROPERTY', tileIndex: sellableProps[0].index };
    }

    return { type: 'DECLARE_BANKRUPTCY' };
  }

  const bot = state.players[state.currentPlayerIndex];
  if (!bot || (!bot.isBot && !forceActAsBot) || bot.isBankrupt) return null;

  switch (state.phase) {
    case 'WAIT_ROLL':
      return { type: 'ROLL_DICE' };

    case 'CARD_REVEAL':
      return { type: 'CONFIRM_CARD' };

    case 'IN_JAIL_DECISION': {
      const unownedCount = state.tiles.filter(
        (t) => t.kind === 'PROPERTY' && !t.ownerId,
      ).length;
      const threat = computeMaxThreatAhead(state, bot);
      const wantQuickExit = unownedCount >= 10 || threat < 2_800_000;

      if (wantQuickExit && bot.getOutOfJailCards > 0) {
        return { type: 'USE_JAIL_FREE_CARD' };
      }
      return { type: 'ROLL_FOR_JAIL' };
    }

    case 'ASK_JAIL_BAIL': {
      const unownedCount = state.tiles.filter(
        (t) => t.kind === 'PROPERTY' && !t.ownerId,
      ).length;
      const threat = computeMaxThreatAhead(state, bot);
      const safeToPay = bot.cash >= JAIL_BAIL_FEE + 1_200_000;
      const pay = safeToPay && (unownedCount >= 8 || threat < 3_200_000 || cryptoRandomInt(0, 4) === 0);
      return { type: 'ANSWER_JAIL_BAIL', pay };
    }

    case 'BUY_OR_SKIP_DECISION': {
      if (state.pendingBuyOrUpgradeTileIndex === null) return { type: 'BUY_PROPERTY', buy: false };
      const tile = state.tiles[state.pendingBuyOrUpgradeTileIndex];
      const price = tile.basePrice ?? 1_000_000;
      if (bot.cash < price) return { type: 'BUY_PROPERTY', buy: false };

      const threatAhead = computeMaxThreatAhead(state, bot);
      const edgeInfo = getEdgeThreatsAndOwn(state.tiles, tile.edge, bot.id);
      const mustBlockEdge =
        tile.kind === 'PROPERTY' &&
        (edgeInfo.maxEnemyCount >= Math.max(3, edgeInfo.totalOwnable - 2) ||
          edgeInfo.botCount >= Math.max(3, edgeInfo.totalOwnable - 2));

      let priorityBonus = false;
      if (tile.kind === 'PROPERTY' && tile.colorGroup) {
        const { own, maxEnemy } = getColorGroupCounts(state.tiles, tile.colorGroup, bot.id);
        if (own === 2 || maxEnemy === 2 || own === 1) priorityBonus = true;
      } else if (tile.kind === 'UTILITY') {
        const ownUtil = state.tiles.filter((t) => t.kind === 'UTILITY' && t.ownerId === bot.id).length;
        if (ownUtil >= 1) priorityBonus = true;
      }

      const safeReserve =
        mustBlockEdge || priorityBonus
          ? 250_000
          : Math.min(3_500_000, 900_000 + Math.round(threatAhead * 0.65));

      const afterCash = bot.cash - price;
      const buy =
        mustBlockEdge ||
        afterCash >= safeReserve ||
        (priorityBonus && afterCash >= 200_000) ||
        (afterCash >= 500_000 && cryptoRandomInt(0, 9) < 3);

      return { type: 'BUY_PROPERTY', buy };
    }

    case 'UPGRADE_OWN_PROPERTY': {
      if (state.pendingBuyOrUpgradeTileIndex === null) return { type: 'UPGRADE_PROPERTY', upgrade: false };
      const tile = state.tiles[state.pendingBuyOrUpgradeTileIndex];
      const cost = getUpgradeCost(tile);
      if (bot.cash < cost) return { type: 'UPGRADE_PROPERTY', upgrade: false };

      const threatAhead = computeMaxThreatAhead(state, bot);
      const hasSet =
        tile.colorGroup !== undefined &&
        playerOwnsFullColorGroup(state.tiles, bot.id, tile.colorGroup);
      const minReserve = hasSet ? 700_000 : 1_300_000 + Math.round(threatAhead * 0.6);

      const upgrade =
        bot.cash - cost >= minReserve ||
        (hasSet && bot.cash - cost >= 400_000 && cryptoRandomInt(0, 3) > 0);
      return { type: 'UPGRADE_PROPERTY', upgrade };
    }

    case 'AUCTION_DECISION': {
      if (state.pendingAuctionTileIndex === null) return { type: 'AUCTION_DECIDE', bid: false };
      const tile = state.tiles[state.pendingAuctionTileIndex];
      const { nextBid, deltaNeeded } = getAuctionBidDelta(tile, bot.id);
      if (bot.cash < deltaNeeded) return { type: 'AUCTION_DECIDE', bid: false };

      const { botStations, maxEnemyStations } = getStationCounts(state.tiles, bot.id);
      const edgeInfo = getEdgeThreatsAndOwn(state.tiles, tile.edge, bot.id);

      // Tính giá trần đấu giá thông minh + AntiWinGuard
      const jitter = cryptoRandomInt(-1, 2) * 200_000;
      let ceiling = 3_400_000 + jitter;
      if (botStations >= 2) ceiling += 1_400_000;
      if (maxEnemyStations >= 2) ceiling += 1_400_000;
      if (maxEnemyStations >= 3 || edgeInfo.maxEnemyCount >= 7) ceiling += 1_800_000;
      if (edgeInfo.botCount >= 6) ceiling += 1_000_000;

      const myDeposit = tile.auctionState?.deposits[bot.id] ?? 0;
      const afterCash = bot.cash - deltaNeeded;
      const minBuffer =
        maxEnemyStations >= 3 || edgeInfo.maxEnemyCount >= 7 ? 200_000 : 800_000;

      // Nếu đã lỡ cọc trước đó rồi thì ưu tiên theo giá chênh lệch miễn không vượt quá trần
      const affordableAndSmart =
        (nextBid <= ceiling && afterCash >= minBuffer) ||
        (myDeposit >= AUCTION_START_PRICE && nextBid <= ceiling + 600_000 && afterCash >= 400_000);

      return { type: 'AUCTION_DECIDE', bid: affordableAndSmart };
    }

    default:
      return null;
  }
}
