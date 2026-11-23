import { Redis } from '@upstash/redis';

export type RoomPhase = 'LOBBY' | 'PLAYING' | 'DISSOLVED';

export interface RoomEventRecord {
  seq: number;
  sentAt: number;
  senderToken: string;
  packet: Record<string, unknown>;
}

export interface StoredRoomDocument {
  game: string;
  roomCode: string;
  hostToken: string;
  phase: RoomPhase;
  seq: number;
  createdAt: number;
  updatedAt: number;
  snapshot: Record<string, unknown> | null;
  heartbeats: Record<string, number>;
  events: RoomEventRecord[];
}

const LOBBY_TTL_SEC = 15 * 60; // 15 phút không hoạt động ở sảnh chờ mới tự dọn
const PLAYING_TTL_SEC = 30 * 60; // 30 phút cả bàn bỏ ngang mới tự dọn (đang chơi heartbeat gia hạn liên tục)
const DISSOLVED_TTL_SEC = 60; // Giữ 60s để mọi máy nhận thông báo giải tán phòng
const MAX_EVENTS_KEPT = 60;
const HB_FIELD_PREFIX = 'hb:';
const EV_FIELD_PREFIX = 'ev:';

let cachedRedis: Redis | null | undefined;

function getUpstashRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

// Bộ nhớ tạm cho môi trường local dev/preview (khi chưa cấu hình biến môi trường Upstash)
interface MemoryEntry {
  doc: StoredRoomDocument;
  heartbeats: Record<string, number>;
  eventsBySeq: Map<number, RoomEventRecord>;
  expiresAt: number;
}
const memoryRooms = new Map<string, MemoryEntry>();

function cleanExpiredMemory(): void {
  const now = Date.now();
  for (const [key, entry] of memoryRooms.entries()) {
    if (entry.expiresAt <= now) {
      memoryRooms.delete(key);
    }
  }
}

function roomKey(game: string, code: string): string {
  const safeGame = game.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'default';
  return `bgvn:room:${safeGame}:${code}`;
}

function ttlForPhase(phase: RoomPhase): number {
  if (phase === 'DISSOLVED') return DISSOLVED_TTL_SEC;
  if (phase === 'PLAYING') return PLAYING_TTL_SEC;
  return LOBBY_TTL_SEC;
}

function randomSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}

function parseHeartbeatsFromHash(raw: Record<string, unknown> | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const [field, val] of Object.entries(raw)) {
    if (!field.startsWith(HB_FIELD_PREFIX)) continue;
    const token = field.slice(HB_FIELD_PREFIX.length);
    const ts = Number(val);
    if (token && Number.isFinite(ts) && ts > 0) {
      out[token] = ts;
    }
  }
  return out;
}

function parseEventValue(val: unknown): RoomEventRecord | null {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val) as RoomEventRecord;
      return typeof parsed?.seq === 'number' ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof val === 'object') {
    const parsed = val as RoomEventRecord;
    return typeof parsed?.seq === 'number' ? parsed : null;
  }
  return null;
}

function parseEventsFromHash(raw: Record<string, unknown> | null): RoomEventRecord[] {
  const list: RoomEventRecord[] = [];
  if (!raw) return list;
  for (const [field, val] of Object.entries(raw)) {
    if (!field.startsWith(EV_FIELD_PREFIX)) continue;
    const ev = parseEventValue(val);
    if (ev) list.push(ev);
  }
  list.sort((a, b) => a.seq - b.seq);
  return list;
}

function extractMatchVersion(snapshot: Record<string, unknown> | null): number {
  if (!snapshot) return 0;
  const v = Number(snapshot.matchVersion);
  return Number.isFinite(v) ? v : 0;
}

function isMemberToken(doc: StoredRoomDocument, token: string): boolean {
  if (token === doc.hostToken) return true;
  const humans = (doc.snapshot as { humans?: Array<{ playerToken?: string }> } | null)?.humans;
  return Array.isArray(humans) && humans.some((h) => h.playerToken === token);
}

async function readRoomSeq(key: string): Promise<number | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const val = await redis.hget<string | number>(key, 'seq');
    if (val === null || val === undefined) return null;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : null;
  }
  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  return entry ? entry.doc.seq : null;
}

/**
 * Đường tắt siêu tốc cho GET /api/room khi đang trong ván (không cần tải lại 35KB snapshot `data`):
 * Chỉ lấy đúng các field `ev:<sinceSeq+1>..ev:<currentSeq>` + `phase` trong 1 lệnh HMGET (~300 bytes, < 3ms)!
 */
async function readDeltaEventsFast(
  key: string,
  sinceSeq: number,
  currentSeq: number,
): Promise<{ phase: RoomPhase; events: RoomEventRecord[] } | null> {
  const count = currentSeq - sinceSeq;
  if (count <= 0 || count > 20) return null;

  const redis = getUpstashRedis();
  if (redis) {
    const fields: string[] = ['phase'];
    for (let s = sinceSeq + 1; s <= currentSeq; s += 1) {
      fields.push(`${EV_FIELD_PREFIX}${s}`);
    }
    const rawMap = await redis.hmget<Record<string, unknown>>(key, ...fields);
    if (!rawMap) return null;

    const rawPhase = rawMap.phase;
    const phase: RoomPhase =
      rawPhase === 'PLAYING' || rawPhase === 'DISSOLVED' ? rawPhase : 'LOBBY';
    const events: RoomEventRecord[] = [];
    for (let s = sinceSeq + 1; s <= currentSeq; s += 1) {
      const ev = parseEventValue(rawMap[`${EV_FIELD_PREFIX}${s}`]);
      if (ev) events.push(ev);
    }
    return { phase, events };
  }

  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  if (!entry) return null;
  const events: RoomEventRecord[] = [];
  for (let s = sinceSeq + 1; s <= currentSeq; s += 1) {
    const ev = entry.eventsBySeq.get(s);
    if (ev) events.push(ev);
  }
  return { phase: entry.doc.phase, events };
}

async function readRoomDoc(key: string): Promise<StoredRoomDocument | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const all = await redis.hgetall<Record<string, unknown>>(key);
    if (!all || !all.data) return null;
    let doc: StoredRoomDocument | null = null;
    if (typeof all.data === 'string') {
      try {
        doc = JSON.parse(all.data) as StoredRoomDocument;
      } catch {
        return null;
      }
    } else if (typeof all.data === 'object') {
      doc = all.data as StoredRoomDocument;
    }
    if (!doc) return null;

    const latestSeq = Number(all.seq);
    if (Number.isFinite(latestSeq) && latestSeq > doc.seq) {
      doc.seq = latestSeq;
    }
    if (all.phase === 'LOBBY' || all.phase === 'PLAYING' || all.phase === 'DISSOLVED') {
      doc.phase = all.phase;
    }

    const separateHbs = parseHeartbeatsFromHash(all);
    doc.heartbeats = { ...(doc.heartbeats || {}), ...separateHbs };

    const hashEvents = parseEventsFromHash(all);
    if (hashEvents.length > 0) {
      const bySeq = new Map<number, RoomEventRecord>();
      for (const e of doc.events || []) bySeq.set(e.seq, e);
      for (const e of hashEvents) bySeq.set(e.seq, e);
      doc.events = Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq).slice(-MAX_EVENTS_KEPT);
    }
    return doc;
  }

  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  if (!entry) return null;
  const cloned = structuredClone(entry.doc);
  cloned.heartbeats = { ...cloned.heartbeats, ...entry.heartbeats };
  cloned.events = Array.from(entry.eventsBySeq.values()).sort((a, b) => a.seq - b.seq);
  return cloned;
}

/**
 * Đường tắt siêu tốc cho gói tin sự kiện thuần (như `DICE_CHARGE`, `RTC_SIGNAL`, hoặc `push` không kèm `snapshot`):
 * Không cần tải 35KB `data` bằng `hgetall`! Chỉ chạy `HINCRBY` + `HSET ev:<seq>` trong ~3ms!
 */
async function pushEventOnlyFast(
  key: string,
  senderToken: string,
  now: number,
  packet: Record<string, unknown>,
): Promise<number | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const allocatedSeq = await redis.hincrby(key, 'seq', 1);
    if (allocatedSeq <= 1) {
      // Phòng không tồn tại (vừa tạo khống key) -> xóa ngay và báo null
      await redis.del(key);
      return null;
    }
    const eventRecord: RoomEventRecord = {
      seq: allocatedSeq,
      sentAt: now,
      senderToken,
      packet,
    };
    const pipe = redis.pipeline();
    pipe.hset(key, {
      [`${EV_FIELD_PREFIX}${allocatedSeq}`]: JSON.stringify(eventRecord),
      [`${HB_FIELD_PREFIX}${senderToken}`]: String(now),
    });
    if (allocatedSeq > MAX_EVENTS_KEPT) {
      pipe.hdel(key, `${EV_FIELD_PREFIX}${allocatedSeq - MAX_EVENTS_KEPT}`);
    }
    pipe.expire(key, PLAYING_TTL_SEC);
    await pipe.exec();
    return allocatedSeq;
  }

  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  if (!entry || entry.doc.phase === 'DISSOLVED') return null;
  const nextSeq = entry.doc.seq + 1;
  entry.doc.seq = nextSeq;
  entry.doc.updatedAt = now;
  entry.heartbeats[senderToken] = now;
  const ev: RoomEventRecord = {
    seq: nextSeq,
    sentAt: now,
    senderToken,
    packet,
  };
  entry.eventsBySeq.set(nextSeq, ev);
  if (nextSeq > MAX_EVENTS_KEPT) {
    entry.eventsBySeq.delete(nextSeq - MAX_EVENTS_KEPT);
  }
  entry.doc.events = Array.from(entry.eventsBySeq.values()).sort((a, b) => a.seq - b.seq);
  return nextSeq;
}

/**
 * Cấp số thứ tự `seq` nguyên tử bằng HINCRBY và lưu sự kiện vào field riêng `ev:<seq>`.
 */
async function commitRoomUpdateAtomic(
  key: string,
  doc: StoredRoomDocument,
  senderToken: string,
  now: number,
  newPacket?: Record<string, unknown> | null,
): Promise<number> {
  const ttl = ttlForPhase(doc.phase);
  const redis = getUpstashRedis();
  if (redis) {
    const allocatedSeq = await redis.hincrby(key, 'seq', 1);
    doc.seq = allocatedSeq;

    const eventRecord: RoomEventRecord | null = newPacket
      ? {
          seq: allocatedSeq,
          sentAt: now,
          senderToken,
          packet: newPacket,
        }
      : null;

    if (eventRecord) {
      doc.events = [...(doc.events || []), eventRecord].slice(-MAX_EVENTS_KEPT);
    }

    const fields: Record<string, string> = {
      phase: doc.phase,
      data: JSON.stringify(doc),
      [`${HB_FIELD_PREFIX}${senderToken}`]: String(now),
    };
    if (eventRecord) {
      fields[`${EV_FIELD_PREFIX}${allocatedSeq}`] = JSON.stringify(eventRecord);
    }

    const pipe = redis.pipeline();
    pipe.hset(key, fields);
    if (allocatedSeq > MAX_EVENTS_KEPT) {
      pipe.hdel(key, `${EV_FIELD_PREFIX}${allocatedSeq - MAX_EVENTS_KEPT}`);
    }
    pipe.expire(key, ttl);
    await pipe.exec();
    return allocatedSeq;
  }

  const existing = memoryRooms.get(key);
  const nextSeq = (existing?.doc.seq ?? doc.seq) + 1;
  doc.seq = nextSeq;
  const eventsBySeq = existing?.eventsBySeq ?? new Map<number, RoomEventRecord>();

  if (newPacket) {
    const ev: RoomEventRecord = {
      seq: nextSeq,
      sentAt: now,
      senderToken,
      packet: newPacket,
    };
    eventsBySeq.set(nextSeq, ev);
    if (nextSeq > MAX_EVENTS_KEPT) {
      eventsBySeq.delete(nextSeq - MAX_EVENTS_KEPT);
    }
  }

  doc.events = Array.from(eventsBySeq.values()).sort((a, b) => a.seq - b.seq);
  const heartbeats = { ...(existing?.heartbeats || {}), ...(doc.heartbeats || {}), [senderToken]: now };
  doc.heartbeats = heartbeats;

  memoryRooms.set(key, {
    doc: structuredClone(doc),
    heartbeats,
    eventsBySeq,
    expiresAt: Date.now() + ttl * 1000,
  });
  return nextSeq;
}

/**
 * Cập nhật nhịp tim (heartbeat) vào field Hash riêng `hb:<token>` + gia hạn TTL trượt.
 */
async function touchRoomHeartbeatOnly(
  key: string,
  senderToken: string,
  now: number,
): Promise<{ seq: number; phase: RoomPhase; heartbeats: Record<string, number> } | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const existingSeq = await redis.hget<string | number>(key, 'seq');
    if (existingSeq === null || existingSeq === undefined) return null;

    const existingPhaseRaw = await redis.hget<string>(key, 'phase');
    const phase: RoomPhase =
      existingPhaseRaw === 'PLAYING' || existingPhaseRaw === 'DISSOLVED' ? existingPhaseRaw : 'LOBBY';

    if (phase === 'DISSOLVED') {
      return { seq: Number(existingSeq) || 0, phase, heartbeats: {} };
    }

    const ttl = ttlForPhase(phase);
    const pipe = redis.pipeline();
    pipe.hset(key, { [`${HB_FIELD_PREFIX}${senderToken}`]: String(now) });
    pipe.expire(key, ttl);
    pipe.hgetall(key);
    const results = await pipe.exec();
    const allFields = (results?.[2] as Record<string, unknown> | null) ?? null;
    const seq = Number(allFields?.seq ?? existingSeq) || 0;
    const latestPhaseRaw = allFields?.phase;
    const latestPhase: RoomPhase =
      latestPhaseRaw === 'PLAYING' || latestPhaseRaw === 'DISSOLVED' ? latestPhaseRaw : phase;

    return {
      seq,
      phase: latestPhase,
      heartbeats: parseHeartbeatsFromHash(allFields),
    };
  }

  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  if (!entry) return null;
  if (entry.doc.phase === 'DISSOLVED') {
    return { seq: entry.doc.seq, phase: 'DISSOLVED', heartbeats: { ...entry.heartbeats } };
  }
  entry.heartbeats[senderToken] = now;
  entry.expiresAt = now + ttlForPhase(entry.doc.phase) * 1000;
  return {
    seq: entry.doc.seq,
    phase: entry.doc.phase,
    heartbeats: { ...entry.heartbeats },
  };
}

async function claimRoomKeyAtomic(key: string, initialDoc: StoredRoomDocument): Promise<boolean> {
  const ttl = ttlForPhase(initialDoc.phase);
  const redis = getUpstashRedis();
  if (redis) {
    const claimed = await redis.hsetnx(key, 'seq', String(initialDoc.seq));
    if (claimed !== 1) return false;
    const pipe = redis.pipeline();
    pipe.hset(key, {
      phase: initialDoc.phase,
      data: JSON.stringify(initialDoc),
      [`${HB_FIELD_PREFIX}${initialDoc.hostToken}`]: String(initialDoc.createdAt),
    });
    pipe.expire(key, ttl);
    await pipe.exec();
    return true;
  }
  cleanExpiredMemory();
  if (memoryRooms.has(key)) return false;
  memoryRooms.set(key, {
    doc: structuredClone(initialDoc),
    heartbeats: { [initialDoc.hostToken]: initialDoc.createdAt },
    eventsBySeq: new Map(),
    expiresAt: Date.now() + ttl * 1000,
  });
  return true;
}

export interface RoomApiResult {
  status: number;
  body: Record<string, unknown>;
}

/** Xử lý GET /api/room?game=...&code=...&sinceSeq=... (Adaptive polling + Fast HMGET delta) */
export async function handleRoomGet(url: URL): Promise<RoomApiResult> {
  const game = url.searchParams.get('game') || 'co-ty-phu';
  const code = url.searchParams.get('code') || '';
  const sinceSeq = Math.max(0, Number(url.searchParams.get('sinceSeq') || '0') || 0);
  const includeSnapshot = url.searchParams.get('full') === '1';

  if (!isValidCode(code)) {
    return { status: 400, body: { ok: false, error: 'INVALID_CODE', message: 'Mã phòng phải gồm đúng 6 chữ số.' } };
  }

  const key = roomKey(game, code);
  const currentSeq = await readRoomSeq(key);
  if (currentSeq === null) {
    return {
      status: 404,
      body: {
        ok: false,
        error: 'ROOM_NOT_FOUND',
        message: `Không tìm thấy phòng #${code}. Kiểm tra lại mã 6 số hoặc đảm bảo Chủ phòng đang mở phòng.`,
      },
    };
  }

  // Không có thay đổi mới -> trả gọn nhẹ sau đúng 1 lệnh HGET duy nhất (~2ms tại Singapore)!
  if (!includeSnapshot && currentSeq <= sinceSeq) {
    return {
      status: 200,
      body: {
        ok: true,
        unchanged: true,
        seq: currentSeq,
        events: [],
      },
    };
  }

  // Đường tắt siêu tốc khi máy khách chỉ cần lấy gói sự kiện mới (sinceSeq > 0 & !includeSnapshot) -> không tải 35KB snapshot!
  if (!includeSnapshot && sinceSeq > 0 && currentSeq - sinceSeq <= 15) {
    const fastDelta = await readDeltaEventsFast(key, sinceSeq, currentSeq);
    if (fastDelta && fastDelta.events.length > 0) {
      return {
        status: 200,
        body: {
          ok: true,
          unchanged: false,
          roomCode: code,
          phase: fastDelta.phase,
          seq: currentSeq,
          events: fastDelta.events,
          storageMode: getUpstashRedis() ? 'upstash' : 'memory',
        },
      };
    }
  }

  const doc = await readRoomDoc(key);
  if (!doc) {
    return {
      status: 404,
      body: {
        ok: false,
        error: 'ROOM_NOT_FOUND',
        message: `Phòng #${code} đã đóng hoặc hết thời gian chờ.`,
      },
    };
  }

  const newEvents = doc.events.filter((ev) => ev.seq > sinceSeq);
  return {
    status: 200,
    body: {
      ok: true,
      unchanged: false,
      roomCode: doc.roomCode,
      phase: doc.phase,
      hostToken: doc.hostToken,
      seq: doc.seq,
      snapshot: doc.snapshot,
      heartbeats: doc.heartbeats,
      events: newEvents,
      storageMode: getUpstashRedis() ? 'upstash' : 'memory',
    },
  };
}

/** Xử lý POST /api/room cho tất cả thao tác: create, join, rejoin, push, heartbeat, dissolve */
export async function handleRoomPost(payload: Record<string, unknown>): Promise<RoomApiResult> {
  const action = String(payload.action || '');
  const game = typeof payload.game === 'string' && payload.game ? payload.game : 'co-ty-phu';
  const senderToken = typeof payload.senderToken === 'string' ? payload.senderToken : '';

  if (!senderToken) {
    return { status: 400, body: { ok: false, error: 'MISSING_TOKEN', message: 'Thiếu mã định danh người chơi.' } };
  }

  const now = Date.now();

  if (action === 'create') {
    const preferredCode = isValidCode(payload.roomCode) ? payload.roomCode : null;
    const initialSnapshot =
      payload.snapshot && typeof payload.snapshot === 'object'
        ? (payload.snapshot as Record<string, unknown>)
        : null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = attempt === 0 && preferredCode ? preferredCode : randomSixDigitCode();
      const key = roomKey(game, candidate);
      const snapshotWithCode = initialSnapshot
        ? { ...initialSnapshot, roomCode: candidate, updatedAt: now }
        : null;

      const doc: StoredRoomDocument = {
        game,
        roomCode: candidate,
        hostToken: senderToken,
        phase: 'LOBBY',
        seq: 1,
        createdAt: now,
        updatedAt: now,
        snapshot: snapshotWithCode,
        heartbeats: { [senderToken]: now },
        events: [],
      };

      const claimed = await claimRoomKeyAtomic(key, doc);
      if (claimed) {
        return {
          status: 200,
          body: {
            ok: true,
            roomCode: candidate,
            seq: doc.seq,
            phase: doc.phase,
            snapshot: doc.snapshot,
            storageMode: getUpstashRedis() ? 'upstash' : 'memory',
          },
        };
      }
    }

    return {
      status: 503,
      body: { ok: false, error: 'ALLOC_FAILED', message: 'Hệ thống đang bận tạo mã phòng, vui lòng thử lại!' },
    };
  }

  const code = payload.roomCode;
  if (!isValidCode(code)) {
    return { status: 400, body: { ok: false, error: 'INVALID_CODE', message: 'Mã phòng phải gồm đúng 6 chữ số.' } };
  }

  const key = roomKey(game, code);

  // Đường tắt siêu tốc cho sự kiện thuần (như DICE_CHARGE, RTC_SIGNAL, hoặc gói tin không đính kèm snapshot):
  if (
    action === 'push' &&
    !payload.snapshot &&
    !payload.phase &&
    payload.packet &&
    typeof payload.packet === 'object'
  ) {
    const fastSeq = await pushEventOnlyFast(
      key,
      senderToken,
      now,
      payload.packet as Record<string, unknown>,
    );
    if (fastSeq === null) {
      return {
        status: 404,
        body: { ok: false, error: 'ROOM_NOT_FOUND', message: `Không tìm thấy phòng #${code}.` },
      };
    }
    return {
      status: 200,
      body: { ok: true, seq: fastSeq },
    };
  }

  // Nhịp tim chạy đường tắt trên field `hb:<token>` riêng — KHÔNG đụng `seq` / `data`!
  if (action === 'heartbeat') {
    const hbResult = await touchRoomHeartbeatOnly(key, senderToken, now);
    if (!hbResult) {
      return {
        status: 404,
        body: {
          ok: false,
          error: 'ROOM_NOT_FOUND',
          message: `Không tìm thấy phòng #${code}.`,
        },
      };
    }
    if (hbResult.phase === 'DISSOLVED') {
      return {
        status: 410,
        body: {
          ok: false,
          error: 'ROOM_DISSOLVED',
          phase: 'DISSOLVED',
          message: `Phòng #${code} đã được giải tán.`,
        },
      };
    }
    return {
      status: 200,
      body: {
        ok: true,
        seq: hbResult.seq,
        phase: hbResult.phase,
        heartbeats: hbResult.heartbeats,
      },
    };
  }

  const doc = await readRoomDoc(key);
  if (!doc) {
    return {
      status: 404,
      body: {
        ok: false,
        error: 'ROOM_NOT_FOUND',
        message: `Không tìm thấy phòng #${code}. Kiểm tra lại mã 6 số hoặc đảm bảo Chủ phòng đang mở phòng.`,
      },
    };
  }

  if (doc.phase === 'DISSOLVED' && action !== 'dissolve') {
    return {
      status: 410,
      body: {
        ok: false,
        error: 'ROOM_DISSOLVED',
        phase: 'DISSOLVED',
        message: `Phòng #${code} đã được giải tán.`,
      },
    };
  }

  if (action === 'join' || action === 'rejoin') {
    doc.heartbeats[senderToken] = now;
    doc.updatedAt = now;

    const humans = Array.isArray((doc.snapshot as { humans?: unknown[] } | null)?.humans)
      ? ((doc.snapshot as {
          humans: Array<{
            playerToken?: string;
            connected?: boolean;
            disconnectedAt?: number | null;
            botTakeover?: boolean;
          }>;
        }).humans)
      : [];
    const existingMember = humans.find((h) => h.playerToken === senderToken);

    if (existingMember) {
      existingMember.connected = true;
      existingMember.disconnectedAt = null;
      existingMember.botTakeover = false;
      if (doc.snapshot) {
        doc.snapshot = { ...doc.snapshot, updatedAt: now };
      }
      const pkt =
        payload.packet && typeof payload.packet === 'object'
          ? (payload.packet as Record<string, unknown>)
          : null;
      await commitRoomUpdateAtomic(key, doc, senderToken, now, pkt);
      return {
        status: 200,
        body: {
          ok: true,
          rejoined: true,
          roomCode: doc.roomCode,
          phase: doc.phase,
          hostToken: doc.hostToken,
          seq: doc.seq,
          snapshot: doc.snapshot,
          heartbeats: doc.heartbeats,
        },
      };
    }

    if (action === 'rejoin') {
      return {
        status: 404,
        body: {
          ok: false,
          error: 'SEAT_EXPIRED',
          message: `Ghế cũ trong phòng #${code} đã hết hạn hoặc phòng đã đóng.`,
        },
      };
    }

    if (doc.phase !== 'LOBBY') {
      return {
        status: 409,
        body: {
          ok: false,
          error: 'MATCH_ALREADY_STARTED',
          message: `Phòng #${code} đã bắt đầu ván chơi!`,
        },
      };
    }

    const packet =
      payload.packet && typeof payload.packet === 'object'
        ? (payload.packet as Record<string, unknown>)
        : null;
    await commitRoomUpdateAtomic(key, doc, senderToken, now, packet);
    return {
      status: 200,
      body: {
        ok: true,
        rejoined: false,
        roomCode: doc.roomCode,
        phase: doc.phase,
        hostToken: doc.hostToken,
        seq: doc.seq,
        snapshot: doc.snapshot,
        heartbeats: doc.heartbeats,
      },
    };
  }

  if (action === 'push') {
    doc.heartbeats[senderToken] = now;
    doc.updatedAt = now;

    const isHost = senderToken === doc.hostToken;
    const isPlayingMember = doc.phase === 'PLAYING' && isMemberToken(doc, senderToken);

    if (payload.snapshot && typeof payload.snapshot === 'object' && (isHost || isPlayingMember)) {
      const incomingSnapshot = payload.snapshot as Record<string, unknown>;
      const currentVer = extractMatchVersion(doc.snapshot);
      const incomingVer = extractMatchVersion(incomingSnapshot);

      if (doc.phase !== 'PLAYING' || incomingVer >= currentVer) {
        doc.snapshot = incomingSnapshot;
        const snapPhase = incomingSnapshot.phase;
        if (snapPhase === 'LOBBY' || snapPhase === 'PLAYING' || snapPhase === 'DISSOLVED') {
          doc.phase = snapPhase;
        }
      }
    }

    if (
      isHost &&
      (payload.phase === 'LOBBY' || payload.phase === 'PLAYING' || payload.phase === 'DISSOLVED')
    ) {
      doc.phase = payload.phase;
    }

    const pkt =
      payload.packet && typeof payload.packet === 'object'
        ? (payload.packet as Record<string, unknown>)
        : null;
    await commitRoomUpdateAtomic(key, doc, senderToken, now, pkt);
    return {
      status: 200,
      body: {
        ok: true,
        seq: doc.seq,
        phase: doc.phase,
        heartbeats: doc.heartbeats,
      },
    };
  }

  if (action === 'dissolve') {
    if (senderToken !== doc.hostToken) {
      return {
        status: 403,
        body: {
          ok: false,
          error: 'HOST_ONLY',
          message: 'Chỉ Chủ phòng mới có quyền giải tán phòng.',
        },
      };
    }

    doc.phase = 'DISSOLVED';
    doc.updatedAt = now;
    const pkt =
      payload.packet && typeof payload.packet === 'object'
        ? (payload.packet as Record<string, unknown>)
        : null;
    await commitRoomUpdateAtomic(key, doc, senderToken, now, pkt);
    return {
      status: 200,
      body: { ok: true, seq: doc.seq, phase: doc.phase },
    };
  }

  return { status: 400, body: { ok: false, error: 'UNKNOWN_ACTION', message: 'Hành động không hợp lệ.' } };
}
