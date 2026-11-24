import { useId } from 'react';
import { HORSE_COLOR_CONFIG } from '../engine/boardGeometry';
import type { HorseColor } from '../engine/types';

interface HorsePieceSvgProps {
  color: HorseColor;
  selectable?: boolean;
  selected?: boolean;
  hinted?: boolean;
  className?: string;
}

/**
 * Quân Cá Ngựa đứng 2.5D nhựa bóng cổ điển Việt Nam.
 * Dùng `useId()` + `linearGradient` để hiển thị sắc nét, không bị lỗi màu trên chế độ tối tự động Android.
 */
export function HorsePieceSvg({
  color,
  selectable = false,
  selected = false,
  hinted = false,
  className = 'h-10 w-10',
}: HorsePieceSvgProps) {
  const uid = useId().replace(/:/g, '');
  const palette = HORSE_COLOR_CONFIG[color];
  const bodyGradId = `horseBody_${uid}`;
  const baseGradId = `horseBase_${uid}`;

  return (
    <svg
      viewBox="-22 -24 44 44"
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="35%" stopColor={palette.bright} />
          <stop offset="100%" stopColor={palette.main} />
        </linearGradient>
        <linearGradient id={baseGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.bright} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
      </defs>

      {/* Vòng hào quang chọn quân hoặc gợi ý */}
      {hinted && (
        <ellipse
          cx="0"
          cy="8.5"
          rx="18.5"
          ry="9.5"
          fill="rgba(52, 211, 153, 0.25)"
          stroke="#10B981"
          strokeWidth="2.6"
        />
      )}
      {selectable && !hinted && (
        <ellipse
          cx="0"
          cy="8.5"
          rx="17"
          ry="8.8"
          fill={selected ? 'rgba(250, 204, 21, 0.34)' : 'rgba(250, 204, 21, 0.18)'}
          stroke={selected ? '#FACC15' : '#F59E0B'}
          strokeWidth={selected ? '2.8' : '2.2'}
        />
      )}

      {/* Bóng đổ mềm xuống mặt bàn */}
      <ellipse cx="2" cy="11.5" rx="12.5" ry="5.5" fill="rgba(28, 16, 6, 0.34)" />

      {/* Đế trụ tròn nhiều tầng */}
      <ellipse cx="0" cy="9" rx="12" ry="5.4" fill={palette.dark} />
      <rect x="-12" y="4.5" width="24" height="4.5" fill={`url(#${baseGradId})`} />
      <ellipse cx="0" cy="4.8" rx="11.2" ry="4.7" fill={palette.bright} stroke={palette.dark} strokeWidth="0.9" />

      {/* Thân trụ và đầu cá ngựa điêu khắc */}
      <path
        d="M -6.8 4.8 C -7.8 -2.2, -6.2 -9, -2.5 -13.6 L -4.4 -17.4 C -1.4 -18.5, 2.2 -16.8, 3.6 -14.1 C 7.4 -12.5, 10.6 -9.3, 10.6 -5.8 C 10.2 -3.4, 7.4 -2.4, 5 -3.5 L 3 -4.8 C 4.5 -1.6, 5.8 1.4, 6.8 4.8 Z"
        fill={`url(#${bodyGradId})`}
        stroke={palette.dark}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Bờm & ánh bóng nhựa 3D */}
      <path
        d="M -3.8 -12.6 C -5.3 -7.4, -5 -1.2, -4.1 3"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.68"
      />
      {/* Mắt ngựa sáng tinh anh */}
      <circle cx="3.4" cy="-9.6" r="1.45" fill="#FFFFFF" opacity="0.95" />
      <circle cx="3.8" cy="-9.6" r="0.65" fill={palette.dark} />
    </svg>
  );
}
