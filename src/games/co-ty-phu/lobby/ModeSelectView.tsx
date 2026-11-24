import { useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Crown,
  Globe,
  History,
  KeyRound,
  Loader2,
  Music,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Users,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import type { GameState } from '../engine/types';
import type { PersistedOnlineSession } from '../network/onlineRoomClient';

interface ModeSelectViewProps {
  savedOfflineMatch: GameState | null;
  resumableOnlineSession: PersistedOnlineSession | null;
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
  const [playerName, setPlayerName] = useState(defaultPlayerName || 'Tỷ Phú Việt');
  const [joinCode, setJoinCode] = useState(initialRoomCode);

  const { muted, bgmPlaying, toggleMute } = useAudioStore();

  const handleToggleAudio = () => {
    toggleMute();
    soundEngine.playPushClick();
  };

  const handleListenPreview = () => {
    if (muted) {
      useAudioStore.getState().setMuted(false);
    }
    soundEngine.setBgmScene('co-ty-phu');
    soundEngine.playPushClick();
  };

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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-950/70 via-emerald-950/50 to-slate-950/78"
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1060px] flex-col justify-between gap-3 px-6 py-4">
        {/* Thanh trên 3 cột cân xứng trên khung ngang 1220×590 */}
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
            <h1 className="whitespace-nowrap text-[26px] font-black tracking-[0.07em] text-amber-300 drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)]">
              CỜ TỶ PHÚ VIỆT NAM 3D
            </h1>
            <p className="mt-0.5 text-xs font-semibold tracking-[0.06em] text-emerald-100/80 uppercase">
              Chọn chế độ chơi
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            {!bgmPlaying && (
              <button
                type="button"
                onClick={handleListenPreview}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-500/25 px-3.5 py-1.5 text-xs font-black tracking-wide text-amber-200 shadow transition hover:bg-amber-500/40 cursor-pointer"
              >
                <Music className="h-3.5 w-3.5 animate-bounce" />
                Nghe nhạc sảnh
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleAudio}
              title={muted ? 'Bật nhạc nền sảnh' : 'Tắt âm thanh'}
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

        {/* Thanh khôi phục nhanh nếu người chơi vừa rớt mạng phòng Online trong vòng 2 phút */}
        {resumableOnlineSession && (
          <div className="mx-auto flex w-full max-w-[820px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/60 bg-cyan-950/75 px-5 py-2.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2.5 text-sm font-bold tracking-wide text-cyan-100">
              <RotateCcw className="h-4 w-4 text-cyan-300" />
              <span>
                Phòng Online đang mở{' '}
                <strong className="rounded bg-cyan-400/20 px-2 py-0.5 font-mono text-amber-300">
                  #{resumableOnlineSession.roomCode}
                </strong>
              </span>
            </div>
            <button
              type="button"
              disabled={onlineLoading}
              onClick={() => {
                soundEngine.playPushClick();
                onReconnectOnlineSession();
              }}
              className="rounded-full bg-cyan-400 px-4 py-1.5 text-xs font-black tracking-wide text-slate-950 shadow hover:bg-cyan-300 cursor-pointer disabled:opacity-50"
            >
              VÀO LẠI PHÒNG
            </button>
          </div>
        )}

        {/* 2 THẺ CHẾ ĐỘ CHƠI CÂN XỨNG TRÁI – PHẢI TRÊN KHUNG NGANG 1220×590 */}
        <main className="my-auto grid grid-cols-12 items-stretch gap-5">
          {/* THẺ 1 (TRÁI): CHƠI VỚI MÁY & 1 THIẾT BỊ NHIỀU NGƯỜI (GOM CHUNG) */}
          <section className="mobile-flat-shadow col-span-6 flex flex-col justify-between gap-4 rounded-[28px] border-2 border-emerald-400/50 bg-stone-950/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.52)] backdrop-blur-md">
            {/* Đầu thẻ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/45 bg-emerald-500/18 px-3.5 py-1 text-[11px] font-black tracking-[0.08em] text-emerald-200">
                  <Bot className="h-3.5 w-3.5" />
                  CHƠI OFFLINE
                </span>
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-bold tracking-wide text-amber-200">
                  1–6 Người · 0–4 Máy
                </span>
              </div>

              <div>
                <h2 className="text-[22px] font-black tracking-[0.04em] text-white">
                  CHƠI VỚI MÁY &amp; NHIỀU NGƯỜI
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed tracking-[0.02em] text-stone-300">
                  Đấu cùng Bot thông minh hoặc tụ tập nhiều người trên cùng một thiết bị.
                </p>
              </div>
            </div>

            {/* 2 Lựa chọn mở nhanh gọn gàng */}
            <div className="grid flex-1 grid-cols-2 gap-3.5">
              <button
                type="button"
                data-testid="mode-vs-bot-btn"
                onClick={() => {
                  soundEngine.playPushClick();
                  onOpenLocalSetup('vs-bot');
                }}
                className="group flex flex-col justify-between rounded-2xl border border-emerald-400/35 bg-emerald-950/40 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-900/50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/25 text-emerald-300">
                    <Bot className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-emerald-200">
                    1 Người + 3 Máy
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-base font-black tracking-wide text-white group-hover:text-emerald-200">
                    Đấu Với Máy
                  </div>
                  <div className="mt-1 text-xs leading-relaxed tracking-[0.015em] text-stone-300/90">
                    Chơi đơn nhanh với dàn Bot AI
                  </div>
                </div>
              </button>

              <button
                type="button"
                data-testid="mode-pass-play-btn"
                onClick={() => {
                  soundEngine.playPushClick();
                  onOpenLocalSetup('pass-and-play');
                }}
                className="group flex flex-col justify-between rounded-2xl border border-amber-400/35 bg-amber-950/32 p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-900/45 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/25 text-amber-300">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-amber-200">
                    2 Người + 2 Máy
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-base font-black tracking-wide text-white group-hover:text-amber-200">
                    Nhiều Người
                  </div>
                  <div className="mt-1 text-xs leading-relaxed tracking-[0.015em] text-stone-300/90">
                    Truyền tay nhau + thêm 0–4 Máy
                  </div>
                </div>
              </button>
            </div>

            {/* Thanh hành động đáy (cùng 1 hàng cao chuẩn với thẻ Online) */}
            <div className="flex items-center gap-3">
              {savedOfflineMatch ? (
                <>
                  <button
                    type="button"
                    onClick={onResumeOfflineMatch}
                    className="uiverse-push-btn uiverse-dome-shine flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-black tracking-wide text-white cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                      boxShadow: '0 5px 0 #B45309, 0 10px 20px rgba(245,158,11,0.35)',
                    }}
                  >
                    <History className="h-4 w-4" />
                    TIẾP TỤC (LƯỢT {savedOfflineMatch.turnCount})
                  </button>
                  <button
                    type="button"
                    data-testid="mode-local-enter-btn"
                    onClick={() => {
                      soundEngine.playPushClick();
                      onOpenLocalSetup('vs-bot');
                    }}
                    className="uiverse-push-btn uiverse-dome-shine flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-black tracking-wide text-white cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 100%)',
                      boxShadow: '0 5px 0 #047857',
                    }}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    VÁN MỚI
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  data-testid="mode-local-enter-btn"
                  onClick={() => {
                    soundEngine.playPushClick();
                    onOpenLocalSetup('vs-bot');
                  }}
                  className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-black tracking-[0.05em] text-white cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #059669 100%)',
                    boxShadow: '0 5px 0 #047857, 0 12px 24px rgba(16,185,129,0.4)',
                  }}
                >
                  <Play className="h-4 w-4 fill-white" />
                  VÀO THIẾT LẬP PHÒNG
                </button>
              )}
            </div>
          </section>

          {/* THẺ 2 (PHẢI): CHƠI ONLINE KHÁC MẠNG (CHỦ PHÒNG & NHẬP MÃ 6 SỐ) */}
          <section className="mobile-flat-shadow col-span-6 flex flex-col justify-between gap-4 rounded-[28px] border-2 border-cyan-400/50 bg-slate-950/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-md">
            {/* Đầu thẻ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/45 bg-cyan-500/18 px-3.5 py-1 text-[11px] font-black tracking-[0.08em] text-cyan-200">
                  <Globe className="h-3.5 w-3.5" />
                  CHƠI ONLINE
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold tracking-wide text-emerald-200">
                  <Wifi className="h-3 w-3" />
                  Khác Wi-Fi · 4G/5G
                </span>
              </div>

              <div>
                <h2 className="text-[22px] font-black tracking-[0.04em] text-white">
                  PHÒNG ONLINE MÃ 6 SỐ
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed tracking-[0.02em] text-slate-300">
                  Tạo phòng gửi mã 6 số cho bạn bè ở mọi nơi · Tự giữ ghế 2 phút khi rớt mạng.
                </p>
              </div>
            </div>

            {/* Khung giữa: Tên hiển thị + Tham gia ngay bằng Mã 6 chữ số */}
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-black/38 px-4 py-2.5">
                <label
                  htmlFor="online-player-name"
                  className="shrink-0 text-xs font-bold tracking-wide text-cyan-200"
                >
                  Tên của bạn
                </label>
                <span className="h-4 w-px bg-white/15" aria-hidden="true" />
                <input
                  id="online-player-name"
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nhập tên hiển thị..."
                  className="w-full bg-transparent text-sm font-black tracking-wide text-white outline-none placeholder:text-slate-500"
                />
              </div>

              <form
                onSubmit={handleSubmitJoin}
                className="rounded-2xl border border-cyan-400/35 bg-cyan-950/35 p-3.5"
              >
                <div className="mb-2 flex items-center justify-between text-xs font-bold tracking-wide text-cyan-200">
                  <span className="inline-flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-cyan-300" />
                    Tham gia bằng Mã phòng (6 số)
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {cleanPin.length}/6 số
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    data-testid="online-pin-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={cleanPin}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="• • • • • •"
                    className="w-full rounded-xl border border-cyan-300/40 bg-slate-950/85 px-4 py-2 text-center font-mono text-xl font-black tracking-[0.38em] text-amber-300 outline-none transition placeholder:tracking-[0.25em] placeholder:text-slate-600 focus:border-amber-300"
                  />
                  <button
                    type="submit"
                    data-testid="online-join-submit-btn"
                    disabled={cleanPin.length !== 6 || onlineLoading}
                    className="uiverse-push-btn shrink-0 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-black tracking-wider text-slate-950 shadow transition hover:bg-cyan-300 disabled:opacity-40 cursor-pointer"
                  >
                    {onlineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'VÀO PHÒNG'}
                  </button>
                </div>
              </form>

              {onlineError && (
                <div className="rounded-xl border border-rose-400/45 bg-rose-950/65 px-3.5 py-2 text-xs font-bold tracking-wide text-rose-200">
                  ⚠️ {onlineError}
                </div>
              )}
            </div>

            {/* Thanh hành động đáy: Tạo phòng mới (Chủ phòng) thẳng hàng 100% với thẻ trái */}
            <div>
              <button
                type="button"
                data-testid="online-create-room-btn"
                disabled={onlineLoading}
                onClick={() => {
                  soundEngine.playPushClick();
                  onCreateOnlineRoom(playerName);
                }}
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-black tracking-[0.05em] text-white cursor-pointer disabled:opacity-55"
                style={{
                  background: 'linear-gradient(135deg, #38BDF8 0%, #2563EB 55%, #4F46E5 100%)',
                  boxShadow: '0 5px 0 #1E3A8A, 0 12px 24px rgba(37,99,235,0.45)',
                }}
              >
                {onlineLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    ĐANG KẾT NỐI...
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 text-amber-300" />
                    TẠO PHÒNG MỚI · LÀM CHỦ PHÒNG
                  </>
                )}
              </button>
            </div>
          </section>
        </main>

        {/* Khoảng thở đáy cân xứng */}
        <div className="h-1" aria-hidden="true" />
      </div>
    </div>
  );
}
