/**
 * Quản lý vòng đời nút Web Audio API dùng chung cho cả 5 trò chơi & hệ thống nhạc nền:
 * 1. Tự động gọi `.disconnect()` cho toàn bộ Oscillator/BufferSource/Gain/Filter khi phát xong (`onended`),
 *    chặn triệt để rò rỉ hàng nghìn AudioNode sau 50+ lượt chơi Online.
 * 2. Tự động đưa SFX `AudioContext` về trạng thái `suspended` sau 8 giây không có hiệu ứng
 *    (hoặc ngay lập tức khi ẩn tab) để giải phóng luồng audio hệ thống trên Laptop & điện thoại.
 */

export function attachAutoDisconnect(
  source: AudioScheduledSourceNode,
  nodes: readonly (AudioNode | null | undefined)[] = [],
): void {
  const previousHandler = source.onended;
  source.onended = (ev) => {
    source.onended = null;
    if (typeof previousHandler === 'function') {
      try {
        previousHandler.call(source, ev);
      } catch {
        // Ignore user callback errors during cleanup
      }
    }
    try {
      source.disconnect();
    } catch {
      // Already disconnected
    }
    for (const node of nodes) {
      if (!node || node === source) continue;
      try {
        node.disconnect();
      } catch {
        // Already disconnected
      }
    }
  };
}

export function attachMultiSourceAutoDisconnect(
  sources: readonly AudioScheduledSourceNode[],
  sharedNodes: readonly (AudioNode | null | undefined)[] = [],
): void {
  if (sources.length === 0) return;
  if (sources.length === 1) {
    attachAutoDisconnect(sources[0], sharedNodes);
    return;
  }

  let remaining = sources.length;
  for (const src of sources) {
    const previousHandler = src.onended;
    src.onended = (ev) => {
      src.onended = null;
      if (typeof previousHandler === 'function') {
        try {
          previousHandler.call(src, ev);
        } catch {
          // Ignore
        }
      }
      try {
        src.disconnect();
      } catch {
        // Ignore
      }
      remaining -= 1;
      if (remaining <= 0) {
        for (const node of sharedNodes) {
          if (!node) continue;
          try {
            node.disconnect();
          } catch {
            // Ignore
          }
        }
      }
    };
  }
}

export interface IdleAudioContextManager {
  touch: () => void;
  suspendNow: () => void;
  dispose: () => void;
}

export function createIdleAudioContextManager(
  getCtx: () => AudioContext | null,
  idleMs = 8000,
): IdleAudioContextManager {
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let visibilityHooked = false;

  const clearTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const suspendNow = () => {
    clearTimer();
    const ctx = getCtx();
    if (ctx && ctx.state === 'running') {
      void ctx.suspend().catch(() => {});
    }
  };

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.hidden) {
      suspendNow();
    }
  };

  const hookVisibility = () => {
    if (visibilityHooked || typeof document === 'undefined') return;
    visibilityHooked = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
  };

  return {
    touch() {
      hookVisibility();
      const ctx = getCtx();
      if (!ctx) return;
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      clearTimer();
      idleTimer = setTimeout(() => {
        idleTimer = null;
        const current = getCtx();
        if (current && current.state === 'running') {
          void current.suspend().catch(() => {});
        }
      }, idleMs);
    },
    suspendNow,
    dispose() {
      clearTimer();
      if (visibilityHooked && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        visibilityHooked = false;
      }
    },
  };
}
