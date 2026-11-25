import { isFastLaneDisabled } from './onlineTransportConfig';

export interface AblyRealtimeReasonLike {
  code?: number;
  statusCode?: number;
  message?: string;
}

export interface AblyConnectionStateChangeLike {
  current: string;
  previous?: string;
  reason?: AblyRealtimeReasonLike | null;
}

export interface AblyChannelLike {
  subscribe: (name: string, listener: (msg: { data?: unknown }) => void) => void;
  unsubscribe?: () => void;
  publish: (name: string, data: unknown) => Promise<void> | void;
  detach?: () => Promise<void> | void;
}

export interface AblyRealtimeLike {
  connection: {
    state: string;
    on: (listener: (change: AblyConnectionStateChangeLike) => void) => void;
    off?: (listener: (change: AblyConnectionStateChangeLike) => void) => void;
  };
  channels: {
    get: (name: string) => AblyChannelLike;
  };
  close: () => void;
}

export type AblyTokenFetchFn = (url: string) => Promise<{
  ok: boolean;
  enabled?: boolean;
  channelName?: string;
  tokenRequest?: Record<string, unknown>;
  reason?: string;
}>;

export interface AblyFastLaneOptions {
  game: string;
  roomCode: string;
  clientId: string;
  onPacket: (packet: Record<string, unknown>) => void;
  onAvailabilityChange: (available: boolean) => void;
  connectTimeoutMs?: number;
  /** Cho phép unit test tiêm fetch / Ably client giả lập để kiểm chứng failover tự động */
  tokenFetchFn?: AblyTokenFetchFn;
  ablyClientFactory?: (
    authCallback: (
      tokenParams: unknown,
      callback: (err: unknown, tokenRequestOrDetails: unknown) => void,
    ) => void,
  ) => AblyRealtimeLike;
}

/** Nhận diện các lỗi vượt hạn mức miễn phí / khóa quyền / quá tải của Ably để chuyển hẳn về dự phòng Upstash */
export function isAblyQuotaOrFatalError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; statusCode?: unknown; message?: unknown };
  const code = Number(e.code) || 0;
  const status = Number(e.statusCode) || 0;
  const msg = typeof e.message === 'string' ? e.message : '';

  if (status === 401 || status === 403 || status === 429) return true;
  if (
    (code >= 40100 && code < 40400) ||
    (code >= 42900 && code < 43000) ||
    code === 40005 ||
    code === 50003
  ) {
    return true;
  }
  return /limit|quota|exceeded|rate\s*limit|account.*suspended|disabled|unauthorized|forbidden/i.test(
    msg,
  );
}

const defaultTokenFetch: AblyTokenFetchFn = async (url) => {
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) return { ok: false, enabled: false };
  return (await res.json()) as {
    ok: boolean;
    enabled?: boolean;
    channelName?: string;
    tokenRequest?: Record<string, unknown>;
    reason?: string;
  };
};

/**
 * Làn truyền tải WebSocket Ably ưu tiên #1 (~35–60ms xuyên mọi mạng 4G/Wi-Fi):
 * - Tải động (`import('ably')`) chỉ khi vào phòng Online & server có bật `ABLY_API_KEY`.
 * - Tự động Failover ngay lập tức về P2P WebRTC + Upstash Redis Long-Polling khi:
 *   (1) server chưa cài `ABLY_API_KEY`, (2) Ably hết hạn mức Free / quá tải, (3) rớt WebSocket > 4.5s.
 * - Không bao giờ làm văng phòng hay mất nước đi đang chơi.
 */
export class AblyFastLane {
  private readonly opts: AblyFastLaneOptions;
  private client: AblyRealtimeLike | null = null;
  private channel: AblyChannelLike | null = null;
  private available = false;
  private permanentlyDegraded = false;
  private destroyed = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: AblyFastLaneOptions) {
    this.opts = opts;
  }

  public isAvailable(): boolean {
    return this.available && !this.permanentlyDegraded && !this.destroyed;
  }

  public isPermanentlyDegraded(): boolean {
    return this.permanentlyDegraded;
  }

  public async start(): Promise<void> {
    if (this.destroyed || this.permanentlyDegraded) return;
    if (!this.opts.ablyClientFactory && isFastLaneDisabled()) {
      this.setAvailable(false);
      return;
    }

    const tokenUrl = this.buildTokenUrl();
    const fetcher = this.opts.tokenFetchFn ?? defaultTokenFetch;

    let firstTokenPayload: Awaited<ReturnType<AblyTokenFetchFn>>;
    try {
      firstTokenPayload = await fetcher(tokenUrl);
    } catch {
      this.setAvailable(false);
      return;
    }

    if (
      this.destroyed ||
      !firstTokenPayload?.ok ||
      !firstTokenPayload.enabled ||
      !firstTokenPayload.tokenRequest ||
      !firstTokenPayload.channelName
    ) {
      this.setAvailable(false);
      return;
    }

    let cachedFirstToken: Record<string, unknown> | null = firstTokenPayload.tokenRequest;
    const channelName = firstTokenPayload.channelName;

    const authCallback = (
      _tokenParams: unknown,
      callback: (err: unknown, tokenRequestOrDetails: unknown) => void,
    ) => {
      if (this.destroyed || this.permanentlyDegraded) {
        callback(new Error('ABLY_LANE_CLOSED'), null);
        return;
      }
      if (cachedFirstToken) {
        const req = cachedFirstToken;
        cachedFirstToken = null;
        callback(null, req);
        return;
      }
      void fetcher(tokenUrl)
        .then((res) => {
          if (res?.ok && res.enabled && res.tokenRequest) {
            callback(null, res.tokenRequest);
          } else {
            this.degradePermanently();
            callback(new Error(res?.reason || 'ABLY_DISABLED'), null);
          }
        })
        .catch((err) => {
          callback(err, null);
        });
    };

    try {
      let client: AblyRealtimeLike;
      if (this.opts.ablyClientFactory) {
        client = this.opts.ablyClientFactory(authCallback);
      } else {
        const ablyMod = await import('ably');
        if (this.destroyed) return;
        const AblyCtor = ablyMod.default ?? ablyMod;
        client = new AblyCtor.Realtime({
          authCallback: authCallback as never,
          echoMessages: false,
          disconnectedRetryTimeout: 3000,
          suspendedRetryTimeout: 10000,
        }) as unknown as AblyRealtimeLike;
      }

      if (this.destroyed) {
        client.close();
        return;
      }

      this.client = client;
      const timeoutMs = this.opts.connectTimeoutMs ?? 4500;
      this.connectTimer = setTimeout(() => {
        this.connectTimer = null;
        if (!this.available && !this.destroyed) {
          this.setAvailable(false);
        }
      }, timeoutMs);

      client.connection.on((stateChange) => {
        if (this.destroyed) return;
        const state = stateChange.current;
        if (state === 'connected') {
          if (this.connectTimer !== null) {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
          }
          this.setAvailable(true);
          return;
        }

        if (state === 'disconnected' || state === 'suspended' || state === 'failed' || state === 'closed') {
          if (isAblyQuotaOrFatalError(stateChange.reason) || state === 'failed') {
            this.degradePermanently();
          } else {
            // Mất kết nối thoáng qua -> bật ngay Long-Polling dự phòng trong lúc Ably tự nối lại!
            this.setAvailable(false);
          }
        }
      });

      const channel = client.channels.get(channelName);
      this.channel = channel;
      channel.subscribe('pkt', (msg) => {
        if (this.destroyed) return;
        let parsed: unknown = msg?.data;
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            return;
          }
        }
        if (parsed && typeof parsed === 'object') {
          this.opts.onPacket(parsed as Record<string, unknown>);
        }
      });

      if (client.connection.state === 'connected') {
        if (this.connectTimer !== null) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        this.setAvailable(true);
      }
    } catch {
      this.degradePermanently();
    }
  }

  public publish(packet: Record<string, unknown>): boolean {
    if (!this.isAvailable() || !this.channel) return false;
    try {
      const maybePromise = this.channel.publish('pkt', packet);
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        void (maybePromise as Promise<void>).catch((err) => {
          if (this.destroyed) return;
          if (isAblyQuotaOrFatalError(err)) {
            this.degradePermanently();
          } else {
            this.setAvailable(false);
          }
        });
      }
      return true;
    } catch (err) {
      if (isAblyQuotaOrFatalError(err)) {
        this.degradePermanently();
      } else {
        this.setAvailable(false);
      }
      return false;
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.available = false;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.closeClientQuietly();
  }

  private buildTokenUrl(): string {
    const qs = new URLSearchParams({
      game: this.opts.game,
      code: this.opts.roomCode,
      clientId: this.opts.clientId,
    });
    return `/api/realtime-token?${qs.toString()}`;
  }

  private setAvailable(next: boolean): void {
    if (this.available === next) return;
    this.available = next;
    try {
      this.opts.onAvailabilityChange(next);
    } catch {
      // Ignore callback error
    }
  }

  private degradePermanently(): void {
    this.permanentlyDegraded = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.setAvailable(false);
    this.closeClientQuietly();
  }

  private closeClientQuietly(): void {
    if (this.channel) {
      try {
        this.channel.unsubscribe?.();
      } catch {
        // Ignore
      }
      this.channel = null;
    }
    if (this.client) {
      try {
        this.client.close();
      } catch {
        // Ignore
      }
      this.client = null;
    }
  }
}
