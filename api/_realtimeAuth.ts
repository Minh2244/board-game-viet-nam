/**
 * Bộ ký TokenRequest bảo mật cho Ably WebSocket Pub/Sub (chuẩn WebCrypto HMAC-SHA256):
 * - Chạy mượt trên cả Vercel Edge Runtime (`sin1` Singapore) lẫn Vite Node dev/preview middleware (0 dependency).
 * - Đọc `process.env.ABLY_API_KEY` hoàn toàn trên server — KHÔNG BAO GIỜ lộ key gốc xuống trình duyệt.
 * - Giới hạn capability đúng 1 kênh phòng duy nhất (`bgvn:<game>:<roomCode>`) với thời hạn 60 phút.
 * - Nếu server chưa cấu hình `ABLY_API_KEY`, trả `{ enabled: false }` để client tự động dùng P2P + Upstash Long-Polling.
 */

export interface RealtimeTokenApiResult {
  status: number;
  body: Record<string, unknown>;
}

export interface SignedAblyTokenRequest {
  keyName: string;
  ttl: number;
  capability: string;
  clientId: string;
  timestamp: number;
  nonce: string;
  mac: string;
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 phút

function sanitizeGameId(raw: string): string {
  return raw.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'co-ty-phu';
}

function sanitizeClientId(raw: string): string {
  return raw.replace(/[^a-z0-9_.:-]/gi, '').slice(0, 64);
}

function isValidRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function buildAblyChannelName(game: string, roomCode: string): string {
  return `bgvn:${sanitizeGameId(game)}:${roomCode}`;
}

function randomNonceHex(byteLen = 16): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Ký Ably TokenRequest đúng chuẩn đặc tả chính thức của Ably:
 * `signText = keyName + "\n" + ttl + "\n" + capability + "\n" + clientId + "\n" + timestamp + "\n" + nonce + "\n"`
 */
export async function signAblyTokenRequest(params: {
  apiKey: string;
  channelName: string;
  clientId: string;
  ttlMs?: number;
  timestampMs?: number;
  nonce?: string;
}): Promise<SignedAblyTokenRequest> {
  const colonIdx = params.apiKey.indexOf(':');
  if (colonIdx <= 0 || colonIdx === params.apiKey.length - 1) {
    throw new Error('INVALID_ABLY_API_KEY_FORMAT');
  }

  const keyName = params.apiKey.slice(0, colonIdx).trim();
  const keySecret = params.apiKey.slice(colonIdx + 1).trim();
  const ttl = params.ttlMs ?? TOKEN_TTL_MS;
  const timestamp = params.timestampMs ?? Date.now();
  const nonce = params.nonce ?? randomNonceHex(16);
  const clientId = sanitizeClientId(params.clientId);
  const capability = JSON.stringify({
    [params.channelName]: ['publish', 'subscribe'],
  });

  const signText = `${keyName}\n${ttl}\n${capability}\n${clientId}\n${timestamp}\n${nonce}\n`;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signText));
  const mac = bytesToBase64(new Uint8Array(sigBuf));

  return {
    keyName,
    ttl,
    capability,
    clientId,
    timestamp,
    nonce,
    mac,
  };
}

/** Xử lý GET /api/realtime-token?game=...&code=...&clientId=... */
export async function handleRealtimeTokenGet(
  url: URL,
  overrideApiKey?: string | null,
): Promise<RealtimeTokenApiResult> {
  const apiKey = (
    overrideApiKey !== undefined ? overrideApiKey : process.env.ABLY_API_KEY || ''
  )?.trim();

  if (!apiKey) {
    return {
      status: 200,
      body: {
        ok: true,
        enabled: false,
        reason: 'ABLY_NOT_CONFIGURED',
      },
    };
  }

  const game = sanitizeGameId(url.searchParams.get('game') || 'co-ty-phu');
  const code = (url.searchParams.get('code') || '').trim();
  const clientId = sanitizeClientId(url.searchParams.get('clientId') || '');

  if (!isValidRoomCode(code)) {
    return {
      status: 400,
      body: {
        ok: false,
        enabled: false,
        error: 'INVALID_CODE',
        message: 'Mã phòng phải gồm đúng 6 chữ số.',
      },
    };
  }

  if (!clientId) {
    return {
      status: 400,
      body: {
        ok: false,
        enabled: false,
        error: 'MISSING_CLIENT_ID',
        message: 'Thiếu mã định danh thiết bị người chơi.',
      },
    };
  }

  try {
    const channelName = buildAblyChannelName(game, code);
    const tokenRequest = await signAblyTokenRequest({
      apiKey,
      channelName,
      clientId,
    });
    return {
      status: 200,
      body: {
        ok: true,
        enabled: true,
        channelName,
        tokenRequest,
      },
    };
  } catch {
    return {
      status: 200,
      body: {
        ok: true,
        enabled: false,
        reason: 'INVALID_ABLY_KEY',
      },
    };
  }
}
