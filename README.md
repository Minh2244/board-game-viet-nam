# 🎲 Sảnh Board Game Việt Nam — Cờ Tỷ Phú Việt Nam 3D

Nền tảng **Board Game Web Hub** chạy trực tiếp trên trình duyệt (**không cần Database**, tối ưu sẵn cho **Vercel**), tích hợp giao diện Sảnh Chọn Game dạng thẻ trượt ngang và tựa game tiên phong **Cờ Tỷ Phú Việt Nam 3D** hỗ trợ cả **PC, Tablet và Điện thoại (mặc định nằm ngang & tự động co giãn vừa khít mọi màn hình)**.

---

## ✨ Tính Năng Nổi Bật

### 1. Sảnh Board Game Web Hub (Modular Architecture)
- Giao diện bàn gỗ nắng ấm kết hợp thẻ game kính nổi 3D (**Cờ Tỷ Phú 3D** sẵn sàng chơi ngay; 4 tựa game dân gian/kinh điển *Cờ Cá Ngựa, Cờ Vua, Cờ Tướng, Ô Ăn Quan* đặt sẵn khung `COMING_SOON` tách biệt theo từng module).
- Nhạc nền BGM chỉ phát nhẹ nhàng tại Sảnh Chọn Game; khi vào ván cờ tự động chuyển sang hệ thống hiệu ứng âm thanh (SFX) sống động.

### 2. Cờ Tỷ Phú Việt Nam 3D (Bàn Cờ Chữ Nhật 52 Ô — Lưới `17 × 11`)
- **Chế độ chơi linh hoạt (2 – 6 tụ)**: Tùy chọn tự do giữa **Người thật** và **Máy (Bot SmartAI)**, 8 nhân vật Chibi Việt Nam, 8 màu đất riêng biệt, chế độ **1 hoặc 2 Xúc xắc**, **Bản đồ Mặc định** hoặc **Bản đồ Ngẫu nhiên** (tự lưu ván dở offline qua `localStorage`).
- **32 Ô Đất Địa Danh Việt Nam (11 nhóm màu) + 38 Ảnh Thắng Cảnh Thật**:
  - Đã tối ưu thang giá cân bằng: giá đất tối đa **`6 Tr đ`**, đúng **6 ô đất đắt (`5–6 Tr`)**, cạnh dưới khởi điểm nhẹ nhàng (`1–2,2 Tr`), 3 cạnh còn lại xen kẽ đắt–rẻ không đặt 2 ô đắt liền kề.
  - Mọi giá đất đều là bội số của **`200.000 đ`** để tiền thuê (`25% / 50% / 100% / 150% / 200% / 300%`) và giá bán trả nợ (`50%`) luôn chẵn đẹp tới `50.000 đ`, không lẻ xu.
  - Xây dựng nâng cấp trực quan từ **Nhà Cấp 1–4** lên **Biệt Thự trắng (Cấp 5)**; gom trọn nhóm màu **nhân đôi (×2) tiền thuê**.
- **Hệ thống Ô Tiện Ích & Đấu Giá Độc Lập (không thuộc nhóm màu đất)**:
  - **2 Nhà Máy Thủy Điện** (*Thủy Điện Trị An* cạnh dưới & *Thủy Điện Hòa Bình* cạnh trên): thu tiền điện theo `Tổng điểm Xúc xắc × 100 Nghìn đ` (1 nhà máy) hoặc `× 250 Nghìn đ` (đủ 2 nhà máy).
  - **4 Bến Xe Đấu Giá** (*Miền Tây, Phương Trang, Miền Đông, Giáp Bát* — mỗi cạnh 1 bến): mở giá `2 Tr đ`, bước giá `+200 Nghìn đ` theo cơ chế đặt cọc bù chênh lệch, bỏ quyền hoàn `100%` tiền cọc.
  - **Sân Bay Quốc Tế** góc trên trái: hiển thị điểm đến công khai luân phiên kèm hoạt ảnh máy bay khổng lồ lướt qua bản đồ chữ S Việt Nam.
- **32 Thẻ Cơ Hội (16 lá) & Khí Vận (16 lá)**:
  - Có tranh minh họa riêng cho từng thẻ; khi bốc hết 16 lá hệ thống **tự động xáo trộn ngẫu nhiên lại bằng Web Crypto API (`cryptoShuffle`)** để tiếp tục vòng bài mới (nếu có người đang giữ Thẻ Miễn Vào Tù trên tay sẽ tạm giữ lại và tự trả về đủ 16 lá ngay sau khi dùng).
- **Đồ họa & Hiệu ứng Hiện đại trên Nền Cổ điển**:
  - **Xúc xắc 3D WebGL (Three.js)**: Chạm thẳng sân giữa để tung nhanh hoặc **nhấn giữ để nạp lực lắc** (hỗ trợ phím `Space`).
  - **Bản đồ địa lý Việt Nam chuẩn hình chữ S** (có đầy đủ Hà Nội, Đà Nẵng, TP.HCM, Phú Quốc, Côn Đảo, Quần đảo Hoàng Sa & Trường Sa, trống đồng Đông Sơn).
  - **Hoạt ảnh dòng tiền trực quan**: Xúc xắc tự ẩn khi giao dịch, Ngân Hàng tự xuất hiện khi có thu–chi và ẩn gọn khi rảnh; cọc tiền giấy & đồng xu vàng trượt mượt giữa Người ↔ Ngân Hàng / Người ↔ Người.
- **Tối Ưu Điện Thoại Mặc Định Nằm Ngang**:
  - Tự động nhận diện màn hình điện thoại cầm dọc để xoay sang giao diện **nằm ngang mặc định** và tự tính tỷ lệ co giãn vừa khít 100% mọi kích thước màn hình mà vẫn giữ nguyên độ sắc nét của toàn bàn cờ, quân cờ, bảng thông tin và xúc xắc 3D.

---

## 🛠️ Công Nghệ Sử Dụng

| Hạng mục | Công nghệ |
| :--- | :--- |
| Frontend & UI | React 19, TypeScript 5.7, Tailwind CSS v4, Lucide Icons |
| Đồ họa 3D | Three.js (WebGL 3D Dice & Confetti) |
| State & Lưu trữ | Zustand, React Hooks, `localStorage` (Offline Save) |
| Build & Test | Vite 6, Vitest 3 |
| Hosting | Vercel (Static SPA kèm `vercel.json` rewrite) |

---

## 📁 Cấu Trúc Thư Mục

```text
Board_game/
├── docs/                           # Tài liệu thiết kế nền tảng & luật chơi chi tiết
│   ├── 01_GAME_CO_TY_PHU.md
│   ├── 02_KIEN_TRUC_CONG_NGHE.md
│   ├── 03_CAU_TRUC_THU_MUC_VA_MO_RONG.md
│   └── 04_KE_HOACH_TRIEN_KHAI_VA_KIEM_THU.md
├── src/
│   ├── hub/                        # Sảnh chọn game Web Hub & hệ thống Theme
│   ├── shared/                     # Âm thanh Web Audio, Web Crypto PRNG, LandscapeViewport
│   └── games/
│       ├── registry.ts             # Đăng ký danh sách 5 tựa game & Lazy Loading
│       └── co-ty-phu/              # Module độc lập Cờ Tỷ Phú Việt Nam 3D
│           ├── ai/                 # Bot SmartAI (đánh giá rủi ro, chặn cạnh, đấu giá)
│           ├── assets/             # 38 ảnh địa danh WebP, 8 nhân vật Chibi, 32 thẻ bài
│           ├── audio/              # Hiệu ứng SFX trong ván cờ
│           ├── data/               # 52 ô bàn cờ, 32 thẻ bài, bộ sinh bản đồ ngẫu nhiên
│           ├── engine/             # Luật chơi thuần túy & Reducer bất biến
│           ├── lobby/              # Lưu/tải ván dở offline
│           ├── scene/              # Sân khấu 3D Three.js (xúc xắc & pháo giấy)
│           ├── ui/                 # Bàn cờ 17×11, Bản đồ VN, Modal, Hiệu ứng chuyển tiền
│           └── __tests__/          # Unit test dữ liệu bản đồ, luật chơi & mô phỏng 12 ván Bot
├── index.html
├── vercel.json
└── vite.config.ts
```

---

## 🚀 Hướng Dẫn Chạy & Kiểm Thử Local

Yêu cầu: **Node.js >= 20** và **npm**.

```bash
# 1. Cài đặt thư viện
npm install

# 2. Chạy server phát triển (http://localhost:5173)
npm run dev

# 3. Kiểm tra kiểu TypeScript
npm run typecheck

# 4. Chạy bộ kiểm thử tự động (Vitest — gồm mô phỏng 12 ván SmartBot)
npm test

# 5. Đóng gói bản sản phẩm (Production Build)
npm run build

# 6. Xem trước bản production cục bộ
npm run preview
```

---

## ☁️ Triển Khai Lên Vercel

Dự án là Static Web App (SPA) không cần Backend/Database và đã cấu hình sẵn `vercel.json`:

```bash
# Triển khai trực tiếp từ CLI
npx vercel --prod
```

Hoặc kết nối trực tiếp kho GitHub này trên bảng điều khiển Vercel với cài đặt mặc định của **Vite** (`Build Command: npm run build`, `Output Directory: dist`).
