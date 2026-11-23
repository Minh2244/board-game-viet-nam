import { readJson, removeKey, writeJson } from '@/shared/storage/local';
import type { GameState } from '../engine/types';

const OFFLINE_SAVE_KEY = 'bgvn_cotyphu_offline_save_v8';

export function saveOfflineGame(state: GameState): void {
  if (state.phase === 'GAME_OVER') {
    removeKey(OFFLINE_SAVE_KEY);
    return;
  }
  writeJson(OFFLINE_SAVE_KEY, state);
}

export function loadOfflineGame(): GameState | null {
  const saved = readJson<GameState | null>(OFFLINE_SAVE_KEY, null);
  if (
    !saved ||
    saved.version !== 1 ||
    !Array.isArray(saved.players) ||
    saved.players.length < 2 ||
    !Array.isArray(saved.tiles) ||
    saved.tiles.length !== 52 ||
    saved.tiles[3]?.kind !== 'CHANCE' ||
    saved.tiles[12]?.kind !== 'FATE' ||
    saved.tiles[14]?.kind !== 'TAX' ||
    saved.tiles[16]?.kind !== 'VISIT_JAIL' ||
    saved.tiles[19]?.kind !== 'CHANCE' ||
    saved.tiles[26]?.kind !== 'AIRPORT' ||
    saved.tiles[29]?.kind !== 'CHANCE' ||
    saved.tiles[40]?.kind !== 'FATE' ||
    saved.tiles[49]?.kind !== 'FATE' ||
    saved.tiles.filter((t) => t.kind === 'PROPERTY').length !== 34 ||
    saved.phase === 'GAME_OVER'
  ) {
    return null;
  }
  return saved;
}

export function clearOfflineGame(): void {
  removeKey(OFFLINE_SAVE_KEY);
}
