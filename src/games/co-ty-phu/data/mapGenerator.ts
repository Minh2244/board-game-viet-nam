import { cryptoRandomInt, cryptoShuffle } from '@/shared/crypto/random';
import {
  COLOR_GROUP_2_CLUSTERS,
  COLOR_GROUP_3_CLUSTERS,
  computeGridPos,
  DEFAULT_BOARD_TILES,
} from './boardData';
import type { BoardTile, BoardTileDef } from '../engine/types';

/**
 * Tạo bộ 52 ô bàn cờ hoàn chỉnh (giữ nguyên tuyệt đối 18 ô khung đặc biệt trên mọi bản đồ).
 * - Mọi ô cùng một Nhóm Màu LUÔN đứng liền kề nhau thành từng cụm (cả ở Bản đồ Mặc định lẫn Bản đồ Ngẫu nhiên!).
 * - Khi mapMode === 'random': xáo trộn nguyên cụm các nhóm màu 3 ô với nhau (giữ 2 cụm khởi điểm đầu cạnh dưới nhẹ nhàng)
 *   và xáo trộn nguyên cụm 2 nhóm màu 2 ô với nhau -> không bao giờ bị xé lẻ hay lẫn lộn nhóm màu!
 */
export function generateBoardTiles(mapMode: 'default' | 'random'): BoardTile[] {
  let defs: BoardTileDef[] = DEFAULT_BOARD_TILES.map((d) => ({ ...d, gridPos: { ...d.gridPos } }));

  if (mapMode === 'random') {
    const byIndex = new Map<number, BoardTileDef>(defs.map((d) => [d.index, d]));

    // Trích xuất 10 nhóm màu 3 ô (mỗi nhóm được xáo thứ tự nội bộ 3 ô nhưng luôn đi chung 1 cụm!)
    const original3Groups = COLOR_GROUP_3_CLUSTERS.map((cluster) =>
      cryptoShuffle(cluster.map((idx) => defs[idx])),
    );
    // Giữ 3 cụm có ô thuộc cạnh dưới (Nhóm 1, Nhóm 2, Nhóm 3) ở 3 cụm khởi điểm đầu bàn để cạnh dưới luôn nhẹ nhàng (0 ô đắt >= 5M); 7 nhóm 3 ô còn lại hoán đổi ngẫu nhiên
    const starter3Groups = cryptoShuffle(original3Groups.slice(0, 3));
    const upper3Groups = cryptoShuffle(original3Groups.slice(3));
    const arranged3Groups = [...starter3Groups, ...upper3Groups];

    for (let cIdx = 0; cIdx < COLOR_GROUP_3_CLUSTERS.length; cIdx += 1) {
      const targetCluster = COLOR_GROUP_3_CLUSTERS[cIdx];
      const groupTiles = arranged3Groups[cIdx];
      for (let k = 0; k < 3; k += 1) {
        const targetIndex = targetCluster[k];
        const payload = groupTiles[k];
        const { col, row, edge } = computeGridPos(targetIndex);
        byIndex.set(targetIndex, { ...payload, index: targetIndex, edge, gridPos: { col, row } });
      }
    }

    // Xáo trộn thứ tự trong 2 cụm nhóm 2 ô (Nhóm 11 ở cạnh dưới [10,11], Nhóm 12 ở cạnh trên [27,28])
    for (const cluster of COLOR_GROUP_2_CLUSTERS) {
      const shuffledPair = cryptoShuffle(cluster.map((idx) => defs[idx]));
      for (let k = 0; k < 2; k += 1) {
        const targetIndex = cluster[k];
        const payload = shuffledPair[k];
        const { col, row, edge } = computeGridPos(targetIndex);
        byIndex.set(targetIndex, { ...payload, index: targetIndex, edge, gridPos: { col, row } });
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

/** Chọn ngẫu nhiên 1 trong 34 Ô Đất Địa Danh cho điểm đến Sân Bay bằng Web Crypto */
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
