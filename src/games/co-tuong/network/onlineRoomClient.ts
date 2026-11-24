import { cryptoRandomInt } from '@/shared/crypto/random';
import { isFastLaneDisabled } from '@/shared/network/onlineTransportConfig';
import { createInitialXiangqiState, reduceXiangqiAction } from '../engine/reducer';
import type { XiangqiAction, XiangqiColor, XiangqiState } from '../engine/types';

export const ONLINE_DISCONNECT_GRACE_MS = 120_000;
const GAME_NAMESPACE = 'co-tuong';
const SESSION_STORAGE_KEY = 'bgvn_cotuong_online_session_v1';
const TOKEN_STORAGE_KEY = 'bgvn_cotuong_player_token';
const HEARTBEAT_INTERVAL_MS = 10_000;
const DISCONNECT_THRESHOLD_MS = 26_000;

export interface XiangqiOnlineMember {
  playerToken: string;
  color: XiangqiColor;
  name: string;
  isHost: boolean;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface XiangqiRoomSnapshot {
  roomCode: string;
  phase: 'LOBBY' | 'PLAYING' | 'DISSOLVED';
  hostToken: string;
  humans: XiangqiOnlineMember[];
  matchState: XiangqiState | null;
  matchVersion: number;
  updatedAt: number;
}

export interface PersistedXiangqiSession {
  roomCode: string;
  playerToken: string;
  playerName: string;
  isHost: boolean;
  savedAt: number;
}

export interface RemoteXiangqiActionEvent {
  actionId: string;
  action: XiangqiAction;
  resultingState?: XiangqiState;
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
  | { msgId: string; senderToken: string; type: 'JOIN_REJECTED'; targetToken: string; reason: string }
  | { msgId: string; senderToken: string; type: 'ROOM_SNAPSHOT'; snapshot: XiangqiRoomSnapshot }
  | {
      msgId: string;
      senderToken: string;
      type: 'ACTION_COMMIT';
      actionId: string;
      action: XiangqiAction;
      resultingState?: XiangqiState;
      matchVersion: number;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'RTC_SIGNAL';
      targetToken: string;
      signal: RtcSignalPayload;
    }
  | { msgId: string; senderToken: string; type: 'LEAVE_ROOM'; playerToken: string }
  | { msgId: string; senderToken: string; type: 'DISSOLVE_ROOM'; reason: string };

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
  snapshot?: XiangqiRoomSnapshot | null;
  heartbeats?: Record<string, number>;
  events?: ApiEventRow[];
  storageMode?: 'upstash' | 'memory';
}

function generateRandomId(prefix: string): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}_${Date.now().toString(36)}`;
}

export function generateXiangqiRoomCode(): string {
  return String(cryptoRandomInt(100000, 999999));
}

export function getOrCreateXiangqiToken(): string {
  if (typeof window === 'undefined') return generateRandomId('ct');
  const existing = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (existing && existing.length >= 8) return existing;
  const fresh = generateRandomId('ct');
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, fresh);
  return fresh;
}

export function savePersistedXiangqiSession(session: PersistedXiangqiSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore
  }
}

export function loadPersistedXiangqiSession(): PersistedXiangqiSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedXiangqiSession;
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

export function clearPersistedXiangqiSession(): void {
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
  const qs = new URLSearchParams({ game: GAME_NAMESPACE, code, sinceSeq: String(sinceSeq) });
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

export interface XiangqiOnlineCallbacks {
  onSnapshot: (snapshot: XiangqiRoomSnapshot) => void;
  onStatusChange: (status: OnlineTransportStatus, message: string) => void;
  onRemoteAction: (event: RemoteXiangqiActionEvent) => void;
  onRoomClosed: (reason: string) => void;
  onPeerJoined?: (memberName: string) => void;
}

const RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

export class XiangqiOnlineClient {
  public roomCode: string;
  public readonly playerToken: string;
  public isHost: boolean;

  private callbacks: XiangqiOnlineCallbacks;
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
  private snapshot: XiangqiRoomSnapshot | null = null;
  private localName: string;
  private joinResolved = false;
  private visibilityHandler: (() => void) | null = null;
  private pushChain: Promise<void> = Promise.resolve();
  private broadcastChan: BroadcastChannel | null = null;
  private rtcPeers = new Map<string, PeerChannelState>();
  private checkpointTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: {
    roomCode: string;
    playerToken: string;
    playerName: string;
    isHost: boolean;
    callbacks: XiangqiOnlineCallbacks;
  }) {
    this.roomCode = options.roomCode;
    this.playerToken = options.playerToken;
    this.localName = options.playerName.trim() || (options.isHost ? 'Chủ Phòng' : 'Kỳ Thủ');
    this.isHost = options.isHost;
    this.callbacks = options.callbacks;
  }

  public getSnapshot(): XiangqiRoomSnapshot | null {
    return this.snapshot;
  }

  public async startAsHost(): Promise<string> {
    this.callbacks.onStatusChange('CONNECTING', 'Đang khởi tạo phòng Cờ Tướng...');
    const hostMember: XiangqiOnlineMember = {
      playerToken: this.playerToken,
      color: 'red',
      name: this.localName,
      isHost: true,
      connected: true,
      disconnectedAt: null,
    };

    const draftSnapshot: XiangqiRoomSnapshot = {
      roomCode: this.roomCode,
      phase: 'LOBBY',
      hostToken: this.playerToken,
      humans: [hostMember],
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
      const msg = data.message || 'Không thể tạo phòng Cờ Tướng Online.';
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.roomCode = data.roomCode;
    this.lastSeq = data.seq ?? 1;
    this.snapshot = (data.snapshot as XiangqiRoomSnapshot) ?? { ...draftSnapshot, roomCode: this.roomCode };
    this.joinResolved = true;
    this.persistSession();
    this.callbacks.onStatusChange(
      'READY',
      data.storageMode === 'upstash' ? 'Trực tuyến · Sẵn sàng 4G/Wi-Fi' : 'Trực tuyến · Phòng sẵn sàng',
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
      const msg = data.message || `Không tìm thấy phòng #${this.roomCode}.`;
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
          const msg = `Phòng #${this.roomCode} không phản hồi từ Chủ phòng.`;
          this.callbacks.onStatusChange('ERROR', msg);
          reject(new Error(msg));
        }
      }, 140);
    });
  }

  public async rejoinExistingRoom(): Promise<XiangqiRoomSnapshot> {
    this.callbacks.onStatusChange('RECONNECTING', `Đang khôi phục phòng #${this.roomCode}...`);
    const { status, data } = await apiPostRoom({
      action: 'rejoin',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
    });

    if (status !== 200 || !data.ok || !data.snapshot) {
      const msg = data.message || `Phòng #${this.roomCode} đã đóng.`;
      clearPersistedXiangqiSession();
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
    if (this.isHost) this.scheduleCheckpoint(150);
    return this.snapshot;
  }

  private replayMissedActionsIntoSnapshot(
    snap: XiangqiRoomSnapshot,
    events?: ApiEventRow[],
  ): XiangqiRoomSnapshot {
    if (!snap.matchState || !Array.isArray(events) || events.length === 0) return snap;
    let state = snap.matchState;
    let ver = snap.matchVersion;
    for (const row of events) {
      const pkt = row?.packet;
      if (!pkt || pkt.type !== 'ACTION_COMMIT' || pkt.matchVersion <= ver) continue;
      if (this.seenActionIds.has(pkt.actionId)) continue;
      this.seenActionIds.add(pkt.actionId);
      const reduced = reduceXiangqiAction(state, pkt.action);
      state = reduced !== state ? { ...reduced, undoStack: [] } : pkt.resultingState ?? state;
      ver = pkt.matchVersion;
    }
    return { ...snap, matchState: state, matchVersion: ver };
  }

  private hasOpenRtcPeer(): boolean {
    if (isFastLaneDisabled()) return false;
    for (const peer of this.rtcPeers.values()) {
      if (peer.dc?.readyState === 'open') return true;
    }
    return false;
  }

  private scheduleCheckpoint(delayMs = 1200): void {
    if (this.destroyed || !this.snapshot) return;
    if (this.checkpointTimer !== null) clearTimeout(this.checkpointTimer);
    this.checkpointTimer = setTimeout(() => {
      this.checkpointTimer = null;
      if (this.destroyed || !this.snapshot) return;
      const snapClone = structuredClone(this.snapshot);
      void apiPostRoom({
        action: 'checkpoint',
        game: GAME_NAMESPACE,
        roomCode: this.roomCode,
        senderToken: this.playerToken,
        snapshot: snapClone,
      }).catch(() => {});
    }, delayMs);
  }

  public swapColors(): void {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return;
    this.snapshot = {
      ...this.snapshot,
      humans: this.snapshot.humans.map((h) => ({
        ...h,
        color: h.color === 'red' ? 'green' : 'red',
      })),
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  public startMatch(): XiangqiState | null {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return null;
    if (this.snapshot.humans.length !== 2) return null;

    const redPlayer = this.snapshot.humans.find((h) => h.color === 'red') ?? this.snapshot.humans[0];
    const greenPlayer = this.snapshot.humans.find((h) => h.color === 'green') ?? this.snapshot.humans[1];

    const initialState = createInitialXiangqiState({
      redName: redPlayer.name,
      redIsBot: false,
      greenName: greenPlayer.name,
      greenIsBot: false,
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

  public broadcastCommittedAction(action: XiangqiAction, resultingState: XiangqiState): void {
    if (!this.snapshot) return;
    const actionId = generateRandomId('act');
    this.seenActionIds.add(actionId);
    const nextVer = this.snapshot.matchVersion + 1;
    const slimState: XiangqiState = { ...resultingState, undoStack: [] };

    this.snapshot = {
      ...this.snapshot,
      phase: 'PLAYING',
      matchState: slimState,
      matchVersion: nextVer,
      updatedAt: Date.now(),
    };

    // Chỉ gửi gói Delta ~130 byte qua đường tắt pushEventOnlyFast (~3ms) + checkpoint F5 chạy ngầm!
    this.pushFastEventOnly({
      msgId: generateRandomId('msg'),
      senderToken: this.playerToken,
      type: 'ACTION_COMMIT',
      actionId,
      action,
      matchVersion: nextVer,
    });
    this.scheduleCheckpoint();
  }

  public dissolveOrLeave(reason = 'Phòng Cờ Tướng Online đã đóng.'): void {
    clearPersistedXiangqiSession();
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
    if (this.checkpointTimer !== null) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
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

  private persistSession(): void {
    savePersistedXiangqiSession({
      roomCode: this.roomCode,
      playerToken: this.playerToken,
      playerName: this.localName,
      isHost: this.isHost,
      savedAt: Date.now(),
    });
  }

  private getAdaptivePollIntervalMs(): number {
    if (!this.joinResolved) return 60;
    if (typeof document !== 'undefined' && document.hidden) return 3600;
    if (this.hasOpenRtcPeer()) return 2200;
    return 25;
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
              clearPersistedXiangqiSession();
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
            changed = true;
          }
        }
        if (changed) {
          this.snapshot = { ...this.snapshot, humans: [...this.snapshot.humans], updatedAt: now };
          this.emitSnapshot();
          if (this.isHost) this.broadcastSnapshot();
        }
      }, 1500);
    }

    if (typeof document !== 'undefined' && !this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (!document.hidden && !this.destroyed) this.scheduleNextPoll(80);
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private scheduleNextPoll(delayMs?: number): void {
    if (this.destroyed) return;
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.pollOnce(), delayMs ?? this.getAdaptivePollIntervalMs());
  }

  private async pollOnce(): Promise<void> {
    if (this.destroyed || this.pollInFlight) {
      return;
    }
    this.pollInFlight = true;
    let hadError = false;
    try {
      const hidden = typeof document !== 'undefined' && document.hidden;
      const useLongPoll = !hidden && !this.hasOpenRtcPeer();
      const waitMs = !this.joinResolved
        ? 1500
        : useLongPoll
          ? this.snapshot?.phase === 'PLAYING'
            ? 3000
            : 2500
          : 0;
      const { status, data } = await apiGetRoom(this.roomCode, this.lastSeq, !this.joinResolved, waitMs);
      if (this.destroyed) return;
      if (status === 404 || status === 410 || data.phase === 'DISSOLVED') {
        clearPersistedXiangqiSession();
        this.callbacks.onRoomClosed(data.message || 'Phòng Online đã đóng.');
        this.destroy();
        return;
      }
      if (status === 200 && data.ok) {
        if (this.consecutivePollErrors > 0) {
          this.consecutivePollErrors = 0;
          this.callbacks.onStatusChange('READY', `Đã nối lại phòng #${this.roomCode}`);
        }
        this.ingestHeartbeats(data.heartbeats);
        if (typeof data.seq === 'number' && data.seq > this.lastSeq) this.lastSeq = data.seq;
        if (Array.isArray(data.events)) {
          for (const row of data.events) {
            if (this.destroyed) return;
            if (row.packet) this.handleIncomingPacket(row.packet);
          }
        }
        if (!this.joinResolved && data.snapshot) {
          if (data.snapshot.humans.some((h) => h.playerToken === this.playerToken)) {
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
          this.callbacks.onStatusChange('RECONNECTING', 'Đang tự nối lại mạng...');
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
      if (Number.isFinite(ts) && ts > (this.lastSeenMap.get(token) ?? 0)) {
        this.lastSeenMap.set(token, ts);
      }
    }
  }

  private handleIncomingPacket(packet: WirePacket): void {
    if (packet.senderToken === this.playerToken) return;
    if (this.seenMsgIds.has(packet.msgId)) return;
    this.seenMsgIds.add(packet.msgId);
    this.lastSeenMap.set(packet.senderToken, Date.now());

    switch (packet.type) {
      case 'JOIN_REQUEST': {
        if (!this.isHost || !this.snapshot || packet.roomCode !== this.roomCode) return;
        const existing = this.snapshot.humans.find((h) => h.playerToken === packet.playerToken);
        if (existing) {
          existing.connected = true;
          existing.disconnectedAt = null;
          this.snapshot = { ...this.snapshot, humans: [...this.snapshot.humans], updatedAt: Date.now() };
          this.emitSnapshot();
          this.broadcastSnapshot();
          return;
        }
        if (this.snapshot.phase !== 'LOBBY' || this.snapshot.humans.length >= 2) {
          this.pushPacket({
            msgId: generateRandomId('rej'),
            senderToken: this.playerToken,
            type: 'JOIN_REJECTED',
            targetToken: packet.playerToken,
            reason: 'Phòng Cờ Tướng đã đủ 2 kỳ thủ hoặc đã bắt đầu!',
          });
          return;
        }
        const hostColor = this.snapshot.humans[0]?.color ?? 'red';
        const guest: XiangqiOnlineMember = {
          playerToken: packet.playerToken,
          color: hostColor === 'red' ? 'green' : 'red',
          name: packet.name.trim() || 'Kỳ Thủ 2',
          isHost: false,
          connected: true,
          disconnectedAt: null,
        };
        this.snapshot = {
          ...this.snapshot,
          humans: [...this.snapshot.humans, guest],
          updatedAt: Date.now(),
        };
        this.callbacks.onPeerJoined?.(guest.name);
        this.emitSnapshot();
        this.broadcastSnapshot();
        break;
      }
      case 'JOIN_REJECTED': {
        if (packet.targetToken !== this.playerToken) return;
        clearPersistedXiangqiSession();
        this.callbacks.onStatusChange('ERROR', packet.reason);
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }
      case 'ROOM_SNAPSHOT': {
        if (this.isHost) return;
        if (!this.joinResolved && !packet.snapshot.humans.some((h) => h.playerToken === this.playerToken)) {
          return;
        }
        this.joinResolved = true;
        this.snapshot = packet.snapshot;
        this.callbacks.onStatusChange('READY', `Đã kết nối phòng #${this.roomCode}`);
        this.emitSnapshot();
        break;
      }
      case 'ACTION_COMMIT': {
        if (this.seenActionIds.has(packet.actionId)) return;
        this.seenActionIds.add(packet.actionId);
        let resolvedNext = packet.resultingState;
        if (!resolvedNext && this.snapshot?.matchState) {
          const reduced = reduceXiangqiAction(this.snapshot.matchState, packet.action);
          resolvedNext = reduced !== this.snapshot.matchState ? { ...reduced, undoStack: [] } : this.snapshot.matchState;
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
      case 'DISSOLVE_ROOM': {
        clearPersistedXiangqiSession();
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

  private emitSnapshot(): void {
    if (this.snapshot) {
      this.ensureRtcPeers();
      this.callbacks.onSnapshot({
        ...this.snapshot,
        humans: this.snapshot.humans.map((h) => ({ ...h })),
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
    if (!this.broadcastChan && typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChan = new BroadcastChannel(`bgvn_ct_fast_${this.roomCode}`);
        this.broadcastChan.onmessage = (ev: MessageEvent) => {
          const pkt = ev?.data as WirePacket | undefined;
          if (!this.destroyed && pkt && typeof pkt.msgId === 'string') {
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
    for (const h of this.snapshot.humans) {
      if (h.playerToken === this.playerToken || !h.connected) continue;
      if (this.playerToken < h.playerToken && !this.rtcPeers.has(h.playerToken)) {
        this.getOrCreateRtcPeer(h.playerToken, true);
      }
    }
  }

  private getOrCreateRtcPeer(remoteToken: string, isInitiator: boolean): PeerChannelState | null {
    if (typeof RTCPeerConnection === 'undefined' || this.destroyed) return null;
    const existing = this.rtcPeers.get(remoteToken);
    if (existing) return existing;
    try {
      const pc = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
      const state: PeerChannelState = { pc, dc: null, makingOffer: false, pendingCandidates: [] };
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
        const dc = pc.createDataChannel('bgvn-ct-fast', { ordered: true });
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
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
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
        if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
        else if (peer.pendingCandidates.length < 32) peer.pendingCandidates.push(signal.candidate);
      }
    } catch {
      // Fallback Redis vẫn hoạt động bình thường
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
    })
      .then(({ data }) => {
        if (!this.destroyed && typeof data.seq === 'number' && data.seq === this.lastSeq + 1) {
          this.lastSeq = data.seq;
        }
      })
      .catch(() => {});
  }

  private sendOverFastLanes(packet: WirePacket): void {
    if (this.destroyed) return;
    try {
      this.broadcastChan?.postMessage(packet);
    } catch {
      // Ignore
    }
    let raw: string | null = null;
    for (const peer of this.rtcPeers.values()) {
      if (peer.dc?.readyState === 'open') {
        try {
          if (raw === null) raw = JSON.stringify(packet);
          peer.dc.send(raw);
        } catch {
          // Ignore
        }
      }
    }
  }

  private pushFastEventOnly(packet: WirePacket): void {
    if (this.destroyed) return;
    this.seenMsgIds.add(packet.msgId);
    this.sendOverFastLanes(packet);
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

  private pushPacket(packet: WirePacket, snapshotToStore?: XiangqiRoomSnapshot): void {
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
