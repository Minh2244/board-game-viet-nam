import { memo } from 'react';
import { Play } from 'lucide-react';
import type { IGameEntry } from '@/shared/types/gameEntry';

interface GameCardProps {
  game: IGameEntry;
  index: number;
  isFocused: boolean;
  onFocus: (index: number) => void;
  onSelect: (game: IGameEntry) => void;
}

/**
 * Thẻ Game tối ưu GPU 60fps:
 * Dùng kích thước khung ổn định + chỉ animate `transform: scale()` (tuyệt đối KHÔNG animate width/height gây reflow trên điện thoại!)
 */
export const GameCard = memo(function GameCard({
  game,
  index,
  isFocused,
  onFocus,
  onSelect,
}: GameCardProps) {
  const isReady = game.status === 'READY';
  const { theme } = game;

  const handleCardClick = () => {
    if (!isFocused) {
      onFocus(index);
      return;
    }
    onSelect(game);
  };

  return (
    <div
      data-card-index={index}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-pressed={isFocused}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      style={{
        animationDelay: `${index * 45}ms`,
        background: theme.borderGradient,
        boxShadow: isFocused
          ? `0 18px 32px rgba(0, 0, 0, 0.48), 0 0 28px ${theme.glowColor}`
          : `0 8px 18px rgba(0, 0, 0, 0.34)`,
      }}
      className={`animate-hub-card mobile-flat-shadow group relative w-[256px] shrink-0 snap-center select-none cursor-pointer rounded-[22px] p-[3px] transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 sm:w-[272px] ${
        isFocused
          ? 'z-10 scale-100 -translate-y-1.5 opacity-100'
          : 'scale-[0.86] opacity-88 hover:scale-[0.9] hover:opacity-100'
      }`}
    >
      {/* Thân thẻ kính UIverse */}
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[19px] border border-white/25 p-2.5 pb-3"
        style={{ background: theme.glassBackground }}
      >
        {/* Khung ảnh bìa trò chơi (cố định chiều cao — không gây reflow khi chuyển thẻ) */}
        <div className="relative h-[238px] w-full overflow-hidden rounded-[14px] border border-white/45 bg-stone-900/40 sm:h-[260px]">
          <img
            src={game.coverUrl}
            alt={game.title}
            draggable={false}
            decoding="async"
            className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.03]"
          />

          {/* Huy hiệu trạng thái */}
          {!isFocused ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <div
                className="uiverse-dome-shine relative flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-black tracking-wide text-white"
                style={{
                  background: theme.badgeGradient,
                  boxShadow: `0 4px 0 ${theme.badgeLipColor}, 0 6px 14px rgba(0, 0, 0, 0.35)`,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full ring-2 ring-white/90"
                  style={{ backgroundColor: theme.badgeDotColor }}
                />
                <span>{isReady ? 'ĐANG MỞ' : 'SẮP RA MẮT'}</span>
              </div>
            </div>
          ) : (
            !isReady && (
              <div className="pointer-events-none absolute right-2.5 top-2.5">
                <div
                  className="uiverse-dome-shine relative flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black tracking-wide text-white"
                  style={{
                    background: theme.badgeGradient,
                    boxShadow: `0 3px 0 ${theme.badgeLipColor}`,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full ring-2 ring-white/90"
                    style={{ backgroundColor: theme.badgeDotColor }}
                  />
                  <span>SẮP RA MẮT</span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Đường sáng phân cách ảnh và chân thẻ */}
        <div
          className="mx-1 mt-2.5 h-[2px] rounded-full opacity-90"
          style={{ background: theme.accentGradient }}
        />

        {/* Chân thẻ chiều cao ổn định tránh nhảy bố cục */}
        <div className="mt-2.5 flex min-h-[86px] flex-col items-center justify-center px-2">
          <h2 className="text-center text-[20px] font-black tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            {game.title}
          </h2>

          {isFocused ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(game);
              }}
              className="uiverse-push-btn uiverse-dome-shine mt-2.5 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[16px] font-black tracking-wide text-white cursor-pointer"
              style={{
                background: theme.badgeGradient,
                boxShadow: `0 6px 0 ${theme.badgeLipColor}, 0 10px 18px ${theme.glowColor}`,
              }}
            >
              <Play className="h-4 w-4 fill-white" />
              <span>CHƠI NGAY</span>
            </button>
          ) : (
            <div
              className="mt-3 h-1 w-14 rounded-full"
              style={{ background: theme.accentGradient }}
            />
          )}
        </div>
      </div>
    </div>
  );
});
