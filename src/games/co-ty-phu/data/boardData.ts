import type { BoardTileDef, ColorGroupInfo, EdgeIndex } from '../engine/types';

/** 12 nhóm màu đất tông Retro Vivid nổi bật rõ ràng (10 nhóm 3 ô + 2 nhóm 2 ô: Bắc Trung Bộ & Đông Bắc Bộ) — KHÔNG gồm Nhà Máy / Bến Xe */
export const COLOR_GROUPS: Record<number, ColorGroupInfo> = {
  1: { id: 1, name: 'Núi Rừng Tây Bắc', tierName: 'Khởi điểm', hex: '#8B4513' },
  2: { id: 2, name: 'Duyên Hải Miền Trung', tierName: 'Khởi điểm', hex: '#0284C7' },
  3: { id: 3, name: 'Thủ Đô & Kinh Bắc', tierName: 'Phổ thông', hex: '#DB2777' },
  4: { id: 4, name: 'Cao Nguyên Đại Ngàn', tierName: 'Phổ thông', hex: '#EA580C' },
  5: { id: 5, name: 'Con Đường Di Sản', tierName: 'Du lịch', hex: '#DC2626' },
  6: { id: 6, name: 'Nghỉ Dưỡng Miền Đông', tierName: 'Du lịch', hex: '#D97706' },
  7: { id: 7, name: 'Thiên Đường Biển Đảo', tierName: 'Phát triển', hex: '#16A34A' },
  8: { id: 8, name: 'Sông Nước & Đảo Ngọc', tierName: 'Phát triển', hex: '#0F766E' },
  9: { id: 9, name: 'Kỳ Quan Bắc Bộ', tierName: 'Đất Vàng', hex: '#2563EB' },
  10: { id: 10, name: 'Đô Thị Nam Bộ', tierName: 'Đất Vàng', hex: '#9333EA' },
  11: { id: 11, name: 'Bắc Trung Bộ', tierName: 'Khởi điểm', hex: '#0D9488' },
  12: { id: 12, name: 'Đông Bắc Bộ', tierName: 'Phổ thông', hex: '#7C3AED' },
};

export const BOARD_COLS = 17;
export const BOARD_ROWS = 11;

/** Ngưỡng định nghĩa ô đất đắt (5 Tr – 6 Tr): tối đa 6 ô đất trên toàn bản đồ */
export const MAX_PROPERTY_PRICE = 6_000_000;
export const EXPENSIVE_PROPERTY_THRESHOLD = 5_000_000;
export const MAX_EXPENSIVE_PROPERTY_COUNT = 6;

/**
 * 18 ô khung đặc biệt cố định vị trí trên lưới chữ nhật chuẩn 17×11 (ĐỐI XỨNG 34 Ô ĐẤT 10–7–10–7):
 * - 4 góc: 0 (Khởi Hành / START), 16 (Trại Giam), 26 (Sân Bay Quốc Tế), 42 (Vô Tù)
 * - 4 Bến Xe Đấu Giá đối xứng mỗi cạnh 1 bến (độc lập, không thuộc nhóm màu đất): 6, 22, 32, 46
 * - 2 Nhà Máy Thủy Điện đối diện cạnh dưới/trên (độc lập, không thuộc nhóm màu đất): 9 (Trị An), 38 (Hòa Bình)
 * - 3 Cơ Hội (?) rải thoáng xa góc & xa nhau (bỏ ở cạnh phải): 3, 19, 29
 * - 3 Khí Vận (!) rải thoáng xa góc & xa nhau (bỏ ở cạnh trái): 12, 40, 49
 * - 2 Thuế đối xứng 2 cạnh ngang: 14 (Thuế Bất Động Sản -200 Nghìn cạnh dưới), 35 (Thuế Du Lịch -500 Nghìn cạnh trên)
 */
export const FIXED_SKELETON_INDICES = new Set<number>([
  0, 16, 26, 42,
  6, 22, 32, 46,
  9, 38,
  3, 19, 29,
  12, 40, 49,
  14, 35,
]);

/** 10 cụm vị trí 3 ô liền nhau cho 10 nhóm màu 3 ô (mỗi nhóm màu LUÔN đứng sát thành 1 cụm, không bao giờ bị xé lẻ hay trộn lẫn) */
export const COLOR_GROUP_3_CLUSTERS: readonly (readonly [number, number, number])[] = [
  [1, 2, 4], // Cụm 1 (Cạnh dưới - Khởi điểm)
  [5, 7, 8], // Cụm 2 (Cạnh dưới - Khởi điểm)
  [13, 15, 17], // Cụm 3 (Cuối cạnh dưới -> Đầu cạnh trái)
  [18, 20, 21], // Cụm 4 (Cạnh trái)
  [23, 24, 25], // Cụm 5 (Cạnh trái)
  [30, 31, 33], // Cụm 6 (Cạnh trên)
  [34, 36, 37], // Cụm 7 (Cạnh trên)
  [39, 41, 43], // Cụm 8 (Cuối cạnh trên -> Đầu cạnh phải)
  [44, 45, 47], // Cụm 9 (Cạnh phải - Đất Vàng)
  [48, 50, 51], // Cụm 10 (Cạnh phải - Đất Vàng)
];

/** 2 cụm vị trí 2 ô liền kề cho 2 nhóm màu 2 ô (Nhóm 11 Bắc Trung Bộ & Nhóm 12 Đông Bắc Bộ) */
export const COLOR_GROUP_2_CLUSTERS: readonly (readonly [number, number])[] = [
  [10, 11], // Cụm 2 ô Cạnh dưới
  [27, 28], // Cụm 2 ô Đầu cạnh trên
];

/** 10 vị trí ô đất cạnh dưới đầu tiên (luôn giữ giá khởi điểm nhẹ nhàng 1 Tr – 2,2 Tr, 0 ô đắt) */
export const STARTER_BOTTOM_PROPERTY_INDICES: readonly number[] = [1, 2, 4, 5, 7, 8, 10, 11, 13, 15];

/** 24 vị trí ô đất trên 3 cạnh còn lại (Trái: 7, Trên: 10, Phải: 7) */
export const INTERLEAVED_EDGE_PROPERTY_SLOTS: Record<1 | 2 | 3, readonly number[]> = {
  1: [17, 18, 20, 21, 23, 24, 25],
  2: [27, 28, 30, 31, 33, 34, 36, 37, 39, 41],
  3: [43, 44, 45, 47, 48, 50, 51],
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

/**
 * 52 Ô Bàn Cờ Chuẩn Cờ Tỷ Phú Cổ Điển:
 * Tất cả các ô cùng Nhóm Màu LUÔN đứng liền kề nhau thành từng cụm theo thứ tự giá tăng dần quanh bàn cờ —
 * TUYỆT ĐỐI KHÔNG xé lẻ hay trộn lẫn nhóm màu này vào giữa nhóm màu khác!
 */
const RAW_DEFAULT_TILES: RawTileSeed[] = [
  // Góc 0 + Cạnh Dưới (15 ô: 1..15 — Nhóm 1 [1,2,4] · Nhóm 2 [5,7,8] · Nhóm 11 [10,11] · Nhóm 3 [13,15,17])
  { index: 0, kind: 'GO', name: 'Khởi Hành (START)' },
  { index: 1, kind: 'PROPERTY', name: 'Mộc Châu', colorGroup: 1, basePrice: 1_000_000 },
  { index: 2, kind: 'PROPERTY', name: 'Hà Giang', colorGroup: 1, basePrice: 1_200_000 },
  { index: 3, kind: 'CHANCE', name: 'Cơ Hội 1' },
  { index: 4, kind: 'PROPERTY', name: 'Sa Pa', colorGroup: 1, basePrice: 1_400_000 },
  { index: 5, kind: 'PROPERTY', name: 'Lý Sơn', colorGroup: 2, basePrice: 1_400_000 },
  { index: 6, kind: 'AUCTION_STATION', name: 'Bến Xe Miền Tây' },
  { index: 7, kind: 'PROPERTY', name: 'Vĩnh Hy', colorGroup: 2, basePrice: 1_600_000 },
  { index: 8, kind: 'PROPERTY', name: 'Phú Yên', colorGroup: 2, basePrice: 1_800_000 },
  { index: 9, kind: 'UTILITY', name: 'Thủy Điện Trị An', basePrice: 2_000_000 },
  { index: 10, kind: 'PROPERTY', name: 'Thanh Hóa', colorGroup: 11, basePrice: 1_600_000 },
  { index: 11, kind: 'PROPERTY', name: 'Nghệ An', colorGroup: 11, basePrice: 1_800_000 },
  { index: 12, kind: 'FATE', name: 'Khí Vận 1' },
  { index: 13, kind: 'PROPERTY', name: 'Bắc Ninh', colorGroup: 3, basePrice: 1_800_000 },
  { index: 14, kind: 'TAX', name: 'Thuế Bất Động Sản' },
  { index: 15, kind: 'PROPERTY', name: 'Hà Nội', colorGroup: 3, basePrice: 2_200_000 },

  // Góc 16 + Cạnh Trái (9 ô: 17..25 — Nhóm 3 [17] · Nhóm 4 Tây Nguyên [18,20,21] · Nhóm 5 Di Sản [23,24,25])
  { index: 16, kind: 'VISIT_JAIL', name: 'Trại Giam / Thăm Nuôi' },
  { index: 17, kind: 'PROPERTY', name: 'Ba Vì', colorGroup: 3, basePrice: 2_000_000 },
  { index: 18, kind: 'PROPERTY', name: 'Kon Tum', colorGroup: 4, basePrice: 2_000_000 },
  { index: 19, kind: 'CHANCE', name: 'Cơ Hội 2' },
  { index: 20, kind: 'PROPERTY', name: 'Buôn Ma Thuột', colorGroup: 4, basePrice: 2_200_000 },
  { index: 21, kind: 'PROPERTY', name: 'Đà Lạt', colorGroup: 4, basePrice: 2_600_000 },
  { index: 22, kind: 'AUCTION_STATION', name: 'Bến Xe Phương Trang' },
  { index: 23, kind: 'PROPERTY', name: 'Quảng Bình', colorGroup: 5, basePrice: 2_600_000 },
  { index: 24, kind: 'PROPERTY', name: 'Cố Đô Huế', colorGroup: 5, basePrice: 3_000_000 },
  { index: 25, kind: 'PROPERTY', name: 'Hội An', colorGroup: 5, basePrice: 3_400_000 },

  // Góc 26 + Cạnh Trên (15 ô: 27..41 — Nhóm 12 Đông Bắc [27,28] · Nhóm 6 Nghỉ Dưỡng [30,31,33] · Nhóm 7 Biển Đảo [34,36,37] · Nhóm 8 [39,41,43])
  { index: 26, kind: 'AIRPORT', name: 'Sân Bay Quốc Tế' },
  { index: 27, kind: 'PROPERTY', name: 'Cao Bằng', colorGroup: 12, basePrice: 2_200_000 },
  { index: 28, kind: 'PROPERTY', name: 'Lạng Sơn', colorGroup: 12, basePrice: 2_600_000 },
  { index: 29, kind: 'CHANCE', name: 'Cơ Hội 3' },
  { index: 30, kind: 'PROPERTY', name: 'Phan Thiết', colorGroup: 6, basePrice: 3_000_000 },
  { index: 31, kind: 'PROPERTY', name: 'Vũng Tàu', colorGroup: 6, basePrice: 3_400_000 },
  { index: 32, kind: 'AUCTION_STATION', name: 'Bến Xe Miền Đông' },
  { index: 33, kind: 'PROPERTY', name: 'Côn Đảo', colorGroup: 6, basePrice: 3_800_000 },
  { index: 34, kind: 'PROPERTY', name: 'Quy Nhơn', colorGroup: 7, basePrice: 3_800_000 },
  { index: 35, kind: 'TAX', name: 'Thuế Du Lịch', fixedTaxAmount: 500_000 },
  { index: 36, kind: 'PROPERTY', name: 'Nha Trang', colorGroup: 7, basePrice: 4_000_000 },
  { index: 37, kind: 'PROPERTY', name: 'Đà Nẵng', colorGroup: 7, basePrice: 4_400_000 },
  { index: 38, kind: 'UTILITY', name: 'Thủy Điện Hòa Bình', basePrice: 2_000_000 },
  { index: 39, kind: 'PROPERTY', name: 'Mỹ Tho', colorGroup: 8, basePrice: 3_800_000 },
  { index: 40, kind: 'FATE', name: 'Khí Vận 2' },
  { index: 41, kind: 'PROPERTY', name: 'Cần Thơ', colorGroup: 8, basePrice: 4_200_000 },

  // Góc 42 + Cạnh Phải (9 ô: 43..51 — Nhóm 8 [43] · Nhóm 9 Kỳ Quan Bắc Bộ [44,45,47] · Nhóm 10 Đô Thị Nam Bộ [48,50,51])
  { index: 42, kind: 'GO_TO_JAIL', name: 'Bị Bắt Vào Tù' },
  { index: 43, kind: 'PROPERTY', name: 'Phú Quốc', colorGroup: 8, basePrice: 4_400_000 },
  { index: 44, kind: 'PROPERTY', name: 'Cát Bà', colorGroup: 9, basePrice: 5_000_000 },
  { index: 45, kind: 'PROPERTY', name: 'Ninh Bình', colorGroup: 9, basePrice: 5_200_000 },
  { index: 46, kind: 'AUCTION_STATION', name: 'Bến Xe Giáp Bát' },
  { index: 47, kind: 'PROPERTY', name: 'Vịnh Hạ Long', colorGroup: 9, basePrice: 5_400_000 },
  { index: 48, kind: 'PROPERTY', name: 'Đồng Nai', colorGroup: 10, basePrice: 5_600_000 },
  { index: 49, kind: 'FATE', name: 'Khí Vận 3' },
  { index: 50, kind: 'PROPERTY', name: 'Bình Dương', colorGroup: 10, basePrice: 5_800_000 },
  { index: 51, kind: 'PROPERTY', name: 'Sài Gòn', colorGroup: 10, basePrice: 6_000_000 },
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
