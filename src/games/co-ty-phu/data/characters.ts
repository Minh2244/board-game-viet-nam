import type { CharacterId, LandColorOption } from '../engine/types';

import standee01 from '../assets/characters/char_01_ca_phe.webp';
import standee02 from '../assets/characters/char_02_khan_ran.webp';
import standee03 from '../assets/characters/char_03_phuot_thu.webp';
import standee04 from '../assets/characters/char_04_tri_thuc.webp';
import standee05 from '../assets/characters/char_05_ao_dai_tim.webp';
import standee06 from '../assets/characters/char_06_non_la.webp';
import standee07 from '../assets/characters/char_07_doanh_nhan.webp';
import standee08 from '../assets/characters/char_08_vung_cao.webp';

import avatar01 from '../assets/characters/avatars/char_01_ca_phe.webp';
import avatar02 from '../assets/characters/avatars/char_02_khan_ran.webp';
import avatar03 from '../assets/characters/avatars/char_03_phuot_thu.webp';
import avatar04 from '../assets/characters/avatars/char_04_tri_thuc.webp';
import avatar05 from '../assets/characters/avatars/char_05_ao_dai_tim.webp';
import avatar06 from '../assets/characters/avatars/char_06_non_la.webp';
import avatar07 from '../assets/characters/avatars/char_07_doanh_nhan.webp';
import avatar08 from '../assets/characters/avatars/char_08_vung_cao.webp';

export interface CharacterInfo {
  id: CharacterId;
  name: string;
  tagline: string;
  accentHex: string;
  standeeUrl: string;
  avatarUrl: string;
}

export const CO_TY_PHU_CHARACTERS: readonly CharacterInfo[] = [
  {
    id: 'ca_phe',
    name: 'Minh Phin',
    tagline: 'Nhấp ngụm cà phê sữa đá, nhẹ nhàng chốt kèo cả dãy phố!',
    accentHex: '#0284C7',
    standeeUrl: standee01,
    avatarUrl: avatar01,
  },
  {
    id: 'khan_ran',
    name: 'Tư Miền Tây',
    tagline: 'Xởi lởi hào sảng, hễ tung xí ngầu là đỏ rực cả bàn!',
    accentHex: '#D97706',
    standeeUrl: standee02,
    avatarUrl: avatar02,
  },
  {
    id: 'phuot_thu',
    name: 'Khôi Phượt',
    tagline: 'Xách ba lô rong ruổi khắp miền, thấy đất đẹp là hốt gọn!',
    accentHex: '#16A34A',
    standeeUrl: standee03,
    avatarUrl: avatar03,
  },
  {
    id: 'tri_thuc',
    name: 'Khoa Kính Cận',
    tagline: 'Cầm sổ tính từng nước đi, không bao giờ để rỗng túi!',
    accentHex: '#4F46E5',
    standeeUrl: standee04,
    avatarUrl: avatar04,
  },
  {
    id: 'ao_dai_tim',
    name: 'Ngọc Áo Tím',
    tagline: 'Duyên dáng cố đô, bước tới ô nào là dựng nhà ô đó!',
    accentHex: '#9333EA',
    standeeUrl: standee05,
    avatarUrl: avatar05,
  },
  {
    id: 'non_la',
    name: 'Út Nón Lá',
    tagline: 'Cười hiền queo mà chuyên săn đủ 4 Bến Xe thắng đậm!',
    accentHex: '#E11D48',
    standeeUrl: standee06,
    avatarUrl: avatar06,
  },
  {
    id: 'doanh_nhan',
    name: 'Chị Đại Vy',
    tagline: 'Lướt nhẹ điện thoại, bước vào đấu giá khó ai qua nổi!',
    accentHex: '#0F766E',
    standeeUrl: standee07,
    avatarUrl: avatar07,
  },
  {
    id: 'vung_cao',
    name: 'Mây Thổ Cẩm',
    tagline: 'Rực rỡ sắc hoa núi rừng, gặp lô đất ngon là gom trọn bộ!',
    accentHex: '#EA580C',
    standeeUrl: standee08,
    avatarUrl: avatar08,
  },
];

export const LAND_COLORS: readonly LandColorOption[] = [
  { id: 'red', name: 'Đỏ Son', hex: '#EF4444', ringHex: '#FCA5A5' },
  { id: 'blue', name: 'Xanh Biển', hex: '#3B82F6', ringHex: '#93C5FD' },
  { id: 'emerald', name: 'Xanh Ngọc', hex: '#10B981', ringHex: '#6EE7B7' },
  { id: 'amber', name: 'Vàng Gold', hex: '#F59E0B', ringHex: '#FDE68A' },
  { id: 'purple', name: 'Tím Huế', hex: '#A855F7', ringHex: '#D8B4FE' },
  { id: 'orange', name: 'Cam Cháy', hex: '#F97316', ringHex: '#FDBA74' },
  { id: 'pink', name: 'Hồng Sen', hex: '#EC4899', ringHex: '#F9A8D4' },
  { id: 'cyan', name: 'Lục Lam', hex: '#06B6D4', ringHex: '#67E8F9' },
];
