import type { HorseColor } from './types';

export interface GridCoord {
  col: number; // 0..14
  row: number; // 0..14
}

export interface HorseColorVisual {
  color: HorseColor;
  nameVi: string;
  shortName: string;
  main: string;
  bright: string;
  light: string;
  dark: string;
  soft: string;
  /** Chỉ số ô Xuất Phát trên vòng đua 52 ô (0..51) */
  startTrackIndex: number;
  /** Chỉ số Ô An Toàn (Ô Lên Bụt / Cửa Chuồng) trên vòng đua 52 ô */
  safeDoorTrackIndex: number;
  /** Góc trên-trái của Chuồng 6×6 trên lưới 15×15 */
  stableOrigin: GridCoord;
  /** 4 tọa độ đặt ngựa trong chuồng (hệ tọa độ lưới float 0..15) */
  stableSlots: readonly [GridCoord, GridCoord, GridCoord, GridCoord];
  /** 6 tọa độ cầu thang bụt đánh số 1 → 6 */
  stairCoords: readonly [GridCoord, GridCoord, GridCoord, GridCoord, GridCoord, GridCoord];
}

export const TRACK_LENGTH = 52;
export const SAFE_DOOR_PROGRESS = 51;
export const WINNING_STAIR_STEPS = [3, 4, 5, 6] as const;

/** Thứ tự vòng xoay chuẩn theo chiều kim đồng hồ trên bàn cờ giấy truyền thống Việt Nam */
export const CLOCKWISE_COLORS: readonly HorseColor[] = ['red', 'yellow', 'blue', 'green'] as const;

/**
 * 52 tọa độ ô đường đua tròn theo chiều kim đồng hồ trên lưới chuẩn 15×15:
 * - 0..11: 12 ô ôm chuồng Đỏ (0 = Đỏ Xuất phát)
 * - 12: ★ Ô An Toàn Lên Bụt Vàng
 * - 13..24: 12 ô ôm chuồng Vàng (13 = Vàng Xuất phát)
 * - 25: ★ Ô An Toàn Lên Bụt Xanh Dương
 * - 26..37: 12 ô ôm chuồng Xanh Dương (26 = Xanh Dương Xuất phát)
 * - 38: ★ Ô An Toàn Lên Bụt Xanh Lá
 * - 39..50: 12 ô ôm chuồng Xanh Lá (39 = Xanh Lá Xuất phát)
 * - 51: ★ Ô An Toàn Lên Bụt Đỏ
 */
export const TRACK_GRID_COORDS: readonly GridCoord[] = [
  // Góc Đỏ (0..11) + Cửa Vàng (12)
  { col: 0, row: 6 },
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 5 },
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 },
  { col: 6, row: 1 },
  { col: 6, row: 0 },
  { col: 7, row: 0 }, // 12: Safe Door Yellow

  // Góc Vàng (13..24) + Cửa Xanh Dương (25)
  { col: 8, row: 0 },
  { col: 8, row: 1 },
  { col: 8, row: 2 },
  { col: 8, row: 3 },
  { col: 8, row: 4 },
  { col: 8, row: 5 },
  { col: 9, row: 6 },
  { col: 10, row: 6 },
  { col: 11, row: 6 },
  { col: 12, row: 6 },
  { col: 13, row: 6 },
  { col: 14, row: 6 },
  { col: 14, row: 7 }, // 25: Safe Door Blue

  // Góc Xanh Dương (26..37) + Cửa Xanh Lá (38)
  { col: 14, row: 8 },
  { col: 13, row: 8 },
  { col: 12, row: 8 },
  { col: 11, row: 8 },
  { col: 10, row: 8 },
  { col: 9, row: 8 },
  { col: 8, row: 9 },
  { col: 8, row: 10 },
  { col: 8, row: 11 },
  { col: 8, row: 12 },
  { col: 8, row: 13 },
  { col: 8, row: 14 },
  { col: 7, row: 14 }, // 38: Safe Door Green

  // Góc Xanh Lá (39..50) + Cửa Đỏ (51)
  { col: 6, row: 14 },
  { col: 6, row: 13 },
  { col: 6, row: 12 },
  { col: 6, row: 11 },
  { col: 6, row: 10 },
  { col: 6, row: 9 },
  { col: 5, row: 8 },
  { col: 4, row: 8 },
  { col: 3, row: 8 },
  { col: 2, row: 8 },
  { col: 1, row: 8 },
  { col: 0, row: 8 },
  { col: 0, row: 7 }, // 51: Safe Door Red
] as const;

export const HORSE_COLOR_CONFIG: Record<HorseColor, HorseColorVisual> = {
  red: {
    color: 'red',
    nameVi: 'Đỏ',
    shortName: 'Đỏ',
    main: '#DC2626',
    bright: '#EF4444',
    light: '#FCA5A5',
    dark: '#991B1B',
    soft: '#FEF2F2',
    startTrackIndex: 0,
    safeDoorTrackIndex: 51,
    stableOrigin: { col: 0, row: 0 },
    stableSlots: [
      { col: 1.5, row: 1.7 },
      { col: 3.5, row: 1.7 },
      { col: 1.5, row: 3.7 },
      { col: 3.5, row: 3.7 },
    ],
    stairCoords: [
      { col: 1, row: 7 },
      { col: 2, row: 7 },
      { col: 3, row: 7 },
      { col: 4, row: 7 },
      { col: 5, row: 7 },
      { col: 6, row: 7 },
    ],
  },
  yellow: {
    color: 'yellow',
    nameVi: 'Vàng',
    shortName: 'Vàng',
    main: '#EA8C00',
    bright: '#F59E0B',
    light: '#FDE68A',
    dark: '#B45309',
    soft: '#FFFBEB',
    startTrackIndex: 13,
    safeDoorTrackIndex: 12,
    stableOrigin: { col: 9, row: 0 },
    stableSlots: [
      { col: 10.5, row: 1.7 },
      { col: 12.5, row: 1.7 },
      { col: 10.5, row: 3.7 },
      { col: 12.5, row: 3.7 },
    ],
    stairCoords: [
      { col: 7, row: 1 },
      { col: 7, row: 2 },
      { col: 7, row: 3 },
      { col: 7, row: 4 },
      { col: 7, row: 5 },
      { col: 7, row: 6 },
    ],
  },
  blue: {
    color: 'blue',
    nameVi: 'Xanh Dương',
    shortName: 'X.Dương',
    main: '#1D4ED8',
    bright: '#2563EB',
    light: '#93C5FD',
    dark: '#1E3A8A',
    soft: '#EFF6FF',
    startTrackIndex: 26,
    safeDoorTrackIndex: 25,
    stableOrigin: { col: 9, row: 9 },
    stableSlots: [
      { col: 10.5, row: 10.7 },
      { col: 12.5, row: 10.7 },
      { col: 10.5, row: 12.7 },
      { col: 12.5, row: 12.7 },
    ],
    stairCoords: [
      { col: 13, row: 7 },
      { col: 12, row: 7 },
      { col: 11, row: 7 },
      { col: 10, row: 7 },
      { col: 9, row: 7 },
      { col: 8, row: 7 },
    ],
  },
  green: {
    color: 'green',
    nameVi: 'Xanh Lá',
    shortName: 'X.Lá',
    main: '#15803D',
    bright: '#16A34A',
    light: '#86EFAC',
    dark: '#14532D',
    soft: '#F0FDF4',
    startTrackIndex: 39,
    safeDoorTrackIndex: 38,
    stableOrigin: { col: 0, row: 9 },
    stableSlots: [
      { col: 1.5, row: 10.7 },
      { col: 3.5, row: 10.7 },
      { col: 1.5, row: 12.7 },
      { col: 3.5, row: 12.7 },
    ],
    stairCoords: [
      { col: 7, row: 13 },
      { col: 7, row: 12 },
      { col: 7, row: 11 },
      { col: 7, row: 10 },
      { col: 7, row: 9 },
      { col: 7, row: 8 },
    ],
  },
};

export const SAFE_DOOR_TRACK_INDICES = new Set<number>([51, 12, 25, 38]);

/** Trả về màu viền chuẩn cho từng ô trong 52 ô đường đua (ôm tròn 4 góc chuồng giống bàn giấy VN) */
export function getTrackIndexRingColor(trackIndex: number): HorseColor {
  if (trackIndex === 51) return 'red';
  if (trackIndex === 12) return 'yellow';
  if (trackIndex === 25) return 'blue';
  if (trackIndex === 38) return 'green';
  if (trackIndex >= 0 && trackIndex <= 11) return 'red';
  if (trackIndex >= 13 && trackIndex <= 24) return 'yellow';
  if (trackIndex >= 26 && trackIndex <= 37) return 'blue';
  return 'green';
}

export function isStartTrackIndex(trackIndex: number): HorseColor | null {
  if (trackIndex === 0) return 'red';
  if (trackIndex === 13) return 'yellow';
  if (trackIndex === 26) return 'blue';
  if (trackIndex === 39) return 'green';
  return null;
}

export function isSafeDoorTrackIndex(trackIndex: number): HorseColor | null {
  if (trackIndex === 51) return 'red';
  if (trackIndex === 12) return 'yellow';
  if (trackIndex === 25) return 'blue';
  if (trackIndex === 38) return 'green';
  return null;
}

export function progressToTrackIndex(color: HorseColor, progress: number): number {
  const start = HORSE_COLOR_CONFIG[color].startTrackIndex;
  return (start + progress) % TRACK_LENGTH;
}

/** Chọn bộ màu cân xứng mặc định cho 2–4 người chơi (2 người tự ngồi chéo góc đối xứng!) */
export function getBalancedColorsForPlayerCount(
  count: 2 | 3 | 4,
  preferredFirstColor: HorseColor = 'red',
): HorseColor[] {
  const idx = CLOCKWISE_COLORS.indexOf(preferredFirstColor);
  const rotated = [
    CLOCKWISE_COLORS[idx],
    CLOCKWISE_COLORS[(idx + 1) % 4],
    CLOCKWISE_COLORS[(idx + 2) % 4],
    CLOCKWISE_COLORS[(idx + 3) % 4],
  ];
  if (count === 2) {
    // 2 người ngồi chéo góc đối xứng nhau 180° (cách nhau đúng 26 ô mỗi chiều)
    return [rotated[0], rotated[2]];
  }
  if (count === 3) {
    return [rotated[0], rotated[1], rotated[2]];
  }
  return rotated;
}
