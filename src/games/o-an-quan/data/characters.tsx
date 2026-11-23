import type { CharacterId } from '../engine/types';

export type CharacterMood = 'idle' | 'thinking' | 'happy' | 'excited' | 'worried';

export interface OAnQuanCharacterMeta {
  id: CharacterId;
  name: string;
  tagline: string;
  accentHex: string;
  badgeBg: string;
}

export const O_AN_QUAN_CHARACTERS: readonly OAnQuanCharacterMeta[] = [
  {
    id: 'cu_ti',
    name: 'Cu Tí',
    tagline: 'Bé trai lanh lợi · Áo bà ba khăn rằn',
    accentHex: '#F59E0B',
    badgeBg: 'linear-gradient(135deg, #D97706 0%, #92400E 100%)',
  },
  {
    id: 'be_mit',
    name: 'Bé Mít',
    tagline: 'Bé gái duyên dáng · Áo tứ thân nơ đỏ',
    accentHex: '#F43F5E',
    badgeBg: 'linear-gradient(135deg, #F43F5E 0%, #9F1239 100%)',
  },
] as const;

export function getCharacterMeta(id: CharacterId): OAnQuanCharacterMeta {
  return O_AN_QUAN_CHARACTERS.find((c) => c.id === id) ?? O_AN_QUAN_CHARACTERS[0];
}

/**
 * Chân dung toàn thân Chibi 2.5D KHÔNG VIỀN (trong suốt 100% đứng trực tiếp trên nền sân gạch tàu)
 * với 4 sắc thái cảm xúc biến đổi thực (mắt, lông mày, miệng, tia sáng/giọt mồ hôi).
 */
export function OAnQuanCharacterArt({
  characterId,
  mood = 'idle',
  facing = 'right',
  className = 'h-44 w-36',
}: {
  characterId: CharacterId;
  mood?: CharacterMood;
  facing?: 'left' | 'right';
  className?: string;
}) {
  const isBoy = characterId === 'cu_ti';
  const flipCls = facing === 'left' ? '-scale-x-100' : '';

  const renderFaceExpressions = () => {
    if (mood === 'excited') {
      return (
        <g>
          {/* Mắt cười cong tít rạng rỡ */}
          <path d="M58 63 Q64 55 70 63" fill="none" stroke="#2B1912" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M90 63 Q96 55 102 63" fill="none" stroke="#2B1912" strokeWidth="3.2" strokeLinecap="round" />
          {/* Miệng cười há vui sướng */}
          <path d="M72 74 Q80 86 88 74 Z" fill="#D94B57" stroke="#5A1C21" strokeWidth="1.8" />
          <path d="M75 79 Q80 83 85 79" fill="#FF9AA2" />
          {/* Hai ngôi sao lấp lánh bên má */}
          <path d="M44 48 L47 54 L53 56 L47 58 L44 64 L41 58 L35 56 L41 54 Z" fill="#FDE047" />
          <path d="M118 45 L120 50 L125 52 L120 54 L118 59 L116 54 L111 52 L116 50 Z" fill="#FDE047" />
        </g>
      );
    }

    if (mood === 'worried') {
      return (
        <g>
          {/* Lông mày nhíu lo lắng */}
          <path d="M56 54 Q63 57 69 52" fill="none" stroke="#3D2217" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M104 54 Q97 57 91 52" fill="none" stroke="#3D2217" strokeWidth="2.4" strokeLinecap="round" />
          {/* Mắt tròn ngơ ngác */}
          <circle cx="64" cy="64" r="5" fill="#2B1912" />
          <circle cx="96" cy="64" r="5" fill="#2B1912" />
          <circle cx="62.5" cy="62.5" r="1.8" fill="#FFFFFF" />
          <circle cx="94.5" cy="62.5" r="1.8" fill="#FFFFFF" />
          {/* Miệng méo tiếc nuối */}
          <path d="M74 79 Q80 73 86 79" fill="none" stroke="#5A1C21" strokeWidth="2.4" strokeLinecap="round" />
          {/* Giọt mồ hôi xanh bên thái dương */}
          <path d="M112 52 Q117 61 112 65 Q107 61 112 52 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.2" />
        </g>
      );
    }

    if (mood === 'thinking') {
      return (
        <g>
          {/* Lông mày suy tư */}
          <path d="M57 54 Q64 51 70 54" fill="none" stroke="#3D2217" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M90 52 Q97 49 103 53" fill="none" stroke="#3D2217" strokeWidth="2.2" strokeLinecap="round" />
          {/* Đôi mắt liếc nhẹ suy nghĩ */}
          <ellipse cx="65" cy="63" rx="4.8" ry="5.5" fill="#2B1912" />
          <ellipse cx="97" cy="63" rx="4.8" ry="5.5" fill="#2B1912" />
          <circle cx="66.5" cy="61" r="1.8" fill="#FFFFFF" />
          <circle cx="98.5" cy="61" r="1.8" fill="#FFFFFF" />
          {/* Miệng chúm nhỏ suy tính */}
          <path d="M76 76 Q80 78 84 75" fill="none" stroke="#6B2D24" strokeWidth="2.3" strokeLinecap="round" />
        </g>
      );
    }

    // 'happy' hoặc 'idle'
    return (
      <g>
        <path d="M57 54 Q64 51 70 54" fill="none" stroke="#3D2217" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M90 54 Q96 51 103 54" fill="none" stroke="#3D2217" strokeWidth="2.1" strokeLinecap="round" />
        <ellipse cx="64" cy="63" rx="5" ry="5.6" fill="#2B1912" />
        <ellipse cx="96" cy="63" rx="5" ry="5.6" fill="#2B1912" />
        <circle cx="62.2" cy="61" r="2" fill="#FFFFFF" />
        <circle cx="94.2" cy="61" r="2" fill="#FFFFFF" />
        <circle cx="65.8" cy="65.2" r="1" fill="#FFFFFF" opacity="0.8" />
        <circle cx="97.8" cy="65.2" r="1" fill="#FFFFFF" opacity="0.8" />
        {mood === 'happy' ? (
          <path d="M72 74 Q80 83 88 74" fill="#E15B64" stroke="#5A1C21" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M73 75 Q80 81 87 75" fill="none" stroke="#6B2D24" strokeWidth="2.4" strokeLinecap="round" />
        )}
      </g>
    );
  };

  if (isBoy) {
    return (
      <svg
        viewBox="0 0 160 200"
        className={`pointer-events-none select-none overflow-visible drop-shadow-[0_12px_16px_rgba(32,12,4,0.55)] ${flipCls} ${className}`}
        aria-label="Cu Tí"
      >
        <defs>
          <radialGradient id="cutiSkin" cx="45%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFE5C8" />
            <stop offset="75%" stopColor="#FAD2AE" />
            <stop offset="100%" stopColor="#EBB78B" />
          </radialGradient>
          <linearGradient id="cutiHair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A2E20" />
            <stop offset="100%" stopColor="#26150E" />
          </linearGradient>
          <linearGradient id="cutiShirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8A5638" />
            <stop offset="100%" stopColor="#5C3520" />
          </linearGradient>
          <pattern id="khanRanPattern" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#F8FAFC" />
            <rect width="4" height="8" fill="#334155" opacity="0.78" />
            <rect width="8" height="4" fill="#1E293B" opacity="0.65" />
          </pattern>
        </defs>

        {/* Bóng tiếp đất nhẹ trên nền gạch tàu */}
        <ellipse cx="80" cy="190" rx="44" ry="8" fill="rgba(28, 12, 4, 0.42)" />

        {/* Đôi chân & dép nâu */}
        <rect x="61" y="158" width="14" height="24" rx="6" fill="#3B2316" stroke="#24130A" strokeWidth="2.2" />
        <rect x="85" y="158" width="14" height="24" rx="6" fill="#3B2316" stroke="#24130A" strokeWidth="2.2" />
        <ellipse cx="68" cy="184" rx="11" ry="5.5" fill="#7C4A2D" stroke="#2E170B" strokeWidth="2" />
        <ellipse cx="92" cy="184" rx="11" ry="5.5" fill="#7C4A2D" stroke="#2E170B" strokeWidth="2" />

        {/* Thân áo bà ba nâu truyền thống */}
        <path
          d="M52 104 Q80 96 108 104 L114 162 Q80 169 46 162 Z"
          fill="url(#cutiShirt)"
          stroke="#2E170B"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        {/* Hàng khuy áo bà ba & 2 túi áo */}
        <line x1="80" y1="112" x2="80" y2="162" stroke="#3D2113" strokeWidth="2" />
        <circle cx="80" cy="126" r="2.2" fill="#FDE68A" />
        <circle cx="80" cy="139" r="2.2" fill="#FDE68A" />
        <circle cx="80" cy="152" r="2.2" fill="#FDE68A" />
        <rect x="54" y="138" width="16" height="14" rx="3" fill="#6D4026" stroke="#3D2113" strokeWidth="1.6" />
        <rect x="90" y="138" width="16" height="14" rx="3" fill="#6D4026" stroke="#3D2113" strokeWidth="1.6" />

        {/* Hai cánh tay */}
        <path d="M53 108 Q36 125 40 144 Q46 149 52 142 L57 120 Z" fill="url(#cutiShirt)" stroke="#2E170B" strokeWidth="2.5" />
        <path d="M107 108 Q124 125 120 144 Q114 149 108 142 L103 120 Z" fill="url(#cutiShirt)" stroke="#2E170B" strokeWidth="2.5" />
        <circle cx="45" cy="146" r="7.5" fill="url(#cutiSkin)" stroke="#3D2217" strokeWidth="2" />
        <circle cx="115" cy="146" r="7.5" fill="url(#cutiSkin)" stroke="#3D2217" strokeWidth="2" />

        {/* Khăn rằn quấn cổ đặc trưng Việt Nam */}
        <path
          d="M54 96 Q80 107 106 96 L109 112 Q80 123 51 112 Z"
          fill="url(#khanRanPattern)"
          stroke="#1E293B"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M62 112 L58 134 L71 131 L73 114 Z"
          fill="url(#khanRanPattern)"
          stroke="#1E293B"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M90 113 L94 132 L105 129 L101 111 Z"
          fill="url(#khanRanPattern)"
          stroke="#1E293B"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Hai tai */}
        <circle cx="38" cy="66" r="8" fill="url(#cutiSkin)" stroke="#3D2217" strokeWidth="2.2" />
        <circle cx="122" cy="66" r="8" fill="url(#cutiSkin)" stroke="#3D2217" strokeWidth="2.2" />

        {/* Khuôn mặt Chibi bầu bĩnh */}
        <ellipse cx="80" cy="62" rx="43" ry="39" fill="url(#cutiSkin)" stroke="#3D2217" strokeWidth="2.8" />
        {/* Má hồng */}
        <ellipse cx="52" cy="72" rx="7.5" ry="4.5" fill="#FB7185" opacity="0.45" />
        <ellipse cx="108" cy="72" rx="7.5" ry="4.5" fill="#FB7185" opacity="0.45" />

        {/* Mái tóc bé trai lanh lợi */}
        <path
          d="M35 58 C34 24 62 14 82 15 C106 15 126 28 125 58 C118 46 111 40 104 42 C99 47 93 47 88 38 C79 49 69 50 61 40 C54 49 45 48 35 58 Z"
          fill="url(#cutiHair)"
          stroke="#1C0E08"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        {/* Chỏm tóc dựng tinh nghịch */}
        <path d="M77 17 Q84 6 93 13 Q85 15 84 20" fill="#3A2217" stroke="#1C0E08" strokeWidth="2.2" strokeLinecap="round" />

        {renderFaceExpressions()}
      </svg>
    );
  }

  // Bé Mít — Áo tứ thân/bà ba hồng đào + tóc buộc hai chùm nơ đỏ
  return (
    <svg
      viewBox="0 0 160 200"
      className={`pointer-events-none select-none overflow-visible drop-shadow-[0_12px_16px_rgba(32,12,4,0.55)] ${flipCls} ${className}`}
      aria-label="Bé Mít"
    >
      <defs>
        <radialGradient id="bemitSkin" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFECE0" />
          <stop offset="75%" stopColor="#FAD7C0" />
          <stop offset="100%" stopColor="#ECC0A0" />
        </radialGradient>
        <linearGradient id="bemitHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B2420" />
          <stop offset="100%" stopColor="#1B0F0D" />
        </linearGradient>
        <linearGradient id="bemitDress" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="55%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>

      {/* Bóng tiếp đất nhẹ trên nền gạch tàu */}
      <ellipse cx="80" cy="190" rx="44" ry="8" fill="rgba(28, 12, 4, 0.42)" />

      {/* Hai búi tóc tròn hai bên + nơ hồng đỏ */}
      <circle cx="32" cy="40" r="17" fill="url(#bemitHair)" stroke="#1B0F0D" strokeWidth="2.6" />
      <circle cx="128" cy="40" r="17" fill="url(#bemitHair)" stroke="#1B0F0D" strokeWidth="2.6" />
      <path d="M36 47 L26 60 L38 56 Z" fill="#F43F5E" stroke="#881337" strokeWidth="1.8" />
      <path d="M124 47 L134 60 L122 56 Z" fill="#F43F5E" stroke="#881337" strokeWidth="1.8" />
      <ellipse cx="43" cy="46" rx="6" ry="9" transform="rotate(-32 43 46)" fill="#F472B6" stroke="#881337" strokeWidth="2" />
      <ellipse cx="117" cy="46" rx="6" ry="9" transform="rotate(32 117 46)" fill="#F472B6" stroke="#881337" strokeWidth="2" />

      {/* Đôi chân & hài thêu */}
      <rect x="63" y="160" width="12" height="22" rx="5" fill="#FDE8D8" stroke="#3D2217" strokeWidth="2" />
      <rect x="85" y="160" width="12" height="22" rx="5" fill="#FDE8D8" stroke="#3D2217" strokeWidth="2" />
      <ellipse cx="69" cy="184" rx="10.5" ry="5.5" fill="#BE123C" stroke="#4C0519" strokeWidth="2" />
      <ellipse cx="91" cy="184" rx="10.5" ry="5.5" fill="#BE123C" stroke="#4C0519" strokeWidth="2" />

      {/* Tà áo yếm / áo bà ba đào xòe duyên dáng */}
      <path
        d="M55 102 Q80 96 105 102 L118 164 Q80 174 42 164 Z"
        fill="url(#bemitDress)"
        stroke="#6B1028"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* Cổ áo yếm viền vàng & nơ trước ngực */}
      <path d="M62 102 Q80 116 98 102" fill="none" stroke="#FEF08A" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="80" cy="112" r="3.5" fill="#FDE047" stroke="#881337" strokeWidth="1.5" />
      <path d="M80 115 L74 128 M80 115 L86 128" stroke="#FEF08A" strokeWidth="2.2" strokeLinecap="round" />

      {/* Hai tay áo mềm mại */}
      <path d="M55 106 Q36 124 38 142 Q46 148 53 140 L59 120 Z" fill="url(#bemitDress)" stroke="#6B1028" strokeWidth="2.4" />
      <path d="M105 106 Q124 124 122 142 Q114 148 107 140 L101 120 Z" fill="url(#bemitDress)" stroke="#6B1028" strokeWidth="2.4" />
      <circle cx="43" cy="144" r="7" fill="url(#bemitSkin)" stroke="#3D2217" strokeWidth="2" />
      <circle cx="117" cy="144" r="7" fill="url(#bemitSkin)" stroke="#3D2217" strokeWidth="2" />

      {/* Tai & Khuôn mặt bầu bĩnh */}
      <circle cx="38" cy="66" r="7.5" fill="url(#bemitSkin)" stroke="#3D2217" strokeWidth="2.2" />
      <circle cx="122" cy="66" r="7.5" fill="url(#bemitSkin)" stroke="#3D2217" strokeWidth="2.2" />
      <ellipse cx="80" cy="62" rx="42" ry="38" fill="url(#bemitSkin)" stroke="#3D2217" strokeWidth="2.8" />

      {/* Má hồng đào */}
      <ellipse cx="52" cy="71" rx="8" ry="4.5" fill="#FB7185" opacity="0.52" />
      <ellipse cx="108" cy="71" rx="8" ry="4.5" fill="#FB7185" opacity="0.52" />

      {/* Tóc mái bằng đáng yêu */}
      <path
        d="M36 60 C35 24 58 15 80 15 C102 15 125 24 124 60 C118 47 110 43 102 45 C96 47 91 40 80 41 C69 40 64 47 58 45 C50 43 42 47 36 60 Z"
        fill="url(#bemitHair)"
        stroke="#1B0F0D"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <ellipse cx="66" cy="27" rx="10" ry="3" fill="#FFFFFF" opacity="0.16" />

      {renderFaceExpressions()}
    </svg>
  );
}

/**
 * Giỏ tre đựng sỏi dân & đá ngọc Quan đã ăn được (không khung vuông, nổi trực tiếp bên chân nhân vật).
 */
export function WovenBasketSvg({
  capturedQuan,
  capturedDan,
  className = 'h-16 w-24',
}: {
  capturedQuan: number;
  capturedDan: number;
  className?: string;
}) {
  const shownPebbles = Math.min(capturedDan, 9);
  const pebbleCoords = [
    { cx: 34, cy: 25, rx: 7.5, ry: 5, fill: '#E5E7EB' },
    { cx: 48, cy: 23, rx: 7, ry: 4.8, fill: '#D4A373' },
    { cx: 63, cy: 25, rx: 7.5, ry: 5, fill: '#9CA3AF' },
    { cx: 28, cy: 31, rx: 7, ry: 4.6, fill: '#B08968' },
    { cx: 42, cy: 30, rx: 8, ry: 5.2, fill: '#F3F4F6' },
    { cx: 56, cy: 31, rx: 7.5, ry: 5, fill: '#6B7280' },
    { cx: 70, cy: 30, rx: 7, ry: 4.6, fill: '#E9C46A' },
    { cx: 36, cy: 19, rx: 6.5, ry: 4.5, fill: '#CBD5E1' },
    { cx: 59, cy: 20, rx: 6.5, ry: 4.5, fill: '#A98467' },
  ];

  return (
    <svg
      viewBox="0 0 100 68"
      className={`pointer-events-none select-none overflow-visible drop-shadow-[0_8px_12px_rgba(24,10,4,0.55)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="basketBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D99B52" />
          <stop offset="60%" stopColor="#A66A2D" />
          <stop offset="100%" stopColor="#6F4116" />
        </linearGradient>
        <radialGradient id="basketJade" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="48%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>

      {/* Bóng đổ của giỏ tre */}
      <ellipse cx="50" cy="61" rx="34" ry="6" fill="rgba(24,10,4,0.45)" />

      {/* Miệng giỏ trong */}
      <ellipse cx="50" cy="27" rx="38" ry="12" fill="#4B2A12" stroke="#8C531E" strokeWidth="2.5" />

      {/* Sỏi dân xếp bên trong giỏ */}
      {pebbleCoords.slice(0, shownPebbles).map((p, idx) => (
        <ellipse
          key={idx}
          cx={p.cx}
          cy={p.cy}
          rx={p.rx}
          ry={p.ry}
          fill={p.fill}
          stroke="#271911"
          strokeWidth="1.2"
        />
      ))}

      {/* Viên đá ngọc Quan lớn (nếu đã ăn 1 hoặc 2 Quan) */}
      {capturedQuan >= 1 && (
        <ellipse
          cx={capturedQuan >= 2 ? 41 : 50}
          cy="21"
          rx="12"
          ry="9"
          fill="url(#basketJade)"
          stroke="#064E3B"
          strokeWidth="1.6"
        />
      )}
      {capturedQuan >= 2 && (
        <ellipse
          cx="61"
          cy="22"
          rx="11.5"
          ry="8.5"
          fill="url(#basketJade)"
          stroke="#064E3B"
          strokeWidth="1.6"
        />
      )}

      {/* Thân giỏ đan nan tre */}
      <path
        d="M12 27 Q16 60 50 61 Q84 60 88 27 Q50 38 12 27 Z"
        fill="url(#basketBody)"
        stroke="#4B280D"
        strokeWidth="2.4"
      />
      {/* Vân đan nan tre */}
      <path d="M18 39 Q50 48 82 39" fill="none" stroke="#5C3210" strokeWidth="1.8" opacity="0.7" />
      <path d="M24 49 Q50 56 76 49" fill="none" stroke="#5C3210" strokeWidth="1.8" opacity="0.7" />
      <path d="M32 33 L35 58 M50 35 L50 60 M68 33 L65 58" fill="none" stroke="#FDE68A" strokeWidth="1.3" opacity="0.4" />

      {/* Cạp miệng giỏ phía trước */}
      <path d="M12 27 Q50 39 88 27" fill="none" stroke="#F3C677" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
