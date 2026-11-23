import { useState } from 'react';
import { ArrowLeft, Bot, Gem, Play, ShieldAlert, Sparkles, Users } from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import { O_AN_QUAN_CHARACTERS, OAnQuanCharacterArt } from '../data/characters';
import type { BotDifficulty, CharacterId, PlayerSide } from '../engine/types';

export interface LocalMatchSetupConfig {
  mode: 'vs-bot' | 'pass-and-play';
  player0Name: string;
  player1Name: string;
  player0Char: CharacterId;
  player1Char: CharacterId;
  botDifficulty: BotDifficulty;
  startingSide: PlayerSide | 'random';
  mandarinPointValue: 5 | 10;
  mandarinYouthRule: boolean;
}

interface LocalSetupViewProps {
  initialMode: 'vs-bot' | 'pass-and-play';
  onBack: () => void;
  onStartMatch: (config: LocalMatchSetupConfig) => void;
}

const DIFFICULTY_META: {
  id: BotDifficulty;
  title: string;
  desc: string;
  badge: string;
}[] = [
  { id: 'easy', title: 'Tập Chơi', desc: 'Dễ thắng · Máy đánh thả lỏng', badge: 'Dễ' },
  { id: 'medium', title: 'Thách Đấu', desc: 'Cân sức 50/50 · Tính 2 lượt', badge: 'Vừa' },
  { id: 'hard', title: 'Cao Thủ Làng', desc: 'Minimax sâu 4–5 lượt', badge: 'Khó' },
];

export function LocalSetupView({ initialMode, onBack, onStartMatch }: LocalSetupViewProps) {
  const [mode, setMode] = useState<'vs-bot' | 'pass-and-play'>(initialMode);
  const [player0Char, setPlayer0Char] = useState<CharacterId>('cu_ti');
  const [player0Name, setPlayer0Name] = useState('Cu Tí');
  const [player1Name, setPlayer1Name] = useState(initialMode === 'vs-bot' ? 'Bé Mít (Máy)' : 'Bé Mít');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [startingSide, setStartingSide] = useState<PlayerSide | 'random'>(0);
  const [mandarinPointValue, setMandarinPointValue] = useState<5 | 10>(10);
  const [mandarinYouthRule, setMandarinYouthRule] = useState(false);

  const player1Char: CharacterId = player0Char === 'cu_ti' ? 'be_mit' : 'cu_ti';

  const handleModeSwitch = (nextMode: 'vs-bot' | 'pass-and-play') => {
    soundEngine.playPushClick();
    setMode(nextMode);
    if (nextMode === 'vs-bot' && (player1Name === 'Bé Mít' || player1Name === 'Cu Tí')) {
      setPlayer1Name(player1Char === 'be_mit' ? 'Bé Mít (Máy)' : 'Cu Tí (Máy)');
    } else if (nextMode === 'pass-and-play' && player1Name.includes('(Máy)')) {
      setPlayer1Name(player1Char === 'be_mit' ? 'Bé Mít' : 'Cu Tí');
    }
  };

  const handleSelectChar0 = (charId: CharacterId) => {
    soundEngine.playPushClick();
    setPlayer0Char(charId);
    const other: CharacterId = charId === 'cu_ti' ? 'be_mit' : 'cu_ti';
    if (player0Name === 'Cu Tí' || player0Name === 'Bé Mít') {
      setPlayer0Name(charId === 'cu_ti' ? 'Cu Tí' : 'Bé Mít');
    }
    if (
      player1Name === 'Cu Tí' ||
      player1Name === 'Bé Mít' ||
      player1Name === 'Cu Tí (Máy)' ||
      player1Name === 'Bé Mít (Máy)'
    ) {
      const base = other === 'cu_ti' ? 'Cu Tí' : 'Bé Mít';
      setPlayer1Name(mode === 'vs-bot' ? `${base} (Máy)` : base);
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-950/80 via-stone-950/76 to-emerald-950/82"
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1080px] flex-col justify-between gap-3 px-6 py-4">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                soundEngine.playPushClick();
                onBack();
              }}
              className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black tracking-wide text-white cursor-pointer"
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
              THIẾT LẬP VÁN Ô ĂN QUAN
            </h1>
            <p className="whitespace-nowrap text-xs font-semibold text-amber-100/75">
              Chọn phe Cu Tí / Bé Mít · Tùy chỉnh Máy AI, Điểm Quan &amp; Luật Quan Non
            </p>
          </div>
          <div />
        </header>

        <div className="grid flex-1 grid-cols-12 items-stretch gap-5 py-1">
          {/* CỘT TRÁI (7/12): CHẾ ĐỘ, NHÂN VẬT & CẤP ĐỘ AI */}
          <section className="col-span-7 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/78 p-5 shadow-2xl">
            {/* Chuyển nhanh Đấu Máy / 2 Người 1 Máy */}
            <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-black/35 p-1.5">
              <button
                type="button"
                onClick={() => handleModeSwitch('vs-bot')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black transition cursor-pointer ${
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
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                  mode === 'pass-and-play'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Users className="h-4 w-4" />
                2 Người Chung 1 Máy
              </button>
            </div>

            {/* Chọn nhân vật cho Phe Dưới */}
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-wider text-amber-200">
                1. Chọn nhân vật Phe Dưới (Bạn / Người 1)
              </div>
              <div className="grid grid-cols-2 gap-3">
                {O_AN_QUAN_CHARACTERS.map((char) => {
                  const selected = player0Char === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => handleSelectChar0(char.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
                        selected
                          ? 'border-amber-300 bg-amber-500/20 ring-2 ring-amber-300/60'
                          : 'border-white/15 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <OAnQuanCharacterArt characterId={char.id} mood={selected ? 'excited' : 'idle'} className="h-16 w-14 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-black text-white">{char.name}</div>
                        <div className="text-[11px] text-amber-100/75">{char.tagline}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tên 2 người chơi */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-amber-200/90">
                  Tên Phe Dưới (5 ô hàng dưới)
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={player0Name}
                  onChange={(e) => setPlayer0Name(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-stone-900/90 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-emerald-200/90">
                  Tên Phe Trên ({mode === 'vs-bot' ? 'Máy AI' : 'Người 2'})
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-stone-900/90 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Chọn độ khó Máy AI (chỉ hiện khi Đấu Với Máy) */}
            {mode === 'vs-bot' && (
              <div>
                <div className="mb-1.5 text-xs font-black uppercase tracking-wider text-emerald-200">
                  2. Độ khó Máy AI (Minimax + Alpha-Beta)
                </div>
                <div className="grid grid-cols-3 gap-2.5">
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
                        className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                          active
                            ? 'border-emerald-300 bg-emerald-500/25 ring-2 ring-emerald-300/50'
                            : 'border-white/15 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white">{diff.title}</span>
                          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-200">
                            {diff.badge}
                          </span>
                        </div>
                        <div className="mt-1 text-[10.5px] text-slate-300">{diff.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* CỘT PHẢI (5/12): ĐIỂM QUAN, LUẬT QUAN NON, AI ĐI TRƯỚC & NÚT BẮT ĐẦU */}
          <section className="col-span-5 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/78 p-5 shadow-2xl">
            <div className="space-y-3">
              {/* Ai đi trước */}
              <div>
                <div className="mb-1.5 text-xs font-black uppercase tracking-wider text-amber-200">
                  Quyền đi trước
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 0 as const, label: 'Phe Dưới' },
                    { id: 1 as const, label: mode === 'vs-bot' ? 'Máy AI' : 'Phe Trên' },
                    { id: 'random' as const, label: 'Ngẫu nhiên' },
                  ].map((opt) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        setStartingSide(opt.id);
                      }}
                      className={`rounded-xl border py-2 text-xs font-black transition cursor-pointer ${
                        startingSide === opt.id
                          ? 'border-amber-300 bg-amber-400 text-stone-950 shadow'
                          : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Giá trị Viên Quan (10 điểm chuẩn / 5 điểm dân gian) */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-200">
                  <Gem className="h-3.5 w-3.5 text-emerald-300" />
                  Giá trị mỗi viên Quan
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 10 as const, title: '10 điểm / Quan', sub: 'Chuẩn phổ biến · Tổng 70đ' },
                    { val: 5 as const, title: '5 điểm / Quan', sub: 'Kiểu dân gian · Tổng 60đ' },
                  ].map((opt) => {
                    const active = mandarinPointValue === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          soundEngine.playPushClick();
                          setMandarinPointValue(opt.val);
                        }}
                        className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
                          active
                            ? 'border-emerald-300 bg-emerald-500/25 ring-2 ring-emerald-300/50'
                            : 'border-white/15 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs font-black text-white">{opt.title}</div>
                        <div className="text-[10.5px] text-emerald-100/75">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tùy chọn Luật Quan Non */}
              <div className="rounded-2xl border border-amber-300/30 bg-amber-950/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-300" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-200">
                      Biến thể: Luật Quan Non
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mandarinYouthRule}
                    onClick={() => {
                      soundEngine.playPushClick();
                      setMandarinYouthRule((v) => !v);
                    }}
                    className={`relative h-7 w-13 rounded-full transition cursor-pointer ${
                      mandarinYouthRule ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        mandarinYouthRule ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-amber-100/80">
                  {mandarinYouthRule
                    ? 'ĐANG BẬT (Đánh gắt): Ô Quan còn viên Quan lớn phải tích đủ từ 5 viên dân trở lên mới được ăn.'
                    : 'ĐANG TẮT (Mặc định): Chỉ cần tạo thế [Ô trống] → [Ô Quan] là được ăn Quan ngay bất cứ lúc nào.'}
                </p>
              </div>

              {/* Xem trước cặp đôi không viền */}
              <div className="flex items-center justify-around rounded-2xl bg-gradient-to-b from-amber-900/25 to-transparent px-3 py-1.5">
                <div className="flex flex-col items-center">
                  <OAnQuanCharacterArt characterId={player0Char} mood="happy" className="h-20 w-17" />
                  <span className="mt-0.5 rounded-full bg-amber-500/25 px-2.5 py-0.5 text-[11px] font-black text-amber-200">
                    {player0Name.trim() || 'Phe Dưới'}
                  </span>
                </div>
                <div className="flex flex-col items-center text-amber-300">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-xs font-black">VS</span>
                </div>
                <div className="flex flex-col items-center">
                  <OAnQuanCharacterArt characterId={player1Char} mood="thinking" facing="left" className="h-20 w-17" />
                  <span className="mt-0.5 rounded-full bg-emerald-500/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-200">
                    {player1Name.trim() || 'Phe Trên'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="oaq-start-local-btn"
              onClick={() => {
                soundEngine.playEnterGame();
                onStartMatch({
                  mode,
                  player0Name: player0Name.trim() || (player0Char === 'cu_ti' ? 'Cu Tí' : 'Bé Mít'),
                  player1Name:
                    player1Name.trim() ||
                    (mode === 'vs-bot'
                      ? player1Char === 'be_mit'
                        ? 'Bé Mít (Máy)'
                        : 'Cu Tí (Máy)'
                      : player1Char === 'be_mit'
                        ? 'Bé Mít'
                        : 'Cu Tí'),
                  player0Char,
                  player1Char,
                  botDifficulty,
                  startingSide,
                  mandarinPointValue,
                  mandarinYouthRule,
                });
              }}
              className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-black tracking-wider text-slate-950 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                boxShadow: '0 4px 0 #047857, 0 10px 24px rgba(16,185,129,0.42)',
              }}
            >
              <Play className="h-5 w-5 fill-current" />
              BẮT ĐẦU VÁN CỜ
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
