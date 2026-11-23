import { Music, Volume2, VolumeX } from 'lucide-react';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { HUB_THEMES, type HubThemeId } from '../themes';

interface ThemeSwitcherDockProps {
  activeTheme: HubThemeId;
  onSelectTheme: (id: HubThemeId) => void;
}

const THEME_ORDER: HubThemeId[] = ['wood', 'mint', 'sunset', 'neon'];

export function ThemeSwitcherDock({ activeTheme, onSelectTheme }: ThemeSwitcherDockProps) {
  const { muted, bgmPlaying, toggleMute, setMuted } = useAudioStore();

  const handleMuteToggle = () => {
    const wasMuted = muted;
    toggleMute();
    if (wasMuted) {
      soundEngine.setHubActive(true);
      soundEngine.startHubBgm();
      soundEngine.playPushClick();
    }
  };

  const handleStartListen = () => {
    if (muted) setMuted(false);
    soundEngine.setHubActive(true);
    soundEngine.startHubBgm();
    soundEngine.playPushClick();
  };

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      {!bgmPlaying && (
        <button
          type="button"
          onClick={handleStartListen}
          className="uiverse-push-btn inline-flex items-center gap-1.5 rounded-full border border-amber-200/75 bg-amber-500/85 px-3.5 py-2 text-xs font-black text-slate-950 shadow-lg transition hover:bg-amber-400 cursor-pointer"
        >
          <Music className="h-3.5 w-3.5 animate-bounce" />
          Bấm nghe nhạc sảnh
        </button>
      )}
      {/* Nút Loa 3D nhấn lún kiểu UIverse */}
      <button
        type="button"
        onClick={handleMuteToggle}
        title={muted ? 'Bật âm thanh sảnh' : 'Tắt âm thanh sảnh'}
        aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        className="uiverse-push-btn uiverse-dome-shine relative flex h-10 w-10 items-center justify-center rounded-full border border-white/45 text-white cursor-pointer sm:h-14 sm:w-14"
        style={{
          background: muted
            ? 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)'
            : 'linear-gradient(135deg, #FDE047 0%, #F59E0B 55%, #EA580C 100%)',
          boxShadow: muted
            ? '0 5px 0 #334155, 0 8px 18px rgba(0, 0, 0, 0.35)'
            : '0 5px 0 #9A3412, 0 8px 20px rgba(245, 158, 11, 0.45)',
        }}
      >
        {muted ? (
          <VolumeX className="h-5 w-5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] sm:h-6 sm:w-6" strokeWidth={2.5} />
        ) : (
          <Volume2 className="h-5 w-5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] sm:h-6 sm:w-6" strokeWidth={2.5} />
        )}
      </button>

      {/* Cụm 4 ô Đổi màu giao diện (Theme Swatches 2x2) */}
      <div
        className="relative rounded-xl p-[2px] shadow-[0_5px_0_#0F172A,0_8px_18px_rgba(0,0,0,0.42)] sm:rounded-2xl sm:p-[2.5px] sm:shadow-[0_6px_0_#0F172A,0_10px_22px_rgba(0,0,0,0.42)]"
        style={{
          background: 'linear-gradient(90deg, #34D399 0%, #38BDF8 35%, #F472B6 70%, #FBBF24 100%)',
        }}
      >
        <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-slate-900/95 p-1.5 backdrop-blur-md sm:gap-1.5 sm:rounded-[14px] sm:p-2">
          {THEME_ORDER.map((id) => {
            const cfg = HUB_THEMES[id];
            const isSelected = activeTheme === id;
            return (
              <button
                key={id}
                type="button"
                title={cfg.label}
                aria-label={`Chọn giao diện ${cfg.label}`}
                onClick={() => {
                  soundEngine.playPushClick();
                  onSelectTheme(id);
                }}
                className={`relative flex h-4 w-4 items-center justify-center rounded-[5px] transition-transform duration-150 cursor-pointer hover:scale-110 active:scale-95 sm:h-6 sm:w-6 sm:rounded-md ${
                  isSelected ? 'ring-2 ring-white shadow-[0_0_10px_rgba(253,224,71,0.75)]' : 'opacity-85 hover:opacity-100'
                }`}
                style={{ background: cfg.swatchGradient }}
              >
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white sm:h-2 sm:w-2 sm:ring-2" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
