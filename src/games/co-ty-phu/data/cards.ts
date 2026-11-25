import type { CardDef } from '../engine/types';

/**
 * Bộ 16 lá CƠ HỘI — cân bằng 50/50 nhất quán:
 * - Đúng 1 lá Vô Tù (`chance_01`) · 1 lá Miễn Vào Tù (`chance_02`)
 * - 7 lá Tích cực (di chuyển, bay Sân Bay, thưởng đầu tư, thu tiền đối thủ)
 * - 7 lá Thử thách (lùi 3 ô, chi phí kinh doanh, cải tạo mặt bằng, chiêu đãi đối tác)
 */
export const CHANCE_CARDS: readonly CardDef[] = [
  {
    id: 'chance_01',
    deck: 'CHANCE',
    title: 'Bị Bắt Vào Tù',
    description: 'Bị phát hiện buôn lậu cổ vật quý hiếm! Đi thẳng vào tù ngay lập tức, không qua Khởi Hành.',
    effect: { type: 'GO_TO_JAIL' },
  },
  {
    id: 'chance_02',
    deck: 'CHANCE',
    title: 'Thẻ Miễn Vào Tù',
    description: 'Luật sư đại tài can thiệp kịp thời! Giữ thẻ này để dùng ra tù miễn phí 1 lần.',
    effect: { type: 'JAIL_FREE_CARD' },
  },
  {
    id: 'chance_03',
    deck: 'CHANCE',
    title: 'Trúng Vé Số Kiến Thiết',
    description: 'Trúng giải nhì Xổ số Kiến thiết Miền Nam chiều nay: Nhận ngay 2.000.000 đ!',
    effect: { type: 'CASH_DELTA', amount: 2_000_000 },
  },
  {
    id: 'chance_04',
    deck: 'CHANCE',
    title: 'Trúng Mùa Sầu Riêng',
    description: 'Vườn sầu riêng xuất khẩu được giá kỷ lục: Nhận 1.500.000 đ từ Ngân hàng!',
    effect: { type: 'CASH_DELTA', amount: 1_500_000 },
  },
  {
    id: 'chance_05',
    deck: 'CHANCE',
    title: 'Vé Máy Bay Hạng Nhất',
    description: 'Nhận vé thương gia: Bay thẳng tới Sân Bay gần nhất và thực hiện chuyến bay tới điểm đến!',
    effect: { type: 'FLY_NEAREST_AIRPORT' },
  },
  {
    id: 'chance_06',
    deck: 'CHANCE',
    title: 'Tiến Về Sài Gòn',
    description: 'Đi taxi thẳng tiến tới đất vàng Sài Gòn. Nếu đi ngang qua ô Khởi Hành sẽ nhận 3.000.000 đ!',
    effect: { type: 'MOVE_TO_TILE', targetIndex: 51 },
  },
  {
    id: 'chance_07',
    deck: 'CHANCE',
    title: 'Cổ Phiếu Tăng Trần',
    description: 'Thị trường chứng khoán thăng hoa, cổ phiếu tím ngắt: Nhận 1.500.000 đ tiền lãi!',
    effect: { type: 'CASH_DELTA', amount: 1_500_000 },
  },
  {
    id: 'chance_08',
    deck: 'CHANCE',
    title: 'Gọi Vốn Shark Tank',
    description: 'Dự án khởi nghiệp được các Shark chốt deal khủng: Nhận 2.000.000 đ vốn đầu tư!',
    effect: { type: 'CASH_DELTA', amount: 2_000_000 },
  },
  {
    id: 'chance_09',
    deck: 'CHANCE',
    title: 'Khách Sạn 5 Sao',
    description: 'Bất động sản được du khách chấm 5 sao: Mỗi người chơi khác mừng bạn 300.000 đ!',
    effect: { type: 'COLLECT_FROM_OTHERS', amountPerPlayer: 300_000 },
  },
  {
    id: 'chance_10',
    deck: 'CHANCE',
    title: 'Hỏng Máy Lạnh Cửa Hàng',
    description: 'Khách sạn & cửa hàng bị than phiền máy lạnh hư giữa trưa hè: Chi sửa chữa 500.000 đ.',
    effect: { type: 'CASH_DELTA', amount: -500_000 },
  },
  {
    id: 'chance_11',
    deck: 'CHANCE',
    title: 'Quỹ Vì Cộng Đồng',
    description: 'Chung tay góp sức xây cầu nông thôn và nhà tình nghĩa: Ủng hộ 600.000 đ.',
    effect: { type: 'CASH_DELTA', amount: -600_000 },
  },
  {
    id: 'chance_12',
    deck: 'CHANCE',
    title: 'Đổi Hướng Phong Thủy',
    description: 'Thầy phong thủy khuyên đổi vận: Lùi lại 3 ô và thực hiện hiệu ứng ô mới đến (lùi qua Khởi Hành không nhận 3 Tr).',
    effect: { type: 'MOVE_BACKWARDS', steps: 3 },
  },
  {
    id: 'chance_13',
    deck: 'CHANCE',
    title: 'Cấp Đổi Giấy Phép & Bảo Trì',
    description: 'Kiểm định phòng cháy & cấp lại hồ sơ nhà đất: Nộp 150.000 đ mỗi nhà Cấp 1–4 và 500.000 đ mỗi Biệt Thự.',
    effect: { type: 'REPAIR_BUILDINGS', houseFee: 150_000, villaFee: 500_000 },
  },
  {
    id: 'chance_14',
    deck: 'CHANCE',
    title: 'Khao Tiệc Đối Tác',
    description: 'Khai trương mở rộng kinh doanh, mời bạn bè một chầu thả ga: Mời mỗi người chơi khác 300.000 đ!',
    effect: { type: 'PAY_EACH_OTHER', amountPerPlayer: 300_000 },
  },
  {
    id: 'chance_15',
    deck: 'CHANCE',
    title: 'Bị Móc Túi Tại Bến Xe',
    description: 'Đi công tác sơ ý bị kẻ gian móc ví nơi đông đúc: Mất trắng 800.000 đ.',
    effect: { type: 'CASH_DELTA', amount: -800_000 },
  },
  {
    id: 'chance_16',
    deck: 'CHANCE',
    title: 'Chậm Kê Khai Thuế',
    description: 'Kế toán nộp trễ tờ khai thuế môn bài: Nộp phạt hành chính 500.000 đ vào kho bạc.',
    effect: { type: 'CASH_DELTA', amount: -500_000 },
  },
];

/**
 * Bộ 16 lá KHÍ VẬN — cân bằng 50/50 nhất quán:
 * - Đúng 1 lá Vô Tù (`fate_01`) · 1 lá Miễn Vào Tù (`fate_02`)
 * - 7 lá Tích cực (hoàn thuế, bảo hiểm, trúng SH, nhặt của rơi, trợ giá, quà sinh nhật, lộc khai xuân)
 * - 7 lá Thử thách (sửa nhà bão lũ, mừng cưới, phạt nguội, thủy kích, dị ứng, học phí, vỡ ống nước)
 */
export const FATE_CARDS: readonly CardDef[] = [
  {
    id: 'fate_01',
    deck: 'FATE',
    title: 'Đại Án Kinh Tế',
    description: 'Bị thanh tra phát hiện sai phạm hồ sơ đất đai: Đi thẳng vào tù ngay lập tức!',
    effect: { type: 'GO_TO_JAIL' },
  },
  {
    id: 'fate_02',
    deck: 'FATE',
    title: 'Lệnh Ân Xá Đặc Biệt',
    description: 'Được hưởng ân xá đặc biệt nhân dịp đại lễ: Giữ thẻ để ra tù miễn phí 1 lần!',
    effect: { type: 'JAIL_FREE_CARD' },
  },
  {
    id: 'fate_03',
    deck: 'FATE',
    title: 'Sửa Nhà Sau Bão Lũ',
    description: 'Bão đổ bộ làm tốc mái công trình: Nộp 200.000 đ mỗi nhà Cấp 1–4 và 800.000 đ mỗi Biệt Thự.',
    effect: { type: 'REPAIR_BUILDINGS', houseFee: 200_000, villaFee: 800_000 },
  },
  {
    id: 'fate_04',
    deck: 'FATE',
    title: 'Mừng Cưới Bạn Thân',
    description: 'Đi đám cưới linh đình khách sạn 5 sao: Mừng phong bì 300.000 đ cho mỗi người chơi khác còn sống!',
    effect: { type: 'PAY_EACH_OTHER', amountPerPlayer: 300_000 },
  },
  {
    id: 'fate_05',
    deck: 'FATE',
    title: 'Phạt Nguội Vượt Đèn',
    description: 'Camera AI phạt nguội vi phạm tốc độ: Nộp phạt 500.000 đ vào kho bạc.',
    effect: { type: 'CASH_DELTA', amount: -500_000 },
  },
  {
    id: 'fate_06',
    deck: 'FATE',
    title: 'Xe Ngập Nước Thủy Kích',
    description: 'Mưa ngập phố xe chết máy: Tốn 700.000 đ tiền cứu hộ kéo về xưởng sửa.',
    effect: { type: 'CASH_DELTA', amount: -700_000 },
  },
  {
    id: 'fate_07',
    deck: 'FATE',
    title: 'Ăn Nhầm Dị Ứng',
    description: 'Đi ăn đêm bị ngộ độc thực phẩm nhẹ: Nộp viện phí cấp cứu 600.000 đ.',
    effect: { type: 'CASH_DELTA', amount: -600_000 },
  },
  {
    id: 'fate_08',
    deck: 'FATE',
    title: 'Đóng Học Phí Quốc Tế',
    description: 'Đến kỳ đóng học phí du học cho con: Thanh toán 1.000.000 đ.',
    effect: { type: 'CASH_DELTA', amount: -1_000_000 },
  },
  {
    id: 'fate_09',
    deck: 'FATE',
    title: 'Hoàn Thuế Thu Nhập',
    description: 'Quyết toán thuế cuối năm phát hiện nộp thừa: Nhận lại 1.000.000 đ từ Ngân hàng!',
    effect: { type: 'CASH_DELTA', amount: 1_000_000 },
  },
  {
    id: 'fate_10',
    deck: 'FATE',
    title: 'Bảo Hiểm Đáo Hạn',
    description: 'Hợp đồng bảo hiểm tài sản đáo hạn đúng kỳ: Nhận chi trả quyền lợi 1.200.000 đ!',
    effect: { type: 'CASH_DELTA', amount: 1_200_000 },
  },
  {
    id: 'fate_11',
    deck: 'FATE',
    title: 'Bốc Thăm Trúng SH',
    description: 'Bốc thăm may mắn ở siêu thị trúng xe tay ga: Bán xe nhận ngay 1.500.000 đ!',
    effect: { type: 'CASH_DELTA', amount: 1_500_000 },
  },
  {
    id: 'fate_12',
    deck: 'FATE',
    title: 'Nhặt Được Của Rơi',
    description: 'Nhặt được ví tiền trả lại người đánh mất: Được thưởng tuyên dương 500.000 đ!',
    effect: { type: 'CASH_DELTA', amount: 500_000 },
  },
  {
    id: 'fate_13',
    deck: 'FATE',
    title: 'Bảo Trì Vỡ Ống Nước',
    description: 'Hệ thống cấp nước rò rỉ cần sửa gấp: Nộp 150.000 đ mỗi nhà Cấp 1–4 và 500.000 đ mỗi Biệt Thự.',
    effect: { type: 'REPAIR_BUILDINGS', houseFee: 150_000, villaFee: 500_000 },
  },
  {
    id: 'fate_14',
    deck: 'FATE',
    title: 'Trợ Giá Xăng Dầu',
    description: 'Nhận gói hỗ trợ kích cầu vận tải du lịch: Cộng thêm 800.000 đ từ Ngân hàng!',
    effect: { type: 'CASH_DELTA', amount: 800_000 },
  },
  {
    id: 'fate_15',
    deck: 'FATE',
    title: 'Quà Mừng Sinh Nhật',
    description: 'Hôm nay là sinh nhật tưng bừng của bạn: Mỗi người chơi khác tặng quà 300.000 đ!',
    effect: { type: 'COLLECT_FROM_OTHERS', amountPerPlayer: 300_000 },
  },
  {
    id: 'fate_16',
    deck: 'FATE',
    title: 'Lộc Khai Xuân Đầu Năm',
    description: 'Khai xuân rực rỡ đón tài lộc bất ngờ: Nhận ngay phong bao lì xì 1.800.000 đ từ Ngân hàng!',
    effect: { type: 'CASH_DELTA', amount: 1_800_000 },
  },
];

export const ALL_CARDS_BY_ID: Record<string, CardDef> = Object.fromEntries(
  [...CHANCE_CARDS, ...FATE_CARDS].map((c) => [c.id, c]),
);
