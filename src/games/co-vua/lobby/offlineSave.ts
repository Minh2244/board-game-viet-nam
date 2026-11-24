import type { ChessBotDifficulty, ChessColor, ChessState } from '../engine/types';

const OFFLINE_SAVE_KEY = 'bgvn_covua_offline_save_v1';

export interface SavedOfflineChessMatch {
  version: 1;
  savedAt: number;
  mode: 'vs-bot' | 'pass-and-play';
  botDifficulty: ChessBotDifficulty;
  humanColor: ChessColor;
  autoFlip: boolean;
  state: ChessState;
}

export function saveOfflineChessMatch(
  payload: Omit<SavedOfflineChessMatch, 'version' | 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmedState: ChessState = {
      ...payload.state,
      undoStack: payload.state.undoStack.slice(-10),
    };
    const record: SavedOfflineChessMatch = {
      version: 1,
      savedAt: Date.now(),
      ...payload,
      state: trimmedState,
    };
    window.localStorage.setItem(OFFLINE_SAVE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineChessMatch(): SavedOfflineChessMatch | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedOfflineChessMatch;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.board) ||
      parsed.state.board.length !== 64 ||
      parsed.state.phase === 'GAME_OVER'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineChessMatch(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_SAVE_KEY);
  } catch {
    // Ignore
  }
}
