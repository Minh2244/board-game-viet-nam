import { cryptoRandomInt, cryptoShuffle } from '@/shared/crypto/random';
import {
  computeGridPos,
  DEFAULT_BOARD_TILES,
  EXPENSIVE_PROPERTY_THRESHOLD,
  INTERLEAVED_EDGE_PROPERTY_SLOTS,
  STARTER_BOTTOM_PROPERTY_INDICES,
} from './boardData';
import type { BoardTile, BoardTileDef } from '../engine/types';

function hasAdjacentExpensiveTiles(byIndex: Map<number, BoardTileDef>): boolean {
  for (let i = 0; i < 52; i += 1) {
    const cur = byIndex.get(i);
    const nxt = byIndex.get((i + 1) % 52);
    if (
      cur?.kind === 'PROPERTY' &&
      nxt?.kind === 'PROPERTY' &&
      (cur.basePrice ?? 0) >= EXPENSIVE_PROPERTY_THRESHOLD &&
      (nxt.basePrice ?? 0) >= EXPENSIVE_PROPERTY_THRESHOLD
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Tạo bộ 52 ô bàn cờ hoàn chỉnh (giữ nguyên tuyệt đối 18 ô khung đặc biệt trên mọi bản đồ).
 * Nếu mapMode === 'random':
 * - 10 ô cạnh dưới luôn là 10 ô khởi điểm nhẹ nhàng (1 Tr – 2,2 Tr) được xáo trộn ngẫu nhiên.
 * - 24 ô trên 3 cạnh Trái/Trên/Phải (7–10–7) được chia xen kẽ ĐÚNG 2 ô Đắt (5–6 Tr) mỗi cạnh kèm các ô vừa/rẻ,
 *   tuyệt đối không để 2 ô Đắt đứng liền kề nhau!
 */
export function generateBoardTiles(mapMode: 'default' | 'random'): BoardTile[] {
  let defs: BoardTileDef[] = DEFAULT_BOARD_TILES.map((d) => ({ ...d, gridPos: { ...d.gridPos } }));

  if (mapMode === 'random') {
    const starterPool = STARTER_BOTTOM_PROPERTY_INDICES.map((idx) => defs[idx]);
    const upperSlots: number[] = [
      ...INTERLEAVED_EDGE_PROPERTY_SLOTS[1],
      ...INTERLEAVED_EDGE_PROPERTY_SLOTS[2],
      ...INTERLEAVED_EDGE_PROPERTY_SLOTS[3],
    ];
    const upperPool = upperSlots.map((idx) => defs[idx]);
    const expensivePool = upperPool.filter((t) => (t.basePrice ?? 0) >= EXPENSIVE_PROPERTY_THRESHOLD);
    const midPool = upperPool.filter((t) => (t.basePrice ?? 0) < EXPENSIVE_PROPERTY_THRESHOLD);

    const byIndex = new Map<number, BoardTileDef>(defs.map((d) => [d.index, d]));

    // Xáo trộn 9 ô khởi điểm trên cạnh dưới
    const shuffledStarters = cryptoShuffle(starterPool);
    for (let i = 0; i < STARTER_BOTTOM_PROPERTY_INDICES.length; i += 1) {
      const targetIndex = STARTER_BOTTOM_PROPERTY_INDICES[i];
      const payload = shuffledStarters[i];
      const { col, row, edge } = computeGridPos(targetIndex);
      byIndex.set(targetIndex, { ...payload, index: targetIndex, edge, gridPos: { col, row } });
    }

    // Phân bổ 6 ô Đắt (mỗi cạnh Trái/Trên/Phải đúng 2 ô) xen kẽ 15 ô Vừa/Rẻ, không đặt 2 ô Đắt cạnh nhau
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const expShuffled = cryptoShuffle(expensivePool);
      const midShuffled = cryptoShuffle(midPool);
      let expCursor = 0;
      let midCursor = 0;

      for (const edgeKey of [1, 2, 3] as const) {
        const edgeSlots = INTERLEAVED_EDGE_PROPERTY_SLOTS[edgeKey];
        const edgePayloads = cryptoShuffle([
          expShuffled[expCursor++],
          expShuffled[expCursor++],
          ...midShuffled.slice(midCursor, midCursor + edgeSlots.length - 2),
        ]);
        midCursor += edgeSlots.length - 2;

        for (let k = 0; k < edgeSlots.length; k += 1) {
          const targetIndex = edgeSlots[k];
          const payload = edgePayloads[k];
          const { col, row, edge } = computeGridPos(targetIndex);
          byIndex.set(targetIndex, { ...payload, index: targetIndex, edge, gridPos: { col, row } });
        }
      }

      if (!hasAdjacentExpensiveTiles(byIndex)) {
        break;
      }
    }

    defs = Array.from({ length: 52 }, (_, i) => byIndex.get(i)!);
  }

  return defs.map((def) => {
    const tile: BoardTile = {
      ...def,
      ownerId: null,
      buildingLevel: 0,
    };

    if (def.kind === 'AUCTION_STATION') {
      tile.auctionState = {
        status: 'UNOPENED',
        currentBid: 0,
        leaderId: null,
        bidOrder: [],
        deposits: {},
        eliminatedPlayerIds: [],
        finalOwnerId: null,
        finalPrice: 0,
      };
    }

    if (def.kind === 'AIRPORT') {
      tile.currentDestinationTileIndex = pickRandomPropertyDestination(defs);
    }

    return tile;
  });
}

/** Chọn ngẫu nhiên 1 trong 30 Ô Đất Địa Danh cho điểm đến Sân Bay bằng Web Crypto */
export function pickRandomPropertyDestination(
  tiles: readonly BoardTileDef[],
  excludeTileIndex?: number,
): number {
  const candidates = tiles
    .filter((t) => t.kind === 'PROPERTY' && t.index !== excludeTileIndex)
    .map((t) => t.index);
  if (candidates.length === 0) return 2;
  return candidates[cryptoRandomInt(0, candidates.length - 1)];
}
