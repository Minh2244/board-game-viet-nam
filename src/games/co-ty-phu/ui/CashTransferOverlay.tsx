import { memo, useEffect, useMemo, useRef } from 'react';
import { formatShortVnd } from '../engine/rules';

export interface CashParticleSeed {
  delay: number; // 0..0.34
  isCoin: boolean;
  spreadX: number;
  spreadY: number;
  rotStart: number;
  rotEnd: number;
}

export interface ActiveCashTransfer {
  id: number;
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  amount: number;
  tone: 'to-bank' | 'from-bank' | 'player-to-player';
  fromName: string;
  toName: string;
  reasonText: string;
  durationMs: number;
  items: CashParticleSeed[];
  onArrive?: () => void;
  onComplete?: () => void;
}

/** Cọc tiền giấy dày cột đai + Chồng đồng xu vàng nổi bật (trượt từ từ giữa Nhân Vật ↔ Ngân Hàng) */
const CashStackBundleSvg = memo(function CashStackBundleSvg({
  tone,
  uid,
}: {
  tone: ActiveCashTransfer['tone'];
  uid: number;
}) {
  const billTop =
    tone === 'from-bank' ? '#6EE7B7' : tone === 'player-to-player' ? '#7DD3FC' : '#A7F3D0';
  const billMid =
    tone === 'from-bank' ? '#10B981' : tone === 'player-to-player' ? '#0284C7' : '#059669';
  const billSide =
    tone === 'from-bank' ? '#047857' : tone === 'player-to-player' ? '#075985' : '#065F46';
  const bandColor = tone === 'player-to-player' ? '#FBBF24' : '#84CC16';
  const topGradId = `stackTop-${tone}-${uid}`;
  const coinGradId = `goldCoinFace-${uid}`;

  return (
    <svg
      viewBox="0 0 132 104"
      className="h-20 w-24 drop-shadow-[0_12px_18px_rgba(0,0,0,0.65)] sm:h-24 sm:w-30"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={topGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={billTop} />
          <stop offset="100%" stopColor={billMid} />
        </linearGradient>
        <linearGradient id={coinGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="55%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
      </defs>

      {/* Bóng đổ mềm phía dưới xấp tiền */}
      <ellipse cx="66" cy="94" rx="54" ry="8" fill="rgba(2, 6, 23, 0.42)" />

      {/* Xấp tiền giấy nhiều lớp xếp chồng kiểu isometric */}
      {[34, 28, 22, 16, 10, 4].map((dy, idx) => (
        <g key={dy} transform={`translate(0, ${dy})`}>
          <polygon
            points="12,34 58,52 94,28 94,35 58,59 12,41"
            fill={idx % 2 === 0 ? '#D1FAE5' : '#A7F3D0'}
            stroke={billSide}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </g>
      ))}

      {/* Mặt tờ tiền trên cùng của xấp tiền */}
      <polygon
        points="12,34 48,10 94,28 58,52"
        fill={`url(#${topGradId})`}
        stroke="#064E3B"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <polygon
        points="20,33 48,15 86,29 58,47"
        fill="none"
        stroke="#ECFDF5"
        strokeWidth="1.1"
        strokeDasharray="3 2"
        opacity="0.8"
      />
      <ellipse cx="53" cy="31" rx="11" ry="7" fill="rgba(6, 78, 59, 0.35)" stroke="#FEF08A" strokeWidth="1.2" />
      <text
        x="53"
        y="35"
        textAnchor="middle"
        fill="#FEF9C3"
        fontSize="12"
        fontWeight="900"
        fontFamily="serif"
      >
        ₫
      </text>

      {/* Đai cột tiền màu xanh chuối/vàng nổi bật bọc quanh cả xấp tiền */}
      <polygon
        points="38,17 50,10 74,19.5 62,27"
        fill={bandColor}
        stroke="#365314"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polygon
        points="62,27 74,19.5 74,59.5 62,67"
        fill={bandColor}
        stroke="#365314"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Chồng đồng xu vàng cao óng ánh đặt cạnh xấp tiền */}
      {[78, 72, 66, 60, 54, 48, 42].map((cy, idx) => (
        <g key={cy}>
          <ellipse
            cx="97"
            cy={cy + 3.5}
            rx="18.5"
            ry="8.5"
            fill={idx % 2 === 0 ? '#B45309' : '#CA8A04'}
            stroke="#78350F"
            strokeWidth="1.2"
          />
          <ellipse
            cx="97"
            cy={cy}
            rx="18.5"
            ry="8.5"
            fill={`url(#${coinGradId})`}
            stroke="#FEF08A"
            strokeWidth="1.1"
          />
        </g>
      ))}
      <ellipse cx="97" cy="42" rx="12" ry="5" fill="none" stroke="#92400E" strokeWidth="1" opacity="0.65" />
      <text
        x="97"
        y="45.5"
        textAnchor="middle"
        fill="#78350F"
        fontSize="10"
        fontWeight="900"
        fontFamily="serif"
      >
        ₫
      </text>
    </svg>
  );
});

/** Đồng xu vàng nhỏ bay nối đuôi nhẹ tạo cảm giác chuyển động mượt */
const TrailingGoldCoinSvg = memo(function TrailingGoldCoinSvg({ uid }: { uid: string }) {
  const gradId = `coinTrailGold-${uid}`;
  return (
    <svg viewBox="0 0 26 26" className="h-5 w-5 drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)]" aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </radialGradient>
      </defs>
      <circle cx="13" cy="13" r="10.5" fill={`url(#${gradId})`} stroke="#FEF08A" strokeWidth="1.6" />
      <text x="13" y="17" textAnchor="middle" fill="#78350F" fontSize="11" fontWeight="900" fontFamily="serif">
        ₫
      </text>
    </svg>
  );
});

function evalQuadBezier(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/**
 * Mỗi chuyến chuyển tiền tự chạy vòng lặp requestAnimationFrame độc lập và cập nhật thẳng DOM ref
 * bằng `transform: translate3d(...)` thuần GPU — đạt 0 React re-render trên toàn bàn cờ suốt 1.52s bay!
 */
const CashTransferFlightItem = memo(function CashTransferFlightItem({
  tr,
}: {
  tr: ActiveCashTransfer;
}) {
  const arcGroupRef = useRef<SVGGElement | null>(null);
  const pulseOuterRef = useRef<SVGCircleElement | null>(null);
  const pulseInnerRef = useRef<SVGCircleElement | null>(null);
  const bundleRef = useRef<HTMLDivElement | null>(null);
  const coinRefs = useRef<(HTMLDivElement | null)[]>([]);
  const callbacksRef = useRef({ onArrive: tr.onArrive, onComplete: tr.onComplete });
  callbacksRef.current = { onArrive: tr.onArrive, onComplete: tr.onComplete };

  const arcColor =
    tr.tone === 'from-bank' ? '#34D399' : tr.tone === 'player-to-player' ? '#38BDF8' : '#FDE047';
  const badgeBorder =
    tr.tone === 'from-bank'
      ? 'border-emerald-300/95 bg-emerald-950/95 text-emerald-100'
      : tr.tone === 'player-to-player'
        ? 'border-sky-300/95 bg-slate-950/95 text-sky-100'
        : 'border-amber-300/95 bg-slate-950/95 text-amber-100';
  const amountColor =
    tr.tone === 'from-bank'
      ? 'text-emerald-300'
      : tr.tone === 'player-to-player'
        ? 'text-sky-300'
        : 'text-amber-300';
  const d = `M ${tr.startX} ${tr.startY} Q ${tr.ctrlX} ${tr.ctrlY} ${tr.endX} ${tr.endY}`;
  const trailCoins = useMemo(() => tr.items.slice(0, 3), [tr.items]);

  useEffect(() => {
    let rafId = 0;
    let cancelled = false;
    let arrived = false;
    let completed = false;
    const tStart = performance.now();
    const durationMs = Math.max(300, tr.durationMs);

    const completeOnce = () => {
      if (completed) return;
      completed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(safetyTimer);
      if (!arrived) {
        arrived = true;
        callbacksRef.current.onArrive?.();
      }
      callbacksRef.current.onComplete?.();
    };

    // Bảo vệ chống đơ tuyệt đối nếu tab bị ẩn/trình duyệt dừng RAF giữa chuyến bay tiền
    const safetyTimer = setTimeout(completeOnce, durationMs + 450);

    const tick = (now: number) => {
      if (cancelled || completed) return;
      const p = Math.min(1, Math.max(0, (now - tStart) / durationMs));
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

      if (!arrived && p >= 0.78) {
        arrived = true;
        callbacksRef.current.onArrive?.();
      }

      // 1. Đường cung ánh sáng & vòng sóng chạm đích
      const arcOpacity =
        p < 0.14 ? p / 0.14 : p > 0.86 ? Math.max(0, (1 - p) / 0.14) : 0.85;
      if (arcGroupRef.current) {
        arcGroupRef.current.style.opacity = String(arcOpacity);
      }

      const arrivePulse = p > 0.7 ? Math.sin(((p - 0.7) / 0.3) * Math.PI) : 0;
      if (pulseOuterRef.current) {
        pulseOuterRef.current.setAttribute('r', String(16 + (1 - arrivePulse) * 34));
        pulseOuterRef.current.setAttribute('opacity', String(arrivePulse > 0 ? arrivePulse * 0.95 : 0));
      }
      if (pulseInnerRef.current) {
        pulseInnerRef.current.setAttribute('r', String(12 + arrivePulse * 18));
        pulseInnerRef.current.setAttribute('opacity', String(arrivePulse > 0 ? arrivePulse * 0.28 : 0));
      }

      // 2. Cọc tiền & chồng xu vàng chính bay thuần GPU translate3d
      const bundleX = evalQuadBezier(tr.startX, tr.ctrlX, tr.endX, ease);
      const bundleY = evalQuadBezier(tr.startY, tr.ctrlY, tr.endY, ease) - Math.sin(ease * Math.PI) * 14;
      const bundleOpacity = p < 0.12 ? p / 0.12 : p > 0.88 ? Math.max(0, (1 - p) / 0.12) : 1;
      const bundleScale =
        p < 0.16
          ? 0.72 + (p / 0.16) * 0.32
          : p > 0.84
            ? 1.04 - ((p - 0.84) / 0.16) * 0.34
            : 1.04 + Math.sin(ease * Math.PI) * 0.08;
      const tiltDeg = (tr.endX >= tr.startX ? 1 : -1) * Math.sin(ease * Math.PI) * 5;

      if (bundleRef.current) {
        bundleRef.current.style.opacity = String(bundleOpacity);
        bundleRef.current.style.transform = `translate3d(${bundleX}px, ${bundleY}px, 0) translate(-50%, -50%) rotate(${tiltDeg}deg) scale(${bundleScale})`;
      }

      // 3. 3 đồng xu vàng bay nối đuôi thuần GPU translate3d
      for (let idx = 0; idx < trailCoins.length; idx += 1) {
        const el = coinRefs.current[idx];
        if (!el) continue;
        const item = trailCoins[idx];
        const trailP = Math.max(0, p - (idx + 1) * 0.085);
        if (trailP <= 0.02 || trailP >= 0.96) {
          el.style.opacity = '0';
          continue;
        }
        const te = trailP < 0.5 ? 2 * trailP * trailP : 1 - Math.pow(-2 * trailP + 2, 2) / 2;
        const env = Math.sin(te * Math.PI);
        const cx = evalQuadBezier(tr.startX, tr.ctrlX, tr.endX, te) + item.spreadX * 0.8 * env;
        const cy = evalQuadBezier(tr.startY, tr.ctrlY, tr.endY, te) + item.spreadY * 0.8 * env;
        const cOp = (trailP < 0.14 ? trailP / 0.14 : trailP > 0.85 ? (1 - trailP) / 0.15 : 1) * 0.88;
        el.style.opacity = String(cOp);
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) rotate(${item.rotStart + te * 140}deg) scale(${0.8 + env * 0.25})`;
      }

      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        completeOnce();
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(safetyTimer);
    };
  }, [tr, trailCoins]);

  return (
    <>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <g ref={arcGroupRef} style={{ opacity: 0, willChange: 'opacity' }}>
          <path
            d={d}
            fill="none"
            stroke={arcColor}
            strokeWidth="5.5"
            strokeLinecap="round"
            opacity="0.22"
          />
          <path
            d={d}
            fill="none"
            stroke={arcColor}
            strokeWidth="2.8"
            strokeDasharray="10 8"
            strokeLinecap="round"
          />
          <circle
            ref={pulseOuterRef}
            cx={tr.endX}
            cy={tr.endY}
            r="16"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="3.2"
            opacity="0"
          />
          <circle
            ref={pulseInnerRef}
            cx={tr.endX}
            cy={tr.endY}
            r="12"
            fill={arcColor}
            opacity="0"
          />
        </g>
      </svg>

      {trailCoins.map((_, idx) => (
        <div
          key={idx}
          ref={(el) => {
            coinRefs.current[idx] = el;
          }}
          style={{
            left: 0,
            top: 0,
            opacity: 0,
            transform: `translate3d(${tr.startX}px, ${tr.startY}px, 0) translate(-50%, -50%)`,
            willChange: 'transform, opacity',
          }}
          className="absolute"
        >
          <TrailingGoldCoinSvg uid={`${tr.id}-${idx}`} />
        </div>
      ))}

      <div
        ref={bundleRef}
        style={{
          left: 0,
          top: 0,
          opacity: 0,
          transform: `translate3d(${tr.startX}px, ${tr.startY}px, 0) translate(-50%, -50%)`,
          willChange: 'transform, opacity',
        }}
        className="absolute flex flex-col items-center"
      >
        <div
          className={`mb-1 flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-xs font-black shadow-[0_8px_22px_rgba(0,0,0,0.75)] ${badgeBorder}`}
        >
          <span>{tr.fromName}</span>
          <span className="text-amber-300">➔</span>
          <span>{tr.toName}</span>
          <span className={`ml-0.5 font-black ${amountColor}`}>
            {tr.tone === 'from-bank' ? '+' : tr.tone === 'to-bank' ? '-' : ''}
            {formatShortVnd(tr.amount)}
          </span>
          {tr.reasonText && (
            <span className="inline rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold opacity-90">
              {tr.reasonText}
            </span>
          )}
        </div>
        <CashStackBundleSvg tone={tr.tone} uid={tr.id} />
      </div>
    </>
  );
});

export const CashTransferOverlay = memo(function CashTransferOverlay({
  transfers,
}: {
  transfers: readonly ActiveCashTransfer[];
}) {
  if (transfers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden" data-testid="cash-transfer-overlay">
      {transfers.map((tr) => (
        <CashTransferFlightItem key={tr.id} tr={tr} />
      ))}
    </div>
  );
});
