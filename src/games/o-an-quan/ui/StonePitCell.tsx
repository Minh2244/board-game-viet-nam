import { memo } from 'react';
import type { PitState } from '../engine/types';

const PEBBLE_PALETTE = [
  { fill: '#F3EFE6', stroke: '#78716C' }, // Trắng ngà cuội
  { fill: '#D6B892', stroke: '#7C5A37' }, // Vàng cát
  { fill: '#A8A29E', stroke: '#44403C' }, // Xám đá cuội
  { fill: '#B68553', stroke: '#5C3A1E' }, // Nâu cuội
  { fill: '#E5DDD0', stroke: '#6B645C' }, // Kem sáng
  { fill: '#78716C', stroke: '#292524' }, // Đá trầm
] as const;

/**
 * Tọa độ cố định (Deterministic Seeded Scatter) giúp các viên sỏi nằm tự nhiên bên trong hố
 * mà KHÔNG bao giờ nhảy loạn khi React re-render.
 */
function getSeededPebblePos(pitIndex: number, stoneIdx: number, isMandarin: boolean) {
  const seed = (pitIndex + 1) * 9301 + (stoneIdx + 1) * 49297;
  const r1 = ((seed % 233280) / 233280);
  const r2 = (((seed * 7 + 13) % 233280) / 233280);
  const r3 = (((seed * 13 + 29) % 233280) / 233280);

  if (isMandarin) {
    // Xếp sỏi dân thành vòng cung quanh viên đá ngọc Quan ở tâm ô bán nguyệt
    const angle = (stoneIdx / 10) * Math.PI * 2 + r1 * 0.55;
    const radiusX = 22 + (stoneIdx % 2) * 8;
    const radiusY = 38 + (stoneIdx % 3) * 14;
    return {
      cx: 50 + Math.cos(angle) * radiusX,
      cy: 86 + Math.sin(angle) * radiusY,
      rx: 7.5 + r2 * 2.2,
      ry: 5.5 + r3 * 1.8,
      rot: Math.round((r1 - 0.5) * 60),
      color: PEBBLE_PALETTE[(pitIndex + stoneIdx) % PEBBLE_PALETTE.length],
    };
  }

  // Ô dân hình vuông: xếp xoắn ốc tự nhiên từ giữa ra ngoài
  const layer = Math.floor(stoneIdx / 5);
  const angle = stoneIdx * 2.39996 + (pitIndex % 5) * 0.6;
  const dist = Math.min(26, 6 + Math.sqrt(stoneIdx) * 8.2 + layer * 2);
  return {
    cx: 50 + Math.cos(angle) * dist + (r1 - 0.5) * 5,
    cy: 56 + Math.sin(angle) * (dist * 0.82) + (r2 - 0.5) * 5,
    rx: 8.6 + r3 * 2.4,
    ry: 6.2 + r1 * 1.8,
    rot: Math.round((r2 - 0.5) * 70),
    color: PEBBLE_PALETTE[(pitIndex * 3 + stoneIdx) % PEBBLE_PALETTE.length],
  };
}

interface StonePitCellProps {
  pit: PitState;
  isSelectable: boolean;
  isSelected: boolean;
  isHintTarget: boolean;
  highlightTone: 'pickup' | 'drop' | 'capture' | 'refill' | 'empty-bridge' | null;
  mandarinSide?: 'left' | 'right';
  mandarinPointValue?: 5 | 10;
  onSelect?: (pitIndex: number) => void;
}

export const StonePitCell = memo(function StonePitCell({
  pit,
  isSelectable,
  isSelected,
  isHintTarget,
  highlightTone,
  mandarinSide,
  mandarinPointValue = 10,
  onSelect,
}: StonePitCellProps) {
  const isMandarin = pit.kind === 'QUAN';
  const visibleStoneCount = Math.min(pit.stones, isMandarin ? 12 : 14);
  const totalPointsInPit = (pit.hasMandarin ? mandarinPointValue : 0) + pit.stones;

  const ringClass = isSelected
    ? 'ring-4 ring-amber-300 shadow-[0_0_24px_rgba(253,224,71,0.9)] scale-[1.03] z-20'
    : highlightTone === 'capture'
      ? 'ring-4 ring-emerald-300 shadow-[0_0_26px_rgba(52,211,153,0.95)] scale-[1.04] z-20'
      : highlightTone === 'drop'
        ? 'ring-3 ring-amber-200/95 shadow-[0_0_18px_rgba(251,191,36,0.75)] z-10'
        : highlightTone === 'pickup'
          ? 'ring-3 ring-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.85)] z-10'
          : highlightTone === 'refill'
            ? 'ring-3 ring-lime-300 shadow-[0_0_18px_rgba(163,230,53,0.8)] z-10'
            : highlightTone === 'empty-bridge'
              ? 'ring-3 ring-yellow-200/90 bg-yellow-400/20 z-10'
              : isHintTarget
                ? 'ring-4 ring-cyan-300 animate-pulse shadow-[0_0_22px_rgba(34,211,238,0.85)] z-10'
                : '';

  if (isMandarin) {
    const isLeftCap = mandarinSide === 'left';
    const roundedCls = isLeftCap
      ? 'rounded-l-[110px] rounded-r-[18px]'
      : 'rounded-r-[110px] rounded-l-[18px]';

    return (
      <div
        data-pit-index={pit.index}
        title={`Ô Quan ${pit.index === 5 ? 'Phải' : 'Trái'} — ${pit.hasMandarin ? `1 Quan (${mandarinPointValue}đ) + ` : ''}${pit.stones} dân (${totalPointsInPit}đ)`}
        className={`relative flex h-full w-[114px] shrink-0 flex-col items-center justify-center overflow-hidden border-2 border-[#5D371B]/90 transition-all duration-150 ${roundedCls} ${ringClass}`}
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, #8F5B34 0%, #6A3F1F 62%, #472711 100%)',
          boxShadow:
            'inset 0 8px 18px rgba(24, 10, 2, 0.72), inset 0 -3px 8px rgba(255, 214, 153, 0.16)',
        }}
      >
        {/* Nhãn số điểm / trạng thái đẩy lùi nhẹ vào trong để KHÔNG bị viền cong bán nguyệt cắt chữ */}
        <div
          className={`pointer-events-none absolute top-4 z-10 flex items-center gap-1 rounded-full border border-amber-200/50 bg-stone-950/80 px-2.5 py-0.5 text-[11px] font-black text-amber-200 shadow ${
            isLeftCap ? 'right-2.5' : 'left-2.5'
          }`}
        >
          <span>{pit.hasMandarin ? `Quan + ${pit.stones}` : pit.stones}</span>
        </div>

        <svg viewBox="0 0 100 172" className="pointer-events-none h-full w-full">
          <defs>
            <radialGradient id={`jadeQuan_${pit.index}`} cx="36%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="35%" stopColor="#6EE7B7" />
              <stop offset="72%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#065F46" />
            </radialGradient>
            <radialGradient id={`quanGlow_${pit.index}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FDE047" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sỏi dân tích tụ quanh ô Quan */}
          {Array.from({ length: visibleStoneCount }).map((_, idx) => {
            const p = getSeededPebblePos(pit.index, idx, true);
            return (
              <g key={idx} transform={`translate(${p.cx}, ${p.cy}) rotate(${p.rot})`}>
                <ellipse cx="1.5" cy="2.5" rx={p.rx} ry={p.ry} fill="rgba(18,8,2,0.45)" />
                <ellipse
                  cx="0"
                  cy="0"
                  rx={p.rx}
                  ry={p.ry}
                  fill={p.color.fill}
                  stroke={p.color.stroke}
                  strokeWidth="1.3"
                />
                <ellipse cx={-p.rx * 0.25} cy={-p.ry * 0.28} rx={p.rx * 0.35} ry={p.ry * 0.25} fill="#FFFFFF" opacity="0.45" />
              </g>
            );
          })}

          {/* Viên Đá Ngọc Quan Lớn (10 điểm) */}
          {pit.hasMandarin && (
            <g>
              <circle cx="50" cy="86" r="34" fill={`url(#quanGlow_${pit.index})`} />
              <ellipse cx="52" cy="91" rx="22" ry="26" fill="rgba(12, 6, 2, 0.55)" />
              <ellipse
                cx="50"
                cy="86"
                rx="21"
                ry="25"
                fill={`url(#jadeQuan_${pit.index})`}
                stroke="#064E3B"
                strokeWidth="2.4"
              />
              {/* Ánh ngọc sáng bóng */}
              <ellipse cx="43" cy="76" rx="6.5" ry="9" transform="rotate(-18 43 76)" fill="#FFFFFF" opacity="0.55" />
              <circle cx="56" cy="98" r="2.6" fill="#FEF08A" opacity="0.65" />
            </g>
          )}
        </svg>

        {/* Tổng điểm ô Quan ở chân ô — đặt lệch nhẹ vào trong tránh mép cong */}
        <div
          className={`pointer-events-none absolute bottom-3.5 z-10 rounded-full bg-black/55 px-2.5 py-0.5 text-[10.5px] font-black text-amber-300 ${
            isLeftCap ? 'right-4' : 'left-4'
          }`}
        >
          {totalPointsInPit}đ
        </div>
      </div>
    );
  }

  // Ô Dân hình vuông bo tròn chạm khắc lòng gỗ sâu
  return (
    <button
      type="button"
      data-pit-index={pit.index}
      disabled={!isSelectable}
      onClick={() => isSelectable && onSelect?.(pit.index)}
      className={`group relative flex h-[116px] w-[108px] flex-col items-center justify-center overflow-hidden rounded-[22px] border-2 border-[#5D371B]/90 transition-all duration-150 ${
        isSelectable
          ? 'cursor-pointer hover:brightness-110 hover:ring-2 hover:ring-amber-300/80'
          : 'cursor-default'
      } ${ringClass}`}
      style={{
        background:
          'radial-gradient(circle at 50% 48%, #935F38 0%, #6E4221 64%, #4B2912 100%)',
        boxShadow:
          'inset 0 7px 15px rgba(24, 10, 2, 0.72), inset 0 -2px 6px rgba(255, 214, 153, 0.16)',
      }}
    >
      {/* Huy hiệu số sỏi dân to rõ ở đỉnh ô */}
      <span
        className={`pointer-events-none absolute top-1.5 z-10 rounded-full border px-2.5 py-[1px] text-xs font-black shadow ${
          pit.stones === 0
            ? 'border-white/15 bg-stone-950/60 text-stone-400'
            : isSelected
              ? 'border-amber-200 bg-amber-400 text-stone-950'
              : 'border-amber-200/45 bg-stone-950/78 text-amber-200'
        }`}
      >
        {pit.stones}
      </span>

      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full">
        {Array.from({ length: visibleStoneCount }).map((_, idx) => {
          const p = getSeededPebblePos(pit.index, idx, false);
          return (
            <g key={idx} transform={`translate(${p.cx}, ${p.cy}) rotate(${p.rot})`}>
              <ellipse cx="1.5" cy="2.5" rx={p.rx} ry={p.ry} fill="rgba(18, 8, 2, 0.48)" />
              <ellipse
                cx="0"
                cy="0"
                rx={p.rx}
                ry={p.ry}
                fill={p.color.fill}
                stroke={p.color.stroke}
                strokeWidth="1.4"
              />
              <ellipse
                cx={-p.rx * 0.25}
                cy={-p.ry * 0.28}
                rx={p.rx * 0.35}
                ry={p.ry * 0.25}
                fill="#FFFFFF"
                opacity="0.45"
              />
            </g>
          );
        })}
      </svg>

      {isHintTarget && (
        <span className="pointer-events-none absolute bottom-1 z-10 rounded-full bg-cyan-400 px-2 py-[1px] text-[9.5px] font-black text-slate-950 shadow">
          💡 Gợi ý
        </span>
      )}
    </button>
  );
});
