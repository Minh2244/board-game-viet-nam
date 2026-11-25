import { describe, expect, it, vi } from 'vitest';
import {
  buildAblyChannelName,
  handleRealtimeTokenGet,
  signAblyTokenRequest,
} from '../../../api/_realtimeAuth';
import { __setUpstashRedisForTest, handleRoomGet, handleRoomPost } from '../../../api/_roomStore';
import {
  AblyFastLane,
  isAblyQuotaOrFatalError,
  type AblyConnectionStateChangeLike,
  type AblyRealtimeLike,
} from '@/shared/network/ablyFastLane';
import {
  createAdaptiveCheckpointScheduler,
  getAdaptiveBackupPollIntervalMs,
  hasAllConnectedPeersRtcOpen,
  postWithRetry,
} from '@/shared/network/onlineReliability';
import type { Redis } from '@upstash/redis';

/** Giả lập Upstash Redis hỗ trợ thực thi chính xác 3 Lua script nguyên tử trong api/_roomStore.ts */
function createMockUpstashRedis() {
  const store = new Map<string, Record<string, string>>();
  const ttls = new Map<string, number>();

  const mock = {
    async hsetnx(key: string, field: string, value: string): Promise<number> {
      const h = store.get(key);
      if (h && field in h) return 0;
      const next = h ?? {};
      next[field] = String(value);
      store.set(key, next);
      return 1;
    },
    async hget(key: string, field: string): Promise<string | null> {
      const h = store.get(key);
      return h && field in h ? h[field] : null;
    },
    async hmget(key: string, ...fields: string[]): Promise<Record<string, string | null> | null> {
      const h = store.get(key);
      if (!h) return null;
      const out: Record<string, string | null> = {};
      for (const f of fields) out[f] = f in h ? h[f] : null;
      return out;
    },
    async hgetall(key: string): Promise<Record<string, string> | null> {
      const h = store.get(key);
      return h ? { ...h } : null;
    },
    pipeline() {
      const ops: Array<() => void> = [];
      return {
        hset(key: string, fields: Record<string, string>) {
          ops.push(() => {
            const h = store.get(key) ?? {};
            for (const [k, v] of Object.entries(fields)) h[k] = String(v);
            store.set(key, h);
          });
        },
        hdel(key: string, field: string) {
          ops.push(() => {
            const h = store.get(key);
            if (h) delete h[field];
          });
        },
        expire(key: string, sec: number) {
          ops.push(() => {
            ttls.set(key, sec);
          });
        },
        async exec() {
          for (const op of ops) op();
          return [];
        },
      };
    },
    async eval(script: string, keys: string[], args: string[]): Promise<number> {
      const key = keys[0];
      const h = store.get(key);
      if (!h) return -1;

      if (script.includes("ARGV[6] .. tostring(nextSeq)")) {
        // PUSH_EVENT_ONLY_LUA
        const phase = h.phase;
        if (phase === 'DISSOLVED') return -2;
        const nextSeq = (Number(h.seq) || 0) + 1;
        h.seq = String(nextSeq);
        const evJson = `{"seq":${nextSeq},"sentAt":${args[1]},"senderToken":${args[3]},"packet":${args[2]}}`;
        h[`${args[5]}${nextSeq}`] = evJson;
        h[args[0]] = args[1];
        const maxEv = Number(args[4]);
        if (nextSeq > maxEv) delete h[`${args[5]}${nextSeq - maxEv}`];
        ttls.set(key, phase === 'PLAYING' ? Number(args[7]) : Number(args[6]));
        return nextSeq;
      }

      if (script.includes("if ARGV[8] ~= '' then")) {
        // COMMIT_UPDATE_LUA
        if (h.phase === 'DISSOLVED' && args[1] !== '1') return -2;
        const nextSeq = (Number(h.seq) || 0) + 1;
        h.seq = String(nextSeq);
        h.phase = args[0];
        h.data = args[2];
        h[args[3]] = args[4];
        h[args[5]] = args[6];
        if (args[7] !== '') {
          const evJson = `{"seq":${nextSeq},"sentAt":${args[6]},"senderToken":${args[8]},"packet":${args[7]}}`;
          h[`${args[10]}${nextSeq}`] = evJson;
          const maxEv = Number(args[9]);
          if (nextSeq > maxEv) delete h[`${args[10]}${nextSeq - maxEv}`];
        }
        ttls.set(key, Number(args[11]));
        return nextSeq;
      }

      // SAVE_CHECKPOINT_LUA
      if (h.phase === 'DISSOLVED') return -2;
      h.phase = args[0];
      h.data = args[1];
      h[args[2]] = args[3];
      h[args[4]] = args[5];
      ttls.set(key, Number(args[6]));
      return Number(h.seq) || 1;
    },
  };

  return { mock: mock as unknown as Redis, store, ttls };
}

describe('Ably WebSocket Priority + Automatic Failover + Upstash Lua Atomic + Online Reliability', () => {
  it('1. /api/realtime-token: trả enabled=false khi thiếu key; ký chuẩn HMAC-SHA256 đúng đặc tả Ably khi có key', async () => {
    const disabled = await handleRealtimeTokenGet(
      new URL('http://localhost/api/realtime-token?game=co-ty-phu&code=123456&clientId=tok_1'),
      '',
    );
    expect(disabled.status).toBe(200);
    expect(disabled.body.enabled).toBe(false);

    const invalidCode = await handleRealtimeTokenGet(
      new URL('http://localhost/api/realtime-token?game=co-ty-phu&code=abc&clientId=tok_1'),
      'app123.key456:secretVal999',
    );
    expect(invalidCode.status).toBe(400);

    const validRes = await handleRealtimeTokenGet(
      new URL('http://localhost/api/realtime-token?game=co-ty-phu&code=123456&clientId=tok_1'),
      'app123.key456:secretVal999',
    );
    expect(validRes.status).toBe(200);
    expect(validRes.body.enabled).toBe(true);
    expect(validRes.body.channelName).toBe(buildAblyChannelName('co-ty-phu', '123456'));

    // Xác minh chữ ký HMAC-SHA256 độc lập theo đúng thứ tự 6 dòng của Ably
    const signed = await signAblyTokenRequest({
      apiKey: 'app123.key456:secretVal999',
      channelName: 'bgvn:co-ty-phu:123456',
      clientId: 'tok_1',
      ttlMs: 3600000,
      timestampMs: 1700000000000,
      nonce: '0123456789abcdef0123456789abcdef',
    });
    expect(signed.keyName).toBe('app123.key456');
    expect(signed.capability).toBe('{"bgvn:co-ty-phu:123456":["publish","subscribe"]}');
    expect(signed.mac.length).toBeGreaterThan(20);
  });

  it('2. AblyFastLane: ưu tiên chạy WebSocket khi khỏe & tự động failover ngay khi hết hạn mức / báo lỗi quota', async () => {
    const availabilityHistory: boolean[] = [];
    const receivedPackets: Record<string, unknown>[] = [];
    const publishedPackets: unknown[] = [];
    const hooks: {
      onState?: (ch: AblyConnectionStateChangeLike) => void;
      onMsg?: (msg: { data?: unknown }) => void;
    } = {};
    let closedCount = 0;

    const fakeAblyClient: AblyRealtimeLike = {
      connection: {
        state: 'initialized',
        on(fn) {
          hooks.onState = fn;
        },
      },
      channels: {
        get() {
          return {
            subscribe(_name, fn) {
              hooks.onMsg = fn;
            },
            publish(_name, data) {
              publishedPackets.push(data);
            },
          };
        },
      },
      close() {
        closedCount += 1;
      },
    };

    const lane = new AblyFastLane({
      game: 'co-ty-phu',
      roomCode: '654321',
      clientId: 'player_A',
      onPacket: (p) => receivedPackets.push(p),
      onAvailabilityChange: (avail) => availabilityHistory.push(avail),
      tokenFetchFn: async () => ({
        ok: true,
        enabled: true,
        channelName: 'bgvn:co-ty-phu:654321',
        tokenRequest: { keyName: 'app.key', mac: 'abc' },
      }),
      ablyClientFactory: () => fakeAblyClient,
    });

    await lane.start();
    // Ably kết nối thành công -> bật làn ưu tiên
    hooks.onState?.({ current: 'connected' });
    expect(lane.isAvailable()).toBe(true);
    expect(availabilityHistory).toEqual([true]);

    // Bắn & nhận gói tin siêu tốc qua Ably
    expect(lane.publish({ msgId: 'm1', type: 'ACTION_COMMIT' })).toBe(true);
    expect(publishedPackets).toHaveLength(1);
    hooks.onMsg?.({ data: { msgId: 'm2', type: 'ACTION_COMMIT' } });
    expect(receivedPackets).toHaveLength(1);

    // Giả lập Ably vượt hạn mức tháng (code 40140 / Monthly limit exceeded) -> tự động failover ngay!
    expect(isAblyQuotaOrFatalError({ code: 40140, message: 'Monthly message limit exceeded' })).toBe(true);
    hooks.onState?.({
      current: 'suspended',
      reason: { code: 40140, message: 'Monthly message limit exceeded' },
    });

    expect(lane.isAvailable()).toBe(false);
    expect(lane.isPermanentlyDegraded()).toBe(true);
    expect(closedCount).toBeGreaterThanOrEqual(1);
    expect(availabilityHistory).toEqual([true, false]);
    expect(lane.publish({ msgId: 'm3' })).toBe(false);
    lane.destroy();
  });

  it('3. Upstash Redis Lua Script nguyên tử: không mất event, không tạo key khống, không hồi sinh phòng DISSOLVED, thoát Long-Poll tức thì', async () => {
    const { mock, store, ttls } = createMockUpstashRedis();
    __setUpstashRedisForTest(mock);
    try {
      const code = '818181';
      const created = await handleRoomPost({
        action: 'create',
        game: 'co-ty-phu',
        roomCode: code,
        senderToken: 'u_host',
        snapshot: {
          roomCode: code,
          phase: 'LOBBY',
          hostToken: 'u_host',
          humans: [{ playerToken: 'u_host', name: 'Chủ', isHost: true, connected: true }],
          bots: [],
          matchVersion: 0,
        },
      });
      expect(created.status).toBe(200);

      // Push sự kiện vào phòng không tồn tại -> 404 và TUYỆT ĐỐI không tạo key khống trong Redis!
      const ghostPush = await handleRoomPost({
        action: 'push',
        game: 'co-ty-phu',
        roomCode: '999888',
        senderToken: 'u_host',
        packet: { msgId: 'ghost', type: 'ACTION_COMMIT' },
      });
      expect(ghostPush.status).toBe(404);
      expect(store.has('bgvn:room:co-ty-phu:999888')).toBe(false);

      // Push ở LOBBY -> TTL giữ đúng LOBBY (900s), đồng thời cả `seq` lẫn `ev:<seq>` tồn tại nguyên tử
      const lobbyPush = await handleRoomPost({
        action: 'push',
        game: 'co-ty-phu',
        roomCode: code,
        senderToken: 'u_host',
        packet: { msgId: 'ev_1', type: 'DICE_CHARGE' },
      });
      expect(lobbyPush.status).toBe(200);
      expect(ttls.get(`bgvn:room:co-ty-phu:${code}`)).toBe(900);
      const hashAfterPush = store.get(`bgvn:room:co-ty-phu:${code}`)!;
      expect(hashAfterPush[`ev:${lobbyPush.body.seq}`]).toBeDefined();

      // Rejoin không kèm packet -> KHÔNG tăng `seq` rỗng!
      const seqBeforeRejoin = Number(lobbyPush.body.seq);
      const rejoinRes = await handleRoomPost({
        action: 'rejoin',
        game: 'co-ty-phu',
        roomCode: code,
        senderToken: 'u_host',
      });
      expect(rejoinRes.status).toBe(200);
      expect(rejoinRes.body.seq).toBe(seqBeforeRejoin);

      // Giải tán phòng -> push/checkpoint sau đó bị chặn 410 ROOM_DISSOLVED, KHÔNG hồi sinh phòng!
      const dis = await handleRoomPost({
        action: 'dissolve',
        game: 'co-ty-phu',
        roomCode: code,
        senderToken: 'u_host',
        packet: { msgId: 'dis_1', type: 'DISSOLVE_ROOM', reason: 'Đóng test' },
      });
      expect(dis.status).toBe(200);

      const postAfterDis = await handleRoomPost({
        action: 'push',
        game: 'co-ty-phu',
        roomCode: code,
        senderToken: 'u_host',
        packet: { msgId: 'late_pkt', type: 'ACTION_COMMIT' },
      });
      expect(postAfterDis.status).toBe(410);
      expect(store.get(`bgvn:room:co-ty-phu:${code}`)?.phase).toBe('DISSOLVED');

      // Long-Polling với sinceSeq === currentSeq trên phòng đã DISSOLVED phải thoát NGAY LẬP TỨC (< 150ms)!
      const t0 = Date.now();
      const pollDis = await handleRoomGet(
        new URL(`http://localhost/api/room?game=co-ty-phu&code=${code}&sinceSeq=${dis.body.seq}&waitMs=2500`),
      );
      expect(Date.now() - t0).toBeLessThan(200);
      expect(pollDis.status).toBe(200);
      expect(pollDis.body.phase).toBe('DISSOLVED');
    } finally {
      __setUpstashRedisForTest(undefined);
    }
  });

  it('4. Tiện ích Online Reliability: Retry 4G, Checkpoint chống bỏ đói sau 6 nước, WebRTC đủ mọi người phòng 3+ & nhịp poll 10s khi có Ably', async () => {
    // 4a. Retry tự phục hồi sau 2 lỗi mạng thoáng qua
    let attempts = 0;
    const retryRes = await postWithRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('4G dropped');
        return { status: 200, data: { ok: true, seq: 9 } };
      },
      () => false,
      [5, 5, 5],
    );
    expect(attempts).toBe(3);
    expect(retryRes?.status).toBe(200);

    // 4b. Checkpoint chống bỏ đói: bấm 6 nước liên tiếp dưới 1200ms phải tự flush ngay nước thứ 6!
    const flushSpy = vi.fn();
    const scheduler = createAdaptiveCheckpointScheduler({
      isDestroyed: () => false,
      onFlush: flushSpy,
      maxPendingMoves: 6,
      maxWaitMs: 4000,
    });
    for (let i = 0; i < 6; i += 1) {
      scheduler.schedule(1200);
    }
    expect(flushSpy).toHaveBeenCalledTimes(1);
    scheduler.cancel();

    // 4c. Phòng 3 người (có 2 đối thủ remote B, C): chỉ khi CẢ B lẫn C mở DataChannel mới trả true!
    const peers = new Map<string, { dc: { readyState: string } | null }>([
      ['B', { dc: { readyState: 'open' } }],
      ['C', { dc: { readyState: 'connecting' } }],
    ]);
    expect(hasAllConnectedPeersRtcOpen(['B', 'C'], peers, false)).toBe(false);
    peers.set('C', { dc: { readyState: 'open' } });
    expect(hasAllConnectedPeersRtcOpen(['B', 'C'], peers, false)).toBe(true);

    // 4d. Nhịp poll dự phòng thích ứng: Ably thông -> 10.000ms; Ably rớt không có P2P -> 25ms Long-Poll!
    expect(
      getAdaptiveBackupPollIntervalMs({
        joinResolved: true,
        hidden: false,
        ablyConnected: true,
        allRtcOpen: false,
      }),
    ).toBe(10000);
    expect(
      getAdaptiveBackupPollIntervalMs({
        joinResolved: true,
        hidden: false,
        ablyConnected: false,
        allRtcOpen: false,
      }),
    ).toBe(25);
    expect(
      getAdaptiveBackupPollIntervalMs({
        joinResolved: false,
        hidden: false,
        ablyConnected: false,
        allRtcOpen: false,
      }),
    ).toBe(260);
  });
});
