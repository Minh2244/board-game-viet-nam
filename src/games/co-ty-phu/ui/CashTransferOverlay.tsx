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
  progress: number; // 0..1
  items: CashParticleSeed[];
}

/** Cọc tiền giấy dày cột đai + Chồng đồng xu vàng nổi bật (trượt từ từ giữa Nhân Vật ↔ Ngân Hàng) */
function CashStackBundleSvg({ tone }: { tone: ActiveCashTransfer['tone'] }) {
  const billTop =
    tone === 'from-bank' ? '#6EE7B7' : tone === 'player-to-player' ? '#7DD3FC' : '#A7F3D0';
  const billMid =
    tone === 'from-bank' ? '#10B981' : tone === 'player-to-player' ? '#0284C7' : '#059669';
  const billSide =
    tone === 'from-bank' ? '#047857' : tone === 'player-to-player' ? '#075985' : '#065F46';
  const bandColor = tone === 'player-to-player' ? '#FBBF24' : '#84CC16';

  return (
    <svg
      viewBox="0 0 132 104"
      className="h-20 w-24 drop-shadow-[0_12px_18px_rgba(0,0,0,0.65)] sm:h-24 sm:w-30"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`stackTop-${tone}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={billTop} />
          <stop offset="100%" stopColor={billMid} />
        </linearGradient>
        <linearGradient id="goldCoinFace" x1="0" y1="0" x2="1" y2="1">
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
          {/* Cạnh dày bên dưới/trước xấp tiền */}
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
        fill={`url(#stackTop-${tone})`}
        stroke="#064E3B"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Khung viền hoa văn trên tờ tiền */}
      <polygon
        points="20,33 48,15 86,29 58,47"
        fill="none"
        stroke="#ECFDF5"
        strokeWidth="1.1"
        strokeDasharray="3 2"
        opacity="0.8"
      />
      {/* Huy hiệu mệnh giá giữa tờ tiền */}
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

      {/* Chồng đồng xu vàng cao óng ánh đặt cạnh xấp tiền (y hệt phong cách cổ điển) */}
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
            fill="url(#goldCoinFace)"
            stroke="#FEF08A"
            strokeWidth="1.1"
          />
        </g>
      ))}
      {/* Ký hiệu ₫ trên mặt đồng xu trên cùng */}
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
}

/** Đồng xu vàng nhỏ bay nối đuôi nhẹ tạo cảm giác chuyển động mượt */
function TrailingGoldCoinSvg() {
  return (
    <svg viewBox="0 0 26 26" className="h-5 w-5 drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)]" aria-hidden="true">
      <defs>
        <radialGradient id="coinTrailGold" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </radialGradient>
      </defs>
      <circle cx="13" cy="13" r="10.5" fill="url(#coinTrailGold)" stroke="#FEF08A" strokeWidth="1.6" />
      <text x="13" y="17" textAnchor="middle" fill="#78350F" fontSize="11" fontWeight="900" fontFamily="serif">
        ₫
      </text>
    </svg>
  );
}

function evalQuadBezier(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

export function CashTransferOverlay({ transfers }: { transfers: readonly ActiveCashTransfer[] }) {
  if (transfers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden" data-testid="cash-transfer-overlay">
      {/* Đường dẫn sáng êm dịu nối Nhân Vật Trái ↔ Ngân Hàng / Chủ Đất Phải */}
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {transfers.map((tr) => {
          const arcOpacity =
            tr.progress < 0.14
              ? tr.progress / 0.14
              : tr.progress > 0.86
                ? Math.max(0, (1 - tr.progress) / 0.14)
                : 0.85;
          const arcColor =
            tr.tone === 'from-bank' ? '#34D399' : tr.tone === 'player-to-player' ? '#38BDF8' : '#FDE047';

          const d = `M ${tr.startX} ${tr.startY} Q ${tr.ctrlX} ${tr.ctrlY} ${tr.endX} ${tr.endY}`;
          const arrivePulse = tr.progress > 0.7 ? Math.sin(((tr.progress - 0.7) / 0.3) * Math.PI) : 0;

          return (
            <g key={tr.id} opacity={arcOpacity}>
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
                className="animate-cash-arc"
              />
              {arrivePulse > 0 && (
                <>
                  <circle
                    cx={tr.endX}
                    cy={tr.endY}
                    r={16 + (1 - arrivePulse) * 34}
                    fill="none"
                    stroke="#FEF08A"
                    strokeWidth="3.2"
                    opacity={arrivePulse * 0.95}
                  />
                  <circle
                    cx={tr.endX}
                    cy={tr.endY}
                    r={12 + arrivePulse * 18}
                    fill={arcColor}
                    opacity={arrivePulse * 0.28}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Xấp tiền + Chồng xu vàng lớn trượt từ từ ngang sân giữa + đồng xu lấp lánh nối đuôi */}
      {transfers.map((tr) => {
        // Ease-in-out mượt mà, chậm rãi dễ nhìn
        const p = tr.progress;
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

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

        const badgeBorder =
          tr.tone === 'from-bank'
            ? 'border-emerald-300/95 bg-emerald-950/92 text-emerald-100'
            : tr.tone === 'player-to-player'
              ? 'border-sky-300/95 bg-slate-950/92 text-sky-100'
              : 'border-amber-300/95 bg-slate-950/92 text-amber-100';

        const amountColor =
          tr.tone === 'from-bank'
            ? 'text-emerald-300'
            : tr.tone === 'player-to-player'
              ? 'text-sky-300'
              : 'text-amber-300';

        return (
          <div key={tr.id}>
            {/* 3 đồng xu vàng nhỏ bay nhẹ nối đuôi phía sau xấp tiền chính */}
            {tr.items.slice(0, 3).map((item, idx) => {
              const trailP = Math.max(0, p - (idx + 1) * 0.085);
              if (trailP <= 0.02 || trailP >= 0.96) return null;
              const te = trailP < 0.5 ? 2 * trailP * trailP : 1 - Math.pow(-2 * trailP + 2, 2) / 2;
              const env = Math.sin(te * Math.PI);
              const cx = evalQuadBezier(tr.startX, tr.ctrlX, tr.endX, te) + item.spreadX * 0.8 * env;
              const cy = evalQuadBezier(tr.startY, tr.ctrlY, tr.endY, te) + item.spreadY * 0.8 * env;
              const cOp = (trailP < 0.14 ? trailP / 0.14 : trailP > 0.85 ? (1 - trailP) / 0.15 : 1) * 0.88;
              return (
                <div
                  key={idx}
                  style={{
                    left: cx,
                    top: cy,
                    opacity: cOp,
                    transform: `translate(-50%, -50%) rotate(${item.rotStart + te * 140}deg) scale(${0.8 + env * 0.25})`,
                  }}
                  className="absolute"
                >
                  <TrailingGoldCoinSvg />
                </div>
              );
            })}

            {/* Cọc tiền + Chồng xu vàng chính trượt chầm chậm rõ nét ngay giữa màn hình */}
            <div
              style={{
                left: bundleX,
                top: bundleY,
                opacity: bundleOpacity,
                transform: `translate(-50%, -50%) rotate(${tiltDeg}deg) scale(${bundleScale})`,
              }}
              className="absolute flex flex-col items-center"
            >
              <div
                className={`mb-1 flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-xs font-black shadow-[0_8px_22px_rgba(0,0,0,0.75)] backdrop-blur-sm ${badgeBorder}`}
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
              <CashStackBundleSvg tone={tr.tone} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
