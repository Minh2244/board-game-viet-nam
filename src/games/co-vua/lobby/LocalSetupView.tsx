import { useState } from 'react';
import { ArrowLeft, Bot, Play, RotateCw, ShieldCheck, Users } from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import type { ChessBotDifficulty, ChessColor } from '../engine/types';
import { ChessPieceSvg } from '../ui/ChessPieceSvg';

export interface LocalChessSetupConfig {
  mode: 'vs-bot' | 'pass-and-play';
  whiteName: string;
  blackName: string;
  humanColor: ChessColor | 'random';
  botDifficulty: ChessBotDifficulty;
  autoFlip: boolean;
}

interface LocalSetupViewProps {
  initialMode: 'vs-bot' | 'pass-and-play';
  onBack: () => void;
  onStartMatch: (config: LocalChessSetupConfig) => void;
}

const DIFF_LIST: { id: ChessBotDifficulty; title: string; desc: string; badge: string }[] = [
  { id: 'easy', title: 'Tập Chơi', desc: 'Nhẹ nhàng, luyện luật', badge: 'Dễ' },
  { id: 'medium', title: 'Thách Đấu', desc: 'Cân sức, biết chiến thuật', badge: 'Vừa' },
  { id: 'hard', title: 'Kiện Tướng', desc: 'Alpha-Beta sâu, tính sắc', badge: 'Khó' },
];

export function LocalSetupView({ initialMode, onBack, onStartMatch }: LocalSetupViewProps) {
  const [mode, setMode] = useState<'vs-bot' | 'pass-and-play'>(initialMode);
  const [humanColor, setHumanColor] = useState<ChessColor | 'random'>('white');
  const [botDifficulty, setBotDifficulty] = useState<ChessBotDifficulty>('medium');
  const [whiteName, setWhiteName] = useState(initialMode === 'vs-bot' ? 'Bạn' : 'Người 1 (Trắng)');
  const [blackName, setBlackName] = useState(initialMode === 'vs-bot' ? 'Máy AI' : 'Người 2 (Đen)');
  const [autoFlip, setAutoFlip] = useState(false);

  const handleModeSwitch = (nextMode: 'vs-bot' | 'pass-and-play') => {
    soundEngine.playPushClick();
    setMode(nextMode);
    if (nextMode === 'vs-bot') {
      setWhiteName('Bạn');
      setBlackName('Máy AI');
    } else {
      setWhiteName('Người 1 (Trắng)');
      setBlackName('Người 2 (Đen)');
    }
  };

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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/86 via-zinc-950/82 to-indigo-950/84"
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
            <h1 className="whitespace-nowrap text-2xl font-black tracking-wider text-slate-100">
              THIẾT LẬP VÁN CỜ VUA
            </h1>
            <p className="whitespace-nowrap text-[11px] font-semibold text-sky-200/80">
              Chuẩn FIDE Đen – Trắng · Chơi thoải mái không giới hạn thời gian
            </p>
          </div>
          <div />
        </header>

        <div className="my-auto grid grid-cols-12 items-stretch gap-4 py-3">
          <section className="col-span-7 flex flex-col justify-between gap-3 rounded-3xl border border-slate-300/30 bg-zinc-950/84 p-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/40 p-1">
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
                    ? 'bg-sky-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Users className="h-4 w-4" />
                2 Người Chung 1 Máy
              </button>
            </div>

            {mode === 'vs-bot' ? (
              <div>
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-sky-200">
                  1. Chọn màu quân của Bạn
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'white' as const, label: 'Quân Trắng', sub: 'Đi trước' },
                    { id: 'black' as const, label: 'Quân Đen', sub: 'Đi sau' },
                    { id: 'random' as const, label: 'Ngẫu nhiên', sub: '50 / 50' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        setHumanColor(opt.id);
                      }}
                      className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
                        humanColor === opt.id
                          ? 'border-sky-300 bg-sky-500/20 ring-2 ring-sky-300/60'
                          : 'border-white/15 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <ChessPieceSvg
                        type="k"
                        color={opt.id === 'black' ? 'black' : 'white'}
                        className="h-10 w-10 shrink-0"
                      />
                      <div>
                        <div className="text-xs font-black text-white">{opt.label}</div>
                        <div className="text-[10px] text-slate-300">{opt.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-200">
                    Tên Bên Trắng (Đi trước)
                  </label>
                  <input
                    type="text"
                    maxLength={18}
                    value={whiteName}
                    onChange={(e) => setWhiteName(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-zinc-900 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-300">
                    Tên Bên Đen (Đi sau)
                  </label>
                  <input
                    type="text"
                    maxLength={18}
                    value={blackName}
                    onChange={(e) => setBlackName(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-zinc-900 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-sky-400"
                  />
                </div>
              </div>
            )}

            {mode === 'vs-bot' && (
              <div>
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-200">
                  2. Độ khó Máy AI (Minimax Alpha-Beta)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DIFF_LIST.map((diff) => {
                    const active = botDifficulty === diff.id;
                    return (
                      <button
                        key={diff.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playPushClick();
                          setBotDifficulty(diff.id);
                        }}
                        className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                          active
                            ? 'border-emerald-300 bg-emerald-500/25 ring-2 ring-emerald-300/50'
                            : 'border-white/15 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black text-white">{diff.title}</span>
                          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-200">
                            {diff.badge}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-300">{diff.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === 'pass-and-play' && (
              <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <RotateCw className="h-4 w-4 text-sky-300" />
                  <div>
                    <div className="text-xs font-black text-white">Tự xoay bàn cờ sau mỗi lượt</div>
                    <div className="text-[10.5px] text-slate-300">
                      Tiện khi hai người chuyền tay nhau 1 điện thoại
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoFlip}
                  onClick={() => {
                    soundEngine.playPushClick();
                    setAutoFlip((v) => !v);
                  }}
                  className={`relative h-6 w-11 rounded-full transition cursor-pointer ${
                    autoFlip ? 'bg-sky-400' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      autoFlip ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            )}
          </section>

          <section className="col-span-5 flex flex-col justify-between gap-3 rounded-3xl border border-slate-300/30 bg-zinc-950/84 p-4 shadow-2xl">
            <div className="space-y-3">
              <div className="flex items-center justify-around rounded-2xl border border-white/10 bg-white/[0.04] py-3">
                <div className="flex flex-col items-center">
                  <ChessPieceSvg type="k" color="white" className="h-14 w-14" />
                  <span className="mt-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-black text-white">
                    Bên Trắng
                  </span>
                </div>
                <span className="text-sm font-black text-amber-300">VS</span>
                <div className="flex flex-col items-center">
                  <ChessPieceSvg type="k" color="black" className="h-14 w-14" />
                  <span className="mt-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-black text-slate-200">
                    Bên Đen
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-300/30 bg-sky-950/30 px-3 py-2.5 text-[11px] leading-relaxed text-slate-200">
                <div className="mb-1 flex items-center gap-1.5 font-black uppercase text-sky-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Đầy đủ luật chuẩn FIDE
                </div>
                <div>• Nhập thành gần (O-O), Nhập thành xa (O-O-O), Bắt Tốt Qua Đường.</div>
                <div>• Phong cấp Hậu/Xe/Tượng/Mã, Hòa Pat, Lặp thế 3 lần &amp; 50 nước.</div>
                <div>• Chơi thoải mái <strong>không đếm ngược thời gian</strong>.</div>
              </div>
            </div>

            <button
              type="button"
              data-testid="cv-start-local-btn"
              onClick={() => {
                soundEngine.playEnterGame();
                onStartMatch({
                  mode,
                  whiteName: whiteName.trim() || 'Bên Trắng',
                  blackName: blackName.trim() || 'Bên Đen',
                  humanColor,
                  botDifficulty,
                  autoFlip,
                });
              }}
              className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wider text-slate-950 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                boxShadow: '0 4px 0 #047857',
              }}
            >
              <Play className="h-4 w-4 fill-current" />
              BẮT ĐẦU VÁN CỜ VUA
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
