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
import { createInitialOAnQuanState, executeSowMove } from '../engine/reducer';
import type {
  CharacterId,
  OAnQuanState,
  PlayerSide,
  SowDirection,
} from '../engine/types';

export const ONLINE_DISCONNECT_GRACE_MS = 120_000; // 2 phút giữ ghế khi rớt mạng/F5
const GAME_NAMESPACE = 'o-an-quan';
const SESSION_STORAGE_KEY = 'bgvn_oanquan_online_session_v1';
const HEARTBEAT_INTERVAL_MS = 10_000;
const DISCONNECT_THRESHOLD_MS = 26_000;

export interface OAnQuanOnlineMember {
  playerToken: string;
  side: PlayerSide; // 0: Chủ phòng (Phe Dưới chuẩn), 1: Khách (Phe Trên chuẩn — tự xoay POV 180° trên máy Khách!)
  name: string;
  characterId: CharacterId;
  isHost: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  botTakeover: boolean;
}

export interface OAnQuanRoomSnapshot {
  roomCode: string;
  phase: 'LOBBY' | 'PLAYING' | 'DISSOLVED';
  hostToken: string;
  mandarinPointValue: 5 | 10;
  mandarinYouthRule: boolean;
  startingSide: PlayerSide;
  members: OAnQuanOnlineMember[]; // Tối đa 2 người chơi
  matchState: OAnQuanState | null;
  matchVersion: number;
  updatedAt: number;
}

export interface PersistedOAnQuanSession {
  roomCode: string;
  playerToken: string;
  playerName: string;
  isHost: boolean;
  savedAt: number;
}

export interface RemoteOAnQuanMoveEvent {
  moveId: string;
  side: PlayerSide;
  pitIndex: number;
  direction: SowDirection;
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
      snapshot: OAnQuanRoomSnapshot;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'UPDATE_MEMBER';
      targetToken: string;
      patch: { name?: string; characterId?: CharacterId };
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'MOVE_COMMIT';
      moveId: string;
      side: PlayerSide;
      pitIndex: number;
      direction: SowDirection;
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
  message?: string;
  rejoined?: boolean;
  roomCode?: string;
  phase?: 'LOBBY' | 'PLAYING' | 'DISSOLVED';
  hostToken?: string;
  seq?: number;
  snapshot?: OAnQuanRoomSnapshot | null;
  heartbeats?: Record<string, number>;
  events?: ApiEventRow[];
  storageMode?: 'upstash' | 'memory';
}

const RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

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

export function generateOAnQuanRoomCode(): string {
  return String(cryptoRandomInt(100000, 999999));
}

export function getOrCreateOAnQuanToken(): string {
  if (typeof window === 'undefined') return generateRandomId('oaq');
  const existing = window.sessionStorage.getItem('bgvn_oanquan_player_token');
  if (existing && existing.length >= 8) return existing;
  const fresh = generateRandomId('oaq');
  window.sessionStorage.setItem('bgvn_oanquan_player_token', fresh);
  return fresh;
}

export function savePersistedOAnQuanSession(session: PersistedOAnQuanSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore
  }
}

export function loadPersistedOAnQuanSession(): PersistedOAnQuanSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedOAnQuanSession;
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

export function clearPersistedOAnQuanSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
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

export interface OAnQuanRoomCallbacks {
  onSnapshot: (snapshot: OAnQuanRoomSnapshot) => void;
  onStatusChange: (status: OnlineTransportStatus, message: string) => void;
  onRemoteMove: (event: RemoteOAnQuanMoveEvent) => void;
  onRoomClosed: (reason: string) => void;
  onPeerJoined?: (memberName: string) => void;
}

/**
 * Kết nối phòng Online 2 người chơi cho Ô Ăn Quan:
 * - Chạy song song WebRTC P2P RTCDataChannel (~15ms) + BroadcastChannel (<2ms) + Vercel Singapore sin1 Redis (180ms).
 * - Gửi duy nhất hành động hợp lệ { side, pitIndex, direction } để máy nhận tự xác thực qua validateSowAction.
 */
export class OAnQuanOnlineClient {
  public roomCode: string;
  public readonly playerToken: string;
  public isHost: boolean;

  private callbacks: OAnQuanRoomCallbacks;
  private seenMsgIds = new Set<string>();
  private seenMoveIds = new Set<string>();
  private lastSeenMap = new Map<string, number>();
  private lastSeq = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private graceCheckTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;
  private consecutivePollErrors = 0;
  private destroyed = false;
  private snapshot: OAnQuanRoomSnapshot | null = null;
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
    callbacks: OAnQuanRoomCallbacks;
  }) {
    this.roomCode = options.roomCode;
    this.playerToken = options.playerToken;
    this.localName = options.playerName.trim() || (options.isHost ? 'Cu Tí' : 'Bé Mít');
    this.isHost = options.isHost;
    this.callbacks = options.callbacks;
  }

  public getSnapshot(): OAnQuanRoomSnapshot | null {
    return this.snapshot;
  }

  public async startAsHost(): Promise<string> {
    this.callbacks.onStatusChange('CONNECTING', 'Đang khởi tạo phòng Ô Ăn Quan...');

    const hostMember: OAnQuanOnlineMember = {
      playerToken: this.playerToken,
      side: 0,
      name: this.localName,
      characterId: 'cu_ti',
      isHost: true,
      connected: true,
      disconnectedAt: null,
      botTakeover: false,
    };

    const draft: OAnQuanRoomSnapshot = {
      roomCode: this.roomCode,
      phase: 'LOBBY',
      hostToken: this.playerToken,
      mandarinPointValue: 10,
      mandarinYouthRule: false,
      startingSide: 0,
      members: [hostMember],
      matchState: null,
      matchVersion: 0,
      updatedAt: Date.now(),
    };

    const { status, data } = await apiPostRoom({
      action: 'create',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
      snapshot: draft,
    });

    if (status !== 200 || !data.ok || !data.roomCode) {
      const msg = data.message || 'Không thể khởi tạo phòng Online. Vui lòng thử lại!';
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.roomCode = data.roomCode;
    this.lastSeq = data.seq ?? 1;
    this.snapshot = (data.snapshot as OAnQuanRoomSnapshot) ?? { ...draft, roomCode: this.roomCode };
    this.joinResolved = true;

    this.persistSession();
    this.callbacks.onStatusChange(
      'READY',
      data.storageMode === 'upstash'
        ? 'Trực tuyến · Sẵn sàng kết nối khác mạng 4G/Wi-Fi'
        : 'Trực tuyến · Máy chủ phòng cục bộ sẵn sàng',
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
        `Không tìm thấy phòng #${this.roomCode}. Kiểm tra lại mã 6 số hoặc đảm bảo Chủ phòng đang mở phòng.`;
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.lastSeq = data.seq ?? 0;
    this.ingestHeartbeats(data.heartbeats);

    if (data.rejoined && data.snapshot) {
      this.isHost = data.hostToken === this.playerToken;
      this.snapshot = this.replayMissedMovesIntoSnapshot(data.snapshot, data.events);
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
      const timer = setInterval(() => {
        if (this.destroyed) {
          clearInterval(timer);
          reject(new Error('Kết nối phòng đã bị đóng.'));
          return;
        }
        if (this.joinResolved && this.snapshot) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - started > 12_000) {
          clearInterval(timer);
          const msg = `Phòng #${this.roomCode} tồn tại nhưng Chủ phòng chưa phản hồi.`;
          this.callbacks.onStatusChange('ERROR', msg);
          reject(new Error(msg));
        }
      }, 140);
    });
  }

  public async rejoinExistingRoom(): Promise<OAnQuanRoomSnapshot> {
    this.callbacks.onStatusChange('RECONNECTING', `Đang khôi phục phòng #${this.roomCode}...`);
    const { status, data } = await apiPostRoom({
      action: 'rejoin',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
    });

    if (status !== 200 || !data.ok || !data.snapshot) {
      const msg = data.message || `Phòng #${this.roomCode} đã đóng hoặc hết thời gian chờ.`;
      clearPersistedOAnQuanSession();
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.isHost = data.hostToken === this.playerToken;
    this.snapshot = this.replayMissedMovesIntoSnapshot(data.snapshot, data.events);
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

  private replayMissedMovesIntoSnapshot(
    snap: OAnQuanRoomSnapshot,
    events?: ApiEventRow[],
  ): OAnQuanRoomSnapshot {
    if (!snap.matchState || !Array.isArray(events) || events.length === 0) return snap;
    let state = snap.matchState;
    let ver = snap.matchVersion;
    for (const row of events) {
      const pkt = row?.packet;
      if (!pkt || pkt.type !== 'MOVE_COMMIT' || pkt.matchVersion <= ver) continue;
      if (this.seenMoveIds.has(pkt.moveId)) continue;
      this.seenMoveIds.add(pkt.moveId);
      const { state: next } = executeSowMove(state, pkt.pitIndex, pkt.direction, pkt.side);
      state = next;
      ver = pkt.matchVersion;
    }
    return { ...snap, matchState: state, matchVersion: ver };
  }

  private hasAllPeersRtcOpen(): boolean {
    if (!this.snapshot) return false;
    const remoteTokens = this.snapshot.members
      .filter((m) => m.playerToken !== this.playerToken && m.connected)
      .map((m) => m.playerToken);
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
    savePersistedOAnQuanSession({
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
              clearPersistedOAnQuanSession();
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

        for (const m of this.snapshot.members) {
          if (m.playerToken === this.playerToken) continue;
          const lastSeen = this.lastSeenMap.get(m.playerToken);
          if (m.connected && lastSeen && now - lastSeen > DISCONNECT_THRESHOLD_MS) {
            m.connected = false;
            m.disconnectedAt = now;
            changed = true;
          } else if (!m.connected && lastSeen && now - lastSeen <= DISCONNECT_THRESHOLD_MS) {
            m.connected = true;
            m.disconnectedAt = null;
            m.botTakeover = false;
            changed = true;
          }
          if (
            this.snapshot.phase === 'PLAYING' &&
            !m.connected &&
            !m.botTakeover &&
            m.disconnectedAt !== null &&
            now - m.disconnectedAt >= ONLINE_DISCONNECT_GRACE_MS
          ) {
            m.botTakeover = true;
            changed = true;
          }
        }

        if (changed) {
          this.snapshot = { ...this.snapshot, members: [...this.snapshot.members], updatedAt: now };
          this.emitSnapshot();
          if (this.isHost) this.broadcastSnapshot();
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
    this.pollTimer = setTimeout(() => {
      void this.pollOnce();
    }, delayMs ?? this.getAdaptivePollIntervalMs());
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
        clearPersistedOAnQuanSession();
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
            if (row.packet) this.handleIncomingPacket(row.packet);
          }
        }
        if (!this.joinResolved && data.snapshot) {
          if (data.snapshot.members.some((m) => m.playerToken === this.playerToken)) {
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
      if (!this.destroyed) this.scheduleNextPoll(hadError ? 750 : undefined);
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
    if (this.seenMsgIds.size > 300) {
      Array.from(this.seenMsgIds)
        .slice(0, 120)
        .forEach((id) => this.seenMsgIds.delete(id));
    }

    this.lastSeenMap.set(packet.senderToken, Date.now());

    switch (packet.type) {
      case 'JOIN_REQUEST': {
        if (!this.isHost || !this.snapshot || packet.roomCode !== this.roomCode) return;
        this.lastSeenMap.set(packet.playerToken, Date.now());

        const existing = this.snapshot.members.find((m) => m.playerToken === packet.playerToken);
        if (existing) {
          existing.connected = true;
          existing.disconnectedAt = null;
          existing.botTakeover = false;
          this.snapshot = {
            ...this.snapshot,
            members: this.snapshot.members.map((m) =>
              m.playerToken === existing.playerToken ? { ...existing } : m,
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
            reason: 'Phòng Ô Ăn Quan này đã bắt đầu ván đấu!',
          });
          return;
        }

        if (this.snapshot.members.length >= 2) {
          this.pushPacket({
            msgId: generateRandomId('rej'),
            senderToken: this.playerToken,
            type: 'JOIN_REJECTED',
            targetToken: packet.playerToken,
            reason: 'Phòng Ô Ăn Quan đã đủ 2 người chơi.',
          });
          return;
        }

        const hostChar = this.snapshot.members[0]?.characterId ?? 'cu_ti';
        const guestChar: CharacterId = hostChar === 'cu_ti' ? 'be_mit' : 'cu_ti';
        const newGuest: OAnQuanOnlineMember = {
          playerToken: packet.playerToken,
          side: 1,
          name: packet.name.trim() || 'Bé Mít',
          characterId: guestChar,
          isHost: false,
          connected: true,
          disconnectedAt: null,
          botTakeover: false,
        };

        this.snapshot = {
          ...this.snapshot,
          members: [...this.snapshot.members, newGuest],
          updatedAt: Date.now(),
        };
        this.callbacks.onPeerJoined?.(newGuest.name);
        this.emitSnapshot();
        this.broadcastSnapshot();
        break;
      }

      case 'JOIN_REJECTED': {
        if (packet.targetToken !== this.playerToken) return;
        clearPersistedOAnQuanSession();
        this.callbacks.onStatusChange('ERROR', packet.reason);
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }

      case 'ROOM_SNAPSHOT': {
        if (this.isHost) return;
        const includesMe = packet.snapshot.members.some((m) => m.playerToken === this.playerToken);
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

      case 'MOVE_COMMIT': {
        if (this.seenMoveIds.has(packet.moveId)) return;
        this.seenMoveIds.add(packet.moveId);
        if (this.snapshot?.matchState) {
          const { state: next } = executeSowMove(
            this.snapshot.matchState,
            packet.pitIndex,
            packet.direction,
            packet.side,
          );
          this.snapshot = {
            ...this.snapshot,
            phase: 'PLAYING',
            matchState: next,
            matchVersion: Math.max(this.snapshot.matchVersion, packet.matchVersion),
            updatedAt: Date.now(),
          };
          if (this.isHost) this.scheduleCheckpoint();
        }
        this.callbacks.onRemoteMove({
          moveId: packet.moveId,
          side: packet.side,
          pitIndex: packet.pitIndex,
          direction: packet.direction,
          matchVersion: packet.matchVersion,
        });
        break;
      }

      case 'RTC_SIGNAL': {
        if (packet.targetToken !== this.playerToken) return;
        void this.handleRtcSignal(packet.senderToken, packet.signal);
        break;
      }

      case 'LEAVE_ROOM': {
        if (!this.isHost || !this.snapshot) return;
        if (this.snapshot.phase === 'LOBBY') {
          this.snapshot = {
            ...this.snapshot,
            members: this.snapshot.members.filter((m) => m.playerToken !== packet.playerToken),
            updatedAt: Date.now(),
          };
        } else {
          this.snapshot = {
            ...this.snapshot,
            members: this.snapshot.members.map((m) =>
              m.playerToken === packet.playerToken
                ? { ...m, connected: false, disconnectedAt: Date.now() }
                : m,
            ),
            updatedAt: Date.now(),
          };
        }
        this.emitSnapshot();
        this.broadcastSnapshot();
        break;
      }

      case 'DISSOLVE_ROOM': {
        clearPersistedOAnQuanSession();
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }
    }
  }

  public updateMember(targetToken: string, patch: { name?: string; characterId?: CharacterId }): void {
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
    patch: { name?: string; characterId?: CharacterId },
  ): void {
    if (!this.snapshot) return;
    const nextMembers = this.snapshot.members.map((m) => ({ ...m }));
    const target = nextMembers.find((m) => m.playerToken === targetToken);
    if (!target) return;

    if (patch.name !== undefined) {
      target.name = patch.name.slice(0, 18);
    }
    if (patch.characterId && patch.characterId !== target.characterId) {
      const other = nextMembers.find((m) => m.playerToken !== targetToken);
      if (other && other.characterId === patch.characterId) {
        other.characterId = target.characterId;
      }
      target.characterId = patch.characterId;
    }

    this.snapshot = { ...this.snapshot, members: nextMembers, updatedAt: Date.now() };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  public updateRoomRules(patch: {
    mandarinPointValue?: 5 | 10;
    mandarinYouthRule?: boolean;
    startingSide?: PlayerSide;
  }): void {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return;
    this.snapshot = {
      ...this.snapshot,
      mandarinPointValue: patch.mandarinPointValue ?? this.snapshot.mandarinPointValue ?? 10,
      mandarinYouthRule: patch.mandarinYouthRule ?? this.snapshot.mandarinYouthRule,
      startingSide: patch.startingSide ?? this.snapshot.startingSide,
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  public startMatch(): OAnQuanState | null {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return null;
    if (this.snapshot.members.length < 2) return null;

    const m0 = this.snapshot.members.find((m) => m.side === 0) ?? this.snapshot.members[0];
    const m1 = this.snapshot.members.find((m) => m.side === 1) ?? this.snapshot.members[1];

    const initialState = createInitialOAnQuanState({
      player0: { name: m0.name, characterId: m0.characterId, isBot: false },
      player1: { name: m1.name, characterId: m1.characterId, isBot: false },
      startingSide: this.snapshot.startingSide,
      rules: {
        mandarinPointValue: this.snapshot.mandarinPointValue === 5 ? 5 : 10,
        mandarinYouthRule: this.snapshot.mandarinYouthRule,
        minStonesForMandarin: 5,
      },
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

  public broadcastCommittedMove(
    side: PlayerSide,
    pitIndex: number,
    direction: SowDirection,
    resultingState: OAnQuanState,
  ): void {
    if (!this.snapshot) return;
    const moveId = generateRandomId('mv');
    this.seenMoveIds.add(moveId);
    const nextVer = this.snapshot.matchVersion + 1;

    this.snapshot = {
      ...this.snapshot,
      phase: 'PLAYING',
      matchState: resultingState,
      matchVersion: nextVer,
      updatedAt: Date.now(),
    };

    const pkt: WirePacket = {
      msgId: generateRandomId('msg'),
      senderToken: this.playerToken,
      type: 'MOVE_COMMIT',
      moveId,
      side,
      pitIndex,
      direction,
      matchVersion: nextVer,
    };

    this.pushActionCommitReliable(pkt);
    this.scheduleCheckpoint();
  }

  public syncVerifiedStateAfterRemoteMove(verifiedState: OAnQuanState, matchVersion: number): void {
    if (!this.snapshot) return;
    this.snapshot = {
      ...this.snapshot,
      phase: 'PLAYING',
      matchState: verifiedState,
      matchVersion: Math.max(this.snapshot.matchVersion, matchVersion),
      updatedAt: Date.now(),
    };
    if (this.isHost) this.scheduleCheckpoint();
  }

  public dissolveOrLeave(reason = 'Phòng Ô Ăn Quan Online đã kết thúc.'): void {
    clearPersistedOAnQuanSession();
    if (this.isHost) {
      const pkt: WirePacket = {
        msgId: generateRandomId('dis'),
        senderToken: this.playerToken,
        type: 'DISSOLVE_ROOM',
        reason,
      };
      this.sendOverFastLanes(pkt);
      void apiPostRoom({
        action: 'dissolve',
        game: GAME_NAMESPACE,
        roomCode: this.roomCode,
        senderToken: this.playerToken,
        packet: pkt,
      }).catch(() => {});
    } else {
      const pkt: WirePacket = {
        msgId: generateRandomId('lv'),
        senderToken: this.playerToken,
        type: 'LEAVE_ROOM',
        playerToken: this.playerToken,
      };
      this.sendOverFastLanes(pkt);
      void apiPostRoom({
        action: 'push',
        game: GAME_NAMESPACE,
        roomCode: this.roomCode,
        senderToken: this.playerToken,
        packet: pkt,
      }).catch(() => {});
    }
    this.destroy();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    if (this.graceCheckTimer !== null) clearInterval(this.graceCheckTimer);
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
    }
    try {
      this.broadcastChan?.close();
    } catch {
      // Ignore
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
        members: this.snapshot.members.map((m) => ({ ...m })),
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
        this.broadcastChan = new BroadcastChannel(`bgvn_oaq_fast_${this.roomCode}`);
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
    for (const m of this.snapshot.members) {
      if (m.playerToken === this.playerToken || !m.connected) continue;
      activeTokens.add(m.playerToken);
      if (this.playerToken < m.playerToken && !this.rtcPeers.has(m.playerToken)) {
        this.getOrCreateRtcPeer(m.playerToken, true);
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
            if (pkt && typeof pkt.msgId === 'string') this.handleIncomingPacket(pkt);
          } catch {
            // Ignore
          }
        };
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate && !this.destroyed) {
          this.sendRtcSignal(remoteToken, { kind: 'candidate', candidate: ev.candidate.toJSON() });
        }
      };
      pc.ondatachannel = (ev) => attachChannel(ev.channel);

      if (isInitiator) {
        const dc = pc.createDataChannel('bgvn-oaq-fast', { ordered: true });
        attachChannel(dc);
        state.makingOffer = true;
        void pc
          .createOffer()
          .then((o) => pc.setLocalDescription(o))
          .then(() => {
            if (!this.destroyed && pc.localDescription?.sdp) {
              this.sendRtcSignal(remoteToken, { kind: 'offer', sdp: pc.localDescription.sdp });
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
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        if (!this.destroyed && pc.localDescription?.sdp) {
          this.sendRtcSignal(remoteToken, { kind: 'answer', sdp: pc.localDescription.sdp });
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
      // Fallback Redis Singapore vẫn bảo đảm 100%
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
    this.seenMsgIds.add(pkt.msgId);
    this.sendOverFastLanes(pkt);
    void apiPostRoom({
      action: 'push',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
      packet: pkt,
    }).catch(() => {});
  }

  private sendOverFastLanes(packet: WirePacket): void {
    if (this.destroyed) return;
    if (this.ablyLane?.isAvailable()) {
      this.ablyLane.publish(packet as unknown as Record<string, unknown>);
    }
    try {
      this.broadcastChan?.postMessage(packet);
    } catch {
      // Ignore
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

  private pushPacket(packet: WirePacket, snapshotToStore?: OAnQuanRoomSnapshot): void {
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
        if (!this.destroyed) this.scheduleNextPoll(80);
      })
      .catch(() => {});
  }
}
