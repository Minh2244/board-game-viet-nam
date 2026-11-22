import { Clock, Users, X } from 'lucide-react';
import { soundEngine } from '@/shared/audio/soundEngine';
import type { IGameEntry } from '@/shared/types/gameEntry';

interface ComingSoonModalProps {
  game: IGameEntry | null;
  onClose: () => void;
}

export function ComingSoonModal({ game, onClose }: ComingSoonModalProps) {
  if (!game) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => {
        soundEngine.playPushClick();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coming-soon-title"
    >
      <div
        className="relative w-full max-w-md rounded-[26px] p-[3px] shadow-[0_24px_48px_rgba(0,0,0,0.6)]"
        style={{ background: game.theme.borderGradient }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative overflow-hidden rounded-[23px] p-5 text-white"
          style={{ background: game.theme.glassBackground }}
        >
          <button
            type="button"
            onClick={() => {
              soundEngine.playPushClick();
              onClose();
            }}
            aria-label="Đóng thông báo"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 transition hover:bg-black/65 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
            <img
              src={game.coverUrl}
              alt={game.title}
              className="h-44 w-36 shrink-0 rounded-2xl border border-white/40 object-cover shadow-lg"
            />
            <div className="mt-3 sm:mt-1 flex-1">
              <div
                className="uiverse-dome-shine relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black tracking-wide text-white"
                style={{
                  background: game.theme.badgeGradient,
                  boxShadow: `0 3px 0 ${game.theme.badgeLipColor}`,
                }}
              >
                <Clock className="h-3.5 w-3.5" />
                SẮP RA MẮT
              </div>

              <h3 id="coming-soon-title" className="mt-2.5 text-2xl font-black tracking-wide">
                {game.title}
              </h3>

              <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                {game.subtitle}
              </p>

              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                  <Users className="h-3.5 w-3.5" />
                  {game.playersBadge}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-center text-sm text-amber-100/95">
            Tựa game đang được phát triển trong thư mục riêng và <strong>sẽ sớm ra mắt</strong> sau khi hoàn thiện Cờ Tỷ Phú 3D!
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playPushClick();
              onClose();
            }}
            className="uiverse-push-btn uiverse-dome-shine mt-4 w-full rounded-full py-2.5 text-base font-black text-white cursor-pointer"
            style={{
              background: game.theme.badgeGradient,
              boxShadow: `0 5px 0 ${game.theme.badgeLipColor}`,
            }}
          >
            ĐÃ HIỂU — QUAY LẠI SẢNH
          </button>
        </div>
      </div>
    </div>
  );
}
