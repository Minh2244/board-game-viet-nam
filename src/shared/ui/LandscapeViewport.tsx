import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface LocalRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface LandscapeStageContextValue {
  stageW: number;
  stageH: number;
  scale: number;
  rotated: boolean;
  isCompactDevice: boolean;
  isMobileLite: boolean;
  forceLandscape: boolean;
  setForceLandscape: (forced: boolean) => void;
  toLocalRect: (el: Element | null | undefined) => LocalRect | null;
}

const DESIGN_MIN_W = 1220;
const DESIGN_MIN_H = 590;

interface ViewportMetrics {
  vw: number;
  vh: number;
  rotated: boolean;
  scale: number;
  stageW: number;
  stageH: number;
  isCompactDevice: boolean;
  isMobileLite: boolean;
}

function detectCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches);
}

function computeViewportMetrics(forceLandscape: boolean): ViewportMetrics {
  const vw = Math.max(320, Math.round(window.visualViewport?.width ?? window.innerWidth));
  const vh = Math.max(240, Math.round(window.visualViewport?.height ?? window.innerHeight));
  const isMobileLite = vw < 920 || vh < 540 || detectCoarsePointer();

  // Tầng 1: Tại Sảnh ngoài / Chọn chế độ / Phòng chờ (forceLandscape = false):
  // Điện thoại hiển thị 100% tự nhiên theo đúng chiều cầm máy — KHÔNG ép xoay 90° hay scale texture khổng lồ!
  if (!forceLandscape) {
    return {
      vw,
      vh,
      rotated: false,
      scale: 1,
      stageW: vw,
      stageH: vh,
      isCompactDevice: isMobileLite,
      isMobileLite,
    };
  }

  // Tầng 2: Khi bước vào bàn cờ (forceLandscape = true):
  // Trên điện thoại cầm dọc (cao > rộng & bề ngang < 920px): xoay ngang 90° và thu tỷ lệ vừa khít 100% bàn cờ 17×11
  const rotated = vh > vw && vw < 920;
  const availW = rotated ? vh : vw;
  const availH = rotated ? vw : vh;

  const scale = Math.min(1, availW / DESIGN_MIN_W, availH / DESIGN_MIN_H);
  const stageW = Math.round(availW / scale);
  const stageH = Math.round(availH / scale);
  const isCompactDevice = rotated || scale < 0.99 || isMobileLite;

  return { vw, vh, rotated, scale, stageW, stageH, isCompactDevice, isMobileLite };
}

const LandscapeStageContext = createContext<LandscapeStageContextValue>({
  stageW: 1366,
  stageH: 650,
  scale: 1,
  rotated: false,
  isCompactDevice: false,
  isMobileLite: false,
  forceLandscape: false,
  setForceLandscape: () => {},
  toLocalRect: () => null,
});

export function useLandscapeStage(): LandscapeStageContextValue {
  return useContext(LandscapeStageContext);
}

/**
 * Khung Sân Khấu Thông Minh 2 Tầng (Siêu mượt 60fps trên Điện thoại):
 * - Sảnh Chọn Game & Phòng chờ (`forceLandscape = false`): hiển thị tự nhiên `100vw × 100dvh`,
 *   gắn `data-mobile-lite="true"` tắt kính mờ backdrop-blur/bóng đổ nặng trên GPU di động.
 * - Trong Bàn Cờ (`forceLandscape = true`): tự xoay ngang 90° khi cầm dọc và cung cấp hệ tọa độ `toLocalRect` chuẩn xác.
 */
export function LandscapeViewport({ children }: { children: ReactNode }) {
  const [forceLandscape, setForceLandscapeState] = useState(false);
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => computeViewportMetrics(false));
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const setForceLandscape = useCallback((forced: boolean) => {
    setForceLandscapeState(forced);
  }, []);

  useEffect(() => {
    const update = () => {
      const next = computeViewportMetrics(forceLandscape);
      setMetrics((prev) =>
        prev.vw === next.vw &&
        prev.vh === next.vh &&
        prev.rotated === next.rotated &&
        prev.isMobileLite === next.isMobileLite &&
        Math.abs(prev.scale - next.scale) < 0.0005
          ? prev
          : next,
      );
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [forceLandscape]);

  const toLocalRect = useCallback((el: Element | null | undefined): LocalRect | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return null;

    const { vw, vh, rotated, scale, stageW, stageH } = metricsRef.current;
    const vx = r.left + r.width / 2;
    const vy = r.top + r.height / 2;
    const dx = vx - vw / 2;
    const dy = vy - vh / 2;

    const cx = rotated ? stageW / 2 + dy / scale : stageW / 2 + dx / scale;
    const cy = rotated ? stageH / 2 - dx / scale : stageH / 2 + dy / scale;
    const width = (rotated ? r.height : r.width) / scale;
    const height = (rotated ? r.width : r.height) / scale;

    return {
      left: cx - width / 2,
      right: cx + width / 2,
      top: cy - height / 2,
      bottom: cy + height / 2,
      width,
      height,
      cx,
      cy,
    };
  }, []);

  const needsTransform = forceLandscape && (metrics.rotated || metrics.scale < 1);
  const transformStyle = metrics.rotated
    ? `translate(-50%, -50%) rotate(90deg) scale(${metrics.scale})`
    : metrics.scale < 1
      ? `translate(-50%, -50%) scale(${metrics.scale})`
      : undefined;

  return (
    <LandscapeStageContext.Provider
      value={{
        stageW: metrics.stageW,
        stageH: metrics.stageH,
        scale: metrics.scale,
        rotated: metrics.rotated,
        isCompactDevice: metrics.isCompactDevice,
        isMobileLite: metrics.isMobileLite,
        forceLandscape,
        setForceLandscape,
        toLocalRect,
      }}
    >
      <div
        data-mobile-lite={metrics.isMobileLite ? 'true' : 'false'}
        className="fixed inset-0 overflow-hidden bg-[#111827] touch-manipulation"
      >
        {needsTransform ? (
          <div
            data-testid="landscape-stage"
            data-rotated={metrics.rotated ? 'true' : 'false'}
            data-scale={metrics.scale.toFixed(3)}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              width: `${metrics.stageW}px`,
              height: `${metrics.stageH}px`,
              transformOrigin: 'center center',
              transform: transformStyle,
            }}
            className="overflow-hidden"
          >
            {children}
          </div>
        ) : (
          <div
            data-testid="landscape-stage"
            data-rotated="false"
            data-scale="1.000"
            className="relative h-full w-full overflow-hidden"
          >
            {children}
          </div>
        )}
      </div>
    </LandscapeStageContext.Provider>
  );
}
