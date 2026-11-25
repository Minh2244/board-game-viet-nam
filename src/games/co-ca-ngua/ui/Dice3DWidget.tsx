import { useEffect, useRef, useState } from 'react';
import { horseAudio } from '../audio/horseAudio';

export interface Dice3DWidgetProps {
  /** Giá trị mặt hiển thị (1..6) */
  value: number | null;
  /** Tăng số này mỗi lần tung mới để kích hoạt quỹ đạo nhảy & nảy 3 nhịp chuẩn như Cờ Tỷ Phú */
  rollSeq: number;
  /** Tốc độ diễn hoạt 1× hoặc 2× */
  speedMult?: 1 | 2;
  /** Có đang tới lượt người chơi cục bộ được phép chạm tung xúc xắc hay không */
  canRoll: boolean;
  onRoll: () => void;
  /** Kích thước cơ sở của khối lập phương 3D (px) */
  size?: number;
}

const PIP_POSITIONS: Record<number, readonly [number, number][]> = {
  1: [[50, 50]],
  2: [
    [26, 26],
    [74, 74],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [26, 26],
    [74, 26],
    [26, 74],
    [74, 74],
  ],
  5: [
    [26, 26],
    [74, 26],
    [50, 50],
    [26, 74],
    [74, 74],
  ],
  6: [
    [26, 23],
    [74, 23],
    [26, 50],
    [74, 50],
    [26, 77],
    [74, 77],
  ],
};

/** Góc quay mục tiêu (rx, ry) của khối lập phương 3D để đúng mặt `face` hướng thẳng về phía người xem (+Z) */
function getTargetEulerForFace(face: number): { rx: number; ry: number } {
  switch (face) {
    case 1:
      return { rx: 0, ry: 0 };
    case 6:
      return { rx: 0, ry: 180 };
    case 2:
      return { rx: 0, ry: -90 };
    case 5:
      return { rx: 0, ry: 90 };
    case 3:
      return { rx: -90, ry: 0 };
    case 4:
      return { rx: 90, ry: 0 };
    default:
      return { rx: 0, ry: 0 };
  }
}

interface SparkParticle {
  id: number;
  dx: number;
  dy: number;
  color: string;
}

/**
 * Xúc xắc 3D khối lập phương 6 mặt thật (CSS preserve-3d) đặt tại trung tâm bàn cờ.
 * Diễn hoạt bay vồng lên cao → xoay tít 3 trục → rơi nảy 3 nhịp [0.40, 0.70, 0.89] + tóe tia sáng
 * kèm tiếng đập bàn gỗ sống động hệt như Cờ Tỷ Phú 3D!
 */
export function Dice3DWidget({
  value,
  rollSeq,
  speedMult = 1,
  canRoll,
  onRoll,
  size = 64,
}: Dice3DWidgetProps) {
  const safeValue = value ?? 6;
  const initialEuler = getTargetEulerForFace(safeValue);

  const [isAnimating, setIsAnimating] = useState(false);
  const [sparks, setSparks] = useState<SparkParticle[]>([]);
  const [bonusGlow, setBonusGlow] = useState(false);

  const lastSeqRef = useRef(rollSeq);
  const currentRotRef = useRef({ rx: initialEuler.rx, ry: initialEuler.ry, rz: 0 });
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sparkUidRef = useRef(1);

  const applyPoseToDom = (p: {
    rx: number;
    ry: number;
    rz: number;
    x: number;
    y: number;
    scale: number;
    shadowScale: number;
    shadowOpacity: number;
  }) => {
    if (cubeRef.current) {
      cubeRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.scale}) rotateZ(${p.rz}deg) rotateX(${p.rx}deg) rotateY(${p.ry}deg)`;
    }
    if (shadowRef.current) {
      shadowRef.current.style.transform = `translate3d(${p.x * 0.6}px, 0, 0) scale(${p.shadowScale})`;
      shadowRef.current.style.opacity = String(p.shadowOpacity);
    }
  };

  // Đồng bộ mặt thẳng tắp vuông vức khi khôi phục ván hoặc đứng yên (cập nhật thẳng DOM ref -> 0 re-render!)
  useEffect(() => {
    if (rollSeq === lastSeqRef.current && !isAnimating) {
      const target = getTargetEulerForFace(safeValue);
      currentRotRef.current = { rx: target.rx, ry: target.ry, rz: 0 };
      applyPoseToDom({
        rx: target.rx,
        ry: target.ry,
        rz: 0,
        x: 0,
        y: 0,
        scale: 1,
        shadowScale: 1,
        shadowOpacity: 0.42,
      });
    }
  }, [safeValue, rollSeq, isAnimating]);

  // Kích hoạt quỹ đạo tung - xoay - rơi nảy 3 nhịp khi rollSeq tăng!
  useEffect(() => {
    if (rollSeq === lastSeqRef.current) return;
    lastSeqRef.current = rollSeq;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const targetFace = value ?? 6;
    const isBonus = targetFace === 1 || targetFace === 6;
    const targetBase = getTargetEulerForFace(targetFace);

    // Xoay đúng 2 vòng trọn vẹn trên không rồi đáp xuống THẲNG TẮP vuông vức (rx, ry chuẩn, rz = 0)!
    const startRx = currentRotRef.current.rx;
    const startRy = currentRotRef.current.ry;
    const startRz = currentRotRef.current.rz;
    const endRx = targetBase.rx + 720;
    const endRy = targetBase.ry + 720;
    const endRz = 0;

    const startOffsetX = (Math.random() > 0.5 ? 1 : -1) * (28 + Math.random() * 18);
    const durationMs = speedMult === 2 ? 520 : 880;
    const bounceTimes = [0.40, 0.70, 0.89];
    let nextBounceIdx = 0;

    setIsAnimating(true);
    setBonusGlow(false);
    horseAudio.playDiceShake();

    const triggerSparks = (count: number, color: string) => {
      const batch: SparkParticle[] = [];
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
        const dist = 28 + Math.random() * 34;
        batch.push({
          id: sparkUidRef.current++,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          color,
        });
      }
      setSparks(batch);
      setTimeout(() => setSparks([]), 380);
    };

    const startTime = performance.now();

    const tick = (now: number) => {
      const raw = (now - startTime) / durationMs;
      const t = Math.min(1, Math.max(0, raw));

      // Kích hoạt âm thanh đập bàn & tóe tia sáng đúng từng nhịp nảy
      if (nextBounceIdx < bounceTimes.length && t >= bounceTimes[nextBounceIdx]) {
        horseAudio.playDiceBounce(nextBounceIdx);
        triggerSparks(nextBounceIdx === 0 ? 10 : nextBounceIdx === 1 ? 6 : 4, nextBounceIdx === 0 ? '#FDE047' : '#FEF3C7');
        nextBounceIdx += 1;
      }

      // Quỹ đạo độ cao nảy 3 nhịp giống hệt Cờ Tỷ Phú 3D (nhảy vọt lên rồi rơi đập bàn 3 lần!)
      const peak1 = 128; // Độ cao đỉnh phóng (px)
      const peak2 = 46;  // Nảy lần 2
      const peak3 = 16;  // Nảy lần 3

      let liftY = 0;
      if (t < 0.40) {
        // Phóng vọt lên cao ở t=0.14 rồi rơi tăng tốc mạnh xuống chạm bàn ở t=0.40
        const p = t / 0.40;
        liftY = Math.sin(p * Math.PI) * peak1;
      } else if (t < 0.70) {
        const p = (t - 0.40) / 0.30;
        liftY = Math.sin(p * Math.PI) * peak2;
      } else if (t < 0.89) {
        const p = (t - 0.70) / 0.19;
        liftY = Math.sin(p * Math.PI) * peak3;
      } else {
        liftY = 0;
      }

      const easeMove = 1 - Math.pow(1 - Math.min(1, t / 0.90), 2.3);
      const curX = startOffsetX * (1 - easeMove);
      const rotEase = 1 - Math.pow(1 - Math.min(1, t / 0.92), 2.15);

      const curRx = startRx + (endRx - startRx) * rotEase;
      const curRy = startRy + (endRy - startRy) * rotEase;
      const curRz = startRz + (endRz - startRz) * rotEase;

      // Hiệu ứng phối cảnh: bay càng cao khối xúc xắc càng phóng to nổi lên gần mắt!
      const heightRatio = liftY / peak1;
      const scale = 1 + heightRatio * 0.65;
      const shadowScale = Math.max(0.45, 1 - heightRatio * 0.48);
      const shadowOpacity = Math.max(0.14, 0.46 - heightRatio * 0.28);

      applyPoseToDom({
        rx: curRx,
        ry: curRy,
        rz: curRz,
        x: curX,
        y: -liftY,
        scale,
        shadowScale,
        shadowOpacity,
      });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Chốt thẳng tắp vuông vức về đúng mặt vừa đổ
      const finalRx = targetBase.rx;
      const finalRy = targetBase.ry;
      currentRotRef.current = { rx: finalRx, ry: finalRy, rz: 0 };
      applyPoseToDom({
        rx: finalRx,
        ry: finalRy,
        rz: 0,
        x: 0,
        y: 0,
        scale: 1,
        shadowScale: 1,
        shadowOpacity: 0.44,
      });
      setIsAnimating(false);

      if (isBonus) {
        setBonusGlow(true);
        horseAudio.playDiceLand(true);
        triggerSparks(14, '#FACC15');
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollSeq]);

  const half = size / 2;
  const faces: { num: number; transform: string }[] = [
    { num: 1, transform: `rotateY(0deg) translateZ(${half}px)` },
    { num: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { num: 2, transform: `rotateY(90deg) translateZ(${half}px)` },
    { num: 5, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { num: 3, transform: `rotateX(90deg) translateZ(${half}px)` },
    { num: 4, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Vòng hào quang mời tung khi đến lượt người chơi */}
      {canRoll && !isAnimating && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full animate-ping"
          style={{
            width: size + 26,
            height: size + 26,
            border: '3px solid rgba(250, 204, 21, 0.78)',
            background: 'radial-gradient(circle, rgba(253,224,71,0.34) 0%, transparent 72%)',
          }}
        />
      )}

      {/* Vòng hào quang vàng kim khi đổ trúng 1 hoặc 6 */}
      {bonusGlow && !isAnimating && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size + 30,
            height: size + 30,
            boxShadow: '0 0 28px rgba(250, 204, 21, 0.95), inset 0 0 14px rgba(254, 240, 138, 0.85)',
            border: '2.5px solid #FDE047',
          }}
        />
      )}

      {/* Bóng đổ thật xuống mặt bàn (cập nhật trực tiếp qua shadowRef — 0 re-render 60fps!) */}
      <div
        ref={shadowRef}
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          width: size * 1.08,
          height: size * 0.56,
          bottom: -6,
          background: 'radial-gradient(ellipse, rgba(28,14,4,0.8) 0%, rgba(28,14,4,0) 72%)',
          transform: 'translate3d(0px, 0, 0) scale(1)',
          opacity: 0.42,
          willChange: 'transform, opacity',
        }}
      />

      {/* Tia sáng tóe ra mỗi lần xúc xắc đập bàn */}
      {sparks.map((sp) => (
        <span
          key={sp.id}
          aria-hidden="true"
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full transition-all duration-300"
          style={{
            backgroundColor: sp.color,
            boxShadow: `0 0 8px ${sp.color}`,
            transform: `translate(${sp.dx}px, ${sp.dy}px) scale(0.35)`,
            opacity: 0.9,
          }}
        />
      ))}

      {/* Nút tương tác chứa khối xúc xắc 3D thật */}
      <button
        type="button"
        data-testid="ccn-center-dice-btn"
        onClick={canRoll ? onRoll : undefined}
        disabled={!canRoll}
        aria-label={canRoll ? 'Chạm tung xúc xắc' : `Xúc xắc ${safeValue} nút`}
        title={canRoll ? 'Chạm xúc xắc hoặc bấm phím Space để tung!' : `Kết quả: ${safeValue} nút`}
        className={`relative flex items-center justify-center focus:outline-none ${
          canRoll && !isAnimating ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'
        } transition-transform`}
        style={{
          width: size + 16,
          height: size + 16,
          perspective: '420px',
        }}
      >
        <div
          ref={cubeRef}
          style={{
            width: size,
            height: size,
            transformStyle: 'preserve-3d',
            transform: `translate3d(0px, 0px, 0) scale(1) rotateZ(0deg) rotateX(${initialEuler.rx}deg) rotateY(${initialEuler.ry}deg)`,
            willChange: 'transform',
          }}
        >
          {faces.map(({ num, transform }) => {
            const isRed = num === 1 || num === 4;
            const pips = PIP_POSITIONS[num];
            return (
              <div
                key={num}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: size,
                  height: size,
                  transform,
                  backfaceVisibility: 'hidden',
                  borderRadius: Math.round(size * 0.2),
                  background: 'linear-gradient(145deg, #FFFFFF 0%, #FAF4E6 65%, #EAE0CC 100%)',
                  border: `2px solid ${bonusGlow && num === safeValue ? '#F59E0B' : '#C8B99E'}`,
                  boxShadow:
                    'inset 0 2px 4px rgba(255,255,255,0.95), inset 0 -3px 6px rgba(130,108,76,0.28)',
                }}
              >
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  {pips.map(([cx, cy], idx) => (
                    <g key={idx}>
                      {/* Viền lõm nhẹ quanh chấm xúc xắc */}
                      <circle
                        cx={cx}
                        cy={cy + 1.5}
                        r={num === 1 ? 15.5 : 10.5}
                        fill="rgba(180, 160, 130, 0.35)"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={num === 1 ? 14 : 9.4}
                        fill={isRed ? '#DC2626' : '#1E293B'}
                      />
                    </g>
                  ))}
                </svg>
              </div>
            );
          })}
        </div>
      </button>

      {/* Nhãn mời chạm siêu gọn chỉ hiện khi tới lượt bạn tung */}
      {canRoll && !isAnimating && (
        <div className="pointer-events-none absolute -bottom-7 whitespace-nowrap rounded-full border border-amber-950 bg-gradient-to-b from-yellow-300 to-amber-500 px-3 py-0.5 text-[10.5px] font-black tracking-wide text-amber-950 shadow-lg animate-bounce">
          🎲 CHẠM TUNG (SPACE)
        </div>
      )}
    </div>
  );
}
