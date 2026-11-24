import { useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Crown,
  Link2,
  Play,
  ShieldCheck,
  UserMinus,
  Wifi,
} from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine } from '@/shared/audio/soundEngine';
import { CLOCKWISE_COLORS, HORSE_COLOR_CONFIG } from '../engine/boardGeometry';
import type { HorseBotDifficulty, HorseColor } from '../engine/types';
import type {
  CoCaNguaRoomSnapshot,
  OnlineTransportStatus,
} from '../network/onlineRoomClient';
import { HorsePieceSvg } from '../ui/HorsePieceSvg';

interface OnlineLobbyViewProps {
  snapshot: CoCaNguaRoomSnapshot;
  myToken: string;
  isHost: boolean;
  transportStatus: OnlineTransportStatus;
  transportMessage: string;
  onUpdateMember: (targetToken: string, patch: { name?: string; color?: HorseColor }) => void;
  onSetBotCount: (count: number) => void;
  onSetBotDifficulty: (diff: HorseBotDifficulty) => void;
  onKickMember: (targetToken: string) => void;
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
  onSetBotCount,
  onSetBotDifficulty,
  onKickMember,
  onStartMatch,
  onLeaveOrDissolve,
}: OnlineLobbyViewProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const allMembers = [...snapshot.humans, ...snapshot.bots];
  const me = snapshot.humans.find((h) => h.playerToken === myToken);
  const totalSeated = allMembers.length;
  const maxBotsAllowed = Math.max(0, 4 - snapshot.humans.length);
  const canStart = isHost && totalSeated >= 2;

  const copyRoomCode = () => {
    void navigator.clipboard?.writeText(snapshot.roomCode);
    setCopiedCode(true);
    soundEngine.playPushClick();
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?game=co-ca-ngua&room=${snapshot.roomCode}`;
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/84 via-amber-950/74 to-orange-950/84"
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

          <div className="flex items-center gap-2 rounded-full border border-cyan-300/55 bg-slate-950/85 px-4 py-1 shadow-xl">
            <span className="text-[11px] font-bold text-slate-300">MÃ PHÒNG:</span>
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
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/20 px-2 py-0.5 text-[11px] font-black text-cyan-200 hover:bg-cyan-400/35 cursor-pointer"
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
          {/* 4 CHUỒNG MÀU */}
          <section className="col-span-7 flex flex-col justify-between gap-3 rounded-3xl border border-cyan-300/35 bg-slate-950/82 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black tracking-wide text-amber-200">
                4 CHUỒNG NGỰA ({totalSeated}/4 Sẵn Sàng)
              </h2>
              <span className="text-[10.5px] font-semibold text-cyan-200/85">
                Chạm chuồng trống hoặc Máy để đổi màu
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CLOCKWISE_COLORS.map((color) => {
                const vis = HORSE_COLOR_CONFIG[color];
                const occupant = allMembers.find((m) => m.color === color) ?? null;
                const isMe = occupant?.playerToken === myToken;
                const canClaimColor = Boolean(me && (!occupant || occupant.isBot));

                return (
                  <div
                    key={color}
                    onClick={() => {
                      if (canClaimColor && me && me.color !== color) {
                        soundEngine.playPushClick();
                        onUpdateMember(myToken, { color });
                      }
                    }}
                    className={`flex flex-col justify-between rounded-2xl border p-3 transition ${
                      occupant
                        ? isMe
                          ? 'bg-white/[0.09] ring-2 ring-yellow-300/75'
                          : 'bg-white/[0.05]'
                        : 'border-dashed bg-white/[0.02] hover:bg-white/[0.06]'
                    } ${canClaimColor ? 'cursor-pointer' : ''}`}
                    style={{ borderColor: occupant ? `${vis.bright}99` : `${vis.main}66` }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                        style={{ backgroundColor: vis.main }}
                      >
                        {vis.nameVi.toUpperCase()}
                      </span>

                      <div className="flex items-center gap-1">
                        {occupant?.isHost && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/25 px-2 py-0.5 text-[9.5px] font-black text-amber-200">
                            <Crown className="h-2.5 w-2.5" />
                            Chủ
                          </span>
                        )}
                        {occupant?.isBot && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[9.5px] font-black text-emerald-200">
                            <Bot className="h-2.5 w-2.5" />
                            AI
                          </span>
                        )}
                        {isMe && <span className="text-[10px] font-black text-yellow-300">★ Bạn</span>}
                        {isHost && occupant && !occupant.isHost && !occupant.isBot && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              soundEngine.playPushClick();
                              onKickMember(occupant.playerToken);
                            }}
                            title="Mời rời phòng"
                            className="rounded-lg bg-rose-500/25 p-1 text-rose-200 hover:bg-rose-500/45 cursor-pointer"
                          >
                            <UserMinus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2.5">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2"
                        style={{
                          backgroundColor: occupant ? vis.soft : 'rgba(255,255,255,0.06)',
                          borderColor: occupant ? vis.main : `${vis.main}55`,
                        }}
                      >
                        <HorsePieceSvg
                          color={color}
                          className={`h-9 w-9 ${occupant ? '' : 'opacity-35'}`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        {occupant ? (
                          <>
                            <div className="truncate text-sm font-black text-white">{occupant.name}</div>
                            <div className="text-[10.5px] font-semibold text-slate-300">
                              {occupant.isBot
                                ? 'Sẵn sàng đua'
                                : occupant.connected
                                  ? '🟢 Đang kết nối'
                                  : '🟡 Tạm mất mạng...'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs font-black text-slate-300">Ghế trống</div>
                            <div className="text-[10.5px] text-cyan-200/80">Chạm chọn màu {vis.nameVi}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CÀI ĐẶT & BẮT ĐẦU */}
          <section className="col-span-5 flex flex-col justify-between gap-3 rounded-3xl border border-cyan-300/35 bg-slate-950/82 p-4 shadow-2xl">
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-black uppercase text-emerald-200">
                  <span>Thêm Máy AI</span>
                  <span className="text-[10.5px] font-bold text-slate-300">
                    {snapshot.humans.length} Người + {snapshot.bots.length} Máy
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3].map((cnt) => {
                    const disabled = !isHost || cnt > maxBotsAllowed;
                    const active = snapshot.botCount === cnt;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          soundEngine.playPushClick();
                          onSetBotCount(cnt);
                        }}
                        className={`rounded-xl border py-1.5 text-xs font-black transition ${
                          active
                            ? 'border-emerald-300 bg-emerald-400 text-slate-950 shadow'
                            : 'border-white/15 bg-white/5 text-slate-200'
                        } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-white/15'}`}
                      >
                        {cnt === 0 ? 'Không' : `${cnt} Máy`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {snapshot.botCount > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-black uppercase text-cyan-200">Độ khó Máy AI</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'easy', label: 'Tập Chơi' },
                        { id: 'medium', label: 'Thách Đấu' },
                        { id: 'hard', label: 'Cao Thủ' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!isHost}
                        onClick={() => {
                          soundEngine.playPushClick();
                          onSetBotDifficulty(opt.id);
                        }}
                        className={`rounded-xl border py-1.5 text-xs font-black transition ${
                          snapshot.botDifficulty === opt.id
                            ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                            : 'border-white/15 bg-white/5 text-slate-200'
                        } ${isHost ? 'cursor-pointer hover:bg-white/15' : 'cursor-not-allowed opacity-60'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-amber-300/30 bg-amber-950/35 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/85">
                <div className="mb-0.5 flex items-center gap-1.5 font-black uppercase text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Bảo vệ phòng Online
                </div>
                <div>• F5 tự quay lại bàn cờ · Mất mạng giữ ghế <strong>2 phút</strong>.</div>
                <div>• Gieo 1 hoặc 6 xuất chuồng + thêm lượt · Kín bụt 3–6 thắng!</div>
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
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                  boxShadow: '0 4px 0 #047857',
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                {canStart ? `BẮT ĐẦU (${totalSeated} MÀU)` : 'CẦN TỐI THIỂU 2 MÀU...'}
              </button>
            ) : (
              <div className="rounded-2xl border border-cyan-300/40 bg-cyan-950/60 py-3 text-center text-xs font-black text-cyan-200">
                ✨ Đã sẵn sàng — Chờ Chủ phòng bấm BẮT ĐẦU...
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
