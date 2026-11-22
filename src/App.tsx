import { lazy, Suspense, useMemo, useState } from 'react';
import { GAME_CATALOG } from '@/games/registry';
import { HubScreen } from '@/hub/HubScreen';
import type { GameId } from '@/shared/types/gameEntry';
import { LandscapeViewport } from '@/shared/ui/LandscapeViewport';

export function App() {
  const [activeGameId, setActiveGameId] = useState<GameId | null>(null);

  const ActiveGameComponent = useMemo(() => {
    if (!activeGameId) return null;
    const entry = GAME_CATALOG.find((g) => g.id === activeGameId);
    if (!entry?.loader) return null;
    return lazy(entry.loader);
  }, [activeGameId]);

  return (
    <LandscapeViewport>
      {!ActiveGameComponent ? (
        <HubScreen onLaunchGame={(id) => setActiveGameId(id)} />
      ) : (
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-stone-950 text-lg font-bold text-amber-200">
              Đang mở trò chơi...
            </div>
          }
        >
          <ActiveGameComponent onExitToHub={() => setActiveGameId(null)} />
        </Suspense>
      )}
    </LandscapeViewport>
  );
}

export default App;
