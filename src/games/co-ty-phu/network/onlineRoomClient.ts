import Peer, { type DataConnection } from 'peerjs';
import { cryptoRandomInt } from '@/shared/crypto/random';
import { CO_TY_PHU_CHARACTERS, LAND_COLORS } from '../data/characters';
import { createInitialGameState } from '../engine/reducer';
import type { CharacterId, GameAction, GameState, LandColorId, PlayerSlotDraft } from '../engine/types';

export const ONLINE_DISCONNECT_GRACE_MS = 120_000; // 2 phút chờ kết nối lại trước khi Máy đánh thay
const SESSION_STORAGE_KEY = 'bgvn_cotyphu_online_session_v1';
const HEARTBEAT_INTERVAL_MS = 3_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const ROOM_PEER_PREFIX = 'bgvn-ctp-';

// Máy chủ STUN/TURN công cộng hỗ trợ kết nối xuyên NAT (Wi-Fi nhà, 4G/5G Viettel/VNPT/Mobifone khác mạng)
const CROSS_NETWORK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

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

export interface RemoteGameActionEvent {
  actionId: string;
  action: GameAction;
  rollPower: number;
  resultingState: GameState;
  matchVersion: number;
}

export type OnlineTransportStatus = 'CONNECTING' | 'READY' | 'RECONNECTING' | 'ERROR';

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
      resultingState: GameState;
      matchVersion: number;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'HOST_REHYDRATE';
      snapshot: OnlineRoomSnapshot;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'PING';
      sentAt: number;
    }
  | {
      msgId: string;
      senderToken: string;
      type: 'PONG';
      sentAt: number;
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
    if (Date.now() - parsed.savedAt > ONLINE_DISCONNECT_GRACE_MS) {
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

export interface OnlineRoomCallbacks {
  onSnapshot: (snapshot: OnlineRoomSnapshot) => void;
  onStatusChange: (status: OnlineTransportStatus, message: string) => void;
  onRemoteAction: (event: RemoteGameActionEvent) => void;
  onRoomClosed: (reason: string) => void;
  onPeerJoined?: (memberName: string) => void;
}

export class OnlineRoomClient {
  public readonly roomCode: string;
  public readonly playerToken: string;
  public readonly isHost: boolean;

  private callbacks: OnlineRoomCallbacks;
  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private guestConns = new Map<string, DataConnection>(); // playerToken -> DataConnection
  private broadcastChannel: BroadcastChannel | null = null;
  private seenMsgIds = new Set<string>();
  private seenActionIds = new Set<string>();
  private lastSeenMap = new Map<string, number>(); // playerToken -> epoch ms
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private graceCheckTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  private snapshot: OnlineRoomSnapshot | null = null;
  private localName: string;
  private cloudReady = false;
  private joinResolved = false;

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

  public isCloudOnline(): boolean {
    return this.cloudReady;
  }

  /** Khởi tạo phòng mới với vai trò Chủ phòng (mã 6 chữ số) */
  public async startAsHost(initialBotCount = 2): Promise<void> {
    this.callbacks.onStatusChange('CONNECTING', 'Đang khởi tạo phòng Online...');

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

    this.snapshot = {
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

    this.persistSession();
    this.emitSnapshot();
    this.setupBroadcastChannel();
    this.setupHostPeer();
    this.startTimers();
  }

  /** Tham gia phòng đã tồn tại bằng mã 6 chữ số */
  public async joinRoom(): Promise<void> {
    this.callbacks.onStatusChange('CONNECTING', `Đang tìm phòng #${this.roomCode}...`);
    this.persistSession();
    this.setupBroadcastChannel();

    // Gửi yêu cầu vào phòng qua BroadcastChannel tức thì (hỗ trợ test đa tab 0ms)
    this.sendBroadcast({
      msgId: generateRandomId('msg'),
      senderToken: this.playerToken,
      type: 'JOIN_REQUEST',
      roomCode: this.roomCode,
      playerToken: this.playerToken,
      name: this.localName,
    });

    // Đồng thời mở kết nối PeerJS Cloud WebRTC xuyên mạng (Wi-Fi / 4G khác nhau)
    this.setupGuestPeer();
    this.startTimers();

    // Kiểm tra timeout nếu sau 9 giây không tìm thấy phòng trên cả Broadcast lẫn Cloud
    return new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const poll = setInterval(() => {
        if (this.destroyed) {
          clearInterval(poll);
          reject(new Error('Đã hủy kết nối phòng.'));
          return;
        }
        if (this.joinResolved && this.snapshot) {
          clearInterval(poll);
          resolve();
          return;
        }
        if (Date.now() - started > 9500) {
          clearInterval(poll);
          const msg = `Không tìm thấy phòng #${this.roomCode}. Kiểm tra lại mã 6 số hoặc đảm bảo Chủ phòng đang mở phòng.`;
          this.callbacks.onStatusChange('ERROR', msg);
          reject(new Error(msg));
        }
      }, 150);
    });
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

  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel(`bgvn_cotyphu_room_${this.roomCode}`);
      this.broadcastChannel.onmessage = (ev: MessageEvent<WirePacket>) => {
        if (this.destroyed || !ev.data) return;
        this.handleIncomingPacket(ev.data, null);
      };
    } catch {
      this.broadcastChannel = null;
    }
  }

  private setupHostPeer(): void {
    const peerId = `${ROOM_PEER_PREFIX}${this.roomCode}`;
    try {
      const peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: CROSS_NETWORK_ICE_SERVERS,
        },
      });
      this.peer = peer;

      peer.on('open', () => {
        if (this.destroyed) return;
        this.cloudReady = true;
        this.callbacks.onStatusChange('READY', 'Trực tuyến · Sẵn sàng kết nối khác mạng');
      });

      peer.on('connection', (conn) => {
        if (this.destroyed) return;
        conn.on('data', (raw) => {
          if (this.destroyed || !raw || typeof raw !== 'object') return;
          this.handleIncomingPacket(raw as WirePacket, conn);
        });
        conn.on('close', () => {
          this.handleGuestConnectionClosed(conn);
        });
        conn.on('error', () => {
          this.handleGuestConnectionClosed(conn);
        });
      });

      peer.on('error', (err) => {
        if (this.destroyed) return;
        // Nếu PeerJS Cloud tạm bận / offline (VD môi trường test không Internet), vẫn hoạt động qua BroadcastChannel
        const errType = (err as { type?: string })?.type;
        if (errType === 'unavailable-id') {
          this.callbacks.onStatusChange(
            'RECONNECTING',
            'Mã phòng đang giữ kết nối cũ — đang tự khôi phục...',
          );
        } else {
          this.callbacks.onStatusChange(
            'READY',
            'Đang mở phòng (chế độ cục bộ · kết nối Internet để chơi khác mạng)',
          );
        }
      });

      peer.on('disconnected', () => {
        if (!this.destroyed && this.peer && !this.peer.destroyed) {
          this.callbacks.onStatusChange('RECONNECTING', 'Đang nối lại máy chủ tín hiệu...');
          try {
            this.peer.reconnect();
          } catch {
            // Ignore
          }
        }
      });
    } catch {
      this.callbacks.onStatusChange('READY', 'Phòng đang hoạt động (chế độ cục bộ)');
    }
  }

  private setupGuestPeer(): void {
    const guestId = `${ROOM_PEER_PREFIX}g-${this.playerToken.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}-${cryptoRandomInt(100, 999)}`;
    try {
      const peer = new Peer(guestId, {
        debug: 0,
        config: {
          iceServers: CROSS_NETWORK_ICE_SERVERS,
        },
      });
      this.peer = peer;

      peer.on('open', () => {
        if (this.destroyed) return;
        this.cloudReady = true;
        this.connectGuestToHostPeer();
      });

      peer.on('error', () => {
        if (this.destroyed) return;
        if (!this.joinResolved) {
          // Vẫn đợi BroadcastChannel nếu đang test cùng máy
          this.callbacks.onStatusChange('CONNECTING', `Đang tìm phòng #${this.roomCode}...`);
        }
      });
    } catch {
      // Fallback sang BroadcastChannel
    }
  }

  private connectGuestToHostPeer(): void {
    if (!this.peer || this.peer.destroyed || this.destroyed) return;
    const hostPeerId = `${ROOM_PEER_PREFIX}${this.roomCode}`;
    try {
      const conn = this.peer.connect(hostPeerId, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        if (this.destroyed) return;
        this.sendPacketToConn(conn, {
          msgId: generateRandomId('msg'),
          senderToken: this.playerToken,
          type: 'JOIN_REQUEST',
          roomCode: this.roomCode,
          playerToken: this.playerToken,
          name: this.localName,
        });
      });

      conn.on('data', (raw) => {
        if (this.destroyed || !raw || typeof raw !== 'object') return;
        this.handleIncomingPacket(raw as WirePacket, conn);
      });

      conn.on('close', () => {
        if (this.destroyed) return;
        this.hostConn = null;
        if (this.snapshot?.phase === 'PLAYING') {
          this.markMemberDisconnected(this.snapshot.hostToken);
          this.callbacks.onStatusChange(
            'RECONNECTING',
            'Chủ phòng tạm mất mạng — đang tự kết nối lại (tối đa 2 phút)...',
          );
          this.startGuestHostReconnectLoop();
        }
      });
    } catch {
      // Ignore
    }
  }

  private startGuestHostReconnectLoop(): void {
    if (this.reconnectTimer !== null || this.isHost) return;
    this.reconnectTimer = setInterval(() => {
      if (this.destroyed || this.hostConn?.open) {
        if (this.reconnectTimer !== null) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        return;
      }
      this.connectGuestToHostPeer();
      this.sendBroadcast({
        msgId: generateRandomId('msg'),
        senderToken: this.playerToken,
        type: 'PING',
        sentAt: Date.now(),
      });
    }, 2800);
  }

  private startTimers(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.destroyed || !this.snapshot) return;
      this.persistSession();
      this.broadcastAll({
        msgId: generateRandomId('hb'),
        senderToken: this.playerToken,
        type: 'PING',
        sentAt: Date.now(),
      });
    }, HEARTBEAT_INTERVAL_MS);

    this.graceCheckTimer = setInterval(() => {
      if (this.destroyed || !this.snapshot) return;
      const now = Date.now();
      let changed = false;

      for (const h of this.snapshot.humans) {
        if (h.playerToken === this.playerToken) continue;

        // Phát hiện rớt mạng nếu quá HEARTBEAT_TIMEOUT_MS không thấy ping/pong
        const lastSeen = this.lastSeenMap.get(h.playerToken);
        if (h.connected && lastSeen && now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
          h.connected = false;
          h.disconnectedAt = now;
          changed = true;
        }

        // Sau đúng 2 phút (120 giây) mất kết nối -> Máy (SmartAI) tự đánh thay để không kẹt ván
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

  private handleGuestConnectionClosed(conn: DataConnection): void {
    for (const [token, mapped] of this.guestConns.entries()) {
      if (mapped === conn) {
        this.guestConns.delete(token);
        this.markMemberDisconnected(token);
        break;
      }
    }
  }

  private markMemberDisconnected(token: string): void {
    if (!this.snapshot) return;
    const member = this.snapshot.humans.find((h) => h.playerToken === token);
    if (!member) return;

    if (this.snapshot.phase === 'LOBBY' && !member.isHost && this.isHost) {
      // Trong phòng chờ chưa bắt đầu: rời mạng là trả ghế trống ngay
      this.snapshot = {
        ...this.snapshot,
        humans: this.snapshot.humans.filter((h) => h.playerToken !== token),
        updatedAt: Date.now(),
      };
      this.emitSnapshot();
      this.broadcastSnapshot();
      return;
    }

    if (member.connected) {
      member.connected = false;
      member.disconnectedAt = Date.now();
      this.snapshot = {
        ...this.snapshot,
        humans: this.snapshot.humans.map((h) => (h.playerToken === token ? { ...member } : h)),
        updatedAt: Date.now(),
      };
      this.emitSnapshot();
      if (this.isHost) {
        this.broadcastSnapshot();
      }
    }
  }

  private handleIncomingPacket(packet: WirePacket, conn: DataConnection | null): void {
    if (packet.senderToken === this.playerToken) return;
    if (this.seenMsgIds.has(packet.msgId)) return;
    this.seenMsgIds.add(packet.msgId);
    if (this.seenMsgIds.size > 400) {
      const oldest = Array.from(this.seenMsgIds).slice(0, 150);
      oldest.forEach((id) => this.seenMsgIds.delete(id));
    }

    this.lastSeenMap.set(packet.senderToken, Date.now());

    switch (packet.type) {
      case 'PING': {
        if (this.snapshot) {
          const sender = this.snapshot.humans.find((h) => h.playerToken === packet.senderToken);
          if (sender && !sender.connected) {
            sender.connected = true;
            sender.disconnectedAt = null;
            sender.botTakeover = false;
            this.snapshot = {
              ...this.snapshot,
              humans: this.snapshot.humans.map((h) =>
                h.playerToken === sender.playerToken ? { ...sender } : h,
              ),
              updatedAt: Date.now(),
            };
            this.emitSnapshot();
            if (this.isHost) this.broadcastSnapshot();
          }
        }
        this.sendReply(conn, {
          msgId: generateRandomId('pong'),
          senderToken: this.playerToken,
          type: 'PONG',
          sentAt: packet.sentAt,
        });
        break;
      }

      case 'PONG': {
        break;
      }

      case 'JOIN_REQUEST': {
        if (!this.isHost || !this.snapshot || packet.roomCode !== this.roomCode) return;
        if (conn) {
          this.guestConns.set(packet.playerToken, conn);
        }
        this.lastSeenMap.set(packet.playerToken, Date.now());

        const existing = this.snapshot.humans.find((h) => h.playerToken === packet.playerToken);
        if (existing) {
          // Người chơi cũ quay lại trong thời hạn 2 phút -> Khôi phục đúng ghế cũ!
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
          this.sendReply(conn, {
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
          this.sendReply(conn, {
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
        this.callbacks.onStatusChange('ERROR', packet.reason);
        this.callbacks.onRoomClosed(packet.reason);
        this.destroy();
        break;
      }

      case 'ROOM_SNAPSHOT': {
        if (this.isHost) return;
        // Nếu khách đang giữ bản matchVersion mới hơn (khi Chủ phòng vừa F5), gửi ngược lại để khôi phục Chủ phòng!
        if (
          this.snapshot &&
          this.snapshot.phase === 'PLAYING' &&
          this.snapshot.matchVersion > packet.snapshot.matchVersion
        ) {
          this.sendReply(conn, {
            msgId: generateRandomId('rehyd'),
            senderToken: this.playerToken,
            type: 'HOST_REHYDRATE',
            snapshot: this.snapshot,
          });
          return;
        }

        this.joinResolved = true;
        this.snapshot = packet.snapshot;
        if (this.reconnectTimer !== null) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.callbacks.onStatusChange('READY', `Đã kết nối phòng #${this.roomCode}`);
        this.emitSnapshot();
        break;
      }

      case 'HOST_REHYDRATE': {
        if (!this.isHost) return;
        if (!this.snapshot || packet.snapshot.matchVersion > this.snapshot.matchVersion) {
          const restored: OnlineRoomSnapshot = {
            ...packet.snapshot,
            humans: packet.snapshot.humans.map((h) =>
              h.playerToken === this.playerToken
                ? { ...h, connected: true, disconnectedAt: null, botTakeover: false }
                : h,
            ),
            updatedAt: Date.now(),
          };
          this.snapshot = restored;
          this.emitSnapshot();
          this.broadcastSnapshot();
        }
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

        if (this.snapshot) {
          this.snapshot = {
            ...this.snapshot,
            phase: 'PLAYING',
            matchState: packet.resultingState,
            matchVersion: Math.max(this.snapshot.matchVersion, packet.matchVersion),
            updatedAt: Date.now(),
          };
          this.emitSnapshot();
        }

        // Nếu là Chủ phòng nhận nước đi từ 1 Khách -> phát tán lại cho tất cả Khách khác
        if (this.isHost) {
          this.broadcastToPeerConns(packet, packet.senderToken);
        }

        this.callbacks.onRemoteAction({
          actionId: packet.actionId,
          action: packet.action,
          rollPower: packet.rollPower,
          resultingState: packet.resultingState,
          matchVersion: packet.matchVersion,
        });
        break;
      }

      case 'LEAVE_ROOM': {
        if (!this.isHost || !this.snapshot) return;
        this.guestConns.delete(packet.playerToken);
        this.markMemberDisconnected(packet.playerToken);
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
    }
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
    this.sendToHost({
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
      // Nếu màu đất đang bị 1 người thật khác giữ -> từ chối trùng màu; nếu do Bot giữ -> hoán đổi mượt với Bot
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
    const conn = this.guestConns.get(targetToken) ?? null;
    this.sendReply(conn, {
      msgId: generateRandomId('kick'),
      senderToken: this.playerToken,
      type: 'KICKED',
      targetToken,
      reason: 'Chủ phòng đã mời bạn rời khỏi phòng chờ.',
    });
    this.guestConns.delete(targetToken);
    this.snapshot = {
      ...this.snapshot,
      humans: this.snapshot.humans.filter((h) => h.playerToken !== targetToken),
      updatedAt: Date.now(),
    };
    this.emitSnapshot();
    this.broadcastSnapshot();
  }

  /** Chủ phòng bấm BẮT ĐẦU VÁN CHƠI (khi tổng Người đã vào + Máy >= 2) */
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

    // Gán seatId khớp chính xác với p_1, p_2... trong GameState
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

  /** Phát nước đi đã thực thi lên toàn bộ phòng (đồng bộ xúc xắc + kết quả state 100%) */
  public broadcastCommittedAction(
    action: GameAction,
    rollPower: number,
    resultingState: GameState,
  ): void {
    if (!this.snapshot) return;
    const actionId = generateRandomId('act');
    this.seenActionIds.add(actionId);
    const nextVer = this.snapshot.matchVersion + 1;

    this.snapshot = {
      ...this.snapshot,
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
      resultingState,
      matchVersion: nextVer,
    };

    if (this.isHost) {
      this.broadcastAll(packet);
    } else {
      this.sendToHost(packet);
    }
  }

  /** Giải tán phòng (dùng khi kết thúc ván Online hoặc Chủ phòng hủy phòng) */
  public dissolveOrLeave(reason = 'Phòng Online đã được giải tán.'): void {
    clearPersistedOnlineSession();
    if (this.isHost) {
      this.broadcastAll({
        msgId: generateRandomId('dis'),
        senderToken: this.playerToken,
        type: 'DISSOLVE_ROOM',
        reason,
      });
    } else {
      this.sendToHost({
        msgId: generateRandomId('lv'),
        senderToken: this.playerToken,
        type: 'LEAVE_ROOM',
        playerToken: this.playerToken,
      });
    }
    this.destroy();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.graceCheckTimer !== null) {
      clearInterval(this.graceCheckTimer);
      this.graceCheckTimer = null;
    }
    if (this.reconnectTimer !== null) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.hostConn?.close();
    } catch {
      // Ignore
    }
    for (const c of this.guestConns.values()) {
      try {
        c.close();
      } catch {
        // Ignore
      }
    }
    this.guestConns.clear();
    try {
      this.peer?.destroy();
    } catch {
      // Ignore
    }
    this.peer = null;
    try {
      this.broadcastChannel?.close();
    } catch {
      // Ignore
    }
    this.broadcastChannel = null;
  }

  private emitSnapshot(): void {
    if (this.snapshot) {
      this.callbacks.onSnapshot({
        ...this.snapshot,
        humans: this.snapshot.humans.map((h) => ({ ...h })),
        bots: this.snapshot.bots.map((b) => ({ ...b })),
      });
    }
  }

  private broadcastSnapshot(): void {
    if (!this.snapshot) return;
    this.broadcastAll({
      msgId: generateRandomId('snap'),
      senderToken: this.playerToken,
      type: 'ROOM_SNAPSHOT',
      snapshot: this.snapshot,
    });
  }

  private broadcastAll(packet: WirePacket): void {
    this.sendBroadcast(packet);
    this.broadcastToPeerConns(packet);
  }

  private broadcastToPeerConns(packet: WirePacket, excludeToken?: string): void {
    for (const [token, conn] of this.guestConns.entries()) {
      if (excludeToken && token === excludeToken) continue;
      this.sendPacketToConn(conn, packet);
    }
  }

  private sendToHost(packet: WirePacket): void {
    this.sendBroadcast(packet);
    if (this.hostConn?.open) {
      this.sendPacketToConn(this.hostConn, packet);
    }
  }

  private sendReply(conn: DataConnection | null, packet: WirePacket): void {
    this.sendBroadcast(packet);
    if (conn?.open) {
      this.sendPacketToConn(conn, packet);
    }
  }

  private sendBroadcast(packet: WirePacket): void {
    if (!this.broadcastChannel) return;
    try {
      this.broadcastChannel.postMessage(packet);
    } catch {
      // Ignore
    }
  }

  private sendPacketToConn(conn: DataConnection, packet: WirePacket): void {
    if (!conn.open) return;
    try {
      conn.send(packet);
    } catch {
      // Ignore
    }
  }
}
