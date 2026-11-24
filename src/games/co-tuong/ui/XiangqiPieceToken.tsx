import { useId } from 'react';
import { XIANGQI_HANZI, XIANGQI_NAME_VI } from '../engine/rules';
import type { XiangqiColor, XiangqiPieceType } from '../engine/types';

interface XiangqiPieceTokenProps {
  type: XiangqiPieceType;
  color: XiangqiColor;
  labelMode?: 'han' | 'vi';
  selected?: boolean;
  className?: string;
}

/**
 * Quân Cờ Tướng đĩa gỗ hoàng dương tiện tròn 3D chân thực chuẩn ảnh bìa:
 * - Thành gỗ nổi khối 3D có ánh sáng góc trên trái + bóng đổ mềm xuống mặt bàn gỗ.
 * - Mặt đĩa gỗ sáng ngà có thớ vân gỗ mảnh, cạnh bo vát, 2 vòng chạm khắc chìm (inner bevel).
 * - Chữ thư pháp khắc mực Đỏ son (#B91C1C) & Xanh ngọc đậm (#047857) cực sắc nét, hỗ trợ 漢 ↔ VN.
 */
export function XiangqiPieceToken({
  type,
  color,
  labelMode = 'han',
  selected = false,
  className = 'h-12 w-12',
}: XiangqiPieceTokenProps) {
  const uid = useId().replace(/:/g, '');
  const topGrad = `xqTop_${uid}`;
  const sideGrad = `xqSide_${uid}`;
  const bevelGrad = `xqBevel_${uid}`;
  const clipId = `xqClip_${uid}`;

  const isRed = color === 'red';
  const inkColor = isRed ? '#B91C1C' : '#047857';
  const inkDeep = isRed ? '#881313' : '#065F46';
  const text = labelMode === 'han' ? XIANGQI_HANZI[color][type] : XIANGQI_NAME_VI[type];

  return (
    <svg viewBox="0 0 68 68" className={className} aria-hidden="true">
      <defs>
        {/* Thành gỗ tròn tiện 3D nhìn hơi nghiêng */}
        <linearGradient id={sideGrad} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0%" stopColor="#5C3414" />
          <stop offset="22%" stopColor="#B88449" />
          <stop offset="52%" stopColor="#D7A76B" />
          <stop offset="82%" stopColor="#855123" />
          <stop offset="100%" stopColor="#42220B" />
        </linearGradient>

        {/* Mặt gỗ hoàng dương sáng ngà ấm */}
        <radialGradient id={topGrad} cx="36%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="48%" stopColor="#F8EAD0" />
          <stop offset="85%" stopColor="#E7C896" />
          <stop offset="100%" stopColor="#CE9F62" />
        </radialGradient>

        {/* Vành vát mặt quân bắt sáng */}
        <linearGradient id={bevelGrad} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0%" stopColor="#FFF9EC" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#C99455" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6E411B" stopOpacity="0.7" />
        </linearGradient>

        <clipPath id={clipId}>
          <circle cx="34" cy="31.5" r="25.8" />
        </clipPath>
      </defs>

      {/* Bóng đổ mềm có hướng xuống mặt bàn gỗ */}
      <ellipse cx="36.2" cy="40" rx="26.5" ry="24.5" fill="rgba(26, 11, 2, 0.44)" />

      {/* Thân đĩa gỗ 3D dày dặn */}
      <circle cx="34" cy="36.2" r="27" fill={`url(#${sideGrad})`} stroke="#3B1E09" strokeWidth="1" />

      {/* Mặt trên đĩa gỗ sáng */}
      <circle
        cx="34"
        cy="31.5"
        r="27"
        fill={`url(#${topGrad})`}
        stroke={selected ? '#FACC15' : '#8A5624'}
        strokeWidth={selected ? '3.4' : '1.4'}
      />

      {/* Đường thớ vân gỗ mảnh tự nhiên trên mặt quân */}
      <g clipPath={`url(#${clipId})`} stroke="#A66E32" strokeOpacity="0.14" fill="none" strokeWidth="1">
        <path d="M 6 20 Q 24 17, 42 21 T 64 19" />
        <path d="M 6 28 Q 28 25, 46 29 T 64 27" />
        <path d="M 6 36 Q 22 39, 44 35 T 64 38" />
        <path d="M 8 45 Q 30 42, 50 46 T 64 44" />
      </g>

      {/* Vành bo vát 3D bắt sáng trên mép đĩa */}
      <circle
        cx="34"
        cy="31.5"
        r="25.2"
        fill="none"
        stroke={`url(#${bevelGrad})`}
        strokeWidth="2.2"
      />

      {/* Vòng tròn kép chạm khắc chìm (highlight đáy + nét mực đậm) */}
      <circle
        cx="34"
        cy="32.2"
        r="21.4"
        fill="none"
        stroke="rgba(255, 250, 236, 0.72)"
        strokeWidth="1.4"
      />
      <circle
        cx="34"
        cy="31.5"
        r="21.4"
        fill="none"
        stroke={inkColor}
        strokeWidth="2.15"
      />
      <circle
        cx="34"
        cy="31.5"
        r="18.6"
        fill="none"
        stroke={inkColor}
        strokeOpacity="0.45"
        strokeWidth="0.9"
      />

      {/* Chữ thư pháp khắc chìm (lớp sáng tạo rãnh khắc + lớp mực đậm) */}
      <text
        x="34"
        y={labelMode === 'han' ? '40.8' : '36.4'}
        textAnchor="middle"
        fontFamily={
          labelMode === 'han'
            ? "'KaiTi', 'STKaiti', 'DFKai-SB', 'Noto Serif TC', serif"
            : "'Be Vietnam Pro', 'Segoe UI', sans-serif"
        }
        fontSize={labelMode === 'han' ? '28' : text.length >= 5 ? '12.2' : '14.5'}
        fontWeight="900"
        fill="rgba(255, 252, 240, 0.78)"
      >
        {text}
      </text>
      <text
        x="34"
        y={labelMode === 'han' ? '40' : '35.6'}
        textAnchor="middle"
        fontFamily={
          labelMode === 'han'
            ? "'KaiTi', 'STKaiti', 'DFKai-SB', 'Noto Serif TC', serif"
            : "'Be Vietnam Pro', 'Segoe UI', sans-serif"
        }
        fontSize={labelMode === 'han' ? '28' : text.length >= 5 ? '12.2' : '14.5'}
        fontWeight="900"
        fill={inkColor}
        stroke={inkDeep}
        strokeWidth="0.25"
      >
        {text}
      </text>
    </svg>
  );
}
