import { describe, expect, it } from 'vitest';
import { GAME_CATALOG } from '@/games/registry';
import {
  COLOR_GROUPS,
  DEFAULT_BOARD_TILES,
  EXPENSIVE_PROPERTY_THRESHOLD,
  FIXED_SKELETON_INDICES,
  isOwnableTile,
  MAX_EXPENSIVE_PROPERTY_COUNT,
  MAX_PROPERTY_PRICE,
} from '@/games/co-ty-phu/data/boardData';
import { getCardArtworkUrl } from '@/games/co-ty-phu/data/cardArtwork';
import { CHANCE_CARDS, FATE_CARDS } from '@/games/co-ty-phu/data/cards';
import { CO_TY_PHU_CHARACTERS, LAND_COLORS } from '@/games/co-ty-phu/data/characters';
import { getLandmarkArtworkUrl } from '@/games/co-ty-phu/data/landmarkArtwork';

describe('Kiến trúc Sảnh Ngoài & Dữ liệu 52 Ô Mặc Định', () => {
  it('Khai báo đúng 5 tựa game với duy nhất co-ty-phu READY ở giai đoạn đầu', () => {
    expect(GAME_CATALOG.map((g) => g.id)).toEqual([
      'co-ty-phu',
      'co-ca-ngua',
      'co-vua',
      'co-tuong',
      'o-an-quan',
    ]);
    const ready = GAME_CATALOG.filter((g) => g.status === 'READY');
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('co-ty-phu');
    expect(typeof ready[0].loader).toBe('function');

    const upcoming = GAME_CATALOG.filter((g) => g.status === 'COMING_SOON');
    expect(upcoming).toHaveLength(4);
    expect(upcoming.every((g) => g.loader === undefined)).toBe(true);
  });

  it('Đủ 52 ô bàn cờ chữ nhật 17x11, gồm 18 ô khung cố định (3 Cơ Hội / 3 Khí Vận / Thuế -200K dưới) và 34 ô đất chia 12 nhóm màu', () => {
    expect(DEFAULT_BOARD_TILES).toHaveLength(52);
    expect(FIXED_SKELETON_INDICES.size).toBe(18);
    expect(DEFAULT_BOARD_TILES.some((t) => t.kind === 'HERITAGE')).toBe(false);

    const properties = DEFAULT_BOARD_TILES.filter((t) => t.kind === 'PROPERTY');
    expect(properties).toHaveLength(34);

    // Nhà máy Thủy Điện & Bến Xe Đấu Giá tuyệt đối KHÔNG thuộc nhóm màu đất
    const utilities = DEFAULT_BOARD_TILES.filter((t) => t.kind === 'UTILITY');
    expect(utilities).toHaveLength(2);
    expect(utilities.every((t) => t.colorGroup === undefined)).toBe(true);
    const stations = DEFAULT_BOARD_TILES.filter((t) => t.kind === 'AUCTION_STATION');
    expect(stations).toHaveLength(4);
    expect(stations.every((t) => t.colorGroup === undefined)).toBe(true);

    // Kiểm tra 12 nhóm màu (10 nhóm 3 ô + Nhóm 11 Bắc Trung Bộ 2 ô + Nhóm 12 Đông Bắc Bộ 2 ô) & quy tắc cân bằng giá
    const groupCounts = new Map<number, number>();
    for (const tile of properties) {
      expect(tile.colorGroup).toBeDefined();
      expect(tile.basePrice).toBeGreaterThanOrEqual(1_000_000);
      expect(tile.basePrice).toBeLessThanOrEqual(MAX_PROPERTY_PRICE);
      expect(tile.basePrice! % 200_000).toBe(0);
      groupCounts.set(tile.colorGroup!, (groupCounts.get(tile.colorGroup!) ?? 0) + 1);
    }
    expect(Object.keys(COLOR_GROUPS)).toHaveLength(12);
    for (let g = 1; g <= 10; g += 1) {
      expect(groupCounts.get(g)).toBe(3);
    }
    expect(groupCounts.get(11)).toBe(2);
    expect(groupCounts.get(12)).toBe(2);

    const expensiveProps = properties.filter((t) => (t.basePrice ?? 0) >= EXPENSIVE_PROPERTY_THRESHOLD);
    expect(expensiveProps.length).toBeLessThanOrEqual(MAX_EXPENSIVE_PROPERTY_COUNT);
    expect(expensiveProps.length).toBe(6);

    // Mọi ô đất cùng Nhóm Màu (1..12) phải đứng liền thành 1 cụm liên tục trong danh sách ô đất (không bị nhóm màu khác xen vào giữa!)
    const seenFinishedGroups = new Set<number>();
    let currentGroup: number | undefined;
    for (const prop of properties) {
      if (prop.colorGroup !== currentGroup) {
        if (currentGroup !== undefined) {
          seenFinishedGroups.add(currentGroup);
        }
        expect(
          seenFinishedGroups.has(prop.colorGroup!),
          `Nhóm màu ${prop.colorGroup} bị xé lẻ xa nhau tại ô ${prop.index} (${prop.name})`,
        ).toBe(false);
        currentGroup = prop.colorGroup;
      }
    }
    expect(seenFinishedGroups.size + 1).toBe(12);
  });

  it('Cả 4 cạnh bàn cờ 17x11 phân bố đối xứng 10-7-10-7 ô đất với đúng 1 Bến Xe Đấu Giá mỗi cạnh', () => {
    const expectedLengths = [15, 9, 15, 9] as const;
    const expectedProps = [10, 7, 10, 7] as const;
    const expectedOwnables = [12, 8, 12, 8] as const;
    for (const edge of [0, 1, 2, 3] as const) {
      const edgeTiles = DEFAULT_BOARD_TILES.filter((t) => t.edge === edge);
      expect(edgeTiles).toHaveLength(expectedLengths[edge]);
      expect(edgeTiles.filter((t) => t.kind === 'PROPERTY')).toHaveLength(expectedProps[edge]);
      const ownable = edgeTiles.filter(isOwnableTile);
      expect(ownable).toHaveLength(expectedOwnables[edge]);
      const stations = edgeTiles.filter((t) => t.kind === 'AUCTION_STATION');
      expect(stations).toHaveLength(1);
    }
  });

  it('Đủ 8 nhân vật Chibi & 8 màu đất riêng biệt trong src/games/co-ty-phu/', () => {
    expect(CO_TY_PHU_CHARACTERS).toHaveLength(8);
    for (const char of CO_TY_PHU_CHARACTERS) {
      expect(char.name.length).toBeGreaterThan(2);
      expect(char.tagline.length).toBeGreaterThan(10);
      expect(char.standeeUrl.length).toBeGreaterThan(0);
      expect(char.avatarUrl.length).toBeGreaterThan(0);
    }

    expect(LAND_COLORS).toHaveLength(8);
    const hexes = new Set(LAND_COLORS.map((c) => c.hex));
    expect(hexes.size).toBe(8);
  });

  it('Toàn bộ 32 thẻ Cơ Hội & Khí Vận và 30 địa danh đều có ảnh minh họa hợp lệ', () => {
    expect(CHANCE_CARDS).toHaveLength(16);
    expect(FATE_CARDS).toHaveLength(16);
    for (const card of [...CHANCE_CARDS, ...FATE_CARDS]) {
      const art = getCardArtworkUrl(card.id);
      expect(art, `Thiếu ảnh thẻ ${card.id}`).toBeDefined();
      expect(art!.length).toBeGreaterThan(0);
    }

    const picturedTiles = DEFAULT_BOARD_TILES.filter(
      (t) =>
        t.kind === 'PROPERTY' ||
        t.kind === 'AUCTION_STATION' ||
        t.kind === 'UTILITY',
    );
    expect(picturedTiles).toHaveLength(40);
    const uniqueArtUrls = new Set<string>();
    for (const tile of picturedTiles) {
      const art = getLandmarkArtworkUrl(tile.name);
      expect(art, `Thiếu ảnh địa danh cho ${tile.name}`).toBeDefined();
      expect(art!.length).toBeGreaterThan(0);
      uniqueArtUrls.add(art!);
    }
    expect(uniqueArtUrls.size).toBe(40);

    // Góc 26 là Sân Bay Quốc Tế duy nhất; đúng 3 Cơ Hội (3,19,29) & 3 Khí Vận (12,40,49) xa góc; Thuế BĐS ở 14 (dưới) & Thuế Du Lịch ở 35 (trên)
    expect(DEFAULT_BOARD_TILES[26].kind).toBe('AIRPORT');
    expect(DEFAULT_BOARD_TILES[14].kind).toBe('TAX');
    expect(DEFAULT_BOARD_TILES[14].fixedTaxAmount).toBeUndefined();
    expect(DEFAULT_BOARD_TILES[35].kind).toBe('TAX');
    expect(DEFAULT_BOARD_TILES[35].fixedTaxAmount).toBe(500_000);
    expect(DEFAULT_BOARD_TILES.filter((t) => t.kind === 'CHANCE').map((t) => t.index)).toEqual([3, 19, 29]);
    expect(DEFAULT_BOARD_TILES.filter((t) => t.kind === 'FATE').map((t) => t.index)).toEqual([12, 40, 49]);
    // Cạnh trái (17..25) không còn Khí Vận; Cạnh phải (43..51) không còn Cơ Hội
    expect(DEFAULT_BOARD_TILES.filter((t) => t.edge === 1 && t.kind === 'FATE')).toHaveLength(0);
    expect(DEFAULT_BOARD_TILES.filter((t) => t.edge === 3 && t.kind === 'CHANCE')).toHaveLength(0);
  });
});
