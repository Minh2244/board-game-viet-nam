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
const MAX_EVENTS_KEPT = 24;
const MAX_LONG_POLL_MS = 3500;
const HB_FIELD_PREFIX = 'hb:';
const HB_MAP_FIELD = 'hb_map';
const EV_FIELD_PREFIX = 'ev:';

let cachedRedis: Redis | null | undefined;

/** Cho phép bộ unit test tiêm Redis giả lập để kiểm thử trực tiếp nhánh Upstash Lua nguyên tử */
export function __setUpstashRedisForTest(client: Redis | null | undefined): void {
  cachedRedis = client;
}

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

/**
 * 3 Lua script nguyên tử chạy 1 round-trip duy nhất trên Upstash Redis:
 * - Loại bỏ 100% cửa sổ race condition giữa `HINCRBY seq` và `HSET ev:<seq>` dưới Long-Polling.
 * - Chặn tạo key khống khi phòng đã hết hạn và chặn hồi sinh phòng đã `DISSOLVED`.
 * - Tự giữ TTL chuẩn theo đúng `phase` (`LOBBY` 15 phút / `PLAYING` 30 phút / `DISSOLVED` 60 giây).
 */
const PUSH_EVENT_ONLY_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return -1
end
local phase = redis.call('HGET', KEYS[1], 'phase')
if phase == 'DISSOLVED' then
  return -2
end
local nextSeq = redis.call('HINCRBY', KEYS[1], 'seq', 1)
local evJson = '{"seq":' .. tostring(nextSeq) .. ',"sentAt":' .. ARGV[2] .. ',"senderToken":' .. ARGV[4] .. ',"packet":' .. ARGV[3] .. '}'
redis.call('HSET', KEYS[1], ARGV[6] .. tostring(nextSeq), evJson, ARGV[1], ARGV[2])
local maxEv = tonumber(ARGV[5])
if nextSeq > maxEv then
  redis.call('HDEL', KEYS[1], ARGV[6] .. tostring(nextSeq - maxEv))
end
local ttl = tonumber(ARGV[7])
if phase == 'PLAYING' then
  ttl = tonumber(ARGV[8])
end
redis.call('EXPIRE', KEYS[1], ttl)
return nextSeq
`;

const COMMIT_UPDATE_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return -1
end
local curPhase = redis.call('HGET', KEYS[1], 'phase')
if curPhase == 'DISSOLVED' and ARGV[2] ~= '1' then
  return -2
end
local nextSeq = redis.call('HINCRBY', KEYS[1], 'seq', 1)
redis.call('HSET', KEYS[1], 'phase', ARGV[1], 'data', ARGV[3], ARGV[4], ARGV[5], ARGV[6], ARGV[7])
if ARGV[8] ~= '' then
  local evJson = '{"seq":' .. tostring(nextSeq) .. ',"sentAt":' .. ARGV[7] .. ',"senderToken":' .. ARGV[9] .. ',"packet":' .. ARGV[8] .. '}'
  redis.call('HSET', KEYS[1], ARGV[11] .. tostring(nextSeq), evJson)
  local maxEv = tonumber(ARGV[10])
  if nextSeq > maxEv then
    redis.call('HDEL', KEYS[1], ARGV[11] .. tostring(nextSeq - maxEv))
  end
end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[12]))
return nextSeq
`;

const SAVE_CHECKPOINT_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return -1
end
local curPhase = redis.call('HGET', KEYS[1], 'phase')
if curPhase == 'DISSOLVED' then
  return -2
end
redis.call('HSET', KEYS[1], 'phase', ARGV[1], 'data', ARGV[2], ARGV[3], ARGV[4], ARGV[5], ARGV[6])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[7]))
return tonumber(redis.call('HGET', KEYS[1], 'seq') or '1')
`;

// Bộ nhớ tạm cho môi trường local dev/preview (khi chưa cấu hình biến môi trường Upstash)
interface MemoryEntry {
  doc: StoredRoomDocument;
  heartbeats: Record<string, number>;
  eventsBySeq: Map<number, RoomEventRecord>;
  expiresAt: number;
}
const memoryRooms = new Map<string, MemoryEntry>();
const memoryWaiters = new Map<string, Set<() => void>>();

function notifyMemoryWaiters(key: string): void {
  const waiters = memoryWaiters.get(key);
  if (!waiters || waiters.size === 0) return;
  memoryWaiters.delete(key);
  for (const wake of waiters) {
    try {
      wake();
    } catch {
      // Ignore
    }
  }
}

function waitForMemoryRoomChange(key: string, timeoutMs: number): Promise<void> {
  if (timeoutMs <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onWake = () => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      const set = memoryWaiters.get(key);
      if (set) {
        set.delete(onWake);
        if (set.size === 0) memoryWaiters.delete(key);
      }
      resolve();
    };
    let set = memoryWaiters.get(key);
    if (!set) {
      set = new Set();
      memoryWaiters.set(key, set);
    }
    set.add(onWake);
    timer = setTimeout(onWake, timeoutMs);
  });
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function parseHeartbeatsMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (!obj || typeof obj !== 'object') return out;
  for (const [token, val] of Object.entries(obj as Record<string, unknown>)) {
    const ts = Number(val);
    if (token && Number.isFinite(ts) && ts > 0) {
      out[token] = ts;
    }
  }
  return out;
}

function mergeHeartbeats(
  ...maps: Array<Record<string, number> | undefined | null>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [token, ts] of Object.entries(m)) {
      if (Number.isFinite(ts) && ts > (out[token] ?? 0)) {
        out[token] = ts;
      }
    }
  }
  return out;
}

function parseDocDataField(raw: unknown): StoredRoomDocument | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as StoredRoomDocument;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as StoredRoomDocument;
  }
  return null;
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

type SnapshotMemberRecord = {
  playerToken?: string;
  connected?: boolean;
  disconnectedAt?: number | null;
  botTakeover?: boolean;
};

/** Hỗ trợ đồng nhất cả `humans` (Cờ Tỷ Phú, Cá Ngựa, Cờ Vua, Cờ Tướng) lẫn `members` (Ô Ăn Quan) */
function extractSnapshotMembers(snapshot: Record<string, unknown> | null): SnapshotMemberRecord[] {
  if (!snapshot) return [];
  const humans = (snapshot as { humans?: unknown }).humans;
  if (Array.isArray(humans)) return humans as SnapshotMemberRecord[];
  const members = (snapshot as { members?: unknown }).members;
  if (Array.isArray(members)) return members as SnapshotMemberRecord[];
  return [];
}

function isMemberToken(doc: StoredRoomDocument, token: string): boolean {
  if (token === doc.hostToken) return true;
  const list = extractSnapshotMembers(doc.snapshot);
  return list.some((m) => m.playerToken === token);
}

async function readRoomSeqAndPhase(
  key: string,
): Promise<{ seq: number; phase: RoomPhase } | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const raw = await redis.hmget<Record<string, unknown>>(key, 'seq', 'phase');
    if (!raw || raw.seq === null || raw.seq === undefined) return null;
    const seq = Number(raw.seq);
    if (!Number.isFinite(seq)) return null;
    const phase: RoomPhase =
      raw.phase === 'PLAYING' || raw.phase === 'DISSOLVED' ? raw.phase : 'LOBBY';
    return { seq, phase };
  }
  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  if (!entry) return null;
  return { seq: entry.doc.seq, phase: entry.doc.phase };
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

/**
 * Đọc gọn nhẹ tài liệu phòng CHỈ lấy `seq`, `phase`, `data`, `hb_map` bằng 1 lệnh HMGET (~18KB thay vì HGETALL).
 * Dùng cho các thao tác POST (`push`, `join`, `rejoin`, `dissolve`) vốn không cần tải lại các field `ev:*`.
 */
async function readRoomDocLight(key: string): Promise<StoredRoomDocument | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const raw = await redis.hmget<Record<string, unknown>>(key, 'seq', 'phase', 'data', HB_MAP_FIELD);
    if (!raw || !raw.data) return null;
    const doc = parseDocDataField(raw.data);
    if (!doc) return null;

    const latestSeq = Number(raw.seq);
    if (Number.isFinite(latestSeq) && latestSeq > doc.seq) {
      doc.seq = latestSeq;
    }
    if (raw.phase === 'LOBBY' || raw.phase === 'PLAYING' || raw.phase === 'DISSOLVED') {
      doc.phase = raw.phase;
    }
    doc.heartbeats = mergeHeartbeats(doc.heartbeats, parseHeartbeatsMap(raw[HB_MAP_FIELD]));
    doc.events = [];
    return doc;
  }

  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  if (!entry) return null;
  const cloned = structuredClone(entry.doc);
  cloned.heartbeats = mergeHeartbeats(cloned.heartbeats, entry.heartbeats);
  cloned.events = [];
  return cloned;
}

async function readRoomDoc(key: string): Promise<StoredRoomDocument | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const all = await redis.hgetall<Record<string, unknown>>(key);
    if (!all || !all.data) return null;
    const doc = parseDocDataField(all.data);
    if (!doc) return null;

    const latestSeq = Number(all.seq);
    if (Number.isFinite(latestSeq) && latestSeq > doc.seq) {
      doc.seq = latestSeq;
    }
    if (all.phase === 'LOBBY' || all.phase === 'PLAYING' || all.phase === 'DISSOLVED') {
      doc.phase = all.phase;
    }

    doc.heartbeats = mergeHeartbeats(
      doc.heartbeats,
      parseHeartbeatsMap(all[HB_MAP_FIELD]),
      parseHeartbeatsFromHash(all),
    );

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
  cloned.heartbeats = mergeHeartbeats(cloned.heartbeats, entry.heartbeats);
  cloned.events = Array.from(entry.eventsBySeq.values()).sort((a, b) => a.seq - b.seq);
  return cloned;
}

type AtomicMutationResult =
  | { ok: true; seq: number }
  | { ok: false; reason: 'NOT_FOUND' | 'DISSOLVED' };

/**
 * Đường tắt siêu tốc cho gói tin sự kiện thuần (như `ACTION_COMMIT`, `DICE_CHARGE`, `RTC_SIGNAL`):
 * Chạy 1 Lua script nguyên tử duy nhất trên Upstash (kiểm tra EXISTS & phase ~= DISSOLVED + HINCRBY + HSET ev:<seq> + EXPIRE).
 * Loại bỏ 100% cửa sổ race condition khiến Long-Polling đọc `seq` mới trước khi `ev:<seq>` tồn tại!
 */
async function pushEventOnlyFast(
  key: string,
  senderToken: string,
  now: number,
  packet: Record<string, unknown>,
): Promise<AtomicMutationResult> {
  const redis = getUpstashRedis();
  if (redis) {
    const res = Number(
      await redis.eval(
        PUSH_EVENT_ONLY_LUA,
        [key],
        [
          `${HB_FIELD_PREFIX}${senderToken}`,
          String(now),
          JSON.stringify(packet),
          JSON.stringify(senderToken),
          String(MAX_EVENTS_KEPT),
          EV_FIELD_PREFIX,
          String(LOBBY_TTL_SEC),
          String(PLAYING_TTL_SEC),
        ],
      ),
    );
    if (res === -1 || !Number.isFinite(res) || res <= 0) {
      return { ok: false, reason: res === -2 ? 'DISSOLVED' : 'NOT_FOUND' };
    }
    return { ok: true, seq: res };
  }

  cleanExpiredMemory();
  const entry = memoryRooms.get(key);
  if (!entry) return { ok: false, reason: 'NOT_FOUND' };
  if (entry.doc.phase === 'DISSOLVED') return { ok: false, reason: 'DISSOLVED' };
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
  entry.doc.events = [];
  entry.expiresAt = now + ttlForPhase(entry.doc.phase) * 1000;
  notifyMemoryWaiters(key);
  return { ok: true, seq: nextSeq };
}

/**
 * Cấp số thứ tự `seq` nguyên tử + ghi snapshot `data` + sự kiện `ev:<seq>` trong 1 Lua script duy nhất.
 * QUAN TRỌNG: Tuyệt đối KHÔNG nhồi mảng `doc.events` vào `data` để giữ dung lượng luôn gọn ~18KB!
 */
async function commitRoomUpdateAtomic(
  key: string,
  doc: StoredRoomDocument,
  senderToken: string,
  now: number,
  newPacket?: Record<string, unknown> | null,
  allowIfDissolved = false,
): Promise<AtomicMutationResult> {
  const ttl = ttlForPhase(doc.phase);
  const nextHeartbeats = mergeHeartbeats(doc.heartbeats, { [senderToken]: now });
  doc.heartbeats = nextHeartbeats;

  const redis = getUpstashRedis();
  if (redis) {
    const slimDocForData: StoredRoomDocument = {
      ...doc,
      events: [],
    };
    const res = Number(
      await redis.eval(
        COMMIT_UPDATE_LUA,
        [key],
        [
          doc.phase,
          allowIfDissolved ? '1' : '0',
          JSON.stringify(slimDocForData),
          HB_MAP_FIELD,
          JSON.stringify(nextHeartbeats),
          `${HB_FIELD_PREFIX}${senderToken}`,
          String(now),
          newPacket ? JSON.stringify(newPacket) : '',
          JSON.stringify(senderToken),
          String(MAX_EVENTS_KEPT),
          EV_FIELD_PREFIX,
          String(ttl),
        ],
      ),
    );
    if (res === -1 || !Number.isFinite(res) || res <= 0) {
      return { ok: false, reason: res === -2 ? 'DISSOLVED' : 'NOT_FOUND' };
    }
    doc.seq = res;
    return { ok: true, seq: res };
  }

  cleanExpiredMemory();
  const existing = memoryRooms.get(key);
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  if (existing.doc.phase === 'DISSOLVED' && !allowIfDissolved) {
    return { ok: false, reason: 'DISSOLVED' };
  }
  const nextSeq = (existing.doc.seq ?? doc.seq) + 1;
  doc.seq = nextSeq;
  const eventsBySeq = existing.eventsBySeq ?? new Map<number, RoomEventRecord>();

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

  // Giữ `doc.events` rỗng trong snapshot gốc (các sự kiện live đọc từ `eventsBySeq`)
  doc.events = [];
  const heartbeats = mergeHeartbeats(existing.heartbeats, doc.heartbeats, { [senderToken]: now });
  doc.heartbeats = heartbeats;

  memoryRooms.set(key, {
    doc: structuredClone(doc),
    heartbeats,
    eventsBySeq,
    expiresAt: Date.now() + ttl * 1000,
  });
  notifyMemoryWaiters(key);
  return { ok: true, seq: nextSeq };
}

/**
 * Lưu checkpoint snapshot dự phòng F5 ngầm nguyên tử (KHÔNG tăng `seq` nên không đánh thức Long-Polling vô ích,
 * đồng thời không bao giờ ghi đè hồi sinh phòng đã `DISSOLVED`).
 */
async function saveSnapshotCheckpointOnly(
  key: string,
  doc: StoredRoomDocument,
  senderToken: string,
  now: number,
): Promise<AtomicMutationResult> {
  const ttl = ttlForPhase(doc.phase);
  const nextHeartbeats = mergeHeartbeats(doc.heartbeats, { [senderToken]: now });
  doc.heartbeats = nextHeartbeats;

  const redis = getUpstashRedis();
  if (redis) {
    const slimDocForData: StoredRoomDocument = { ...doc, events: [] };
    const res = Number(
      await redis.eval(
        SAVE_CHECKPOINT_LUA,
        [key],
        [
          doc.phase,
          JSON.stringify(slimDocForData),
          HB_MAP_FIELD,
          JSON.stringify(nextHeartbeats),
          `${HB_FIELD_PREFIX}${senderToken}`,
          String(now),
          String(ttl),
        ],
      ),
    );
    if (res === -1 || !Number.isFinite(res) || res <= 0) {
      return { ok: false, reason: res === -2 ? 'DISSOLVED' : 'NOT_FOUND' };
    }
    doc.seq = res;
    return { ok: true, seq: res };
  }

  cleanExpiredMemory();
  const existing = memoryRooms.get(key);
  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  if (existing.doc.phase === 'DISSOLVED') return { ok: false, reason: 'DISSOLVED' };
  doc.events = [];
  doc.seq = existing.doc.seq;
  existing.doc = structuredClone(doc);
  existing.heartbeats = mergeHeartbeats(existing.heartbeats, nextHeartbeats);
  existing.expiresAt = Date.now() + ttl * 1000;
  return { ok: true, seq: existing.doc.seq };
}

/**
 * Cập nhật nhịp tim (heartbeat) siêu nhẹ bằng HMGET chỉ 3 field (~250 bytes thay vì HGETALL tải hàng MB!).
 */
async function touchRoomHeartbeatOnly(
  key: string,
  senderToken: string,
  now: number,
): Promise<{ seq: number; phase: RoomPhase; heartbeats: Record<string, number> } | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const raw = await redis.hmget<Record<string, unknown>>(key, 'seq', 'phase', HB_MAP_FIELD);
    if (!raw || raw.seq === null || raw.seq === undefined) return null;

    const seq = Number(raw.seq) || 0;
    const phase: RoomPhase =
      raw.phase === 'PLAYING' || raw.phase === 'DISSOLVED' ? raw.phase : 'LOBBY';

    if (phase === 'DISSOLVED') {
      return { seq, phase, heartbeats: {} };
    }

    const heartbeats = mergeHeartbeats(parseHeartbeatsMap(raw[HB_MAP_FIELD]), {
      [senderToken]: now,
    });
    const ttl = ttlForPhase(phase);
    const pipe = redis.pipeline();
    pipe.hset(key, {
      [HB_MAP_FIELD]: JSON.stringify(heartbeats),
      [`${HB_FIELD_PREFIX}${senderToken}`]: String(now),
    });
    pipe.expire(key, ttl);
    await pipe.exec();

    return { seq, phase, heartbeats };
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
      data: JSON.stringify({ ...initialDoc, events: [] }),
      [HB_MAP_FIELD]: JSON.stringify(initialDoc.heartbeats),
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

/** Xử lý GET /api/room?game=...&code=...&sinceSeq=...&waitMs=... (Long-Polling tức thì + Fast HMGET delta) */
export async function handleRoomGet(url: URL): Promise<RoomApiResult> {
  const game = url.searchParams.get('game') || 'co-ty-phu';
  const code = url.searchParams.get('code') || '';
  const sinceSeq = Math.max(0, Number(url.searchParams.get('sinceSeq') || '0') || 0);
  const includeSnapshot = url.searchParams.get('full') === '1';
  const rawWaitMs = Number(url.searchParams.get('waitMs') || '0') || 0;
  const waitMs = includeSnapshot ? 0 : Math.max(0, Math.min(MAX_LONG_POLL_MS, Math.floor(rawWaitMs)));

  if (!isValidCode(code)) {
    return { status: 400, body: { ok: false, error: 'INVALID_CODE', message: 'Mã phòng phải gồm đúng 6 chữ số.' } };
  }

  const key = roomKey(game, code);
  let roomMeta = await readRoomSeqAndPhase(key);
  if (!roomMeta) {
    return {
      status: 404,
      body: {
        ok: false,
        error: 'ROOM_NOT_FOUND',
        message: `Không tìm thấy phòng #${code}. Kiểm tra lại mã 6 số hoặc đảm bảo Chủ phòng đang mở phòng.`,
      },
    };
  }

  // Server-Side Long-Polling: giữ kết nối chờ tối đa `waitMs` (<= 3.5s) và trả ngay lập tức khi có nước đi mới hoặc phòng vừa giải tán!
  if (!includeSnapshot && roomMeta.phase !== 'DISSOLVED' && roomMeta.seq <= sinceSeq && waitMs > 0) {
    const deadline = Date.now() + waitMs;
    const isRedis = Boolean(getUpstashRedis());

    if (!isRedis) {
      while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await waitForMemoryRoomChange(key, remaining);
        roomMeta = await readRoomSeqAndPhase(key);
        if (!roomMeta) {
          return {
            status: 404,
            body: {
              ok: false,
              error: 'ROOM_NOT_FOUND',
              message: `Phòng #${code} đã đóng hoặc hết thời gian chờ.`,
            },
          };
        }
        if (roomMeta.phase === 'DISSOLVED' || roomMeta.seq > sinceSeq) break;
      }
    } else {
      let tick = 0;
      while (Date.now() < deadline) {
        // Nhịp bước thông minh (140ms -> 220ms -> 340ms): giảm ~55% số lệnh Upstash Free mà vẫn phản hồi <200ms khi dự phòng!
        const step = tick < 3 ? 140 : tick < 8 ? 220 : 340;
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await sleepMs(Math.min(step, remaining));
        tick += 1;
        roomMeta = await readRoomSeqAndPhase(key);
        if (!roomMeta) {
          return {
            status: 404,
            body: {
              ok: false,
              error: 'ROOM_NOT_FOUND',
              message: `Phòng #${code} đã đóng hoặc hết thời gian chờ.`,
            },
          };
        }
        if (roomMeta.phase === 'DISSOLVED' || roomMeta.seq > sinceSeq) break;
      }
    }
  }

  const currentSeq = roomMeta.seq;

  // Phòng đã giải tán -> trả ngay `phase: 'DISSOLVED'` (kèm gói DISSOLVE_ROOM nếu mới phát) thay vì treo chờ hoặc báo unchanged!
  if (!includeSnapshot && roomMeta.phase === 'DISSOLVED') {
    const fastDelta =
      sinceSeq > 0 && currentSeq > sinceSeq && currentSeq - sinceSeq <= 20
        ? await readDeltaEventsFast(key, sinceSeq, currentSeq)
        : null;
    return {
      status: 200,
      body: {
        ok: true,
        unchanged: false,
        roomCode: code,
        phase: 'DISSOLVED',
        seq: currentSeq,
        events: fastDelta?.events ?? [],
        storageMode: getUpstashRedis() ? 'upstash' : 'memory',
      },
    };
  }

  // Không có thay đổi mới sau khi chờ -> trả gọn nhẹ
  if (!includeSnapshot && currentSeq <= sinceSeq) {
    return {
      status: 200,
      body: {
        ok: true,
        unchanged: true,
        phase: roomMeta.phase,
        seq: currentSeq,
        events: [],
      },
    };
  }

  // Đường tắt siêu tốc khi máy khách chỉ cần lấy gói sự kiện mới (sinceSeq > 0 & !includeSnapshot) -> không tải snapshot!
  if (!includeSnapshot && sinceSeq > 0 && currentSeq - sinceSeq <= 20) {
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

      const initialPhase: RoomPhase =
        initialSnapshot &&
        (initialSnapshot.phase === 'PLAYING' || initialSnapshot.phase === 'DISSOLVED')
          ? initialSnapshot.phase
          : 'LOBBY';

      const doc: StoredRoomDocument = {
        game,
        roomCode: candidate,
        hostToken: senderToken,
        phase: initialPhase,
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

  // Đường tắt siêu tốc cho sự kiện thuần (như ACTION_COMMIT, DICE_CHARGE, RTC_SIGNAL — chạy 1 Lua script nguyên tử):
  if (
    action === 'push' &&
    !payload.snapshot &&
    !payload.phase &&
    payload.packet &&
    typeof payload.packet === 'object'
  ) {
    const fastRes = await pushEventOnlyFast(
      key,
      senderToken,
      now,
      payload.packet as Record<string, unknown>,
    );
    if (!fastRes.ok) {
      if (fastRes.reason === 'DISSOLVED') {
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
        status: 404,
        body: { ok: false, error: 'ROOM_NOT_FOUND', message: `Không tìm thấy phòng #${code}.` },
      };
    }
    return {
      status: 200,
      body: { ok: true, seq: fastRes.seq },
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

  // Khi `rejoin`, đọc full doc 1 lần duy nhất (tránh gọi readRoomDocLight rồi lại readRoomDoc thừa!)
  const doc = action === 'rejoin' ? await readRoomDoc(key) : await readRoomDocLight(key);
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

    const membersList = extractSnapshotMembers(doc.snapshot);
    const existingMember = membersList.find((h) => h.playerToken === senderToken);

    if (existingMember) {
      const recentEvents =
        action === 'rejoin' ? [...doc.events] : ((await readRoomDoc(key))?.events ?? []);
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
      // Nếu rejoin không kèm packet -> chỉ lưu checkpoint (KHÔNG tăng `seq` rỗng ép các máy khác tải thừa HGETALL!)
      const mutRes = pkt
        ? await commitRoomUpdateAtomic(key, doc, senderToken, now, pkt)
        : await saveSnapshotCheckpointOnly(key, doc, senderToken, now);
      if (!mutRes.ok && mutRes.reason === 'DISSOLVED') {
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
          rejoined: true,
          roomCode: doc.roomCode,
          phase: doc.phase,
          hostToken: doc.hostToken,
          seq: doc.seq,
          snapshot: doc.snapshot,
          heartbeats: doc.heartbeats,
          events: recentEvents,
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
    const joinRes = await commitRoomUpdateAtomic(key, doc, senderToken, now, packet);
    if (!joinRes.ok && joinRes.reason === 'DISSOLVED') {
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

  if (action === 'checkpoint') {
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
        const cpRes = await saveSnapshotCheckpointOnly(key, doc, senderToken, now);
        if (!cpRes.ok && cpRes.reason === 'DISSOLVED') {
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
      }
    }

    return {
      status: 200,
      body: {
        ok: true,
        seq: doc.seq,
        phase: doc.phase,
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
    const pushRes = await commitRoomUpdateAtomic(key, doc, senderToken, now, pkt);
    if (!pushRes.ok && pushRes.reason === 'DISSOLVED') {
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
    await commitRoomUpdateAtomic(key, doc, senderToken, now, pkt, true);
    return {
      status: 200,
      body: { ok: true, seq: doc.seq, phase: doc.phase },
    };
  }

  return { status: 400, body: { ok: false, error: 'UNKNOWN_ACTION', message: 'Hành động không hợp lệ.' } };
}
