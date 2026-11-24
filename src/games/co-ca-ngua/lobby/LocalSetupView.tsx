import { useState } from 'react';
import { ArrowLeft, Bot, Play, ShieldCheck, Users } from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import {
  CLOCKWISE_COLORS,
  getBalancedColorsForPlayerCount,
  HORSE_COLOR_CONFIG,
} from '../engine/boardGeometry';
import type { HorseBotDifficulty, HorseColor } from '../engine/types';
import { HorsePieceSvg } from '../ui/HorsePieceSvg';

export interface LocalCoCaNguaSetupConfig {
  mode: 'vs-bot' | 'pass-and-play';
  playerCount: 2 | 3 | 4;
  botDifficulty: HorseBotDifficulty;
  startingPolicy: 'first' | 'random';
  players: {
    color: HorseColor;
    name: string;
    isBot: boolean;
  }[];
}

interface LocalSetupViewProps {
  initialMode: 'vs-bot' | 'pass-and-play';
  onBack: () => void;
  onStartMatch: (config: LocalCoCaNguaSetupConfig) => void;
}

const DIFFICULTY_META: {
  id: HorseBotDifficulty;
  title: string;
  desc: string;
  badge: string;
}[] = [
  { id: 'easy', title: 'Tập Chơi', desc: 'Nhẹ nhàng, vui vẻ', badge: 'Dễ' },
  { id: 'medium', title: 'Thách Đấu', desc: 'Canh đá & leo bụt', badge: 'Vừa' },
  { id: 'hard', title: 'Cao Thủ', desc: 'Xếp 6→3 · Né đá', badge: 'Khó' },
];

export function LocalSetupView({ initialMode, onBack, onStartMatch }: LocalSetupViewProps) {
  const [mode, setMode] = useState<'vs-bot' | 'pass-and-play'>(initialMode);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [primaryColor, setPrimaryColor] = useState<HorseColor>('red');
  const [botDifficulty, setBotDifficulty] = useState<HorseBotDifficulty>('medium');
  const [startingPolicy, setStartingPolicy] = useState<'first' | 'random'>('first');
  const [customNames, setCustomNames] = useState<Record<number, string>>({
    0: 'Bạn',
    1: initialMode === 'vs-bot' ? 'Máy 1' : 'Người 2',
    2: initialMode === 'vs-bot' ? 'Máy 2' : 'Người 3',
    3: initialMode === 'vs-bot' ? 'Máy 3' : 'Người 4',
  });

  const activeColors = getBalancedColorsForPlayerCount(playerCount, primaryColor);

  const handleModeSwitch = (nextMode: 'vs-bot' | 'pass-and-play') => {
    soundEngine.playPushClick();
    setMode(nextMode);
    setCustomNames({
      0: nextMode === 'vs-bot' ? 'Bạn' : 'Người 1',
      1: nextMode === 'vs-bot' ? 'Máy 1' : 'Người 2',
      2: nextMode === 'vs-bot' ? 'Máy 2' : 'Người 3',
      3: nextMode === 'vs-bot' ? 'Máy 3' : 'Người 4',
    });
  };

  const seatList = activeColors.map((color, idx) => {
    const isBot = mode === 'vs-bot' && idx > 0;
    const defaultName =
      idx === 0
        ? mode === 'vs-bot'
          ? 'Bạn'
          : 'Người 1'
        : isBot
          ? `Máy ${idx}`
          : `Người ${idx + 1}`;
    return {
      idx,
      color,
      isBot,
      name: customNames[idx] ?? defaultName,
      defaultName,
    };
  });

  return (
    <div className="relative h-full w-full overflow-x-hidden overflow-y-auto text-white select-none">
      <img
        src={HUB_BG_WARM_WOOD_URL}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-950/80 via-stone-950/74 to-orange-950/82"
      />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[960px] flex-col px-5 py-3.5">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                soundEngine.playPushClick();
                onBack();
              }}
              className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black tracking-wide text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
                boxShadow: '0 4px 0 #9A3412',
              }}
            >
              <ArrowLeft className="h-4 w-4 stroke-[3]" />
              Chọn chế độ
            </button>
          </div>

          <div className="text-center">
            <h1 className="whitespace-nowrap text-2xl font-black tracking-wider text-amber-300 drop-shadow">
              THIẾT LẬP VÁN CỜ CÁ NGỰA
            </h1>
            <p className="whitespace-nowrap text-[11px] font-semibold text-amber-100/75">
              Chọn 2–4 sắc màu · Đấu Máy AI 3 cấp hoặc Chơi chung 1 máy
            </p>
          </div>

          <div />
        </header>

        {/* Nội dung căn giữa gọn đẹp, không có khoảng đen trống thừa phía dưới */}
        <div className="my-auto grid grid-cols-12 items-stretch gap-4 py-3">
          {/* CỘT TRÁI (7/12) */}
          <section className="col-span-7 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/82 p-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/35 p-1">
              <button
                type="button"
                onClick={() => handleModeSwitch('vs-bot')}
                className={`flex items-center justify-center gap-2 rounded-xl py-1.5 text-xs font-black transition cursor-pointer ${
                  mode === 'vs-bot'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Bot className="h-4 w-4" />
                Đấu Với Máy AI
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('pass-and-play')}
                className={`flex items-center justify-center gap-2 rounded-xl py-1.5 text-xs font-black transition cursor-pointer ${
                  mode === 'pass-and-play'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Users className="h-4 w-4" />
                2–4 Người Chung 1 Máy
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-amber-200">
                  1. Số người chơi
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([2, 3, 4] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        setPlayerCount(cnt);
                      }}
                      className={`rounded-xl border py-1.5 text-xs font-black transition cursor-pointer ${
                        playerCount === cnt
                          ? 'border-amber-300 bg-amber-400 text-stone-950 shadow'
                          : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {cnt} Màu
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-amber-200">
                  2. Màu của {mode === 'vs-bot' ? 'Bạn' : 'Người 1'}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CLOCKWISE_COLORS.map((c) => {
                    const vis = HORSE_COLOR_CONFIG[c];
                    const active = primaryColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          soundEngine.playPushClick();
                          setPrimaryColor(c);
                        }}
                        className={`flex items-center justify-center rounded-xl border py-1.5 text-[11px] font-black transition cursor-pointer ${
                          active ? 'ring-2 ring-yellow-300 scale-[1.03]' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: vis.main,
                          borderColor: active ? '#FEF08A' : 'rgba(255,255,255,0.22)',
                        }}
                      >
                        {vis.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-amber-200">
                <span>3. Các phe tham gia</span>
                {playerCount === 2 && (
                  <span className="text-[10.5px] font-bold normal-case text-emerald-300">
                    ★ 2 màu tự xếp chéo góc cân xứng 180°
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {seatList.map((seat) => {
                  const vis = HORSE_COLOR_CONFIG[seat.color];
                  return (
                    <div
                      key={seat.color}
                      className="flex items-center gap-2 rounded-2xl border bg-white/[0.04] p-2"
                      style={{ borderColor: `${vis.bright}77` }}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                        style={{ backgroundColor: vis.soft, borderColor: vis.main }}
                      >
                        <HorsePieceSvg color={seat.color} className="h-8 w-8" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center justify-between gap-1">
                          <span
                            className="rounded-full px-2 py-[1px] text-[9.5px] font-black text-white"
                            style={{ backgroundColor: vis.main }}
                          >
                            {vis.nameVi}
                          </span>
                          <span className="text-[10px] font-bold text-slate-300">
                            {seat.isBot ? '🤖 Máy' : '👤 Người'}
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={16}
                          value={seat.name}
                          onChange={(e) =>
                            setCustomNames((prev) => ({ ...prev, [seat.idx]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-white/15 bg-stone-900/90 px-2 py-0.5 text-xs font-bold text-white outline-none focus:border-amber-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* CỘT PHẢI (5/12) */}
          <section className="col-span-5 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/82 p-4 shadow-2xl">
            <div className="space-y-3">
              {mode === 'vs-bot' && (
                <div>
                  <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-emerald-200">
                    Độ khó Máy AI
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {DIFFICULTY_META.map((diff) => {
                      const active = botDifficulty === diff.id;
                      return (
                        <button
                          key={diff.id}
                          type="button"
                          onClick={() => {
                            soundEngine.playPushClick();
                            setBotDifficulty(diff.id);
                          }}
                          className={`rounded-xl border p-2 text-left transition cursor-pointer ${
                            active
                              ? 'border-emerald-300 bg-emerald-500/25 ring-2 ring-emerald-300/50'
                              : 'border-white/15 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11.5px] font-black text-white">{diff.title}</span>
                            <span className="rounded bg-black/40 px-1 py-0.5 text-[9px] font-bold text-emerald-200">
                              {diff.badge}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] leading-tight text-slate-300">{diff.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-amber-200">
                  Quyền đi trước
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'first' as const, label: `${seatList[0].name || 'Bạn'} đi trước` },
                    { id: 'random' as const, label: 'Ngẫu nhiên' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        setStartingPolicy(opt.id);
                      }}
                      className={`rounded-xl border px-2 py-1.5 text-xs font-black transition cursor-pointer ${
                        startingPolicy === opt.id
                          ? 'border-amber-300 bg-amber-400 text-stone-950 shadow'
                          : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/30 bg-amber-950/35 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/90">
                <div className="mb-1 flex items-center gap-1.5 font-black uppercase text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Tóm tắt luật Việt Nam
                </div>
                <div>• Gieo <strong>1 / 6</strong>: Xuất chuồng + thêm lượt (tăng tỉ lệ khi chưa có ngựa ra).</div>
                <div>• Cấm nhảy qua mọi quân · 4 Ô <strong>★ An Toàn</strong> không bị đá.</div>
                <div>• Kín 4 bậc <strong>3 – 4 – 5 – 6</strong> thắng ngay!</div>
              </div>
            </div>

            <button
              type="button"
              data-testid="ccn-start-local-btn"
              onClick={() => {
                soundEngine.playEnterGame();
                onStartMatch({
                  mode,
                  playerCount,
                  botDifficulty,
                  startingPolicy,
                  players: seatList.map((s) => ({
                    color: s.color,
                    name: s.name.trim() || s.defaultName,
                    isBot: s.isBot,
                  })),
                });
              }}
              className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wider text-slate-950 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                boxShadow: '0 4px 0 #047857, 0 10px 22px rgba(16,185,129,0.4)',
              }}
            >
              <Play className="h-4 w-4 fill-current" />
              BẮT ĐẦU VÁN CỜ CÁ NGỰA
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
