import type { IGameEntry } from '@/shared/types/gameEntry';

import coverCoTyPhu from './co-ty-phu/assets/cover.webp';
import coverCoCaNgua from './co-ca-ngua/assets/cover.webp';
import coverCoVua from './co-vua/assets/cover.webp';
import coverCoTuong from './co-tuong/assets/cover.webp';
import coverOAnQuan from './o-an-quan/assets/cover.webp';

export const GAME_CATALOG: readonly IGameEntry[] = [
  {
    id: 'co-ty-phu',
    title: 'CỜ TỶ PHÚ 3D',
    subtitle: '52 Ô 14×14 · Đấu giá Bến xe · 3 điều kiện thắng',
    playersBadge: '2–6 Người / Máy',
    tags: ['3D', 'Đấu Bot AI', 'Chung 1 Máy', '52 Ô'],
    coverUrl: coverCoTyPhu,
    status: 'READY',
    theme: {
      borderGradient: 'linear-gradient(135deg, #34F5A8 0%, #22D3EE 52%, #FDE047 100%)',
      glowColor: 'rgba(16, 185, 129, 0.55)',
      glassBackground: 'linear-gradient(180deg, rgba(17, 74, 67, 0.94) 0%, rgba(8, 39, 36, 0.96) 100%)',
      accentGradient: 'linear-gradient(90deg, #34F5A8 0%, #FDE047 100%)',
      badgeGradient: 'linear-gradient(135deg, #34F5A8 0%, #10B981 52%, #06B6D4 100%)',
      badgeLipColor: '#047857',
      badgeDotColor: '#A7F3D0',
    },
    loader: () => import('./co-ty-phu'),
  },
  {
    id: 'co-ca-ngua',
    title: 'CỜ CÁ NGỰA',
    subtitle: 'Đổ xúc xắc tung vó về chuồng 4 sắc màu cổ điển',
    playersBadge: '2–4 Người',
    tags: ['Dân gian', 'Xúc xắc', 'Sắp ra mắt'],
    coverUrl: coverCoCaNgua,
    status: 'COMING_SOON',
    theme: {
      borderGradient: 'linear-gradient(135deg, #FF6B4A 0%, #FBBF24 100%)',
      glowColor: 'rgba(249, 115, 22, 0.42)',
      glassBackground: 'linear-gradient(180deg, rgba(75, 31, 22, 0.92) 0%, rgba(42, 15, 10, 0.95) 100%)',
      accentGradient: 'linear-gradient(90deg, #FF6B4A 0%, #FBBF24 100%)',
      badgeGradient: 'linear-gradient(135deg, #FF6B4A 0%, #F59E0B 100%)',
      badgeLipColor: '#9A3412',
      badgeDotColor: '#FDE68A',
    },
  },
  {
    id: 'co-vua',
    title: 'CỜ VUA',
    subtitle: 'Đấu trí 64 ô đen trắng cổ điển chuẩn quốc tế',
    playersBadge: '2 Người',
    tags: ['Trí tuệ', 'Đen Trắng', 'Sắp ra mắt'],
    coverUrl: coverCoVua,
    status: 'COMING_SOON',
    theme: {
      borderGradient: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)',
      glowColor: 'rgba(59, 130, 246, 0.42)',
      glassBackground: 'linear-gradient(180deg, rgba(26, 41, 86, 0.92) 0%, rgba(14, 22, 51, 0.95) 100%)',
      accentGradient: 'linear-gradient(90deg, #38BDF8 0%, #818CF8 100%)',
      badgeGradient: 'linear-gradient(135deg, #38BDF8 0%, #6366F1 100%)',
      badgeLipColor: '#312E81',
      badgeDotColor: '#BAE6FD',
    },
  },
  {
    id: 'co-tuong',
    title: 'CỜ TƯỚNG',
    subtitle: 'Bàn cờ gỗ truyền thống Á Đông đối kháng trí tuệ',
    playersBadge: '2 Người',
    tags: ['Cổ điển', 'Á Đông', 'Sắp ra mắt'],
    coverUrl: coverCoTuong,
    status: 'COMING_SOON',
    theme: {
      borderGradient: 'linear-gradient(135deg, #F43F5E 0%, #FB7185 100%)',
      glowColor: 'rgba(225, 29, 72, 0.42)',
      glassBackground: 'linear-gradient(180deg, rgba(75, 20, 35, 0.92) 0%, rgba(42, 10, 19, 0.95) 100%)',
      accentGradient: 'linear-gradient(90deg, #F43F5E 0%, #FB7185 100%)',
      badgeGradient: 'linear-gradient(135deg, #FB7185 0%, #E11D48 55%, #BE123C 100%)',
      badgeLipColor: '#881337',
      badgeDotColor: '#FECDD3',
    },
  },
  {
    id: 'o-an-quan',
    title: 'Ô ĂN QUAN',
    subtitle: 'Trò chơi rải sỏi vẽ sân đất dân gian tuổi thơ Việt',
    playersBadge: '2 Người',
    tags: ['Dân gian Việt', 'Tuổi thơ', 'Sắp ra mắt'],
    coverUrl: coverOAnQuan,
    status: 'COMING_SOON',
    theme: {
      borderGradient: 'linear-gradient(135deg, #14B8A6 0%, #FACC15 100%)',
      glowColor: 'rgba(20, 184, 166, 0.42)',
      glassBackground: 'linear-gradient(180deg, rgba(18, 66, 58, 0.92) 0%, rgba(9, 37, 32, 0.95) 100%)',
      accentGradient: 'linear-gradient(90deg, #14B8A6 0%, #FACC15 100%)',
      badgeGradient: 'linear-gradient(135deg, #14B8A6 0%, #EAB308 100%)',
      badgeLipColor: '#0F766E',
      badgeDotColor: '#99F6E4',
    },
  },
];
