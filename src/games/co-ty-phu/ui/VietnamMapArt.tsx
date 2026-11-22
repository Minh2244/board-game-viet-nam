/**
 * Bản đồ địa lý Việt Nam chuẩn hình chữ S (từ biên giới & đường bờ biển thực tế)
 * kết hợp Trống Đồng Đông Sơn, Sông Hồng, Sông Mê Kông, Phú Quốc, Côn Đảo, Hoàng Sa & Trường Sa.
 */

const VIETNAM_MAINLAND_PATH =
  'M 283.9 92.8 L 266.1 100.2 L 264.3 107.7 L 258.4 111.2 L 243.1 109.5 L 245.3 118.3 L 238.9 125.1 L 237.9 132.9 L 221.0 144.5 L 209.6 176.5 L 218.0 191.7 L 237.3 210.0 L 236.7 217.5 L 232.8 216.0 L 279.5 263.5 L 285.7 263.2 L 310.7 294.5 L 326.0 344.6 L 325.0 363.6 L 329.8 374.2 L 330.5 385.9 L 327.0 380.9 L 323.3 384.4 L 326.0 392.8 L 322.9 392.0 L 324.6 407.2 L 323.2 405.3 L 321.7 408.6 L 322.7 414.7 L 317.7 419.1 L 316.0 427.5 L 310.7 428.2 L 287.8 442.0 L 284.8 447.8 L 261.4 458.4 L 255.9 455.1 L 253.4 449.7 L 251.5 458.3 L 244.5 453.9 L 240.7 456.2 L 245.0 456.9 L 245.5 461.8 L 236.2 461.7 L 246.4 467.7 L 240.4 476.1 L 225.8 464.2 L 237.6 477.4 L 239.6 483.3 L 233.5 486.1 L 216.2 471.5 L 226.5 484.8 L 226.8 491.3 L 205.7 501.3 L 193.5 516.6 L 182.6 517.6 L 186.6 512.7 L 184.1 510.9 L 185.0 484.4 L 186.8 477.5 L 192.8 474.7 L 192.6 471.6 L 183.6 464.8 L 179.2 465.9 L 171.7 458.0 L 176.1 454.5 L 185.2 453.9 L 191.4 448.4 L 191.3 441.5 L 199.8 443.7 L 202.1 440.6 L 213.8 438.9 L 216.9 443.1 L 226.7 445.3 L 226.6 437.4 L 217.0 428.9 L 216.8 417.7 L 221.7 413.6 L 234.1 416.0 L 234.6 407.4 L 243.7 406.4 L 259.9 395.7 L 265.6 397.1 L 269.2 393.7 L 268.2 371.8 L 272.3 358.4 L 263.6 335.7 L 270.1 318.5 L 268.3 307.6 L 273.8 298.6 L 258.4 280.6 L 265.5 275.7 L 265.7 272.6 L 251.0 262.4 L 248.4 257.1 L 242.3 257.9 L 237.4 242.7 L 211.8 216.9 L 204.4 203.2 L 193.5 194.9 L 194.5 186.8 L 180.9 181.8 L 154.8 165.3 L 160.2 159.5 L 159.3 153.1 L 176.9 155.0 L 187.6 141.9 L 185.1 135.8 L 180.4 135.7 L 177.8 130.1 L 170.7 128.5 L 176.7 121.2 L 161.5 111.3 L 146.7 119.5 L 129.9 113.1 L 121.9 100.8 L 125.0 87.1 L 120.8 83.0 L 115.9 87.3 L 113.4 79.8 L 99.0 64.2 L 109.9 51.9 L 126.1 61.9 L 137.0 51.3 L 141.5 57.0 L 146.2 50.9 L 156.4 58.9 L 162.8 50.3 L 170.0 53.5 L 180.0 49.6 L 183.4 46.7 L 184.4 40.4 L 198.6 32.4 L 207.2 41.4 L 216.5 46.3 L 226.2 44.7 L 230.3 48.4 L 238.7 46.8 L 246.2 51.0 L 238.9 60.1 L 242.5 77.3 L 252.2 79.1 L 264.3 89.5 L 277.2 88.0 Z';

const PHU_QUOC_PATH =
  'M 160.3 458.6 L 160.9 460.3 L 160.7 464.1 L 159.4 467.8 L 159.8 469.5 L 158.8 470.5 L 156.7 463.5 L 153.5 459.3 L 155.0 459.4 L 157.8 457.4 L 159.1 457.4 Z';

const CAT_BA_PATH =
  'M 254.1 117.9 L 252.8 118.0 L 250.3 115.3 L 251.7 113.9 L 254.5 114.9 L 255.2 116.1 Z';

const VAN_DON_PATH =
  'M 269.6 112.0 L 267.9 112.8 L 265.8 112.7 L 268.3 111.1 L 270.6 108.4 L 270.6 110.2 Z';

export function VietnamMapArt() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Lưới hải đồ cổ điển + sóng Biển Đông nhẹ + hoa gió la bàn */}
      <svg
        viewBox="0 0 1100 560"
        className="absolute inset-0 h-full w-full opacity-[0.17]"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="mapHalo" cx="50%" cy="48%" r="52%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#07263B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="550" cy="270" rx="470" ry="245" fill="url(#mapHalo)" />
        {[105, 190, 275, 360, 445].map((y) => (
          <line key={y} x1="20" y1={y} x2="1080" y2={y} stroke="#FDE68A" strokeWidth="0.9" strokeDasharray="4 6" />
        ))}
        {[180, 365, 550, 735, 920].map((x) => (
          <line key={x} x1={x} y1="15" x2={x} y2="545" stroke="#BAE6FD" strokeWidth="0.8" strokeDasharray="4 7" />
        ))}
        {/* Gợn sóng Biển Đông cổ điển */}
        <path d="M720 185 Q740 177 760 185 T800 185" fill="none" stroke="#BAE6FD" strokeWidth="1.6" />
        <path d="M750 285 Q770 277 790 285 T830 285" fill="none" stroke="#BAE6FD" strokeWidth="1.6" />
        <path d="M295 340 Q315 332 335 340 T375 340" fill="none" stroke="#BAE6FD" strokeWidth="1.4" />

        {/* Hoa gió la bàn cổ điển góc dưới-trái */}
        <g transform="translate(132 456)" opacity="0.82">
          <circle cx="0" cy="0" r="32" fill="none" stroke="#FDE68A" strokeWidth="1.3" strokeDasharray="3 3" />
          <circle cx="0" cy="0" r="22" fill="none" stroke="#FDE68A" strokeWidth="1" />
          <polygon points="0,-30 5.5,-5.5 30,0 5.5,5.5 0,30 -5.5,5.5 -30,0 -5.5,-5.5" fill="#FDE68A" opacity="0.55" />
          <polygon points="0,-22 3.8,-3.8 22,0 3.8,3.8 0,22 -3.8,3.8 -22,0 -3.8,-3.8" fill="#FEF9C3" opacity="0.9" />
          <text x="0" y="-36" textAnchor="middle" fill="#FEF08A" fontSize="9.5" fontWeight="900">B</text>
          <text x="0" y="44" textAnchor="middle" fill="#FEF08A" fontSize="9.5" fontWeight="900">N</text>
          <text x="39" y="3" textAnchor="middle" fill="#FEF08A" fontSize="9.5" fontWeight="900">Đ</text>
          <text x="-39" y="3" textAnchor="middle" fill="#FEF08A" fontSize="9.5" fontWeight="900">T</text>
        </g>
      </svg>

      {/* Hoa văn Trống Đồng Đông Sơn xoay chậm sắc nét */}
      <svg
        viewBox="0 0 520 520"
        className="absolute h-[290px] w-[290px] animate-[spin_105s_linear_infinite] opacity-[0.23] sm:h-[385px] sm:w-[385px] lg:h-[435px] lg:w-[435px]"
      >
        <circle cx="260" cy="260" r="244" fill="none" stroke="#FDE68A" strokeWidth="2.4" strokeDasharray="12 6" />
        <circle cx="260" cy="260" r="224" fill="none" stroke="#FEF08A" strokeWidth="1.5" />
        <circle cx="260" cy="260" r="184" fill="none" stroke="#FDE68A" strokeWidth="1.6" strokeDasharray="4 4" />
        <circle cx="260" cy="260" r="142" fill="none" stroke="#FEF08A" strokeWidth="1.2" />
        <circle cx="260" cy="260" r="96" fill="none" stroke="#FDE68A" strokeWidth="1.2" strokeDasharray="6 4" />

        {Array.from({ length: 16 }).map((_, idx) => {
          const deg = idx * 22.5;
          return (
            <g key={deg} transform={`rotate(${deg} 260 260)`}>
              <polygon points="260,18 265,54 255,54" fill="#FDE68A" opacity="0.78" />
              <line x1="260" y1="68" x2="260" y2="108" stroke="#FEF08A" strokeWidth="1.5" opacity="0.7" />
              <circle cx="260" cy="162" r="3" fill="#FDE68A" opacity="0.82" />
            </g>
          );
        })}
      </svg>

      {/* BẢN ĐỒ ĐỊA LÝ VIỆT NAM CHUẨN CHỮ S — SẮC NÉT, ĐẦY ĐỦ QUẦN ĐẢO HOÀNG SA & TRƯỜNG SA */}
      <svg
        viewBox="64 14 452 528"
        className="relative -mt-3 h-[92%] max-h-[420px] w-auto opacity-[0.72] drop-shadow-[0_10px_22px_rgba(0,0,0,0.55)]"
      >
        <defs>
          <linearGradient id="vnHeritageLand" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="32%" stopColor="#E6B94A" />
            <stop offset="68%" stopColor="#C8932E" />
            <stop offset="100%" stopColor="#9A6820" />
          </linearGradient>
          <linearGradient id="vnInnerHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#FEF08A" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#451A03" stopOpacity="0.22" />
          </linearGradient>
          <clipPath id="vnMainlandClip">
            <path d={VIETNAM_MAINLAND_PATH} />
          </clipPath>
        </defs>

        {/* Vành sóng biển ven bờ phát sáng lam ngọc bao quanh toàn bộ đường bờ biển Việt Nam */}
        <path
          d={VIETNAM_MAINLAND_PATH}
          fill="none"
          stroke="#7DD3FC"
          strokeWidth="12"
          strokeLinejoin="round"
          opacity="0.2"
        />
        <path
          d={VIETNAM_MAINLAND_PATH}
          fill="none"
          stroke="#E0F2FE"
          strokeWidth="5"
          strokeLinejoin="round"
          opacity="0.26"
        />

        {/* Thân đất liền chữ S Việt Nam chuẩn địa lý */}
        <path
          d={VIETNAM_MAINLAND_PATH}
          fill="url(#vnHeritageLand)"
          stroke="#78350F"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />

        {/* Lớp nổi địa hình + Sông Hồng + Dãy Trường Sơn + Sông Mê Kông nằm gọn bên trong đất liền */}
        <g clipPath="url(#vnMainlandClip)">
          <rect x="64" y="14" width="452" height="528" fill="url(#vnInnerHighlight)" />
          {/* Đường phân vùng địa lý Bắc – Trung – Nam siêu mảnh cổ điển */}
          <path d="M 150 175 Q 200 182 245 190" fill="none" stroke="#78350F" strokeWidth="0.9" strokeDasharray="4 4" opacity="0.38" />
          <path d="M 245 365 Q 290 368 338 360" fill="none" stroke="#78350F" strokeWidth="0.9" strokeDasharray="4 4" opacity="0.38" />

          {/* Sông Hồng (Bắc Bộ) */}
          <path
            d="M 152 58 Q 186 86 216.8 108.6 T 242 136"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.72"
          />
          {/* Dãy Trường Sơn chạy dọc sống lưng miền Trung */}
          <path
            d="M 178 156 Q 216 214 260 272 Q 282 330 296 394"
            fill="none"
            stroke="#FFFBEB"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeDasharray="6 4"
            opacity="0.58"
          />
          {/* Hệ thống sông Cửu Long (Nam Bộ) */}
          <path
            d="M 192 440 Q 208 456 239 476"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.1"
            strokeLinecap="round"
            opacity="0.72"
          />
          <path
            d="M 194 446 Q 206 468 228 488"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.68"
          />
        </g>

        {/* Đảo Phú Quốc, Cát Bà, Vân Đồn & Quần đảo Côn Đảo chuẩn tọa độ địa lý */}
        <path d={PHU_QUOC_PATH} fill="#FEF08A" stroke="#78350F" strokeWidth="1.7" strokeLinejoin="round" />
        <text x="148" y="482" textAnchor="end" fill="#FEF9C3" fontSize="9.5" fontWeight="800" opacity="0.9">
          Phú Quốc
        </text>
        <path d={CAT_BA_PATH} fill="#FEF08A" stroke="#78350F" strokeWidth="1.3" strokeLinejoin="round" />
        <path d={VAN_DON_PATH} fill="#FEF08A" stroke="#78350F" strokeWidth="1.3" strokeLinejoin="round" />
        <g transform="translate(240.5 514.9)">
          <circle cx="0" cy="0" r="3.6" fill="#FEF08A" stroke="#78350F" strokeWidth="1.3" />
          <circle cx="5" cy="-2" r="1.8" fill="#FEF08A" stroke="#78350F" strokeWidth="0.9" />
          <text x="11" y="3.5" textAnchor="start" fill="#FEF9C3" fontSize="9.2" fontWeight="800" opacity="0.88">
            Côn Đảo
          </text>
        </g>

        {/* Chữ BIỂN ĐÔNG cổ điển trang trọng */}
        <text
          x="396"
          y="162"
          textAnchor="middle"
          fill="#BAE6FD"
          fontSize="14.5"
          fontWeight="800"
          letterSpacing="4.5"
          fontFamily="Georgia, serif"
          opacity="0.82"
        >
          BIỂN ĐÔNG
        </text>

        {/* Quần đảo Hoàng Sa */}
        <g transform="translate(399 254)">
          <circle cx="0" cy="0" r="26" fill="rgba(186,230,253,0.08)" stroke="#FEF08A" strokeWidth="1.3" strokeDasharray="3.5 3" opacity="0.88" />
          <circle cx="-7" cy="-6" r="3.2" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
          <circle cx="8" cy="-4" r="2.8" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
          <circle cx="1" cy="7" r="3" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
          <circle cx="-9" cy="6" r="2.1" fill="#FEF08A" stroke="#78350F" strokeWidth="0.9" />
          <text x="0" y="40" textAnchor="middle" fill="#FEF9C3" fontSize="11" fontWeight="900" letterSpacing="1">
            HOÀNG SA
          </text>
        </g>

        {/* Quần đảo Trường Sa */}
        <g transform="translate(446 446)">
          <circle cx="0" cy="0" r="30" fill="rgba(186,230,253,0.08)" stroke="#FEF08A" strokeWidth="1.3" strokeDasharray="3.5 3" opacity="0.88" />
          <circle cx="-10" cy="-7" r="3.2" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
          <circle cx="5" cy="-10" r="2.7" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
          <circle cx="11" cy="4" r="3.1" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
          <circle cx="-3" cy="9" r="3.2" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
          <circle cx="-13" cy="5" r="2.1" fill="#FEF08A" stroke="#78350F" strokeWidth="0.9" />
          <text x="0" y="44" textAnchor="middle" fill="#FEF9C3" fontSize="11" fontWeight="900" letterSpacing="1">
            TRƯỜNG SA
          </text>
        </g>

        {/* Thủ đô Hà Nội (Ngôi sao vàng nền đỏ chuẩn tọa độ) */}
        <g transform="translate(216.8 108.6)">
          <circle cx="0" cy="0" r="8.2" fill="#DC2626" stroke="#FEF08A" strokeWidth="2.2" />
          <polygon points="0,-4.8 1.5,-1.5 5,-1.5 2.1,0.7 3.2,4.2 0,2.1 -3.2,4.2 -2.1,0.7 -5,-1.5 -1.5,-1.5" fill="#FEF08A" />
          <text x="-13" y="-6" textAnchor="end" fill="#FFFBEB" fontSize="12.5" fontWeight="900">
            HÀ NỘI
          </text>
        </g>

        {/* Thành phố Đà Nẵng */}
        <g transform="translate(291.4 272.4)">
          <circle cx="0" cy="0" r="5" fill="#FEF08A" stroke="#78350F" strokeWidth="1.8" />
          <text x="10" y="4" textAnchor="start" fill="#FFFBEB" fontSize="11.5" fontWeight="900">
            ĐÀ NẴNG
          </text>
        </g>

        {/* Thành phố Hồ Chí Minh / Sài Gòn */}
        <g transform="translate(243.7 445.8)">
          <circle cx="0" cy="0" r="6.8" fill="#DC2626" stroke="#FEF08A" strokeWidth="2.1" />
          <circle cx="0" cy="0" r="2.4" fill="#FEF08A" />
          <text x="12" y="4.5" textAnchor="start" fill="#FFFBEB" fontSize="12" fontWeight="900">
            TP.HCM
          </text>
        </g>
      </svg>
    </div>
  );
}
