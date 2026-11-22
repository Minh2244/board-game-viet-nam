import bgWarmWood from './assets/bg_warm_wood.webp';

export type HubThemeId = 'wood' | 'mint' | 'sunset' | 'neon';

export interface HubThemeConfig {
  id: HubThemeId;
  label: string;
  swatchGradient: string;
  /** Lớp nền sử dụng ảnh Gỗ Nắng Ấm hoặc gradient CSS bổ sung */
  isPrimaryWood: boolean;
  overlayTint: string;
  titleTextColor: string;
  subtitleTint: string;
  comingSoonInV1?: boolean;
}

export const HUB_THEMES: Record<HubThemeId, HubThemeConfig> = {
  wood: {
    id: 'wood',
    label: 'Gỗ Nắng Ấm',
    swatchGradient: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)',
    isPrimaryWood: true,
    overlayTint: 'radial-gradient(circle at 50% 42%, rgba(255, 244, 214, 0.10) 0%, rgba(36, 20, 8, 0.24) 100%)',
    titleTextColor: '#FFFFFF',
    subtitleTint: 'rgba(255, 248, 232, 0.92)',
  },
  mint: {
    id: 'mint',
    label: 'Bạc Hà (Xem thử)',
    swatchGradient: 'linear-gradient(135deg, #34D399 0%, #06B6D4 100%)',
    isPrimaryWood: false,
    overlayTint: 'linear-gradient(135deg, rgba(16, 185, 129, 0.56) 0%, rgba(14, 165, 233, 0.62) 100%)',
    titleTextColor: '#FFFFFF',
    subtitleTint: '#ECFEFF',
    comingSoonInV1: true,
  },
  sunset: {
    id: 'sunset',
    label: 'Hoàng Hôn (Xem thử)',
    swatchGradient: 'linear-gradient(135deg, #FB7185 0%, #F97316 100%)',
    isPrimaryWood: false,
    overlayTint: 'linear-gradient(135deg, rgba(244, 63, 94, 0.54) 0%, rgba(245, 158, 11, 0.58) 100%)',
    titleTextColor: '#FFFFFF',
    subtitleTint: '#FFF1F2',
    comingSoonInV1: true,
  },
  neon: {
    id: 'neon',
    label: 'Neon Đêm (Xem thử)',
    swatchGradient: 'linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)',
    isPrimaryWood: false,
    overlayTint: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 27, 75, 0.86) 100%)',
    titleTextColor: '#FFFFFF',
    subtitleTint: '#E0E7FF',
    comingSoonInV1: true,
  },
};

export const HUB_BG_WARM_WOOD_URL = bgWarmWood;
