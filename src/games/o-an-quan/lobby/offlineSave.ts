import type { BotDifficulty, OAnQuanState } from '../engine/types';

const OFFLINE_SAVE_KEY = 'bgvn_oanquan_offline_save_v1';

export interface SavedOfflineOAnQuanMatch {
  version: 1;
  savedAt: number;
  mode: 'vs-bot' | 'pass-and-play';
  botDifficulty: BotDifficulty;
  state: OAnQuanState;
}

export function saveOfflineOAnQuanMatch(payload: Omit<SavedOfflineOAnQuanMatch, 'version' | 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const record: SavedOfflineOAnQuanMatch = {
      version: 1,
      savedAt: Date.now(),
      ...payload,
    };
    window.localStorage.setItem(OFFLINE_SAVE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineOAnQuanMatch(): SavedOfflineOAnQuanMatch | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedOfflineOAnQuanMatch;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.pits) ||
      parsed.state.pits.length !== 12 ||
      parsed.state.phase === 'GAME_OVER'
    ) {
      return null;
    }
    // Tương thích ngược với ván lưu cũ chưa có trường mandarinPointValue
    if (parsed.state.rules) {
      parsed.state.rules.mandarinPointValue = parsed.state.rules.mandarinPointValue === 5 ? 5 : 10;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineOAnQuanMatch(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_SAVE_KEY);
  } catch {
    // Ignore
  }
}
