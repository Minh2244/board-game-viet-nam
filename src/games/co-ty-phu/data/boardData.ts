import type { BoardTileDef, ColorGroupInfo, EdgeIndex } from '../engine/types';

/** 11 nhóm màu đất tông Retro Vivid cổ điển (10 nhóm 3 ô + 1 nhóm 2 ô Bắc Trung Bộ) — KHÔNG gồm Nhà Máy / Bến Xe */
export const COLOR_GROUPS: Record<number, ColorGroupInfo> = {
  1: { id: 1, name: 'Núi Rừng Tây Bắc', tierName: 'Khởi điểm', hex: '#7E4727' },
  2: { id: 2, name: 'Duyên Hải Miền Trung', tierName: 'Khởi điểm', hex: '#1A6E96' },
  3: { id: 3, name: 'Thủ Đô & Kinh Bắc', tierName: 'Phổ thông', hex: '#A83260' },
  4: { id: 4, name: 'Cao Nguyên Đại Ngàn', tierName: 'Phổ thông', hex: '#C25927' },
  5: { id: 5, name: 'Con Đường Di Sản', tierName: 'Du lịch', hex: '#B02A2A' },
  6: { id: 6, name: 'Nghỉ Dưỡng Miền Đông', tierName: 'Du lịch', hex: '#B87E1E' },
  7: { id: 7, name: 'Thiên Đường Biển Đảo', tierName: 'Phát triển', hex: '#1F7A49' },
  8: { id: 8, name: 'Sông Nước & Đảo Ngọc', tierName: 'Phát triển', hex: '#156A65' },
  9: { id: 9, name: 'Kỳ Quan Bắc Bộ', tierName: 'Đất Vàng', hex: '#264E94' },
  10: { id: 10, name: 'Đô Thị Nam Bộ', tierName: 'Đất Vàng', hex: '#5D3694' },
  11: { id: 11, name: 'Bắc Trung Bộ', tierName: 'Khởi điểm', hex: '#0E7490' },
};

export const BOARD_COLS = 17;
export const BOARD_ROWS = 11;

/** Ngưỡng định nghĩa ô đất đắt (5 Tr – 6 Tr): tối đa 6 ô đất trên toàn bản đồ */
export const MAX_PROPERTY_PRICE = 6_000_000;
export const EXPENSIVE_PROPERTY_THRESHOLD = 5_000_000;
export const MAX_EXPENSIVE_PROPERTY_COUNT = 6;

/**
 * 20 ô khung đặc biệt cố định vị trí trên lưới chữ nhật chuẩn 17×11 (ĐÃ BỎ HẾT Ô DI SẢN + TIỀN):
 * - 4 góc: 0 (Khởi Hành), 16 (Trại Giam), 26 (Sân Bay Quốc Tế), 42 (Vô Tù)
 * - 4 Bến Xe Đấu Giá đối xứng mỗi cạnh 1 bến (độc lập, không thuộc nhóm màu đất): 5, 21, 31, 47
 * - 2 Nhà Máy Thủy Điện đối diện cạnh dưới/trên (độc lập, không thuộc nhóm màu đất): 6 (Trị An), 33 (Hòa Bình)
 * - 4 Cơ Hội (?) đẩy sát đầu khởi điểm từng cạnh: 1, 17, 27, 43
 * - 4 Khí Vận (!) đẩy sát cuối đối lập từng cạnh (cách xa Cơ Hội 8–14 ô): 15, 25, 40, 51
 * - 2 Thuế: 32 (Thuế Du Lịch -500 Nghìn), 41 (Thuế Bất Động Sản)
 */
export const FIXED_SKELETON_INDICES = new Set<number>([
  0, 16, 26, 42,
  5, 21, 31, 47,
  6, 33,
  1, 17, 27, 43,
  15, 25, 40, 51,
  32, 41,
]);

/** 11 vị trí ô đất cạnh dưới đầu tiên (luôn giữ giá khởi điểm nhẹ nhàng 1 Tr – 2,2 Tr, 0 ô đắt) */
export const STARTER_BOTTOM_PROPERTY_INDICES: readonly number[] = [2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14];

/** 21 vị trí ô đất trên 3 cạnh còn lại (Trái, Trên, Phải) — luôn bố trí xen kẽ Đắt (5–6 Tr) với Vừa/Rẻ */
export const INTERLEAVED_EDGE_PROPERTY_SLOTS: Record<1 | 2 | 3, readonly number[]> = {
  1: [18, 19, 20, 22, 23, 24],
  2: [28, 29, 30, 34, 35, 36, 37, 38, 39],
  3: [44, 45, 46, 48, 49, 50],
};

/** Quy đổi chỉ số ô 0..51 thuận chiều kim đồng hồ trên lưới chữ nhật 17×11 (15 trên/dưới, 9 trái/phải + 4 góc) */
export function computeGridPos(index: number): { col: number; row: number; edge: EdgeIndex | null } {
  if (index === 0) return { col: 16, row: 10, edge: null };
  if (index < 16) return { col: 16 - index, row: 10, edge: 0 };
  if (index === 16) return { col: 0, row: 10, edge: null };
  if (index < 26) return { col: 0, row: 10 - (index - 16), edge: 1 };
  if (index === 26) return { col: 0, row: 0, edge: null };
  if (index < 42) return { col: index - 26, row: 0, edge: 2 };
  if (index === 42) return { col: 16, row: 0, edge: null };
  return { col: 16, row: index - 42, edge: 3 };
}

type RawTileSeed = Omit<BoardTileDef, 'edge' | 'gridPos'>;

const RAW_DEFAULT_TILES: RawTileSeed[] = [
  // Góc 0 + Cạnh Dưới (15 ô: 1..15 — 11 ô đất khởi điểm 1 Tr – 2,2 Tr, 0 ô đắt, đã thay 2 ô Di Sản bằng Thanh Hóa & Nghệ An)
  { index: 0, kind: 'GO', name: 'Khởi Hành (Bắt Đầu)' },
  { index: 1, kind: 'CHANCE', name: 'Cơ Hội 1' },
  { index: 2, kind: 'PROPERTY', name: 'Mộc Châu', colorGroup: 1, basePrice: 1_000_000 },
  { index: 3, kind: 'PROPERTY', name: 'Hà Giang', colorGroup: 1, basePrice: 1_200_000 },
  { index: 4, kind: 'PROPERTY', name: 'Sa Pa', colorGroup: 1, basePrice: 1_400_000 },
  { index: 5, kind: 'AUCTION_STATION', name: 'Bến Xe Miền Tây' },
  { index: 6, kind: 'UTILITY', name: 'Thủy Điện Trị An', basePrice: 2_000_000 },
  { index: 7, kind: 'PROPERTY', name: 'Lý Sơn', colorGroup: 2, basePrice: 1_400_000 },
  { index: 8, kind: 'PROPERTY', name: 'Vĩnh Hy', colorGroup: 2, basePrice: 1_600_000 },
  { index: 9, kind: 'PROPERTY', name: 'Phú Yên', colorGroup: 2, basePrice: 1_800_000 },
  { index: 10, kind: 'PROPERTY', name: 'Thanh Hóa', colorGroup: 11, basePrice: 1_600_000 },
  { index: 11, kind: 'PROPERTY', name: 'Nghệ An', colorGroup: 11, basePrice: 1_800_000 },
  { index: 12, kind: 'PROPERTY', name: 'Bắc Ninh', colorGroup: 3, basePrice: 1_800_000 },
  { index: 13, kind: 'PROPERTY', name: 'Ba Vì', colorGroup: 3, basePrice: 2_000_000 },
  { index: 14, kind: 'PROPERTY', name: 'Hà Nội', colorGroup: 3, basePrice: 2_200_000 },
  { index: 15, kind: 'FATE', name: 'Khí Vận 1' },

  // Góc 16 + Cạnh Trái (9 ô: 17..25 — Xen kẽ 2 ô Đắt: Cát Bà 5 Tr & Đồng Nai 5,6 Tr)
  { index: 16, kind: 'VISIT_JAIL', name: 'Trại Giam / Thăm Nuôi' },
  { index: 17, kind: 'CHANCE', name: 'Cơ Hội 2' },
  { index: 18, kind: 'PROPERTY', name: 'Kon Tum', colorGroup: 4, basePrice: 2_000_000 },
  { index: 19, kind: 'PROPERTY', name: 'Cát Bà', colorGroup: 9, basePrice: 5_000_000 },
  { index: 20, kind: 'PROPERTY', name: 'Quảng Bình', colorGroup: 5, basePrice: 2_600_000 },
  { index: 21, kind: 'AUCTION_STATION', name: 'Bến Xe Phương Trang' },
  { index: 22, kind: 'PROPERTY', name: 'Phan Thiết', colorGroup: 6, basePrice: 3_000_000 },
  { index: 23, kind: 'PROPERTY', name: 'Đồng Nai', colorGroup: 10, basePrice: 5_600_000 },
  { index: 24, kind: 'PROPERTY', name: 'Mỹ Tho', colorGroup: 8, basePrice: 3_800_000 },
  { index: 25, kind: 'FATE', name: 'Khí Vận 2' },

  // Góc 26 + Cạnh Trên (15 ô: 27..41 — Xen kẽ 2 ô Đắt: Ninh Bình 5,2 Tr & Bình Dương 5,8 Tr)
  { index: 26, kind: 'AIRPORT', name: 'Sân Bay Quốc Tế' },
  { index: 27, kind: 'CHANCE', name: 'Cơ Hội 3' },
  { index: 28, kind: 'PROPERTY', name: 'Buôn Ma Thuột', colorGroup: 4, basePrice: 2_200_000 },
  { index: 29, kind: 'PROPERTY', name: 'Cố Đô Huế', colorGroup: 5, basePrice: 3_000_000 },
  { index: 30, kind: 'PROPERTY', name: 'Ninh Bình', colorGroup: 9, basePrice: 5_200_000 },
  { index: 31, kind: 'AUCTION_STATION', name: 'Bến Xe Miền Đông' },
  { index: 32, kind: 'TAX', name: 'Thuế Du Lịch', fixedTaxAmount: 500_000 },
  { index: 33, kind: 'UTILITY', name: 'Thủy Điện Hòa Bình', basePrice: 2_000_000 },
  { index: 34, kind: 'PROPERTY', name: 'Vũng Tàu', colorGroup: 6, basePrice: 3_400_000 },
  { index: 35, kind: 'PROPERTY', name: 'Quy Nhơn', colorGroup: 7, basePrice: 3_800_000 },
  { index: 36, kind: 'PROPERTY', name: 'Bình Dương', colorGroup: 10, basePrice: 5_800_000 },
  { index: 37, kind: 'PROPERTY', name: 'Đà Lạt', colorGroup: 4, basePrice: 2_600_000 },
  { index: 38, kind: 'PROPERTY', name: 'Cần Thơ', colorGroup: 8, basePrice: 4_200_000 },
  { index: 39, kind: 'PROPERTY', name: 'Nha Trang', colorGroup: 7, basePrice: 4_000_000 },
  { index: 40, kind: 'FATE', name: 'Khí Vận 3' },
  { index: 41, kind: 'TAX', name: 'Thuế Bất Động Sản' },

  // Góc 42 + Cạnh Phải (9 ô: 43..51 — Xen kẽ 2 ô Đắt: Vịnh Hạ Long 5,4 Tr & Sài Gòn 6 Tr)
  { index: 42, kind: 'GO_TO_JAIL', name: 'Bị Bắt Vào Tù' },
  { index: 43, kind: 'CHANCE', name: 'Cơ Hội 4' },
  { index: 44, kind: 'PROPERTY', name: 'Hội An', colorGroup: 5, basePrice: 3_400_000 },
  { index: 45, kind: 'PROPERTY', name: 'Vịnh Hạ Long', colorGroup: 9, basePrice: 5_400_000 },
  { index: 46, kind: 'PROPERTY', name: 'Côn Đảo', colorGroup: 6, basePrice: 3_800_000 },
  { index: 47, kind: 'AUCTION_STATION', name: 'Bến Xe Giáp Bát' },
  { index: 48, kind: 'PROPERTY', name: 'Đà Nẵng', colorGroup: 7, basePrice: 4_400_000 },
  { index: 49, kind: 'PROPERTY', name: 'Phú Quốc', colorGroup: 8, basePrice: 4_400_000 },
  { index: 50, kind: 'PROPERTY', name: 'Sài Gòn', colorGroup: 10, basePrice: 6_000_000 },
  { index: 51, kind: 'FATE', name: 'Khí Vận 4' },
];

export const DEFAULT_BOARD_TILES: readonly BoardTileDef[] = RAW_DEFAULT_TILES.map((tile) => {
  const { col, row, edge } = computeGridPos(tile.index);
  return {
    ...tile,
    edge,
    gridPos: { col, row },
  };
});

export function isOwnableTile(tile: BoardTileDef): boolean {
  return tile.kind === 'PROPERTY' || tile.kind === 'AUCTION_STATION' || tile.kind === 'UTILITY';
}
