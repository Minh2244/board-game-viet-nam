import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Gem,
  Link2,
  Play,
  ShieldAlert,
  UserCheck,
  Wifi,
} from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import { O_AN_QUAN_CHARACTERS, OAnQuanCharacterArt } from '../data/characters';
import type { CharacterId, PlayerSide } from '../engine/types';
import type {
  OAnQuanRoomSnapshot,
  OnlineTransportStatus,
} from '../network/onlineRoomClient';

interface OnlineLobbyViewProps {
  snapshot: OAnQuanRoomSnapshot;
  myToken: string;
  isHost: boolean;
  transportStatus: OnlineTransportStatus;
  transportMessage: string;
  onUpdateMember: (targetToken: string, patch: { name?: string; characterId?: CharacterId }) => void;
  onUpdateRules: (patch: {
    mandarinPointValue?: 5 | 10;
    mandarinYouthRule?: boolean;
    startingSide?: PlayerSide;
  }) => void;
  onStartMatch: () => void;
  onLeaveOrDissolve: () => void;
}

export function OnlineLobbyView({
  snapshot,
  myToken,
  isHost,
  transportStatus,
  transportMessage,
  onUpdateMember,
  onUpdateRules,
  onStartMatch,
  onLeaveOrDissolve,
}: OnlineLobbyViewProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const me = snapshot.members.find((m) => m.playerToken === myToken);
  const hostSeat = snapshot.members.find((m) => m.side === 0);
  const guestSeat = snapshot.members.find((m) => m.side === 1);
  const canStart = isHost && snapshot.members.length === 2;

  const copyRoomCode = () => {
    void navigator.clipboard?.writeText(snapshot.roomCode);
    setCopiedCode(true);
    soundEngine.playPushClick();
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?game=o-an-quan&room=${snapshot.roomCode}`;
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/82 via-amber-950/72 to-emerald-950/82"
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1080px] flex-col justify-between gap-3 px-6 py-4">
        {/* Thanh trên */}
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playPushClick();
              onLeaveOrDissolve();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300/45 bg-rose-950/70 px-4 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-900 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            {isHost ? 'Giải tán phòng' : 'Rời phòng'}
          </button>

          <div className="flex items-center gap-2.5 rounded-full border border-cyan-300/55 bg-slate-950/85 px-5 py-1.5 shadow-xl">
            <span className="text-xs font-bold text-slate-300">MÃ PHÒNG Ô ĂN QUAN:</span>
            <span className="font-mono text-xl font-black tracking-[0.2em] text-amber-300">
              {snapshot.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-2.5 py-1 text-[11px] font-black text-amber-200 hover:bg-amber-400/35 cursor-pointer"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCode ? 'Đã chép' : 'Chép mã'}
            </button>
            <button
              type="button"
              onClick={copyInviteLink}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/20 px-2.5 py-1 text-[11px] font-black text-cyan-200 hover:bg-cyan-400/35 cursor-pointer"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Link2 className="h-3.5 w-3.5" />}
              {copiedLink ? 'Đã chép link' : 'Chép link'}
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
            <span className="max-w-[190px] truncate">{transportMessage || 'Trực tuyến'}</span>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-12 items-stretch gap-5 py-1">
          {/* CỘT TRÁI (7/12): 2 GHẾ KỲ THỦ */}
          <section className="col-span-7 flex flex-col justify-between gap-3 rounded-3xl border border-cyan-300/35 bg-slate-950/78 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black tracking-wide text-amber-200">
                2 GHẾ KỲ THỦ ({snapshot.members.length}/2)
              </h2>
              <span className="text-[11px] font-semibold text-cyan-200/85">
                Màn hình mỗi bên tự xoay 5 ô của mình xuống hàng dưới
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Ghế 0: Chủ phòng */}
              <div className="flex flex-col items-center justify-between rounded-2xl border border-amber-300/45 bg-amber-950/35 p-4 text-center">
                <div className="flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-2.5 py-0.5 text-[10px] font-black text-amber-200">
                    <Crown className="h-3 w-3" />
                    CHỦ PHÒNG
                  </span>
                  {hostSeat?.playerToken === myToken && (
                    <span className="text-[10px] font-black text-emerald-300">★ Bạn</span>
                  )}
                </div>

                {hostSeat && (
                  <>
                    <OAnQuanCharacterArt characterId={hostSeat.characterId} mood="happy" className="my-2 h-28 w-24" />
                    <div className="text-base font-black text-white">{hostSeat.name}</div>
                    <div className="text-[11px] text-amber-100/75">
                      {hostSeat.characterId === 'cu_ti' ? 'Cu Tí' : 'Bé Mít'}
                    </div>
                  </>
                )}
              </div>

              {/* Ghế 1: Khách */}
              <div
                className={`flex flex-col items-center justify-between rounded-2xl border p-4 text-center ${
                  guestSeat
                    ? 'border-cyan-300/45 bg-cyan-950/35'
                    : 'border-dashed border-white/25 bg-white/5'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/25 px-2.5 py-0.5 text-[10px] font-black text-cyan-200">
                    <UserCheck className="h-3 w-3" />
                    ĐỐI THỦ
                  </span>
                  {guestSeat?.playerToken === myToken && (
                    <span className="text-[10px] font-black text-emerald-300">★ Bạn</span>
                  )}
                </div>

                {guestSeat ? (
                  <>
                    <OAnQuanCharacterArt
                      characterId={guestSeat.characterId}
                      mood="happy"
                      facing="left"
                      className="my-2 h-28 w-24"
                    />
                    <div className="text-base font-black text-white">{guestSeat.name}</div>
                    <div className="text-[11px] text-cyan-100/75">
                      {guestSeat.characterId === 'cu_ti' ? 'Cu Tí' : 'Bé Mít'}
                    </div>
                  </>
                ) : (
                  <div className="my-auto flex flex-col items-center gap-2 py-6 text-slate-300">
                    <div className="text-3xl font-black text-cyan-300/50">?</div>
                    <div className="text-xs font-bold">Đang chờ đối thủ nhập mã #{snapshot.roomCode}...</div>
                  </div>
                )}
              </div>
            </div>

            {/* Tự đổi nhân vật / tên của bản thân */}
            {me && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/35 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Đổi nhân vật của bạn:</span>
                  {O_AN_QUAN_CHARACTERS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        onUpdateMember(myToken, { characterId: c.id });
                      }}
                      className={`rounded-xl px-3 py-1 text-xs font-black transition cursor-pointer ${
                        me.characterId === c.id
                          ? 'bg-amber-400 text-stone-950 shadow'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* CỘT PHẢI (5/12): CÀI ĐẶT PHÒNG & BẮT ĐẦU */}
          <section className="col-span-5 flex flex-col justify-between gap-4 rounded-3xl border border-cyan-300/35 bg-slate-950/78 p-5 shadow-2xl">
            <div className="space-y-3.5">
              {/* Giá trị mỗi viên Quan */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase text-emerald-200">
                  <Gem className="h-3.5 w-3.5 text-emerald-300" />
                  Giá trị mỗi viên Quan
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 10 as const, label: '10 điểm / Quan', sub: 'Tổng 70đ (Chuẩn)' },
                    { val: 5 as const, label: '5 điểm / Quan', sub: 'Tổng 60đ (Dân gian)' },
                  ].map((opt) => {
                    const currentVal = snapshot.mandarinPointValue === 5 ? 5 : 10;
                    const active = currentVal === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        disabled={!isHost}
                        onClick={() => {
                          soundEngine.playPushClick();
                          onUpdateRules({ mandarinPointValue: opt.val });
                        }}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? 'border-emerald-300 bg-emerald-500/25 ring-2 ring-emerald-300/50'
                            : 'border-white/15 bg-white/5 text-slate-300'
                        } ${isHost ? 'cursor-pointer hover:bg-white/10' : 'opacity-70 cursor-not-allowed'}`}
                      >
                        <div className="text-xs font-black text-white">{opt.label}</div>
                        <div className="text-[10.5px] text-emerald-100/75">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/30 bg-amber-950/35 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-300" />
                    <span className="text-xs font-black uppercase text-amber-200">Luật Quan Non</span>
                  </div>
                  <button
                    type="button"
                    disabled={!isHost}
                    onClick={() => {
                      soundEngine.playPushClick();
                      onUpdateRules({ mandarinYouthRule: !snapshot.mandarinYouthRule });
                    }}
                    className={`relative h-7 w-13 rounded-full transition ${
                      snapshot.mandarinYouthRule ? 'bg-amber-400' : 'bg-slate-700'
                    } ${isHost ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        snapshot.mandarinYouthRule ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-amber-100/80">
                  {snapshot.mandarinYouthRule
                    ? 'Bật: Ô Quan còn viên Quan lớn phải đủ 5 dân mới được ăn.'
                    : 'Tắt (Mặc định): Được ăn ô Quan ngay khi tạo thế trống-có quân.'}
                </p>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-black uppercase text-cyan-200">Ai đi trước</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { side: 0 as const, label: 'Chủ phòng đi trước' },
                    { side: 1 as const, label: 'Khách đi trước' },
                  ].map((opt) => (
                    <button
                      key={opt.side}
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        soundEngine.playPushClick();
                        onUpdateRules({ startingSide: opt.side });
                      }}
                      className={`rounded-xl border py-2 text-xs font-black transition ${
                        snapshot.startingSide === opt.side
                          ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                          : 'border-white/15 bg-white/5 text-slate-300'
                      } ${isHost ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isHost ? (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => {
                  soundEngine.playEnterGame();
                  onStartMatch();
                }}
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-black tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                  boxShadow: '0 4px 0 #047857',
                }}
              >
                <Play className="h-5 w-5 fill-current" />
                {canStart ? 'BẮT ĐẦU VÁN ONLINE' : 'ĐANG CHỜ ĐỦ 2 NGƯỜI...'}
              </button>
            ) : (
              <div className="rounded-2xl border border-cyan-300/40 bg-cyan-950/60 py-3.5 text-center text-xs font-black text-cyan-200">
                ✨ Đã sẵn sàng — Đang chờ Chủ phòng bấm BẮT ĐẦU...
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
