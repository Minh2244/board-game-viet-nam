export function CornerGoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <circle cx="18" cy="18" r="15" fill="rgba(120,53,15,0.35)" stroke="#FDE68A" strokeWidth="1.8" />
      <polygon
        points="18,6 20.8,13.6 28.8,13.8 22.4,18.6 24.7,26.4 18,21.8 11.3,26.4 13.6,18.6 7.2,13.8 15.2,13.6"
        fill="#FEF08A"
        stroke="#92400E"
        strokeWidth="1"
      />
      <path d="M10 29 L24 29 M20 25.5 L25 29 L20 32.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function CornerJailIcon({ className = 'h-7 w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 36" className={className} aria-hidden="true">
      <rect x="3" y="2" width="58" height="32" rx="4" fill="#0F172A" stroke="#CBD5E1" strokeWidth="2" />
      {[14, 24, 34, 44, 54].map((x) => (
        <g key={x}>
          <rect x={x - 1.8} y="3" width="3.6" height="30" fill="#94A3B8" />
          <rect x={x - 1.5} y="3" width="1.2" height="30" fill="#E2E8F0" />
        </g>
      ))}
      <rect x="4" y="15" width="56" height="3.2" fill="#64748B" />
      <rect x="26" y="12.5" width="12" height="9" rx="2" fill="#F59E0B" stroke="#78350F" strokeWidth="1.2" />
      <circle cx="32" cy="17" r="1.8" fill="#451A03" />
    </svg>
  );
}

export function CornerParkingIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect x="4" y="4" width="28" height="28" rx="7" fill="#1D4ED8" stroke="#FDE68A" strokeWidth="2" />
      <path
        d="M13 26 V10 H20.5 C24 10 26 12 26 15.2 C26 18.4 24 20.4 20.5 20.4 H16.5 V26 Z M16.5 17.2 H20 C21.6 17.2 22.5 16.4 22.5 15.2 C22.5 14 21.6 13.2 20 13.2 H16.5 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/** Máy bay thương mại 3D cất cánh qua tầng mây rực rỡ cho ô góc Sân Bay Quốc Tế (ô 26) */
export function CornerAirplaneIcon({ className = 'h-12 w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 84" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="airBody3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
        <linearGradient id="airWing3d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      {/* Mây bông trắng nổi 3D */}
      <ellipse cx="24" cy="66" rx="22" ry="9.5" fill="#FFFFFF" opacity="0.86" />
      <ellipse cx="38" cy="61" rx="15" ry="8.5" fill="#FFFFFF" opacity="0.92" />
      <ellipse cx="96" cy="68" rx="23" ry="9.5" fill="#FFFFFF" opacity="0.82" />
      <ellipse cx="83" cy="63" rx="14" ry="7.5" fill="#FFFFFF" opacity="0.9" />
      {/* Máy bay thương mại cất cánh nghiêng năng động */}
      <g transform="translate(60,38) rotate(-18) translate(-60,-38)">
        <path
          d="M44 37 L18 13 L33 13 L65 34 Z"
          fill="url(#airWing3d)"
          stroke="#0369A1"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M54 44 L36 69 L50 69 L72 44 Z"
          fill="url(#airWing3d)"
          stroke="#0369A1"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M22 33 L11 19 L22 19 L34 33 Z"
          fill="#0284C7"
          stroke="#FEF08A"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M19 38 C19 31, 46 28, 86 30 C103 31, 110 36, 110 39 C110 43, 101 46, 82 46 L25 45 C20 45, 19 42, 19 38 Z"
          fill="url(#airBody3d)"
          stroke="#0C4A6E"
          strokeWidth="1.6"
        />
        <path d="M88 32 Q98 32 104 36 L93 37 Z" fill="#0F172A" />
        <path d="M27 40.5 L94 40.5" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
        <g fill="#0369A1">
          <circle cx="43" cy="36" r="1.8" />
          <circle cx="51" cy="36" r="1.8" />
          <circle cx="59" cy="36" r="1.8" />
          <circle cx="67" cy="36" r="1.8" />
          <circle cx="75" cy="36" r="1.8" />
        </g>
      </g>
    </svg>
  );
}

/** Còng tay thép 3D & đèn còi cảnh sát đỏ-xanh cho ô góc Vô Tù (ô 42) */
export function CornerGoToJailIcon({ className = 'h-12 w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 84" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="sirenRed3d" cx="35%" cy="28%" r="48%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sirenBlue3d" cx="65%" cy="28%" r="48%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cuffChrome3d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="48%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="24" r="34" fill="url(#sirenRed3d)" />
      <circle cx="78" cy="24" r="34" fill="url(#sirenBlue3d)" />
      {/* Đèn còi cảnh sát 3D */}
      <rect x="40" y="25" width="40" height="6.5" rx="2.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.3" />
      <path d="M44 25 V13.5 A8 8 0 0 1 60 13.5 V25 Z" fill="#EF4444" stroke="#FECACA" strokeWidth="1.2" />
      <path d="M60 25 V13.5 A8 8 0 0 1 76 13.5 V25 Z" fill="#3B82F6" stroke="#BAE6FD" strokeWidth="1.2" />
      {/* Còng tay thép bạc sáng bóng */}
      <circle cx="36" cy="55" r="18.5" fill="none" stroke="#0F172A" strokeWidth="8.5" />
      <circle cx="36" cy="55" r="18.5" fill="none" stroke="url(#cuffChrome3d)" strokeWidth="5.2" />
      <circle cx="84" cy="55" r="18.5" fill="none" stroke="#0F172A" strokeWidth="8.5" />
      <circle cx="84" cy="55" r="18.5" fill="none" stroke="url(#cuffChrome3d)" strokeWidth="5.2" />
      <rect x="51" y="46" width="18" height="6.5" rx="3" fill="url(#cuffChrome3d)" stroke="#0F172A" strokeWidth="1.4" />
    </svg>
  );
}

export function AirportIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path
        d="M14 2.5 L16.2 10.2 L25 13.5 L25 16.2 L16.2 14.5 L15.6 21.2 L19.2 23.4 L19.2 25.4 L14 24.1 L8.8 25.4 L8.8 23.4 L12.4 21.2 L11.8 14.5 L3 16.2 L3 13.5 L11.8 10.2 Z"
        fill="#F8FAFC"
        stroke="#0C4A6E"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StationBusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect x="4" y="5" width="20" height="16" rx="3.5" fill="#FDE68A" stroke="#451A03" strokeWidth="1.5" />
      <rect x="6.5" y="7.5" width="15" height="6.5" rx="1.5" fill="#0F172A" />
      <circle cx="9" cy="17.5" r="1.6" fill="#DC2626" />
      <circle cx="19" cy="17.5" r="1.6" fill="#DC2626" />
      <rect x="6.5" y="21" width="3.5" height="2.8" rx="1" fill="#1E293B" />
      <rect x="18" y="21" width="3.5" height="2.8" rx="1" fill="#1E293B" />
    </svg>
  );
}

export function HydroPowerIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <polygon
        points="16,2 6,15 13.5,15 11.5,26 22,12.5 14.5,12.5"
        fill="#FDE047"
        stroke="#78350F"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeritageCitadelIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path d="M3 12 L14 4 L25 12 Z" fill="#FDE68A" stroke="#78350F" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="5" y="12" width="18" height="12" rx="1" fill="#FEF3C7" stroke="#78350F" strokeWidth="1.2" />
      <path d="M11 24 V17.5 C11 15.8 17 15.8 17 17.5 V24 Z" fill="#92400E" />
      <rect x="7" y="16" width="2.2" height="5" fill="#92400E" />
      <rect x="18.8" y="16" width="2.2" height="5" fill="#92400E" />
    </svg>
  );
}

export function TaxStampIcon({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="taxGold3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
      </defs>
      <circle cx="45" cy="45" r="34" fill="#7F1D1D" stroke="url(#taxGold3d)" strokeWidth="4.2" />
      <circle cx="45" cy="45" r="26" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="2.2" />
      <circle cx="45" cy="45" r="21" fill="none" stroke="#FCA5A5" strokeWidth="1" strokeDasharray="3 2" />
      <text
        x="45"
        y="57"
        textAnchor="middle"
        fill="#991B1B"
        fontSize="36"
        fontWeight="900"
        fontFamily="Georgia, serif"
      >
        ₫
      </text>
      <circle cx="73" cy="21" r="9" fill="url(#taxGold3d)" stroke="#78350F" strokeWidth="1.5" />
    </svg>
  );
}

/** Biểu tượng Cơ Hội (?) 3D ánh mặt trời vàng kim lộng lẫy */
export function ChanceSymbolSvg({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="chSun3d" cx="50%" cy="46%" r="54%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#78350F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="chGold3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="48%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <circle cx="45" cy="45" r="42" fill="url(#chSun3d)" />
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={i}
          x1="45"
          y1="5"
          x2="45"
          y2="14"
          stroke="#FEF08A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.88"
          transform={`rotate(${i * 45} 45 45)`}
        />
      ))}
      <circle cx="45" cy="45" r="30" fill="rgba(120,53,15,0.56)" stroke="url(#chGold3d)" strokeWidth="3.2" />
      <circle cx="45" cy="45" r="24" fill="none" stroke="#FEF08A" strokeWidth="1.3" strokeDasharray="4 3" opacity="0.9" />
      <polygon points="15,17 17,21 21,23 17,25 15,29 13,25 9,23 13,21" fill="#FEF9C3" />
      <polygon points="75,61 77,65 81,67 77,69 75,73 73,69 69,67 73,65" fill="#FEF08A" />
      <text
        x="45"
        y="60"
        textAnchor="middle"
        fill="url(#chGold3d)"
        stroke="#78350F"
        strokeWidth="2.2"
        fontSize="44"
        fontWeight="900"
        fontFamily="Georgia, serif"
      >
        ?
      </text>
    </svg>
  );
}

/** Biểu tượng Khí Vận (!) 3D quả cầu pha lê tím & vòng sao vàng huyền bí */
export function FateSymbolSvg({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ftOrb3d" cx="40%" cy="35%" r="58%">
          <stop offset="0%" stopColor="#FDF4FF" />
          <stop offset="45%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#4C1D95" />
        </radialGradient>
        <linearGradient id="ftRing3d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <ellipse
        cx="45"
        cy="45"
        rx="38"
        ry="15"
        transform="rotate(-24 45 45)"
        fill="none"
        stroke="url(#ftRing3d)"
        strokeWidth="2.8"
        opacity="0.92"
      />
      <circle cx="45" cy="45" r="27" fill="url(#ftOrb3d)" stroke="#F5D0FE" strokeWidth="2.4" />
      <ellipse cx="36" cy="34" rx="7" ry="4" transform="rotate(-25 36 34)" fill="#FFFFFF" opacity="0.58" />
      <polygon points="18,64 20,68 24,70 20,72 18,76 16,72 12,70 16,68" fill="#FEF08A" />
      <polygon points="73,16 74.5,19 77.5,20.5 74.5,22 73,25 71.5,22 68.5,20.5 71.5,19" fill="#F5D0FE" />
      <text
        x="45"
        y="59"
        textAnchor="middle"
        fill="#FFFBEB"
        stroke="#3B0764"
        strokeWidth="2.2"
        fontSize="42"
        fontWeight="900"
        fontFamily="Georgia, serif"
      >
        !
      </text>
    </svg>
  );
}

/** Tòa nhà Ngân Hàng Trung Tâm kiến trúc Đông Dương cổ điển (đối xứng với Nhân Vật) */
export function CentralBankBuildingSvg({
  className = 'h-20 w-28',
  pulseKind,
}: {
  className?: string;
  pulseKind?: 'in' | 'out' | null;
}) {
  const vaultGlow = pulseKind === 'in' ? '#FDE047' : pulseKind === 'out' ? '#34D399' : '#F59E0B';
  return (
    <svg viewBox="0 0 132 88" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bankDome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#0F4C4C" />
        </linearGradient>
        <linearGradient id="bankWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="100%" stopColor="#E6D2A6" />
        </linearGradient>
        <radialGradient id="vaultShine" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="65%" stopColor={vaultGlow} />
          <stop offset="100%" stopColor="#78350F" />
        </radialGradient>
      </defs>

      {/* Mái vòm Đông Dương cổ điển & Chóp vàng */}
      <line x1="66" y1="3" x2="66" y2="11" stroke="#FEF08A" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="66" cy="5" r="2.5" fill="#FDE047" />
      <path d="M30 28 C30 9 102 9 102 28 Z" fill="url(#bankDome)" stroke="#FDE68A" strokeWidth="1.8" />
      <path d="M44 28 C44 15 88 15 88 28" fill="none" stroke="#99F6E4" strokeWidth="1.1" opacity="0.65" />

      {/* Trán mái tam giác cổ điển + Huy hiệu đồng tiền */}
      <polygon points="10,32 66,14 122,32" fill="#FDE68A" stroke="#78350F" strokeWidth="1.8" strokeLinejoin="round" />
      <polygon points="20,30 66,18 112,30" fill="#B45309" opacity="0.88" />
      <circle cx="66" cy="24.5" r="4.8" fill="#FEF08A" stroke="#78350F" strokeWidth="1.1" />
      <text x="66" y="27.5" textAnchor="middle" fill="#78350F" fontSize="8" fontWeight="900" fontFamily="serif">
        ₫
      </text>

      {/* Thanh ngang biển hiệu */}
      <rect x="14" y="32" width="104" height="7" rx="1" fill="#D97706" stroke="#78350F" strokeWidth="1.3" />

      {/* Thân tòa nhà & 4 cột đá cổ điển */}
      <rect x="18" y="39" width="96" height="36" fill="url(#bankWall)" stroke="#78350F" strokeWidth="1.5" />
      {[24, 39, 85, 100].map((x) => (
        <g key={x}>
          <rect x={x} y="39" width="8" height="36" fill="#FEF3C7" stroke="#92400E" strokeWidth="1.1" />
          <line x1={x + 2.7} y1="41" x2={x + 2.7} y2="73" stroke="#D97706" strokeWidth="0.7" opacity="0.6" />
          <line x1={x + 5.3} y1="41" x2={x + 5.3} y2="73" stroke="#D97706" strokeWidth="0.7" opacity="0.6" />
        </g>
      ))}

      {/* Cổng vòm Két Sắt Vàng trung tâm */}
      <path d="M54 75 V51 C54 43 78 43 78 51 V75 Z" fill="#1E293B" stroke="#92400E" strokeWidth="1.6" />
      <path d="M57 75 V53 C57 47 75 47 75 53 V75 Z" fill="url(#vaultShine)" stroke="#FEF08A" strokeWidth="1.2" />
      <circle cx="66" cy="61" r="5" fill="#FEF9C3" stroke="#78350F" strokeWidth="1.3" />
      <circle cx="66" cy="61" r="1.8" fill="#78350F" />

      {/* Bậc thềm đá 2 tầng */}
      <rect x="12" y="75" width="108" height="5" rx="1" fill="#D97706" stroke="#FEF08A" strokeWidth="1.1" />
      <rect x="6" y="80" width="120" height="5.5" rx="2" fill="#92400E" stroke="#FDE68A" strokeWidth="1.2" />
    </svg>
  );
}

/** Ngôi nhà mái ngói đỏ cổ điển mini (Cấp 1–4) nổi bật rõ trên mọi nền màu sở hữu */
export function MiniHouseSvg({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <polygon
        points="10,1.5 18.5,9 1.5,9"
        fill="#EF4444"
        stroke="#FFFBEB"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <rect x="3.5" y="8.8" width="13" height="9.2" rx="1.2" fill="#FFFBEB" stroke="#78350F" strokeWidth="1.2" />
      <rect x="8.2" y="12.2" width="3.6" height="5.8" fill="#92400E" />
    </svg>
  );
}

/** Biệt thự tân cổ điển MÀU TRẮNG sang trọng (Cấp 5 — nổi bật trên mọi nền màu sở hữu) */
export function MiniVillaSvg({ className = 'h-4 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="whiteVillaWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="whiteVillaDome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>
      {/* Chóp vòm mái trắng tân cổ điển */}
      <line x1="16" y1="0.8" x2="16" y2="3.2" stroke="#F8FAFC" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10 8.5 C10 3.2 22 3.2 22 8.5 Z" fill="url(#whiteVillaDome)" stroke="#334155" strokeWidth="1.1" />
      {/* Mái hiên 2 cánh trắng tinh tế */}
      <polygon points="2.5,11 16,6 29.5,11" fill="#FFFFFF" stroke="#334155" strokeWidth="1.1" strokeLinejoin="round" />
      {/* Thân tòa biệt thự trắng 2 tầng + cột trụ */}
      <rect x="4" y="10.8" width="24" height="9.2" rx="1.2" fill="url(#whiteVillaWall)" stroke="#334155" strokeWidth="1.1" />
      {/* 4 cột mảnh & ô cửa sổ sáng ấm */}
      <rect x="6.5" y="12.6" width="3.2" height="3.6" rx="0.6" fill="#0EA5E9" stroke="#475569" strokeWidth="0.6" />
      <rect x="22.3" y="12.6" width="3.2" height="3.6" rx="0.6" fill="#0EA5E9" stroke="#475569" strokeWidth="0.6" />
      {/* Cổng vòm chính giữa ấm áp */}
      <path d="M13.2 20 V14.6 C13.2 12.8 18.8 12.8 18.8 14.6 V20 Z" fill="#F59E0B" stroke="#475569" strokeWidth="0.8" />
      {/* Thềm đá trắng phía dưới */}
      <rect x="2" y="19.4" width="28" height="2" rx="0.8" fill="#FFFFFF" stroke="#475569" strokeWidth="0.7" />
    </svg>
  );
}

/** Máy bay phản lực thương mại trắng-đỏ KHỔNG LỒ lướt vắt ngang sân giữa khi bay Sân Bay */
export function GiantAirportJetSvg({ className = 'h-64 w-64' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="giantJetBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="32%" stopColor="#FFFFFF" />
          <stop offset="68%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
        <linearGradient id="giantJetWing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
        <linearGradient id="giantJetRed" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>
      </defs>

      {/* 4 Động cơ phản lực dưới 2 cánh (2 trái, 2 phải) */}
      {[
        [66, 86],
        [40, 102],
        [154, 86],
        [180, 102],
      ].map(([cx, cy], idx) => (
        <g key={idx}>
          <rect x={cx - 6.5} y={cy - 12} width="13" height="24" rx="5.5" fill="#E2E8F0" stroke="#334155" strokeWidth="1.5" />
          <rect x={cx - 5.5} y={cy - 12} width="11" height="5" rx="2.5" fill="url(#giantJetRed)" />
          <rect x={cx - 4} y={cy + 9} width="8" height="4" rx="1.5" fill="#475569" />
        </g>
      ))}

      {/* Đôi cánh chính sải siêu rộng trắng viền đỏ sắc nét (mũi hướng lên trên 0° -> xoay theo góc bay) */}
      <path
        d="M110 66 L10 120 L10 136 L102 108 L118 108 L210 136 L210 120 Z"
        fill="url(#giantJetWing)"
        stroke="#1E293B"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Các mảng cánh tà đỏ nổi bật trên đôi cánh giống máy bay thương mại cổ điển */}
      <polygon points="94,95 66,108 66,116 94,104" fill="url(#giantJetRed)" opacity="0.92" />
      <polygon points="58,112 24,126 24,132 58,119" fill="url(#giantJetRed)" opacity="0.92" />
      <polygon points="126,95 154,108 154,116 126,104" fill="url(#giantJetRed)" opacity="0.92" />
      <polygon points="162,112 196,126 196,132 162,119" fill="url(#giantJetRed)" opacity="0.92" />

      {/* Cánh đuôi ngang sau */}
      <path
        d="M110 162 L64 190 L64 202 L106 186 L114 186 L156 202 L156 190 Z"
        fill="url(#giantJetWing)"
        stroke="#1E293B"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon points="98,179 72,193 72,198 98,185" fill="url(#giantJetRed)" opacity="0.92" />
      <polygon points="122,179 148,193 148,198 122,185" fill="url(#giantJetRed)" opacity="0.92" />

      {/* Thân máy bay thuôn dài sáng bóng */}
      <path
        d="M110 12 C121 12 126 32 126 56 L124 166 C123 185 117 204 110 208 C103 204 97 185 96 166 L94 56 C94 32 99 12 110 12 Z"
        fill="url(#giantJetBody)"
        stroke="#1E293B"
        strokeWidth="2.2"
      />
      {/* Chóp mũi đỏ rực */}
      <path d="M100.5 28 C102.5 16 106 12 110 12 C114 12 117.5 16 119.5 28 Q110 24 100.5 28 Z" fill="url(#giantJetRed)" />
      {/* Kính buồng lái phi công đen bóng */}
      <path d="M101 38 Q110 31 119 38 L117 44 Q110 39 103 44 Z" fill="#0F172A" />
      {/* Đuôi đứng dọc sơn đỏ giữa thân sau */}
      <path d="M110 148 L113.5 198 L110 205 L106.5 198 Z" fill="url(#giantJetRed)" stroke="#7F1D1D" strokeWidth="1" />
    </svg>
  );
}

/** Máy bay phản lực cổ điển-hiện đại bay theo cung đường Sân Bay */
export function JetPlaneSvg({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="jetBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>
      <path
        d="M44 24 L29 19.5 L18 5 L13.5 5 L18.5 19.5 L8 21 L4.5 15.5 L2 15.5 L4.5 24 L2 32.5 L4.5 32.5 L8 27 L18.5 28.5 L13.5 43 L18 43 L29 28.5 Z"
        fill="url(#jetBody)"
        stroke="#0F172A"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M29 21.5 L38 24 L29 26.5 Z" fill="#0284C7" />
      <line x1="15" y1="24" x2="31" y2="24" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Hiệu ứng song sắt nhà tù sập xuống khi bị bắt vào tù */
export function JailSlamBarsSvg({ className = 'h-24 w-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <rect x="6" y="6" width="84" height="84" rx="10" fill="rgba(15,23,42,0.75)" stroke="#EF4444" strokeWidth="4" />
      {[22, 38, 54, 70].map((x) => (
        <g key={x}>
          <rect x={x - 3} y="8" width="6" height="80" fill="#94A3B8" />
          <rect x={x - 2} y="8" width="2" height="80" fill="#F8FAFC" />
        </g>
      ))}
      <rect x="8" y="42" width="80" height="8" fill="#475569" />
      <rect x="38" y="36" width="20" height="20" rx="4" fill="#F59E0B" stroke="#78350F" strokeWidth="2.5" />
      <circle cx="48" cy="46" r="3.5" fill="#451A03" />
    </svg>
  );
}
