import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { GAME_CATALOG } from '@/games/registry';
import { HubScreen } from '@/hub/HubScreen';
import { cleanGameUrlParams } from '@/shared/network/onlineTransportConfig';
import type { GameId } from '@/shared/types/gameEntry';
import { LandscapeViewport } from '@/shared/ui/LandscapeViewport';

const ACTIVE_GAME_STORAGE_KEY = 'bgvn_active_game_v1';

function resolveInitialGameId(): GameId | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    // Nếu có cờ test `?transport=http`, giữ trong sessionStorage của tab để kiểm thử 100% HTTP Long-Polling
    if (params.get('transport') === 'http') {
      window.sessionStorage.setItem('bgvn_force_http_only', '1');
    }

    const urlGame = params.get('game');
    const urlRoom = params.get('room') || '';
    const isValidInviteRoom = /^\d{6}$/.test(urlRoom);

    // Chỉ tự mở game từ URL khi là LINK MỜI PHÒNG ONLINE hợp lệ (?game=...&room=XXXXXX).
    // Nếu chỉ dính ?game=... lẻ (do copy nhầm link cũ) thì bỏ qua & dọn URL để luôn vào thẳng Sảnh Chính!
    if (
      urlGame &&
      isValidInviteRoom &&
      GAME_CATALOG.some((g) => g.id === urlGame && g.status === 'READY')
    ) {
      window.sessionStorage.setItem(ACTIVE_GAME_STORAGE_KEY, urlGame);
      return urlGame as GameId;
    }

    if (urlGame || urlRoom) {
      cleanGameUrlParams();
    }

    // Bấm F5 trên cùng tab cá nhân vẫn khôi phục đúng game đang mở qua sessionStorage (không ảnh hưởng máy khác!)
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
      // Giữ thanh địa chỉ luôn sạch tinh để khi gửi link web cho bạn bè sẽ không bị tự nhảy vào game!
      cleanGameUrlParams();
    } catch {
      // Ignore
    }
  }, []);

  const handleExitToHub = useCallback(() => {
    setActiveGameId(null);
    try {
      window.sessionStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
      cleanGameUrlParams();
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
