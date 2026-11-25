/**
 * Các tiện ích chuẩn hóa độ tin cậy mạng Online dùng chung cho cả 5 trò chơi:
 * 1. Hàng đợi retry thông minh khi rớt mạng 4G thoáng qua (không làm mất `ACTION_COMMIT` / `MOVE_COMMIT`).
 * 2. Bộ lập lịch Checkpoint chống bỏ đói (ép lưu sau tối đa 6 nước đi hoặc 4.000ms, không bị đẩy lùi quá 24 sự kiện Redis).
 * 3. Kiểm tra WebRTC P2P mở đủ TẤT CẢ thành viên đang online (tránh làm lag người thứ 3–6).
 * 4. Tính nhịp HTTP dự phòng thích ứng (10s khi Ably WebSocket đang thông -> giảm ~90-95% lệnh Upstash; 25ms Long-Poll khi failover).
 */

export const ACTION_RETRY_DELAYS_MS = [250, 600, 1200, 2000] as const;

export async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, Math.max(1000, timeoutMs));
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function postWithRetry<TResponse extends { status: number; data: unknown }>(
  postFn: () => Promise<TResponse>,
  isDestroyed: () => boolean,
  delaysMs: readonly number[] = ACTION_RETRY_DELAYS_MS,
): Promise<TResponse | null> {
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    if (isDestroyed()) return null;
    try {
      const res = await postFn();
      // Thành công hoặc lỗi nghiệp vụ kết thúc phòng (400/403/404/409/410) -> không retry vô ích
      if (res.status < 500 && res.status !== 408 && res.status !== 429) {
        return res;
      }
    } catch {
      // Lỗi mạng thoáng qua (4G mất sóng 1-2s) -> sẽ thử lại ở vòng lặp kế tiếp
    }
    if (attempt < delaysMs.length && !isDestroyed()) {
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
  return null;
}

export interface AdaptiveCheckpointScheduler {
  schedule: (delayMs?: number) => void;
  cancel: () => void;
}

export function createAdaptiveCheckpointScheduler(opts: {
  isDestroyed: () => boolean;
  onFlush: () => void;
  maxPendingMoves?: number;
  maxWaitMs?: number;
}): AdaptiveCheckpointScheduler {
  const maxPending = opts.maxPendingMoves ?? 6;
  const maxWaitMs = opts.maxWaitMs ?? 4000;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingCount = 0;
  let firstPendingAt: number | null = null;

  const flushNow = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingCount = 0;
    firstPendingAt = null;
    if (opts.isDestroyed()) return;
    opts.onFlush();
  };

  return {
    schedule(delayMs = 1200) {
      if (opts.isDestroyed()) return;
      const now = Date.now();
      if (firstPendingAt === null) firstPendingAt = now;
      pendingCount += 1;

      const elapsed = now - firstPendingAt;
      if (pendingCount >= maxPending || elapsed >= maxWaitMs) {
        flushNow();
        return;
      }

      if (timer !== null) clearTimeout(timer);
      const boundedDelay = Math.max(0, Math.min(delayMs, maxWaitMs - elapsed));
      timer = setTimeout(flushNow, boundedDelay);
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pendingCount = 0;
      firstPendingAt = null;
    },
  };
}

export function hasAllConnectedPeersRtcOpen(
  connectedRemoteTokens: readonly string[],
  rtcPeers: ReadonlyMap<string, { dc: { readyState: string } | null }>,
  fastLaneDisabled: boolean,
): boolean {
  if (fastLaneDisabled) return false;
  if (connectedRemoteTokens.length === 0) return false;
  for (const token of connectedRemoteTokens) {
    const peer = rtcPeers.get(token);
    if (!peer || !peer.dc || peer.dc.readyState !== 'open') {
      return false;
    }
  }
  return true;
}

export function getAdaptiveBackupPollIntervalMs(opts: {
  joinResolved: boolean;
  hidden: boolean;
  ablyConnected: boolean;
  allRtcOpen: boolean;
}): number {
  if (!opts.joinResolved) return 260;
  if (opts.hidden) return 4000;
  if (opts.ablyConnected) return 10000; // Ably WebSocket đang nhận tức thì (~40ms) -> giãn HTTP dự phòng 10s tiết kiệm ~95% Upstash!
  if (opts.allRtcOpen) return 2400; // Đủ P2P mọi thành viên trong phòng -> giãn HTTP dự phòng 2.4s
  return 25; // Chế độ dự phòng Long-Polling Edge -> nối lại ngay lập tức!
}

export type OrderedActionIngestResult<TPacket> =
  | { status: 'stale' }
  | { status: 'buffered_gap'; missingVersion: number }
  | { status: 'ready'; orderedPackets: TPacket[] };

export interface OrderedActionBuffer<TPacket> {
  ingest: (
    packetVersion: number,
    currentVersion: number,
    packet: TPacket,
  ) => OrderedActionIngestResult<TPacket>;
  dropThrough: (version: number) => void;
  hasPending: () => boolean;
  getMinPendingVersion: () => number | null;
  clear: () => void;
}

/**
 * Bộ đệm chống lệch thứ tự gói ACTION_COMMIT / MOVE_COMMIT trên mạng 4G/Ably:
 * - Gói cũ (`<= currentVersion`): bỏ qua (`stale`).
 * - Gói đến sớm hơn gói trước (`> currentVersion + 1`): tạm giữ trong hàng đợi (KHÔNG áp dụng lệch state và KHÔNG nâng matchVersion!)
 *   để chờ gói `currentVersion + 1` về rồi xả tuần tự đúng phiên bản `v+1 -> v+2 -> v+3`.
 */
export function createOrderedActionBuffer<TPacket>(maxBuffered = 64): OrderedActionBuffer<TPacket> {
  const pending = new Map<number, TPacket>();

  return {
    ingest(packetVersion, currentVersion, packet) {
      if (packetVersion <= currentVersion) {
        return { status: 'stale' };
      }
      if (packetVersion > currentVersion + 1) {
        if (pending.size >= maxBuffered) {
          const oldestKey = Math.min(...pending.keys());
          if (packetVersion > oldestKey) {
            pending.delete(oldestKey);
          }
        }
        pending.set(packetVersion, packet);
        return { status: 'buffered_gap', missingVersion: currentVersion + 1 };
      }

      const orderedPackets: TPacket[] = [packet];
      let nextExpected = packetVersion + 1;
      while (pending.has(nextExpected)) {
        const buffered = pending.get(nextExpected)!;
        pending.delete(nextExpected);
        orderedPackets.push(buffered);
        nextExpected += 1;
      }
      return { status: 'ready', orderedPackets };
    },
    dropThrough(version) {
      for (const k of pending.keys()) {
        if (k <= version) {
          pending.delete(k);
        }
      }
    },
    hasPending() {
      return pending.size > 0;
    },
    getMinPendingVersion() {
      if (pending.size === 0) return null;
      return Math.min(...pending.keys());
    },
    clear() {
      pending.clear();
    },
  };
}
