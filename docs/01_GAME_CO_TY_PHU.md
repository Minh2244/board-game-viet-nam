# 🎲 ĐỀ TÀI, CHỨC NĂNG & LUẬT CHƠI CỜ TỶ PHÚ VIỆT NAM 3D

> **Dự án**: Nền Tảng Board Game Web Hub Online (Không Cần Database - Vercel Ready)  
> **Tựa game tiên phong**: Cờ Tỷ Phú Việt Nam 3D (Vietnam Monopoly Edition)

---

## I. TỔNG QUAN ĐỀ TÀI

**Cờ Tỷ Phú Việt Nam 3D** là trò chơi cờ kinh doanh bất động sản trực tuyến được bản địa hóa 100% với các địa danh lịch sử, thắng cảnh du lịch nổi tiếng và nét văn hóa đặc trưng của Việt Nam trải dài từ Bắc chí Nam.

Trò chơi được phát triển trên nền tảng Web hiện đại, hỗ trợ chơi mượt mà trên cả Điện thoại (Mobile), Máy tính bảng (Tablet) và Máy tính bàn (PC) mà **không cần cài đặt hệ quản trị cơ sở dữ liệu cồng kềnh**.

---

## II. CHẾ ĐỘ CHƠI LINH HOẠT (2 ĐẾN 6 NGƯỜI / MÁY)

Thay vì tách nhiều màn hình rườm rà, trò chơi gom gọn việc thiết lập ván đấu về **1 sảnh tùy chỉnh duy nhất** (2 đến 6 vị trí):

| Chế độ | Mô tả chi tiết | Đối tượng & Trải nghiệm |
| :--- | :--- | :--- |
| **1. Chơi Trên Thiết Bị — Tùy Chọn Người & Máy (v1.0)** | • Chọn tổng số tụ tham gia từ **2 đến 6 vị trí**.<br>• Tại từng vị trí, bật chọn tự do **`Người thật`** hoặc **`Máy (Bot AI)`**, đặt tên và chọn 1 trong 8 nhân vật.<br>• Dùng được mọi kiểu ngay trên cùng 1 màn hình: **1 Người đấu với 1–5 Bot**, **2–6 Người chơi chung 1 máy (Pass & Play)**, hoặc **2 Bạn chơi chung + thêm 2 Bot cho đủ 4 tụ**.<br>• Nếu có từ 2 người thật trở lên, khi đổi sang lượt người khác sẽ hiện rõ tên & nút sẵn sàng chuyền máy (bộ Bot AI tự động đánh có độ trễ mượt). | Hoàn hảo cả khi chơi một mình với Máy lẫn tụ họp bạn bè / gia đình trên 1 điện thoại, iPad, laptop mà không cần mạng. |
| **2. Chơi Online (Nhập Mã Phòng PIN)** *(Giai đoạn 2 — Mở rộng sau)* | • Người tạo phòng tạo mã PIN (6 ký tự, ví dụ: `TYPHU8`).<br>• Bạn bè ở bất kỳ đâu chỉ cần nhập mã phòng để vào sảnh chờ.<br>• Kết nối trực tiếp P2P qua WebRTC (Google STUN + TURN).<br>• Cơ chế Mesh State: Nếu chủ phòng rớt mạng, phòng chơi vẫn tiếp tục bình thường. | Dành cho nhóm bạn chơi từ xa qua Internet (khác mạng Wi-Fi/4G), triển khai sau khi bản v1.0 ổn định. |

---

## III. BẢN ĐỒ & QUY MÔ BÀN CỜ (52 Ô HÌNH CHỮ NHẬT 17×11)

Bàn cờ hình chữ nhật tràn màn hình kích thước lớn **52 ô** theo lưới **`17 × 11`** (cạnh trên & dưới dài **15 ô giữa** chữ nhật đứng cao rõ, cạnh trái & phải **9 ô giữa** chữ nhật ngang rộng + **4 ô Góc** ở bốn đỉnh), giúp hiển thị trọn vẹn **38 ảnh chụp thắng cảnh thật** sắc nét cho tối đa 6 người chơi:

### 1. Cơ Chế Phân Bổ Giá Đất Cân Bằng & Đan Xen (Tối Đa 6 Tr · Tối Đa 6 Ô Đắt)
- **Giá mua đất cao nhất tối đa `6.000.000 đ` (6 Tr) đổ lại**.
- **Số lượng ô đất đắt (`5 Tr – 6 Tr`) tối đa là 6 ô đất** trên toàn bản đồ (Nhóm 9 Kỳ Quan Bắc Bộ & Nhóm 10 Đô Thị Nam Bộ).
- **Trừ cạnh ngang đầu tiên (Cạnh Dưới `1..15`) giữ giá khởi điểm nhẹ nhàng (`1 Tr – 2,2 Tr`, 0 ô đắt)**, 3 cạnh còn lại (**Trái, Trên, Phải**) được **xen kẽ từng ô lẻ giữa Đắt (`5–6 Tr`, mỗi cạnh đúng 2 ô không liền kề) và Rẻ/Vừa (`2–4,4 Tr`)** để không có khu vực nào toàn đất đắt hoặc toàn đất rẻ.
- Trên mỗi cạnh: **Ô Cơ Hội (?)** và **Ô Khí Vận (!)** được đẩy cách xa nhau ra 2 đầu đối lập của cạnh (cách nhau 8–14 ô), và mỗi cạnh có đúng **1 Bến Xe Đấu Giá** (`5, 21, 31, 47` — độc lập, không thuộc nhóm màu đất).
- **Không còn ô Di Sản (+1 Tr)**: toàn bộ 2 vị trí cũ đã chuyển thành **2 ô nhà đất khởi điểm** (*Thanh Hóa `1,6 Tr` & Nghệ An `1,8 Tr` — Nhóm 11 Bắc Trung Bộ*), nâng tổng số đất địa danh lên **32 ô đất (11 nhóm màu)**.
- **2 Nhà Máy Thủy Điện** (*Thủy Điện Trị An* ô `6` cạnh dưới & *Thủy Điện Hòa Bình* ô `33` cạnh trên) là **tiện ích độc lập, không thuộc nhóm màu đất**, thu tiền theo `Tổng điểm Xúc xắc × 100 Nghìn đ` (1 nhà máy) hoặc `× 250 Nghìn đ` (đủ 2 nhà máy).
- Góc trên trái (`index = 26`) là **Sân Bay Quốc Tế** duy nhất (hiển thị máy bay trực diện & điểm bay ngẫu nhiên luân phiên). Ô `32` là **Thuế Du Lịch (-500 Nghìn)**, ô `41` là **Thuế Bất Động Sản**.

### 2. Hai Loại Bản Đồ: Mặc Định & Ngẫu Nhiên
- **Bản Đồ Mặc Định (Thắng Cảnh Du Lịch Việt Nam Đan Xen)**:
  - Tích hợp **30 địa danh du lịch nổi tiếng** được chia tròn thành **10 nhóm màu (mỗi nhóm đúng 3 ô)**:
    1. *Nhóm Núi Rừng Tây Bắc*: Sa Pa (Lào Cai), Hà Giang, Mộc Châu.
    2. *Nhóm Kỳ Quan Bắc Bộ*: Vịnh Hạ Long, Tràng An (Ninh Bình), Cát Bà.
    3. *Nhóm Thủ Đô & Phố Cổ*: Hà Nội (Hồ Gươm), Bắc Ninh, Ba Vì.
    4. *Nhóm Con Đường Di Sản Miền Trung*: Phong Nha (Quảng Bình), Cố Đô Huế, Phố Cổ Hội An.
    5. *Nhóm Duyên Hải & Đảo Ngọc Miền Trung*: Lý Sơn, Phú Yên (Gành Đá Đĩa), Vĩnh Hy.
    6. *Nhóm Thiên Đường Biển Đảo*: Đà Nẵng (Bà Nà), Nha Trang, Quy Nhơn.
    7. *Nhóm Cao Nguyên Đại Ngàn*: Đà Lạt (Ngàn Hoa), Buôn Ma Thuột, Măng Đen.
    8. *Nhóm Nghỉ Dưỡng Miền Đông*: Vũng Tàu, Mũi Né (Phan Thiết), Côn Đảo.
    9. *Nhóm Sông Nước & Biển Tây*: Cần Thơ (Chợ Nổi), Phú Quốc (Đảo Ngọc), Mỹ Tho.
    10. *Nhóm Đất Vàng Sài Gòn Cổ*: Chợ Bến Thành, Đường Đồng Khởi, Gia Định.
- **Bản Đồ Ngẫu Nhiên (Procedural Random Map — Giữ Nguyên Khung 22 Ô Chức Năng)**:
  - Trên cả Bản đồ Mặc định lẫn Ngẫu nhiên, **22 ô khung đặc biệt được GIỮ NGUYÊN VỊ TRÍ CỐ ĐỊNH** *(4 Ô Góc: Khởi Hành `0`, Nhà Tù/Thăm Tù `13`, Bãi Đỗ Xe `26`, Vào Tù `39`; 4 Bến Xe Đấu Giá `5, 18, 31, 44`; 2 Sân Bay `7, 33`; 2 Thủy Điện `20, 46`; 4 Cơ Hội `3, 22, 29, 48`; 4 Khí Vận `10, 16, 36, 42`; Di Sản Quốc Gia `24`; Thuế BĐS `50`)* để người chơi dễ nhớ bố cục quen thuộc.
  - Thuật toán Bản đồ Ngẫu nhiên **chỉ xáo trộn vị trí 30 Ô Đất Địa Danh** giữa 30 slot đất *(kèm biến động nhẹ giá đất theo bội số `200K` trong thang hợp lệ, bảo đảm không đặt 2 ô giá vàng `≥ 7M` cạnh nhau)*. Nhờ giữ nguyên khung, **cả 4 cạnh luôn có đúng `9` ô mua được** cho luật Thắng 1 Đường Thẳng.

### 3. Phân Bổ Chi Tiết 52 Ô Bàn Cờ (`4 Ô Góc + 48 Ô Giữa`)

#### A. Thành phần theo loại ô
- **4 Ô Góc Đặc Biệt**:
  1. **Ô Khởi Hành (Bắt Đầu — `index = 0`)**: Chỉ nhận tiền thưởng **3.000.000 đ** khi **đi tiến ngang qua ô này** (dừng đúng chân tại ô Khởi Hành = `0 đ`, chờ lượt sau đi tiếp mới nhận). **Lưu ý khi bị thẻ bài kéo đi lùi qua ô Khởi Hành**: **KHÔNG** được nhận `3.000.000 đ`; tuy nhiên sau khi đã lùi qua nằm phía trước ô Khởi Hành, tới lượt đi tiến tiếp theo bước ngang qua ô Khởi Hành thì **VẪN** được nhận đủ `3.000.000 đ`.
  2. **Ô Nhà Tù**: Thăm nuôi (người tự do dừng chân tốn **500.000 đ**) / Nơi tạm giam người phạm luật.
  3. **Ô Trạm Nghỉ Chân Miễn Phí (Bãi Đỗ Xe)**: Điểm dừng chân an toàn, không bị mất phí.
  4. **Ô Bị Bắt Vào Tù**: Dẫm vào ô này bị áp giải thẳng vào Nhà Tù ngay lập tức.
- **30 Ô Đất Địa Danh / Thắng Cảnh Du Lịch**: Chia tròn thành **10 nhóm màu** (mỗi nhóm 3 ô đất).
- **4 Ô Đấu Giá - Bến Xe Lớn** (mỗi cạnh 1 ô): Bến xe Phương Trang, Bến xe Miền Đông, Bến xe Miền Tây, Bến xe Giáp Bát.
- **2 Ô Sân Bay** (đối xứng 2 cạnh): Sân Bay Tân Sơn Nhất & Sân Bay Nội Bài (hiển thị sẵn điểm đến ngẫu nhiên thuộc 30 Ô Đất Địa Danh).
- **2 Ô Tiện Ích - Nhà Máy Thủy Điện** (đối xứng 2 cạnh còn lại): Thủy điện Hòa Bình & Thủy điện Trị An.
- **8 Ô Thẻ Bài**: 4 Ô Cơ Hội (May Mắn) + 4 Ô Khí Vận (Nghĩa Vụ / Rủi Ro) — mỗi cạnh gồm 1 Cơ Hội và 1 Khí Vận.
- **1 Ô Thuế Bất Động Sản**: Thu theo số lượng nhà và biệt thự đang sở hữu (chi tiết mục IV.5).
- **1 Ô Di Sản Quốc Gia (Hoàng Thành Thăng Long)**: Nhận tiền tài trợ du lịch **1.000.000 đ** từ Ngân hàng khi ghé thăm.

#### B. Cân đối trên 4 cạnh (Mỗi cạnh 12 ô giữa, đúng 9 ô có thể sở hữu)

| Cạnh | Ô Góc Hai Đầu | 12 Ô Nằm Giữa | Số Ô Có Thể Mua (Luật Thắng 1 Đường Thẳng) |
| :--- | :--- | :--- | :--- |
| **Cạnh 1 (Dưới)** | Khởi Hành ↔ Nhà Tù | 8 Ô Đất + 1 Bến Xe Đấu Giá + 1 Sân Bay + 1 Cơ Hội + 1 Khí Vận | **9 ô** (8 Đất + 1 Đấu Giá) |
| **Cạnh 2 (Trái)** | Nhà Tù ↔ Bãi Đỗ Xe | 7 Ô Đất + 1 Bến Xe Đấu Giá + 1 Nhà Máy Thủy Điện + 1 Cơ Hội + 1 Khí Vận + 1 Di Sản Quốc Gia | **9 ô** (7 Đất + 1 Đấu Giá + 1 Nhà Máy) |
| **Cạnh 3 (Trên)** | Bãi Đỗ Xe ↔ Vào Tù | 8 Ô Đất + 1 Bến Xe Đấu Giá + 1 Sân Bay + 1 Cơ Hội + 1 Khí Vận | **9 ô** (8 Đất + 1 Đấu Giá) |
| **Cạnh 4 (Phải)** | Vào Tù ↔ Khởi Hành | 7 Ô Đất + 1 Bến Xe Đấu Giá + 1 Nhà Máy Thủy Điện + 1 Cơ Hội + 1 Khí Vận + 1 Thuế Bất Động Sản | **9 ô** (7 Đất + 1 Đấu Giá + 1 Nhà Máy) |

### 4. Bảng Chi Tiết 52 Ô Bản Đồ Mặc Định (`0 → 51`, Thuận Chiều Kim Đồng Hồ)

Tất cả giá đất được chọn là **bội số của `200.000 đ`** để mọi mức tiền thuê (`25% / 50% / 100% / 150% / 200% / 300%`) và giá bán lại (`50%`) đều chẵn đẹp tới `50.000 đ`, tuyệt đối không bị lẻ xu:

- **Vị trí khung cố định giữ nguyên trên cả Bản đồ Mặc định & Ngẫu nhiên (22 ô)**:
  - `0` Khởi Hành · `13` Nhà Tù / Thăm Nuôi · `26` Bãi Đỗ Xe · `39` Bị Bắt Vào Tù
  - `5, 18, 31, 44` Bến Xe Đấu Giá · `7, 33` Sân Bay · `20, 46` Thủy Điện · `3, 22, 29, 48` Cơ Hội · `10, 16, 36, 42` Khí Vận · `24` Hoàng Thành Thăng Long (Di Sản Quốc Gia) · `50` Thuế Bất Động Sản.

| Index | Cạnh | Tên Ô | Loại Ô | Nhóm Màu (1–10) | Giá Đất / Mua |
| :---: | :---: | :--- | :--- | :---: | :---: |
| **0** | Góc 1 | **Khởi Hành (Bắt Đầu)** | `GO` | — | *Qua (tiến) +3.0M* |
| **1** | Cạnh 1 | **Mộc Châu** | Ô Đất | 1 (Tây Bắc — Nâu) | `1.000.000 đ` |
| **2** | Cạnh 1 | **Măng Đen** | Ô Đất | 7 (Cao Nguyên — Cam) | `1.800.000 đ` |
| **3** | Cạnh 1 | **Cơ Hội 1** | Cơ Hội | — | *Rút thẻ* |
| **4** | Cạnh 1 | **Vịnh Hạ Long** | Ô Đất | 2 (Kỳ Quan BB — Coban) | `7.400.000 đ` |
| **5** | Cạnh 1 | **Bến Xe Miền Tây** | Đấu Giá | — | *Mở giá 2.0M* |
| **6** | Cạnh 1 | **Mỹ Tho** | Ô Đất | 9 (Biển Tây — Xanh ngọc) | `5.200.000 đ` |
| **7** | Cạnh 1 | **Sân Bay Tân Sơn Nhất** | Sân Bay | — | *Bay công khai* |
| **8** | Cạnh 1 | **Bắc Ninh** | Ô Đất | 3 (Thủ Đô — Hồng sen) | `1.600.000 đ` |
| **9** | Cạnh 1 | **Mũi Né (Phan Thiết)** | Ô Đất | 8 (Miền Đông — Vàng) | `3.200.000 đ` |
| **10** | Cạnh 1 | **Khí Vận 1** | Khí Vận | — | *Rút thẻ* |
| **11** | Cạnh 1 | **Gia Định** | Ô Đất | 10 (Sài Gòn Cổ — Tím) | `7.400.000 đ` |
| **12** | Cạnh 1 | **Vĩnh Hy** | Ô Đất | 5 (Duyên Hải — Lam nhạt) | `1.200.000 đ` |
| **13** | Góc 2 | **Nhà Tù / Thăm Nuôi** | `VISIT_JAIL` | — | *Thăm 500K / Bảo lãnh 1M* |
| **14** | Cạnh 2 | **Hà Giang** | Ô Đất | 1 (Tây Bắc — Nâu) | `1.200.000 đ` |
| **15** | Cạnh 2 | **Quy Nhơn** | Ô Đất | 6 (Biển Đảo — Xanh lá) | `5.000.000 đ` |
| **16** | Cạnh 2 | **Khí Vận 2** | Khí Vận | — | *Rút thẻ* |
| **17** | Cạnh 2 | **Phong Nha (Quảng Bình)** | Ô Đất | 4 (Di Sản MT — Đỏ son) | `3.000.000 đ` |
| **18** | Cạnh 2 | **Bến Xe Phương Trang** | Đấu Giá | — | *Mở giá 2.0M* |
| **19** | Cạnh 2 | **Tràng An (Ninh Bình)** | Ô Đất | 2 (Kỳ Quan BB — Coban) | `7.200.000 đ` |
| **20** | Cạnh 2 | **Thủy Điện Trị An** | Tiện Ích | — | `2.000.000 đ` |
| **21** | Cạnh 2 | **Ba Vì** | Ô Đất | 3 (Thủ Đô — Hồng sen) | `2.000.000 đ` |
| **22** | Cạnh 2 | **Cơ Hội 2** | Cơ Hội | — | *Rút thẻ* |
| **23** | Cạnh 2 | **Vũng Tàu** | Ô Đất | 8 (Miền Đông — Vàng) | `3.800.000 đ` |
| **24** | Cạnh 2 | **Hoàng Thành Thăng Long** | Di Sản QG | — | *Nhận +1.0M* |
| **25** | Cạnh 2 | **Cần Thơ (Chợ Nổi)** | Ô Đất | 9 (Biển Tây — Xanh ngọc) | `5.400.000 đ` |
| **26** | Góc 3 | **Bãi Đỗ Xe (Nghỉ Chân)** | `FREE_PARKING` | — | *Miễn phí* |
| **27** | Cạnh 3 | **Lý Sơn** | Ô Đất | 5 (Duyên Hải — Lam nhạt) | `1.000.000 đ` |
| **28** | Cạnh 3 | **Đường Đồng Khởi** | Ô Đất | 10 (Sài Gòn Cổ — Tím) | `7.600.000 đ` |
| **29** | Cạnh 3 | **Cơ Hội 3** | Cơ Hội | — | *Rút thẻ* |
| **30** | Cạnh 3 | **Cát Bà** | Ô Đất | 2 (Kỳ Quan BB — Coban) | `7.000.000 đ` |
| **31** | Cạnh 3 | **Bến Xe Miền Đông** | Đấu Giá | — | *Mở giá 2.0M* |
| **32** | Cạnh 3 | **Cố Đô Huế** | Ô Đất | 4 (Di Sản MT — Đỏ son) | `3.600.000 đ` |
| **33** | Cạnh 3 | **Sân Bay Nội Bài** | Sân Bay | — | *Bay công khai* |
| **34** | Cạnh 3 | **Nha Trang** | Ô Đất | 6 (Biển Đảo — Xanh lá) | `5.600.000 đ` |
| **35** | Cạnh 3 | **Buôn Ma Thuột** | Ô Đất | 7 (Cao Nguyên — Cam) | `2.200.000 đ` |
| **36** | Cạnh 3 | **Khí Vận 3** | Khí Vận | — | *Rút thẻ* |
| **37** | Cạnh 3 | **Gành Đá Đĩa (Phú Yên)** | Ô Đất | 5 (Duyên Hải — Lam nhạt) | `1.400.000 đ` |
| **38** | Cạnh 3 | **Đà Lạt (Ngàn Hoa)** | Ô Đất | 7 (Cao Nguyên — Cam) | `2.600.000 đ` |
| **39** | Góc 4 | **Bị Bắt Vào Tù** | `GO_TO_JAIL` | — | *Áp giải về ô 13* |
| **40** | Cạnh 4 | **Sa Pa (Lào Cai)** | Ô Đất | 1 (Tây Bắc — Nâu) | `1.400.000 đ` |
| **41** | Cạnh 4 | **Côn Đảo** | Ô Đất | 8 (Miền Đông — Vàng) | `4.400.000 đ` |
| **42** | Cạnh 4 | **Khí Vận 4** | Khí Vận | — | *Rút thẻ* |
| **43** | Cạnh 4 | **Phố Cổ Hội An** | Ô Đất | 4 (Di Sản MT — Đỏ son) | `4.200.000 đ` |
| **44** | Cạnh 4 | **Bến Xe Giáp Bát** | Đấu Giá | — | *Mở giá 2.0M* |
| **45** | Cạnh 4 | **Chợ Bến Thành** | Ô Đất | 10 (Sài Gòn Cổ — Tím) | `8.000.000 đ` |
| **46** | Cạnh 4 | **Thủy Điện Hòa Bình** | Tiện Ích | — | `2.000.000 đ` |
| **47** | Cạnh 4 | **Hà Nội (Hồ Gươm)** | Ô Đất | 3 (Thủ Đô — Hồng sen) | `2.400.000 đ` |
| **48** | Cạnh 4 | **Cơ Hội 4** | Cơ Hội | — | *Rút thẻ* |
| **49** | Cạnh 4 | **Phú Quốc (Đảo Ngọc)** | Ô Đất | 9 (Biển Tây — Xanh ngọc) | `6.000.000 đ` |
| **50** | Cạnh 4 | **Thuế Bất Động Sản** | Thuế | — | *200K/nhà · 1M/BT · Min 50K* |
| **51** | Cạnh 4 | **Đà Nẵng (Bà Nà)** | Ô Đất | 6 (Biển Đảo — Xanh lá) | `6.000.000 đ` |

---

## IV. CƠ CHẾ KINH TẾ, XÂY NHÀ & CÔNG THỨC TÍNH TIỀN THUÊ

### 1. Vốn Khởi Đầu & Thang Giá Đất Cân Bằng (Tối Đa 6 Tr · Tối Đa 6 Ô Đất Đắt · Xen Kẽ Đắt–Rẻ)
- **Vốn ban đầu mỗi người chơi**: **25.000.000 đ (25 Tr)**.
- **Quy tắc cân bằng bản đồ 30 ô đất (10 nhóm màu × 3 ô)**:
  1. **Giá mua đất cao nhất tối đa `6.000.000 đ` (6 Tr) đổ lại** (không có ô 7–8 Tr gây mất cân bằng).
  2. **Số lượng ô đất đắt (`5 Tr – 6 Tr`) tối đa là 6 ô đất** trên toàn bản đồ (thuộc Nhóm 9 Kỳ Quan Bắc Bộ & Nhóm 10 Đô Thị Nam Bộ).
  3. **Trừ cạnh ngang đầu tiên (Cạnh Dưới `1..15`) giữ giá khởi điểm nhẹ nhàng (`1 Tr – 2,2 Tr`)**, 3 cạnh còn lại (Trái, Trên, Phải) được **bố trí XEN KẼ các ô Đắt (`5 – 6 Tr`) với các ô Vừa & Rẻ (`2 – 4,4 Tr`)** để không có khu vực nào toàn đất đắt hoặc toàn đất rẻ.
- **Thang giá 10 nhóm màu (mỗi nhóm đúng 3 ô đất)**:
  - **Nhóm 1 & 2 — Khởi điểm**: **1.000.000 đ – 1.800.000 đ** (Mộc Châu, Hà Giang, Sa Pa; Lý Sơn, Vĩnh Hy, Phú Yên).
  - **Nhóm 3 & 4 — Phổ thông**: **1.800.000 đ – 2.600.000 đ** (Bắc Ninh, Ba Vì, Hà Nội; Kon Tum, Buôn Ma Thuột, Đà Lạt).
  - **Nhóm 5 & 6 — Du lịch**: **2.600.000 đ – 3.800.000 đ** (Quảng Bình, Cố Đô Huế, Hội An; Phan Thiết, Vũng Tàu, Côn Đảo).
  - **Nhóm 7 & 8 — Phát triển**: **3.800.000 đ – 4.400.000 đ** (Quy Nhơn, Nha Trang, Đà Nẵng; Mỹ Tho, Cần Thơ, Phú Quốc).
  - **Nhóm 9 & 10 — Đất Vàng (Đúng 6 ô đắt `5 Tr – 6 Tr`)**: **5.000.000 đ – 6.000.000 đ** (Cát Bà, Ninh Bình, Vịnh Hạ Long; Đồng Nai, Bình Dương, Sài Gòn).

### 2. Công Thức Tính Tiền Thuê Chuẩn (Số Chẵn Đẹp, Không Lẻ)
Khi đối thủ dẫm vào Ô Đất Địa Danh của bạn, họ phải nộp tiền thuê dựa trên cấp độ công trình hiện có:

$$\text{Tiền Thuê} = \begin{cases} 
\text{Giá Đất} \times 25\% \; (\text{Giá Đất} / 4) & \text{(Đất trống)} \\
\text{Giá Đất} \times 50\% \; (\text{Giá Đất} / 2) & \text{(Nhà Cấp 1)} \\
\text{Giá Đất} \times 100\% \; (\text{Giá Đất} \times 1) & \text{(Nhà Cấp 2)} \\
\text{Giá Đất} \times 150\% \; (\text{Giá Đất} \times 1.5) & \text{(Nhà Cấp 3)} \\
\text{Giá Đất} \times 200\% \; (\text{Giá Đất} \times 2) & \text{(Nhà Cấp 4)} \\
\text{Giá Đất} \times 300\% \; (\text{Giá Đất} \times 3) & \text{(Biệt Thự / Khách Sạn Cao Cấp)}
\end{cases}$$

> 🔥 **Quy Tắc Thâu Tóm Nhóm Màu ($\times 2$ Tiền Thuê)**: Khi một người chơi sở hữu trọn bộ cả **3 ô đất** trong cùng một nhóm màu, **tất cả tiền thuê của các ô trong nhóm đó lập tức được NHÂN ĐÔI ($\times 2$)**! *(Ví dụ: Biệt Thự trên ô 8M có đủ bộ màu sẽ thu tới $8\text{M} \times 3 \times 2 = 48\text{M}$).*

### 3. Chi Phí Xây Nhà & Quy Tắc Nâng Cấp Từng Bước
- **Chi phí xây nhà Cấp 1, 2, 3, 4**: Mỗi lần nâng 1 cấp tốn **50% Giá Đất** ($\text{Giá Đất} / 2$).
- **Chi phí nâng cấp từ Cấp 4 lên Biệt Thự / Khách Sạn**: Tốn **100% Giá Đất** ($\text{Giá Đất} \times 1$).
- **Điều kiện nâng cấp bắt buộc (Từng Cấp Khi Quay Trúng Nhà)**:
  - Lúc vừa mua ô đất trống từ Ngân hàng, ô đất đứng ở trạng thái **Đất trống** (chưa được xây nhà ngay lập tức trong lượt mua đó).
  - Sau này, **mỗi lần chủ đất quay xúc xắc (hoặc hạ cánh từ Sân bay / Thẻ bài) dẫm vào đúng ô đất của mình** thì mới được quyền chọn nâng thêm **tối đa +1 cấp** (`Đất trống → Cấp 1 → Cấp 2 → Cấp 3 → Cấp 4 → Biệt Thự`).
  - Không bắt buộc phải gom đủ nhóm màu mới được xây nhà; người chơi có thể nâng cấp từng bước trên từng ô đất mình sở hữu mỗi lần đi qua dừng chân đúng ô đó.

### 4. Quy Tắc Bán Nhà Trả Nợ, Cấm Trao Đổi & Cấm Mua Lại
- **Tuyệt Đối Không Cho Trao Đổi Hay Mua Lại Đất Giữa Các Người Chơi**:
  - Không có tính năng chuyển nhượng, tặng, đổi đất/thẻ hay bơm tiền riêng giữa 2 người chơi để chống thông đồng gian lận 100%.
  - **Không cho mua lại (cướp) ô đất** đang thuộc quyền sở hữu hợp pháp của đối thủ; ô đất của ai người đó giữ đến khi tự bán trả nợ hoặc phá sản.
- **Chỉ Được Phép Bán Tài Sản Khi Hết Tiền Trả Nợ**:
  - Khi số dư tiền mặt vẫn còn đủ chi trả: **Không được tự ý bán nhà hoặc bán đất**.
  - **Tiền đang đặt cọc trong các phiên Đấu Giá bị khóa cứng**: Người chơi **không được rút tiền cọc đấu giá** để trả nợ tại ô khác (chỉ được hoàn cọc khi phiên đấu giá kết thúc, khi dẫm lại đúng ô đó và bấm Bỏ quyền, hoặc khi chính thức Phá sản).
  - **Chỉ khi rơi vào tình trạng thiếu tiền mặt để trả tiền thuê, đóng thuế, nộp phạt hoặc bị cưỡng chế nộp 1M ra tù ở lượt thứ 3**: Hệ thống kích hoạt màn hình **Bán tài sản trả nợ**:
    - Người chơi được quyền chọn bán lẻ từng căn nhà (giảm từng cấp từ Biệt Thự → Cấp 4 → Cấp 3 → Cấp 2 → Cấp 1 → Đất trống) với **giá bán = 50% chi phí xây ban đầu** (tức Biệt Thự bán thu lại $\text{Giá Đất} / 2$; mỗi cấp nhà 1–4 thu lại $\text{Giá Đất} / 4$).
    - **Phải bán hết toàn bộ nhà trên ô đó (trở về đất trống) thì mới được quyền bán ô đất** với **giá bán = 50% giá mua đất ban đầu**.
    - Với **Ô Tiện Ích**: Giá bán cho Ngân hàng = **50% giá mua ban đầu (1.000.000 đ)**.
    - Với **Ô Đấu Giá đã chốt sở hữu**: Giá bán cho Ngân hàng = **50% giá chốt đấu giá cuối cùng**.
    - Ngay khi bán đủ số tiền cần để thanh toán khoản nợ, giao dịch bán dừng lại, người chơi tiếp tục ván đấu.
    - **Nếu đã bán sạch toàn bộ nhà cửa, đất đai, bến xe và nhà máy mà tổng tiền gom được vẫn KHÔNG ĐỦ trả nợ**: Người chơi chính thức bị tuyên bố **Phá Sản**!

### 5. Ô Thuế Bất Động Sản Duy Nhất (Thu Theo Quy Mô Nhà Đất)
Thay vì phạt tiền cố định, **ô Thuế thu tiền dựa trên số lượng công trình người chơi đang sở hữu**:
- Người dẫm vào ô Thuế phải nộp cho Ngân hàng:
  - **200.000 đ** cho mỗi căn Nhà Cấp 1 - 4 đang sở hữu.
  - **1.000.000 đ** cho mỗi căn Biệt Thự / Khách Sạn đang sở hữu.
  - Nếu người chơi **chưa có căn nhà nào**: Chỉ nộp mức thuế bảo vệ môi trường tối thiểu **50.000 đ** *(Giúp tạo hiệu ứng cân bằng game: Người càng nhiều biệt thự thì nguy cơ bị trừ tiền thuế càng cao, tránh tình trạng 1 người áp đảo quá sớm)*.

---

## V. THIẾT KẾ TRỌN BỘ 32 THẺ CƠ HỘI & KHÍ VẬN

Cả 2 loại thẻ bài đều được thiết kế mang đậm văn hóa, tính thời sự và sự hóm hỉnh của đời sống Việt Nam. **Cả 2 bộ bài đều có thẻ Vào Tù và thẻ Miễn Vào Tù**.

### A. 16 THẺ CƠ HỘI (MAY MẮN, ĐỘT PHÁ, BẤT NGỜ)

| STT | Tên Thẻ Bài | Mô Tả & Hiệu Ứng Trò Chơi |
| :---: | :--- | :--- |
| **01** | ⛓️ **Bị Bắt Vào Tù** | Bị phát hiện buôn lậu cổ vật quý hiếm! **Đi thẳng vào tù ngay lập tức**, không qua ô Khởi Hành, không nhận 3M. |
| **02** | 🎟️ **Thẻ Miễn Vào Tù** | Luật sư đại tài can thiệp kịp thời! **Giữ thẻ này để dùng khi cần ra tù miễn phí** *(không được trao đổi/chuyển nhượng cho người khác)*. |
| **03** | 🎰 **Trúng Vé Số Kiến Thiết** | Trúng giải nhì Xổ số Kiến thiết Miền Nam chiều nay: **Nhận ngay 2.000.000 đ** từ Ngân hàng. |
| **04** | 🍈 **Trúng Mùa Sầu Riêng** | Vườn sầu riêng xuất khẩu được giá kỷ lục: **Nhận 1.500.000 đ** từ Ngân hàng. |
| **05** | ✈️ **Vé Máy Bay Hạng Nhất** | Nhận vé máy bay thương gia: **Bay thẳng tới ô Sân Bay gần nhất** và thực hiện ngay chuyến bay tới điểm đến đang hiển thị trên Sân Bay đó! |
| **06** | 🏛️ **Tiến Về Bến Thành** | Đi taxi thẳng tiến tới ô Đất Vàng Chợ Bến Thành. Nếu có đi ngang qua ô Khởi Hành, **được nhận 3.000.000 đ**. |
| **07** | 📈 **Cổ Phiếu Tăng Trần** | Thị trường chứng khoán thăng hoa, cổ phiếu tím ngắt: **Nhận 1.500.000 đ** tiền lãi. |
| **08** | 🦈 **Gọi Vốn Shark Tank** | Dự án khởi nghiệp được các Shark chốt deal 3 tỷ: **Nhận 2.500.000 đ** vốn đầu tư. |
| **09** | 🌟 **Khách Sạn 5 Sao** | Bất động sản của bạn được du khách quốc tế chấm 5 sao: **Mỗi người chơi khác phải mừng bạn 300.000 đ** *(nếu nhiều người thiếu tiền, hệ thống duyệt thu tuần tự theo thứ tự lượt kế tiếp: từng người lần lượt bán tài sản trả nợ hoặc phá sản nếu hết tài sản)*. |
| **10** | 🏍️ **Bốc Thăm Trúng SH** | Mua hàng siêu thị may mắn bốc thăm trúng xe tay ga: Bán xe **nhận ngay 1.200.000 đ**. |
| **11** | 💵 **Hoàn Thuế Thu Nhập** | Quyết toán thuế cuối năm phát hiện nộp thừa: **Nhận lại 800.000 đ** từ Ngân hàng. |
| **12** | 🔄 **Đổi Hướng Phong Thủy** | Thầy phong thủy khuyên đổi vận: **Lùi lại 3 ô** và kích hoạt hiệu ứng của ô mới đến *(nếu lùi ngang qua ô Khởi Hành `0` thì **KHÔNG nhận 3M**; nhưng tới lượt đi tiến tiếp theo bước qua `0` vẫn được nhận đủ 3M bình thường; nếu lùi trúng ô Đấu Giá chưa chốt vẫn được hỏi tham gia đấu giá)*. |
| **13** | 🛡️ **Bảo Hiểm Bồi Thường** | Hợp đồng bảo hiểm tài sản đáo hạn và chi trả quyền lợi: **Nhận 1.000.000 đ**. |
| **14** | 🎁 **Nhặt Được Của Rơi** | Nhặt được ví tiền trả lại người đánh mất: Được tuyên dương người tốt việc tốt, **thưởng 500.000 đ**. |
| **15** | ⛽ **Trợ Giá Xăng Dầu** | Nhà nước ban hành gói hỗ trợ kích cầu vận tải: **Nhận 600.000 đ**. |
| **16** | ⛓️ **Tống Giam Khẩn Cấp** | Bị cơ quan điều tra triệu tập vì hành vi trốn thuế: **Đi thẳng vào Nhà Tù** (áp dụng đầy đủ quy trình tạm giam tối đa 3 lượt)! |

---

### B. 16 THẺ KHÍ VẬN (NGHĨA VỤ, RỦI RO, HÀI HƯỚC)

| STT | Tên Thẻ Bài | Mô Tả & Hiệu Ứng Trò Chơi |
| :---: | :--- | :--- |
| **01** | ⛓️ **Đại Án Kinh Tế** | Bị thanh tra phát hiện sai phạm hồ sơ đất đai: **Đi thẳng vào tù ngay lập tức**, không qua Khởi Hành! |
| **02** | 🎟️ **Lệnh Ân Xá Đặc Biệt** | Được hưởng ân xá đặc xá nhân dịp đại lễ: **Giữ thẻ này để dùng ra tù miễn phí 1 lần**. |
| **03** | 🌪️ **Sửa Nhà Sau Bão Lũ** | Bão đổ bộ làm tốc mái công trình: **Nộp phạt 200.000 đ/nhà Cấp 1-4** và **800.000 đ/Biệt thự** đang có. |
| **04** | 💒 **Mừng Cưới Bạn Thân** | Đi đám cưới linh đình tại khách sạn 5 sao: **Mừng phong bì 300.000 đ cho TẤT CẢ người chơi khác còn sống** *(tổng chi tối đa `1.500.000 đ` nếu đủ 6 người; nếu thiếu tiền mặt, hệ thống mở bán tài sản trả nợ và chia theo thứ tự lượt kế tiếp)*. |
| **05** | 🚨 **Phạt Nguội Vượt Đèn** | Camera AI phạt nguội vi phạm tốc độ và vượt đèn đỏ: **Nộp phạt 500.000 đ** vào kho bạc. |
| **06** | 🌊 **Xe Ngập Nước Thủy Kích** | Mưa ngập đường Nguyễn Hữu Cảnh xe chết máy: **Tốn 700.000 đ** tiền cứu hộ kéo về xưởng sửa chữa. |
| **07** | 🏥 **Ăn Nhầm Dị Ứng** | Đi ăn ốc đêm vỉa hè bị ngộ độc thực phẩm: **Nộp viện phí cấp cứu 600.000 đ**. |
| **08** | 🎓 **Đóng Học Phí Quốc Tế** | Đến kỳ đóng học phí du học cho con: **Nộp 1.000.000 đ** cho trường học. |
| **09** | ❄️ **Hỏng Máy Lạnh Mùa Nắng** | Khách sạn bị du khách phàn nàn máy lạnh hư giữa trưa hè 40 độ: **Bồi thường 400.000 đ**. |
| **10** | 🤝 **Quỹ Vì Người Nghèo** | Tham gia đóng góp xây cầu nông thôn và nhà tình nghĩa: **Ủng hộ 500.000 đ** vào quỹ từ thiện. |
| **11** | 🍻 **Khao Tiệc Tân Gia** | Mua đất mới khao bạn bè một chầu bia hơi thả ga: **Chi trả 600.000 đ**. |
| **12** | 👛 **Bị Móc Túi Tại Bến Xe** | Sơ ý bị kẻ gian móc ví tại bến xe đông đúc: **Mất trắng 800.000 đ**. |
| **13** | 🚰 **Bảo Trì Vỡ Ống Nước** | Hệ thống cấp nước sinh hoạt bị rò rỉ: **Nộp 150.000 đ/nhà Cấp 1-4** và **500.000 đ/Biệt thự**. |
| **14** | 📋 **Chậm Kê Khai Thuế** | Kế toán nộp trễ tờ khai thuế môn bài: **Nộp phạt hành chính 400.000 đ**. |
| **15** | 🪪 **Làm Lại Giấy Tờ** | Bị mất căn cước công dân và bằng lái xe: **Tốn 300.000 đ** phí cấp đổi lại. |
| **16** | ⛓️ **Gây Rối Trật Tự** | Say xỉn gây rối trật tự khu phố lúc nửa đêm: **Bị đưa về đồn công an, đi thẳng vào Nhà Tù** (áp dụng quy trình tạm giam tối đa 3 lượt)! |

---

## VI. CÁC CƠ CHẾ ĐẶC SẮC KHÁC

### 1. Cài Đặt Chế Độ Xúc Xắc Từ Đầu Ván (1 Hoặc 2 Xúc Xắc)
- **Cài đặt thống nhất từ đầu trận**: Khi tạo phòng hoặc bắt đầu ván mới, người chơi lựa chọn **Chế độ 1 Xúc Xắc** hoặc **Chế độ 2 Xúc Xắc**. Tất cả người chơi và Máy (Bot) trong ván đấu đều áp dụng chung chế độ này trong suốt cả ván cờ.
- **Điểm xúc xắc ra ngẫu nhiên 100%**: Sử dụng thuật toán sinh số ngẫu nhiên chuẩn (PRNG/Web Crypto), điểm số hoàn toàn công bằng và may rủi:
  - Với **Chế độ 1 xúc xắc**: Điểm ra ngẫu nhiên từ 1 đến 6.
  - Với **Chế độ 2 xúc xắc**: Điểm ra ngẫu nhiên từ 2 đến 12. Nếu gieo được **2 xúc xắc cùng số (Đổ Đôi)**, người chơi được gieo xúc xắc đi tiếp thêm 1 lượt! *(Đổ đôi 3 lần liên tiếp bị bắt vào tù vì tội gian lận xúc xắc).*

### 2. Cơ Chế Đấu Giá Qua Từng Lượt Dẫm Ô (4 Bến Xe Lớn)
Áp dụng cho **4 Ô Đấu Giá**: *Bến xe Phương Trang, Bến xe Miền Đông, Bến xe Miền Tây, Bến xe Giáp Bát*:

1. **Điều kiện kích hoạt (Chỉ đấu giá khi di chuyển vào đúng ô)**:
   - Không ai được tự ý đấu giá từ xa khi không đứng trên ô.
   - Hệ thống **chỉ hỏi đấu giá** khi một người chơi (chưa bỏ quyền / chưa bị loại) **quay xúc xắc hoặc chịu hiệu ứng thẻ bài (như Lùi 3 ô) dẫm vào đúng ô Đấu Giá chưa chốt chủ**.
2. **Giá khởi điểm & Bước giá `+200.000 đ` theo Đặt Cọc Bù Chênh Lệch**:
   - **Khi ô chưa có ai mở giá (`0 đ`)**: Người dẫm vào được hỏi *"Bạn có muốn mở đấu giá ô này với giá **2.000.000 đ** không?"*. Nếu chọn tham gia (và đủ 2M) → nộp ngay **2.000.000 đ** giữ cọc và trở thành người dẫn đầu. Nếu từ chối (hoặc thiếu 2M) → ô vẫn giữ mức `0 đ` (người này chưa bị mất quyền vĩnh viễn cho tới khi thực sự có người mở phiên `>= 2M`).
   - **Khi ô đã có người mở giá (`>= 2.000.000 đ`)**: Bất kỳ người chơi nào khác (hoặc người đã cọc trước đó nhưng đang bị người khác dẫn trước) khi dẫm vào ô này đều được hệ thống hỏi:
     - **Nâng giá thêm `+200.000 đ`**: Giá hiện tại của ô tăng cố định **`+200.000 đ`**. Người nâng giá chỉ phải **nộp thêm phần tiền chênh lệch** để tổng số tiền mình đã đặt cọc trong ô bằng đúng mức giá mới:
       - *Ví dụ 2 người*: A vào đầu nộp **2.000.000 đ** (giá ô = 2M). Lượt sau B dẫm vào, chọn nâng lên **2.200.000 đ** (B nộp **2.200.000 đ**). Lượt sau A quay lại dẫm vào, giá tăng +200k lên **2.400.000 đ** → A đã cọc sẵn 2M nên chỉ cần **nộp thêm `400.000 đ`**!
       - *Ví dụ 3 người*: Nếu sau B (`2.2M`), C dẫm vào nâng lên **2.400.000 đ** (C nộp `2.4M`), thì khi A quay lại muốn nâng lên **2.600.000 đ**, A cần nộp thêm **`600.000 đ`** (`2.6M - 2.0M`).
     - *(Nếu chính người **đang dẫn đầu giá cao nhất** dẫm lại vào ô khi chưa có ai vượt giá mình: không cần đấu giá tiếp, giữ nguyên vị trí dẫn đầu).*
3. **Từ bỏ quyền, Bị loại & Hoàn lại tiền từng đấu giá**:
   - Khi dẫm vào ô đang đấu giá (đã có mức `>= 2M`), nếu người chơi bấm **Bỏ quyền đấu giá** hoặc **không đủ tiền mặt bù lên mức giá mới (`Giá hiện tại + 200k`)**:
     - Người đó chính thức bị **loại khỏi phiên đấu giá của ô này** (không còn được tham gia nâng giá ô này nữa).
     - Nếu trước đó người này đã từng đặt cọc tiền vào ô, hệ thống lập tức **hoàn lại 100% số tiền họ từng đấu giá/đặt cọc** vào ví tiền mặt.
   - **Quy tắc khóa cọc & khi bị Phá sản**: Tiền đã cọc vào ô bị khóa cứng cho tới khi phiên ngã ngũ, người đó dẫm lại ô và bỏ quyền/bị loại, hoặc bị Phá sản. Nếu một người đang có tiền cọc bị **Phá sản** ở nơi khác, toàn bộ tiền cọc đó được gộp vào tài sản trả chủ nợ và họ bị loại khỏi phiên (nếu họ từng dẫn đầu, quyền dẫn đầu trả về cho người giữ giá cao kế tiếp trước đó, hoặc reset ô về `0 đ` nếu không còn ai từng đặt cọc).
4. **Chốt quyền sở hữu & Thu tiền thuê (Chia đôi tiền đất)**:
   - Trong lúc chưa chốt, ô giữ trạng thái **Đang đấu giá**: **chưa thu tiền thuê**, **chưa tính** vào điều kiện thắng *4 ô đấu giá* hay *1 đường thẳng*.
   - **Chỉ khi tất cả các đối thủ còn sống sót khác đều đã Bỏ quyền hoặc Bị loại**, chỉ còn **duy nhất 1 người cuối cùng**, ô Đấu Giá mới chính thức thuộc quyền sở hữu của người đó với **Giá Đất = Giá Chốt Đấu Giá Cuối Cùng**.
   - **Tiền thuê khi đối thủ dẫm vào ô Đấu Giá đã có chủ = `Giá Chốt / 2` (bằng 50% tiền đất chốt đấu giá)** *(Vẫn áp dụng quy tắc phong tỏa tài sản nếu chủ sở hữu đang ở trong tù).*

### 3. Ô Sân Bay — Điểm Đến Công Khai Luân Phiên
- Mỗi ô Sân Bay (**Sân Bay Tân Sơn Nhất** & **Sân Bay Nội Bài**) luôn **hiển thị công khai sẵn 1 địa danh điểm đến tiếp theo** trên bàn cờ.
- Điểm đến của Sân Bay **chỉ được bốc ngẫu nhiên từ 30 Ô Đất Địa Danh** *(tuyệt đối không bay vào ô Đấu Giá, Cơ Hội, Khí Vận, Thuế, Di Sản hay Nhà Tù)*.
- Khi người chơi dừng chân tại Sân Bay (hoặc dùng thẻ *Vé Máy Bay Hạng Nhất*):
  1. Hoạt ảnh máy bay lập tức chở quân cờ bay thẳng tới đúng **Ô Đất Địa Danh đang hiển thị trên Sân Bay đó** và kích hoạt sự kiện tại ô đích (mua đất trống / nộp tiền thuê / nâng +1 cấp nếu là đất của mình). *(Chuyến bay thẳng không tính là đi ngang qua ô Khởi Hành).*
  2. Ngay sau khi chuyến bay hoàn thành, ô Sân Bay tự động **đổi ngẫu nhiên sang 1 Ô Đất Địa Danh mới** để hiển thị cho lượt bay tiếp theo.

### 4. Luật Toàn Diện Về Nhà Tù, Thăm Tù & Phong Tỏa Tài Sản
Bàn cờ có 2 ô riêng biệt liên quan đến Tù: **Ô Bị Bắt Vào Tù** (Áp giải) và **Ô Nhà Tù** (Nơi giam giữ & thăm nuôi).

#### A. Phí Thăm Tù (Khi Người Tự Do Dừng Chân Hợp Pháp)
- Người chơi tự do khi vô tình dừng chân tại ô **Nhà Tù** được tính là đến **Thăm Tù**: Phải tốn **500.000 đ tiền thăm nuôi** nộp cho Ngân hàng.

#### B. Quy Trình Bị Bắt & Điều Kiện Ra Tù (Tối Đa 3 Lượt)
1. **Khi bị Bắt Vào Tù**: Quân cờ được áp giải ngay lập tức tới ô **Nhà Tù** (không đi qua ô Khởi Hành, không nhận 3M). Lượt đi đó kết thúc ngay lập tức.
2. **Thời Điểm Được Thực Hiện Ra Tù**: Phải **đợi đến lượt đi tiếp theo** mới được thực hiện các cách ra tù.
3. **Các Cách Ra Tù Hợp Pháp**:
   - **Cách 1 - Dùng Thẻ Miễn Vào Tù**: Nếu có Thẻ Miễn Vào Tù (từ Cơ Hội / Khí Vận), người chơi chọn dùng thẻ để được ra tù ngay lập tức; tuy nhiên **không được quay xúc xắc nữa và kết thúc lượt ngay** (chờ lượt sau di chuyển).
   - **Cách 2 - Gieo Xúc Xắc Thử Vận May (và Hỏi Nộp Bảo Lãnh 1M nếu trượt)**:
     - Ở chế độ **2 xúc xắc**: Phải gieo được **2 xúc xắc cùng số (Đổ Đôi)** thì ra tù ngay và **đi tiếp đúng số nút vừa đổ** (không được thưởng thêm lượt Đổ Đôi).
     - Ở chế độ **1 xúc xắc**: Phải gieo trúng **mặt số 6** thì ra tù ngay và **đi tiếp đúng 6 ô vừa đổ**.
     - **Nếu gieo không trúng Đôi / không trúng mặt số 6**: Hệ thống lập tức hỏi người chơi: *"Bạn có muốn nộp **1.000.000 đ** tiền bảo lãnh để ra tù không?"*:
       - Nếu chọn **Có** (và đủ 1M tiền mặt): Nộp 1.000.000 đ cho Ngân hàng → được ra tù và kết thúc lượt (chờ lượt kế tiếp đi).
       - Nếu chọn **Không**: Tiếp tục ở lại trong tù.
4. **Cưỡng Chế Ra Tù Sau 3 Lượt (Tối Đa 3 Lượt)**:
   - Người chơi ở trong tù **tối đa 3 lượt**.
   - Nếu hết lượt thứ 3 gieo vẫn không ra được (và chưa nộp tiền trước đó): Hệ thống **cưỡng chế bắt buộc nộp 1.000.000 đ** để ra tù (kết thúc lượt, chờ lượt sau đi).
   - **Nếu không đủ 1.000.000 đ tiền mặt**: Người chơi bắt buộc phải mở màn hình **chọn bán nhà/bán đất trả nợ** cho đủ 1M; nếu bán sạch toàn bộ tài sản vẫn không đủ 1M thì tuyên bố **Phá Sản**!

#### C. Quy Tắc Phong Tỏa Tài Sản Khi Chủ Đất Đang Ở Tù
- **Khi chủ đất đang ngồi tù, nếu người chơi khác dẫm vào ô đất, nhà, bến xe đấu giá hay nhà máy tiện ích của người này thì HOÀN TOÀN KHÔNG BỊ THU TIỀN THUÊ**!
- *Ý nghĩa chiến thuật*: Vì chủ nhà đang chịu án giam giữ nên tài sản tạm thời bị phong tỏa, mất toàn bộ nguồn thu từ tiền thuê. Luật này khiến việc ở trong tù trở thành một thiệt hại kinh tế nặng nề, buộc người chơi phải cân nhắc trả 1M hoặc giữ thẻ miễn tù để thoát sớm.

---

### 5. Cơ Chế 2 Ô Tiện Ích (Thủy Điện Hòa Bình & Thủy Điện Trị An)
- **Giá Mua Cố Định**: **2.000.000 đ** mỗi nhà máy từ Ngân hàng.
- **Cách Tính Tiền Thuê (Phụ Thuộc Vào Điểm Xúc Xắc Vừa Gieo)**:
  - Nếu chủ nhà máy sở hữu **1 nhà máy**: Tiền thu = $\text{Số điểm xúc xắc vừa gieo} \times 100.000 \text{ đ}$ (tối đa thu 1.200.000 đ nếu gieo 12 điểm).
  - Nếu chủ nhà máy sở hữu trọn bộ **cả 2 nhà máy**: Tiền thu = $\text{Số điểm xúc xắc vừa gieo} \times 250.000 \text{ đ}$ (tối đa thu 3.000.000 đ nếu gieo 12 điểm).
  - *Ý nghĩa game*: Tiền thu điện nước biến động ngẫu nhiên theo từng lượt đổ xúc xắc, mang lại sự hồi hộp và bất ngờ!

### 6. Thời Gian Lượt Chơi (Thư Thả - Không Giới Hạn)
- **Không Giới Hạn Thời Gian Mỗi Lượt (No Timer)**: Trong mọi chế độ (Trên Thiết Bị với Người/Máy hay Online PIN sau này), hệ thống không đếm ngược thời gian gấp gáp, cho phép người chơi thoải mái tính toán dòng tiền, suy nghĩ chiến thuật và trò chuyện vui vẻ cùng bạn bè.

---

## VII. 3 ĐIỀU KIỆN CHIẾN THẮNG & XỬ LÝ PHÁ SẢN

Khác với cờ tỷ phú cổ điển chỉ thắng bằng phá sản, trò chơi sở hữu **3 điều kiện thắng song song** (cả 2 điều kiện thắng nhanh đều kích hoạt kết thúc ván đấu ngay lập tức):

### 1. Ba Điều Kiện Chiến Thắng Ván Cờ

| Loại Chiến Thắng | Điều Kiện Kích Hoạt | Ý Nghĩa Chiến Thuật |
| :--- | :--- | :--- |
| **1. Thắng 1 Đường Thẳng (Line Victory)** | Một người chơi sở hữu trọn vẹn **TẤT CẢ các ô có thể mua trên cùng 1 cạnh bàn cờ** (gồm đủ **9 ô mua được** trên cạnh đó: toàn bộ Ô Đất Địa Danh + Ô Đấu Giá đã chốt thắng + Ô Tiện Ích nếu nằm trên cạnh đó; không bắt buộc phải xây nhà trên các ô đất). | Tạo cuộc đua chặn đầu kịch tính trên từng cạnh: chỉ cần sở hữu toàn bộ 9 ô tài sản dọc 1 cạnh là thắng ngay! |
| **2. Thắng Trọn 4 Ô Đấu Giá (4-Auction Victory)** | Một người chơi thắng và đứng tên sở hữu chính thức **cả 4 Ô Đấu Giá (4 Bến Xe Lớn)**. | Biến các phiên đấu giá Bến Xe thành chiến trường căng thẳng: ai ôm 3 Bến Xe rồi thì cả bàn phải dốc sức chặn ở Bến Xe thứ 4! |
| **3. Thắng Sinh Tồn (Last Man Standing)** | Tất cả các đối thủ khác trong ván đều đã bị **Phá Sản**, chỉ còn lại **duy nhất 1 người sống sót**. | Kéo dài cuộc chiến kinh tế truyền thống tới người giàu mạnh nhất cuối cùng. |

### 2. Cơ Chế Xử Lý Khi Có Người Phá Sản
- **Định Nghĩa Phá Sản Chuẩn Xác**: Phá sản chỉ xảy ra khi một người chơi bị rơi vào tình trạng thiếu tiền và **sau khi đã bán sạch toàn bộ nhà cửa, đất đai, bến xe đã sở hữu và nhà máy tiện ích của mình mà tổng số tiền vẫn KHÔNG ĐỦ để thanh toán khoản nợ** *(bao gồm nợ tiền thuê, thuế, thẻ phạt hoặc tiền cưỡng chế 1M ra tù ở lượt 3)*.
- **Chuyển Giao Toàn Bộ Tiền Cho Chủ Nợ**:
  - Toàn bộ số tiền mặt còn lại (bao gồm tiền mặt sẵn có + tiền thu được từ việc bán tháo toàn bộ bất động sản cho Ngân hàng + bất kỳ khoản tiền cọc nào đang bị khóa trong các ô Đấu Giá chưa chốt) sẽ được **chuyển giao 100% cho chủ nợ** (Người chơi đang đòi tiền thuê đất, hoặc nộp hết cho Ngân hàng nếu nợ Thuế/Thẻ phạt/Bảo lãnh tù).
  - Người bị phá sản chính thức dừng cuộc chơi với số dư 0 đ.
- **Tịch Thu & San Phẳng Đất Về Trạng Thái Trống**:
  - Toàn bộ các ô đất, bến xe đã sở hữu và nhà máy tiện ích mà người phá sản vừa bán ra đều bị xóa sạch mọi công trình nhà cửa/biệt thự.
  - Các ô đất/tiện ích lập tức trở về **trạng thái Đất Trống nguyên thủy trên bàn cờ**; các ô Đấu Giá mà người phá sản từng thắng sở hữu cũng trở về trạng thái chưa có chủ (`0 đ`) để mở lại đấu giá khi có người dừng chân; còn các ô đang đấu giá dở thì người phá sản bị loại khỏi phiên (trả quyền dẫn đầu về người đứng kế trước nếu có, hoặc reset về `0 đ` nếu không còn ai).
- **Bảng Vinh Danh Cuối Trận**: Khi ván cờ kết thúc (theo bất kỳ điều kiện nào trong 3 điều kiện thắng), màn hình hiển thị Bảng Tổng Kết Tài Sản chi tiết:
  - Tên, hình thức chiến thắng (Thắng 1 Đường Thẳng / Thắng 4 Ô Đấu Giá / Nhà Vô Địch Sinh Tồn) và danh hiệu của Nhà Vô Địch.
  - Tổng tài sản cuối cùng (Tiền mặt + Giá trị đất đai và công trình).
  - Bảng xếp hạng thứ hạng (Hạng 1, 2, 3...) của tất cả người chơi.
