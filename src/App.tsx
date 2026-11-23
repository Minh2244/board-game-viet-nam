import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { GAME_CATALOG } from '@/games/registry';
import { HubScreen } from '@/hub/HubScreen';
import type { GameId } from '@/shared/types/gameEntry';
import { LandscapeViewport } from '@/shared/ui/LandscapeViewport';

const ACTIVE_GAME_STORAGE_KEY = 'bgvn_active_game_v1';

function resolveInitialGameId(): GameId | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const urlGame = params.get('game');
    if (urlGame && GAME_CATALOG.some((g) => g.id === urlGame && g.status === 'READY')) {
      window.sessionStorage.setItem(ACTIVE_GAME_STORAGE_KEY, urlGame);
      return urlGame as GameId;
    }
    const saved = window.sessionStorage.getItem(ACTIVE_GAME_STORAGE_KEY);
    if (saved && GAME_CATALOG.some((g) => g.id === saved && g.status === 'READY')) {
      return saved as GameId;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function App() {
  const [activeGameId, setActiveGameId] = useState<GameId | null>(() => resolveInitialGameId());

  const handleLaunchGame = useCallback((id: GameId) => {
    setActiveGameId(id);
    try {
      window.sessionStorage.setItem(ACTIVE_GAME_STORAGE_KEY, id);
      const url = new URL(window.location.href);
      url.searchParams.set('game', id);
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      // Ignore
    }
  }, []);

  const handleExitToHub = useCallback(() => {
    setActiveGameId(null);
    try {
      window.sessionStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete('game');
      url.searchParams.delete('room');
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      // Ignore
    }
  }, []);

  const ActiveGameComponent = useMemo(() => {
    if (!activeGameId) return null;
    const entry = GAME_CATALOG.find((g) => g.id === activeGameId);
    if (!entry?.loader) return null;
    return lazy(entry.loader);
  }, [activeGameId]);

  return (
    <LandscapeViewport>
      {!ActiveGameComponent ? (
        <HubScreen onLaunchGame={handleLaunchGame} />
      ) : (
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-stone-950 text-lg font-bold text-amber-200">
              Đang mở trò chơi...
            </div>
          }
        >
          <ActiveGameComponent onExitToHub={handleExitToHub} />
        </Suspense>
      )}
    </LandscapeViewport>
  );
}

export default App;
