/**
 * Kho ảnh chụp thật thắng cảnh riêng cho 38 địa danh Việt Nam trên bàn cờ Cờ Tỷ Phú.
 * Đóng gói cục bộ dạng WebP siêu nhẹ và tự động ánh xạ theo tên địa danh (chạy chuẩn trên cả Mặc Định & Ngẫu Nhiên).
 */
const landmarkModules = import.meta.glob('../assets/landmarks/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const BY_SLUG: Record<string, string> = {};
for (const [path, url] of Object.entries(landmarkModules)) {
  const match = path.match(/([^/\\]+)\.webp$/);
  if (match) {
    BY_SLUG[match[1]] = url;
  }
}

const NAME_TO_SLUG: Record<string, string> = {
  // 32 ô đất địa danh tỉnh / thành Việt Nam (tối đa 6 Tr · 6 ô đắt xen kẽ · 11 nhóm màu)
  'Mộc Châu': 'moc_chau',
  'Hà Giang': 'ha_giang',
  'Sa Pa': 'sa_pa',
  'Lý Sơn': 'ly_son',
  'Vĩnh Hy': 'vinh_hy',
  'Phú Yên': 'ganh_da_dia',
  'Thanh Hóa': 'thanh_hoa',
  'Nghệ An': 'nghe_an',
  'Bắc Ninh': 'bac_ninh',
  'Ba Vì': 'ba_vi',
  'Hà Nội': 'ha_noi',
  'Kon Tum': 'mang_den',
  'Buôn Ma Thuột': 'buon_ma_thuot',
  'Đà Lạt': 'da_lat',
  'Quảng Bình': 'phong_nha',
  'Cố Đô Huế': 'co_do_hue',
  'Hội An': 'hoi_an',
  'Phan Thiết': 'mui_ne',
  'Vũng Tàu': 'vung_tau',
  'Côn Đảo': 'con_dao',
  'Quy Nhơn': 'quy_nhon',
  'Nha Trang': 'nha_trang',
  'Đà Nẵng': 'da_nang',
  'Mỹ Tho': 'my_tho',
  'Cần Thơ': 'can_tho',
  'Phú Quốc': 'phu_quoc',
  'Cát Bà': 'cat_ba',
  'Ninh Bình': 'trang_an',
  'Vịnh Hạ Long': 'vinh_ha_long',
  'Đồng Nai': 'dong_nai',
  'Bình Dương': 'binh_duong',
  'Sài Gòn': 'ben_thanh',
  // 6 ô tiện ích & đấu giá độc lập (2 Thủy Điện, 4 Bến Xe Đấu Giá — KHÔNG thuộc nhóm màu đất)
  'Thủy Điện Trị An': 'thuy_dien_tri_an',
  'Thủy Điện Hòa Bình': 'thuy_dien_hoa_binh',
  'Bến Xe Miền Tây': 'ben_xe_mien_tay',
  'Bến Xe Phương Trang': 'ben_xe_phuong_trang',
  'Bến Xe Miền Đông': 'ben_xe_mien_dong',
  'Bến Xe Giáp Bát': 'ben_xe_giap_bat',
};

export function getLandmarkArtworkUrl(tileName: string): string | undefined {
  const slug = NAME_TO_SLUG[tileName];
  return slug ? BY_SLUG[slug] : undefined;
}
