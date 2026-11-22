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
}

function computeViewportMetrics(): ViewportMetrics {
  const vw = Math.max(320, Math.round(window.visualViewport?.width ?? window.innerWidth));
  const vh = Math.max(240, Math.round(window.visualViewport?.height ?? window.innerHeight));

  // Trên điện thoại cầm dọc (cao > rộng & bề ngang < 920px): tự động xoay ngang 90° mặc định
  const rotated = vh > vw && vw < 920;
  const availW = rotated ? vh : vw;
  const availH = rotated ? vw : vh;

  // Tự thu nhỏ đều theo kích thước từng loại điện thoại / tablet để luôn nhìn trọn & sắc nét
  const scale = Math.min(1, availW / DESIGN_MIN_W, availH / DESIGN_MIN_H);
  const stageW = Math.round(availW / scale);
  const stageH = Math.round(availH / scale);
  const isCompactDevice = rotated || scale < 0.99;

  return { vw, vh, rotated, scale, stageW, stageH, isCompactDevice };
}

const LandscapeStageContext = createContext<LandscapeStageContextValue>({
  stageW: 1366,
  stageH: 650,
  scale: 1,
  rotated: false,
  isCompactDevice: false,
  toLocalRect: () => null,
});

export function useLandscapeStage(): LandscapeStageContextValue {
  return useContext(LandscapeStageContext);
}

/**
 * Khung Sân Khấu Mặc Định Nằm Ngang cho mọi thiết bị:
 * - PC / Laptop (>= 1220×590): giữ nguyên 100% scale = 1, không xoay.
 * - Điện thoại cầm ngang hoặc tablet nhỏ: giữ ngang, tự thu tỷ lệ scale vừa khít 100% màn hình.
 * - Điện thoại cầm dọc: tự xoay 90° sang chế độ nằm ngang mặc định và thu tỷ lệ vừa khít 100% màn hình,
 *   đồng thời cung cấp hệ quy chiếu tọa độ cục bộ chuẩn tuyệt đối cho quân cờ, bay tiền, máy bay & VFX.
 */
export function LandscapeViewport({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => computeViewportMetrics());
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  useEffect(() => {
    const update = () => {
      const next = computeViewportMetrics();
      setMetrics((prev) =>
        prev.vw === next.vw &&
        prev.vh === next.vh &&
        prev.rotated === next.rotated &&
        Math.abs(prev.scale - next.scale) < 0.0005
          ? prev
          : next,
      );
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

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

  const transformStyle = metrics.rotated
    ? `translate(-50%, -50%) rotate(90deg) scale(${metrics.scale})`
    : metrics.scale < 1
      ? `translate(-50%, -50%) scale(${metrics.scale})`
      : 'translate(-50%, -50%)';

  return (
    <LandscapeStageContext.Provider
      value={{
        stageW: metrics.stageW,
        stageH: metrics.stageH,
        scale: metrics.scale,
        rotated: metrics.rotated,
        isCompactDevice: metrics.isCompactDevice,
        toLocalRect,
      }}
    >
      <div className="fixed inset-0 overflow-hidden bg-[#111827] touch-manipulation">
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
      </div>
    </LandscapeStageContext.Provider>
  );
}
