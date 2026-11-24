import { useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Crown,
  Globe,
  History,
  KeyRound,
  Loader2,
  Play,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { CLOCKWISE_COLORS } from '../engine/boardGeometry';
import type { PersistedCoCaNguaSession } from '../network/onlineRoomClient';
import { HorsePieceSvg } from '../ui/HorsePieceSvg';
import type { SavedOfflineCoCaNguaMatch } from './offlineSave';

interface ModeSelectViewProps {
  savedOfflineMatch: SavedOfflineCoCaNguaMatch | null;
  resumableOnlineSession: PersistedCoCaNguaSession | null;
  initialRoomCode?: string;
  onlineLoading: boolean;
  onlineError: string | null;
  defaultPlayerName: string;
  onBackToHub: () => void;
  onOpenLocalSetup: (preset: 'vs-bot' | 'pass-and-play') => void;
  onResumeOfflineMatch: () => void;
  onCreateOnlineRoom: (playerName: string) => void;
  onJoinOnlineRoom: (roomCode: string, playerName: string) => void;
  onReconnectOnlineSession: () => void;
}

export function ModeSelectView({
  savedOfflineMatch,
  resumableOnlineSession,
  initialRoomCode = '',
  onlineLoading,
  onlineError,
  defaultPlayerName,
  onBackToHub,
  onOpenLocalSetup,
  onResumeOfflineMatch,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onReconnectOnlineSession,
}: ModeSelectViewProps) {
  const [playerName, setPlayerName] = useState(defaultPlayerName || 'Kỵ Sĩ');
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const { muted, toggleMute } = useAudioStore();

  const cleanPin = joinCode.replace(/\D/g, '').slice(0, 6);

  const handleSubmitJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanPin.length !== 6 || onlineLoading) return;
    soundEngine.playPushClick();
    onJoinOnlineRoom(cleanPin, playerName);
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-950/76 via-stone-950/72 to-orange-950/80"
      />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[960px] flex-col px-5 py-3.5">
        {/* Thanh đầu trang gọn gàng */}
        <header className="grid grid-cols-3 items-center gap-3">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                soundEngine.playPushClick();
                onBackToHub();
              }}
              className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black tracking-wide text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
                boxShadow: '0 4px 0 #9A3412, 0 8px 18px rgba(0,0,0,0.35)',
              }}
            >
              <ArrowLeft className="h-4 w-4 stroke-[3]" />
              Quay lại sảnh
            </button>
          </div>

          <div className="text-center">
            <h1 className="whitespace-nowrap text-[24px] font-black tracking-[0.07em] text-amber-300 drop-shadow-[0_3px_10px_rgba(0,0,0,0.75)]">
              CỜ CÁ NGỰA CỔ ĐIỂN
            </h1>
            <p className="whitespace-nowrap text-[11px] font-semibold tracking-[0.05em] text-amber-100/80 uppercase">
              2–4 Màu · Đấu Máy AI · Chung 1 Máy · Online 6 Số
            </p>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                toggleMute();
                soundEngine.playPushClick();
              }}
              title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className="uiverse-push-btn uiverse-dome-shine flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white cursor-pointer"
              style={{
                background: muted
                  ? 'linear-gradient(135deg, #64748B 0%, #475569 100%)'
                  : 'linear-gradient(135deg, #FDE047 0%, #F59E0B 55%, #EA580C 100%)',
                boxShadow: muted ? '0 3px 0 #334155' : '0 3px 0 #9A3412',
              }}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Nội dung chính căn giữa gọn gàng, không kéo giãn thừa khoảng đen */}
        <div className="my-auto flex flex-col gap-3 py-3">
          {resumableOnlineSession && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/60 bg-cyan-950/82 px-4 py-2 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-100">
                <RotateCcw className="h-4 w-4 text-cyan-300" />
                <span>
                  Phòng Online cũ{' '}
                  <strong className="font-mono text-amber-300">#{resumableOnlineSession.roomCode}</strong> (
                  {resumableOnlineSession.playerName}) đang mở — Ghế giữ 2 phút!
                </span>
              </div>
              <button
                type="button"
                disabled={onlineLoading}
                onClick={() => {
                  soundEngine.playPushClick();
                  onReconnectOnlineSession();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow transition hover:bg-cyan-300 disabled:opacity-50 cursor-pointer"
              >
                {onlineLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                Vào lại ngay
              </button>
            </div>
          )}

          <div className="grid grid-cols-12 items-stretch gap-4">
            {/* CỘT TRÁI: OFFLINE */}
            <section className="col-span-6 flex flex-col justify-between gap-3.5 rounded-3xl border border-amber-300/40 bg-stone-950/80 p-4 shadow-2xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-emerald-500/20 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-200">
                    <Bot className="h-3.5 w-3.5" />
                    Chơi Offline
                  </span>
                  <div className="flex items-center -space-x-1.5">
                    {CLOCKWISE_COLORS.map((c) => (
                      <HorsePieceSvg key={c} color={c} className="h-8 w-7" />
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-black tracking-wide text-amber-200">
                    ĐẤU MÁY AI &amp; CHUNG 1 MÁY
                  </h2>
                  <p className="mt-0.5 text-xs leading-snug text-amber-100/80">
                    Đua 2–4 màu cùng Máy AI 3 cấp (có nút <strong>Gợi ý 💡</strong>) hoặc chơi nhiều người trên 1 máy.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="ccn-mode-vs-bot"
                    onClick={() => {
                      soundEngine.playPushClick();
                      onOpenLocalSetup('vs-bot');
                    }}
                    className="flex flex-col justify-between rounded-2xl border border-emerald-400/45 bg-emerald-950/55 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-900/60 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/25 text-emerald-300">
                        <Bot className="h-4 w-4" />
                      </span>
                      <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black text-emerald-200">
                        Có Gợi Ý 💡
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="text-sm font-black text-white">Đấu Với Máy AI</div>
                      <div className="text-[11px] text-emerald-100/75">1 vs 1 · 1 vs 2 · 1 vs 3</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="ccn-mode-pass-play"
                    onClick={() => {
                      soundEngine.playPushClick();
                      onOpenLocalSetup('pass-and-play');
                    }}
                    className="flex flex-col justify-between rounded-2xl border border-amber-400/45 bg-amber-950/50 p-3 text-left transition hover:border-amber-300 hover:bg-amber-900/55 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/25 text-amber-300">
                        <Users className="h-4 w-4" />
                      </span>
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-200">
                        2–4 Người
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="text-sm font-black text-white">Nhiều Người 1 Máy</div>
                      <div className="text-[11px] text-amber-100/75">Tụ họp đổ xúc xắc vui nhộn</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {savedOfflineMatch && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPushClick();
                      onResumeOfflineMatch();
                    }}
                    className="flex items-center justify-between rounded-xl border border-amber-300/60 bg-amber-500/20 px-3.5 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-500/30 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <History className="h-4 w-4 text-amber-300" />
                      Chơi tiếp ván dở (Lượt {savedOfflineMatch.state.turnCount} · {savedOfflineMatch.state.players.length} màu)
                    </span>
                    <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-[11px] font-black text-stone-950">
                      Tiếp ▶
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPushClick();
                    onOpenLocalSetup('vs-bot');
                  }}
                  className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-black tracking-wider text-slate-950 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                    boxShadow: '0 4px 0 #047857, 0 8px 18px rgba(16,185,129,0.35)',
                  }}
                >
                  <Play className="h-4 w-4 fill-current" />
                  VÀO THIẾT LẬP VÁN ĐẤU
                </button>
              </div>
            </section>

            {/* CỘT PHẢI: ONLINE MÃ 6 SỐ */}
            <section className="col-span-6 flex flex-col justify-between gap-3.5 rounded-3xl border border-cyan-400/40 bg-slate-950/82 p-4 shadow-2xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/50 bg-cyan-500/20 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-cyan-200">
                    <Globe className="h-3.5 w-3.5" />
                    Chơi Online
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10.5px] font-bold text-cyan-200">
                    <Wifi className="h-3 w-3" />
                    2–4 Người + Bot · 4G/Wi-Fi
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-black tracking-wide text-cyan-200">
                    PHÒNG ONLINE MÃ 6 SỐ
                  </h2>
                  <p className="mt-0.5 text-xs leading-snug text-slate-300">
                    Tạo mã 6 số hoặc gửi link mời tối đa 4 bạn bè cùng đua. Chủ phòng có thể thêm Máy AI cho đủ bàn.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-slate-300">
                      Tên hiển thị của bạn
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Nhập tên của bạn"
                      className="w-full rounded-xl border border-white/20 bg-slate-900/90 px-3 py-1.5 text-sm font-bold text-white outline-none transition focus:border-cyan-400"
                    />
                  </div>

                  <form onSubmit={handleSubmitJoin}>
                    <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-slate-300">
                      Nhập mã phòng 6 số để tham gia
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/80" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={cleanPin}
                          onChange={(e) => setJoinCode(e.target.value)}
                          placeholder="VD: 529418"
                          className="w-full rounded-xl border border-white/20 bg-slate-900/90 py-1.5 pl-9 pr-3 font-mono text-sm font-black tracking-[0.22em] text-amber-200 outline-none transition focus:border-cyan-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={cleanPin.length !== 6 || onlineLoading}
                        className="rounded-xl bg-cyan-400 px-4 py-1.5 text-xs font-black tracking-wide text-slate-950 shadow transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                      >
                        {onlineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vào phòng'}
                      </button>
                    </div>
                  </form>
                </div>

                {onlineError && (
                  <div className="rounded-xl border border-rose-400/55 bg-rose-950/75 px-3 py-1.5 text-xs font-bold text-rose-200">
                    ⚠ {onlineError}
                  </div>
                )}
              </div>

              <button
                type="button"
                data-testid="ccn-create-online-btn"
                disabled={onlineLoading}
                onClick={() => {
                  soundEngine.playPushClick();
                  onCreateOnlineRoom(playerName.trim() || 'Kỵ Sĩ');
                }}
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-black tracking-wider text-slate-950 disabled:opacity-50 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #38BDF8 0%, #22D3EE 52%, #FDE047 100%)',
                  boxShadow: '0 4px 0 #0369A1, 0 8px 18px rgba(34,211,238,0.32)',
                }}
              >
                {onlineLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="h-4 w-4" />
                )}
                TẠO PHÒNG ONLINE MÃ 6 SỐ
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
