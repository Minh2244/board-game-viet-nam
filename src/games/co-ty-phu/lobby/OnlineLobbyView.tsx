import { useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Crown,
  Dices,
  Link2,
  Map,
  Palette,
  Play,
  User,
  UserPlus,
  UserX,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { buildInviteUrl } from '@/shared/network/onlineTransportConfig';
import { CO_TY_PHU_CHARACTERS, LAND_COLORS } from '../data/characters';
import type { CharacterId, LandColorId } from '../engine/types';
import type {
  OnlineRoomMember,
  OnlineRoomSnapshot,
  OnlineTransportStatus,
} from '../network/onlineRoomClient';

interface OnlineLobbyViewProps {
  snapshot: OnlineRoomSnapshot;
  myToken: string;
  isHost: boolean;
  transportStatus: OnlineTransportStatus;
  statusMessage: string;
  onLeaveRoom: () => void;
  onUpdateMember: (
    targetToken: string,
    patch: { name?: string; characterId?: CharacterId; landColor?: LandColorId },
  ) => void;
  onSetBotCount: (count: number) => void;
  onUpdateSettings: (patch: { diceCount?: 1 | 2; mapMode?: 'default' | 'random' }) => void;
  onKickMember: (targetToken: string) => void;
  onStartMatch: () => void;
}

export function OnlineLobbyView({
  snapshot,
  myToken,
  isHost,
  transportStatus,
  statusMessage,
  onLeaveRoom,
  onUpdateMember,
  onSetBotCount,
  onUpdateSettings,
  onKickMember,
  onStartMatch,
}: OnlineLobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [editingToken, setEditingToken] = useState<string>(myToken);
  const { muted, toggleMute } = useAudioStore();

  const allActiveMembers: OnlineRoomMember[] = [...snapshot.humans, ...snapshot.bots];
  const openHumanSlots = Math.max(0, 6 - snapshot.botCount - snapshot.humans.length);
  const totalParticipants = allActiveMembers.length;
  const canStart = isHost && totalParticipants >= 2;

  // Chủ phòng được chỉnh bản thân + các Máy; Khách chỉ chỉnh ghế của bản thân
  const editableMember =
    allActiveMembers.find(
      (m) => m.playerToken === editingToken && (m.playerToken === myToken || (isHost && m.isBot)),
    ) ??
    snapshot.humans.find((h) => h.playerToken === myToken) ??
    allActiveMembers[0];

  const selectedChar =
    CO_TY_PHU_CHARACTERS.find((c) => c.id === editableMember?.characterId) ??
    CO_TY_PHU_CHARACTERS[0];
  const selectedLandColor =
    LAND_COLORS.find((c) => c.id === editableMember?.landColor) ?? LAND_COLORS[0];

  const formattedPin = `${snapshot.roomCode.slice(0, 3)} ${snapshot.roomCode.slice(3)}`;

  const handleCopyPin = () => {
    soundEngine.playPushClick();
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(snapshot.roomCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyInviteLink = () => {
    soundEngine.playPushClick();
    const url = buildInviteUrl('co-ty-phu', snapshot.roomCode);
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleToggleAudio = () => {
    toggleMute();
    soundEngine.playPushClick();
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/76 via-cyan-950/55 to-stone-950/82"
      />

      <div className="relative z-10 flex min-h-full w-full flex-col gap-3 px-3 py-3 sm:px-5 sm:py-3.5">
        {/* Thanh đầu phòng: Rời phòng + Mã 6 chữ số cỡ lớn + Trạng thái kết nối */}
        <header className="mx-auto flex w-full max-w-[1140px] flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playPushClick();
              onLeaveRoom();
            }}
            className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)',
              boxShadow: '0 4px 0 #881337, 0 8px 18px rgba(0,0,0,0.35)',
            }}
          >
            <ArrowLeft className="h-4 w-4 stroke-[3]" />
            {isHost ? 'Giải tán phòng' : 'Rời phòng'}
          </button>

          {/* HỘP MÃ PHÒNG 6 CHỮ SỐ NỔI BẬT */}
          <div className="flex items-center gap-3 rounded-full border-2 border-amber-300/80 bg-slate-950/88 px-5 py-1.5 shadow-[0_0_28px_rgba(251,191,36,0.28)]">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-200/90">
              MÃ PHÒNG:
            </span>
            <span
              data-testid="online-room-code-display"
              className="font-mono text-2xl font-black tracking-[0.22em] text-amber-300"
            >
              {formattedPin}
            </span>
            <button
              type="button"
              onClick={handleCopyPin}
              className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950 transition hover:bg-amber-300 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Đã chép!' : 'Chép mã'}
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="inline-flex items-center gap-1 rounded-full bg-cyan-400/25 border border-cyan-300/50 px-3 py-1 text-xs font-black text-cyan-200 transition hover:bg-cyan-400/40 cursor-pointer"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 stroke-[3] text-emerald-300" /> : <Link2 className="h-3.5 w-3.5" />}
              {copiedLink ? 'Đã chép link!' : 'Chép link'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                transportStatus === 'READY'
                  ? 'border-emerald-400/50 bg-emerald-950/60 text-emerald-200'
                  : transportStatus === 'ERROR'
                    ? 'border-rose-400/50 bg-rose-950/60 text-rose-200'
                    : 'border-amber-400/50 bg-amber-950/60 text-amber-200'
              }`}
            >
              <Wifi className="h-3.5 w-3.5" />
              {statusMessage}
            </span>
            <button
              type="button"
              onClick={handleToggleAudio}
              title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-slate-900/85 text-amber-200 hover:bg-slate-800 cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4 text-rose-300" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* SẢNH PHÒNG CHỜ ONLINE 2 CỘT TRÁI – PHẢI TRÊN KHUNG NGANG 1220×590 */}
        <main className="mx-auto grid w-full max-w-[1140px] flex-1 grid-cols-12 gap-4">
          {/* CỘT TRÁI (7 CỘT): GHẾ NGƯỜI + MÁY (0–4) + CÀI ĐẶT + NÚT BẮT ĐẦU */}
          <section className="mobile-flat-shadow col-span-7 flex flex-col gap-3 rounded-[24px] border border-cyan-400/45 bg-slate-900/92 p-4 shadow-2xl backdrop-blur-md">
            {/* Thanh tiêu đề & Bộ chọn Số Máy (0–4) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-xl font-black text-cyan-300">
                  SẢNH PHÒNG CHỜ ONLINE ({totalParticipants}/6 tụ)
                </h2>
                <p className="text-xs text-slate-300">
                  Đang có <strong className="text-emerald-300">{snapshot.humans.length} Người</strong> ·{' '}
                  <strong className="text-amber-300">{snapshot.botCount} Máy</strong> · Còn mở{' '}
                  <strong className="text-cyan-200">{openHumanSlots} ghế</strong> cho bạn bè
                </p>
              </div>

              {/* Bộ chọn Số lượng Máy (0..4) */}
              <div className="flex items-center gap-1 rounded-full border border-amber-400/35 bg-black/45 p-1">
                <span className="inline-flex items-center gap-1 px-2 text-xs font-black text-amber-300">
                  <Bot className="h-3.5 w-3.5" />
                  Máy:
                </span>
                {[0, 1, 2, 3, 4].map((cnt) => {
                  const exceedsMax = snapshot.humans.length + cnt > 6;
                  const active = snapshot.botCount === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      disabled={!isHost || exceedsMax}
                      onClick={() => {
                        soundEngine.playPushClick();
                        onSetBotCount(cnt);
                      }}
                      className={`h-7 w-7 rounded-full text-xs font-black transition ${
                        active
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : isHost && !exceedsMax
                            ? 'text-stone-200 hover:bg-white/15 cursor-pointer'
                            : 'text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      {cnt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lưới 6 ghế (Người đã vào + Máy + Ghế trống chờ bạn bè) */}
            <div className="grid grid-cols-2 gap-2.5">
              {allActiveMembers.map((member) => {
                const charInfo =
                  CO_TY_PHU_CHARACTERS.find((c) => c.id === member.characterId) ??
                  CO_TY_PHU_CHARACTERS[0];
                const landInfo =
                  LAND_COLORS.find((c) => c.id === member.landColor) ?? LAND_COLORS[0];
                const isMe = member.playerToken === myToken;
                const canEdit = isMe || (isHost && member.isBot);
                const isEditing = editableMember?.playerToken === member.playerToken;

                return (
                  <div
                    key={member.playerToken}
                    onClick={() => {
                      if (canEdit) {
                        soundEngine.playPushClick();
                        setEditingToken(member.playerToken);
                      }
                    }}
                    style={{
                      borderColor: isEditing ? landInfo.hex : undefined,
                      boxShadow: isEditing ? `0 0 16px ${landInfo.hex}55` : undefined,
                    }}
                    className={`flex items-center justify-between gap-2 rounded-2xl border p-2.5 transition ${
                      isEditing
                        ? 'bg-black/55'
                        : 'border-white/15 bg-black/32'
                    } ${canEdit ? 'cursor-pointer hover:border-white/35' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="relative shrink-0">
                        <img
                          src={charInfo.avatarUrl}
                          alt={charInfo.name}
                          className="h-11 w-11 rounded-xl border-2 object-cover"
                          style={{ borderColor: landInfo.hex }}
                        />
                        <span
                          className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-950"
                          style={{ backgroundColor: landInfo.hex }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-black text-white">
                            {member.name}
                          </span>
                          {isMe && (
                            <span className="rounded bg-cyan-400/25 px-1.5 py-0.5 text-[9px] font-black text-cyan-200">
                              BẠN
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-emerald-200/85">
                          {charInfo.name}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {member.isHost ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/25 px-2.5 py-1 text-[11px] font-black text-amber-200">
                          <Crown className="h-3 w-3" />
                          Chủ
                        </span>
                      ) : member.isBot ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/45 bg-amber-500/20 px-2.5 py-1 text-[11px] font-extrabold text-amber-200">
                          <Bot className="h-3 w-3" />
                          Máy
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/25 px-2 py-1 text-[11px] font-extrabold text-emerald-100">
                            <User className="h-3 w-3" />
                            Online
                          </span>
                          {isHost && (
                            <button
                              type="button"
                              title={`Mời ${member.name} rời phòng`}
                              onClick={(e) => {
                                e.stopPropagation();
                                soundEngine.playPushClick();
                                onKickMember(member.playerToken);
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/25 text-rose-300 hover:bg-rose-500/45 cursor-pointer"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Ghế Người còn mở chờ bạn bè nhập mã 6 số */}
              {Array.from({ length: openHumanSlots }).map((_, idx) => (
                <div
                  key={`open_${idx}`}
                  className="flex items-center gap-2.5 rounded-2xl border border-dashed border-cyan-300/30 bg-slate-950/35 p-2.5 text-slate-400"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-cyan-400/35 bg-cyan-950/30 text-cyan-300/70">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-cyan-200/80">Ghế trống cho bạn bè</div>
                    <div className="truncate text-[11px] text-slate-400">
                      Gửi mã <strong className="font-mono text-amber-300">{formattedPin}</strong> để tham gia
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cài đặt đầu ván (Chủ phòng chỉnh, Khách xem trực tiếp) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                  <Dices className="h-4 w-4 text-cyan-300" />
                  Chế độ Xúc xắc
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([1, 2] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        soundEngine.playPushClick();
                        onUpdateSettings({ diceCount: cnt });
                      }}
                      className={`rounded-xl py-1.5 text-xs font-black transition ${
                        snapshot.diceCount === cnt
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : isHost
                            ? 'bg-white/10 text-stone-200 hover:bg-white/20 cursor-pointer'
                            : 'bg-white/5 text-stone-400 cursor-default'
                      }`}
                    >
                      {cnt} Xúc xắc
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                  <Map className="h-4 w-4 text-amber-300" />
                  Bố cục bàn cờ
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ['default', 'Mặc định'],
                      ['random', 'Ngẫu nhiên'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        soundEngine.playPushClick();
                        onUpdateSettings({ mapMode: val });
                      }}
                      className={`rounded-xl py-1.5 text-xs font-black transition ${
                        snapshot.mapMode === val
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : isHost
                            ? 'bg-white/10 text-stone-200 hover:bg-white/20 cursor-pointer'
                            : 'bg-white/5 text-stone-400 cursor-default'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Nút Bắt đầu (Chủ phòng) hoặc Trạng thái chờ (Khách) */}
            <div className="mt-auto">
              {isHost ? (
                <button
                  type="button"
                  data-testid="online-start-match-btn"
                  disabled={!canStart}
                  onClick={() => {
                    soundEngine.playEnterGame();
                    onStartMatch();
                  }}
                  className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-full py-3 text-lg font-black text-white cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 52%, #06B6D4 100%)',
                    boxShadow: '0 6px 0 #047857, 0 12px 24px rgba(16,185,129,0.45)',
                  }}
                >
                  <Play className="h-5 w-5 fill-white" />
                  {canStart
                    ? `BẮT ĐẦU VÁN ONLINE (${snapshot.humans.length} Người + ${snapshot.botCount} Máy)`
                    : 'CẦN TỐI THIỂU 2 TỤ (MỜI BẠN HOẶC THÊM MÁY)'}
                </button>
              ) : (
                <div className="flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300/45 bg-cyan-950/60 py-3 text-sm font-black text-cyan-200">
                  <Crown className="h-4 w-4 text-amber-300" />
                  Đã sẵn sàng · Đang chờ Chủ phòng bấm Bắt đầu ván...
                </div>
              )}
            </div>
          </section>

          {/* CỘT PHẢI (5 CỘT): TÙY CHỈNH TÊN + MÀU ĐẤT + NHÂN VẬT CHIBI REALTIME */}
          {editableMember && (
            <section className="mobile-flat-shadow col-span-5 flex flex-col justify-between gap-2.5 rounded-[24px] border border-amber-300/35 bg-stone-900/92 p-4 shadow-2xl backdrop-blur-md">
              <div className="w-full text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-200">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: selectedLandColor.hex }}
                  />
                  {editableMember.playerToken === myToken
                    ? 'Hồ sơ của bạn'
                    : `Đang chỉnh Máy: ${editableMember.name}`}
                </div>
                <h3 className="mt-1 text-xl font-black text-white">{selectedChar.name}</h3>
                <p className="text-xs text-stone-300">{selectedChar.tagline}</p>
              </div>

              <div className="relative my-0.5 flex h-36 w-full items-end justify-center">
                <div
                  aria-hidden="true"
                  className="smooth-hide-blur absolute bottom-1 h-6 w-32 rounded-full blur-md"
                  style={{ backgroundColor: selectedLandColor.hex, opacity: 0.55 }}
                />
                <img
                  src={selectedChar.standeeUrl}
                  alt={selectedChar.name}
                  className="relative h-36 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
                />
              </div>

              <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="online-member-name" className="shrink-0 text-xs font-bold text-stone-300">
                    Tên hiển thị:
                  </label>
                  <input
                    id="online-member-name"
                    type="text"
                    maxLength={18}
                    value={editableMember.name}
                    onChange={(e) =>
                      onUpdateMember(editableMember.playerToken, { name: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/15 bg-stone-950/75 px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-stone-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-amber-300" />
                      Màu đất sở hữu
                    </span>
                    <span style={{ color: selectedLandColor.ringHex }}>{selectedLandColor.name}</span>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5">
                    {LAND_COLORS.map((c) => {
                      const isCurrent = c.id === editableMember.landColor;
                      const humanOwner = snapshot.humans.find(
                        (h) => h.playerToken !== editableMember.playerToken && h.landColor === c.id,
                      );
                      const botOwner = snapshot.bots.find(
                        (b) => b.playerToken !== editableMember.playerToken && b.landColor === c.id,
                      );
                      const blocked = Boolean(humanOwner);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={blocked}
                          title={
                            humanOwner
                              ? `${c.name} (đã được ${humanOwner.name} chọn)`
                              : botOwner
                                ? `${c.name} (bấm để đổi với ${botOwner.name})`
                                : c.name
                          }
                          onClick={() => {
                            soundEngine.playPushClick();
                            onUpdateMember(editableMember.playerToken, { landColor: c.id });
                          }}
                          className={`relative flex h-7 w-full items-center justify-center rounded-lg border-2 transition ${
                            isCurrent
                              ? 'scale-105 border-white shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                              : blocked
                                ? 'border-white/10 opacity-30 cursor-not-allowed'
                                : 'border-white/25 opacity-85 hover:scale-105 hover:opacity-100 cursor-pointer'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {isCurrent && <Check className="h-3.5 w-3.5 stroke-[3] text-white drop-shadow" />}
                          {!isCurrent && (humanOwner || botOwner) && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid w-full grid-cols-4 gap-2">
                {CO_TY_PHU_CHARACTERS.map((ch) => {
                  const picked = ch.id === selectedChar.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        onUpdateMember(editableMember.playerToken, { characterId: ch.id });
                      }}
                      className={`group flex flex-col items-center rounded-xl border p-1.5 transition cursor-pointer ${
                        picked
                          ? 'border-cyan-400 bg-cyan-950/75 ring-2 ring-cyan-300/70'
                          : 'border-white/15 bg-black/30 hover:border-white/40'
                      }`}
                    >
                      <img
                        src={ch.avatarUrl}
                        alt={ch.name}
                        className="h-10 w-10 rounded-lg object-cover transition group-hover:scale-105"
                      />
                      <span className="mt-1 line-clamp-2 text-center text-[10px] leading-tight font-bold text-stone-200">
                        {ch.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
