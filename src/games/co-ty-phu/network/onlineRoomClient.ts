import { cryptoRandomInt } from '@/shared/crypto/random';
import { AblyFastLane } from '@/shared/network/ablyFastLane';
import {
  createAdaptiveCheckpointScheduler,
  createOrderedActionBuffer,
  fetchJsonWithTimeout,
  getAdaptiveBackupPollIntervalMs,
  hasAllConnectedPeersRtcOpen,
  postWithRetry,
  type AdaptiveCheckpointScheduler,
} from '@/shared/network/onlineReliability';
import { isFastLaneDisabled } from '@/shared/network/onlineTransportConfig';
import { CO_TY_PHU_CHARACTERS, LAND_COLORS } from '../data/characters';
import { createInitialGameState, reduceGameAction } from '../engine/reducer';
import type { CharacterId, GameAction, GameState, LandColorId, PlayerSlotDraft } from '../engine/types';

export const ONLINE_DISCONNECT_GRACE_MS = 120_000; // 2 phút chờ kết nối lại trước khi Máy đánh thay
const GAME_NAMESPACE = 'co-ty-phu';
const SESSION_STORAGE_KEY = 'bgvn_cotyphu_online_session_v2';
const HEARTBEAT_INTERVAL_MS = 10_000; // Nhịp tim gia hạn TTL trượt & kiểm tra kết nối
const DISCONNECT_THRESHOLD_MS = 26_000; // Mất 2.6 nhịp tim mới đánh dấu tạm mất mạng

export interface OnlineRoomMember {
  playerToken: string;
  seatId: string | null; // Ánh xạ thành p_1..p_6 khi vào ván
  name: string;
  characterId: CharacterId;
  landColor: LandColorId;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  botTakeover: boolean;
}

export interface OnlineRoomSnapshot {
  roomCode: string;
  phase: 'LOBBY' | 'PLAYING' | 'DISSOLVED';
  hostToken: string;
  botCount: number; // 0..4
  diceCount: 1 | 2;
  mapMode: 'default' | 'random';
  humans: OnlineRoomMember[];
  bots: OnlineRoomMember[];
  matchState: GameState | null;
  matchVersion: number;
  updatedAt: number;
}

export interface PersistedOnlineSession {
  roomCode: string;
  playerToken: string;
  playerName: string;
  isHost: boolean;
  savedAt: number;
}

export interface DeckSyncPatch {
  chanceDeck?: string[];
  fateDeck?: string[];
  /** Đồng bộ điểm đến Sân Bay ngẫu nhiên tiếp theo giữa các máy Online (key = tileIndex) */
  airportDestinations?: Record<number, number>;
}

/** Áp dụng bản vá đồng bộ bộ bài & điểm đến Sân Bay sau khi chạy pure reducer trên máy nhận */
export function applyOnlineSyncPatch(state: GameState, patch?: DeckSyncPatch): GameState {
  if (!patch) return state;
  const hasAirportPatch =
    patch.airportDestinations && Object.keys(patch.airportDestinations).length > 0;
  if (!patch.chanceDeck && !patch.fateDeck && !hasAirportPatch) {
    return state;
  }
  return {
    ...state,
    chanceDeck: patch.chanceDeck ?? state.chanceDeck,
    fateDeck: patch.fateDeck ?? state.fateDeck,
    tiles: hasAirportPatch
      ? state.tiles.map((tile) => {
          const syncedDest = patch.airportDestinations?.[tile.index];
          return syncedDest !== undefined
            ? { ...tile, currentDestinationTileIndex: syncedDest }
            : tile;
        })
      : state.tiles,
  };
}

export interface RemoteGameActionEvent {
  actionId: string;
  action: GameAction;
  rollPower: number;
  resultingState?: GameState;
  deckSync?: DeckSyncPatch;
  matchVersion: number;
}

export interface RemoteDiceChargeEvent {
  playerId: string;
  playerName: string;
  active: boolean;
  charge01: number;
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
      snapshot: OnlineRoomSnapshot;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'UPDATE_MEMBER';
      targetToken: string;
      patch: {
        name?: string;
        characterId?: CharacterId;
        landColor?: LandColorId;
      };
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'ACTION_COMMIT';
      actionId: string;
      action: GameAction;
      rollPower: number;
      resultingState?: GameState;
      deckSync?: DeckSyncPatch;
      matchVersion: number;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'DICE_CHARGE';
      playerId: string;
      playerName: string;
      active: boolean;
      charge01: number;
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
  snapshot?: OnlineRoomSnapshot | null;
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

export function generateRoomCode6Digits(): string {
  return String(cryptoRandomInt(100000, 999999));
}

export function getOrCreatePlayerToken(): string {
  if (typeof window === 'undefined') return generateRandomId('tk');
  const existing = window.sessionStorage.getItem('bgvn_cotyphu_player_token');
  if (existing && existing.length >= 8) return existing;
  const fresh = generateRandomId('tk');
  window.sessionStorage.setItem('bgvn_cotyphu_player_token', fresh);
  return fresh;
}

export function savePersistedOnlineSession(session: PersistedOnlineSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPersistedOnlineSession(): PersistedOnlineSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedOnlineSession;
    if (!parsed?.roomCode || !parsed?.playerToken) return null;
    // Cho phép tự khôi phục trong 30 phút (trùng với TTL phòng trên Redis)
    if (Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedOnlineSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function pickNextUnusedColor(members: readonly OnlineRoomMember[]): LandColorId {
  const used = new Set(members.map((m) => m.landColor));
  const free = LAND_COLORS.find((c) => !used.has(c.id));
  return free ? free.id : LAND_COLORS[members.length % LAND_COLORS.length].id;
}

function pickNextUnusedCharacter(members: readonly OnlineRoomMember[]): CharacterId {
  const used = new Set(members.map((m) => m.characterId));
  const free = CO_TY_PHU_CHARACTERS.find((c) => !used.has(c.id));
  return free ? free.id : CO_TY_PHU_CHARACTERS[members.length % CO_TY_PHU_CHARACTERS.length].id;
}

function buildBotsArray(
  desiredCount: number,
  existingBots: readonly OnlineRoomMember[],
  humans: readonly OnlineRoomMember[],
): OnlineRoomMember[] {
  const clamped = Math.max(0, Math.min(4, Math.min(desiredCount, Math.max(0, 6 - humans.length))));
  const result: OnlineRoomMember[] = existingBots.slice(0, clamped).map((b) => ({ ...b }));

  while (result.length < clamped) {
    const botIdx = result.length + 1;
    const allCurrent = [...humans, ...result];
    result.push({
      playerToken: `bot_${botIdx}`,
      seatId: null,
      name: `Máy ${botIdx}`,
      characterId: pickNextUnusedCharacter(allCurrent),
      landColor: pickNextUnusedColor(allCurrent),
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
  return fetchJsonWithTimeout<ApiRoomResponse>(
    '/api/room',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
    8000,
  );
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
  return fetchJsonWithTimeout<ApiRoomResponse>(
    `/api/room?${qs.toString()}`,
    { cache: 'no-store' },
    Math.max(8000, waitMs + 7000),
  );
}

export interface OnlineRoomCallbacks {
  onSnapshot: (snapshot: OnlineRoomSnapshot) => void;
  onStatusChange: (status: OnlineTransportStatus, message: string) => void;
  onRemoteAction: (event: RemoteGameActionEvent) => void;
  onStateResync?: (state: GameState, matchVersion: number) => void;
  onRemoteDiceCharge?: (event: RemoteDiceChargeEvent) => void;
  onRoomClosed: (reason: string) => void;
  onPeerJoined?: (memberName: string) => void;
}

const RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

/**
 * Kết nối phòng Online Dual-Engine:
 * 1. Luồng Siêu Tốc P2P (WebRTC RTCDataChannel ~10-25ms + BroadcastChannel <2ms cùng thiết bị).
 * 2. Luồng Bảo Chứng Vercel Serverless (/api/room tại Singapore sin1) + Upstash Redis Singapore (~30-45ms).
 * - Gói tin nào tới trước sẽ kích hoạt hoạt ảnh ngay lập tức, gói trùng theo sau tự động bị loại bỏ qua msgId/actionId.
 * - Mã 6 số duy nhất nguyên tử (HSETNX), không bao giờ trùng, hỗ trợ F5 khôi phục thẳng bàn cờ.
 */
export class OnlineRoomClient {
  public roomCode: string;
  public readonly playerToken: string;
  public isHost: boolean;

  private callbacks: OnlineRoomCallbacks;
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
  private snapshot: OnlineRoomSnapshot | null = null;
  private localName: string;
  private joinResolved = false;
  private visibilityHandler: (() => void) | null = null;
  private pushChain: Promise<void> = Promise.resolve();
  private actionPushChain: Promise<void> = Promise.resolve();
  private broadcastChan: BroadcastChannel | null = null;
  private ablyLane: AblyFastLane | null = null;
  private ablyConnected = false;
  private rtcPeers = new Map<string, PeerChannelState>();
  private lastChargeActive = false;
  private checkpointScheduler: AdaptiveCheckpointScheduler | null = null;
  private joinPollAttempts = 0;
  private orderedActionBuffer =
    createOrderedActionBuffer<Extract<WirePacket, { type: 'ACTION_COMMIT' }>>();
  private gapRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private gapRecoveryInFlight = false;

  constructor(options: {
    roomCode: string;
    playerToken: string;
    playerName: string;
    isHost: boolean;
    callbacks: OnlineRoomCallbacks;
  }) {
    this.roomCode = options.roomCode;
    this.playerToken = options.playerToken;
    this.localName = options.playerName.trim() || (options.isHost ? 'Chủ Phòng' : 'Người Chơi');
    this.isHost = options.isHost;
    this.callbacks = options.callbacks;
  }

  public getSnapshot(): OnlineRoomSnapshot | null {
    return this.snapshot;
  }

  /** Khởi tạo phòng mới trên máy chủ — chỉ trả về khi đã cấp mã 6 số thành công 100% */
  public async startAsHost(initialBotCount = 2): Promise<string> {
    this.callbacks.onStatusChange('CONNECTING', 'Đang khởi tạo phòng trên máy chủ...');

    const hostMember: OnlineRoomMember = {
      playerToken: this.playerToken,
      seatId: null,
      name: this.localName,
      characterId: CO_TY_PHU_CHARACTERS[0].id,
      landColor: LAND_COLORS[0].id,
      isHost: true,
      isBot: false,
      connected: true,
      disconnectedAt: null,
      botTakeover: false,
    };

    const bots = buildBotsArray(initialBotCount, [], [hostMember]);
    const draftSnapshot: OnlineRoomSnapshot = {
      roomCode: this.roomCode,
      phase: 'LOBBY',
      hostToken: this.playerToken,
      botCount: bots.length,
      diceCount: 2,
      mapMode: 'default',
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
      const msg = data.message || 'Không thể kết nối máy chủ tạo phòng Online. Vui lòng thử lại!';
      this.callbacks.onStatusChange('ERROR', msg);
      throw new Error(msg);
    }

    this.roomCode = data.roomCode;
    this.lastSeq = data.seq ?? 1;
    this.snapshot = (data.snapshot as OnlineRoomSnapshot) ?? { ...draftSnapshot, roomCode: this.roomCode };
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

  /** Tham gia phòng đã tồn tại bằng mã 6 chữ số (phát hiện sai mã tức thì < 200ms) */
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

    // Nếu là thành viên cũ quay lại (F5 / rớt mạng vào lại) -> vào thẳng phòng/bàn cờ ngay lập tức!
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

    // Khách mới: đã gửi JOIN_REQUEST lên máy chủ, bắt đầu poll nhanh để nhận ROOM_SNAPSHOT từ Chủ phòng
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
          const msg = `Phòng #${this.roomCode} tồn tại nhưng Chủ phòng đang không phản hồi. Hãy kiểm tra kết nối của Chủ phòng.`;
          this.callbacks.onStatusChange('ERROR', msg);
          reject(new Error(msg));
        }
      }, 140);
    });
  }

  /** Tự động khôi phục phòng ngay sau khi bấm F5 (dùng cho cả Chủ phòng lẫn Khách!) */
  public async rejoinExistingRoom(): Promise<OnlineRoomSnapshot> {
    this.callbacks.onStatusChange('RECONNECTING', `Đang khôi phục phòng #${this.roomCode}...`);

    const { status, data } = await apiPostRoom({
      action: 'rejoin',
      game: GAME_NAMESPACE,
      roomCode: this.roomCode,
      senderToken: this.playerToken,
    });

    if (status !== 200 || !data.ok || !data.snapshot) {
      const msg = data.message || `Phòng #${this.roomCode} đã đóng hoặc hết thời gian chờ.`;
      clearPersistedOnlineSession();
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

    // Chủ phòng đồng bộ snapshot mới nhất để các máy khác thấy ngay trạng thái trực tuyến
    if (this.isHost) {
      this.scheduleCheckpoint(150);
    }

    return this.snapshot;
  }

  private replayMissedActionsIntoSnapshot(
    snap: OnlineRoomSnapshot,
    events?: ApiEventRow[],
  ): OnlineRoomSnapshot {
    if (!snap.matchState || !Array.isArray(events) || events.length === 0) return snap;
    let state = snap.matchState;
    let ver = snap.matchVersion;
    const actionPackets = events
      .map((row) => row?.packet)
      .filter(
        (pkt): pkt is Extract<WirePacket, { type: 'ACTION_COMMIT' }> =>
          Boolean(pkt && pkt.type === 'ACTION_COMMIT'),
      )
      .sort((a, b) => a.matchVersion - b.matchVersion);

    for (const pkt of actionPackets) {
      if (pkt.matchVersion <= ver) continue;
      this.seenActionIds.add(pkt.actionId);
      const { state: reduced } = reduceGameAction(state, pkt.action);
      state = pkt.resultingState
        ? pkt.resultingState
        : applyOnlineSyncPatch(reduced, pkt.deckSync);
      ver = pkt.matchVersion;
    }
    return { ...snap, matchState: state, matchVersion: ver };
  }

  private clearGapRecoveryTimer(): void {
    if (this.gapRecoveryTimer !== null) {
      clearTimeout(this.gapRecoveryTimer);
      this.gapRecoveryTimer = null;
    }
  }

  private scheduleGapRecovery(): void {
    if (this.destroyed || this.gapRecoveryTimer !== null) return;
    this.gapRecoveryTimer = setTimeout(() => {
      this.gapRecoveryTimer = null;
      if (!this.destroyed && this.orderedActionBuffer.hasPending()) {
        void this.recoverFromVersionGap();
      }
    }, 2200);
  }

  private applyAuthoritativeSnapshotResync(
    serverSnapshot: OnlineRoomSnapshot,
    events?: ApiEventRow[],
  ): boolean {
    if (serverSnapshot.phase !== 'PLAYING' || !serverSnapshot.matchState) return false;
    const recovered = this.replayMissedActionsIntoSnapshot(serverSnapshot, events);
    const curVer = this.snapshot?.matchVersion ?? 0;
    if (!recovered.matchState || recovered.matchVersion <= curVer) return false;

    this.orderedActionBuffer.dropThrough(recovered.matchVersion);
    if (!this.orderedActionBuffer.hasPending()) {
      this.clearGapRecoveryTimer();
    }
    this.snapshot = recovered;
    this.emitSnapshot();
    this.callbacks.onStateResync?.(recovered.matchState, recovered.matchVersion);
    return true;
  }

  private async recoverFromVersionGap(): Promise<void> {
    if (this.destroyed || this.gapRecoveryInFlight) return;
    this.gapRecoveryInFlight = true;
    try {
      const { status, data } = await apiGetRoom(this.roomCode, 0, true, 0);
      if (this.destroyed || status !== 200 || !data.ok) return;
      this.ingestHeartbeats(data.heartbeats);
      if (typeof data.seq === 'number' && data.seq > this.lastSeq) {
        this.lastSeq = data.seq;
      }
      if (data.snapshot) {
        this.applyAuthoritativeSnapshotResync(data.snapshot, data.events);
      }
    } catch {
      // Sẽ thử lại qua poll chu kỳ kế tiếp nếu mạng vừa rớt
    } finally {
      this.gapRecoveryInFlight = false;
    }
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
    savePersistedOnlineSession({
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
              clearPersistedOnlineSession();
              this.callbacks.onRoomClosed(data.message || 'Phòng Online đã đóng.');
              this.destroy();
              return;
            }
            this.ingestHeartbeats(data.heartbeats);
          })
          .catch(() => {
            // Sẽ thử lại ở nhịp tim tiếp theo
          });
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
          // Vừa mở lại tab điện thoại -> đồng bộ ngay lập tức!
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
        clearPersistedOnlineSession();
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

        // Nếu máy vừa thức dậy sau khi lỡ >20 sự kiện (server trả kèm snapshot đầy đủ và có khoảng trống phiên bản) -> đồng bộ lại thẳng từ snapshot chuẩn!
        let resyncedFromSnapshot = false;
        if (
          this.joinResolved &&
          this.snapshot?.phase === 'PLAYING' &&
          data.snapshot?.phase === 'PLAYING' &&
          data.snapshot.matchState
        ) {
          const curVer = this.snapshot.matchVersion;
          const futureEventVersions = Array.isArray(data.events)
            ? data.events
                .map((r) => r.packet)
                .filter(
                  (p): p is Extract<WirePacket, { type: 'ACTION_COMMIT' }> =>
                    Boolean(p && p.type === 'ACTION_COMMIT' && p.matchVersion > curVer),
                )
                .map((p) => p.matchVersion)
            : [];
          const minEventVer = futureEventVersions.length > 0 ? Math.min(...futureEventVersions) : null;
          const hasUnrecoverableGap =
            (minEventVer !== null && minEventVer > curVer + 1) ||
            (minEventVer === null && data.snapshot.matchVersion > curVer);
          if (hasUnrecoverableGap) {
            resyncedFromSnapshot = this.applyAuthoritativeSnapshotResync(data.snapshot, data.events);
          }
        }

        if (!resyncedFromSnapshot && Array.isArray(data.events) && data.events.length > 0) {
          for (const row of data.events) {
            if (this.destroyed) return;
            if (row.packet) {
              this.handleIncomingPacket(row.packet);
            }
          }
        }

        // Phòng trường hợp Khách vừa vào mà snapshot mới nhất trên server đã có mặt mình
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
            reason: 'Phòng này đã bắt đầu ván chơi!',
          });
          return;
        }

        const maxHumans = Math.max(1, 6 - this.snapshot.botCount);
        if (this.snapshot.humans.length >= maxHumans) {
          this.pushPacket({
            msgId: generateRandomId('rej'),
            senderToken: this.playerToken,
            type: 'JOIN_REJECTED',
            targetToken: packet.playerToken,
            reason: `Phòng đã đủ ${maxHumans} người chơi (đang có ${this.snapshot.botCount} Máy).`,
          });
          return;
        }

        const allMembers = [...this.snapshot.humans, ...this.snapshot.bots];
        const newHuman: OnlineRoomMember = {
          playerToken: packet.playerToken,
          seatId: null,
          name: packet.name.trim() || `Bạn ${this.snapshot.humans.length + 1}`,
          characterId: pickNextUnusedCharacter(allMembers),
          landColor: pickNextUnusedColor(allMembers),
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
        clearPersistedOnlineSession();
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
        // Không cho phép ROOM_SNAPSHOT đời cũ ghi đè lùi matchState mới hơn (vd: Chủ phòng phát sự kiện kết nối trễ hơn nước vừa đi)
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

        const currentVer = this.snapshot?.matchVersion ?? 0;
        if (this.snapshot?.phase === 'PLAYING') {
          const ingest = this.orderedActionBuffer.ingest(packet.matchVersion, currentVer, packet);
          if (ingest.status === 'stale') {
            return;
          }
          if (ingest.status === 'buffered_gap') {
            // Gói đến trước bị lệch thứ tự (vd v+2 đến trước v+1): tạm giữ & gọi poll kéo v+1, KHÔNG áp dụng lệch state!
            this.scheduleNextPoll(20);
            this.scheduleGapRecovery();
            return;
          }

          for (const orderedPkt of ingest.orderedPackets) {
            this.applySequentialActionCommit(orderedPkt);
          }
          if (!this.orderedActionBuffer.hasPending()) {
            this.clearGapRecoveryTimer();
          }
          break;
        }

        this.applySequentialActionCommit(packet);
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
        clearPersistedOnlineSession();
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }

      case 'DISSOLVE_ROOM': {
        clearPersistedOnlineSession();
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }

      case 'DICE_CHARGE': {
        this.callbacks.onRemoteDiceCharge?.({
          playerId: packet.playerId,
          playerName: packet.playerName,
          active: packet.active,
          charge01: packet.charge01,
        });
        break;
      }

      case 'RTC_SIGNAL': {
        if (packet.targetToken !== this.playerToken) return;
        void this.handleRtcSignal(packet.senderToken, packet.signal);
        break;
      }
    }
  }

  private applySequentialActionCommit(packet: Extract<WirePacket, { type: 'ACTION_COMMIT' }>): void {
    // Tính state xác định 100% từ gói Delta ~180B để lưu ngầm dự phòng F5 (KHÔNG emitSnapshot sớm để giữ trọn hoạt ảnh!)
    let resolvedNext = packet.resultingState;
    if (!resolvedNext && this.snapshot?.matchState) {
      const { state: reduced } = reduceGameAction(this.snapshot.matchState, packet.action);
      resolvedNext = applyOnlineSyncPatch(reduced, packet.deckSync);
    }
    if (this.snapshot && resolvedNext) {
      this.snapshot = {
        ...this.snapshot,
        phase: 'PLAYING',
        matchState: resolvedNext,
        matchVersion: Math.max(this.snapshot.matchVersion, packet.matchVersion),
        updatedAt: Date.now(),
      };
      if (this.isHost) {
        this.scheduleCheckpoint();
      }
    }

    this.callbacks.onRemoteAction({
      actionId: packet.actionId,
      action: packet.action,
      rollPower: packet.rollPower,
      resultingState: resolvedNext,
      deckSync: packet.deckSync,
      matchVersion: packet.matchVersion,
    });
  }

  /** Cập nhật Tên / Nhân vật / Màu đất của bản thân (hoặc Bot nếu là Chủ phòng) */
  public updateMember(
    targetToken: string,
    patch: { name?: string; characterId?: CharacterId; landColor?: LandColorId },
  ): void {
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
    patch: { name?: string; characterId?: CharacterId; landColor?: LandColorId },
  ): void {
    if (!this.snapshot) return;
    const allMembers = [...this.snapshot.humans, ...this.snapshot.bots];
    const target = allMembers.find((m) => m.playerToken === targetToken);
    if (!target) return;

    let nextHumans = this.snapshot.humans.map((h) => ({ ...h }));
    let nextBots = this.snapshot.bots.map((b) => ({ ...b }));

    if (patch.landColor && patch.landColor !== target.landColor) {
      const takenByHuman = nextHumans.find(
        (h) => h.playerToken !== targetToken && h.landColor === patch.landColor,
      );
      if (!takenByHuman) {
        const takenByBot = nextBots.find(
          (b) => b.playerToken !== targetToken && b.landColor === patch.landColor,
        );
        if (takenByBot) {
          takenByBot.landColor = target.landColor;
        }
        nextHumans = nextHumans.map((h) =>
          h.playerToken === targetToken ? { ...h, landColor: patch.landColor! } : h,
        );
        nextBots = nextBots.map((b) =>
          b.playerToken === targetToken ? { ...b, landColor: patch.landColor! } : b,
        );
      }
    }

    if (patch.name !== undefined) {
      const clean = patch.name.slice(0, 18);
      nextHumans = nextHumans.map((h) => (h.playerToken === targetToken ? { ...h, name: clean } : h));
      nextBots = nextBots.map((b) => (b.playerToken === targetToken ? { ...b, name: clean } : b));
    }

    if (patch.characterId !== undefined) {
      nextHumans = nextHumans.map((h) =>
        h.playerToken === targetToken ? { ...h, characterId: patch.characterId! } : h,
      );
      nextBots = nextBots.map((b) =>
        b.playerToken === targetToken ? { ...b, characterId: patch.characterId! } : b,
      );
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

  /** Chủ phòng thay đổi số lượng Máy chơi chung (0..4) */
  public setBotCount(count: number): void {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return;
    const nextBots = buildBotsArray(count, this.snapshot.bots, this.snapshot.humans);
    this.snapshot = {
      ...this.snapshot,
      botCount: nextBots.length,
      bots: nextBots,
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  /** Chủ phòng đổi chế độ 1/2 Xúc xắc hoặc Bản đồ Mặc định/Ngẫu nhiên */
  public updateMatchSettings(patch: { diceCount?: 1 | 2; mapMode?: 'default' | 'random' }): void {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return;
    this.snapshot = {
      ...this.snapshot,
      diceCount: patch.diceCount ?? this.snapshot.diceCount,
      mapMode: patch.mapMode ?? this.snapshot.mapMode,
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  /** Chủ phòng mời 1 người chơi ra khỏi phòng chờ */
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

  /** Chủ phòng bấm BẮT ĐẦU VÁN CHƠI (khi tổng Người + Máy >= 2) */
  public startMatch(): GameState | null {
    if (!this.isHost || !this.snapshot || this.snapshot.phase !== 'LOBBY') return null;
    const activeMembers = [...this.snapshot.humans, ...this.snapshot.bots];
    if (activeMembers.length < 2) return null;

    const slots: PlayerSlotDraft[] = activeMembers.map((m, idx) => ({
      slotIndex: idx,
      name: m.name.trim() || (m.isBot ? `Máy ${idx + 1}` : `Bạn ${idx + 1}`),
      isBot: m.isBot,
      characterId: m.characterId,
      landColor: m.landColor,
    }));

    const initialState = createInitialGameState({
      slots,
      diceCount: this.snapshot.diceCount,
      mapMode: this.snapshot.mapMode,
    });
    initialState.roomCode = this.roomCode;

    const mappedHumans = this.snapshot.humans.map((h, idx) => ({
      ...h,
      seatId: initialState.players[idx]?.id ?? `p_${idx + 1}`,
    }));
    const mappedBots = this.snapshot.bots.map((b, idx) => ({
      ...b,
      seatId: initialState.players[mappedHumans.length + idx]?.id ?? `p_${mappedHumans.length + idx + 1}`,
    }));

    this.snapshot = {
      ...this.snapshot,
      phase: 'PLAYING',
      humans: mappedHumans,
      bots: mappedBots,
      matchState: initialState,
      matchVersion: 1,
      updatedAt: Date.now(),
    };

    this.emitSnapshot();
    this.broadcastSnapshot();
    return initialState;
  }

  /** Phát nước đi siêu nhẹ dạng Delta (~180 byte) qua đường tắt pushEventOnlyFast (~3ms) + Checkpoint F5 ngầm */
  public broadcastCommittedAction(
    action: GameAction,
    rollPower: number,
    resultingState: GameState,
  ): void {
    if (!this.snapshot) return;
    const actionId = generateRandomId('act');
    this.seenActionIds.add(actionId);
    const nextVer = this.snapshot.matchVersion + 1;

    // Chỉ đính kèm `deckSync` khi bộ bài vừa xáo lại HOẶC điểm đến Sân Bay vừa random lại để 2 máy khớp 100%!
    const prevState = this.snapshot.matchState;
    let deckSync: DeckSyncPatch | undefined;
    if (prevState) {
      const chanceReshuffled =
        resultingState.chanceDeck.length > prevState.chanceDeck.length ||
        resultingState.chanceDiscard.length < prevState.chanceDiscard.length;
      const fateReshuffled =
        resultingState.fateDeck.length > prevState.fateDeck.length ||
        resultingState.fateDiscard.length < prevState.fateDiscard.length;

      let airportDestinations: Record<number, number> | undefined;
      for (const nextTile of resultingState.tiles) {
        if (nextTile.kind !== 'AIRPORT' || nextTile.currentDestinationTileIndex === undefined) {
          continue;
        }
        const prevTile = prevState.tiles[nextTile.index];
        if (prevTile?.currentDestinationTileIndex !== nextTile.currentDestinationTileIndex) {
          airportDestinations ??= {};
          airportDestinations[nextTile.index] = nextTile.currentDestinationTileIndex;
        }
      }

      if (chanceReshuffled || fateReshuffled || airportDestinations) {
        deckSync = {
          ...(chanceReshuffled ? { chanceDeck: [...resultingState.chanceDeck] } : {}),
          ...(fateReshuffled ? { fateDeck: [...resultingState.fateDeck] } : {}),
          ...(airportDestinations ? { airportDestinations } : {}),
        };
      }
    }

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
      action,
      rollPower,
      ...(deckSync ? { deckSync } : {}),
      matchVersion: nextVer,
    };

    this.pushActionCommitReliable(packet);
    this.scheduleCheckpoint();
  }

  /** Phát tín hiệu đang nhấn giữ gồng/lắc xúc xắc: tức thì qua P2P, còn Redis chỉ gửi khi BẮT ĐẦU / KẾT THÚC để không nghẽn đường truyền! */
  public broadcastDiceCharge(
    playerId: string,
    playerName: string,
    active: boolean,
    charge01: number,
  ): void {
    if (this.destroyed || !this.snapshot) return;
    const packet: WirePacket = {
      msgId: generateRandomId('chg'),
      senderToken: this.playerToken,
      type: 'DICE_CHARGE',
      playerId,
      playerName,
      active,
      charge01: Math.round(charge01 * 100) / 100,
    };

    const edgeTransition = active !== this.lastChargeActive;
    this.lastChargeActive = active;
    this.pushFastEventOnly(packet, edgeTransition);
  }

  /** Giải tán phòng (Chủ phòng) hoặc Rời phòng (Khách) */
  public dissolveOrLeave(reason = 'Phòng Online đã được giải tán.'): void {
    clearPersistedOnlineSession();
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
    this.clearGapRecoveryTimer();
    this.orderedActionBuffer.clear();
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
          if (available) {
            // Ably WebSocket đã thông (~40ms) -> đóng ngay WebRTC P2P thừa để tiết kiệm CPU/STUN/pin!
            this.closeAllRtcPeers();
          } else if (!this.destroyed) {
            // Ably hết hạn mức hoặc tạm rớt -> lập tức bật lại Long-Polling & P2P dự phòng!
            this.ensureRtcPeers();
            this.scheduleNextPoll(25);
          }
        },
        onFallbackNeeded: () => {
          if (this.destroyed) return;
          this.ablyConnected = false;
          this.ensureRtcPeers();
          this.scheduleNextPoll(25);
        },
      });
      void this.ablyLane.start();
    }
    if (!this.broadcastChan && typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChan = new BroadcastChannel(`bgvn_fast_${this.roomCode}`);
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

  private closeAllRtcPeers(): void {
    if (this.rtcPeers.size === 0) return;
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

  private ensureRtcPeers(): void {
    if (this.destroyed || isFastLaneDisabled() || !this.snapshot || typeof RTCPeerConnection === 'undefined') return;
    if (this.ablyConnected || this.ablyLane?.shouldPreferAbly()) {
      if (this.ablyConnected) this.closeAllRtcPeers();
      return;
    }
    const activeTokens = new Set<string>();
    for (const h of this.snapshot.humans) {
      if (h.playerToken === this.playerToken || !h.connected) continue;
      activeTokens.add(h.playerToken);
      // Quy tắc khởi tạo đơn hướng (playerToken nhỏ hơn chủ động tạo Offer) để không bao giờ đụng độ Offer đôi
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
        const dc = pc.createDataChannel('bgvn-fast', { ordered: true });
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
    if (this.ablyConnected || this.destroyed) return;
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
      // Nếu WebRTC P2P bị nhà mạng chặn NAT, luồng Singapore Redis (sin1) vẫn chạy song song 100%
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
    // Ưu tiên #1: Ably WebSocket (~35-60ms mọi mạng 4G/Wi-Fi); nếu hết quota/rớt tự rơi về BroadcastChannel + P2P + Upstash!
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
            // Ignore transient DataChannel error
          }
        }
      }
    }
  }

  /** Hàng đợi FIFO + Tự động Retry (tối đa 4 lần) dành riêng cho ACTION_COMMIT: tuyệt đối không đảo thứ tự & không mất nước khi chập chờn 4G! */
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
        // Chỉ tăng lastSeq khi liền kề tuyệt đối (tránh nhảy cóc bỏ sót gói ACTION_COMMIT của đối thủ!)
        if (!this.destroyed && typeof data.seq === 'number' && data.seq === this.lastSeq + 1) {
          this.lastSeq = data.seq;
        }
      })
      .catch(() => {});
  }

  private pushPacket(packet: WirePacket, snapshotToStore?: OnlineRoomSnapshot): void {
    if (this.destroyed) return;
    this.seenMsgIds.add(packet.msgId);

    // 1. Bắn tức thì (0ms) qua Luồng Siêu Tốc P2P DataChannel & BroadcastChannel!
    this.sendOverFastLanes(packet);

    // 2. Đồng thời xếp hàng FIFO tuần tự đẩy lên Singapore Redis (sin1) để bảo chứng 100% & chống văng F5
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
        // Chỉ tăng lastSeq khi liền kề (data.seq === this.lastSeq + 1), nếu có khoảng trống để pollOnce kéo bù sự kiện đối thủ!
        if (!this.destroyed && typeof data.seq === 'number' && data.seq === this.lastSeq + 1) {
          this.lastSeq = data.seq;
        }
        if (!this.destroyed) {
          this.scheduleNextPoll(80);
        }
      })
      .catch(() => {
        // Bỏ qua lỗi mạng thoáng qua, poll vòng sau tự đồng bộ lại
      });
  }
}
