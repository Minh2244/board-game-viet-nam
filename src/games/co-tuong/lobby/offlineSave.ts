import type { XiangqiBotDifficulty, XiangqiColor, XiangqiState } from '../engine/types';

const OFFLINE_SAVE_KEY = 'bgvn_cotuong_offline_save_v1';

export interface SavedOfflineXiangqiMatch {
  version: 1;
  savedAt: number;
  mode: 'vs-bot' | 'pass-and-play';
  botDifficulty: XiangqiBotDifficulty;
  humanColor: XiangqiColor;
  state: XiangqiState;
}

export function saveOfflineXiangqiMatch(
  payload: Omit<SavedOfflineXiangqiMatch, 'version' | 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed: XiangqiState = {
      ...payload.state,
      undoStack: payload.state.undoStack.slice(-10),
    };
    const record: SavedOfflineXiangqiMatch = {
      version: 1,
      savedAt: Date.now(),
      ...payload,
      state: trimmed,
    };
    window.localStorage.setItem(OFFLINE_SAVE_KEY, JSON.stringify(record));
  } catch {
    // Ignore
  }
}

export function loadOfflineXiangqiMatch(): SavedOfflineXiangqiMatch | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedOfflineXiangqiMatch;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.board) ||
      parsed.state.board.length !== 90 ||
      parsed.state.phase === 'GAME_OVER'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineXiangqiMatch(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_SAVE_KEY);
  } catch {
    // Ignore
  }
}
