import type { CoCaNguaState, HorseBotDifficulty } from '../engine/types';

const OFFLINE_SAVE_KEY = 'bgvn_cocangua_offline_save_v1';

export interface SavedOfflineCoCaNguaMatch {
  version: 1;
  savedAt: number;
  mode: 'vs-bot' | 'pass-and-play';
  botDifficulty: HorseBotDifficulty;
  state: CoCaNguaState;
}

export function saveOfflineCoCaNguaMatch(
  payload: Omit<SavedOfflineCoCaNguaMatch, 'version' | 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const record: SavedOfflineCoCaNguaMatch = {
      version: 1,
      savedAt: Date.now(),
      ...payload,
    };
    window.localStorage.setItem(OFFLINE_SAVE_KEY, JSON.stringify(record));
  } catch {
    // Bỏ qua lỗi giới hạn bộ nhớ trình duyệt
  }
}

export function loadOfflineCoCaNguaMatch(): SavedOfflineCoCaNguaMatch | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedOfflineCoCaNguaMatch;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.players) ||
      parsed.state.players.length < 2 ||
      parsed.state.players.length > 4 ||
      !Array.isArray(parsed.state.horses) ||
      parsed.state.horses.length !== parsed.state.players.length * 4 ||
      parsed.state.phase === 'GAME_OVER'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineCoCaNguaMatch(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_SAVE_KEY);
  } catch {
    // Ignore
  }
}
