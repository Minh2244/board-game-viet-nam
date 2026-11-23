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
import { OAnQuanCharacterArt } from '../data/characters';
import type { SavedOfflineOAnQuanMatch } from './offlineSave';
import type { PersistedOAnQuanSession } from '../network/onlineRoomClient';

interface ModeSelectViewProps {
  savedOfflineMatch: SavedOfflineOAnQuanMatch | null;
  resumableOnlineSession: PersistedOAnQuanSession | null;
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
  const [playerName, setPlayerName] = useState(defaultPlayerName || 'Cu Tí');
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
      {/* Nền sân gỗ ấm & sắc gạch tàu dân gian */}
      <img
        src={HUB_BG_WARM_WOOD_URL}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-950/78 via-stone-950/72 to-emerald-950/80"
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1080px] flex-col justify-between gap-3 px-6 py-4">
        {/* Thanh đầu trang 3 cột cân xứng */}
        <header className="grid grid-cols-3 items-center gap-3">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                soundEngine.playPushClick();
                onBackToHub();
              }}
              className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black tracking-wide text-white cursor-pointer"
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
            <h1 className="whitespace-nowrap text-[26px] font-black tracking-[0.07em] text-amber-300 drop-shadow-[0_3px_10px_rgba(0,0,0,0.75)]">
              Ô ĂN QUAN DÂN GIAN
            </h1>
            <p className="mt-0.5 text-xs font-semibold tracking-[0.06em] text-amber-100/80 uppercase">
              Chọn chế độ chơi · 70 Điểm · Chiếu Cói 2.5D
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                toggleMute();
                soundEngine.playPushClick();
              }}
              title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className="uiverse-push-btn uiverse-dome-shine flex h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white cursor-pointer"
              style={{
                background: muted
                  ? 'linear-gradient(135deg, #64748B 0%, #475569 100%)'
                  : 'linear-gradient(135deg, #FDE047 0%, #F59E0B 55%, #EA580C 100%)',
                boxShadow: muted ? '0 4px 0 #334155' : '0 4px 0 #9A3412',
              }}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Thanh khôi phục nhanh phòng Online nếu vừa F5 */}
        {resumableOnlineSession && (
          <div className="mx-auto flex w-full max-w-[840px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/60 bg-cyan-950/78 px-5 py-2.5 shadow-xl">
            <div className="flex items-center gap-2.5 text-sm font-bold text-cyan-100">
              <RotateCcw className="h-4 w-4 text-cyan-300" />
              <span>
                Đang có phiên phòng Online{' '}
                <strong className="font-mono text-amber-300">#{resumableOnlineSession.roomCode}</strong> (
                {resumableOnlineSession.playerName}) — Ghế được giữ 2 phút!
              </span>
            </div>
            <button
              type="button"
              disabled={onlineLoading}
              onClick={() => {
                soundEngine.playPushClick();
                onReconnectOnlineSession();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-1.5 text-xs font-black text-slate-950 shadow transition hover:bg-cyan-300 disabled:opacity-50 cursor-pointer"
            >
              {onlineLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              Vào lại phòng ngay
            </button>
          </div>
        )}

        {/* Hai cột ngang song song (grid-cols-12 luôn giữ 2 cột trên cả điện thoại xoay ngang & PC) */}
        <div className="grid flex-1 grid-cols-12 items-stretch gap-5 py-1">
          {/* CỘT TRÁI: CHƠI VỚI MÁY AI & 2 NGƯỜI CHUNG 1 MÁY */}
          <section className="col-span-6 flex flex-col justify-between rounded-3xl border border-amber-300/40 bg-stone-950/76 p-5 shadow-2xl">
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-emerald-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-200">
                  <Bot className="h-3.5 w-3.5" />
                  Chơi Offline
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
                  1–2 Người · 3 Cấp AI
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black tracking-wide text-amber-200">
                    ĐẤU VỚI MÁY AI &amp; 2 NGƯỜI
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                    Đấu trí cùng Máy AI Minimax 3 cấp độ (có nút <strong>Gợi ý nước đi 💡</strong>) hoặc chơi đối kháng 2 người ngay trên cùng một máy.
                  </p>
                </div>
                <div className="flex shrink-0 items-end -space-x-4">
                  <OAnQuanCharacterArt characterId="cu_ti" mood="happy" className="h-20 w-16" />
                  <OAnQuanCharacterArt characterId="be_mit" mood="happy" facing="left" className="h-20 w-16" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  data-testid="oaq-mode-vs-bot"
                  onClick={() => {
                    soundEngine.playPushClick();
                    onOpenLocalSetup('vs-bot');
                  }}
                  className="group flex flex-col justify-between rounded-2xl border border-emerald-400/45 bg-emerald-950/55 p-3.5 text-left transition hover:border-emerald-300 hover:bg-emerald-900/60 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/25 text-emerald-300">
                      <Bot className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black text-emerald-200">
                      Có Gợi Ý 💡
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-sm font-black text-white">Đấu Với Máy AI</div>
                    <div className="mt-0.5 text-[11px] text-emerald-100/75">
                      Tập Chơi · Thách Đấu · Cao Thủ
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  data-testid="oaq-mode-pass-play"
                  onClick={() => {
                    soundEngine.playPushClick();
                    onOpenLocalSetup('pass-and-play');
                  }}
                  className="group flex flex-col justify-between rounded-2xl border border-amber-400/45 bg-amber-950/50 p-3.5 text-left transition hover:border-amber-300 hover:bg-amber-900/55 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/25 text-amber-300">
                      <Users className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-200">
                      Chung 1 Máy
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-sm font-black text-white">2 Người 1 Máy</div>
                    <div className="mt-0.5 text-[11px] text-amber-100/75">
                      Ngồi đối diện cùng chơi trên chiếu
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {savedOfflineMatch && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPushClick();
                    onResumeOfflineMatch();
                  }}
                  className="flex items-center justify-between rounded-2xl border border-amber-300/60 bg-amber-500/20 px-4 py-2.5 text-xs font-black text-amber-100 transition hover:bg-amber-500/30 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <History className="h-4 w-4 text-amber-300" />
                    Tiếp tục ván dở (Lượt {savedOfflineMatch.state.turnCount} ·{' '}
                    {savedOfflineMatch.state.players[0].score} – {savedOfflineMatch.state.players[1].score} điểm)
                  </span>
                  <span className="rounded-lg bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-stone-950">
                    Chơi tiếp ▶
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  soundEngine.playPushClick();
                  onOpenLocalSetup('vs-bot');
                }}
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wider text-slate-950 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                  boxShadow: '0 4px 0 #047857, 0 10px 22px rgba(16,185,129,0.38)',
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                VÀO THIẾT LẬP VÁN ĐẤU
              </button>
            </div>
          </section>

          {/* CỘT PHẢI: CHƠI ONLINE PHÒNG MÃ 6 CHỮ SỐ */}
          <section className="col-span-6 flex flex-col justify-between rounded-3xl border border-cyan-400/40 bg-slate-950/78 p-5 shadow-2xl">
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/50 bg-cyan-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-200">
                  <Globe className="h-3.5 w-3.5" />
                  Chơi Online
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                  <Wifi className="h-3 w-3" />
                  Khác Wi-Fi · 4G/5G · Tự Xoay POV
                </span>
              </div>

              <h2 className="text-xl font-black tracking-wide text-cyan-200">
                PHÒNG ONLINE MÃ 6 SỐ
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Tạo phòng gửi mã 6 chữ số cho bạn bè ở bất kỳ đâu. Màn hình mỗi người tự xoay sao cho <strong>5 ô dân của mình luôn nằm ở hàng dưới</strong>!
              </p>

              {/* Tên hiển thị */}
              <div className="mt-3.5">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Tên hiển thị của bạn
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nhập tên của bạn (VD: Cu Tí)"
                  className="w-full rounded-xl border border-white/20 bg-slate-900/90 px-3.5 py-2 text-sm font-bold text-white outline-none transition focus:border-cyan-400"
                />
              </div>

              {/* Form nhập mã 6 số vào phòng */}
              <form onSubmit={handleSubmitJoin} className="mt-3">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Nhập mã phòng 6 chữ số để tham gia
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
                      placeholder="VD: 842915"
                      className="w-full rounded-xl border border-white/20 bg-slate-900/90 py-2 pl-9 pr-3 font-mono text-base font-black tracking-[0.22em] text-amber-200 outline-none transition focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={cleanPin.length !== 6 || onlineLoading}
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black tracking-wide text-slate-950 shadow transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                  >
                    {onlineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vào phòng'}
                  </button>
                </div>
              </form>

              {onlineError && (
                <div className="mt-2.5 rounded-xl border border-rose-400/55 bg-rose-950/75 px-3 py-2 text-xs font-bold text-rose-200">
                  ⚠ {onlineError}
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="oaq-create-online-btn"
              disabled={onlineLoading}
              onClick={() => {
                soundEngine.playPushClick();
                onCreateOnlineRoom(playerName.trim() || 'Cu Tí');
              }}
              className="uiverse-push-btn uiverse-dome-shine mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wider text-slate-950 disabled:opacity-50 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #38BDF8 0%, #22D3EE 52%, #FDE047 100%)',
                boxShadow: '0 4px 0 #0369A1, 0 10px 22px rgba(34,211,238,0.35)',
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
  );
}
