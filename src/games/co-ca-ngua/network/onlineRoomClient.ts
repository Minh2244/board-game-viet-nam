import { cryptoRandomInt } from '@/shared/crypto/random';
import { AblyFastLane } from '@/shared/network/ablyFastLane';
import {
  createAdaptiveCheckpointScheduler,
  getAdaptiveBackupPollIntervalMs,
  hasAllConnectedPeersRtcOpen,
  postWithRetry,
  type AdaptiveCheckpointScheduler,
} from '@/shared/network/onlineReliability';
import { isFastLaneDisabled } from '@/shared/network/onlineTransportConfig';
import { CLOCKWISE_COLORS, HORSE_COLOR_CONFIG } from '../engine/boardGeometry';
import { createInitialCoCaNguaState, reduceCoCaNguaAction } from '../engine/reducer';
import type {
  CoCaNguaAction,
  CoCaNguaState,
  HorseBotDifficulty,
  HorseColor,
} from '../engine/types';

export const ONLINE_DISCONNECT_GRACE_MS = 120_000; // 2 phút giữ ghế trước khi Máy đánh thay
const GAME_NAMESPACE = 'co-ca-ngua';
const SESSION_STORAGE_KEY = 'bgvn_cocangua_online_session_v1';
const TOKEN_STORAGE_KEY = 'bgvn_cocangua_player_token';
const HEARTBEAT_INTERVAL_MS = 10_000;
const DISCONNECT_THRESHOLD_MS = 26_000;

export interface CoCaNguaOnlineMember {
  playerToken: string;
  color: HorseColor;
  name: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  botTakeover: boolean;
}

export interface CoCaNguaRoomSnapshot {
  roomCode: string;
  phase: 'LOBBY' | 'PLAYING' | 'DISSOLVED';
  hostToken: string;
  botCount: number; // 0..3
  botDifficulty: HorseBotDifficulty;
  /** Bắt buộc đặt tên trường là `humans` chứa `playerToken` để khớp kiểm tra quyền ở api/_roomStore.ts */
  humans: CoCaNguaOnlineMember[];
  bots: CoCaNguaOnlineMember[];
  matchState: CoCaNguaState | null;
  matchVersion: number;
  updatedAt: number;
}

export interface PersistedCoCaNguaSession {
  roomCode: string;
  playerToken: string;
  playerName: string;
  isHost: boolean;
  savedAt: number;
}

export interface RemoteHorseActionEvent {
  actionId: string;
  actorColor: HorseColor;
  action: CoCaNguaAction;
  resultingState?: CoCaNguaState;
  matchVersion: number;
}

export type OnlineTransportStatus = 'CONNECTING' | 'READY' | 'RECONNECTING' | 'ERROR';

type RtcSignalPayload = {
  kind: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
};

interface PeerChannelState {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  makingOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

type WirePacket =
  | {
      msgId: string;
      senderToken: string;
      type: 'JOIN_REQUEST';
      roomCode: string;
      playerToken: string;
      name: string;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'JOIN_REJECTED';
      targetToken: string;
      reason: string;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'ROOM_SNAPSHOT';
      snapshot: CoCaNguaRoomSnapshot;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'UPDATE_MEMBER';
      targetToken: string;
      patch: {
        name?: string;
        color?: HorseColor;
      };
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'ACTION_COMMIT';
      actionId: string;
      actorColor: HorseColor;
      action: CoCaNguaAction;
      resultingState?: CoCaNguaState;
      matchVersion: number;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'RTC_SIGNAL';
      targetToken: string;
      signal: RtcSignalPayload;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'LEAVE_ROOM';
      playerToken: string;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'KICKED';
      targetToken: string;
      reason: string;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'DISSOLVE_ROOM';
      reason: string;
    };

interface ApiEventRow {
  seq: number;
  sentAt: number;
  senderToken: string;
  packet: WirePacket;
}

interface ApiRoomResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  unchanged?: boolean;
  rejoined?: boolean;
  roomCode?: string;
  phase?: 'LOBBY' | 'PLAYING' | 'DISSOLVED';
  hostToken?: string;
  seq?: number;
  snapshot?: CoCaNguaRoomSnapshot | null;
  heartbeats?: Record<string, number>;
  events?: ApiEventRow[];
  storageMode?: 'upstash' | 'memory';
}

function generateRandomId(prefix: string): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}_${Date.now().toString(36)}`;
}

export function generateCoCaNguaRoomCode(): string {
  return String(cryptoRandomInt(100000, 999999));
}

export function getOrCreateCoCaNguaToken(): string {
  if (typeof window === 'undefined') return generateRandomId('ccn');
  const existing = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (existing && existing.length >= 8) return existing;
  const fresh = generateRandomId('ccn');
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, fresh);
  return fresh;
}

export function savePersistedCoCaNguaSession(session: PersistedCoCaNguaSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore
  }
}

export function loadPersistedCoCaNguaSession(): PersistedCoCaNguaSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCoCaNguaSession;
    if (!parsed?.roomCode || !parsed?.playerToken) return null;
    if (Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedCoCaNguaSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/** Chọn màu tiếp theo cân xứng (nếu mới có 1 người -> tự chọn màu đối góc 180° cho công bằng 26 ô!) */
function pickBalancedNextColor(members: readonly CoCaNguaOnlineMember[]): HorseColor {
  const used = new Set(members.map((m) => m.color));
  if (members.length === 1) {
    const firstIdx = CLOCKWISE_COLORS.indexOf(members[0].color);
    const opposite = CLOCKWISE_COLORS[(firstIdx + 2) % 4];
    if (!used.has(opposite)) return opposite;
  }
  const free = CLOCKWISE_COLORS.find((c) => !used.has(c));
  return free ?? CLOCKWISE_COLORS[members.length % 4];
}

function buildHorseBotsArray(
  desiredCount: number,
  existingBots: readonly CoCaNguaOnlineMember[],
  humans: readonly CoCaNguaOnlineMember[],
): CoCaNguaOnlineMember[] {
  const clamped = Math.max(0, Math.min(3, Math.min(desiredCount, Math.max(0, 4 - humans.length))));
  const result: CoCaNguaOnlineMember[] = existingBots.slice(0, clamped).map((b) => ({ ...b }));

  // Đảm bảo không có bot nào trùng màu với người chơi thật
  const humanColors = new Set(humans.map((h) => h.color));
  const usedColors = new Set<HorseColor>(humanColors);
  for (const bot of result) {
    if (usedColors.has(bot.color)) {
      const replacement = CLOCKWISE_COLORS.find((c) => !usedColors.has(c)) ?? 'blue';
      bot.color = replacement;
    }
    usedColors.add(bot.color);
  }

  while (result.length < clamped) {
    const botIdx = result.length + 1;
    const allCurrent = [...humans, ...result];
    const color = pickBalancedNextColor(allCurrent);
    result.push({
      playerToken: `ccn_bot_${botIdx}`,
      color,
      name: `Máy ${botIdx} (${HORSE_COLOR_CONFIG[color].shortName})`,
      isHost: false,
      isBot: true,
      connected: true,
      disconnectedAt: null,
      botTakeover: false,
    });
  }
  return result;
}

async function apiPostRoom(body: Record<string, unknown>): Promise<{ status: number; data: ApiRoomResponse }> {
  const res = await fetch('/api/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let data: ApiRoomResponse = {};
  try {
    data = (await res.json()) as ApiRoomResponse;
  } catch {
    data = { ok: false, message: `Lỗi máy chủ (${res.status}).` };
  }
  return { status: res.status, data };
}

async function apiGetRoom(
  code: string,
  sinceSeq: number,
  full = false,
  waitMs = 0,
): Promise<{ status: number; data: ApiRoomResponse }> {
  const qs = new URLSearchParams({
    game: GAME_NAMESPACE,
    code,
    sinceSeq: String(sinceSeq),
  });
  if (full) qs.set('full', '1');
  if (!full && waitMs > 0) qs.set('waitMs', String(waitMs));
  const res = await fetch(`/api/room?${qs.toString()}`, { cache: 'no-store' });
  let data: ApiRoomResponse = {};
  try {
    data = (await res.json()) as ApiRoomResponse;
  } catch {
    data = { ok: false, message: `Lỗi máy chủ (${res.status}).` };
  }
  return { status: res.status, data };
}

export interface CoCaNguaOnlineCallbacks {
  onSnapshot: (snapshot: CoCaNguaRoomSnapshot) => void;
  onStatusChange: (status: OnlineTransportStatus, message: string) => void;
  onRemoteAction: (event: RemoteHorseActionEvent) => void;
  onRoomClosed: (reason: string) => void;
  onPeerJoined?: (memberName: string) => void;
}

const RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

export class CoCaNguaOnlineClient {
  public roomCode: string;
  public readonly playerToken: string;
  public isHost: boolean;

  private callbacks: CoCaNguaOnlineCallbacks;
  private seenMsgIds = new Set<string>();
  private seenActionIds = new Set<string>();
  private lastSeenMap = new Map<string, number>();
  private lastSeq = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private graceCheckTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;
  private consecutivePollErrors = 0;
  private destroyed = false;
  private snapshot: CoCaNguaRoomSnapshot | null = null;
  private localName: string;
  private joinResolved = false;
  private visibilityHandler: (() => void) | null = null;
  private pushChain: Promise<void> = Promise.resolve();
  private actionPushChain: Promise<void> = Promise.resolve();
  private broadcastChan: BroadcastChannel | null = null;
  private ablyLane: AblyFastLane | null = null;
  private ablyConnected = false;
  private rtcPeers = new Map<string, PeerChannelState>();
  private checkpointScheduler: AdaptiveCheckpointScheduler | null = null;
  private joinPollAttempts = 0;

  constructor(options: {
    roomCode: string;
    playerToken: string;
    playerName: string;
    isHost: boolean;
    callbacks: CoCaNguaOnlineCallbacks;
  }) {
    this.roomCode = options.roomCode;
    this.playerToken = options.playerToken;
    this.localName = options.playerName.trim() || (options.isHost ? 'Chủ Phòng' : 'Người Chơi');
    this.isHost = options.isHost;
    this.callbacks = options.callbacks;
  }

  public getSnapshot(): CoCaNguaRoomSnapshot | null {
    return this.snapshot;
  }

  public async startAsHost(initialBotCount = 1): Promise<string> {
    this.callbacks.onStatusChange('CONNECTING', 'Đang khởi tạo phòng Cờ Cá Ngựa...');

    const hostMember: CoCaNguaOnlineMember = {
      playerToken: this.playerToken,
      color: 'red',
      name: this.localName,
      isHost: true,
      isBot: false,
      connected: true,
      disconnectedAt: null,
      botTakeover: false,
    };

    const bots = buildHorseBotsArray(initialBotCount, [], [hostMember]);
    const draftSnapshot: CoCaNguaRoomSnapshot = {
      roomCode: this.roomCode,
      phase: 'LOBBY',
      hostToken: this.playerToken,
      botCount: bots.length,
      botDifficulty: 'medium',
      humans: [hostMember],
      bots,
      matchState: null,
      matchVersion: 0,
      updatedAt: Date.now(),
    };

    const { status, data } = await apiPostRoom({
      action: 'create',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
      snapshot: draftSnapshot,
    });

    if (status !== 200 || !data.ok || !data.roomCode) {
      const msg = data.message || 'Không thể tạo phòng Online. Vui lòng thử lại!';
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.roomCode = data.roomCode;
    this.lastSeq = data.seq ?? 1;
    this.snapshot = (data.snapshot as CoCaNguaRoomSnapshot) ?? {
      ...draftSnapshot,
      roomCode: this.roomCode,
    };
    this.joinResolved = true;

    this.persistSession();
    this.callbacks.onStatusChange(
      'READY',
      data.storageMode === 'upstash'
        ? 'Trực tuyến · Sẵn sàng kết nối khác mạng 4G/Wi-Fi'
        : 'Trực tuyến · Phòng cục bộ sẵn sàng',
    );
    this.emitSnapshot();
    this.startSyncLoops();
    return this.roomCode;
  }

  public async joinRoom(): Promise<void> {
    this.callbacks.onStatusChange('CONNECTING', `Đang tìm phòng #${this.roomCode}...`);

    const joinPacket: WirePacket = {
      msgId: generateRandomId('join'),
      senderToken: this.playerToken,
      type: 'JOIN_REQUEST',
      roomCode: this.roomCode,
      playerToken: this.playerToken,
      name: this.localName,
    };

    const { status, data } = await apiPostRoom({
      action: 'join',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
      packet: joinPacket,
    });

    if (status !== 200 || !data.ok) {
      const msg =
        data.message ||
        `Không tìm thấy phòng #${this.roomCode}. Kiểm tra lại mã 6 số hoặc hỏi Chủ phòng.`;
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.lastSeq = data.seq ?? 0;
    this.ingestHeartbeats(data.heartbeats);

    if (data.rejoined && data.snapshot) {
      this.isHost = data.hostToken === this.playerToken;
      this.snapshot = this.replayMissedActionsIntoSnapshot(data.snapshot, data.events);
      this.joinResolved = true;
      this.persistSession();
      this.callbacks.onStatusChange('READY', `Đã khôi phục phòng #${this.roomCode}`);
      this.emitSnapshot();
      this.startSyncLoops();
      return;
    }

    this.persistSession();
    this.startSyncLoops();

    return new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const waitTimer = setInterval(() => {
        if (this.destroyed) {
          clearInterval(waitTimer);
          reject(new Error('Kết nối phòng đã bị đóng.'));
          return;
        }
        if (this.joinResolved && this.snapshot) {
          clearInterval(waitTimer);
          resolve();
          return;
        }
        if (Date.now() - started > 12_000) {
          clearInterval(waitTimer);
          const msg = `Phòng #${this.roomCode} đang không phản hồi từ Chủ phòng.`;
          this.callbacks.onStatusChange('ERROR', msg);
          reject(new Error(msg));
        }
      }, 140);
    });
  }

  public async rejoinExistingRoom(): Promise<CoCaNguaRoomSnapshot> {
    this.callbacks.onStatusChange('RECONNECTING', `Đang khôi phục phòng #${this.roomCode}...`);

    const { status, data } = await apiPostRoom({
      action: 'rejoin',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
    });

    if (status !== 200 || !data.ok || !data.snapshot) {
      const msg = data.message || `Phòng #${this.roomCode} đã đóng hoặc hết thời gian chờ.`;
      clearPersistedCoCaNguaSession();
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.isHost = data.hostToken === this.playerToken;
    this.snapshot = this.replayMissedActionsIntoSnapshot(data.snapshot, data.events);
    this.lastSeq = data.seq ?? 0;
    this.joinResolved = true;
    this.ingestHeartbeats(data.heartbeats);
    this.persistSession();

    this.callbacks.onStatusChange('READY', `Đã khôi phục phòng #${this.roomCode}`);
    this.emitSnapshot();
    this.startSyncLoops();

    if (this.isHost) {
      this.scheduleCheckpoint(150);
    }

    return this.snapshot;
  }

  private replayMissedActionsIntoSnapshot(
    snap: CoCaNguaRoomSnapshot,
    events?: ApiEventRow[],
  ): CoCaNguaRoomSnapshot {
    if (!snap.matchState || !Array.isArray(events) || events.length === 0) return snap;
    let state = snap.matchState;
    let ver = snap.matchVersion;
    for (const row of events) {
      const pkt = row?.packet;
      if (!pkt || pkt.type !== 'ACTION_COMMIT' || pkt.matchVersion <= ver) continue;
      if (this.seenActionIds.has(pkt.actionId)) continue;
      this.seenActionIds.add(pkt.actionId);
      const { state: reduced } = reduceCoCaNguaAction(state, pkt.action);
      state = reduced !== state ? reduced : pkt.resultingState ?? state;
      ver = pkt.matchVersion;
    }
    return { ...snap, matchState: state, matchVersion: ver };
  }

  private hasAllPeersRtcOpen(): boolean {
    if (!this.snapshot) return false;
    const remoteTokens = this.snapshot.humans
      .filter((h) => h.playerToken !== this.playerToken && h.connected)
      .map((h) => h.playerToken);
    return hasAllConnectedPeersRtcOpen(remoteTokens, this.rtcPeers, isFastLaneDisabled());
  }

  private scheduleCheckpoint(delayMs = 1200): void {
    if (this.destroyed || !this.snapshot) return;
    if (!this.checkpointScheduler) {
      this.checkpointScheduler = createAdaptiveCheckpointScheduler({
        isDestroyed: () => this.destroyed,
        onFlush: () => {
          if (this.destroyed || !this.snapshot) return;
          const snapClone = structuredClone(this.snapshot);
          void apiPostRoom({
            action: 'checkpoint',
            game: GAME_NAMESPACE,
            roomCode: this.roomCode,
            senderToken: this.playerToken,
            snapshot: snapClone,
          }).catch(() => {});
        },
      });
    }
    this.checkpointScheduler.schedule(delayMs);
  }

  private persistSession(): void {
    savePersistedCoCaNguaSession({
      roomCode: this.roomCode,
      playerToken: this.playerToken,
      playerName: this.localName,
      isHost: this.isHost,
      savedAt: Date.now(),
    });
  }

  private getAdaptivePollIntervalMs(): number {
    return getAdaptiveBackupPollIntervalMs({
      joinResolved: this.joinResolved,
      hidden: typeof document !== 'undefined' && document.hidden,
      ablyConnected: this.ablyConnected,
      allRtcOpen: this.hasAllPeersRtcOpen(),
    });
  }

  private startSyncLoops(): void {
    this.initFastLanes();
    this.scheduleNextPoll(140);

    if (this.heartbeatTimer === null) {
      this.heartbeatTimer = setInterval(() => {
        if (this.destroyed || !this.snapshot) return;
        this.persistSession();
        void apiPostRoom({
          action: 'heartbeat',
          game: GAME_NAMESPACE,
          roomCode: this.roomCode,
          senderToken: this.playerToken,
        })
          .then(({ status, data }) => {
            if (this.destroyed) return;
            if (status === 404 || status === 410 || data.phase === 'DISSOLVED') {
              clearPersistedCoCaNguaSession();
              this.callbacks.onRoomClosed(data.message || 'Phòng Online đã đóng.');
              this.destroy();
              return;
            }
            this.ingestHeartbeats(data.heartbeats);
          })
          .catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);
    }

    if (this.graceCheckTimer === null) {
      this.graceCheckTimer = setInterval(() => {
        if (this.destroyed || !this.snapshot) return;
        const now = Date.now();
        let changed = false;

        for (const h of this.snapshot.humans) {
          if (h.playerToken === this.playerToken) continue;

          const lastSeen = this.lastSeenMap.get(h.playerToken);
          if (h.connected && lastSeen && now - lastSeen > DISCONNECT_THRESHOLD_MS) {
            h.connected = false;
            h.disconnectedAt = now;
            changed = true;
          } else if (!h.connected && lastSeen && now - lastSeen <= DISCONNECT_THRESHOLD_MS) {
            h.connected = true;
            h.disconnectedAt = null;
            h.botTakeover = false;
            changed = true;
          }

          if (
            this.snapshot.phase === 'PLAYING' &&
            !h.connected &&
            !h.botTakeover &&
            h.disconnectedAt !== null &&
            now - h.disconnectedAt >= ONLINE_DISCONNECT_GRACE_MS
          ) {
            h.botTakeover = true;
            changed = true;
          }
        }

        if (changed) {
          this.snapshot = { ...this.snapshot, humans: [...this.snapshot.humans], updatedAt: now };
          this.emitSnapshot();
          if (this.isHost) {
            this.broadcastSnapshot();
          }
        }
      }, 1000);
    }

    if (typeof document !== 'undefined' && !this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (!document.hidden && !this.destroyed) {
          this.scheduleNextPoll(80);
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private scheduleNextPoll(delayMs?: number): void {
    if (this.destroyed) return;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    const wait = delayMs ?? this.getAdaptivePollIntervalMs();
    this.pollTimer = setTimeout(() => {
      void this.pollOnce();
    }, wait);
  }

  private async pollOnce(): Promise<void> {
    if (this.destroyed || this.pollInFlight) {
      return;
    }
    this.pollInFlight = true;
    let hadError = false;
    try {
      const hidden = typeof document !== 'undefined' && document.hidden;
      const useLongPoll = !hidden && !this.ablyConnected && !this.hasAllPeersRtcOpen();
      const requestFull = !this.joinResolved && this.joinPollAttempts % 4 === 0;
      if (!this.joinResolved) this.joinPollAttempts += 1;
      const waitMs = requestFull
        ? 0
        : !this.joinResolved
          ? 1500
          : useLongPoll
            ? this.snapshot?.phase === 'PLAYING'
              ? 3000
              : 2500
            : 0;
      const { status, data } = await apiGetRoom(this.roomCode, this.lastSeq, requestFull, waitMs);
      if (this.destroyed) return;

      if (status === 404 || status === 410 || data.phase === 'DISSOLVED') {
        const disEvt = Array.isArray(data.events)
          ? data.events.find((r) => r.packet?.type === 'DISSOLVE_ROOM')?.packet
          : undefined;
        const customReason =
          disEvt && disEvt.type === 'DISSOLVE_ROOM' && disEvt.reason ? disEvt.reason : undefined;
        clearPersistedCoCaNguaSession();
        this.callbacks.onRoomClosed(customReason || data.message || 'Phòng Online đã được giải tán.');
        this.destroy();
        return;
      }

      if (status === 200 && data.ok) {
        if (this.consecutivePollErrors > 0) {
          this.consecutivePollErrors = 0;
          this.callbacks.onStatusChange('READY', `Đã nối lại phòng #${this.roomCode}`);
        }
        this.ingestHeartbeats(data.heartbeats);

        if (typeof data.seq === 'number' && data.seq > this.lastSeq) {
          this.lastSeq = data.seq;
        }

        if (Array.isArray(data.events) && data.events.length > 0) {
          for (const row of data.events) {
            if (this.destroyed) return;
            if (row.packet) {
              this.handleIncomingPacket(row.packet);
            }
          }
        }

        if (!this.joinResolved && data.snapshot) {
          const inHumans = data.snapshot.humans.some((h) => h.playerToken === this.playerToken);
          if (inHumans) {
            this.joinResolved = true;
            this.snapshot = data.snapshot;
            this.callbacks.onStatusChange('READY', `Đã kết nối phòng #${this.roomCode}`);
            this.emitSnapshot();
          }
        }
      }
    } catch {
      hadError = true;
      if (!this.destroyed) {
        this.consecutivePollErrors += 1;
        if (this.consecutivePollErrors >= 2) {
          this.callbacks.onStatusChange('RECONNECTING', 'Mạng hơi chập chờn — đang tự nối lại...');
        }
      }
    } finally {
      this.pollInFlight = false;
      if (!this.destroyed) {
        this.scheduleNextPoll(hadError ? 750 : undefined);
      }
    }
  }

  private ingestHeartbeats(heartbeats?: Record<string, number>): void {
    if (!heartbeats) return;
    for (const [token, rawTs] of Object.entries(heartbeats)) {
      const ts = Number(rawTs);
      if (Number.isFinite(ts) && ts > 0) {
        const prev = this.lastSeenMap.get(token) ?? 0;
        if (ts > prev) this.lastSeenMap.set(token, ts);
      }
    }
  }

  private handleIncomingPacket(packet: WirePacket): void {
    if (packet.senderToken === this.playerToken) return;
    if (this.seenMsgIds.has(packet.msgId)) return;
    this.seenMsgIds.add(packet.msgId);
    if (this.seenMsgIds.size > 400) {
      const oldest = Array.from(this.seenMsgIds).slice(0, 150);
      oldest.forEach((id) => this.seenMsgIds.delete(id));
    }

    this.lastSeenMap.set(packet.senderToken, Date.now());

    switch (packet.type) {
      case 'JOIN_REQUEST': {
        if (!this.isHost || !this.snapshot || packet.roomCode !== this.roomCode) return;
        this.lastSeenMap.set(packet.playerToken, Date.now());

        const existing = this.snapshot.humans.find((h) => h.playerToken === packet.playerToken);
        if (existing) {
          existing.connected = true;
          existing.disconnectedAt = null;
          existing.botTakeover = false;
          this.snapshot = {
            ...this.snapshot,
            humans: this.snapshot.humans.map((h) =>
              h.playerToken === existing.playerToken ? { ...existing } : h,
            ),
            updatedAt: Date.now(),
          };
          this.emitSnapshot();
          this.broadcastSnapshot();
          return;
        }

        if (this.snapshot.phase !== 'LOBBY') {
          this.pushPacket({
            msgId: generateRandomId('rej'),
            senderToken: this.playerToken,
            type: 'JOIN_REJECTED',
            targetToken: packet.playerToken,
            reason: 'Phòng Cờ Cá Ngựa này đã bắt đầu ván chơi!',
          });
          return;
        }

        const maxHumans = Math.max(1, 4 - this.snapshot.botCount);
        if (this.snapshot.humans.length >= maxHumans) {
          // Nếu phòng đang có Bot mà người thật xin vào -> tự động nhường chỗ 1 Bot nếu còn Bot!
          if (this.snapshot.bots.length > 0 && this.snapshot.humans.length < 4) {
            const trimmedBots = this.snapshot.bots.slice(0, this.snapshot.bots.length - 1);
            const allMembers = [...this.snapshot.humans, ...trimmedBots];
            const color = pickBalancedNextColor(allMembers);
            const newHuman: CoCaNguaOnlineMember = {
              playerToken: packet.playerToken,
              color,
              name: packet.name.trim() || `Bạn ${this.snapshot.humans.length + 1}`,
              isHost: false,
              isBot: false,
              connected: true,
              disconnectedAt: null,
              botTakeover: false,
            };
            this.snapshot = {
              ...this.snapshot,
              botCount: trimmedBots.length,
              bots: trimmedBots,
              humans: [...this.snapshot.humans, newHuman],
              updatedAt: Date.now(),
            };
            this.callbacks.onPeerJoined?.(newHuman.name);
            this.emitSnapshot();
            this.broadcastSnapshot();
            return;
          }

          this.pushPacket({
            msgId: generateRandomId('rej'),
            senderToken: this.playerToken,
            type: 'JOIN_REJECTED',
            targetToken: packet.playerToken,
            reason: 'Phòng đã đủ tối đa 4 người chơi!',
          });
          return;
        }

        const allMembers = [...this.snapshot.humans, ...this.snapshot.bots];
        const color = pickBalancedNextColor(allMembers);
        const newHuman: CoCaNguaOnlineMember = {
          playerToken: packet.playerToken,
          color,
          name: packet.name.trim() || `Bạn ${this.snapshot.humans.length + 1}`,
          isHost: false,
          isBot: false,
          connected: true,
          disconnectedAt: null,
          botTakeover: false,
        };

        this.snapshot = {
          ...this.snapshot,
          humans: [...this.snapshot.humans, newHuman],
          updatedAt: Date.now(),
        };
        this.callbacks.onPeerJoined?.(newHuman.name);
        this.emitSnapshot();
        this.broadcastSnapshot();
        break;
      }

      case 'JOIN_REJECTED': {
        if (packet.targetToken !== this.playerToken) return;
        clearPersistedCoCaNguaSession();
        this.callbacks.onStatusChange('ERROR', packet.reason);
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }

      case 'ROOM_SNAPSHOT': {
        if (this.isHost) return;
        const includesMe = packet.snapshot.humans.some((h) => h.playerToken === this.playerToken);
        if (!this.joinResolved && !includesMe) return;

        this.joinResolved = true;
        if (
          this.snapshot?.phase === 'PLAYING' &&
          packet.snapshot.phase === 'PLAYING' &&
          this.snapshot.matchState &&
          packet.snapshot.matchVersion < this.snapshot.matchVersion
        ) {
          this.snapshot = {
            ...packet.snapshot,
            matchState: this.snapshot.matchState,
            matchVersion: this.snapshot.matchVersion,
          };
        } else {
          this.snapshot = packet.snapshot;
        }
        this.callbacks.onStatusChange('READY', `Đã kết nối phòng #${this.roomCode}`);
        this.emitSnapshot();
        break;
      }

      case 'UPDATE_MEMBER': {
        if (!this.isHost || !this.snapshot) return;
        this.applyMemberPatchAsHost(packet.targetToken, packet.patch);
        break;
      }

      case 'ACTION_COMMIT': {
        if (this.seenActionIds.has(packet.actionId)) return;
        this.seenActionIds.add(packet.actionId);
        if (this.seenActionIds.size > 400) {
          const oldest = Array.from(this.seenActionIds).slice(0, 150);
          oldest.forEach((id) => this.seenActionIds.delete(id));
        }

        let resolvedNext = packet.resultingState;
        if (!resolvedNext && this.snapshot?.matchState) {
          const { state: reduced } = reduceCoCaNguaAction(this.snapshot.matchState, packet.action);
          resolvedNext = reduced;
        }
        if (this.snapshot && resolvedNext) {
          this.snapshot = {
            ...this.snapshot,
            phase: 'PLAYING',
            matchState: resolvedNext,
            matchVersion: Math.max(this.snapshot.matchVersion, packet.matchVersion),
            updatedAt: Date.now(),
          };
          if (this.isHost) this.scheduleCheckpoint();
        }

        this.callbacks.onRemoteAction({
          actionId: packet.actionId,
          actorColor: packet.actorColor,
          action: packet.action,
          resultingState: resolvedNext,
          matchVersion: packet.matchVersion,
        });
        break;
      }

      case 'LEAVE_ROOM': {
        if (!this.isHost || !this.snapshot) return;
        if (this.snapshot.phase === 'LOBBY') {
          this.snapshot = {
            ...this.snapshot,
            humans: this.snapshot.humans.filter((h) => h.playerToken !== packet.playerToken),
            updatedAt: Date.now(),
          };
        } else {
          this.snapshot = {
            ...this.snapshot,
            humans: this.snapshot.humans.map((h) =>
              h.playerToken === packet.playerToken
                ? { ...h, connected: false, disconnectedAt: Date.now() }
                : h,
            ),
            updatedAt: Date.now(),
          };
        }
        this.emitSnapshot();
        this.broadcastSnapshot();
        break;
      }

      case 'KICKED': {
        if (packet.targetToken !== this.playerToken) return;
        clearPersistedCoCaNguaSession();
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }

      case 'DISSOLVE_ROOM': {
        clearPersistedCoCaNguaSession();
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }

      case 'RTC_SIGNAL': {
        if (packet.targetToken !== this.playerToken) return;
        void this.handleRtcSignal(packet.senderToken, packet.signal);
        break;
      }
    }
  }

  public updateMember(targetToken: string, patch: { name?: string; color?: HorseColor }): void {
    if (!this.snapshot) return;
    if (this.isHost) {
      this.applyMemberPatchAsHost(targetToken, patch);
      return;
    }
    this.pushPacket({
      msgId: generateRandomId('upd'),
      senderToken: this.playerToken,
      type: 'UPDATE_MEMBER',
      targetToken,
      patch,
    });
  }

  private applyMemberPatchAsHost(
    targetToken: string,
    patch: { name?: string; color?: HorseColor },
  ): void {
    if (!this.snapshot) return;
    const allMembers = [...this.snapshot.humans, ...this.snapshot.bots];
    const target = allMembers.find((m) => m.playerToken === targetToken);
    if (!target) return;

    let nextHumans = this.snapshot.humans.map((h) => ({ ...h }));
    let nextBots = this.snapshot.bots.map((b) => ({ ...b }));

    if (patch.color && patch.color !== target.color) {
      const takenByHuman = nextHumans.find(
        (h) => h.playerToken !== targetToken && h.color === patch.color,
      );
      if (!takenByHuman) {
        const takenByBot = nextBots.find(
          (b) => b.playerToken !== targetToken && b.color === patch.color,
        );
        if (takenByBot) {
          takenByBot.color = target.color;
          const idxStr = takenByBot.playerToken.replace('ccn_bot_', '');
          takenByBot.name = `Máy ${idxStr} (${HORSE_COLOR_CONFIG[target.color].shortName})`;
        }
        nextHumans = nextHumans.map((h) =>
          h.playerToken === targetToken ? { ...h, color: patch.color! } : h,
        );
        nextBots = nextBots.map((b) =>
          b.playerToken === targetToken ? { ...b, color: patch.color! } : b,
        );
      }
    }

    if (patch.name !== undefined) {
      const clean = patch.name.slice(0, 18);
      nextHumans = nextHumans.map((h) => (h.playerToken === targetToken ? { ...h, name: clean } : h));
      nextBots = nextBots.map((b) => (b.playerToken === targetToken ? { ...b, name: clean } : b));
    }

    this.snapshot = {
      ...this.snapshot,
      humans: nextHumans,
      bots: nextBots,
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  public setBotCount(count: number): void {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return;
    const nextBots = buildHorseBotsArray(count, this.snapshot.bots, this.snapshot.humans);
    this.snapshot = {
      ...this.snapshot,
      botCount: nextBots.length,
      bots: nextBots,
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  public setBotDifficulty(difficulty: HorseBotDifficulty): void {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return;
    this.snapshot = {
      ...this.snapshot,
      botDifficulty: difficulty,
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  public kickMember(targetToken: string): void {
    if (!this.isHost || !this.snapshot || targetToken === this.playerToken) return;
    this.snapshot = {
      ...this.snapshot,
      humans: this.snapshot.humans.filter((h) => h.playerToken !== targetToken),
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.pushPacket(
      {
        msgId: generateRandomId('kick'),
        senderToken: this.playerToken,
        type: 'KICKED',
        targetToken,
        reason: 'Chủ phòng đã mời bạn rời khỏi phòng chờ.',
      },
      this.snapshot,
    );
  }

  public startMatch(): CoCaNguaState | null {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return null;
    const activeMembers = [...this.snapshot.humans, ...this.snapshot.bots];
    if (activeMembers.length < 2) return null;

    const initialState = createInitialCoCaNguaState({
      players: activeMembers.map((m) => ({
        color: m.color,
        name: m.name.trim() || `Phe ${HORSE_COLOR_CONFIG[m.color].nameVi}`,
        isBot: m.isBot,
      })),
      roomCode: this.roomCode,
    });

    this.snapshot = {
      ...this.snapshot,
      phase: 'PLAYING',
      matchState: initialState,
      matchVersion: 1,
      updatedAt: Date.now(),
    };

    this.emitSnapshot();
    this.broadcastSnapshot();
    return initialState;
  }

  public broadcastCommittedAction(
    actorColor: HorseColor,
    action: CoCaNguaAction,
    resultingState: CoCaNguaState,
  ): void {
    if (!this.snapshot) return;
    const actionId = generateRandomId('act');
    this.seenActionIds.add(actionId);
    const nextVer = this.snapshot.matchVersion + 1;

    this.snapshot = {
      ...this.snapshot,
      phase: 'PLAYING',
      matchState: resultingState,
      matchVersion: nextVer,
      updatedAt: Date.now(),
    };

    const packet: WirePacket = {
      msgId: generateRandomId('msg'),
      senderToken: this.playerToken,
      type: 'ACTION_COMMIT',
      actionId,
      actorColor,
      action,
      matchVersion: nextVer,
    };

    // Gửi gói Delta ~150 byte tức thì qua Ably/P2P + xếp hàng FIFO có Retry lên Upstash Lua nguyên tử + Checkpoint F5!
    this.pushActionCommitReliable(packet);
    this.scheduleCheckpoint();
  }

  public dissolveOrLeave(reason = 'Phòng Cờ Cá Ngựa Online đã đóng.'): void {
    clearPersistedCoCaNguaSession();
    if (this.isHost) {
      const disPacket: WirePacket = {
        msgId: generateRandomId('dis'),
        senderToken: this.playerToken,
        type: 'DISSOLVE_ROOM',
        reason,
      };
      this.sendOverFastLanes(disPacket);
      void apiPostRoom({
        action: 'dissolve',
        game: GAME_NAMESPACE,
        roomCode: this.roomCode,
        senderToken: this.playerToken,
        packet: disPacket,
      }).catch(() => {});
    } else {
      const lvPacket: WirePacket = {
        msgId: generateRandomId('lv'),
        senderToken: this.playerToken,
        type: 'LEAVE_ROOM',
        playerToken: this.playerToken,
      };
      this.sendOverFastLanes(lvPacket);
      void apiPostRoom({
        action: 'push',
        game: GAME_NAMESPACE,
        roomCode: this.roomCode,
        senderToken: this.playerToken,
        packet: lvPacket,
      }).catch(() => {});
    }
    this.destroy();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.graceCheckTimer !== null) {
      clearInterval(this.graceCheckTimer);
      this.graceCheckTimer = null;
    }
    if (this.checkpointScheduler) {
      this.checkpointScheduler.cancel();
      this.checkpointScheduler = null;
    }
    if (this.ablyLane) {
      this.ablyLane.destroy();
      this.ablyLane = null;
      this.ablyConnected = false;
    }
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.broadcastChan) {
      try {
        this.broadcastChan.close();
      } catch {
        // Ignore
      }
      this.broadcastChan = null;
    }
    for (const peer of this.rtcPeers.values()) {
      try {
        peer.dc?.close();
        peer.pc.close();
      } catch {
        // Ignore
      }
    }
    this.rtcPeers.clear();
  }

  private emitSnapshot(): void {
    if (this.snapshot) {
      this.ensureRtcPeers();
      this.callbacks.onSnapshot({
        ...this.snapshot,
        humans: this.snapshot.humans.map((h) => ({ ...h })),
        bots: this.snapshot.bots.map((b) => ({ ...b })),
      });
    }
  }

  private broadcastSnapshot(): void {
    if (!this.snapshot) return;
    this.pushPacket(
      {
        msgId: generateRandomId('snap'),
        senderToken: this.playerToken,
        type: 'ROOM_SNAPSHOT',
        snapshot: this.snapshot,
      },
      this.snapshot,
    );
  }

  private initFastLanes(): void {
    if (this.destroyed || isFastLaneDisabled()) return;
    if (!this.ablyLane) {
      this.ablyLane = new AblyFastLane({
        game: GAME_NAMESPACE,
        roomCode: this.roomCode,
        clientId: this.playerToken,
        onPacket: (raw) => {
          if (this.destroyed) return;
          const pkt = raw as unknown as WirePacket;
          if (pkt && typeof pkt.msgId === 'string') {
            this.handleIncomingPacket(pkt);
          }
        },
        onAvailabilityChange: (available) => {
          this.ablyConnected = available;
          if (!available && !this.destroyed) {
            this.scheduleNextPoll(25);
          }
        },
      });
      void this.ablyLane.start();
    }
    if (!this.broadcastChan && typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChan = new BroadcastChannel(`bgvn_ccn_fast_${this.roomCode}`);
        this.broadcastChan.onmessage = (ev: MessageEvent) => {
          if (this.destroyed) return;
          const pkt = ev?.data as WirePacket | undefined;
          if (pkt && typeof pkt.msgId === 'string') {
            this.handleIncomingPacket(pkt);
          }
        };
      } catch {
        this.broadcastChan = null;
      }
    }
    this.ensureRtcPeers();
  }

  private ensureRtcPeers(): void {
    if (this.destroyed || isFastLaneDisabled() || !this.snapshot || typeof RTCPeerConnection === 'undefined') return;
    const activeTokens = new Set<string>();
    for (const h of this.snapshot.humans) {
      if (h.playerToken === this.playerToken || !h.connected) continue;
      activeTokens.add(h.playerToken);
      if (this.playerToken < h.playerToken && !this.rtcPeers.has(h.playerToken)) {
        this.getOrCreateRtcPeer(h.playerToken, true);
      }
    }

    for (const [token, peer] of this.rtcPeers.entries()) {
      if (!activeTokens.has(token)) {
        try {
          peer.dc?.close();
          peer.pc.close();
        } catch {
          // Ignore
        }
        this.rtcPeers.delete(token);
      }
    }
  }

  private getOrCreateRtcPeer(remoteToken: string, isInitiator: boolean): PeerChannelState | null {
    if (typeof RTCPeerConnection === 'undefined' || this.destroyed) return null;
    const existing = this.rtcPeers.get(remoteToken);
    if (existing) return existing;

    try {
      const pc = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
      const state: PeerChannelState = {
        pc,
        dc: null,
        makingOffer: false,
        pendingCandidates: [],
      };
      this.rtcPeers.set(remoteToken, state);

      const attachChannel = (dc: RTCDataChannel) => {
        state.dc = dc;
        dc.onmessage = (ev: MessageEvent) => {
          if (this.destroyed) return;
          try {
            const pkt = JSON.parse(String(ev.data)) as WirePacket;
            if (pkt && typeof pkt.msgId === 'string') {
              this.handleIncomingPacket(pkt);
            }
          } catch {
            // Ignore malformed P2P payload
          }
        };
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate && !this.destroyed) {
          this.sendRtcSignal(remoteToken, {
            kind: 'candidate',
            candidate: ev.candidate.toJSON(),
          });
        }
      };

      pc.ondatachannel = (ev) => {
        attachChannel(ev.channel);
      };

      if (isInitiator) {
        const dc = pc.createDataChannel('bgvn-ccn-fast', { ordered: true });
        attachChannel(dc);
        state.makingOffer = true;
        void pc
          .createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (!this.destroyed && pc.localDescription?.sdp) {
              this.sendRtcSignal(remoteToken, {
                kind: 'offer',
                sdp: pc.localDescription.sdp,
              });
            }
          })
          .catch(() => {})
          .finally(() => {
            state.makingOffer = false;
          });
      }

      return state;
    } catch {
      return null;
    }
  }

  private async handleRtcSignal(remoteToken: string, signal: RtcSignalPayload): Promise<void> {
    const peer = this.getOrCreateRtcPeer(remoteToken, false);
    if (!peer || this.destroyed) return;
    const { pc } = peer;

    try {
      if (signal.kind === 'offer' && signal.sdp) {
        if (pc.signalingState !== 'stable' || peer.makingOffer) return;
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        while (peer.pendingCandidates.length > 0) {
          const cand = peer.pendingCandidates.shift();
          if (cand) await pc.addIceCandidate(cand).catch(() => {});
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (!this.destroyed && pc.localDescription?.sdp) {
          this.sendRtcSignal(remoteToken, {
            kind: 'answer',
            sdp: pc.localDescription.sdp,
          });
        }
      } else if (signal.kind === 'answer' && signal.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
          while (peer.pendingCandidates.length > 0) {
            const cand = peer.pendingCandidates.shift();
            if (cand) await pc.addIceCandidate(cand).catch(() => {});
          }
        }
      } else if (signal.kind === 'candidate' && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.candidate);
        } else if (peer.pendingCandidates.length < 32) {
          peer.pendingCandidates.push(signal.candidate);
        }
      }
    } catch {
      // Nếu NAT chặn WebRTC, luồng Singapore Redis (sin1) vẫn chạy song song 100%
    }
  }

  private sendRtcSignal(targetToken: string, signal: RtcSignalPayload): void {
    const pkt: WirePacket = {
      msgId: generateRandomId('rtc'),
      senderToken: this.playerToken,
      type: 'RTC_SIGNAL',
      targetToken,
      signal,
    };
    this.pushFastEventOnly(pkt, true);
  }

  private sendOverFastLanes(packet: WirePacket): void {
    if (this.destroyed) return;
    if (this.ablyLane?.isAvailable()) {
      this.ablyLane.publish(packet as unknown as Record<string, unknown>);
    }
    if (this.broadcastChan) {
      try {
        this.broadcastChan.postMessage(packet);
      } catch {
        // Ignore
      }
    }
    if (this.rtcPeers.size > 0) {
      let raw: string | null = null;
      for (const peer of this.rtcPeers.values()) {
        if (peer.dc && peer.dc.readyState === 'open') {
          try {
            if (raw === null) raw = JSON.stringify(packet);
            peer.dc.send(raw);
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  private pushActionCommitReliable(packet: WirePacket): void {
    if (this.destroyed) return;
    this.seenMsgIds.add(packet.msgId);
    this.sendOverFastLanes(packet);

    this.actionPushChain = this.actionPushChain
      .then(async () => {
        if (this.destroyed) return;
        const res = await postWithRetry(
          () =>
            apiPostRoom({
              action: 'push',
              game: GAME_NAMESPACE,
              roomCode: this.roomCode,
              senderToken: this.playerToken,
              packet,
            }),
          () => this.destroyed,
        );
        if (!res || this.destroyed) return;
        if (typeof res.data.seq === 'number' && res.data.seq === this.lastSeq + 1) {
          this.lastSeq = res.data.seq;
        }
      })
      .catch(() => {});
  }

  private pushFastEventOnly(packet: WirePacket, alsoSendToRedis = true): void {
    if (this.destroyed) return;
    this.seenMsgIds.add(packet.msgId);
    this.sendOverFastLanes(packet);
    if (!alsoSendToRedis) return;

    void apiPostRoom({
      action: 'push',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
      packet,
    })
      .then(({ data }) => {
        if (!this.destroyed && typeof data.seq === 'number' && data.seq === this.lastSeq + 1) {
          this.lastSeq = data.seq;
        }
      })
      .catch(() => {});
  }

  private pushPacket(packet: WirePacket, snapshotToStore?: CoCaNguaRoomSnapshot): void {
    if (this.destroyed) return;
    this.seenMsgIds.add(packet.msgId);

    this.sendOverFastLanes(packet);

    const snapshotClone = snapshotToStore ? structuredClone(snapshotToStore) : undefined;
    this.pushChain = this.pushChain
      .then(async () => {
        if (this.destroyed) return;
        const { data } = await apiPostRoom({
          action: 'push',
          game: GAME_NAMESPACE,
          roomCode: this.roomCode,
          senderToken: this.playerToken,
          packet,
          snapshot: snapshotClone,
          phase: snapshotClone?.phase,
        });
        if (!this.destroyed && typeof data.seq === 'number' && data.seq === this.lastSeq + 1) {
          this.lastSeq = data.seq;
        }
        if (!this.destroyed) {
          this.scheduleNextPoll(80);
        }
      })
      .catch(() => {});
  }
}
