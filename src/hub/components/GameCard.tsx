import { Play } from 'lucide-react';
import type { IGameEntry } from '@/shared/types/gameEntry';

interface GameCardProps {
  game: IGameEntry;
  index: number;
  isFocused: boolean;
  onFocus: (index: number) => void;
  onSelect: (game: IGameEntry) => void;
}

export function GameCard({
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
          ? `0 20px 38px rgba(0, 0, 0, 0.52), 0 0 34px ${theme.glowColor}`
          : `0 10px 20px rgba(0, 0, 0, 0.35), 0 0 10px ${theme.glowColor}`,
      }}
      className={`animate-hub-card group relative shrink-0 snap-center select-none cursor-pointer transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 ${
        isFocused
          ? 'z-10 w-[274px] -translate-y-2 rounded-[24px] p-[3.5px] sm:w-[308px]'
          : 'w-[196px] rounded-[20px] p-[3px] opacity-92 hover:-translate-y-1 hover:opacity-100 sm:w-[214px]'
      }`}
    >
      {/* Thân thẻ kính mờ UIverse */}
      <div
        className={`relative flex h-full w-full flex-col overflow-hidden border border-white/25 transition-all duration-300 ${
          isFocused ? 'rounded-[20.5px] p-2.5 pb-3.5' : 'rounded-[17px] p-2 pb-3'
        }`}
        style={{ background: theme.glassBackground }}
      >
        {/* Khung ảnh bìa trò chơi (nằm gọn trong src/games/<id>/assets/) */}
        <div
          className={`relative w-full overflow-hidden border border-white/45 bg-stone-900/40 transition-all duration-300 ${
            isFocused ? 'h-[264px] rounded-[15px] sm:h-[282px]' : 'h-[236px] rounded-[13px] sm:h-[248px]'
          }`}
        >
          <img
            src={game.coverUrl}
            alt={game.title}
            draggable={false}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.04]"
          />

          {/* Huy hiệu trạng thái nhỏ khi thẻ thu gọn hoặc góc trên khi game chưa code đang phóng to */}
          {!isFocused ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <div
                className="uiverse-dome-shine relative flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-black tracking-wide text-white"
                style={{
                  background: theme.badgeGradient,
                  boxShadow: `0 4px 0 ${theme.badgeLipColor}, 0 8px 16px rgba(0, 0, 0, 0.38)`,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full ring-2 ring-white/90"
                  style={{ backgroundColor: theme.badgeDotColor }}
                />
                <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                  {isReady ? 'ĐANG MỞ' : 'SẮP RA MẮT'}
                </span>
              </div>
            </div>
          ) : (
            !isReady && (
              <div className="pointer-events-none absolute right-2.5 top-2.5">
                <div
                  className="uiverse-dome-shine relative flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black tracking-wide text-white"
                  style={{
                    background: theme.badgeGradient,
                    boxShadow: `0 3px 0 ${theme.badgeLipColor}, 0 6px 12px rgba(0, 0, 0, 0.38)`,
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

        {/* Đường sáng kính phân cách ảnh và chân thẻ */}
        <div
          className="mx-1 mt-2.5 h-[2px] rounded-full opacity-90"
          style={{ background: theme.accentGradient }}
        />

        {isFocused ? (
          /* Bất kỳ game nào được click phóng to đều hiển thị y chuẩn Cờ Tỷ Phú + nút CHƠI NGAY */
          <div className="mt-2.5 flex flex-col items-center px-2.5">
            <h2 className="text-center text-[22px] font-black tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]">
              {game.title}
            </h2>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(game);
              }}
              className="uiverse-push-btn uiverse-dome-shine mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[18px] font-black tracking-wide text-white cursor-pointer"
              style={{
                background: theme.badgeGradient,
                boxShadow: `0 7px 0 ${theme.badgeLipColor}, 0 12px 22px ${theme.glowColor}`,
              }}
            >
              <Play className="h-5 w-5 fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
              <span className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]">CHƠI NGAY</span>
            </button>
          </div>
        ) : (
          /* Thẻ thu gọn: Tiêu đề + thanh sáng UIverse */
          <div className="mt-2.5 flex flex-col items-center px-2">
            <h2 className="text-center text-[17px] font-black tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]">
              {game.title}
            </h2>
            <div
              className="mt-2 h-1 w-14 rounded-full"
              style={{ background: theme.accentGradient }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
