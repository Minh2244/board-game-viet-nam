import { useState } from 'react';
import { ArrowLeft, Bot, Play, ShieldCheck, Users } from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import type { XiangqiBotDifficulty, XiangqiColor } from '../engine/types';
import { XiangqiPieceToken } from '../ui/XiangqiPieceToken';

export interface LocalXiangqiSetupConfig {
  mode: 'vs-bot' | 'pass-and-play';
  redName: string;
  greenName: string;
  humanColor: XiangqiColor | 'random';
  botDifficulty: XiangqiBotDifficulty;
  labelMode: 'han' | 'vi';
}

interface LocalSetupViewProps {
  initialMode: 'vs-bot' | 'pass-and-play';
  onBack: () => void;
  onStartMatch: (config: LocalXiangqiSetupConfig) => void;
}

const DIFF_LIST: { id: XiangqiBotDifficulty; title: string; desc: string; badge: string }[] = [
  { id: 'easy', title: 'Tập Chơi', desc: 'Nhẹ nhàng, luyện luật', badge: 'Dễ' },
  { id: 'medium', title: 'Thách Đấu', desc: 'Pháo đầu & chiếu sắc', badge: 'Vừa' },
  { id: 'hard', title: 'Kỳ Thủ Làng', desc: 'Alpha-Beta sâu, tính kỹ', badge: 'Khó' },
];

export function LocalSetupView({ initialMode, onBack, onStartMatch }: LocalSetupViewProps) {
  const [mode, setMode] = useState<'vs-bot' | 'pass-and-play'>(initialMode);
  const [humanColor, setHumanColor] = useState<XiangqiColor | 'random'>('red');
  const [botDifficulty, setBotDifficulty] = useState<XiangqiBotDifficulty>('medium');
  const [labelMode, setLabelMode] = useState<'han' | 'vi'>('han');
  const [redName, setRedName] = useState(initialMode === 'vs-bot' ? 'Bạn (Đỏ)' : 'Người 1 (Đỏ)');
  const [greenName, setGreenName] = useState(initialMode === 'vs-bot' ? 'Máy AI (Xanh)' : 'Người 2 (Xanh)');

  const handleModeSwitch = (nextMode: 'vs-bot' | 'pass-and-play') => {
    soundEngine.playPushClick();
    setMode(nextMode);
    if (nextMode === 'vs-bot') {
      setRedName('Bạn (Đỏ)');
      setGreenName('Máy AI (Xanh)');
    } else {
      setRedName('Người 1 (Đỏ)');
      setGreenName('Người 2 (Xanh)');
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-950/84 via-stone-950/80 to-emerald-950/82"
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
            <h1 className="whitespace-nowrap text-2xl font-black tracking-wider text-amber-300">
              THIẾT LẬP VÁN CỜ TƯỚNG
            </h1>
            <p className="whitespace-nowrap text-[11px] font-semibold text-amber-100/75">
              Quân Đỏ – Xanh · 90 Giao Điểm · Không giới hạn thời gian
            </p>
          </div>
          <div />
        </header>

        <div className="my-auto grid grid-cols-12 items-stretch gap-4 py-3">
          <section className="col-span-7 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/84 p-4 shadow-2xl">
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
                    ? 'bg-rose-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Users className="h-4 w-4" />
                2 Người Chung 1 Máy
              </button>
            </div>

            {mode === 'vs-bot' ? (
              <div>
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-amber-200">
                  1. Chọn phe quân của Bạn
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'red' as const, label: 'Quân Đỏ', sub: 'Đi trước' },
                    { id: 'green' as const, label: 'Quân Xanh', sub: 'Đi sau' },
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
                          ? 'border-amber-300 bg-amber-500/20 ring-2 ring-amber-300/60'
                          : 'border-white/15 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <XiangqiPieceToken
                        type="k"
                        color={opt.id === 'green' ? 'green' : 'red'}
                        labelMode={labelMode}
                        className="h-10 w-10 shrink-0"
                      />
                      <div>
                        <div className="text-xs font-black text-white">{opt.label}</div>
                        <div className="text-[10px] text-amber-100/75">{opt.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-rose-300">
                    Tên Bên Đỏ (Đi trước)
                  </label>
                  <input
                    type="text"
                    maxLength={18}
                    value={redName}
                    onChange={(e) => setRedName(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-stone-900 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-emerald-300">
                    Tên Bên Xanh (Đi sau)
                  </label>
                  <input
                    type="text"
                    maxLength={18}
                    value={greenName}
                    onChange={(e) => setGreenName(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-stone-900 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            )}

            {mode === 'vs-bot' && (
              <div>
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-200">
                  2. Độ khó Máy AI
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

            <div>
              <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-amber-200">
                Kiểu chữ khắc trên quân cờ (có thể đổi nhanh trong ván)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'han' as const, label: 'Chữ Hán Cổ Điển (帥 · 將 · 炮)' },
                  { id: 'vi' as const, label: 'Chữ Tiếng Việt (Tướng · Pháo · Mã)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPushClick();
                      setLabelMode(opt.id);
                    }}
                    className={`rounded-xl border py-1.5 text-xs font-black transition cursor-pointer ${
                      labelMode === opt.id
                        ? 'border-amber-300 bg-amber-400 text-stone-950 shadow'
                        : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="col-span-5 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/84 p-4 shadow-2xl">
            <div className="space-y-3">
              <div className="flex items-center justify-around rounded-2xl border border-white/10 bg-white/[0.04] py-3">
                <div className="flex flex-col items-center">
                  <XiangqiPieceToken type="k" color="red" labelMode={labelMode} className="h-14 w-14" />
                  <span className="mt-1 rounded-full bg-red-600/80 px-2.5 py-0.5 text-[11px] font-black text-white">
                    Bên Đỏ
                  </span>
                </div>
                <span className="text-sm font-black text-amber-300">VS</span>
                <div className="flex flex-col items-center">
                  <XiangqiPieceToken type="k" color="green" labelMode={labelMode} className="h-14 w-14" />
                  <span className="mt-1 rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-black text-white">
                    Bên Xanh
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/30 bg-amber-950/30 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/90">
                <div className="mb-1 flex items-center gap-1.5 font-black uppercase text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Đúng bộ luật chuẩn Á Đông
                </div>
                <div>• Đủ luật Cản chân Mã, Cản mắt Tượng, Ngòi Pháo &amp; Lộ Mặt Tướng.</div>
                <div>• Chống Chiếu Dai 3 lần · Chiếu bí hoặc Khốn bí (hết nước) đều thắng!</div>
                <div>• Chơi thoải mái <strong>không bộ đếm thời gian</strong>.</div>
              </div>
            </div>

            <button
              type="button"
              data-testid="ct-start-local-btn"
              onClick={() => {
                soundEngine.playEnterGame();
                onStartMatch({
                  mode,
                  redName: redName.trim() || 'Bên Đỏ',
                  greenName: greenName.trim() || 'Bên Xanh',
                  humanColor,
                  botDifficulty,
                  labelMode,
                });
              }}
              className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wider text-slate-950 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                boxShadow: '0 4px 0 #047857',
              }}
            >
              <Play className="h-4 w-4 fill-current" />
              BẮT ĐẦU VÁN CỜ TƯỚNG
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
