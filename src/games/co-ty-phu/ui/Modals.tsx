import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BookOpen, Building2, CheckCircle2, Clock, Crown, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import { COLOR_GROUPS } from '../data/boardData';
import { getCardArtworkUrl } from '../data/cardArtwork';
import { CO_TY_PHU_CHARACTERS } from '../data/characters';
import { getLandmarkArtworkUrl } from '../data/landmarkArtwork';
import {
  calculatePropertyRent,
  calculateStationRent,
  computePlayerNetWorth,
  formatShortVnd,
  formatVnd,
  playerOwnsFullColorGroup,
} from '../engine/rules';
import type { ActiveCardPrompt, BoardTile, GameState, PlayerState } from '../engine/types';
import {
  AirportIcon,
  ChanceSymbolSvg,
  CornerGoIcon,
  CornerGoToJailIcon,
  CornerJailIcon,
  CornerParkingIcon,
  FateSymbolSvg,
  HeritageCitadelIcon,
  HydroPowerIcon,
  MiniHouseSvg,
  MiniVillaSvg,
  StationBusIcon,
  TaxStampIcon,
} from './TileIcons';

const CARD_DISPLAY_MS = 7000;

export function CardRevealModal({
  prompt,
  drawer,
  canConfirm = true,
  onConfirm,
}: {
  prompt: ActiveCardPrompt;
  drawer: PlayerState;
  canConfirm?: boolean;
  onConfirm: () => void;
}) {
  const isChance = prompt.card.deck === 'CHANCE';
  const artUrl = getCardArtworkUrl(prompt.card.id);
  const [msLeft, setMsLeft] = useState(CARD_DISPLAY_MS);
  const firedRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    firedRef.current = false;
    setMsLeft(CARD_DISPLAY_MS);
    const start = Date.now();
    const timer = setInterval(() => {
      const rem = Math.max(0, CARD_DISPLAY_MS - (Date.now() - start));
      setMsLeft(rem);
      if (rem === 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(timer);
        if (canConfirm) {
          onConfirmRef.current();
        }
      }
    }, 100);
    return () => clearInterval(timer);
  }, [prompt.card.id, prompt.drawerId, canConfirm]);

  const handleManualConfirm = () => {
    if (!canConfirm || firedRef.current) return;
    firedRef.current = true;
    onConfirm();
  };

  const secLeft = Math.max(1, Math.ceil(msLeft / 1000));
  const pct = (msLeft / CARD_DISPLAY_MS) * 100;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-hub-card relative w-full max-w-md rounded-[28px] p-[3.5px] shadow-[0_24px_60px_rgba(0,0,0,0.68)]"
        style={{
          background: isChance
            ? 'linear-gradient(135deg, #38BDF8 0%, #2563EB 55%, #FBBF24 100%)'
            : 'linear-gradient(135deg, #FB923C 0%, #EA580C 55%, #DC2626 100%)',
        }}
      >
        <div
          className="rounded-[24.5px] p-5 text-center text-white sm:p-6"
          style={{
            background: isChance
              ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.97) 0%, rgba(30, 58, 138, 0.96) 100%)'
              : 'linear-gradient(180deg, rgba(28, 25, 23, 0.97) 0%, rgba(124, 45, 18, 0.96) 100%)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-black tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              {isChance ? 'THẺ CƠ HỘI' : 'THẺ KHÍ VẬN'}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-amber-200">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: drawer.landHex }} />
              {drawer.name} {drawer.isBot ? '(Máy)' : ''}
            </div>
          </div>

          {artUrl && (
            <div className="mt-3 overflow-hidden rounded-2xl border-2 border-white/25 bg-black/30 shadow-inner">
              <img
                src={artUrl}
                alt={prompt.card.title}
                className="mx-auto h-40 w-full object-cover sm:h-44"
              />
            </div>
          )}

          <h3 className="mt-3.5 text-2xl font-black tracking-wide text-amber-200">
            {prompt.card.title}
          </h3>

          <p className="mt-2.5 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm leading-relaxed text-white/95">
            {prompt.card.description}
          </p>

          {/* Thanh đếm ngược 7 giây tự đóng */}
          <div className="mt-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/75">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-300" />
                Hiển thị cho mọi người cùng xem
              </span>
              <span className="text-amber-300">Tự đóng sau {secLeft}s</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${pct}%`,
                  background: isChance
                    ? 'linear-gradient(90deg, #38BDF8, #FBBF24)'
                    : 'linear-gradient(90deg, #FB923C, #FDE047)',
                }}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleManualConfirm}
            className="uiverse-push-btn uiverse-dome-shine mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-black text-white cursor-pointer disabled:opacity-65 disabled:cursor-default sm:text-base"
            style={{
              background: isChance
                ? 'linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)'
                : 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
              boxShadow: isChance ? '0 5px 0 #1E3A8A' : '0 5px 0 #9A3412',
            }}
          >
            <CheckCircle2 className="h-5 w-5" />
            {!canConfirm
              ? `ĐANG CHỜ ${drawer.name.toUpperCase()} XÁC NHẬN (${secLeft}s)`
              : drawer.isBot
                ? `ĐÃ XEM · TIẾP TỤC (${secLeft}s)`
                : `XÁC NHẬN ÁP DỤNG (${secLeft}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TileInspectorModal({
  tile,
  state,
  onClose,
}: {
  tile: BoardTile;
  state: GameState;
  onClose: () => void;
}) {
  const ownerId =
    tile.kind === 'AUCTION_STATION'
      ? tile.auctionState?.finalOwnerId ?? null
      : tile.ownerId;
  const owner = ownerId ? state.players.find((p) => p.id === ownerId) : null;
  const groupInfo = tile.colorGroup ? COLOR_GROUPS[tile.colorGroup] : null;
  const groupSize =
    tile.kind === 'PROPERTY' && tile.colorGroup
      ? state.tiles.filter((t) => t.kind === 'PROPERTY' && t.colorGroup === tile.colorGroup).length
      : 3;
  const hasMonopoly =
    tile.kind === 'PROPERTY' &&
    owner &&
    tile.colorGroup &&
    playerOwnsFullColorGroup(state.tiles, owner.id, tile.colorGroup);

  const buildUnit = tile.basePrice ? tile.basePrice / 2 : 0;
  const buildHotel = tile.basePrice ?? 0;
  const landmarkArtUrl = getLandmarkArtworkUrl(tile.name);

  // Màu banner tiêu đề theo đúng loại ô cổ điển
  let headerBg = groupInfo?.hex ?? '#1E293B';
  let subtitleLabel = groupInfo ? `NHÓM ${groupInfo.id} · ${groupInfo.name.toUpperCase()}` : 'Ô SỰ KIỆN ĐẶC BIỆT';
  if (tile.kind === 'AUCTION_STATION') {
    headerBg = 'linear-gradient(135deg, #334155 0%, #1E293B 100%)';
    subtitleLabel = 'ĐẤU GIÁ ĐỘC LẬP · KHÔNG THUỘC NHÓM MÀU ĐẤT';
  } else if (tile.kind === 'AIRPORT') {
    headerBg = 'linear-gradient(135deg, #0369A1 0%, #0C4A6E 100%)';
    subtitleLabel = 'CẢNG HÀNG KHÔNG QUỐC TẾ';
  } else if (tile.kind === 'UTILITY') {
    headerBg = 'linear-gradient(135deg, #0F766E 0%, #134E4A 100%)';
    subtitleLabel = 'TIỆN ÍCH ĐỘC LẬP · KHÔNG THUỘC NHÓM MÀU ĐẤT';
  } else if (tile.kind === 'CHANCE') {
    headerBg = 'linear-gradient(135deg, #D97706 0%, #92400E 100%)';
    subtitleLabel = 'RÚT 1 THẺ CƠ HỘI MAY MẮN';
  } else if (tile.kind === 'FATE') {
    headerBg = 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)';
    subtitleLabel = 'RÚT 1 THẺ KHÍ VẬN THỬ THÁCH';
  } else if (tile.kind === 'HERITAGE') {
    headerBg = 'linear-gradient(135deg, #B45309 0%, #7C2D12 100%)';
    subtitleLabel = 'DI SẢN QUỐC GIA · THƯỞNG +1 TR Đ';
  } else if (tile.kind === 'TAX') {
    headerBg = 'linear-gradient(135deg, #991B1B 0%, #450A0A 100%)';
    subtitleLabel = tile.fixedTaxAmount
      ? `THUẾ DU LỊCH · CỐ ĐỊNH -${formatShortVnd(tile.fixedTaxAmount).toLocaleUpperCase('vi-VN')}`
      : 'THUẾ BẤT ĐỘNG SẢN';
  } else if (tile.kind === 'GO') {
    headerBg = 'linear-gradient(135deg, #D97706 0%, #9A3412 100%)';
    subtitleLabel = 'Ô KHỞI HÀNH (START) · VƯỢT QUA +3 TR Đ';
  } else if (tile.kind === 'VISIT_JAIL') {
    headerBg = 'linear-gradient(135deg, #991B1B 0%, #450A0A 100%)';
    subtitleLabel = 'TRẠI GIAM · THĂM 500K KHI CÓ NGƯỜI Ở TÙ';
  } else if (tile.kind === 'FREE_PARKING') {
    headerBg = 'linear-gradient(135deg, #1E40AF 0%, #172554 100%)';
    subtitleLabel = 'BÃI ĐỖ XE · NGHỈ CHÂN AN TOÀN';
  } else if (tile.kind === 'GO_TO_JAIL') {
    headerBg = 'linear-gradient(135deg, #475569 0%, #1E293B 100%)';
    subtitleLabel = 'BỊ BẮT VÀO TRẠI GIAM';
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-decision-up relative w-full max-w-[820px] rounded-[24px] p-[2.5px] shadow-[0_28px_70px_rgba(0,0,0,0.85)]"
        style={{ background: 'linear-gradient(145deg, #FDE68A 0%, #B45309 45%, #FDE68A 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden rounded-[22px] bg-[#131926] text-white">
          {/* Header Sổ Đỏ / Giấy Chứng Nhận Cổ Điển — Có ảnh phong cảnh địa danh sắc nét cho 34 ô đất */}
          <div
            className="retro-tile-sheen relative overflow-hidden border-b-2 border-[#EAB308]/70 px-5 py-4 text-center"
            style={{ background: headerBg }}
          >
            {landmarkArtUrl && (
              <>
                <img
                  src={landmarkArtUrl}
                  alt={tile.name}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: 'linear-gradient(180deg, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.52) 55%, rgba(15,23,42,0.88) 100%)',
                  }}
                />
              </>
            )}
            <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-amber-200/45" />

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng thông tin ô"
              className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white hover:bg-black/55 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative z-10 flex items-center justify-center gap-2 text-[10px] font-black tracking-[0.16em] text-amber-200/95">
              {tile.kind === 'AIRPORT' && <AirportIcon className="h-4 w-4" />}
              {tile.kind === 'AUCTION_STATION' && <StationBusIcon className="h-4 w-4" />}
              {tile.kind === 'UTILITY' && <HydroPowerIcon className="h-4 w-4" />}
              {tile.kind === 'CHANCE' && <ChanceSymbolSvg className="h-4 w-4" />}
              {tile.kind === 'FATE' && <FateSymbolSvg className="h-4 w-4" />}
              {tile.kind === 'HERITAGE' && <HeritageCitadelIcon className="h-4 w-4" />}
              {tile.kind === 'TAX' && <TaxStampIcon className="h-4 w-4" />}
              {tile.kind === 'GO' && <CornerGoIcon className="h-4 w-4" />}
              {tile.kind === 'VISIT_JAIL' && <CornerJailIcon className="h-4 w-7" />}
              {tile.kind === 'FREE_PARKING' && <CornerParkingIcon className="h-4 w-4" />}
              {tile.kind === 'GO_TO_JAIL' && <CornerGoToJailIcon className="h-4 w-5" />}
              <span>{subtitleLabel}</span>
            </div>

            <h3 className="relative z-10 mt-1 text-xl font-black tracking-wide text-white drop-shadow sm:text-2xl">
              Thông tin ô {tile.name.toUpperCase()}
            </h3>

            <div className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
              {owner ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-slate-950/65 px-3 py-0.5 font-bold shadow">
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ backgroundColor: owner.landHex }} />
                  Chủ sở hữu: <strong className="text-amber-200">{owner.name}</strong>
                  {owner.inJail && <span className="text-rose-300">(Ở tù · Miễn thuê)</span>}
                </span>
              ) : (
                tile.kind === 'PROPERTY' && (
                  <span className="rounded-full border border-white/25 bg-slate-950/45 px-3 py-0.5 font-bold text-amber-100">
                    Đất tự do · Chưa có chủ
                  </span>
                )
              )}
              {hasMonopoly && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-400 px-2.5 py-0.5 font-black text-amber-950 shadow">
                  <Crown className="h-3 w-3" />
                  Đủ bộ {groupSize} ô · Thuê ×2
                </span>
              )}
            </div>
          </div>

          <div className="p-5">
            {/* Bố cục 2 cột sang trọng cho ô Đất Địa Danh (Trái: Chi phí mua/xây | Phải: Phí thu về chuẩn %) */}
            {tile.kind === 'PROPERTY' && tile.basePrice && (
              <div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Cột trái: Giá mua & Xây dựng */}
                  <div className="rounded-2xl border border-[#C89B54]/30 bg-slate-900/75 p-3.5">
                    <div className="mb-2.5 border-b border-white/10 pb-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
                      Chi phí Mua & Xây dựng
                    </div>
                    <div className="space-y-1.5">
                      {(
                        [
                          ['Giá để mua ô đất', tile.basePrice, 0],
                          ['Giá xây căn nhà 1 (50%)', buildUnit, 1],
                          ['Giá xây căn nhà 2 (50%)', buildUnit, 2],
                          ['Giá xây căn nhà 3 (50%)', buildUnit, 3],
                          ['Giá xây căn nhà 4 (50%)', buildUnit, 4],
                          ['Giá xây khách sạn (100%)', buildHotel, 5],
                        ] as const
                      ).map(([lbl, amt, lvl]) => (
                        <div
                          key={lbl}
                          className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 odd:bg-white/[0.03]"
                        >
                          <span className="flex items-center gap-2 whitespace-nowrap text-stone-200">
                            {lvl >= 1 && lvl <= 4 && <MiniHouseSvg className="h-3.5 w-3.5 shrink-0" />}
                            {lvl === 5 && <MiniVillaSvg className="h-4 w-5 shrink-0" />}
                            <span>{lbl}</span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-black text-amber-300">
                            {formatShortVnd(amt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cột phải: Biểu phí thu về */}
                  <div className="rounded-2xl border border-[#C89B54]/30 bg-slate-900/75 p-3.5">
                    <div className="mb-2.5 border-b border-white/10 pb-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-300">
                      Biểu phí Thu về {hasMonopoly ? '(Đang ×2 đủ bộ màu)' : '(Chuẩn % giá đất)'}
                    </div>
                    <div className="space-y-1.5">
                      {(
                        [
                          ['Đất trống (25%)', 0.25],
                          ['Có 1 nhà (50%)', 0.5],
                          ['Có 2 nhà (100%)', 1],
                          ['Có 3 nhà (150%)', 1.5],
                          ['Có 4 nhà (200%)', 2],
                          ['Khách sạn (300%)', 3],
                        ] as const
                      ).map(([lbl, mult], lvl) => {
                        const rentVal = Math.round(tile.basePrice! * mult * (hasMonopoly ? 2 : 1));
                        const isCurrent = Boolean(owner && tile.buildingLevel === lvl);
                        return (
                          <div
                            key={lbl}
                            className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 ${isCurrent
                                ? 'bg-emerald-500/25 font-black ring-1 ring-emerald-400/70'
                                : 'odd:bg-white/[0.03]'
                              }`}
                          >
                            <span className={`whitespace-nowrap ${isCurrent ? 'text-emerald-200' : 'text-stone-200'}`}>
                              {isCurrent ? '▶ ' : ''}
                              {lbl}
                              {hasMonopoly ? ' ×2' : ''}
                            </span>
                            <span
                              className={`shrink-0 whitespace-nowrap ${
                                isCurrent ? 'text-emerald-300' : 'font-black text-amber-300'
                              }`}
                            >
                              {formatShortVnd(rentVal)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {owner && (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-950/45 py-2 text-xs font-bold text-cyan-200">
                    <span>💰 Tiền thuê đang áp dụng:</span>
                    <strong className="text-sm text-amber-300">
                      {formatVnd(calculatePropertyRent(state.tiles, state.players, tile))}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {tile.kind === 'AUCTION_STATION' && tile.auctionState && (
              <div className="space-y-2.5 rounded-2xl border border-[#C89B54]/30 bg-slate-900/75 p-4 text-sm text-stone-200">
                <div className="flex justify-between">
                  <span>Giá khởi điểm / Hiện tại:</span>
                  <span className="font-black text-amber-300">
                    {tile.auctionState.status === 'CLOSED'
                      ? `Đã chốt ${formatShortVnd(tile.auctionState.finalPrice)}`
                      : tile.auctionState.status === 'ACTIVE'
                        ? `Đang đấu giá ${formatShortVnd(tile.auctionState.currentBid)}`
                        : 'Mở đấu giá 2 Tr đ (Bước +200 Nghìn)'}
                  </span>
                </div>
                {tile.auctionState.status === 'CLOSED' && (
                  <div className="flex justify-between font-bold text-cyan-300">
                    <span>Phí thu vé (50% giá chốt):</span>
                    <span>{formatVnd(calculateStationRent(state.players, tile))}</span>
                  </div>
                )}
                {Object.keys(tile.auctionState.deposits).length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-black/35 p-3 text-xs">
                    <div className="mb-1 font-bold text-amber-200">Tiền cọc đang giữ:</div>
                    {Object.entries(tile.auctionState.deposits).map(([pid, dep]) => {
                      const p = state.players.find((x) => x.id === pid);
                      return (
                        <div key={pid} className="flex justify-between text-stone-300">
                          <span>{p?.name ?? pid}</span>
                          <span className="font-bold text-amber-200">{formatShortVnd(dep)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tile.kind === 'AIRPORT' && (
              <div className="rounded-2xl border border-cyan-400/35 bg-cyan-950/50 p-4 text-center text-sm text-cyan-100">
                Điểm bay hiện tại:{' '}
                <strong className="text-base text-amber-300">
                  {tile.currentDestinationTileIndex !== undefined
                    ? state.tiles[tile.currentDestinationTileIndex]?.name
                    : 'Ngẫu nhiên'}
                </strong>
                <div className="mt-1 text-xs text-cyan-200/80">
                  Đáp xuống ô này sẽ bay thẳng tới điểm đến trên, <strong className="text-emerald-300">luôn được nhận +3 Tr đ</strong> (tính như vượt qua Khởi Hành) và đổi tuyến ngẫu nhiên sau chuyến bay!
                </div>
              </div>
            )}

            {tile.kind === 'UTILITY' && (() => {
              const allUtilities = state.tiles.filter((t) => t.kind === 'UTILITY');
              const ownerPlantCount = owner
                ? allUtilities.filter((u) => u.ownerId === owner.id).length
                : 0;
              return (
                <div className="space-y-3 text-sm text-stone-200">
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#C89B54]/30 bg-slate-900/75 p-4">
                    <div className="space-y-1.5">
                      <div className="border-b border-white/10 pb-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
                        Quy tắc thu tiền điện (theo điểm Xúc xắc)
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <span className="whitespace-nowrap">Giá mua nhà máy:</span>
                        <strong className="whitespace-nowrap text-amber-300">2 Tr đ</strong>
                      </div>
                      <div
                        className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 ${
                          ownerPlantCount === 1 ? 'bg-amber-500/20 ring-1 ring-amber-400/70' : 'bg-white/[0.03]'
                        }`}
                      >
                        <span className="whitespace-nowrap">Chủ có 1 nhà máy:</span>
                        <strong className="whitespace-nowrap text-amber-300">Điểm XX × 100 Nghìn</strong>
                      </div>
                      <div
                        className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 ${
                          ownerPlantCount >= 2 ? 'bg-emerald-500/25 ring-1 ring-emerald-400/80' : 'bg-emerald-500/10'
                        }`}
                      >
                        <span className="whitespace-nowrap">Chủ có đủ 2 nhà máy:</span>
                        <strong className="whitespace-nowrap text-emerald-300">Điểm XX × 250 Nghìn</strong>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="border-b border-white/10 pb-1 text-[11px] font-black uppercase tracking-wider text-cyan-300">
                        2 Nhà Máy Thủy Điện trên bàn cờ (Độc lập)
                      </div>
                      {allUtilities.map((u) => {
                        const uOwner = u.ownerId ? state.players.find((p) => p.id === u.ownerId) : null;
                        const edgeLabel = u.edge === 0 ? 'Cạnh dưới' : u.edge === 2 ? 'Cạnh trên' : `Ô ${u.index}`;
                        const isSelf = u.index === tile.index;
                        return (
                          <div
                            key={u.index}
                            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${
                              isSelf ? 'bg-cyan-500/20 ring-1 ring-cyan-400/60' : 'bg-white/[0.03]'
                            }`}
                          >
                            <span className="whitespace-nowrap font-bold text-white">
                              ⚡ {u.name} <span className="text-xs font-normal text-sky-200/80">({edgeLabel})</span>
                            </span>
                            {uOwner ? (
                              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-950/75 px-2 py-0.5 text-xs font-bold text-amber-200">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: uOwner.landHex }} />
                                {uOwner.name}
                              </span>
                            ) : (
                              <span className="shrink-0 whitespace-nowrap text-xs text-stone-400">Chưa có chủ</span>
                            )}
                          </div>
                        );
                      })}
                      <div className="rounded-lg bg-black/30 px-2.5 py-1.5 text-xs leading-snug text-sky-100/90">
                        💡 <strong>Ví dụ:</strong> Đối thủ tung xúc xắc ra <strong>8 điểm</strong> vào ô này sẽ trả{' '}
                        <strong className="text-amber-300">800 Nghìn đ</strong> (1 nhà máy) hoặc{' '}
                        <strong className="text-emerald-300">2 Tr đ</strong> (đủ 2 nhà máy). Không xây nhà, không thuộc nhóm màu đất.
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {(tile.kind === 'CHANCE' ||
              tile.kind === 'FATE' ||
              tile.kind === 'HERITAGE' ||
              tile.kind === 'TAX' ||
              tile.kind === 'GO' ||
              tile.kind === 'VISIT_JAIL' ||
              tile.kind === 'FREE_PARKING' ||
              tile.kind === 'GO_TO_JAIL') && (
                <div className="rounded-2xl border border-[#C89B54]/30 bg-slate-900/75 p-4 text-center text-sm leading-relaxed text-stone-200">
                  {tile.kind === 'CHANCE' && 'Rút ngay 1 lá từ bộ 16 thẻ Cơ Hội (tiền thưởng, vé máy bay, thẻ miễn tù hoặc sự kiện bất ngờ).'}
                  {tile.kind === 'FATE' && 'Rút ngay 1 lá từ bộ 16 thẻ Khí Vận (thuế sửa nhà, mừng cưới, sự cố bất ngờ hoặc lệnh ân xá).'}
                  {tile.kind === 'HERITAGE' && `Dừng chân tại ${tile.name} được Ngân hàng tài trợ ngay +1.000.000 đ!`}
                  {tile.kind === 'TAX' &&
                    (tile.fixedTaxAmount
                      ? `Đóng ${tile.name} cố định ${formatVnd(tile.fixedTaxAmount)} vào Ngân hàng Trung Tâm.`
                      : 'Đóng Thuế BĐS: 200 Nghìn mỗi nhà cấp 1–4, 1 Tr mỗi Biệt thự (chưa có nhà đóng tối thiểu 50 Nghìn).')}
                  {tile.kind === 'GO' && 'Đi tiến VƯỢT QUA ô START (Khởi Hành) được Ngân hàng thưởng ngay +3.000.000 đ! Nếu quay xúc xắc xui dừng đúng ô này sẽ không được nhận thưởng vòng đó.'}
                  {tile.kind === 'VISIT_JAIL' &&
                    (state.players.some((p) => !p.isBankrupt && p.inJail)
                      ? 'Hiện đang có người ở tù bên trong — người đi vào ô này phải nộp phí thăm nuôi 500 Nghìn. Người ở tù có tối đa 3 lượt tung ra hoặc bảo lãnh 1 Tr.'
                      : 'Trại Giam hiện đang trống — đi vào ô này hoàn toàn MIỄN PHÍ! Chỉ mất 500 Nghìn phí thăm nuôi khi có người đang ở tù bên trong.')}
                  {tile.kind === 'FREE_PARKING' && 'Khu vực nghỉ chân hoàn toàn an toàn, không mất phí hay bị phạt.'}
                  {tile.kind === 'GO_TO_JAIL' && 'Di chuyển thẳng tới Trại Giam ngay lập tức và bị phong tỏa thu tiền thuê trong thời gian ở tù.'}
                </div>
              )}

            {/* Nút ĐÓNG vàng nổi bật ở chính giữa dưới cùng */}
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="uiverse-push-btn uiverse-dome-shine rounded-full px-14 py-2.5 text-base font-black text-amber-950 cursor-pointer shadow-lg"
                style={{
                  background: 'linear-gradient(180deg, #FEF08A 0%, #F59E0B 100%)',
                  boxShadow: '0 4px 0 #92400E',
                }}
              >
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const RULES_TABS = [
  { id: 'basics', label: '1. Cơ Bản & Xúc Xắc' },
  { id: 'properties', label: '2. Đất & 12 Nhóm Màu' },
  { id: 'buildings', label: '3. Xây Nhà & Tiền Thuê' },
  { id: 'specials', label: '4. Bến Xe & Thủy Điện' },
  { id: 'events', label: '5. Cơ Hội, Tù & Thuế' },
  { id: 'victory', label: '6. Cách Thắng & Online' },
] as const;

type RulesTabId = (typeof RULES_TABS)[number]['id'];

const COLOR_GROUP_RULE_ROWS: readonly { id: number; cities: string; range: string }[] = [
  { id: 1, cities: 'Mộc Châu · Hà Giang · Sa Pa', range: '1 – 1,4 Tr' },
  { id: 2, cities: 'Lý Sơn · Vĩnh Hy · Phú Yên', range: '1,4 – 1,8 Tr' },
  { id: 11, cities: 'Thanh Hóa · Nghệ An (Nhóm 2 ô)', range: '1,6 – 1,8 Tr' },
  { id: 3, cities: 'Bắc Ninh · Ba Vì · Hà Nội', range: '1,8 – 2,2 Tr' },
  { id: 4, cities: 'Kon Tum · Buôn Ma Thuột · Đà Lạt', range: '2 – 2,6 Tr' },
  { id: 12, cities: 'Cao Bằng · Lạng Sơn (Nhóm 2 ô)', range: '2,2 – 2,6 Tr' },
  { id: 5, cities: 'Quảng Bình · Cố Đô Huế · Hội An', range: '2,6 – 3,4 Tr' },
  { id: 6, cities: 'Phan Thiết · Vũng Tàu · Côn Đảo', range: '3 – 3,8 Tr' },
  { id: 7, cities: 'Quy Nhơn · Nha Trang · Đà Nẵng', range: '3,8 – 4,4 Tr' },
  { id: 8, cities: 'Mỹ Tho · Cần Thơ · Phú Quốc', range: '3,8 – 4,4 Tr' },
  { id: 9, cities: 'Cát Bà · Ninh Bình · Vịnh Hạ Long', range: '5 – 5,4 Tr' },
  { id: 10, cities: 'Đồng Nai · Bình Dương · Sài Gòn', range: '5,6 – 6 Tr' },
];

function RuleBullet({ dotClass = 'bg-amber-300', children }: { dotClass?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<RulesTabId>('basics');

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-decision-up relative flex max-h-[92%] w-full max-w-[880px] flex-col rounded-[28px] p-[2.5px] shadow-[0_28px_70px_rgba(0,0,0,0.85)]"
        style={{ background: 'linear-gradient(145deg, #FDE68A 0%, #B45309 50%, #FDE68A 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex max-h-full flex-col overflow-hidden rounded-[25.5px] bg-[#0F172A] text-white">
          {/* Đầu Sổ Tay Bộ Luật */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EAB308]/25 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-400/15 text-amber-300 shadow-inner">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300/90">
                  Sổ tay hướng dẫn chính thức · 52 ô chữ nhật 17×11
                </div>
                <h2 className="text-xl font-black tracking-[0.04em] text-white">
                  BỘ LUẬT CỜ TỶ PHÚ VIỆT NAM 3D
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="hidden rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-xs font-bold tracking-wide text-emerald-200 sm:inline-block">
                Vốn khởi đầu: 25 Tr đ
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng bảng luật"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 6 Tab chia lưới 2 hàng × 3 cột bằng nhau 100% */}
          <div className="grid shrink-0 grid-cols-3 gap-2.5 border-b border-white/10 bg-slate-950/60 px-6 py-3.5">
            {RULES_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl border px-3 py-2 text-center text-xs font-black tracking-[0.03em] transition cursor-pointer ${
                    active
                      ? 'border-amber-300 bg-amber-400 text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.35)]'
                      : 'border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Nội dung chi tiết căn đều 2 cột thẳng hàng */}
          <div className="flex-1 overflow-y-auto px-6 py-5 text-[13.5px] leading-[1.68] tracking-[0.02em] text-slate-200">
            {activeTab === 'basics' && (
              <div className="grid items-stretch gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="border-b border-white/10 pb-2 text-xs font-black uppercase tracking-[0.12em] text-amber-300">
                    🎲 Khởi Đầu &amp; Quy Tắc Qua Ô START
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet>
                      Mỗi tụ xuất phát tại ô <strong>START (Khởi Hành)</strong> với vốn{' '}
                      <strong className="text-emerald-300">25.000.000 đ</strong> (2–6 tụ, tối đa 4 Máy).
                    </RuleBullet>
                    <RuleBullet>
                      <strong>Chạm sân giữa</strong> (hoặc bấm{' '}
                      <kbd className="rounded bg-white/15 px-1.5 py-0.5 text-xs text-amber-200">Phím Cách</kbd>) để tung nhanh;{' '}
                      <strong>nhấn giữ rồi thả</strong> để nạp lực lắc xúc xắc 3D.
                    </RuleBullet>
                    <RuleBullet>
                      Chỉ nhận <strong className="text-emerald-300">+3.000.000 đ</strong> khi đi tiến{' '}
                      <strong>VƯỢT QUA ô START</strong> hoặc khi <strong>bay Sân Bay</strong>. Nếu quay xúc xắc xui{' '}
                      <strong className="text-rose-300">dừng trúng ô START</strong> sẽ không được nhận tiền vòng đó (bị kéo đi lùi cũng không nhận).
                    </RuleBullet>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="border-b border-white/10 pb-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-300">
                    ⚡ Chế Độ 1 / 2 Xúc Xắc &amp; Luật Đổ Đôi
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet dotClass="bg-cyan-300">
                      <strong>2 Xúc xắc (Chuẩn):</strong> Tung ra 2 mặt bằng nhau (<strong>Đổ Đôi</strong>) được{' '}
                      <strong className="text-amber-300">đi thêm 1 lượt</strong>. Đổ đôi{' '}
                      <strong className="text-rose-300">3 lần liên tiếp</strong> sẽ bị bắt thẳng vào Trại Giam!
                    </RuleBullet>
                    <RuleBullet dotClass="bg-cyan-300">
                      <strong>1 Xúc xắc (Nhanh):</strong> Tung 1 viên (1–6 điểm), nhịp chơi gọn nhanh, không áp dụng luật đổ đôi.
                    </RuleBullet>
                    <RuleBullet dotClass="bg-cyan-300">
                      Chạm vào <strong>bất kỳ ô nào</strong> trên 4 cạnh bàn cờ để mở Sổ Đỏ xem đầy đủ giá mua, giá xây nhà &amp; tiền thuê.
                    </RuleBullet>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'properties' && (
              <div className="space-y-3.5">
                <p>
                  Bàn cờ đối xứng gồm <strong>34 Ô Đất Địa Danh Việt Nam</strong> (<em>10 Dưới · 7 Trái · 10 Trên · 7 Phải</em>) chia thành{' '}
                  <strong className="text-amber-300">12 Nhóm Màu</strong> (10 nhóm 3 ô + 2 nhóm 2 ô), tối đa 6 ô đất đắt giá 5–6 Tr rải xen kẽ trên 3 cạnh sau. Gom đủ cả nhóm màu sẽ kích hoạt{' '}
                  <strong className="text-emerald-300">ĐỘC QUYỀN ×2 TIỀN THUÊ</strong>!
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {COLOR_GROUP_RULE_ROWS.map((row) => {
                    const info = COLOR_GROUPS[row.id];
                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/75 px-2.5 py-2.5"
                      >
                        <span
                          className="h-8 w-2.5 shrink-0 rounded-md shadow-sm"
                          style={{ backgroundColor: info?.hex ?? '#64748B' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 text-[11.5px] font-black text-white">
                            <span className="truncate">{info?.name}</span>
                            <span className="shrink-0 text-[10.5px] text-amber-300">{row.range}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[10.5px] text-slate-300">{row.cities}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'buildings' && (
              <div className="grid items-stretch gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="border-b border-white/10 pb-2 text-xs font-black uppercase tracking-[0.12em] text-amber-300">
                    🏠 Quy Tắc Xây Nhà, Biệt Thự &amp; Thanh Lý Nợ
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet>
                      Quay lại dừng đúng ô đất của mình được chọn nâng tối đa <strong>1 cấp mỗi lượt</strong>.
                    </RuleBullet>
                    <RuleBullet>
                      <strong>Nhà cấp 1 → 4:</strong> mỗi cấp tốn đúng <strong className="text-amber-300">50% giá đất</strong>.
                    </RuleBullet>
                    <RuleBullet>
                      <strong>Khách Sạn / Biệt Thự (Cấp 5 ★):</strong> tốn <strong className="text-amber-300">100% giá đất</strong> (ô phát viền sáng trắng).
                    </RuleBullet>
                    <RuleBullet>
                      <strong>Thanh lý khi thiếu tiền trả nợ:</strong> Ngân hàng mua lại đúng <strong>50% giá trị</strong> (phải bán hết nhà trước rồi mới bán đất).
                    </RuleBullet>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="border-b border-white/10 pb-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                    💰 Biểu Phí Thuê Đất Chuẩn (% Giá Đất)
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {(
                      [
                        ['Đất trống (0 nhà)', '25%', '50% (×2 bộ màu)'],
                        ['Có 1 nhà', '50%', '100% (×2 bộ màu)'],
                        ['Có 2 nhà', '100%', '200% (×2 bộ màu)'],
                        ['Có 3 nhà', '150%', '300% (×2 bộ màu)'],
                        ['Có 4 nhà', '200%', '400% (×2 bộ màu)'],
                        ['Khách sạn / Biệt thự', '300%', '600% (×2 bộ màu)'],
                      ] as const
                    ).map(([label, base, mono]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2"
                      >
                        <span className="font-bold text-white">{label}</span>
                        <span className="whitespace-nowrap font-black text-amber-300">
                          {base} <span className="font-semibold text-emerald-300">· {mono}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'specials' && (
              <div className="grid items-stretch gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-950/20 p-4">
                  <div className="border-b border-amber-400/20 pb-2 text-xs font-black uppercase tracking-[0.12em] text-amber-300">
                    🚌 4 Bến Xe Đấu Giá (Độc Lập)
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet>
                      Mỗi cạnh có 1 bến xe: <strong>BX Miền Tây</strong> (Dưới), <strong>BX Phương Trang</strong> (Trái),{' '}
                      <strong>BX Miền Đông</strong> (Trên), <strong>BX Giáp Bát</strong> (Phải).
                    </RuleBullet>
                    <RuleBullet>
                      Mở đấu giá <strong className="text-amber-300">2 Tr đ</strong>, bước giá <strong className="text-amber-300">+200 Nghìn</strong> (ai đã cọc chỉ bù phần chênh lệch).
                    </RuleBullet>
                    <RuleBullet>
                      Bỏ quyền hoàn <strong>100% tiền cọc</strong>. Khi chỉ còn 1 người giữ giá sẽ chốt sổ và thu vé bằng{' '}
                      <strong className="text-emerald-300">50% giá chốt</strong>.
                    </RuleBullet>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-950/20 p-4">
                  <div className="border-b border-cyan-400/20 pb-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-300">
                    ⚡ 2 Nhà Máy Thủy Điện (Độc Lập)
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet dotClass="bg-cyan-300">
                      Gồm <strong>Thủy Điện Trị An</strong> (Cạnh Dưới) và <strong>Thủy Điện Hòa Bình</strong> (Cạnh Trên), giá mua{' '}
                      <strong className="text-amber-300">2 Tr đ</strong>.
                    </RuleBullet>
                    <RuleBullet dotClass="bg-cyan-300">
                      Sở hữu <strong>1 nhà máy</strong>: Thu <strong className="text-amber-300">Điểm Xúc xắc × 100 Nghìn</strong>.
                    </RuleBullet>
                    <RuleBullet dotClass="bg-cyan-300">
                      Sở hữu đủ <strong>2 nhà máy</strong>: Thu <strong className="text-emerald-300">Điểm Xúc xắc × 250 Nghìn</strong> (VD ra 8 điểm trả 2 Tr đ).
                    </RuleBullet>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="grid items-stretch gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="border-b border-white/10 pb-2 text-xs font-black uppercase tracking-[0.12em] text-purple-300">
                    🃏 3 Cơ Hội · 3 Khí Vận · ✈ Sân Bay (+3 Tr)
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet dotClass="bg-purple-300">
                      Bàn cờ bố trí <strong>3 ô Cơ Hội (?)</strong> &amp; <strong>3 ô Khí Vận (!)</strong> rải thoáng xa góc. Mỗi chồng có <strong>16 lá riêng biệt</strong> — khi bốc hết tự động <strong>xáo ngẫu nhiên lại đủ 16 lá</strong>!
                    </RuleBullet>
                    <RuleBullet dotClass="bg-purple-300">
                      <strong>✈ Sân Bay Quốc Tế (Góc trên trái):</strong> Đáp xuống sẽ bay thẳng tới địa danh niêm yết,{' '}
                      <strong className="text-emerald-300">LUÔN được cộng +3 Tr đ</strong> (tính như đã bay qua Khởi Hành) và tự đổi tuyến mới!
                    </RuleBullet>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="border-b border-white/10 pb-2 text-xs font-black uppercase tracking-[0.12em] text-rose-300">
                    ⛓ Trại Giam · Vô Tù · 2 Ô Thuế
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet dotClass="bg-rose-300">
                      <strong>Trại Giam:</strong> Đi vào ô này hoàn toàn <strong className="text-emerald-300">miễn phí</strong> khi Trại Giam đang trống; chỉ mất phí thăm nuôi <strong className="text-amber-300">500 Nghìn</strong> khi có người đang ở tù bên trong!
                    </RuleBullet>
                    <RuleBullet dotClass="bg-rose-300">
                      <strong>Vô Tù:</strong> Tạm khóa thu tiền thuê khi đang ở tù. Có <strong>3 lượt</strong> tung ra (Đổ Đôi / Mặt 6), dùng <strong>Thẻ Miễn Tù</strong> hoặc nộp <strong>1 Tr đ</strong> bảo lãnh.
                    </RuleBullet>
                    <RuleBullet dotClass="bg-rose-300">
                      <strong>Thuế BĐS (Cạnh Dưới):</strong> 200 Nghìn/nhà + 1 Tr/Biệt thự (chưa có nhà đóng 50 Nghìn).{' '}
                      <strong>Thuế Du Lịch (Cạnh Trên):</strong> cố định 500 Nghìn.
                    </RuleBullet>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'victory' && (
              <div className="grid items-stretch gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/20 p-4">
                  <div className="border-b border-emerald-400/20 pb-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                    🏆 3 Điều Kiện Chiến Thắng (2 Luật Thắng Ngay)
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet dotClass="bg-emerald-300">
                      <strong className="text-amber-300">Thắng 1 Hàng Ô Đất (Thắng ngay):</strong> Sở hữu trọn 100% <strong>Ô Đất Địa Danh</strong> trên cùng 1 cạnh (Cạnh Trái/Phải: <strong>7 ô đất</strong> · Cạnh Dưới/Trên: <strong>10 ô đất</strong> — không cần Bến Xe hay Thủy Điện).
                    </RuleBullet>
                    <RuleBullet dotClass="bg-emerald-300">
                      <strong className="text-amber-300">Độc Chiếm 4 Bến Xe (Thắng ngay):</strong> Thắng đấu giá đủ cả <strong>4 Bến Xe Lớn</strong>.
                    </RuleBullet>
                    <RuleBullet dotClass="bg-emerald-300">
                      <strong className="text-emerald-300">Sống Sót Cuối Cùng:</strong> Toàn bộ đối thủ phá sản hết.{' '}
                      <em className="text-amber-200/90">(Khi có người chỉ còn thiếu đúng 1 ô cuối, ô đó sẽ nhấp nháy đỏ–vàng cảnh báo!)</em>
                    </RuleBullet>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4">
                  <div className="border-b border-cyan-400/20 pb-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-300">
                    🌐 Chế Độ Phòng Online Mã 6 Số
                  </div>
                  <div className="space-y-2.5">
                    <RuleBullet dotClass="bg-cyan-300">
                      Chủ phòng tạo <strong>Mã 6 chữ số ngẫu nhiên</strong>, ghép thêm <strong>0–4 Máy</strong> (tổng tối đa 6 tụ) và bắt đầu khi có từ 2 tụ.
                    </RuleBullet>
                    <RuleBullet dotClass="bg-cyan-300">
                      <strong>Giữ ghế 2 phút khi rớt mạng:</strong> Nếu mất mạng hoặc bấm F5, ghế được giữ trong <strong>02:00</strong> để vào lại đúng vị trí cũ; quá 2 phút <strong>SmartAI Bot</strong> tự đánh thay.
                    </RuleBullet>
                    <RuleBullet dotClass="bg-cyan-300">
                      Hết ván Online sẽ tự động <strong>giải tán phòng</strong> về màn chọn chế độ.
                    </RuleBullet>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chân Sổ Tay */}
          <div className="flex shrink-0 items-center justify-center border-t border-white/10 bg-slate-950/65 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="uiverse-push-btn uiverse-dome-shine rounded-full px-14 py-2.5 text-sm font-black tracking-[0.06em] text-amber-950 shadow-lg cursor-pointer"
              style={{
                background: 'linear-gradient(180deg, #FEF08A 0%, #F59E0B 100%)',
                boxShadow: '0 4px 0 #92400E',
              }}
            >
              ĐÃ HIỂU · ĐÓNG BẢNG LUẬT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VictoryModal({
  state,
  isOnline = false,
  onRestart,
  onBackToLobby,
}: {
  state: GameState;
  isOnline?: boolean;
  onRestart: () => void;
  onBackToLobby: () => void;
}) {
  const winner = state.players.find((p) => p.id === state.winnerId) ?? state.players[0];
  const winnerChar = CO_TY_PHU_CHARACTERS.find((c) => c.id === winner.characterId) ?? CO_TY_PHU_CHARACTERS[0];

  const conditionLabel =
    state.winCondition === 'LINE_VICTORY'
      ? `THẮNG 1 HÀNG Ô ĐẤT (Trọn Đất Cạnh ${(state.winningEdge ?? 0) + 1})`
      : state.winCondition === 'FOUR_AUCTIONS'
        ? 'THẮNG TRỌN 4 Ô ĐẤU GIÁ (Độc chiếm 4 Bến Xe)'
        : 'NHÀ VÔ ĐỊCH SINH TỒN CUỐI CÙNG';

  const ranked = [...state.players]
    .map((p) => ({
      player: p,
      netWorth: computePlayerNetWorth(state.tiles, p),
    }))
    .sort((a, b) => {
      if (a.player.id === winner.id) return -1;
      if (b.player.id === winner.id) return 1;
      if (a.player.isBankrupt !== b.player.isBankrupt) return a.player.isBankrupt ? 1 : -1;
      return b.netWorth - a.netWorth;
    });

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-[30px] p-[3.5px] shadow-[0_24px_60px_rgba(0,0,0,0.75)]" style={{ background: 'linear-gradient(135deg, #FDE047 0%, #10B981 55%, #38BDF8 100%)' }}>
        <div className="rounded-[26.5px] bg-stone-900/95 p-6 text-center text-white">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-4 py-1 text-xs font-black text-amber-300">
            <Trophy className="h-4 w-4" />
            {conditionLabel}
          </div>

          <div className="mt-4 flex flex-col items-center">
            <div className="relative">
              <Crown className="mx-auto mb-1 h-8 w-8 text-amber-300 drop-shadow" />
              <img
                src={winnerChar.standeeUrl}
                alt={winner.name}
                className="h-32 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
              />
            </div>
            <h2 className="mt-1 text-3xl font-black text-emerald-300">{winner.name}</h2>
            <p className="text-xs text-stone-300">{winnerChar.name} · Vô địch sau {state.turnCount} lượt</p>
          </div>

          <div className="mt-4 space-y-2 rounded-2xl border border-white/15 bg-black/35 p-3 text-left">
            {ranked.map((item, rank) => (
              <div key={item.player.id} className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 font-black">
                    {rank + 1}
                  </span>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.player.landHex }} />
                  <span className="font-bold">{item.player.name}</span>
                  {item.player.isBankrupt && (
                    <span className="rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] text-red-200">Phá sản</span>
                  )}
                </div>
                <span className="font-black text-amber-200">
                  {formatShortVnd(item.netWorth)}
                </span>
              </div>
            ))}
          </div>

          {isOnline ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={onBackToLobby}
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base font-black text-white cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
                  boxShadow: '0 5px 0 #9A3412',
                }}
              >
                <Building2 className="h-5 w-5" />
                GIẢI TÁN PHÒNG · VỀ CHỌN CHẾ ĐỘ
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onRestart}
                className="uiverse-push-btn uiverse-dome-shine flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-black text-white cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 100%)',
                  boxShadow: '0 5px 0 #047857',
                }}
              >
                <RotateCcw className="h-4 w-4" />
                CHƠI LẠI VÁN MỚI
              </button>
              <button
                type="button"
                onClick={onBackToLobby}
                className="uiverse-push-btn uiverse-dome-shine flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-black text-white cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
                  boxShadow: '0 5px 0 #9A3412',
                }}
              >
                <Building2 className="h-4 w-4" />
                THIẾT LẬP PHÒNG
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
