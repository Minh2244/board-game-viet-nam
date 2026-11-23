import { useEffect, useState } from 'react';
import { GAME_CATALOG } from '@/games/registry';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import type { GameId, IGameEntry } from '@/shared/types/gameEntry';
import { ComingSoonModal } from './components/ComingSoonModal';
import { DiceLogoBadge } from './components/DiceLogoBadge';
import { HorizontalGameShelf } from './components/HorizontalGameShelf';
import { ThemeSwitcherDock } from './components/ThemeSwitcherDock';
import { HUB_BG_WARM_WOOD_URL, HUB_THEMES, type HubThemeId } from './themes';

interface HubScreenProps {
  onLaunchGame: (gameId: GameId) => void;
}

export function HubScreen({ onLaunchGame }: HubScreenProps) {
  const [activeTheme, setActiveTheme] = useState<HubThemeId>('wood');
  const [comingSoonGame, setComingSoonGame] = useState<IGameEntry | null>(null);
  const [themeNotice, setThemeNotice] = useState<string | null>(null);
  const muted = useAudioStore((s) => s.muted);

  const themeConfig = HUB_THEMES[activeTheme];

  useEffect(() => {
    soundEngine.setHubActive(true);

    const unlockAndPlayBgm = () => {
      if (!useAudioStore.getState().muted) {
        soundEngine.startHubBgm();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        soundEngine.stopHubBgm();
      } else {
        soundEngine.setHubActive(true);
        if (!useAudioStore.getState().muted) {
          soundEngine.startHubBgm();
        }
      }
    };

    window.addEventListener('pointerdown', unlockAndPlayBgm, { passive: true });
    window.addEventListener('keydown', unlockAndPlayBgm, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pointerdown', unlockAndPlayBgm);
      window.removeEventListener('keydown', unlockAndPlayBgm);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!muted) {
      soundEngine.startHubBgm();
    }
  }, [muted]);

  const handleSelectTheme = (id: HubThemeId) => {
    setActiveTheme(id);
    if (HUB_THEMES[id].comingSoonInV1) {
      setThemeNotice(`Đang xem thử tông màu ${HUB_THEMES[id].label.replace(' (Xem thử)', '')} — mặc định v1.0 là Gỗ Nắng Ấm`);
    } else {
      setThemeNotice(null);
    }
  };

  const handleSelectGame = (game: IGameEntry) => {
    if (game.status === 'READY' && game.loader) {
      soundEngine.playEnterGame();
      onLaunchGame(game.id);
      return;
    }
    soundEngine.playComingSoon();
    setComingSoonGame(game);
  };

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-x-hidden overflow-y-auto select-none">
      {/* Ảnh nền Bàn Gỗ Nắng Ấm với bóng lá dừa (đúng y mockup đã duyệt) */}
      <img
        src={HUB_BG_WARM_WOOD_URL}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Lớp phủ ánh sáng / xem thử theme */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-all duration-300"
        style={{ background: themeConfig.overlayTint }}
      />

      {/* Nội dung chính Sảnh Chọn Game */}
      <div className="relative z-10 flex min-h-full w-full min-w-0 flex-col justify-between py-3 sm:py-5">
        {/* Thanh trên: Logo Sảnh + Cụm Âm thanh & Đổi màu */}
        <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-2 px-3 sm:flex-nowrap sm:gap-4 sm:px-8">
          <DiceLogoBadge />
          <ThemeSwitcherDock activeTheme={activeTheme} onSelectTheme={handleSelectTheme} />
        </header>

        {/* Thông báo nhẹ nếu người dùng thử bấm qua theme phụ */}
        {themeNotice && (
          <div className="mx-auto mt-2 max-w-[92%] rounded-full border border-white/30 bg-slate-900/85 px-4 py-1 text-center text-xs font-medium text-amber-100 backdrop-blur-md">
            {themeNotice}
          </div>
        )}

        {/* Tiêu đề trung tâm + Dải 5 thẻ game kéo ngang UIverse */}
        <main className="my-auto flex w-full min-w-0 flex-col items-center pt-2 pb-2 sm:pt-3">
          <h1 className="px-3 text-center text-2xl font-black tracking-wide text-white drop-shadow-[0_3px_10px_rgba(32,16,4,0.68)] sm:text-4xl">
            SẢNH BOARD GAME VIỆT NAM
          </h1>

          <div className="mt-1 w-full min-w-0 max-w-[1440px] sm:mt-2">
            <HorizontalGameShelf games={GAME_CATALOG} onSelectGame={handleSelectGame} />
          </div>
        </main>

        {/* Khoảng đệm đáy giữ tỷ lệ thoáng đúng theo ảnh mockup */}
        <footer className="h-2 sm:h-4" aria-hidden="true" />
      </div>

      <ComingSoonModal game={comingSoonGame} onClose={() => setComingSoonGame(null)} />
    </div>
  );
}
