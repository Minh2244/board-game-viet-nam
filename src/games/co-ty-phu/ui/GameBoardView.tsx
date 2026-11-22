import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Crown,
  Dices,
  Gavel,
  History,
  Home,
  Lock,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Skull,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAudioStore } from '@/shared/audio/soundEngine';
import { cryptoRandomInt } from '@/shared/crypto/random';
import { useLandscapeStage } from '@/shared/ui/LandscapeViewport';
import { computeBotAction } from '../ai/smartBot';
import { gameAudio } from '../audio/gameAudio';
import { COLOR_GROUPS } from '../data/boardData';
import { CO_TY_PHU_CHARACTERS } from '../data/characters';
import { getLandmarkArtworkUrl } from '../data/landmarkArtwork';
import { reduceGameAction } from '../engine/reducer';
import {
  AUCTION_BID_INCREMENT,
  evaluateEdgeProgress,
  formatShortVnd,
  formatVnd,
  getAuctionBidDelta,
  getSellBuildingValue,
  getSellPropertyValue,
  getTotalLiquidatableValue,
  getUpgradeCost,
  JAIL_BAIL_FEE,
  JAIL_TILE_INDEX,
  playerOwnsFullColorGroup,
} from '../engine/rules';
import type { BoardTile, CardDeckKind, GameAction, GameAnimEvent, GameState, PlayerState } from '../engine/types';
import { saveOfflineGame } from '../lobby/offlineSave';
import { MonopolySceneController } from '../scene/MonopolySceneController';
import {
  CashTransferOverlay,
  type ActiveCashTransfer,
  type CashParticleSeed,
} from './CashTransferOverlay';
import { CardRevealModal, RulesModal, TileInspectorModal, VictoryModal } from './Modals';
import { VietnamMapArt } from './VietnamMapArt';
import {
  AirportIcon,
  CentralBankBuildingSvg,
  ChanceSymbolSvg,
  CornerAirplaneIcon,
  CornerGoIcon,
  CornerGoToJailIcon,
  CornerJailIcon,
  FateSymbolSvg,
  GiantAirportJetSvg,
  HeritageCitadelIcon,
  HydroPowerIcon,
  JailSlamBarsSvg,
  MiniHouseSvg,
  MiniVillaSvg,
  StationBusIcon,
  TaxStampIcon,
} from './TileIcons';

interface GameBoardViewProps {
  initialState: GameState;
  onRestartSameSetup: () => void;
  onBackToLobby: () => void;
}

interface BoardCashPopup {
  id: number;
  x: number;
  y: number;
  positive: boolean;
  label: string;
}

interface ShockwaveEffect {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface TrailSpark {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface BotThoughtStatus {
  botId: string;
  text: string;
  tone: 'thinking' | 'accept' | 'reject';
}

interface ActivePawnAnim {
  playerId: string;
  x: number;
  y: number;
  liftY: number;
  scaleX: number;
  scaleY: number;
  tiltDeg: number;
}

interface AirportFlightState {
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  planeX: number;
  planeY: number;
  angleDeg: number;
  progress: number;
  playerName: string;
  destinationName: string;
  puffs: { x: number; y: number; opacity: number }[];
}

interface FlyingCardState {
  id: number;
  deck: CardDeckKind;
  x: number;
  y: number;
}

interface JailSlamState {
  id: number;
  x: number;
  y: number;
}

let fxUid = 1;

/** Rút gọn tên hiển thị trên ô bàn cờ cho sắc nét, giữ chuẩn 100% dấu tiếng Việt */
function shortTileTitle(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^Phố Cổ\s+/i, '')
    .replace(/^Cố Đô\s+/i, 'Cố Đô ')
    .replace(/^Chợ\s+/i, '')
    .replace(/^Bến Xe\s+/i, 'BX ')
    .replace(/^Sân Bay\s+/i, '')
    .replace(/^Thủy Điện\s+/i, 'TĐ ')
    .replace(/^Hoàng Thành\s+/i, '')
    .replace(/^Đường\s+/i, '')
    .trim()
    .toLocaleUpperCase('vi-VN');
}

/** Một ô trên vành đai bàn cờ hình chữ nhật chuẩn 17×11 (Retro Vivid cổ điển + hiệu ứng hiện đại) */
function BoardTileCell({
  tile,
  allTiles,
  players,
  isFlashing,
  isNewlyBuilt,
  onSelect,
  registerTileRef,
}: {
  tile: BoardTile;
  allTiles: readonly BoardTile[];
  players: readonly PlayerState[];
  isFlashing: boolean;
  isNewlyBuilt: boolean;
  onSelect: (index: number) => void;
  registerTileRef: (el: HTMLButtonElement | null) => void;
}) {
  const { col, row } = tile.gridPos;

  let owner: PlayerState | undefined;
  let activeAuctionLeader: PlayerState | undefined;
  if (tile.kind === 'AUCTION_STATION' && tile.auctionState?.status === 'CLOSED') {
    owner = players.find((p) => p.id === tile.auctionState?.finalOwnerId);
  } else if (tile.kind === 'AUCTION_STATION' && tile.auctionState?.status === 'ACTIVE' && tile.auctionState.leaderId) {
    activeAuctionLeader = players.find((p) => p.id === tile.auctionState?.leaderId);
  } else if (tile.ownerId) {
    owner = players.find((p) => p.id === tile.ownerId);
  }

  const hasMonopoly = Boolean(
    tile.kind === 'PROPERTY' &&
      owner &&
      tile.colorGroup !== undefined &&
      playerOwnsFullColorGroup(allTiles, owner.id, tile.colorGroup),
  );
  const hasWhiteVilla = Boolean(owner && tile.kind === 'PROPERTY' && tile.buildingLevel === 5);

  // Dải sở hữu ngang hết chiều rộng ô (hoặc dọc hết chiều cao ở 2 cạnh trái/phải) quay vào sân giữa — KHÔNG hiện tên/N.x
  const isSide = tile.edge === 1 || tile.edge === 3;
  const innerSlotPos =
    tile.edge === 0
      ? 'top-[2px] inset-x-[2px]'
      : tile.edge === 2
        ? 'bottom-[2px] inset-x-[2px]'
        : tile.edge === 1
          ? 'right-[2px] inset-y-[2px]'
          : 'left-[2px] inset-y-[2px]';

  const renderInnerSlot = () => {
    const slotStyle = owner
      ? {
          backgroundColor: owner.landHex,
          borderColor: hasWhiteVilla ? '#FFFFFF' : hasMonopoly ? '#FDE047' : 'rgba(255,255,255,0.7)',
        }
      : activeAuctionLeader
        ? {
            backgroundImage: `repeating-linear-gradient(135deg, ${activeAuctionLeader.landHex} 0px, ${activeAuctionLeader.landHex} 6px, rgba(15, 23, 42, 0.88) 6px, rgba(15, 23, 42, 0.88) 11px)`,
            borderColor: '#FDE047',
          }
        : {
            backgroundColor: 'rgba(15, 23, 42, 0.86)',
            borderColor: 'rgba(255,255,255,0.16)',
          };

    return (
      <div
        style={slotStyle}
        className={`pointer-events-none absolute ${innerSlotPos} z-10 flex items-center justify-center gap-[1px] rounded-[4px] border shadow-sm ${
          isSide ? 'w-[11px] flex-col sm:w-[16px]' : 'h-[11px] sm:h-[16px]'
        }`}
      >
        {owner && tile.kind === 'PROPERTY' && tile.buildingLevel > 0 && (
          <span
            className={`flex items-center justify-center gap-[1px] ${isSide ? 'flex-col' : 'flex-row'} ${
              isNewlyBuilt ? 'animate-house-pop' : ''
            }`}
          >
            {tile.buildingLevel === 5 ? (
              <MiniVillaSvg className="h-3.5 w-4.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:h-4 sm:w-5" />
            ) : (
              Array.from({ length: tile.buildingLevel }).map((_, i) => (
                <MiniHouseSvg key={i} className="h-2.5 w-2.5 drop-shadow sm:h-3 sm:w-3" />
              ))
            )}
          </span>
        )}
        {!owner && activeAuctionLeader && (
          <Gavel className="h-2.5 w-2.5 text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]" />
        )}
      </div>
    );
  };

  // 4 Ô Góc lớn (0: Khởi Hành, 16: Trại Giam, 26: Sân Bay Quốc Tế, 42: Vô Tù)
  if (tile.edge === null) {
    let cornerBg = 'linear-gradient(145deg, #D97706 0%, #9A3412 100%)';
    let title = 'KHỞI HÀNH';
    let sub = '+3 Tr đ';
    if (tile.kind === 'VISIT_JAIL') {
      cornerBg = 'linear-gradient(145deg, #991B1B 0%, #450A0A 100%)';
      title = 'TRẠI GIAM';
      sub = 'Thăm 500 Nghìn';
    } else if (tile.kind === 'AIRPORT') {
      cornerBg = 'linear-gradient(155deg, #38BDF8 0%, #0284C7 55%, #075985 100%)';
      const destName =
        tile.currentDestinationTileIndex !== undefined
          ? shortTileTitle(allTiles[tile.currentDestinationTileIndex]?.name ?? '')
          : '';
      title = destName || 'SÂN BAY';
      sub = destName ? '✈ SÂN BAY' : 'BAY NGẪU NHIÊN';
    } else if (tile.kind === 'GO_TO_JAIL') {
      cornerBg = 'linear-gradient(145deg, #475569 0%, #1E293B 100%)';
      title = 'VÔ TÙ';
      sub = 'Tới Trại Giam';
    }

    return (
      <button
        ref={registerTileRef}
        type="button"
        data-tile-index={tile.index}
        onClick={() => onSelect(tile.index)}
        style={{
          gridColumn: col + 1,
          gridRow: row + 1,
          background: cornerBg,
        }}
        className={`retro-tile-sheen relative flex flex-col items-center justify-between overflow-hidden rounded-[6px] border-2 p-1 text-center text-white shadow-md transition hover:brightness-110 cursor-pointer ${
          isFlashing ? 'ring-4 ring-yellow-300 brightness-125 z-20' : 'border-[#EAB308]/75'
        }`}
      >
        {tile.kind === 'VISIT_JAIL' ? (
          <>
            <CornerJailIcon className="h-[58%] w-full drop-shadow" />
            <div className="relative z-10 text-[9px] leading-none font-black tracking-tight text-amber-100 sm:text-[10.5px]">
              {title}
            </div>
            <div className="relative z-10 text-[7.5px] leading-none font-bold text-red-200/90 sm:text-[8.5px]">
              {sub}
            </div>
          </>
        ) : tile.kind === 'AIRPORT' ? (
          <>
            <div className="relative z-10 flex w-full items-center justify-center">
              <CornerAirplaneIcon className="h-[34px] w-full drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)] sm:h-[44px]" />
            </div>
            <div className="relative z-10 flex w-full flex-col items-center gap-[1px]">
              <div className="max-w-full truncate pt-[2px] text-[8.5px] leading-[1.2] font-black tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[10px]">
                {title}
              </div>
              <div className="text-[7px] leading-none font-bold text-amber-200 drop-shadow sm:text-[8px]">
                {sub}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative z-10 flex items-center justify-center pt-0.5">
              {tile.kind === 'GO' && <CornerGoIcon className="h-5 w-5 sm:h-7 sm:w-7" />}
              {tile.kind === 'GO_TO_JAIL' && <CornerGoToJailIcon className="h-5 w-6 sm:h-6 sm:w-8" />}
            </div>
            <div className="relative z-10 text-[8.5px] leading-tight font-black tracking-tight text-amber-50 drop-shadow sm:text-[10.5px]">
              {title}
            </div>
            <div className="relative z-10 text-[7.5px] leading-none font-bold text-amber-200/95 sm:text-[8.5px]">
              {sub}
            </div>
          </>
        )}
      </button>
    );
  }

  // Ô Cơ Hội (?) — Hoa văn cổ điển ánh mặt trời vàng đồng lộng lẫy
  if (tile.kind === 'CHANCE') {
    return (
      <button
        ref={registerTileRef}
        type="button"
        data-tile-index={tile.index}
        onClick={() => onSelect(tile.index)}
        style={{
          gridColumn: col + 1,
          gridRow: row + 1,
          background: 'radial-gradient(circle at 50% 35%, #F59E0B 0%, #B45309 62%, #6C2E0A 100%)',
        }}
        className={`retro-tile-sheen relative flex flex-col items-center justify-center overflow-hidden rounded-[6px] border-2 p-0.5 text-center text-white shadow-md transition hover:brightness-115 cursor-pointer ${
          isFlashing ? 'ring-4 ring-yellow-200 brightness-125 z-20' : 'border-[#FDE68A]/80'
        }`}
      >
        <div className="pointer-events-none absolute inset-[2px] rounded-[4px] border border-amber-100/45" />
        <ChanceSymbolSvg className="relative z-10 h-6 w-6 sm:h-8 sm:w-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]" />
        <span className="relative z-10 mt-0.5 rounded bg-amber-950/70 px-1.5 py-[1px] text-[6.5px] leading-none font-black uppercase tracking-wider text-amber-100 sm:text-[8px]">
          CƠ HỘI
        </span>
      </button>
    );
  }

  // Ô Khí Vận (!) — Hoa văn cổ điển huyền bí ánh tím pha lê & trăng sao
  if (tile.kind === 'FATE') {
    return (
      <button
        ref={registerTileRef}
        type="button"
        data-tile-index={tile.index}
        onClick={() => onSelect(tile.index)}
        style={{
          gridColumn: col + 1,
          gridRow: row + 1,
          background: 'radial-gradient(circle at 50% 35%, #8B5CF6 0%, #5B21B6 62%, #2E1065 100%)',
        }}
        className={`retro-tile-sheen relative flex flex-col items-center justify-center overflow-hidden rounded-[6px] border-2 p-0.5 text-center text-white shadow-md transition hover:brightness-115 cursor-pointer ${
          isFlashing ? 'ring-4 ring-purple-200 brightness-125 z-20' : 'border-purple-200/70'
        }`}
      >
        <div className="pointer-events-none absolute inset-[2px] rounded-[4px] border border-purple-200/40" />
        <FateSymbolSvg className="relative z-10 h-6 w-6 sm:h-8 sm:w-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]" />
        <span className="relative z-10 mt-0.5 rounded bg-purple-950/75 px-1.5 py-[1px] text-[6.5px] leading-none font-black uppercase tracking-wider text-purple-100 sm:text-[8px]">
          KHÍ VẬN
        </span>
      </button>
    );
  }

  // Xác định màu nền Retro Vivid cổ điển, ảnh chụp thắng cảnh riêng (đủ 38 ô địa điểm) & nội dung 100% tiếng Việt
  let bgStyle = '#1E293B';
  let groupHexColor = '#475569';
  let topTitle = shortTileTitle(tile.name);
  let priceText = '';
  let specialIcon: 'AIRPORT' | 'STATION' | 'UTIL' | 'HERITAGE' | 'TAX' | null = null;
  const landmarkUrl = getLandmarkArtworkUrl(tile.name);

  if (tile.kind === 'PROPERTY') {
    groupHexColor = tile.colorGroup ? COLOR_GROUPS[tile.colorGroup]?.hex ?? '#475569' : '#475569';
    bgStyle = groupHexColor;
    priceText = tile.basePrice ? formatShortVnd(tile.basePrice).replace(' đ', '') : '';
  } else if (tile.kind === 'AUCTION_STATION') {
    groupHexColor = '#64748B';
    bgStyle = 'linear-gradient(155deg, #334155 0%, #1E293B 100%)';
    topTitle = 'BẾN XE';
    const auc = tile.auctionState;
    priceText =
      auc?.status === 'CLOSED'
        ? formatShortVnd(auc.finalPrice).replace(' đ', '')
        : auc?.status === 'ACTIVE'
          ? `↑ ${formatShortVnd(auc.currentBid + AUCTION_BID_INCREMENT).replace(' đ', '')}`
          : '2 Tr';
    specialIcon = 'STATION';
  } else if (tile.kind === 'AIRPORT') {
    groupHexColor = '#0284C7';
    bgStyle = 'linear-gradient(155deg, #0369A1 0%, #0C4A6E 100%)';
    const destName =
      tile.currentDestinationTileIndex !== undefined
        ? shortTileTitle(allTiles[tile.currentDestinationTileIndex]?.name ?? '')
        : '';
    topTitle = shortTileTitle(tile.name);
    priceText = destName ? `→${destName}` : 'BAY';
    specialIcon = 'AIRPORT';
  } else if (tile.kind === 'UTILITY') {
    groupHexColor = '#0D9488';
    bgStyle = 'linear-gradient(155deg, #0F766E 0%, #134E4A 100%)';
    topTitle = 'THỦY ĐIỆN';
    priceText = '2 Tr';
    specialIcon = 'UTIL';
  } else if (tile.kind === 'HERITAGE') {
    groupHexColor = '#D97706';
    bgStyle = 'linear-gradient(155deg, #B45309 0%, #7C2D12 100%)';
    topTitle = 'DI SẢN';
    priceText = '+1 Tr';
    specialIcon = 'HERITAGE';
  } else if (tile.kind === 'TAX') {
    groupHexColor = '#B91C1C';
    bgStyle = 'linear-gradient(155deg, #991B1B 0%, #581C20 100%)';
    topTitle = 'THUẾ';
    priceText = tile.fixedTaxAmount
      ? `-${formatShortVnd(tile.fixedTaxAmount).replace(' đ', '')}`
      : '-200 Nghìn';
    specialIcon = 'TAX';
  }

  const contentPadding =
    tile.edge === 0
      ? 'pt-[18px] pb-[6px] px-0.5'
      : tile.edge === 2
        ? 'pb-[18px] pt-[6px] px-0.5'
        : tile.edge === 1
          ? 'pr-[44px] pl-[9px] py-0.5'
          : 'pl-[44px] pr-[9px] py-0.5';

  // Dải mỏng màu nhóm đất ở cạnh ngoài CHỈ dùng cho Ô Đất Địa Danh (PROPERTY) — KHÔNG gắn lên Thủy Điện / Bến Xe / Thuế
  const outerGroupStripClass =
    tile.edge === 0
      ? 'bottom-0 inset-x-0 h-[4px]'
      : tile.edge === 2
        ? 'top-0 inset-x-0 h-[4px]'
        : tile.edge === 1
          ? 'left-0 inset-y-0 w-[4px]'
          : 'right-0 inset-y-0 w-[4px]';

  return (
    <button
      ref={registerTileRef}
      type="button"
      data-tile-index={tile.index}
      onClick={() => onSelect(tile.index)}
      style={{
        gridColumn: col + 1,
        gridRow: row + 1,
        background: bgStyle,
        borderColor: isFlashing
          ? '#FEF08A'
          : hasWhiteVilla
            ? '#FFFFFF'
            : hasMonopoly
              ? '#FDE047'
              : owner
                ? owner.landHex
                : activeAuctionLeader
                  ? '#FDE047'
                  : 'rgba(15, 23, 42, 0.9)',
      }}
      className={`retro-tile-sheen relative flex flex-col items-center justify-end overflow-hidden rounded-[6px] border text-center text-white shadow-sm transition hover:brightness-115 cursor-pointer ${contentPadding} ${
        isFlashing
          ? 'ring-4 ring-yellow-300 brightness-125 z-20'
          : hasWhiteVilla
            ? 'border-2 ring-2 ring-white/85 shadow-[0_0_14px_rgba(255,255,255,0.75)] z-10'
            : hasMonopoly
              ? 'animate-monopoly-glow z-10'
              : owner || activeAuctionLeader
                ? 'border-2'
                : ''
      }`}
    >
      {/* Ảnh chụp thật thắng cảnh riêng từng địa danh + chỉ hiện dải màu nhóm đất cho ô PROPERTY */}
      {landmarkUrl && (
        <>
          <img
            src={landmarkUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(2,6,23,0.22) 0%, rgba(2,6,23,0.44) 48%, rgba(2,6,23,0.72) 100%)',
            }}
          />
          {tile.kind === 'PROPERTY' && (
            <span
              aria-hidden="true"
              style={{ backgroundColor: groupHexColor }}
              className={`pointer-events-none absolute z-10 ${outerGroupStripClass}`}
            />
          )}
        </>
      )}

      {/* Dải chủ sở hữu ngang hết ô đất (không ghi tên người mua hay N.x) + nhà/biệt thự */}
      {(tile.kind === 'PROPERTY' || tile.kind === 'AUCTION_STATION' || tile.kind === 'UTILITY') &&
        renderInnerSlot()}

      {/* Huy hiệu ×2 nhỏ khi hoàn tất trọn bộ ô cùng nhóm màu */}
      {hasMonopoly && (
        <span
          title="Đủ bộ nhóm màu · Tiền thuê ×2"
          className={`pointer-events-none absolute z-20 inline-block rounded bg-amber-400 px-1 text-[7px] font-black text-amber-950 shadow ${
            tile.edge === 0
              ? 'bottom-0.5 right-0.5'
              : tile.edge === 2
                ? 'top-0.5 right-0.5'
                : tile.edge === 1
                  ? 'top-0.5 left-1.5'
                  : 'top-0.5 right-1.5'
          }`}
        >
          ×2
        </span>
      )}

      <div
        className={`relative z-10 my-auto flex w-full flex-col justify-center ${
          tile.edge === 1
            ? 'items-start text-left'
            : tile.edge === 3
              ? 'items-end text-right'
              : 'items-center text-center'
        }`}
      >
        {specialIcon && (
          <div className="mb-0.5">
            {specialIcon === 'AIRPORT' && <AirportIcon className="h-3.5 w-3.5 drop-shadow" />}
            {specialIcon === 'STATION' && <StationBusIcon className="h-3.5 w-3.5 drop-shadow" />}
            {specialIcon === 'UTIL' && <HydroPowerIcon className="h-3.5 w-3.5 drop-shadow" />}
            {specialIcon === 'HERITAGE' && <HeritageCitadelIcon className="h-3.5 w-3.5 drop-shadow" />}
            {specialIcon === 'TAX' && <TaxStampIcon className="h-3.5 w-3.5 drop-shadow" />}
          </div>
        )}

        <span
          className={`w-full px-0.5 pt-[2px] text-[9px] leading-[1.22] font-black tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.98)] ${
            tile.kind === 'AUCTION_STATION'
              ? 'text-amber-200'
              : tile.kind === 'UTILITY'
                ? 'text-cyan-200'
                : 'text-white'
          }`}
        >
          {topTitle}
        </span>
        {priceText && (
          <span className="mt-[1px] max-w-full whitespace-nowrap px-0.5 text-[9.5px] leading-[1.15] font-black text-amber-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.98)]">
            {priceText}
          </span>
        )}
      </div>
    </button>
  );
}

/** Hiển thị số dư tiền chạy số mượt mà (rolling counter) kèm chớp sáng xanh/đỏ khi biến động */
function AnimatedCashValue({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    if (from === value) return;
    prevRef.current = value;
    setFlash(value > from ? 'up' : 'down');

    const start = performance.now();
    const dur = 480;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * ease));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setShown(value);
      }
    };
    raf = requestAnimationFrame(tick);
    const clearTimer = setTimeout(() => setFlash(null), 620);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(clearTimer);
    };
  }, [value]);

  const flashCls =
    flash === 'up'
      ? 'text-emerald-300 scale-110'
      : flash === 'down'
        ? 'text-rose-300 scale-95'
        : '';

  return (
    <span className={`inline-block transition-all duration-200 ${className} ${flashCls}`}>
      {formatShortVnd(shown)}
    </span>
  );
}

/** Lớp hiệu ứng Nhãn +/-, Sóng chạm đất & Tia sao chạy theo bước nhân vật */
function BoardVfxLayer({
  popups,
  shockwaves,
  trails,
}: {
  popups: BoardCashPopup[];
  shockwaves: ShockwaveEffect[];
  trails: TrailSpark[];
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[55] overflow-hidden">
      {trails.map((sp) => (
        <div
          key={sp.id}
          style={{
            left: sp.x,
            top: sp.y,
            backgroundColor: sp.color,
            boxShadow: `0 0 8px ${sp.color}`,
          }}
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full opacity-90"
        />
      ))}

      {shockwaves.map((sw) => (
        <div
          key={sw.id}
          style={{ left: sw.x, top: sw.y, borderColor: sw.color }}
          className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 opacity-85"
        />
      ))}

      {popups.map((pop) => (
        <div
          key={pop.id}
          style={{ left: pop.x, top: pop.y }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 animate-bounce rounded-full border px-2.5 py-1 text-xs font-black shadow-xl backdrop-blur-xs ${
            pop.positive
              ? 'border-emerald-200/80 bg-emerald-600/95 text-white'
              : 'border-rose-200/80 bg-rose-600/95 text-white'
          }`}
        >
          {pop.label}
        </div>
      ))}
    </div>
  );
}

export function GameBoardView({
  initialState,
  onRestartSameSetup,
  onBackToLobby,
}: GameBoardViewProps) {
  const [displayState, setDisplayState] = useState<GameState>(initialState);
  const latestStateRef = useRef<GameState>(initialState);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inspectTileIdx, setInspectTileIdx] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const [cashTransfers, setCashTransfers] = useState<ActiveCashTransfer[]>([]);
  const [transferStage, setTransferStage] = useState<{
    leftPlayerId: string;
    rightEntity: 'BANK' | string;
  } | null>(null);
  const [bankPulse, setBankPulse] = useState<{ id: number; kind: 'in' | 'out' } | null>(null);
  const [lastBankNote, setLastBankNote] = useState<{ id: number; text: string; tone: 'in' | 'out' } | null>(null);
  const [pawnReactions, setPawnReactions] = useState<Record<string, 'give' | 'celebrate' | 'hurt'>>({});
  const [rowFlash, setRowFlash] = useState<Record<string, 'gain' | 'loss'>>({});
  const [boardPopups, setBoardPopups] = useState<BoardCashPopup[]>([]);
  const [shockwaves, setShockwaves] = useState<ShockwaveEffect[]>([]);
  const [trailSparks, setTrailSparks] = useState<TrailSpark[]>([]);
  const [flashingTileIdx, setFlashingTileIdx] = useState<number | null>(null);
  const [newlyBuiltTileIdx, setNewlyBuiltTileIdx] = useState<number | null>(null);
  const [botThought, setBotThought] = useState<BotThoughtStatus | null>(null);
  const [activePawnAnim, setActivePawnAnim] = useState<ActivePawnAnim | null>(null);
  const [airportFlight, setAirportFlight] = useState<AirportFlightState | null>(null);
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);
  const [jailSlam, setJailSlam] = useState<JailSlamState | null>(null);
  const [isBoardShaking, setIsBoardShaking] = useState(false);
  const [liveDice, setLiveDice] = useState<{ values: number[]; isDouble: boolean } | null>(null);

  // Trạng thái Nhấn giữ nạp lực chạm sân giữa để tung xúc xắc
  const [chargeLevel, setChargeLevel] = useState(0);
  const [isChargingHold, setIsChargingHold] = useState(false);
  const pointerDownTimeRef = useRef<number | null>(null);
  const chargeRafRef = useRef<number>(0);
  const lastChargeTickRef = useRef<number>(0);
  const lastRollPowerRef = useRef<number>(0.58);

  const { stageW, stageH, scale, rotated, toLocalRect } = useLandscapeStage();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [tileRects, setTileRects] = useState<Record<number, { x: number; y: number; w: number; h: number }>>({});
  const tileRectsRef = useRef<Record<number, { x: number; y: number; w: number; h: number }>>({});
  const tileElRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const diceCanvasRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<MonopolySceneController | null>(null);
  const leftCharacterAnchorRef = useRef<HTMLDivElement | null>(null);
  const bankAnchorRef = useRef<HTMLDivElement | null>(null);
  const mobileBankAnchorRef = useRef<HTMLDivElement | null>(null);
  const chanceDeckRef = useRef<HTMLDivElement | null>(null);
  const fateDeckRef = useRef<HTMLDivElement | null>(null);
  const playerRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mountedRef = useRef(true);
  const lastTurnPlayerIdRef = useRef<string>(initialState.players[initialState.currentPlayerIndex]?.id ?? '');

  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        const orient = screen.orientation as { lock?: (mode: string) => Promise<void> } | undefined;
        await orient?.lock?.('landscape').catch(() => {});
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Một số trình duyệt (iOS Safari) bỏ qua Fullscreen API
    }
  }, []);

  const registerTileRef = useCallback(
    (index: number) => (el: HTMLButtonElement | null) => {
      tileElRefs.current[index] = el;
    },
    [],
  );

  const measureTileRects = useCallback(() => {
    const next: Record<number, { x: number; y: number; w: number; h: number }> = {};
    for (let i = 0; i < 52; i += 1) {
      const el = tileElRefs.current[i];
      if (!el) continue;
      const lr = toLocalRect(el);
      if (!lr) continue;
      next[i] = { x: lr.cx, y: lr.cy, w: lr.width, h: lr.height };
    }
    tileRectsRef.current = next;
    setTileRects(next);
  }, [toLocalRect]);

  useLayoutEffect(() => {
    measureTileRects();
    const raf = requestAnimationFrame(measureTileRects);
    const onResize = () => measureTileRects();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [measureTileRects, stageW, stageH, scale, rotated]);

  // Khởi tạo sân khấu xúc xắc 3D bo góc ở giữa bàn cờ
  useEffect(() => {
    mountedRef.current = true;
    const container = diceCanvasRef.current;
    if (!container) return;

    const controller = new MonopolySceneController(container, latestStateRef.current);
    sceneRef.current = controller;

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(chargeRafRef.current);
      controller.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    saveOfflineGame(displayState);
  }, [displayState]);

  // Phát âm thanh đặc trưng riêng của từng nhân vật khi chuyển sang lượt người mới
  useEffect(() => {
    const active = displayState.players[displayState.currentPlayerIndex];
    if (!active || active.isBankrupt || displayState.phase === 'GAME_OVER') return;
    if (lastTurnPlayerIdRef.current !== active.id) {
      lastTurnPlayerIdRef.current = active.id;
      gameAudio.playCharacterSignature(active.characterId);
    }
  }, [displayState.currentPlayerIndex, displayState.phase, displayState.players]);

  const getTileCenter = useCallback(
    (tileIndex: number): { x: number; y: number } => {
      const el = tileElRefs.current[tileIndex];
      const lr = toLocalRect(el);
      if (lr) {
        return { x: lr.cx, y: lr.cy };
      }
      const cached = tileRectsRef.current[tileIndex];
      return cached ? { x: cached.x, y: cached.y } : { x: stageW / 2, y: stageH / 2 };
    },
    [toLocalRect, stageW, stageH],
  );

  const spawnShockwave = useCallback((x: number, y: number, color: string) => {
    const id = ++fxUid;
    setShockwaves((prev) => [...prev, { id, x, y, color }]);
    setTimeout(() => {
      if (mountedRef.current) setShockwaves((prev) => prev.filter((s) => s.id !== id));
    }, 640);
  }, []);

  const spawnTrailSpark = useCallback((x: number, y: number, color: string) => {
    const id = ++fxUid;
    setTrailSparks((prev) => [...prev.slice(-14), { id, x, y, color }]);
    setTimeout(() => {
      if (mountedRef.current) setTrailSparks((prev) => prev.filter((s) => s.id !== id));
    }, 440);
  }, []);

  const triggerBoardShake = useCallback(() => {
    setIsBoardShaking(true);
    setTimeout(() => {
      if (mountedRef.current) setIsBoardShaking(false);
    }, 380);
  }, []);

  const triggerBankPulse = useCallback((kind: 'in' | 'out') => {
    const id = ++fxUid;
    setBankPulse({ id, kind });
    setTimeout(() => {
      if (mountedRef.current) setBankPulse((cur) => (cur?.id === id ? null : cur));
    }, 600);
  }, []);

  /** Hiện tạm nhãn Thu/Chi ngay dưới Ngân Hàng trong ~2,4 giây rồi tự trở về "Kho Bạc TW" */
  const showTransientBankNote = useCallback((text: string, tone: 'in' | 'out') => {
    const noteId = ++fxUid;
    setLastBankNote({ id: noteId, text, tone });
    setTimeout(() => {
      if (mountedRef.current) {
        setLastBankNote((cur) => (cur?.id === noteId ? null : cur));
      }
    }, 2400);
  }, []);

  const triggerPawnReaction = useCallback((playerId: string, kind: 'give' | 'celebrate' | 'hurt') => {
    setPawnReactions((prev) => ({ ...prev, [playerId]: kind }));
    setTimeout(() => {
      if (mountedRef.current) {
        setPawnReactions((prev) => {
          if (prev[playerId] !== kind) return prev;
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }
    }, 660);
  }, []);

  const triggerRowFlash = useCallback((playerId: string, kind: 'gain' | 'loss') => {
    setRowFlash((prev) => ({ ...prev, [playerId]: kind }));
    setTimeout(() => {
      if (mountedRef.current) {
        setRowFlash((prev) => {
          if (prev[playerId] !== kind) return prev;
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }
    }, 760);
  }, []);

  /** Lấy tọa độ cục bộ chuẩn trên sân khấu của Kho Ngân Hàng hoặc Standee Chibi đang đứng trên bàn cờ */
  const getEntityBoardAnchor = useCallback(
    (
      entityId: string | 'BANK',
      positionsMap: Map<string, number>,
      tiles: readonly BoardTile[],
    ): { x: number; y: number } => {
      if (entityId === 'BANK') {
        const lr = toLocalRect(bankAnchorRef.current) ?? toLocalRect(mobileBankAnchorRef.current);
        if (lr) {
          return { x: lr.cx, y: lr.cy };
        }
        return { x: stageW * 0.8, y: stageH * 0.5 };
      }

      const tileIdx = positionsMap.get(entityId) ?? 0;
      const baseCenter = getTileCenter(tileIdx);
      const tile = tiles[tileIdx];
      const innerNudgeX = tile?.edge === 1 ? 14 : tile?.edge === 3 ? -14 : 0;
      const innerNudgeY = tile?.edge === 0 ? -16 : tile?.edge === 2 ? 12 : -8;
      return { x: baseCenter.x + innerNudgeX, y: baseCenter.y + innerNudgeY };
    },
    [getTileCenter, toLocalRect, stageW, stageH],
  );

  const spawnBoardPopup = useCallback(
    (playerId: string, positionsMap: Map<string, number>, delta: number, label: string) => {
      const tileIdx = positionsMap.get(playerId) ?? 0;
      const pos = getTileCenter(tileIdx);
      const id = ++fxUid;
      setBoardPopups((prev) => [
        ...prev,
        { id, x: pos.x, y: pos.y - 30, positive: delta >= 0, label },
      ]);
      setTimeout(() => {
        if (mountedRef.current) {
          setBoardPopups((prev) => prev.filter((p) => p.id !== id));
        }
      }, 1450);
    },
    [getTileCenter],
  );

  /**
   * Diễn hoạt luân chuyển dòng tiền chầm chậm (~1.52s) giữa Nhân Vật bên trái ↔ Ngân Hàng (hoặc Chủ Đất) bên phải:
   * - Nếu trả tiền cho người chơi khác: bên phải tạm hiện chính Nhân Vật Chủ Đất nhận tiền
   * - Cọc tiền giấy cột đai + chồng xu vàng trượt mượt ngang sân giữa cực trực quan
   * - Đúng khoảnh khắc tiền chạm đích (t >= 0.78): bên nhận bật sáng & số tiền chạy số mượt
   */
  const animateCashTransfer = useCallback(
    async ({
      fromId,
      toId,
      amount,
      reasonLabel,
      players,
      positionsMap,
      tiles,
      isPurchaseLike,
      onArrive,
    }: {
      fromId: string | 'BANK';
      toId: string | 'BANK';
      amount: number;
      reasonLabel: string;
      players: readonly PlayerState[];
      positionsMap: Map<string, number>;
      tiles: readonly BoardTile[];
      isPurchaseLike?: boolean;
      onArrive: () => void;
    }): Promise<void> => {
      const absAmount = Math.abs(amount);
      if (absAmount <= 0) {
        onArrive();
        return;
      }

      // Xác định cặp Trái (Nhân vật) ↔ Phải (Ngân Hàng hoặc Chủ Đất nhận tiền)
      const stageLeftId = fromId === 'BANK' ? (toId as string) : fromId;
      const stageRight: 'BANK' | string =
        fromId === 'BANK' || toId === 'BANK' ? 'BANK' : toId;

      setTransferStage({ leftPlayerId: stageLeftId, rightEntity: stageRight });

      // Chờ 260ms để xúc xắc ẩn đi & Nhân vật + Ngân hàng/Chủ đất trượt lại gần đối diện nhau trước khi cọc tiền lướt ra
      await new Promise((r) => setTimeout(r, 260));
      if (!mountedRef.current) {
        onArrive();
        return;
      }

      const leftRect = toLocalRect(leftCharacterAnchorRef.current);
      const rightRect = toLocalRect(bankAnchorRef.current);
      const hasDesktopStage = Boolean(
        leftRect && leftRect.width > 0 && rightRect && rightRect.width > 0,
      );

      let start: { x: number; y: number };
      let end: { x: number; y: number };
      let ctrlX: number;
      let ctrlY: number;

      if (hasDesktopStage && leftRect && rightRect) {
        const leftAnchor = {
          x: leftRect.right + 6,
          y: leftRect.top + leftRect.height * 0.46,
        };
        const rightAnchor = {
          x: rightRect.left - 6,
          y: rightRect.top + rightRect.height * 0.46,
        };
        start = fromId === 'BANK' ? rightAnchor : leftAnchor;
        end = fromId === 'BANK' ? leftAnchor : rightAnchor;
        ctrlX = (start.x + end.x) / 2;
        ctrlY = (start.y + end.y) / 2 - 22;
      } else {
        start = getEntityBoardAnchor(fromId, positionsMap, tiles);
        end = getEntityBoardAnchor(toId, positionsMap, tiles);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        ctrlX = midX;
        ctrlY = Math.max(66, midY - 64);
      }

      const tone: ActiveCashTransfer['tone'] =
        fromId === 'BANK' ? 'from-bank' : toId === 'BANK' ? 'to-bank' : 'player-to-player';

      const fromName =
        fromId === 'BANK'
          ? '🏛️ Ngân Hàng'
          : players.find((p) => p.id === fromId)?.name ?? 'Người chơi';
      const toName =
        toId === 'BANK'
          ? '🏛️ Ngân Hàng'
          : players.find((p) => p.id === toId)?.name ?? 'Người chơi';

      // Rút gọn nhãn lý do (bỏ phần số tiền lặp lại ở đầu)
      const cleanedReason = reasonLabel
        .replace(/^[+-]?\s*[\d.,]+\s*(?:Tr|Nghìn|M|K)?\s*đ?\s*/i, '')
        .trim()
        .slice(0, 22);

      const items: CashParticleSeed[] = Array.from({ length: 4 }, (_, i) => ({
        delay: i * 0.08,
        isCoin: true,
        spreadX: (i % 2 === 0 ? -1 : 1) * (12 + i * 5),
        spreadY: ((i % 3) - 1) * 14,
        rotStart: -25 + i * 18,
        rotEnd: 30 - i * 16,
      }));

      // Kích hoạt biểu cảm & âm thanh lúc bắt đầu đưa tiền
      if (fromId === 'BANK') {
        triggerBankPulse('out');
        showTransientBankNote(`Chi -${formatShortVnd(absAmount)}`, 'out');
        gameAudio.playReceiveMoney();
      } else {
        triggerPawnReaction(fromId, isPurchaseLike ? 'give' : 'hurt');
        gameAudio.playPayMoney();
      }

      const id = ++fxUid;
      const durationMs = 1520;
      let arrived = false;

      await new Promise<void>((resolve) => {
        const tStart = performance.now();

        const tick = (now: number) => {
          if (!mountedRef.current) {
            resolve();
            return;
          }
          const t = Math.min(1, (now - tStart) / durationMs);

          if (!arrived && t >= 0.78) {
            arrived = true;
            if (toId === 'BANK') {
              triggerBankPulse('in');
              showTransientBankNote(`Thu +${formatShortVnd(absAmount)}`, 'in');
            } else {
              triggerPawnReaction(toId, 'celebrate');
              if (fromId !== 'BANK') {
                gameAudio.playReceiveMoney();
              }
            }
            spawnShockwave(
              end.x,
              end.y,
              tone === 'from-bank' ? '#34D399' : tone === 'player-to-player' ? '#38BDF8' : '#FBBF24',
            );
            onArrive();
          }

          setCashTransfers((prev) => {
            const exists = prev.some((tr) => tr.id === id);
            const updated: ActiveCashTransfer = {
              id,
              startX: start.x,
              startY: start.y,
              ctrlX,
              ctrlY,
              endX: end.x,
              endY: end.y,
              amount: absAmount,
              tone,
              fromName,
              toName,
              reasonText: cleanedReason,
              progress: t,
              items,
            };
            return exists ? prev.map((tr) => (tr.id === id ? updated : tr)) : [...prev, updated];
          });

          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            if (!arrived) {
              arrived = true;
              onArrive();
            }
            setCashTransfers((prev) => prev.filter((tr) => tr.id !== id));
            resolve();
          }
        };

        requestAnimationFrame(tick);
      });

      // Giữ thêm 260ms để người xem thấy rõ số tiền bên nhận vừa nhảy xong trước khi trả Ngân Hàng lại bên phải
      if (mountedRef.current) {
        await new Promise((r) => setTimeout(r, 260));
        if (mountedRef.current) {
          setTransferStage(null);
        }
      }
    },
    [getEntityBoardAnchor, toLocalRect, triggerBankPulse, showTransientBankNote, triggerPawnReaction, spawnShockwave],
  );

  /** Diễn hoạt Standee Chibi 2.5D nhún – nghiêng người bật nhảy từng ô + vệt sao & sóng chạm đất */
  const animateDomPawnPath = useCallback(
    async (
      playerId: string,
      startIndex: number,
      path: number[],
      backwards: boolean,
      landHex: string,
      charId?: PlayerState['characterId'],
    ) => {
      let fromIdx = startIndex;
      const stepMs = path.length > 8 ? 165 : 215;

      for (let i = 0; i < path.length; i += 1) {
        const toIdx = path[i];
        const p0 = getTileCenter(fromIdx);
        const p1 = getTileCenter(toIdx);
        const dirSign = p1.x >= p0.x ? 1 : -1;

        gameAudio.playPawnHop(i, backwards, charId);
        spawnTrailSpark(p0.x, p0.y, landHex);

        await new Promise<void>((resolve) => {
          const tStart = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - tStart) / stepMs);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const x = p0.x + (p1.x - p0.x) * ease;
            const y = p0.y + (p1.y - p0.y) * ease;
            const liftY = -Math.sin(t * Math.PI) * 34;

            let scaleX = 1;
            let scaleY = 1;
            let tiltDeg = 0;
            if (t < 0.16) {
              const s = t / 0.16;
              scaleX = 1 + 0.18 * s;
              scaleY = 1 - 0.18 * s;
            } else if (t < 0.84) {
              const air = Math.sin(((t - 0.16) / 0.68) * Math.PI);
              scaleX = 1 - 0.12 * air;
              scaleY = 1 + 0.18 * air;
              tiltDeg = dirSign * 11 * air;
            } else {
              const l = Math.sin(((t - 0.84) / 0.16) * Math.PI);
              scaleX = 1 + 0.2 * l;
              scaleY = 1 - 0.2 * l;
            }

            if (mountedRef.current) {
              setActivePawnAnim({ playerId, x, y, liftY, scaleX, scaleY, tiltDeg });
            }

            if (t < 1 && mountedRef.current) {
              requestAnimationFrame(tick);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(tick);
        });

        if (mountedRef.current) {
          setFlashingTileIdx(toIdx);
          spawnShockwave(p1.x, p1.y, landHex);
        }
        fromIdx = toIdx;
      }

      if (mountedRef.current) {
        setActivePawnAnim(null);
        setTimeout(() => {
          if (mountedRef.current) setFlashingTileIdx(null);
        }, 320);
      }
    },
    [getTileCenter, spawnShockwave, spawnTrailSpark],
  );

  /** Diễn hoạt Sân Bay kiểu điện ảnh: ẩn xúc xắc + máy bay thương mại trắng-đỏ KHỔNG LỒ lướt vắt ngang sân giữa kèm bảng thông báo điểm đến */
  const animateDomAirportFlight = useCallback(
    async (
      playerId: string,
      playerName: string,
      fromIndex: number,
      toIndex: number,
      destinationName: string,
      landHex: string,
    ) => {
      gameAudio.playAirplaneTakeoff();
      const p0 = getTileCenter(fromIndex);
      const p1 = getTileCenter(toIndex);
      const midX = stageW * 0.5;
      const midY = stageH * 0.44;
      const dur = 1650;

      await new Promise<void>((resolve) => {
        const tStart = performance.now();
        const puffs: { x: number; y: number; opacity: number }[] = [];

        const tick = (now: number) => {
          const t = Math.min(1, (now - tStart) / dur);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const u = 1 - ease;
          const x = u * u * p0.x + 2 * u * ease * midX + ease * ease * p1.x;
          const y = u * u * p0.y + 2 * u * ease * midY + ease * ease * p1.y;
          const dx = 2 * u * (midX - p0.x) + 2 * ease * (p1.x - midX);
          const dy = 2 * u * (midY - p0.y) + 2 * ease * (p1.y - midY);
          // GiantAirportJetSvg mũi hướng lên (0°), cộng +90° để xoay đúng chiều vector bay
          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

          if (Math.random() < 0.55 && t < 0.92) {
            puffs.push({ x, y, opacity: 0.9 });
            if (puffs.length > 22) puffs.shift();
          }
          for (const pf of puffs) {
            pf.opacity = Math.max(0, pf.opacity - 0.025);
          }

          if (mountedRef.current) {
            setAirportFlight({
              startX: p0.x,
              startY: p0.y,
              ctrlX: midX,
              ctrlY: midY,
              endX: p1.x,
              endY: p1.y,
              planeX: x,
              planeY: y,
              angleDeg,
              progress: t,
              playerName,
              destinationName,
              puffs: puffs.map((pf) => ({ ...pf })),
            });
            setActivePawnAnim({
              playerId,
              x,
              y,
              liftY: -Math.sin(t * Math.PI) * 32,
              scaleX: 0.55,
              scaleY: 0.55,
              tiltDeg: 0,
            });
          }

          if (t < 1 && mountedRef.current) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });

      if (mountedRef.current) {
        setAirportFlight(null);
        setActivePawnAnim(null);
        setFlashingTileIdx(toIndex);
        spawnShockwave(p1.x, p1.y, landHex);
        setTimeout(() => {
          if (mountedRef.current) setFlashingTileIdx(null);
        }, 420);
      }
    },
    [getTileCenter, spawnShockwave],
  );

  /** Diễn hoạt Bị Bắt Vào Tù (ô 16): bay thẳng tới Trại Giam + sập song sắt + rung nhẹ mặt bàn */
  const animateDomJailLock = useCallback(
    async (playerId: string, fromIndex: number) => {
      gameAudio.playJailLock();
      const p0 = getTileCenter(fromIndex);
      const p1 = getTileCenter(JAIL_TILE_INDEX);
      const dur = fromIndex === JAIL_TILE_INDEX ? 260 : 620;

      await new Promise<void>((resolve) => {
        const tStart = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - tStart) / dur);
          const ease = 1 - Math.pow(1 - t, 3);
          const x = p0.x + (p1.x - p0.x) * ease;
          const y = p0.y + (p1.y - p0.y) * ease;
          const liftY = -Math.sin(t * Math.PI) * 46;
          if (mountedRef.current) {
            setActivePawnAnim({ playerId, x, y, liftY, scaleX: 1, scaleY: 1, tiltDeg: (1 - t) * 20 });
          }
          if (t < 1 && mountedRef.current) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });

      if (mountedRef.current) {
        setActivePawnAnim(null);
        triggerBoardShake();
        const slamId = ++fxUid;
        setJailSlam({ id: slamId, x: p1.x, y: p1.y });
        spawnShockwave(p1.x, p1.y, '#EF4444');
        setTimeout(() => {
          if (mountedRef.current) setJailSlam((cur) => (cur?.id === slamId ? null : cur));
        }, 800);
      }
    },
    [getTileCenter, spawnShockwave, triggerBoardShake],
  );

  /** Diễn hoạt rút & lật 3D lá bài Cơ Hội / Khí Vận bay từ chồng bài giữa sân */
  const animateCardDrawFromDeck = useCallback(
    async (deck: CardDeckKind) => {
      const deckEl = deck === 'CHANCE' ? chanceDeckRef.current : fateDeckRef.current;
      const lr = toLocalRect(deckEl);
      const x = lr ? lr.cx : stageW / 2;
      const y = lr ? lr.cy : stageH / 2;
      const id = ++fxUid;
      setFlyingCard({ id, deck, x, y });
      await new Promise((r) => setTimeout(r, 600));
      if (mountedRef.current) {
        setFlyingCard((cur) => (cur?.id === id ? null : cur));
      }
    },
    [toLocalRect, stageW, stageH],
  );

  // Thực thi hành động game + chuỗi hoạt ảnh & âm thanh nối tiếp
  const dispatchAction = useCallback(
    async (action: GameAction, rollPower = 0.58) => {
      if (isAnimating) return;
      setBotThought(null);
      setIsAnimating(true);

      const prevState = latestStateRef.current;
      const { state: nextState, events } = reduceGameAction(prevState, action);
      latestStateRef.current = nextState;

      const prevPositions = new Map<string, number>(prevState.players.map((p) => [p.id, p.position]));
      const liveCashMap = new Map<string, number>(prevState.players.map((p) => [p.id, p.cash]));

      // Sắp xếp lại: nếu có thưởng Khởi Hành (+3M) ngay trước PAWN_STEP, cho nhân vật nhảy xong rồi Ngân hàng mới bắn +3M vào tay
      const orderedEvents: GameAnimEvent[] = [];
      for (let i = 0; i < events.length; i += 1) {
        const cur = events[i];
        const nxt = events[i + 1];
        if (
          cur.type === 'CASH_CHANGE' &&
          cur.delta > 0 &&
          cur.counterpartyId === 'BANK' &&
          cur.label.includes('Khởi Hành') &&
          nxt?.type === 'PAWN_STEP' &&
          nxt.playerId === cur.playerId
        ) {
          orderedEvents.push(nxt, cur);
          i += 1;
        } else {
          orderedEvents.push(cur);
        }
      }

      const applyCashDeltaToDisplay = (playerId: string, delta: number) => {
        const updatedCash = Math.max(0, (liveCashMap.get(playerId) ?? 0) + delta);
        liveCashMap.set(playerId, updatedCash);
        triggerRowFlash(playerId, delta >= 0 ? 'gain' : 'loss');
        setDisplayState((prev) => ({
          ...prev,
          players: prev.players.map((pl) =>
            pl.id === playerId ? { ...pl, cash: updatedCash } : pl,
          ),
        }));
      };

      for (let i = 0; i < orderedEvents.length; i += 1) {
        if (!mountedRef.current) return;
        const ev = orderedEvents[i];

        switch (ev.type) {
          case 'DICE_ROLLED':
            if (sceneRef.current) {
              await sceneRef.current.animateDiceRoll(ev.values, ev.isDouble, rollPower);
            } else {
              gameAudio.playDiceShake(rollPower);
              await new Promise((r) => setTimeout(r, 450));
            }
            if (mountedRef.current) {
              setLiveDice({ values: ev.values, isDouble: ev.isDouble });
              if (ev.isDouble) {
                triggerBoardShake();
              }
              // Hiển thị rõ số điểm quay được (~0.85s) trước khi nhân vật bắt đầu nhảy di chuyển
              await new Promise((r) => setTimeout(r, 850));
            }
            break;

          case 'PAWN_STEP': {
            const mover = nextState.players.find((pl) => pl.id === ev.playerId);
            const startIdx = prevPositions.get(ev.playerId) ?? 0;
            await animateDomPawnPath(
              ev.playerId,
              startIdx,
              ev.path,
              ev.backwards,
              mover?.landHex ?? '#FDE047',
              mover?.characterId,
            );
            prevPositions.set(ev.playerId, ev.path[ev.path.length - 1] ?? startIdx);
            setDisplayState((prev) => ({
              ...prev,
              players: prev.players.map((pl) =>
                pl.id === ev.playerId
                  ? { ...pl, position: ev.path[ev.path.length - 1] ?? pl.position }
                  : pl,
              ),
            }));
            break;
          }

          case 'AIRPORT_FLY': {
            const mover = nextState.players.find((pl) => pl.id === ev.playerId);
            const destTile = nextState.tiles[ev.toIndex];
            await animateDomAirportFlight(
              ev.playerId,
              mover?.name ?? 'Người chơi',
              ev.fromIndex,
              ev.toIndex,
              destTile?.name ?? 'Điểm đến',
              mover?.landHex ?? '#38BDF8',
            );
            prevPositions.set(ev.playerId, ev.toIndex);
            setDisplayState((prev) => ({
              ...prev,
              players: prev.players.map((pl) =>
                pl.id === ev.playerId ? { ...pl, position: ev.toIndex } : pl,
              ),
            }));
            break;
          }

          case 'JAIL_LOCK':
            await animateDomJailLock(ev.playerId, ev.fromIndex);
            prevPositions.set(ev.playerId, JAIL_TILE_INDEX);
            setDisplayState((prev) => ({
              ...prev,
              players: prev.players.map((pl) =>
                pl.id === ev.playerId ? { ...pl, position: JAIL_TILE_INDEX, inJail: true } : pl,
              ),
            }));
            break;

          case 'JAIL_FREE':
            gameAudio.playJailFree();
            break;

          case 'CASH_CHANGE': {
            if (ev.delta === 0) break;
            const nextEv = orderedEvents[i + 1];
            const isPlayerToPlayerPair =
              ev.delta < 0 &&
              ev.counterpartyId &&
              ev.counterpartyId !== 'BANK' &&
              nextEv?.type === 'CASH_CHANGE' &&
              nextEv.playerId === ev.counterpartyId &&
              nextEv.counterpartyId === ev.playerId &&
              nextEv.delta === -ev.delta;

            if (isPlayerToPlayerPair && nextEv.type === 'CASH_CHANGE') {
              // Gộp cặp trả-nhận giữa 2 người chơi thành 1 đường bay tiền mượt từ người trả -> chủ đất
              i += 1;
              const payerId = ev.playerId;
              const receiverId = nextEv.playerId;
              const amt = Math.abs(ev.delta);
              spawnBoardPopup(payerId, prevPositions, ev.delta, ev.label);
              await animateCashTransfer({
                fromId: payerId,
                toId: receiverId,
                amount: amt,
                reasonLabel: ev.label,
                players: nextState.players,
                positionsMap: prevPositions,
                tiles: nextState.tiles,
                isPurchaseLike: false,
                onArrive: () => {
                  applyCashDeltaToDisplay(payerId, -amt);
                  applyCashDeltaToDisplay(receiverId, amt);
                  spawnBoardPopup(receiverId, prevPositions, amt, nextEv.label);
                },
              });
              break;
            }

            const fromId: string | 'BANK' = ev.delta > 0 ? (ev.counterpartyId ?? 'BANK') : ev.playerId;
            const toId: string | 'BANK' = ev.delta > 0 ? ev.playerId : (ev.counterpartyId ?? 'BANK');
            const isPurchaseLike =
              nextEv?.type === 'HOUSE_BUILT' ||
              ev.label.includes('Mua') ||
              ev.label.includes('Xây') ||
              ev.label.includes('Cọc');

            await animateCashTransfer({
              fromId,
              toId,
              amount: Math.abs(ev.delta),
              reasonLabel: ev.label,
              players: nextState.players,
              positionsMap: prevPositions,
              tiles: nextState.tiles,
              isPurchaseLike,
              onArrive: () => {
                applyCashDeltaToDisplay(ev.playerId, ev.delta);
                spawnBoardPopup(ev.playerId, prevPositions, ev.delta, ev.label);
              },
            });
            break;
          }

          case 'CARD_DRAWN':
            gameAudio.playCardDraw(ev.card.deck);
            await animateCardDrawFromDeck(ev.card.deck);
            break;

          case 'HOUSE_BUILT': {
            gameAudio.playBuildOrBuy(ev.level);
            // Cập nhật ngay màu đất & ngôi nhà mới mọc ngay sau khi tiền vừa bay vào Ngân hàng
            const updatedTile = nextState.tiles[ev.tileIndex];
            if (updatedTile) {
              setDisplayState((prev) => ({
                ...prev,
                tiles: prev.tiles.map((t) => (t.index === ev.tileIndex ? updatedTile : t)),
              }));
            }
            const pos = getTileCenter(ev.tileIndex);
            spawnShockwave(pos.x, pos.y, ev.level >= 5 ? '#FDE047' : ev.landHex);
            spawnTrailSpark(pos.x - 10, pos.y - 8, '#FDE047');
            spawnTrailSpark(pos.x + 10, pos.y - 10, '#FFFFFF');
            setNewlyBuiltTileIdx(ev.tileIndex);
            await new Promise((r) => setTimeout(r, 380));
            if (mountedRef.current) {
              setTimeout(() => {
                if (mountedRef.current) setNewlyBuiltTileIdx(null);
              }, 340);
            }
            break;
          }

          case 'ASSET_SOLD': {
            gameAudio.playSellAsset();
            const pos = getTileCenter(ev.tileIndex);
            spawnShockwave(pos.x, pos.y, '#F59E0B');
            break;
          }

          case 'AUCTION_SOUND':
            gameAudio.playAuction(ev.kind);
            break;

          case 'BANKRUPT':
            gameAudio.playBankrupt();
            triggerBoardShake();
            break;

          case 'VICTORY': {
            gameAudio.playVictoryFanfare();
            const winner = nextState.players.find((pl) => pl.id === ev.winnerId);
            if (winner) {
              setTimeout(() => gameAudio.playCharacterSignature(winner.characterId), 980);
            }
            sceneRef.current?.triggerVictoryFireworks();
            break;
          }
        }
      }

      if (mountedRef.current) {
        sceneRef.current?.setImmediateDice(nextState.lastDiceValues);
        setLiveDice(null);
        setDisplayState(nextState);
        setIsAnimating(false);
        measureTileRects();
      }
    },
    [
      isAnimating,
      animateDomPawnPath,
      animateDomAirportFlight,
      animateDomJailLock,
      animateCardDrawFromDeck,
      animateCashTransfer,
      spawnBoardPopup,
      triggerBoardShake,
      triggerRowFlash,
      getTileCenter,
      spawnShockwave,
      spawnTrailSpark,
      measureTileRects,
    ],
  );

  // Điều khiển lượt Bot SmartAI: dừng suy nghĩ 1.6–2.6s khi cân nhắc mua/xây/đấu giá
  useEffect(() => {
    if (isAnimating || displayState.phase === 'GAME_OVER' || displayState.phase === 'CARD_REVEAL') {
      return;
    }

    let actor: PlayerState | undefined;
    if (displayState.phase === 'DEBT_LIQUIDATION' && displayState.debtQueue.length > 0) {
      actor = displayState.players.find((p) => p.id === displayState.debtQueue[0].debtorId);
    } else {
      actor = displayState.players[displayState.currentPlayerIndex];
    }

    if (!actor || !actor.isBot || actor.isBankrupt) return;

    const isTradeDecision =
      displayState.phase === 'BUY_OR_SKIP_DECISION' ||
      displayState.phase === 'UPGRADE_OWN_PROPERTY' ||
      displayState.phase === 'AUCTION_DECISION';

    if (!isTradeDecision) {
      setBotThought({
        botId: actor.id,
        text: displayState.phase === 'WAIT_ROLL' ? '🎲 Đang lắc xúc xắc...' : '⏳ Đang xử lý...',
        tone: 'thinking',
      });
      const timer = setTimeout(() => {
        const botAction = computeBotAction(latestStateRef.current);
        if (botAction) {
          const botPower = 0.45 + cryptoRandomInt(0, 45) / 100;
          void dispatchAction(botAction, botPower);
        }
      }, 780);
      return () => clearTimeout(timer);
    }

    const targetIdx =
      displayState.pendingBuyOrUpgradeTileIndex ?? displayState.pendingAuctionTileIndex;
    const tileName =
      targetIdx !== null && displayState.tiles[targetIdx]
        ? displayState.tiles[targetIdx].name
        : 'ô đất';

    if (targetIdx !== null) {
      setFlashingTileIdx(targetIdx);
    }

    const actionVerb =
      displayState.phase === 'BUY_OR_SKIP_DECISION'
        ? `cân nhắc mua ${tileName}`
        : displayState.phase === 'UPGRADE_OWN_PROPERTY'
          ? `tính xây thêm nhà tại ${tileName}`
          : `tính đấu giá ${tileName}`;

    setBotThought({
      botId: actor.id,
      text: `🤔 ${actor.name} đang ${actionVerb}...`,
      tone: 'thinking',
    });

    const thinkMs = cryptoRandomInt(1500, 2300);
    let commitTimer: ReturnType<typeof setTimeout> | null = null;

    const decideTimer = setTimeout(() => {
      const botAction = computeBotAction(latestStateRef.current);
      if (!botAction) return;

      const accepted =
        (botAction.type === 'BUY_PROPERTY' && botAction.buy) ||
        (botAction.type === 'UPGRADE_PROPERTY' && botAction.upgrade) ||
        (botAction.type === 'AUCTION_DECIDE' && botAction.bid);

      setBotThought({
        botId: actor.id,
        text: accepted
          ? `✅ ${actor.name}: Chốt ${displayState.phase === 'AUCTION_DECISION' ? 'đấu giá' : displayState.phase === 'UPGRADE_OWN_PROPERTY' ? 'xây nhà' : 'mua'} ${tileName}!`
          : `❌ ${actor.name}: Bỏ qua ${tileName}.`,
        tone: accepted ? 'accept' : 'reject',
      });

      commitTimer = setTimeout(() => {
        setFlashingTileIdx(null);
        void dispatchAction(botAction);
      }, 700);
    }, thinkMs);

    return () => {
      clearTimeout(decideTimer);
      if (commitTimer) clearTimeout(commitTimer);
      setFlashingTileIdx(null);
    };
  }, [displayState, isAnimating, dispatchAction]);

  const currentPlayer = displayState.players[displayState.currentPlayerIndex] ?? displayState.players[0];

  const activeDebtor =
    displayState.phase === 'DEBT_LIQUIDATION' && displayState.debtQueue.length > 0
      ? displayState.players.find((p) => p.id === displayState.debtQueue[0].debtorId) ?? currentPlayer
      : currentPlayer;

  const isHumanActing = !activeDebtor.isBot && !isAnimating;
  const canHumanTapRoll =
    isHumanActing &&
    (displayState.phase === 'WAIT_ROLL' || displayState.phase === 'IN_JAIL_DECISION');

  const triggerRollWithPower = useCallback(
    (power01: number) => {
      if (!canHumanTapRoll) return;
      lastRollPowerRef.current = power01;
      if (displayState.phase === 'IN_JAIL_DECISION') {
        void dispatchAction({ type: 'ROLL_FOR_JAIL' }, power01);
      } else {
        void dispatchAction({ type: 'ROLL_DICE' }, power01);
      }
    },
    [canHumanTapRoll, displayState.phase, dispatchAction],
  );

  // Phím Space để tung xúc xắc nhanh
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (inspectTileIdx !== null || showRules || showDrawer) return;
      if (!canHumanTapRoll) return;
      e.preventDefault();
      triggerRollWithPower(0.62);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canHumanTapRoll, inspectTileIdx, showRules, showDrawer, triggerRollWithPower]);

  // Cơ chế Hybrid Chạm nhanh tung ngay + Nhấn giữ nạp lực lắc xúc xắc trên toàn sân giữa
  const cancelCharging = useCallback(() => {
    pointerDownTimeRef.current = null;
    cancelAnimationFrame(chargeRafRef.current);
    setIsChargingHold(false);
    setChargeLevel(0);
    sceneRef.current?.setDiceCharging(false, 0);
  }, []);

  const handleCenterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canHumanTapRoll) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, [data-no-roll="true"]')) return;

    pointerDownTimeRef.current = performance.now();
    lastChargeTickRef.current = 0;

    const tickCharge = (now: number) => {
      if (pointerDownTimeRef.current === null) return;
      const heldMs = now - pointerDownTimeRef.current;
      if (heldMs >= 130) {
        const p = Math.min(1, (heldMs - 130) / 1050);
        setIsChargingHold(true);
        setChargeLevel(p);
        sceneRef.current?.setDiceCharging(true, p);

        const tickInterval = Math.max(72, 170 - p * 95);
        if (now - lastChargeTickRef.current >= tickInterval) {
          lastChargeTickRef.current = now;
          gameAudio.playDiceChargeTick(p);
        }
      }
      chargeRafRef.current = requestAnimationFrame(tickCharge);
    };

    chargeRafRef.current = requestAnimationFrame(tickCharge);
  };

  const handleCenterPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerDownTimeRef.current === null) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, [data-no-roll="true"]')) {
      cancelCharging();
      return;
    }
    const heldMs = performance.now() - pointerDownTimeRef.current;
    const finalPower = heldMs < 160 ? 0.56 : 0.58 + Math.min(1, (heldMs - 130) / 1050) * 0.42;
    cancelCharging();
    triggerRollWithPower(finalPower);
  };

  const activeTile =
    displayState.pendingBuyOrUpgradeTileIndex !== null
      ? displayState.tiles[displayState.pendingBuyOrUpgradeTileIndex]
      : displayState.pendingAuctionTileIndex !== null
        ? displayState.tiles[displayState.pendingAuctionTileIndex]
        : null;

  // Nhóm các quân cờ đứng cùng 1 ô để xếp so le không đè mặt nhau
  const pawnsByTile = new Map<number, PlayerState[]>();
  for (const p of displayState.players) {
    if (p.isBankrupt) continue;
    const arr = pawnsByTile.get(p.position) ?? [];
    arr.push(p);
    pawnsByTile.set(p.position, arr);
  }

  // Nhân vật hiển thị bên Trái (mặc định là người đang tới lượt; khi giao dịch tiền sẽ hiện đúng bên gửi/nhận)
  const leftStagePlayer =
    (transferStage
      ? displayState.players.find((p) => p.id === transferStage.leftPlayerId)
      : null) ?? currentPlayer;
  const leftStageChar =
    CO_TY_PHU_CHARACTERS.find((c) => c.id === leftStagePlayer.characterId) ??
    CO_TY_PHU_CHARACTERS[0];
  const leftOwnedCount = displayState.tiles.filter(
    (t) => t.ownerId === leftStagePlayer.id || t.auctionState?.finalOwnerId === leftStagePlayer.id,
  ).length;
  const leftHouseCount = displayState.tiles.reduce(
    (sum, t) => sum + (t.ownerId === leftStagePlayer.id ? t.buildingLevel : 0),
    0,
  );

  // Nhân vật Chủ Đất tạm thay vị trí Ngân Hàng bên Phải khi có giao dịch trả tiền giữa 2 người chơi
  const rightCreditorPlayer =
    transferStage && transferStage.rightEntity !== 'BANK'
      ? displayState.players.find((p) => p.id === transferStage.rightEntity) ?? null
      : null;
  const rightCreditorChar = rightCreditorPlayer
    ? CO_TY_PHU_CHARACTERS.find((c) => c.id === rightCreditorPlayer.characterId) ??
      CO_TY_PHU_CHARACTERS[0]
    : null;

  // Có hộp thoại quyết định cần trượt lên ở đáy sân giữa hay không?
  const showHumanDecisionCard =
    isHumanActing &&
    (displayState.phase === 'BUY_OR_SKIP_DECISION' ||
      displayState.phase === 'UPGRADE_OWN_PROPERTY' ||
      displayState.phase === 'AUCTION_DECISION' ||
      displayState.phase === 'IN_JAIL_DECISION' ||
      displayState.phase === 'ASK_JAIL_BAIL' ||
      displayState.phase === 'DEBT_LIQUIDATION');

  const diceValuesToShow = liveDice?.values ?? displayState.lastDiceValues;
  const diceSum = diceValuesToShow.reduce((a, b) => a + b, 0);
  // Ẩn xúc xắc & 2 chồng bài khi đang diễn hoạt đưa/nhận tiền hoặc khi máy bay khổng lồ cất cánh
  const isStageShowcase = Boolean(transferStage || airportFlight);
  // Chỉ hiện Ngân Hàng (hoặc Chủ Đất nhận tiền) khi thực sự có giao dịch tiền; lúc bình thường ẩn đi cho sân thoáng đẹp
  const showRightStage = Boolean(transferStage || bankPulse || lastBankNote);

  return (
    <div
      className={`relative h-full w-full overflow-hidden p-1.5 select-none text-white ${
        isBoardShaking ? 'animate-board-shake' : ''
      }`}
      style={{
        background: 'linear-gradient(145deg, #271C16 0%, #111827 48%, #1F1612 100%)',
      }}
    >
      {/* LƯỚI BÀN CỜ CHỮ NHẬT 17×11: Ô TRÊN/DƯỚI CHỮ NHẬT ĐỨNG CAO (~70×98px) · Ô TRÁI/PHẢI CHỮ NHẬT NGANG RỘNG (~138×46px) */}
      <div
        className="grid h-full w-full min-h-0 min-w-0 gap-[3px] rounded-xl border-2 border-[#C89B54]/85 p-[3px] shadow-[inset_0_0_24px_rgba(0,0,0,0.75)]"
        style={{
          gridTemplateColumns: '2.05fr repeat(15, minmax(0, 1fr)) 2.05fr',
          gridTemplateRows: '2.12fr repeat(9, minmax(0, 1fr)) 2.12fr',
        }}
      >
        {/* 52 Ô Đất & Sự Kiện chạy dọc 4 cạnh bàn cờ 17×11 */}
        {displayState.tiles.map((tile) => (
          <BoardTileCell
            key={tile.index}
            tile={tile}
            allTiles={displayState.tiles}
            players={displayState.players}
            isFlashing={flashingTileIdx === tile.index}
            isNewlyBuilt={newlyBuiltTileIdx === tile.index}
            onSelect={(idx) => setInspectTileIdx(idx)}
            registerTileRef={registerTileRef(tile.index)}
          />
        ))}

        {/* SÂN GIỮA MỞ RỘNG (15×9 Ô GIỮA BÀN CỜ — CHẠM TRỰC TIẾP ĐỂ TUNG XÚC XẮC) */}
        <div
          data-testid="center-roll-surface"
          aria-label={canHumanTapRoll ? 'Chạm sân giữa để tung xúc xắc' : 'Sân giữa bàn cờ'}
          onPointerDown={handleCenterPointerDown}
          onPointerUp={handleCenterPointerUp}
          onPointerLeave={cancelCharging}
          onPointerCancel={cancelCharging}
          style={{
            gridColumn: '2 / 17',
            gridRow: '2 / 11',
            background:
              'radial-gradient(ellipse at 50% 44%, #1A7BA8 0%, #125A80 54%, #0A3A57 86%, #07263B 100%)',
          }}
          className={`relative flex min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-lg border-2 border-[#EAB308]/60 p-2 shadow-[inset_0_0_48px_rgba(3,18,32,0.55)] ${
            canHumanTapRoll ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          {/* Khung viền chỉ đôi cổ điển vàng đồng bên trong sân giữa */}
          <div className="pointer-events-none absolute inset-1.5 rounded-md border border-[#FDE68A]/25" />

          {/* Bản đồ chữ S Việt Nam cổ điển + Trống Đồng Đông Sơn + La bàn hải đồ */}
          <VietnamMapArt />

          {/* SÂN KHẤU WEBGL 3D PHỦ TRỌN TOÀN BỘ SÂN GIỮA — TỰ ĐỘNG ẨN SẠCH KHI ĐANG ĐƯA TIỀN HOẶC BAY MÁY BAY */}
          <div
            ref={diceCanvasRef}
            className={`pointer-events-none absolute inset-0 z-[16] h-full w-full transition-all duration-300 ${
              isStageShowcase ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
            }`}
          />

          {/* HÀNG TRÊN SÂN GIỮA: 5 nút tiện ích (Trái) + Huy hiệu ván chơi (Giữa) + Bảng Tỷ Phú gọn góc phải trên */}
          <div className="relative z-20 flex shrink-0 items-start justify-between gap-2">
            <div data-no-roll="true" className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onBackToLobby}
                title="Quay lại Phòng chờ"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FDE68A]/55 bg-slate-950/70 text-amber-100 shadow-md backdrop-blur-xs transition hover:bg-slate-900 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Phòng chờ</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FDE68A]/55 bg-slate-950/70 text-amber-100 shadow-md backdrop-blur-xs transition hover:bg-slate-900 cursor-pointer"
              >
                {muted ? <VolumeX className="h-4 w-4 text-rose-300" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setShowDrawer(true)}
                title="Nhật ký & Tiến độ 3 Điều kiện Thắng"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FDE68A]/55 bg-slate-950/70 text-amber-100 shadow-md backdrop-blur-xs transition hover:bg-slate-900 cursor-pointer"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowRules(true)}
                title="Luật chơi 52 ô"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FDE68A]/55 bg-slate-950/70 text-amber-100 shadow-md backdrop-blur-xs transition hover:bg-slate-900 cursor-pointer"
              >
                <BookOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình ngang'}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FDE68A]/55 bg-slate-950/70 text-amber-100 shadow-md backdrop-blur-xs transition hover:bg-slate-900 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4 text-emerald-300" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>

            {/* Huy hiệu tên game & số lượt */}
            <div
              ref={mobileBankAnchorRef}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#EAB308]/65 bg-gradient-to-b from-slate-900/85 to-slate-950/90 px-3.5 py-1 text-[11px] font-black tracking-wide text-amber-200 shadow-lg backdrop-blur-xs"
            >
              <span>CỜ TỶ PHÚ VIỆT NAM</span>
              <span className="rounded-full border border-amber-300/35 bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">
                Lượt {displayState.turnCount}
              </span>
            </div>

            {/* GÓC TRÊN PHẢI: BẢNG TỶ PHÚ 2 CỘT SIÊU GỌN VIỀN ĐỒNG (LUÔN HIỂN THỊ CHUẨN TRÊN CẢ PC & ĐIỆN THOẠI NGANG) */}
            <div
              data-no-roll="true"
              className="block w-[294px] shrink-0 rounded-xl border border-[#EAB308]/55 bg-slate-950/68 p-1 shadow-[0_8px_22px_rgba(0,0,0,0.48)] backdrop-blur-xs"
            >
              <div className="mb-1 flex items-center justify-between border-b border-white/10 px-1 pb-0.5 text-[8.5px] font-black uppercase tracking-[0.14em] text-amber-300/95">
                <span>BẢNG TỶ PHÚ</span>
                <span className="text-sky-200/80">
                  {displayState.players.filter((x) => !x.isBankrupt).length} tụ
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {displayState.players.map((p) => {
                  const isTurn = p.id === currentPlayer.id && displayState.phase !== 'GAME_OVER';
                  const pChar =
                    CO_TY_PHU_CHARACTERS.find((c) => c.id === p.characterId) ?? CO_TY_PHU_CHARACTERS[0];
                  const landCount = displayState.tiles.filter(
                    (t) => t.ownerId === p.id || t.auctionState?.finalOwnerId === p.id,
                  ).length;
                  const houseCount = displayState.tiles.reduce(
                    (sum, t) => sum + (t.ownerId === p.id ? t.buildingLevel : 0),
                    0,
                  );
                  const flashState = rowFlash[p.id];

                  return (
                    <div
                      key={p.id}
                      ref={(el) => {
                        if (el && el.offsetParent !== null) {
                          playerRowRefs.current[p.id] = el;
                        }
                      }}
                      className={`relative flex items-center gap-1 overflow-hidden rounded-lg border px-1.5 py-0.5 shadow-sm transition duration-300 ${
                        p.isBankrupt
                          ? 'border-white/10 bg-slate-950/40 opacity-45 grayscale'
                          : flashState === 'gain'
                            ? 'border-emerald-300 bg-emerald-950/85 ring-1 ring-emerald-400/85'
                            : flashState === 'loss'
                              ? 'border-rose-300 bg-rose-950/80 ring-1 ring-rose-400/80'
                              : isTurn
                                ? 'border-[#FDE68A] bg-slate-900/92 ring-1 ring-amber-300/65'
                                : 'border-white/12 bg-slate-950/55'
                      }`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-[3px]"
                        style={{ backgroundColor: p.landHex }}
                      />
                      <div
                        style={{ backgroundColor: p.landHex }}
                        className="relative ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/80 shadow"
                      >
                        <img src={pChar.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                        <span className="absolute -bottom-0.5 -right-0.5 rounded-tl bg-slate-950/85 p-[0.5px]">
                          {p.isBot ? (
                            <Bot className="h-2 w-2 text-amber-300" />
                          ) : (
                            <User className="h-2 w-2 text-emerald-300" />
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="flex items-center justify-between gap-0.5">
                          <span className="truncate text-[9px] font-extrabold text-white">
                            {isTurn ? '▶ ' : ''}
                            {p.name}
                          </span>
                          <span className="shrink-0 text-[9.5px] font-black text-amber-300">
                            <AnimatedCashValue value={p.cash} />
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[8px] text-sky-200/85">
                          <span>{landCount} đất</span>
                          {houseCount > 0 && <span className="text-amber-200">· {houseCount} nhà</span>}
                          {p.inJail && (
                            <span className="inline-flex items-center text-rose-300" title="Đang ở tù">
                              <Lock className="h-2 w-2" />
                            </span>
                          )}
                          {p.getOutOfJailCards > 0 && (
                            <span className="inline-flex items-center text-emerald-300" title="Thẻ miễn tù">
                              <ShieldCheck className="h-2 w-2" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KHU VỰC GIỮA CÂN XỨNG KHÔNG VIỀN: Nhân Vật to nổi bật · CƠ HỘI / KHÍ VẬN thoáng xa bản đồ · Tự ẩn Ngân Hàng khi rảnh */}
          <div className="relative z-15 flex min-h-0 flex-1 flex-row items-center justify-between gap-2 px-4 py-0.5">
            {/* TRÁI: Nhân Vật đứng thoáng cao & to rõ trực tiếp trên nền sân giữa (BỎ VIỀN, BỎ HỘP) */}
            <div
              ref={leftCharacterAnchorRef}
              data-no-roll="true"
              data-testid="left-character-stage"
              className={`relative -mt-3 flex w-[158px] shrink-0 flex-col items-center justify-center px-1 transition-all duration-300 ${
                transferStage ? 'translate-x-14' : 'translate-x-0'
              }`}
            >
              <div
                style={{ backgroundColor: leftStagePlayer.landHex }}
                className="mb-0.5 rounded-full border border-white/75 px-3.5 py-0.5 text-[11px] font-black text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)]"
              >
                {leftStagePlayer.name}
              </div>
              <div className="relative flex items-center justify-center">
                <div
                  className="pointer-events-none absolute h-28 w-28 rounded-full blur-2xl opacity-55"
                  style={{ backgroundColor: leftStagePlayer.landHex }}
                />
                <img
                  src={leftStageChar.standeeUrl}
                  alt={leftStageChar.name}
                  className={`relative h-[152px] w-auto object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.72)] transition-transform duration-300 ${
                    pawnReactions[leftStagePlayer.id] === 'celebrate'
                      ? 'animate-pawn-celebrate'
                      : pawnReactions[leftStagePlayer.id] === 'give'
                        ? 'animate-pawn-give'
                        : pawnReactions[leftStagePlayer.id] === 'hurt'
                          ? 'animate-pawn-hurt'
                          : ''
                  }`}
                />
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
                <AnimatedCashValue key={leftStagePlayer.id} value={leftStagePlayer.cash} />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-100/90 drop-shadow">
                <span>{leftOwnedCount} đất</span>
                <span>·</span>
                <span>{leftHouseCount} nhà</span>
                {leftStagePlayer.inJail && (
                  <span className="rounded bg-rose-600/80 px-1 py-0.5 text-[8.5px] text-white">⛓Tù</span>
                )}
              </div>
            </div>

            {/* GIỮA: 2 Chồng Bài Cơ Hội / Khí Vận TO RÕ & TÁCH XA BẢN ĐỒ + XÚC XẮC (ẨN SẠCH khi đưa/nhận tiền hoặc bay máy bay!) */}
            <div
              className={`pointer-events-none relative flex min-h-0 flex-1 flex-col items-center justify-center transition-all duration-300 ${
                isStageShowcase ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
              }`}
            >
              <div className="relative mt-9 flex items-center justify-center gap-[366px]">
                {/* Chồng bài Cơ Hội (?) lớn nổi bật, đứng thoáng xa bản đồ & xúc xắc */}
                <div
                  ref={chanceDeckRef}
                  data-testid="chance-deck"
                  className="relative flex h-[126px] w-[96px] -rotate-6 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-200/95 text-center"
                  style={{
                    background: 'radial-gradient(circle at 35% 25%, #FDE047 0%, #D97706 52%, #78350F 100%)',
                    boxShadow: '-4px 6px 0 #78350F, -8px 12px 24px rgba(0,0,0,0.52)',
                  }}
                >
                  <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-amber-100/55" />
                  <ChanceSymbolSvg className="relative h-12 w-12 drop-shadow" />
                  <span className="relative mt-1 rounded-full bg-amber-950/65 px-2 py-[2px] text-[10px] font-black tracking-wider text-amber-100">
                    CƠ HỘI
                  </span>
                  <span className="absolute right-1.5 top-1.5 rounded-full border border-amber-200/90 bg-slate-950/90 px-1.5 py-[1px] text-[9.5px] font-black text-amber-300">
                    {displayState.chanceDeck.length}
                  </span>
                </div>

                {/* Vòng sóng mời chạm + Vòng tròn nạp lực nằm đúng tâm sân xúc xắc */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {canHumanTapRoll && !isChargingHold && (
                    <div className="animate-tap-ring h-44 w-44 rounded-full border-2 border-amber-300/60" />
                  )}

                  {isChargingHold && (
                    <svg
                      viewBox="0 0 120 120"
                      className="h-52 w-52 -rotate-90 drop-shadow-[0_0_12px_rgba(251,191,36,0.75)]"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke={chargeLevel > 0.72 ? '#F59E0B' : '#38BDF8'}
                        strokeWidth="6.5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - chargeLevel)}
                      />
                    </svg>
                  )}
                </div>

                {/* Chồng bài Khí Vận (!) lớn nổi bật, đứng thoáng xa bản đồ & xúc xắc */}
                <div
                  ref={fateDeckRef}
                  data-testid="fate-deck"
                  className="relative flex h-[126px] w-[96px] rotate-6 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-purple-200/90 text-center"
                  style={{
                    background: 'radial-gradient(circle at 65% 25%, #C084FC 0%, #6D28D9 52%, #2E1065 100%)',
                    boxShadow: '4px 6px 0 #2E1065, 8px 12px 24px rgba(0,0,0,0.52)',
                  }}
                >
                  <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-purple-200/50" />
                  <FateSymbolSvg className="relative h-12 w-12 drop-shadow" />
                  <span className="relative mt-1 rounded-full bg-purple-950/70 px-2 py-[2px] text-[10px] font-black tracking-wider text-purple-100">
                    KHÍ VẬN
                  </span>
                  <span className="absolute right-1.5 top-1.5 rounded-full border border-purple-200/90 bg-slate-950/90 px-1.5 py-[1px] text-[9.5px] font-black text-purple-200">
                    {displayState.fateDeck.length}
                  </span>
                </div>
              </div>

              {/* Bảng Thông Báo Số Điểm Xúc Xắc Nổi Bật (hiện rõ ~0.85s trước khi nhân vật nhảy di chuyển) */}
              <div className="relative z-20 mt-9 flex flex-col items-center">
                {isChargingHold ? (
                  <div className="rounded-full border border-amber-300/90 bg-slate-950/92 px-3.5 py-1 text-[11px] font-black text-amber-300 shadow-xl">
                    ⚡ ĐANG LẮC NẠP LỰC {Math.round(chargeLevel * 100)}% — THẢ TAY ĐỂ NÉM!
                  </div>
                ) : liveDice ? (
                  <div
                    key={`${liveDice.values.join('-')}-${displayState.turnCount}`}
                    data-testid="dice-score-callout"
                    className={`animate-dice-score-pop rounded-full border-2 px-5 py-1.5 text-sm font-black tracking-wide shadow-[0_8px_26px_rgba(0,0,0,0.65)] ${
                      liveDice.isDouble
                        ? 'border-yellow-200 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950'
                        : 'border-amber-300/90 bg-gradient-to-r from-slate-950/95 via-sky-950/95 to-slate-950/95 text-amber-200'
                    }`}
                  >
                    {liveDice.isDouble
                      ? `⚡ ĐỔ ĐÔI ${liveDice.values.join(' + ')} = ${diceSum} ĐIỂM · ĐI THÊM LƯỢT!`
                      : `🎲 QUAY ĐƯỢC ${diceSum} ĐIỂM! (${liveDice.values.join(' + ')})`}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FDE68A]/35 bg-slate-950/75 px-3 py-0.5 text-[11px] font-black text-amber-100 shadow backdrop-blur-xs">
                    <Dices className="h-3.5 w-3.5 text-amber-300" />
                    <span>
                      {diceValuesToShow.join(' + ')} ({diceSum})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* PHẢI: Tòa Nhà Ngân Hàng KHÔNG VIỀN — ẨN GỌN KHI KHÔNG CÓ GIAO DỊCH, TỰ HIỆN KHI TRAO TIỀN! */}
            <div
              ref={bankAnchorRef}
              data-no-roll="true"
              data-testid="bank-building-card"
              className={`relative -mt-3 flex w-[158px] shrink-0 flex-col items-center justify-center px-1 transition-all duration-300 ${
                showRightStage
                  ? 'opacity-100 scale-100 pointer-events-auto'
                  : 'opacity-0 scale-90 pointer-events-none'
              } ${
                transferStage ? '-translate-x-14' : 'translate-x-0'
              } ${
                !rightCreditorPlayer && bankPulse?.kind === 'in'
                  ? 'animate-bank-in'
                  : !rightCreditorPlayer && bankPulse?.kind === 'out'
                    ? 'animate-bank-out'
                    : ''
              }`}
            >
              {rightCreditorPlayer && rightCreditorChar ? (
                <>
                  <div
                    style={{ backgroundColor: rightCreditorPlayer.landHex }}
                    className="mb-0.5 rounded-full border border-white/80 px-3.5 py-0.5 text-[11px] font-black text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)]"
                  >
                    {rightCreditorPlayer.name} · Nhận tiền
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div
                      className="pointer-events-none absolute h-28 w-28 rounded-full blur-2xl opacity-60"
                      style={{ backgroundColor: rightCreditorPlayer.landHex }}
                    />
                    <img
                      src={rightCreditorChar.standeeUrl}
                      alt={rightCreditorChar.name}
                      className={`relative h-[152px] w-auto object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.72)] ${
                        pawnReactions[rightCreditorPlayer.id] === 'celebrate'
                          ? 'animate-pawn-celebrate'
                          : ''
                      }`}
                    />
                  </div>
                  <div className="mt-0.5 text-2xl font-black tracking-tight text-emerald-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
                    <AnimatedCashValue key={rightCreditorPlayer.id} value={rightCreditorPlayer.cash} />
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-1 text-xs font-black uppercase tracking-[0.12em] text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    NGÂN HÀNG
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`pointer-events-none absolute h-24 w-32 rounded-full blur-2xl transition-opacity ${
                        bankPulse?.kind === 'out'
                          ? 'bg-emerald-400/60 opacity-100'
                          : bankPulse?.kind === 'in'
                            ? 'bg-amber-300/70 opacity-100'
                            : 'bg-amber-300/20 opacity-65'
                      }`}
                    />
                    <CentralBankBuildingSvg
                      className="relative h-[126px] w-[178px] drop-shadow-[0_14px_18px_rgba(0,0,0,0.65)]"
                      pulseKind={bankPulse?.kind ?? null}
                    />
                  </div>
                  <div
                    className={`mt-1 text-base font-black tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${
                      lastBankNote?.tone === 'in'
                        ? 'text-amber-300'
                        : lastBankNote?.tone === 'out'
                          ? 'text-emerald-300'
                          : 'text-white/95'
                    }`}
                  >
                    {lastBankNote
                      ? lastBankNote.tone === 'in'
                        ? `↗ ${lastBankNote.text}`
                        : `↙ ${lastBankNote.text}`
                      : 'Kho Bạc TW'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* KHU VỰC ĐÁY SÂN GIỮA (BẢNG THÔNG BÁO / QUYẾT ĐỊNH FULL NGANG CAO THOÁNG RÕ NÉT) */}
          <div className="relative z-20 flex min-h-[38px] shrink-0 items-end justify-center pt-1">
            {/* 1. Chờ người chơi chạm sân giữa để tung xúc xắc */}
            {canHumanTapRoll && displayState.phase === 'WAIT_ROLL' && (
              <div className="pointer-events-none flex items-center gap-2 rounded-full border border-[#FDE68A]/65 bg-slate-950/80 px-5 py-1.5 text-xs font-bold text-amber-100 shadow-lg backdrop-blur-xs sm:text-sm">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>
                  Lượt <strong className="text-amber-300">{currentPlayer.name}</strong> —{' '}
                  <strong className="text-emerald-300">Chạm sân giữa</strong> để tung ngay ·{' '}
                  <strong className="text-sky-300">Nhấn giữ</strong> để nạp lực (hoặc{' '}
                  <kbd className="rounded bg-white/15 px-1.5 py-0.5 text-[11px]">Phím Cách</kbd>)
                </span>
              </div>
            )}

            {/* 2. Trạng thái Bot đang suy nghĩ hoặc đang diễn hoạt */}
            {!showHumanDecisionCard && !(canHumanTapRoll && displayState.phase === 'WAIT_ROLL') && (
              <div
                className={`pointer-events-none inline-flex items-center gap-2 rounded-full border px-5 py-1.5 text-xs font-bold shadow-lg backdrop-blur-xs sm:text-sm ${
                  botThought?.tone === 'accept'
                    ? 'border-emerald-300/70 bg-emerald-950/85 text-emerald-200'
                    : botThought?.tone === 'reject'
                      ? 'border-rose-300/60 bg-rose-950/80 text-rose-200'
                      : 'border-white/25 bg-slate-950/80 text-sky-100'
                }`}
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>
                  {botThought
                    ? botThought.text
                    : isAnimating
                      ? 'Đang diễn hoạt nước đi...'
                      : `Lượt của ${currentPlayer.name}`}
                </span>
              </div>
            )}

            {/* 3. Bảng Quyết Định Gọn Đẹp Full Ngang (BỎ dải chữ Nhóm / Thuê đất trắng · Nút Có / Không sạch gọn) */}
            {showHumanDecisionCard && (() => {
              const tileGroup = activeTile?.colorGroup ? COLOR_GROUPS[activeTile.colorGroup] : null;
              const accentHex =
                tileGroup?.hex ??
                (activeTile?.kind === 'AUCTION_STATION'
                  ? '#334155'
                  : activeTile?.kind === 'UTILITY'
                    ? '#0F766E'
                    : displayState.phase === 'IN_JAIL_DECISION' || displayState.phase === 'ASK_JAIL_BAIL'
                      ? '#991B1B'
                      : '#EAB308');

              return (
                <div
                  data-no-roll="true"
                  className="animate-decision-up w-full overflow-hidden rounded-xl border-2 border-[#EAB308]/85 bg-[#0F172A]/95 shadow-[0_14px_38px_rgba(0,0,0,0.85)] backdrop-blur-md"
                >
                  {/* Viền màu nhận diện siêu mảnh (không chứa chữ rườm rà) */}
                  <div className="h-[3.5px] w-full" style={{ backgroundColor: accentHex }} />

                  <div className="px-4 py-3.5 sm:px-6 sm:py-4">
                    {/* ĐANG Ở TÙ */}
                    {displayState.phase === 'IN_JAIL_DECISION' && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-bold text-rose-100 sm:text-base">
                          ⛓ {currentPlayer.name} đang ở Trại Giam ({currentPlayer.jailTurnsUsed}/3 lượt) — Chạm sân giữa để tung thoát tù:
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          {currentPlayer.getOutOfJailCards > 0 && (
                            <button
                              type="button"
                              onClick={() => void dispatchAction({ type: 'USE_JAIL_FREE_CARD' })}
                              className="uiverse-push-btn uiverse-dome-shine rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-amber-950 cursor-pointer"
                            >
                              Dùng Thẻ Miễn Tù
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => triggerRollWithPower(0.62)}
                            className="uiverse-push-btn uiverse-dome-shine rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950 cursor-pointer"
                          >
                            {displayState.diceCount === 2 ? '🎲 Tung Đôi Ra Tù' : '🎲 Tung Mặt 6 Ra Tù'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* HỎI TRẢ BẢO LÃNH 1 TR */}
                    {displayState.phase === 'ASK_JAIL_BAIL' && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-bold text-amber-100 sm:text-base">
                          Tung chưa thoát tù! Nộp <strong className="text-amber-300">{formatShortVnd(JAIL_BAIL_FEE)}</strong> bảo lãnh ra ngay?
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void dispatchAction({ type: 'ANSWER_JAIL_BAIL', pay: false })}
                            className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-white cursor-pointer sm:text-base"
                            style={{ background: 'linear-gradient(180deg, #F43F5E 0%, #BE123C 100%)', boxShadow: '0 3px 0 #881337' }}
                          >
                            Không
                          </button>
                          <button
                            type="button"
                            disabled={currentPlayer.cash < JAIL_BAIL_FEE}
                            onClick={() => void dispatchAction({ type: 'ANSWER_JAIL_BAIL', pay: true })}
                            className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-slate-950 disabled:opacity-45 cursor-pointer sm:text-base"
                            style={{ background: 'linear-gradient(180deg, #34D399 0%, #059669 100%)', boxShadow: '0 3px 0 #064E3B' }}
                          >
                            Có
                          </button>
                        </div>
                      </div>
                    )}

                    {/* MUA ĐẤT / NHÀ MÁY */}
                    {displayState.phase === 'BUY_OR_SKIP_DECISION' && activeTile && (() => {
                      const offerLandmarkUrl = getLandmarkArtworkUrl(activeTile.name);
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3.5">
                            {offerLandmarkUrl && (
                              <img
                                src={offerLandmarkUrl}
                                alt={activeTile.name}
                                className="block h-14 w-24 shrink-0 rounded-xl border border-amber-200/80 object-cover shadow-md"
                              />
                            )}
                            <div className="text-sm font-bold text-white sm:text-base">
                              Bạn có muốn mua <strong className="text-cyan-300">{activeTile.name}</strong> với giá{' '}
                              <strong className="text-amber-300">{formatVnd(activeTile.basePrice ?? 0)}</strong>?
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void dispatchAction({ type: 'BUY_PROPERTY', buy: false })}
                              className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-white cursor-pointer sm:text-base"
                              style={{ background: 'linear-gradient(180deg, #F43F5E 0%, #BE123C 100%)', boxShadow: '0 3px 0 #881337' }}
                            >
                              Không
                            </button>
                            <button
                              type="button"
                              disabled={currentPlayer.cash < (activeTile.basePrice ?? 0)}
                              onClick={() => void dispatchAction({ type: 'BUY_PROPERTY', buy: true })}
                              className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-slate-950 disabled:opacity-45 cursor-pointer sm:text-base"
                              style={{ background: 'linear-gradient(180deg, #34D399 0%, #059669 100%)', boxShadow: '0 3px 0 #064E3B' }}
                            >
                              Có
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* XÂY NHÀ / NÂNG CẤP BIỆT THỰ */}
                    {displayState.phase === 'UPGRADE_OWN_PROPERTY' && activeTile && (() => {
                      const upgradeLandmarkUrl =
                        activeTile.kind === 'PROPERTY' ? getLandmarkArtworkUrl(activeTile.name) : undefined;
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3.5">
                            {upgradeLandmarkUrl && (
                              <img
                                src={upgradeLandmarkUrl}
                                alt={activeTile.name}
                                className="block h-14 w-24 shrink-0 rounded-xl border border-amber-200/80 object-cover shadow-md"
                              />
                            )}
                            <div className="text-sm font-bold text-white sm:text-base">
                              Nâng cấp <strong className="text-cyan-300">{activeTile.name}</strong> lên{' '}
                              <strong className="text-amber-300">
                                {activeTile.buildingLevel === 4 ? 'BIỆT THỰ ★' : `Nhà Cấp ${activeTile.buildingLevel + 1}`}
                              </strong>{' '}
                              giá <strong>{formatShortVnd(getUpgradeCost(activeTile))}</strong>?
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void dispatchAction({ type: 'UPGRADE_PROPERTY', upgrade: false })}
                              className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-white cursor-pointer sm:text-base"
                              style={{ background: 'linear-gradient(180deg, #F43F5E 0%, #BE123C 100%)', boxShadow: '0 3px 0 #881337' }}
                            >
                              Không
                            </button>
                            <button
                              type="button"
                              disabled={currentPlayer.cash < getUpgradeCost(activeTile)}
                              onClick={() => void dispatchAction({ type: 'UPGRADE_PROPERTY', upgrade: true })}
                              className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-amber-950 disabled:opacity-45 cursor-pointer sm:text-base"
                              style={{ background: 'linear-gradient(180deg, #FEF08A 0%, #F59E0B 100%)', boxShadow: '0 3px 0 #92400E' }}
                            >
                              Có
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ĐẤU GIÁ BẾN XE */}
                    {displayState.phase === 'AUCTION_DECISION' &&
                      activeTile &&
                      (() => {
                        const { nextBid, deltaNeeded } = getAuctionBidDelta(activeTile, currentPlayer.id);
                        const isUnopened = activeTile.auctionState?.status === 'UNOPENED';
                        const stationImgUrl = getLandmarkArtworkUrl(activeTile.name);
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3.5">
                              {stationImgUrl && (
                                <img
                                  src={stationImgUrl}
                                  alt={activeTile.name}
                                  className="block h-14 w-24 shrink-0 rounded-xl border border-amber-200/80 object-cover shadow-md"
                                />
                              )}
                              <div className="text-sm font-bold text-amber-100 sm:text-base">
                                <Gavel className="mr-1.5 inline h-4 w-4 text-amber-300" />
                                {isUnopened ? (
                                  <>
                                    Mở đấu giá <strong className="text-amber-300">{activeTile.name}</strong> mức{' '}
                                    <strong>{formatShortVnd(nextBid)}</strong>?
                                  </>
                                ) : (
                                  <>
                                    Đấu giá <strong className="text-amber-300">{activeTile.name}</strong> mức{' '}
                                    <strong>{formatShortVnd(nextBid)}</strong> (bù {formatShortVnd(deltaNeeded)})?
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => void dispatchAction({ type: 'AUCTION_DECIDE', bid: false })}
                                className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-white cursor-pointer sm:text-base"
                                style={{ background: 'linear-gradient(180deg, #F43F5E 0%, #BE123C 100%)', boxShadow: '0 3px 0 #881337' }}
                              >
                                Không
                              </button>
                              <button
                                type="button"
                                disabled={currentPlayer.cash < deltaNeeded}
                                onClick={() => void dispatchAction({ type: 'AUCTION_DECIDE', bid: true })}
                                className="uiverse-push-btn uiverse-dome-shine min-w-[116px] rounded-full px-7 py-2.5 text-sm font-black text-amber-950 disabled:opacity-45 cursor-pointer sm:text-base"
                                style={{ background: 'linear-gradient(180deg, #FEF08A 0%, #F59E0B 100%)', boxShadow: '0 3px 0 #92400E' }}
                              >
                                Có
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                {/* THANH LÝ NỢ / PHÁ SẢN */}
                {displayState.phase === 'DEBT_LIQUIDATION' &&
                  displayState.debtQueue[0] &&
                  (() => {
                    const debt = displayState.debtQueue[0];
                    const canRecover =
                      activeDebtor.cash + getTotalLiquidatableValue(displayState.tiles, activeDebtor.id) >=
                      debt.amount;
                    const sellableTiles = displayState.tiles.filter(
                      (t) =>
                        t.ownerId === activeDebtor.id ||
                        (t.kind === 'AUCTION_STATION' &&
                          t.auctionState?.status === 'CLOSED' &&
                          t.auctionState.finalOwnerId === activeDebtor.id),
                    );

                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-rose-200">
                          <span>
                            ⚠️ {activeDebtor.name} cần {formatShortVnd(debt.amount)} ({debt.reason}) · Hiện có{' '}
                            {formatShortVnd(activeDebtor.cash)}
                          </span>
                          {!canRecover && (
                            <button
                              type="button"
                              onClick={() => void dispatchAction({ type: 'DECLARE_BANKRUPTCY' })}
                              className="uiverse-push-btn inline-flex items-center gap-1 rounded-full bg-rose-600 px-3.5 py-1 text-xs font-black text-white cursor-pointer"
                            >
                              <Skull className="h-3.5 w-3.5" />
                              Xác nhận Phá sản
                            </button>
                          )}
                        </div>
                        {sellableTiles.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                            {sellableTiles.map((t) => {
                              const sellBuilding = t.kind === 'PROPERTY' && t.buildingLevel > 0;
                              const refund = sellBuilding
                                ? getSellBuildingValue(t)
                                : getSellPropertyValue(t);
                              return (
                                <button
                                  key={t.index}
                                  type="button"
                                  onClick={() =>
                                    void dispatchAction({
                                      type: sellBuilding ? 'SELL_BUILDING' : 'SELL_PROPERTY',
                                      tileIndex: t.index,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-100 hover:bg-amber-500/35 cursor-pointer"
                                >
                                  <Home className="h-3 w-3 text-amber-300" />
                                  {sellBuilding ? `Bán 1 nhà ${shortTileTitle(t.name)}` : `Bán ${shortTileTitle(t.name)}`} (+
                                  {formatShortVnd(refund)})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* LỚP MÔ HÌNH STANDEE CHIBI 2.5D TOÀN THÂN ĐỨNG TRÊN ĐẾ CỜ 3D */}
      <div className="pointer-events-none absolute inset-0 z-25">
        {displayState.players.map((p) => {
          if (p.isBankrupt) return null;
          const charInfo =
            CO_TY_PHU_CHARACTERS.find((c) => c.id === p.characterId) ?? CO_TY_PHU_CHARACTERS[0];
          const isTurn = p.id === currentPlayer.id && displayState.phase !== 'GAME_OVER';
          const isMoving = activePawnAnim?.playerId === p.id;
          const standingTile = displayState.tiles[p.position];
          const isSideStanding = !isMoving && (standingTile?.edge === 1 || standingTile?.edge === 3);

          let x = 0;
          let y = 0;
          let liftY = 0;
          let scaleX = 1;
          let scaleY = 1;
          let tiltDeg = 0;

          if (isMoving && activePawnAnim) {
            x = activePawnAnim.x;
            y = activePawnAnim.y;
            liftY = activePawnAnim.liftY;
            scaleX = activePawnAnim.scaleX;
            scaleY = activePawnAnim.scaleY;
            tiltDeg = activePawnAnim.tiltDeg;
          } else {
            const rect = tileRects[p.position];
            if (!rect) return null;
            const tile = standingTile;
            const group = pawnsByTile.get(p.position) ?? [p];
            const slotIdx = Math.max(0, group.findIndex((item) => item.id === p.id));
            const count = group.length;

            if (tile?.edge === 1 || tile?.edge === 3) {
              // Ô NGANG (Cạnh Trái / Phải): đứng gọn vào khoang bên trong (cạnh dải chủ sở hữu), KHÔNG che chữ và KHÔNG tràn ô dưới
              const sideDir = tile.edge === 1 ? 1 : -1;
              const multiShiftX = count <= 1 ? 0 : (slotIdx - (count - 1) / 2) * 14;
              x = rect.x + sideDir * rect.w * 0.25 + multiShiftX;
              y = rect.y + rect.h * 0.04;
            } else {
              // Ô ĐỨNG (Cạnh Dưới / Trên) & 4 Ô Góc: hạ nhẹ xuống phần dưới ô để lộ rõ tên địa danh phía trên
              const innerNudgeY = tile?.edge === null ? rect.h * 0.1 : rect.h * 0.2;
              const spread = count <= 1 ? 0 : count === 2 ? 11 : 13;
              const angle = (slotIdx / Math.max(1, count)) * Math.PI * 2 + 0.35;
              x = rect.x + Math.cos(angle) * spread;
              y = rect.y + innerNudgeY + Math.sin(angle) * (spread * 0.45);
            }
          }

          return (
            <div
              key={p.id}
              style={{
                left: x,
                top: y,
                zIndex: isMoving ? 45 : isTurn ? 35 : 28,
                transform: `translate(-50%, ${isSideStanding ? '-52%' : '-56%'}) translateY(${liftY}px) rotate(${tiltDeg}deg) scale(${scaleX}, ${scaleY})`,
              }}
              className="absolute flex flex-col items-center"
            >
              {/* Hào quang lượt dưới đế cờ */}
              {isTurn && (
                <div
                  style={{ borderColor: p.landHex }}
                  className={`pointer-events-none absolute -bottom-1 animate-ping rounded-full border-2 opacity-75 ${
                    isSideStanding ? 'h-3 w-6' : 'h-4 w-8'
                  }`}
                />
              )}

              {/* Nhân vật Standee Chibi toàn thân đứng nổi 2.5D + biểu cảm đưa/nhận tiền */}
              <img
                src={charInfo.standeeUrl}
                alt={p.name}
                className={`relative z-10 w-auto object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,0.72)] ${
                  isSideStanding ? 'h-7' : 'h-10'
                } ${
                  pawnReactions[p.id] === 'give'
                    ? 'animate-pawn-give'
                    : pawnReactions[p.id] === 'celebrate'
                      ? 'animate-pawn-celebrate'
                      : pawnReactions[p.id] === 'hurt'
                        ? 'animate-pawn-hurt'
                        : !isMoving
                          ? 'animate-standee-idle'
                          : ''
                }`}
              />

              {/* Đế cờ 3D phủ màu chủ sở hữu + bóng đổ tiếp xúc */}
              <div
                style={{
                  background: `linear-gradient(180deg, ${p.landHex} 0%, #0F172A 135%)`,
                  boxShadow: isTurn
                    ? `0 4px 10px rgba(0,0,0,0.8), 0 0 0 2px #FEF08A`
                    : `0 3px 8px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(255,255,255,0.85)`,
                }}
                className={`flex items-center justify-center rounded-full ${
                  isSideStanding ? '-mt-1.5 h-2.5 w-6' : '-mt-2 h-3.5 w-8'
                }`}
              >
                <span className={`rounded-full bg-white/35 ${isSideStanding ? 'h-1 w-3.5' : 'h-1.5 w-5'}`} />
              </div>

              {/* Nhãn tên siêu gọn cho người đang tới lượt */}
              {isTurn && (
                <span
                  style={{ backgroundColor: p.landHex }}
                  className={`mt-0.5 rounded-full border border-white/80 font-black leading-tight text-white shadow ${
                    isSideStanding ? 'px-1 text-[7px]' : 'px-1.5 text-[8px]'
                  }`}
                >
                  {p.name}
                </span>
              )}
            </div>
          );
        })}

        {/* Hiệu ứng bay Sân Bay điện ảnh: Bảng thông báo giữa sân + Máy bay thương mại trắng-đỏ KHỔNG LỒ lướt qua bàn cờ */}
        {airportFlight && (
          <>
            <svg className="absolute inset-0 z-[48] h-full w-full overflow-visible">
              <path
                d={`M ${airportFlight.startX} ${airportFlight.startY} Q ${airportFlight.ctrlX} ${airportFlight.ctrlY} ${airportFlight.endX} ${airportFlight.endY}`}
                fill="none"
                stroke="#FDE047"
                strokeWidth="4"
                strokeDasharray="12 10"
                strokeLinecap="round"
                opacity="0.82"
              />
              {airportFlight.puffs.map((pf, idx) => (
                <circle
                  key={idx}
                  cx={pf.x}
                  cy={pf.y}
                  r={7 + idx * 0.45}
                  fill="#F8FAFC"
                  opacity={pf.opacity * 0.68}
                />
              ))}
            </svg>

            {/* Bảng thông báo chuyến bay kiểu cổ điển ngay giữa sân */}
            <div
              data-testid="airport-flight-banner"
              className="absolute left-1/2 top-[56%] z-[49] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-sky-200/80 bg-slate-950/88 px-6 py-3 text-center shadow-[0_18px_46px_rgba(0,0,0,0.8)] backdrop-blur-sm"
            >
              <div className="text-lg font-black tracking-wide text-white">
                ✈ <span className="text-amber-300">{airportFlight.playerName}</span> đang bay đến ô{' '}
                <span className="text-cyan-300">{airportFlight.destinationName}</span>.
              </div>
            </div>

            {/* Máy bay thương mại trắng-đỏ KHỔNG LỒ bay vắt ngang bàn cờ (phóng to khi qua giữa sân) */}
            <div
              data-testid="giant-airport-jet"
              style={{
                left: airportFlight.planeX,
                top: airportFlight.planeY,
                transform: `translate(-50%, -50%) rotate(${airportFlight.angleDeg}deg) scale(${
                  0.58 + Math.sin(airportFlight.progress * Math.PI) * 0.62
                })`,
              }}
              className="absolute z-[52] drop-shadow-[0_26px_28px_rgba(0,0,0,0.72)]"
            >
              <GiantAirportJetSvg className="h-64 w-64" />
            </div>
          </>
        )}

        {/* Lá bài Cơ Hội / Khí Vận bay vút & xoay lật 3D từ chồng bài giữa sân */}
        {flyingCard && (
          <div
            style={{
              left: flyingCard.x,
              top: flyingCard.y,
              background:
                flyingCard.deck === 'CHANCE'
                  ? 'linear-gradient(145deg, #F59E0B 0%, #B45309 100%)'
                  : 'linear-gradient(145deg, #7C3AED 0%, #4C1D95 100%)',
            }}
            className="animate-card-flip-3d absolute z-40 flex h-32 w-24 flex-col items-center justify-center rounded-2xl border-2 border-amber-200 text-white shadow-2xl"
          >
            {flyingCard.deck === 'CHANCE' ? (
              <ChanceSymbolSvg className="h-12 w-12" />
            ) : (
              <FateSymbolSvg className="h-12 w-12" />
            )}
            <span className="mt-1 text-xs font-black tracking-wider">
              {flyingCard.deck === 'CHANCE' ? 'CƠ HỘI' : 'KHÍ VẬN'}
            </span>
          </div>
        )}

        {/* Sập song sắt Trại Giam khi bị bắt vào tù */}
        {jailSlam && (
          <div
            style={{ left: jailSlam.x, top: jailSlam.y }}
            className="animate-jail-slam absolute z-40 drop-shadow-[0_14px_24px_rgba(0,0,0,0.85)]"
          >
            <JailSlamBarsSvg className="h-24 w-24" />
          </div>
        )}
      </div>

      {/* Lớp hoạt ảnh chùm tiền giấy Việt Nam SVG + đồng xu vàng bay theo cung ánh sáng */}
      <CashTransferOverlay transfers={cashTransfers} />

      {/* Lớp VFX Nhãn +/-, Sóng chạm đất & Tia sao */}
      <BoardVfxLayer
        popups={boardPopups}
        shockwaves={shockwaves}
        trails={trailSparks}
      />

      {/* Ngăn kéo Nhật ký & Tiến độ 3 Điều kiện Thắng */}
      {showDrawer && (
        <div
          className="absolute inset-0 z-40 flex justify-start bg-black/55 backdrop-blur-xs"
          onClick={() => setShowDrawer(false)}
        >
          <div
            className="flex h-full w-full max-w-sm flex-col gap-4 border-r border-[#C89B54]/45 bg-stone-900/95 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-black text-amber-300">
                <Crown className="h-4 w-4" />
                TIẾN ĐỘ 3 THẮNG & NHẬT KÝ
              </h3>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 rounded-2xl border border-[#C89B54]/30 bg-black/35 p-3 text-xs">
              <div className="font-bold text-amber-200">Tiến độ Thắng 1 Đường Thẳng (trọn 1 cạnh):</div>
              {([0, 1, 2, 3] as const).map((edge) => {
                const { ownerCounts, ownableTotal } = evaluateEdgeProgress(displayState.tiles, edge);
                let topName = 'Chưa ai dẫn';
                let topCount = 0;
                let topHex = '#94A3B8';
                for (const [pid, cnt] of Object.entries(ownerCounts)) {
                  if (cnt > topCount) {
                    const p = displayState.players.find((x) => x.id === pid);
                    if (p && !p.isBankrupt) {
                      topCount = cnt;
                      topName = p.name;
                      topHex = p.landHex;
                    }
                  }
                }
                return (
                  <div key={edge} className="flex items-center justify-between">
                    <span>Cạnh {edge + 1} ({edge % 2 === 0 ? 'dài' : 'ngắn'}):</span>
                    <span className="font-bold" style={{ color: topHex }}>
                      {topName} ({topCount}/{ownableTotal})
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {displayState.logs.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-xl border px-3 py-2 ${
                    entry.tone === 'good'
                      ? 'border-emerald-400/25 bg-emerald-950/35 text-emerald-100'
                      : entry.tone === 'danger'
                        ? 'border-rose-400/30 bg-rose-950/35 text-rose-100'
                        : entry.tone === 'warn'
                          ? 'border-amber-400/30 bg-amber-950/35 text-amber-100'
                          : 'border-white/10 bg-white/5 text-stone-200'
                  }`}
                >
                  <span className="mr-1.5 font-bold opacity-60">L{entry.turn}</span>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bảng Thông Tin Ô Đất 2 Cột (bấm vào bất kỳ ô nào trên 4 cạnh đều mở) */}
      {inspectTileIdx !== null && displayState.tiles[inspectTileIdx] && (
        <TileInspectorModal
          tile={displayState.tiles[inspectTileIdx]}
          state={displayState}
          onClose={() => setInspectTileIdx(null)}
        />
      )}

      {/* Bảng Luật Chơi 52 Ô */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* Modal Thẻ Cơ Hội / Khí Vận (32 tranh minh họa + tự đóng 7 giây) */}
      {displayState.phase === 'CARD_REVEAL' && displayState.activeCard && !isAnimating && (
        <CardRevealModal
          prompt={displayState.activeCard}
          drawer={
            displayState.players.find((p) => p.id === displayState.activeCard?.drawerId) ??
            currentPlayer
          }
          onConfirm={() => void dispatchAction({ type: 'CONFIRM_CARD' })}
        />
      )}

      {/* Modal Vinh Danh Chiến Thắng */}
      {displayState.phase === 'GAME_OVER' && !isAnimating && (
        <VictoryModal
          state={displayState}
          onRestart={onRestartSameSetup}
          onBackToLobby={onBackToLobby}
        />
      )}
    </div>
  );
}
