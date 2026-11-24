import { useId } from 'react';
import type { ChessColor, ChessPieceType } from '../engine/types';

interface ChessPieceSvgProps {
  type: ChessPieceType;
  color: ChessColor;
  className?: string;
}

/**
 * Bộ 6 quân Cờ Vua Staunton điêu khắc 3D bóng mịn chuẩn ảnh bìa:
 * - Quân Trắng: Trắng sứ tinh khiết đổ khối mềm + viền tối mảnh sắc nét.
 * - Quân Đen: Đen tuyền obsidian bóng mịn KHÔNG viền trắng dày — dùng ánh sáng đỉnh khối (specular highlight)
 *   và rìa tối sắc để tách biệt hoàn toàn với quân Trắng và vẫn nổi rõ trên ô đen than!
 */
export function ChessPieceSvg({ type, color, className = 'h-12 w-12' }: ChessPieceSvgProps) {
  const uid = useId().replace(/:/g, '');
  const bodyGrad = `cpBody_${uid}`;
  const baseGrad = `cpBase_${uid}`;
  const sheenGrad = `cpSheen_${uid}`;

  const isWhite = color === 'white';
  const outline = isWhite ? '#232830' : '#05070A';
  const outlineWidth = isWhite ? '1.35' : '1.15';
  const detailColor = isWhite ? '#7A7468' : 'rgba(215, 226, 240, 0.34)';
  const specular = isWhite ? 'rgba(255, 255, 255, 0.92)' : 'rgba(226, 236, 248, 0.42)';

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        {isWhite ? (
          <>
            <linearGradient id={bodyGrad} x1="0.12" y1="0.05" x2="0.92" y2="0.95">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="48%" stopColor="#F6F3EB" />
              <stop offset="82%" stopColor="#E1DACB" />
              <stop offset="100%" stopColor="#C8BFA9" />
            </linearGradient>
            <linearGradient id={baseGrad} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#DFD8C8" />
              <stop offset="32%" stopColor="#FFFFFF" />
              <stop offset="72%" stopColor="#EAE4D7" />
              <stop offset="100%" stopColor="#BDB39D" />
            </linearGradient>
            <linearGradient id={sheenGrad} x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </>
        ) : (
          <>
            <linearGradient id={bodyGrad} x1="0.1" y1="0.04" x2="0.92" y2="0.96">
              <stop offset="0%" stopColor="#525C68" />
              <stop offset="28%" stopColor="#262D35" />
              <stop offset="68%" stopColor="#12161B" />
              <stop offset="100%" stopColor="#05070A" />
            </linearGradient>
            <linearGradient id={baseGrad} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#11151B" />
              <stop offset="30%" stopColor="#434D59" />
              <stop offset="65%" stopColor="#1C2128" />
              <stop offset="100%" stopColor="#07090C" />
            </linearGradient>
            <linearGradient id={sheenGrad} x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0%" stopColor="#DCE6F2" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#DCE6F2" stopOpacity="0" />
            </linearGradient>
          </>
        )}
      </defs>

      {/* Bóng đổ chân đế 3D mềm xuống mặt ô */}
      <ellipse
        cx="24"
        cy="43.2"
        rx="15.5"
        ry="3.1"
        fill={isWhite ? 'rgba(10, 12, 16, 0.36)' : 'rgba(0, 0, 0, 0.56)'}
      />
      {/* Ánh phản xạ nhẹ dưới đáy giúp quân Đen tách khỏi nền ô đen than */}
      {!isWhite && (
        <ellipse
          cx="24"
          cy="41.8"
          rx="14.2"
          ry="2.2"
          fill="none"
          stroke="rgba(205, 220, 238, 0.22)"
          strokeWidth="0.9"
        />
      )}

      {/* TỐT (PAWN) */}
      {type === 'p' && (
        <g stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round">
          <path
            d="M 18 22.8 C 18 20.6, 30 20.6, 30 22.8 L 28.2 26.2 C 30.8 29.5, 33.4 33.6, 35 38.6 L 13 38.6 C 14.6 33.6, 17.2 29.5, 19.8 26.2 Z"
            fill={`url(#${bodyGrad})`}
          />
          <circle cx="24" cy="14.8" r="5.6" fill={`url(#${bodyGrad})`} />
          <ellipse cx="22.1" cy="12.8" rx="2" ry="1.35" fill={`url(#${sheenGrad})`} stroke="none" />
          <rect x="17.2" y="20.6" width="13.6" height="2.6" rx="1.3" fill={`url(#${baseGrad})`} />
          <rect x="11.2" y="38.2" width="25.6" height="4" rx="2" fill={`url(#${baseGrad})`} />
          <path
            d="M 19.5 28.5 C 18 31.5, 16.5 34.4, 15.8 36.8"
            fill="none"
            stroke={specular}
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* XE (ROOK) */}
      {type === 'r' && (
        <g stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round">
          <path
            d="M 12.2 9.2 L 17 9.2 L 17 13.2 L 21.2 13.2 L 21.2 9.2 L 26.8 9.2 L 26.8 13.2 L 31 13.2 L 31 9.2 L 35.8 9.2 L 35.8 16.8 L 32 19.8 L 32 33.4 L 35.6 36.8 L 35.6 38.6 L 12.4 38.6 L 12.4 36.8 L 16 33.4 L 16 19.8 L 12.2 16.8 Z"
            fill={`url(#${bodyGrad})`}
          />
          <line x1="15.8" y1="19.8" x2="32.2" y2="19.8" stroke={detailColor} strokeWidth="1.25" />
          <line x1="15.8" y1="33.4" x2="32.2" y2="33.4" stroke={detailColor} strokeWidth="1.25" />
          <path
            d="M 18.6 21.6 L 18.6 31.8"
            fill="none"
            stroke={specular}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          <rect x="10.8" y="38.2" width="26.4" height="4" rx="2" fill={`url(#${baseGrad})`} />
        </g>
      )}

      {/* MÃ (KNIGHT) */}
      {type === 'n' && (
        <g stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round">
          <path
            d="M 13.4 38.6 L 35.4 38.6 L 35.4 34.4 C 35.4 25.8, 32.8 18.2, 28.4 13.2 L 29.8 8.4 C 26.4 8.6, 23.6 10.2, 22 12 C 16.6 13.1, 11.4 17.6, 10.6 22.8 C 10.6 25.4, 12.8 26.8, 15.4 26.1 L 19.2 24 C 17.8 28, 15.6 31.4, 13.4 35.4 Z"
            fill={`url(#${bodyGrad})`}
          />
          {/* Mắt & bờm ngựa điêu khắc */}
          <circle
            cx="17.8"
            cy="18.2"
            r="1.35"
            fill={isWhite ? '#232830' : '#CBD5E1'}
            stroke="none"
          />
          <path
            d="M 26 15.6 C 29.6 20.6, 31.4 26.8, 31.4 33.8"
            fill="none"
            stroke={detailColor}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="M 22.5 13.6 C 18.4 14.8, 14.4 17.6, 13.2 21.2"
            fill="none"
            stroke={specular}
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <rect x="11" y="38.2" width="26.4" height="4" rx="2" fill={`url(#${baseGrad})`} />
        </g>
      )}

      {/* TƯỢNG (BISHOP) */}
      {type === 'b' && (
        <g stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round">
          <circle cx="24" cy="8.2" r="2.7" fill={`url(#${bodyGrad})`} />
          <path
            d="M 24 11 C 16.8 14.6, 14.8 21.8, 17.2 28.4 L 15.2 32.8 L 32.8 32.8 L 30.8 28.4 C 33.2 21.8, 31.2 14.6, 24 11 Z"
            fill={`url(#${bodyGrad})`}
          />
          {/* Khía mũ giám mục */}
          <path
            d="M 20.5 18.2 L 27.2 24.4"
            fill="none"
            stroke={detailColor}
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <path
            d="M 19.6 15.8 C 17.6 19, 17.4 23.4, 18.8 27"
            fill="none"
            stroke={specular}
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <path d="M 15.2 32.8 L 12.2 38.4 L 35.8 38.4 L 32.8 32.8 Z" fill={`url(#${baseGrad})`} />
          <rect x="10.8" y="38.2" width="26.4" height="4" rx="2" fill={`url(#${baseGrad})`} />
        </g>
      )}

      {/* HẬU (QUEEN) */}
      {type === 'q' && (
        <g stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round">
          <circle cx="9.8" cy="14" r="2.3" fill={`url(#${bodyGrad})`} />
          <circle cx="16.5" cy="10" r="2.3" fill={`url(#${bodyGrad})`} />
          <circle cx="24" cy="8.4" r="2.6" fill={`url(#${bodyGrad})`} />
          <circle cx="31.5" cy="10" r="2.3" fill={`url(#${bodyGrad})`} />
          <circle cx="38.2" cy="14" r="2.3" fill={`url(#${bodyGrad})`} />
          <path
            d="M 10.8 16.4 L 15.8 28.2 L 17.2 12.4 L 22.8 26.2 L 24 11.2 L 25.2 26.2 L 30.8 12.4 L 32.2 28.2 L 37.2 16.4 L 34.4 34.4 L 13.6 34.4 Z"
            fill={`url(#${bodyGrad})`}
          />
          <path
            d="M 14.5 31.6 Q 24 29.4, 33.5 31.6"
            fill="none"
            stroke={detailColor}
            strokeWidth="1.2"
          />
          <path
            d="M 13.6 34.4 L 11.6 38.4 L 36.4 38.4 L 34.4 34.4 Z"
            fill={`url(#${baseGrad})`}
          />
          <rect x="10.6" y="38.2" width="26.8" height="4" rx="2" fill={`url(#${baseGrad})`} />
        </g>
      )}

      {/* VUA (KING) */}
      {type === 'k' && (
        <g stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round">
          {/* Thánh giá vương miện */}
          <path
            d="M 24 5.2 L 24 13.2 M 20.2 8.6 L 27.8 8.6"
            fill="none"
            stroke={isWhite ? '#232830' : '#4B5563'}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M 24 5.5 L 24 13 M 20.4 8.6 L 27.6 8.6"
            fill="none"
            stroke={isWhite ? '#F6F3EB' : '#161B22'}
            strokeWidth="1.15"
            strokeLinecap="round"
          />
          <path
            d="M 24 13.4 C 16.4 13.4, 11 18.2, 12.6 25.4 C 13.6 29.6, 16.2 32.2, 16.8 34.4 L 31.2 34.4 C 31.8 32.2, 34.4 29.6, 35.4 25.4 C 37 18.2, 31.6 13.4, 24 13.4 Z"
            fill={`url(#${bodyGrad})`}
          />
          <path d="M 24 15.2 L 24 33" fill="none" stroke={detailColor} strokeWidth="1.35" />
          <path
            d="M 16.2 18.6 C 14.5 21.8, 14.8 26.2, 17 29.8"
            fill="none"
            stroke={specular}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path d="M 15.6 34.4 L 12 38.4 L 36 38.4 L 32.4 34.4 Z" fill={`url(#${baseGrad})`} />
          <rect x="10.6" y="38.2" width="26.8" height="4" rx="2" fill={`url(#${baseGrad})`} />
        </g>
      )}
    </svg>
  );
}
