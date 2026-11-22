import type { ComponentType } from 'react';

export type GameId =
  | 'co-ty-phu'
  | 'co-ca-ngua'
  | 'co-vua'
  | 'co-tuong'
  | 'o-an-quan';

export type GameStatus = 'READY' | 'COMING_SOON';

export interface GameComponentProps {
  /** Gọi hàm này để quay về Sảnh Chọn Game ngoài cùng */
  onExitToHub: () => void;
}

export interface GameCardVisualTheme {
  /** Gradient CSS cho viền ngoài thẻ UIverse */
  borderGradient: string;
  /** Màu quầng sáng (box-shadow) */
  glowColor: string;
  /** Màu nền kính mờ phía dưới thẻ */
  glassBackground: string;
  /** Màu thanh nhấn trang trí dưới tiêu đề */
  accentGradient: string;
  /** Gradient huy hiệu Sắp Ra Mắt / trạng thái */
  badgeGradient: string;
  /** Màu viền đáy 3D của huy hiệu */
  badgeLipColor: string;
  /** Chấm tròn phát sáng trong huy hiệu */
  badgeDotColor: string;
}

export interface IGameEntry {
  id: GameId;
  title: string;
  subtitle: string;
  playersBadge: string;
  tags: string[];
  /** Ảnh bìa import trực tiếp từ folder assets/ bên trong chính game đó */
  coverUrl: string;
  status: GameStatus;
  theme: GameCardVisualTheme;
  /** Lazy load mã nguồn game chỉ khi status === 'READY' */
  loader?: () => Promise<{ default: ComponentType<GameComponentProps> }>;
}
