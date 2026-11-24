import { useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Copy,
  Crown,
  Link2,
  Play,
  ShieldCheck,
  UserCheck,
  Wifi,
} from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import type { OnlineTransportStatus, XiangqiRoomSnapshot } from '../network/onlineRoomClient';
import { XiangqiPieceToken } from '../ui/XiangqiPieceToken';

interface OnlineLobbyViewProps {
  snapshot: XiangqiRoomSnapshot;
  myToken: string;
  isHost: boolean;
  transportStatus: OnlineTransportStatus;
  transportMessage: string;
  onSwapColors: () => void;
  onStartMatch: () => void;
  onLeaveOrDissolve: () => void;
}

export function OnlineLobbyView({
  snapshot,
  myToken,
  isHost,
  transportStatus,
  transportMessage,
  onSwapColors,
  onStartMatch,
  onLeaveOrDissolve,
}: OnlineLobbyViewProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const redSeat = snapshot.humans.find((h) => h.color === 'red') ?? null;
  const greenSeat = snapshot.humans.find((h) => h.color === 'green') ?? null;
  const canStart = isHost && snapshot.humans.length === 2;

  const copyRoomCode = () => {
    void navigator.clipboard?.writeText(snapshot.roomCode);
    setCopiedCode(true);
    soundEngine.playPushClick();
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?game=co-tuong&room=${snapshot.roomCode}`;
    void navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    soundEngine.playPushClick();
    setTimeout(() => setCopiedLink(false), 1800);
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-950/86 via-stone-950/80 to-emerald-950/84"
      />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[960px] flex-col px-5 py-3.5">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playPushClick();
              onLeaveOrDissolve();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/45 bg-rose-950/70 px-3.5 py-1.5 text-xs font-black text-rose-100 transition hover:bg-rose-900 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            {isHost ? 'Giải tán phòng' : 'Rời phòng'}
          </button>

          <div className="flex items-center gap-2 rounded-full border border-rose-300/55 bg-slate-950/85 px-4 py-1 shadow-xl">
            <span className="text-[11px] font-bold text-slate-300">MÃ PHÒNG CỜ TƯỚNG:</span>
            <span className="font-mono text-lg font-black tracking-[0.2em] text-amber-300">
              {snapshot.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-2 py-0.5 text-[11px] font-black text-amber-200 hover:bg-amber-400/35 cursor-pointer"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCode ? 'Đã chép' : 'Mã'}
            </button>
            <button
              type="button"
              onClick={copyInviteLink}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-400/20 px-2 py-0.5 text-[11px] font-black text-rose-200 hover:bg-rose-400/35 cursor-pointer"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Link2 className="h-3.5 w-3.5" />}
              {copiedLink ? 'Đã chép' : 'Link'}
            </button>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
              transportStatus === 'READY'
                ? 'border-emerald-400/50 bg-emerald-950/70 text-emerald-200'
                : 'border-amber-400/50 bg-amber-950/70 text-amber-200'
            }`}
          >
            <Wifi className="h-3.5 w-3.5" />
            <span className="max-w-[165px] truncate">{transportMessage || 'Trực tuyến'}</span>
          </div>
        </header>

        <div className="my-auto grid grid-cols-12 items-stretch gap-4 py-3">
          <section className="col-span-7 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/84 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black tracking-wide text-amber-200">
                2 KỲ THỦ ({snapshot.humans.length}/2)
              </h2>
              {isHost && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPushClick();
                    onSwapColors();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/45 bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-200 transition hover:bg-amber-500/35 cursor-pointer"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Đổi màu Đỏ / Xanh
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* BÊN ĐỎ */}
              <div className="flex flex-col items-center justify-between rounded-2xl border border-red-400/50 bg-red-950/35 p-4 text-center">
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white">
                    BÊN ĐỎ (ĐI TRƯỚC)
                  </span>
                  {redSeat?.playerToken === myToken && (
                    <span className="text-[10px] font-black text-yellow-300">★ Bạn</span>
                  )}
                </div>
                {redSeat ? (
                  <>
                    <XiangqiPieceToken type="k" color="red" className="my-3 h-20 w-20" />
                    <div className="text-base font-black text-white">{redSeat.name}</div>
                    <div className="text-[11px] text-amber-100/75">
                      {redSeat.isHost ? '👑 Chủ phòng' : '🟢 Đã sẵn sàng'}
                    </div>
                  </>
                ) : (
                  <div className="my-auto py-8 text-xs font-bold text-slate-400">
                    Chờ đối thủ nhập mã #{snapshot.roomCode}...
                  </div>
                )}
              </div>

              {/* BÊN XANH */}
              <div className="flex flex-col items-center justify-between rounded-2xl border border-emerald-400/50 bg-emerald-950/35 p-4 text-center">
                <div className="flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-black text-white">
                    <UserCheck className="h-3 w-3" />
                    BÊN XANH (ĐI SAU)
                  </span>
                  {greenSeat?.playerToken === myToken && (
                    <span className="text-[10px] font-black text-yellow-300">★ Bạn</span>
                  )}
                </div>
                {greenSeat ? (
                  <>
                    <XiangqiPieceToken type="k" color="green" className="my-3 h-20 w-20" />
                    <div className="text-base font-black text-white">{greenSeat.name}</div>
                    <div className="text-[11px] text-emerald-100/75">
                      {greenSeat.isHost ? '👑 Chủ phòng' : '🟢 Đã sẵn sàng'}
                    </div>
                  </>
                ) : (
                  <div className="my-auto py-8 text-xs font-bold text-slate-400">
                    Chờ đối thủ nhập mã #{snapshot.roomCode}...
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="col-span-5 flex flex-col justify-between gap-3 rounded-3xl border border-amber-300/35 bg-stone-950/84 p-4 shadow-2xl">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-950/35 p-3.5 text-xs leading-relaxed text-amber-100/90">
              <div className="mb-1.5 flex items-center gap-1.5 font-black uppercase text-amber-300">
                <ShieldCheck className="h-4 w-4" />
                Thông tin trận đấu Online
              </div>
              <div>• Tự động xoay bàn 180° để mỗi bên luôn nhìn quân mình ở 5 hàng phía dưới.</div>
              <div>• Mỗi người tùy ý bật <strong>Chữ Hán</strong> hoặc <strong>Tiếng Việt</strong> độc lập.</div>
              <div>• Không giới hạn giờ · Hỗ trợ Xin hòa &amp; F5 tự quay lại bàn cờ!</div>
            </div>

            {isHost ? (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => {
                  soundEngine.playEnterGame();
                  onStartMatch();
                }}
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                  boxShadow: '0 4px 0 #047857',
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                {canStart ? 'BẮT ĐẦU VÁN ONLINE' : 'ĐANG CHỜ ĐỦ 2 KỲ THỦ...'}
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-300/40 bg-amber-950/60 py-3 text-center text-xs font-black text-amber-200">
                <Crown className="mr-1 inline h-4 w-4 text-yellow-300" />
                Đã sẵn sàng — Chờ Chủ phòng bấm BẮT ĐẦU...
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
