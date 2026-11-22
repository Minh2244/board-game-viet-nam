import { useState } from 'react';
import { ArrowLeft, Bot, Check, Dices, History, Map, Palette, Play, User, Users } from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import type { GameComponentProps } from '@/shared/types/gameEntry';
import { CO_TY_PHU_CHARACTERS, LAND_COLORS } from './data/characters';
import { createInitialGameState } from './engine/reducer';
import type { CharacterId, GameState, LandColorId, PlayerSlotDraft } from './engine/types';
import { clearOfflineGame, loadOfflineGame } from './lobby/offlineSave';
import { GameBoardView } from './ui/GameBoardView';

const INITIAL_SLOTS: PlayerSlotDraft[] = [
  { slotIndex: 0, name: 'Bạn 1', isBot: false, characterId: 'ca_phe', landColor: 'red' },
  { slotIndex: 1, name: 'Máy 1', isBot: true, characterId: 'ao_dai_tim', landColor: 'blue' },
  { slotIndex: 2, name: 'Máy 2', isBot: true, characterId: 'non_la', landColor: 'emerald' },
  { slotIndex: 3, name: 'Máy 3', isBot: true, characterId: 'phuot_thu', landColor: 'amber' },
];

function nextUniqueSlotName(isBot: boolean, existingSlots: readonly PlayerSlotDraft[], excludeIdx?: number): string {
  const prefix = isBot ? 'Máy' : 'Bạn';
  const used = new Set(
    existingSlots
      .filter((_, idx) => idx !== excludeIdx)
      .map((s) => s.name.trim()),
  );
  let num = 1;
  while (used.has(`${prefix} ${num}`)) {
    num += 1;
  }
  return `${prefix} ${num}`;
}

export default function CoTyPhuGame({ onExitToHub }: GameComponentProps) {
  const [slots, setSlots] = useState<PlayerSlotDraft[]>(INITIAL_SLOTS);
  const [diceMode, setDiceMode] = useState<1 | 2>(2);
  const [mapMode, setMapMode] = useState<'default' | 'random'>('default');
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);
  const [activeMatch, setActiveMatch] = useState<{ state: GameState; key: number } | null>(null);
  const [savedMatch, setSavedMatch] = useState<GameState | null>(() => loadOfflineGame());

  const startFreshMatch = () => {
    soundEngine.playEnterGame();
    clearOfflineGame();
    const fresh = createInitialGameState({ slots, diceCount: diceMode, mapMode });
    setSavedMatch(null);
    setActiveMatch((prev) => ({ state: fresh, key: (prev?.key ?? 0) + 1 }));
  };

  const resumeSavedMatch = () => {
    if (!savedMatch) return;
    soundEngine.playEnterGame();
    setActiveMatch((prev) => ({ state: savedMatch, key: (prev?.key ?? 0) + 1 }));
  };

  if (activeMatch) {
    return (
      <GameBoardView
        key={activeMatch.key}
        initialState={activeMatch.state}
        onRestartSameSetup={startFreshMatch}
        onBackToLobby={() => {
          setActiveMatch(null);
          setSavedMatch(loadOfflineGame());
        }}
      />
    );
  }

  const selectedSlot = slots[activeSlotIdx] ?? slots[0];
  const selectedChar =
    CO_TY_PHU_CHARACTERS.find((c) => c.id === selectedSlot.characterId) ??
    CO_TY_PHU_CHARACTERS[0];
  const selectedLandColor =
    LAND_COLORS.find((c) => c.id === selectedSlot.landColor) ?? LAND_COLORS[0];

  const handleSetCount = (count: number) => {
    soundEngine.playPushClick();
    setSlots((prev) => {
      if (count < prev.length) {
        if (activeSlotIdx >= count) setActiveSlotIdx(count - 1);
        return prev.slice(0, count);
      }
      const next = [...prev];
      const usedChars = new Set(next.map((s) => s.characterId));
      const usedColors = new Set(next.map((s) => s.landColor));
      while (next.length < count) {
        const idx = next.length;
        const char =
          CO_TY_PHU_CHARACTERS.find((c) => !usedChars.has(c.id)) ??
          CO_TY_PHU_CHARACTERS[idx % CO_TY_PHU_CHARACTERS.length];
        const color =
          LAND_COLORS.find((c) => !usedColors.has(c.id)) ??
          LAND_COLORS[idx % LAND_COLORS.length];
        usedChars.add(char.id);
        usedColors.add(color.id);
        next.push({
          slotIndex: idx,
          name: nextUniqueSlotName(true, next),
          isBot: true,
          characterId: char.id,
          landColor: color.id,
        });
      }
      return next;
    });
  };

  const toggleSlotBot = (idx: number) => {
    soundEngine.playPushClick();
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const nextIsBot = !s.isBot;
        const isDefaultName = /^(Bạn|Máy)\s+\d+$/.test(s.name.trim());
        return {
          ...s,
          isBot: nextIsBot,
          name: isDefaultName ? nextUniqueSlotName(nextIsBot, prev, i) : s.name,
        };
      }),
    );
  };

  const updateActiveSlotName = (name: string) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === activeSlotIdx ? { ...s, name } : s)),
    );
  };

  // Cho phép các tụ chọn trùng nhân vật thoải mái
  const pickCharacterForActive = (charId: CharacterId) => {
    soundEngine.playPushClick();
    setSlots((prev) =>
      prev.map((s, i) => (i === activeSlotIdx ? { ...s, characterId: charId } : s)),
    );
  };

  // Màu đất giữ duy nhất cho mỗi tụ: nếu màu đang do tụ khác cầm thì tự đổi chéo mượt
  const pickLandColorForActive = (colorId: LandColorId) => {
    soundEngine.playPushClick();
    setSlots((prev) => {
      const currentColor = prev[activeSlotIdx]?.landColor;
      if (!currentColor || currentColor === colorId) return prev;
      const otherIdx = prev.findIndex((s, i) => i !== activeSlotIdx && s.landColor === colorId);
      return prev.map((s, i) => {
        if (i === activeSlotIdx) return { ...s, landColor: colorId };
        if (i === otherIdx) return { ...s, landColor: currentColor };
        return s;
      });
    });
  };

  return (
    <div className="relative h-full w-full overflow-x-hidden overflow-y-auto text-white">
      <img
        src={HUB_BG_WARM_WOOD_URL}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-950/65 via-emerald-950/55 to-stone-950/75"
      />

      <div className="relative z-10 flex min-h-full w-full flex-row items-start justify-between gap-4 px-5 py-4">
        {/* Nút Quay lại sảnh sát góc trên bên trái */}
        <header className="shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playPushClick();
              onExitToHub();
            }}
            className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
              boxShadow: '0 4px 0 #9A3412, 0 8px 18px rgba(0,0,0,0.35)',
            }}
          >
            <ArrowLeft className="h-4 w-4 stroke-[3]" />
            Quay lại sảnh
          </button>
        </header>

        {/* Thiết lập ván chơi Cờ Tỷ Phú: bố cục ngang 2 cột gọn đẹp trên cả PC lẫn Điện thoại */}
        <main className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-12 gap-5">
          {/* Cột trái: 2–6 tụ (Người / Máy) + Cài đặt ván */}
          <section className="col-span-7 flex flex-col gap-3.5 rounded-[26px] border border-emerald-400/40 bg-stone-900/80 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h1 className="text-[26px] font-black tracking-wide text-emerald-300">
                  CỜ TỶ PHÚ VIỆT NAM 3D
                </h1>
                <p className="mt-0.5 text-[13px] text-stone-300">
                  Chọn 2–6 tụ (gạt tự do Người / Máy), nhân vật và màu đất sở hữu
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-black/40 p-1">
                <Users className="ml-2 h-4 w-4 text-emerald-300" />
                {[2, 3, 4, 5, 6].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSetCount(cnt)}
                    className={`h-8 w-8 rounded-full text-sm font-black transition cursor-pointer ${
                      slots.length === cnt
                        ? 'bg-emerald-500 text-white shadow'
                        : 'text-stone-300 hover:bg-white/10'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách 2–6 tụ */}
            <div className="grid grid-cols-2 gap-2.5">
              {slots.map((slot, idx) => {
                const charInfo =
                  CO_TY_PHU_CHARACTERS.find((c) => c.id === slot.characterId) ??
                  CO_TY_PHU_CHARACTERS[0];
                const landInfo =
                  LAND_COLORS.find((c) => c.id === slot.landColor) ?? LAND_COLORS[0];
                const isSelected = idx === activeSlotIdx;
                return (
                  <div
                    key={slot.slotIndex}
                    onClick={() => setActiveSlotIdx(idx)}
                    style={{
                      borderColor: isSelected ? landInfo.hex : undefined,
                      boxShadow: isSelected ? `0 0 16px ${landInfo.hex}55` : undefined,
                    }}
                    className={`flex items-center justify-between gap-2 rounded-2xl border p-2.5 transition cursor-pointer ${
                      isSelected
                        ? 'bg-black/45'
                        : 'border-white/15 bg-black/30 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={charInfo.avatarUrl}
                          alt={charInfo.name}
                          className="h-11 w-11 rounded-xl border-2 object-cover"
                          style={{ borderColor: landInfo.hex }}
                        />
                        <span
                          title={`Màu đất: ${landInfo.name}`}
                          className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-stone-900 shadow"
                          style={{ backgroundColor: landInfo.hex }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">
                          {slot.name.trim() || (slot.isBot ? `Máy ${idx + 1}` : `Bạn ${idx + 1}`)}
                        </div>
                        <div className="truncate text-xs font-medium text-emerald-200/90">
                          {charInfo.name}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSlotBot(idx);
                      }}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold cursor-pointer transition ${
                        slot.isBot
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                          : 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/60'
                      }`}
                    >
                      {slot.isBot ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      {slot.isBot ? 'Máy' : 'Người'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Cài đặt đầu ván: 1/2 Xúc xắc & Bố cục bàn cờ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                  <Dices className="h-4 w-4 text-cyan-300" />
                  Chế độ Xúc xắc (đầu ván)
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([1, 2] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        setDiceMode(cnt);
                      }}
                      className={`rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                        diceMode === cnt
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'bg-white/10 text-stone-200 hover:bg-white/20'
                      }`}
                    >
                      {cnt} Xúc xắc
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                  <Map className="h-4 w-4 text-amber-300" />
                  Bố cục ô bàn cờ
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPushClick();
                      setMapMode('default');
                    }}
                    className={`rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                      mapMode === 'default'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'bg-white/10 text-stone-200 hover:bg-white/20'
                    }`}
                  >
                    Mặc định
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPushClick();
                      setMapMode('random');
                    }}
                    className={`rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                      mapMode === 'random'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'bg-white/10 text-stone-200 hover:bg-white/20'
                    }`}
                  >
                    Ngẫu nhiên
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-row gap-2.5">
              {savedMatch && (
                <button
                  type="button"
                  onClick={resumeSavedMatch}
                  className="uiverse-push-btn uiverse-dome-shine flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-base font-black text-white cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                    boxShadow: '0 6px 0 #B45309, 0 12px 24px rgba(245,158,11,0.35)',
                  }}
                >
                  <History className="h-4 w-4" />
                  TIẾP TỤC VÁN DỞ (L{savedMatch.turnCount})
                </button>
              )}
              <button
                type="button"
                onClick={startFreshMatch}
                className="uiverse-push-btn uiverse-dome-shine flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-lg font-black text-white cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 52%, #06B6D4 100%)',
                  boxShadow: '0 6px 0 #047857, 0 12px 24px rgba(16,185,129,0.45)',
                }}
              >
                <Play className="h-5 w-5 fill-white" />
                {savedMatch ? 'VÁN MỚI' : 'BẮT ĐẦU VÁN CHƠI'}
              </button>
            </div>
          </section>

          {/* Cột phải: Tùy chỉnh Tên tụ + Màu đất + Nhân vật Chibi */}
          <section className="col-span-5 flex flex-col justify-between gap-2.5 rounded-[26px] border border-amber-300/35 bg-stone-900/80 p-5 shadow-2xl backdrop-blur-md">
            {/* Tên nhân vật & Giới thiệu */}
            <div className="w-full text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-200">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: selectedLandColor.hex }}
                />
                Đang chỉnh: {selectedSlot.name.trim() || `Tụ ${activeSlotIdx + 1}`}
              </div>
              <h2 className="mt-1.5 text-xl font-black text-white sm:text-2xl">{selectedChar.name}</h2>
              <p className="text-xs text-stone-300 sm:text-[13px]">{selectedChar.tagline}</p>
            </div>

            {/* Nhân vật Chibi vừa tầm mắt */}
            <div className="relative my-0.5 flex h-40 w-full items-end justify-center sm:h-44">
              <div
                aria-hidden="true"
                className="absolute bottom-1 h-6 w-32 rounded-full blur-md"
                style={{ backgroundColor: selectedLandColor.hex, opacity: 0.55 }}
              />
              <img
                src={selectedChar.standeeUrl}
                alt={selectedChar.name}
                className="relative h-40 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] sm:h-44"
              />
            </div>

            {/* Tên tụ & Chọn Màu Đất */}
            <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="slot-name-input"
                  className="shrink-0 text-xs font-bold text-stone-300"
                >
                  Tên tụ:
                </label>
                <input
                  id="slot-name-input"
                  type="text"
                  maxLength={18}
                  value={selectedSlot.name}
                  onChange={(e) => updateActiveSlotName(e.target.value)}
                  placeholder={selectedSlot.isBot ? `Máy ${activeSlotIdx + 1}` : `Bạn ${activeSlotIdx + 1}`}
                  className="w-full rounded-xl border border-white/15 bg-stone-950/75 px-3 py-1.5 text-xs font-bold text-white outline-none transition focus:border-emerald-400"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-stone-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-amber-300" />
                    Màu đất sở hữu
                  </span>
                  <span style={{ color: selectedLandColor.ringHex }}>{selectedLandColor.name}</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {LAND_COLORS.map((c) => {
                    const isCurrent = c.id === selectedSlot.landColor;
                    const owner = slots.find((s, i) => i !== activeSlotIdx && s.landColor === c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        title={
                          owner
                            ? `${c.name} (đang chọn bởi ${owner.name} — bấm để đổi)`
                            : c.name
                        }
                        aria-label={`Chọn màu đất ${c.name}`}
                        onClick={() => pickLandColorForActive(c.id)}
                        className={`relative flex h-7 w-full items-center justify-center rounded-lg border-2 transition cursor-pointer hover:scale-105 sm:h-8 ${
                          isCurrent
                            ? 'border-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                            : 'border-white/25 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {isCurrent && <Check className="h-3.5 w-3.5 stroke-[3] text-white drop-shadow" />}
                        {!isCurrent && owner && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white/80 shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lưới 8 nhân vật Chibi (có thể chọn trùng nhân vật giữa các tụ) */}
            <div className="grid w-full grid-cols-4 gap-2">
              {CO_TY_PHU_CHARACTERS.map((ch) => {
                const picked = ch.id === selectedChar.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => pickCharacterForActive(ch.id)}
                    className={`group flex flex-col items-center rounded-xl border p-1.5 transition cursor-pointer ${
                      picked
                        ? 'border-emerald-400 bg-emerald-950/75 ring-2 ring-emerald-300/70'
                        : 'border-white/15 bg-black/30 hover:border-white/40'
                    }`}
                  >
                    <img
                      src={ch.avatarUrl}
                      alt={ch.name}
                      className="h-11 w-11 rounded-lg object-cover transition group-hover:scale-105"
                    />
                    <span className="mt-1 line-clamp-2 text-center text-[10px] leading-tight font-bold text-stone-200">
                      {ch.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        {/* Khoảng cân xứng bên phải trên màn hình rộng */}
        <div className="hidden w-[64px] shrink-0 xl:block 2xl:w-[116px]" aria-hidden="true" />
      </div>
    </div>
  );
}
