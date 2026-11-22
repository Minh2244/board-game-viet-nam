import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from '@/shared/audio/soundEngine';
import type { IGameEntry } from '@/shared/types/gameEntry';
import { GameCard } from './GameCard';

interface HorizontalGameShelfProps {
  games: readonly IGameEntry[];
  onSelectGame: (game: IGameEntry) => void;
}

export function HorizontalGameShelf({ games, onSelectGame }: HorizontalGameShelfProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const programmaticUntilRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragState = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    movedDistance: 0,
  });

  const focusAndScrollToCard = useCallback(
    (targetIdx: number) => {
      const clamped = Math.max(0, Math.min(games.length - 1, targetIdx));
      setActiveIndex(clamped);
      programmaticUntilRef.current = Date.now() + 520;
      const container = scrollerRef.current;
      if (!container) return;

      if (container.scrollWidth <= container.clientWidth + 4) {
        return;
      }

      const cardEl = container.querySelector<HTMLElement>(`[data-card-index="${clamped}"]`);
      if (cardEl) {
        const containerCenter = container.clientWidth / 2;
        const cardCenter = cardEl.offsetLeft + cardEl.offsetWidth / 2;
        container.scrollTo({
          left: Math.max(0, cardCenter - containerCenter),
          behavior: 'smooth',
        });
      }
    },
    [games.length],
  );

  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (Date.now() < programmaticUntilRef.current) return;
      if (container.scrollWidth <= container.clientWidth + 4) return;
      const viewCenter = container.scrollLeft + container.clientWidth / 2;
      let nearest = 0;
      let bestDist = Infinity;
      container.querySelectorAll<HTMLElement>('[data-card-index]').forEach((el, idx) => {
        const c = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(c - viewCenter);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = idx;
        }
      });
      setActiveIndex(nearest);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth + 4) return;
    dragState.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: container.scrollLeft,
      movedDistance: 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active || !scrollerRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    dragState.current.movedDistance = Math.max(dragState.current.movedDistance, Math.abs(dx));
    if (dragState.current.movedDistance > 10) {
      if (!isDragging) setIsDragging(true);
      scrollerRef.current.scrollLeft = dragState.current.startScrollLeft - dx;
    }
  };

  const endDrag = () => {
    dragState.current.active = false;
    if (isDragging) setIsDragging(false);
    setTimeout(() => {
      dragState.current.movedDistance = 0;
    }, 60);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollerRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth + 4) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta !== 0) {
      container.scrollLeft += delta;
    }
  };

  const handleCardFocus = (idx: number) => {
    if (dragState.current.movedDistance > 12) return;
    soundEngine.playCarouselStep();
    focusAndScrollToCard(idx);
  };

  const handleCardSelect = (game: IGameEntry) => {
    if (dragState.current.movedDistance > 12) return;
    onSelectGame(game);
  };

  return (
    <div className="relative flex w-full max-w-full min-w-0 flex-col items-center">
      {/* Dải thẻ ngang UIverse — bấm thẻ nào thẻ đó phóng to nổi bật kèm nút CHƠI NGAY */}
      <div
        ref={scrollerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
        className={`no-scrollbar w-full min-w-0 snap-x snap-mandatory overflow-x-auto py-5 ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
        style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
      >
        <div className="flex w-max min-w-full items-center justify-center gap-4 px-[calc(50%-137px)] sm:gap-5 sm:px-6 lg:px-8">
          {games.map((game, idx) => (
            <GameCard
              key={game.id}
              game={game}
              index={idx}
              isFocused={idx === activeIndex}
              onFocus={handleCardFocus}
              onSelect={handleCardSelect}
            />
          ))}
        </div>
      </div>

      {/* Thanh chấm chỉ báo 5 game kiểu UIverse */}
      <div className="mt-1 flex items-center gap-2.5 rounded-full border border-white/30 bg-slate-900/90 px-4 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.45)] backdrop-blur-md">
        {games.map((game, idx) => {
          const isCurrent = idx === activeIndex;
          return (
            <button
              key={game.id}
              type="button"
              aria-label={`Phóng to ${game.title}`}
              onClick={() => {
                soundEngine.playCarouselStep();
                focusAndScrollToCard(idx);
              }}
              className="h-2.5 rounded-full transition-all duration-200 cursor-pointer"
              style={{
                width: isCurrent ? '34px' : '10px',
                background: game.theme.accentGradient,
                boxShadow: isCurrent ? `0 0 12px ${game.theme.glowColor}` : 'none',
                opacity: isCurrent ? 1 : 0.82,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
