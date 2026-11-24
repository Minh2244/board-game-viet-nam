import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Flag,
  Handshake,
  Languages,
  Lightbulb,
  Maximize2,
  Minimize2,
  Music,
  RotateCw,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { computeXiangqiBotMove, computeXiangqiHint, type XiangqiHintResult } from '../ai/xiangqiBot';
import { xiangqiAudio } from '../audio/xiangqiAudio';
import { reduceXiangqiAction } from '../engine/reducer';
import {
  findGeneralIdx,
  generateLegalXiangqiMoves,
  idxToRc,
} from '../engine/rules';
import type {
  XiangqiAction,
  XiangqiBotDifficulty,
  XiangqiColor,
  XiangqiMove,
  XiangqiPiece,
  XiangqiState,
} from '../engine/types';
import { clearOfflineXiangqiMatch, saveOfflineXiangqiMatch } from '../lobby/offlineSave';
import type {
  RemoteXiangqiActionEvent,
  XiangqiRoomSnapshot,
} from '../network/onlineRoomClient';
import { XiangqiRulesModal, XiangqiVictoryModal } from './Modals';
import { XiangqiPieceToken } from './XiangqiPieceToken';

export interface XiangqiOnlineContext {
  roomCode: string;
  localColor: XiangqiColor;
  snapshot: XiangqiRoomSnapshot;
  onCommitAction: (action: XiangqiAction, nextState: XiangqiState) => void;
  registerRemoteActionHandler: (fn: (ev: RemoteXiangqiActionEvent) => void) => () => void;
}

interface XiangqiBoardViewProps {
  initialState: XiangqiState;
  mode: 'vs-bot' | 'pass-and-play' | 'online';
  botDifficulty: XiangqiBotDifficulty;
  humanColor: XiangqiColor;
  initialLabelMode: 'han' | 'vi';
  onlineContext?: XiangqiOnlineContext;
  onRestartLocal: () => void;
  onBackToLobby: () => void;
}

interface SlidingXiangqiPiece {
  id: number;
  piece: XiangqiPiece;
  fromIdx: number;
  toIdx: number;
  active: boolean;
}

// Hệ tọa độ chuẩn cho bàn gỗ 9 đường dọc × 10 đường ngang trên SVG 540×600
const VB_W = 540;
const VB_H = 600;
const PAD_X = 40;
const PAD_Y = 41;
const STEP = 57.5; // 40 + 8*57.5 + 40 = 540; 41 + 9*57.5 + 41.5 = 600

function gridPx(dispCol: number, dispRow: number): { x: number; y: number } {
  return {
    x: PAD_X + dispCol * STEP,
    y: PAD_Y + dispRow * STEP,
  };
}

/** Vẽ dấu chữ thập nhỏ tại các giao điểm vị trí Pháo & Tốt */
function buildCrossTicks(col: number, row: number): string[] {
  const { x, y } = gridPx(col, row);
  const g = 5;
  const len = 9;
  const paths: string[] = [];
  if (col > 0) {
    paths.push(`M ${x - g - len} ${y - g} H ${x - g} V ${y - g - len}`);
    paths.push(`M ${x - g - len} ${y + g} H ${x - g} V ${y + g + len}`);
  }
  if (col < 8) {
    paths.push(`M ${x + g + len} ${y - g} H ${x + g} V ${y - g - len}`);
    paths.push(`M ${x + g + len} ${y + g} H ${x + g} V ${y + g + len}`);
  }
  return paths;
}

const STAR_MARKERS: readonly [number, number][] = [
  [1, 2], [7, 2], [1, 7], [7, 7],
  [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
  [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
];

export function XiangqiBoardView({
  initialState,
  mode,
  botDifficulty,
  humanColor,
  initialLabelMode,
  onlineContext,
  onRestartLocal,
  onBackToLobby,
}: XiangqiBoardViewProps) {
  const svgUid = useId().replace(/:/g, '');
  const [state, setState] = useState<XiangqiState>(initialState);
  const stateRef = useRef<XiangqiState>(initialState);
  stateRef.current = state;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [labelMode, setLabelMode] = useState<'han' | 'vi'>(initialLabelMode);
  const [manualFlip, setManualFlip] = useState(false);
  const [hintResult, setHintResult] = useState<XiangqiHintResult | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [checkFlash, setCheckFlash] = useState(false);
  const [sliding, setSliding] = useState<SlidingXiangqiPiece | null>(null);

  const slideIdRef = useRef(1);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { muted, toggleMute } = useAudioStore();

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (mode === 'online') return;
    if (state.phase === 'GAME_OVER') {
      clearOfflineXiangqiMatch();
      return;
    }
    saveOfflineXiangqiMatch({
      mode,
      botDifficulty,
      humanColor,
      state,
    });
  }, [state, mode, botDifficulty, humanColor]);

  const triggerSlideAnim = useCallback((next: XiangqiState) => {
    const last = next.lastMove;
    if (!last) return;
    const movedPiece = next.board[last.to];
    if (!movedPiece) return;

    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    const id = ++slideIdRef.current;
    setSliding({
      id,
      piece: movedPiece,
      fromIdx: last.from,
      toIdx: last.to,
      active: false,
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSliding((cur) => (cur && cur.id === id ? { ...cur, active: true } : cur));
      });
    });

    slideTimerRef.current = setTimeout(() => {
      setSliding((cur) => (cur && cur.id === id ? null : cur));
    }, 240);
  }, []);

  const playSoundForState = useCallback((next: XiangqiState) => {
    if (next.phase === 'GAME_OVER') {
      if (next.winner === 'DRAW') xiangqiAudio.playDraw();
      else xiangqiAudio.playVictory();
      return;
    }
    const last = next.lastMove;
    if (!last) return;
    if (next.inCheck) {
      xiangqiAudio.playCheck();
      setCheckFlash(true);
      setTimeout(() => setCheckFlash(false), 1400);
    } else if (last.captured) {
      xiangqiAudio.playCapture();
    } else {
      xiangqiAudio.playMove();
    }
  }, []);

  const dispatchAction = useCallback(
    (action: XiangqiAction, broadcast: boolean) => {
      const next = reduceXiangqiAction(stateRef.current, action);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      setSelectedIdx(null);
      setHintResult(null);
      if (action.type === 'MOVE') {
        triggerSlideAnim(next);
        playSoundForState(next);
      }
      if (broadcast && onlineContext) {
        onlineContext.onCommitAction(action, next);
      }
    },
    [onlineContext, playSoundForState, triggerSlideAnim],
  );

  // Nhận nước đi từ xa ở chế độ Online (gói Delta ~130B)
  useEffect(() => {
    if (!onlineContext) return;
    return onlineContext.registerRemoteActionHandler((ev) => {
      const verified = reduceXiangqiAction(stateRef.current, ev.action);
      const next = verified !== stateRef.current ? verified : (ev.resultingState ?? stateRef.current);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      setSelectedIdx(null);
      setHintResult(null);
      if (ev.action.type === 'MOVE') {
        triggerSlideAnim(next);
        playSoundForState(next);
      }
    });
  }, [onlineContext, playSoundForState, triggerSlideAnim]);

  const myInteractiveColor: XiangqiColor | 'both' =
    mode === 'online' && onlineContext
      ? onlineContext.localColor
      : mode === 'vs-bot'
        ? humanColor
        : 'both';

  const isMyTurn =
    state.phase === 'PLAYING' &&
    !botThinking &&
    (myInteractiveColor === 'both' || state.turn === myInteractiveColor);

  const isBotTurn =
    mode === 'vs-bot' && state.phase === 'PLAYING' && state.players[state.turn].isBot;

  useEffect(() => {
    if (!isBotTurn) return;
    setBotThinking(true);
    const timer = setTimeout(() => {
      const best = computeXiangqiBotMove(stateRef.current, botDifficulty);
      setBotThinking(false);
      if (best) {
        dispatchAction({ type: 'MOVE', from: best.from, to: best.to }, false);
      }
    }, 340);
    return () => {
      clearTimeout(timer);
      setBotThinking(false);
    };
  }, [isBotTurn, state.history.length, botDifficulty, dispatchAction]);

  const legalMoves = useMemo(() => {
    if (state.phase !== 'PLAYING') return [];
    return generateLegalXiangqiMoves(state.board, state.turn, state.checkRepeatCounts);
  }, [state.phase, state.board, state.turn, state.checkRepeatCounts]);

  const selectedTargets = useMemo(() => {
    const map = new Map<number, XiangqiMove>();
    if (selectedIdx === null || !isMyTurn) return map;
    for (const m of legalMoves) {
      if (m.from === selectedIdx) map.set(m.to, m);
    }
    return map;
  }, [selectedIdx, isMyTurn, legalMoves]);

  // Góc nhìn bàn cờ
  const bottomColor: XiangqiColor = useMemo(() => {
    let base: XiangqiColor = 'red';
    if (mode === 'online' && onlineContext) base = onlineContext.localColor;
    else if (mode === 'vs-bot') base = humanColor;
    return manualFlip ? (base === 'red' ? 'green' : 'red') : base;
  }, [mode, onlineContext, humanColor, manualFlip]);

  const isFlipped = bottomColor === 'green';
  const checkedGeneralIdx = state.inCheck ? findGeneralIdx(state.board, state.turn) : -1;

  const idxToBoardPct = (idx: number) => {
    const { row, col } = idxToRc(idx);
    const dispRow = isFlipped ? 9 - row : row;
    const dispCol = isFlipped ? 8 - col : col;
    const pt = gridPx(dispCol, dispRow);
    return {
      leftPct: (pt.x / VB_W) * 100,
      topPct: (pt.y / VB_H) * 100,
    };
  };

  const handleIntersectionClick = (idx: number) => {
    if (!isMyTurn) return;
    if (selectedIdx !== null && selectedTargets.has(idx)) {
      dispatchAction({ type: 'MOVE', from: selectedIdx, to: idx }, mode === 'online');
      return;
    }
    const piece = state.board[idx];
    if (piece && piece.color === state.turn) {
      if (selectedIdx !== idx) xiangqiAudio.playSelect();
      setSelectedIdx(selectedIdx === idx ? null : idx);
      return;
    }
    setSelectedIdx(null);
  };

  const handleRequestHint = () => {
    if (!isMyTurn || mode !== 'vs-bot') return;
    soundEngine.playPushClick();
    const res = computeXiangqiHint(state);
    setHintResult(res);
    if (res) setSelectedIdx(res.move.from);
  };

  /** Thẻ đại diện phe lớn đối xứng 2 bên: BÊN ĐỎ (Trái) — BÊN XANH (Phải) */
  const renderSidePanelCard = (color: XiangqiColor) => {
    const p = state.players[color];
    const isRed = color === 'red';
    const isTurn = state.phase === 'PLAYING' && state.turn === color;
    const captured = isRed ? state.capturedByRed : state.capturedByGreen;
    const onlineHuman = onlineContext?.snapshot.humans.find((h) => h.color === color);
    const isMe = mode === 'online' && onlineContext?.localColor === color;

    return (
      <div
        className={`flex flex-col items-center rounded-[26px] border-2 px-4 py-5 text-center shadow-[0_18px_40px_rgba(0,0,0,0.58)] backdrop-blur-md transition-all duration-300 ${
          isTurn
            ? 'scale-[1.02] border-amber-300 bg-gradient-to-b from-stone-900/95 to-stone-950/95 ring-4 ring-amber-400/25'
            : isRed
              ? 'border-red-500/35 bg-stone-950/84 opacity-88'
              : 'border-emerald-500/35 bg-stone-950/84 opacity-88'
        }`}
      >
        {/* Nhãn phe */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-black tracking-widest uppercase text-white shadow ${
            isRed ? 'bg-red-700' : 'bg-emerald-700'
          }`}
        >
          {p.isBot && <Bot className="h-3.5 w-3.5" />}
          {isRed ? 'BÊN ĐỎ' : 'BÊN XANH'}
        </span>

        {/* Quân Tướng gỗ 3D đại diện lớn */}
        <div className="relative my-4 flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-amber-300/35 bg-gradient-to-br from-[#4D2A12] to-[#261206] shadow-inner">
          <XiangqiPieceToken
            type="k"
            color={color}
            labelMode={labelMode}
            selected={isTurn}
            className={`h-20 w-20 transition-transform duration-300 ${isTurn ? 'scale-105' : ''}`}
          />
          {isTurn && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1 rounded-2xl border-2 border-amber-300/80 animate-pulse"
            />
          )}
        </div>

        {/* Tên kỳ thủ */}
        <div className="max-w-full truncate text-lg font-black text-amber-50">
          {p.name}
          {isMe && <span className="ml-1.5 text-xs font-extrabold text-amber-300">(Bạn)</span>}
        </div>

        {/* Huy hiệu trạng thái lượt */}
        <div className="mt-2 flex min-h-[26px] flex-wrap items-center justify-center gap-1.5">
          {isTurn ? (
            <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-3 py-0.5 text-[11px] font-black tracking-wide text-stone-950 shadow">
              {botThinking && p.isBot ? '🤖 MÁY ĐANG TÍNH...' : '▶ ĐANG TỚI LƯỢT'}
            </span>
          ) : (
            <span className="rounded-full bg-white/8 px-3 py-0.5 text-[11px] font-bold text-stone-400">
              Đang chờ lượt
            </span>
          )}
          {state.inCheck && isTurn && (
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow animate-pulse">
              ⚔️ CHIẾU TƯỚNG!
            </span>
          )}
          {onlineHuman && !onlineHuman.connected && (
            <span className="rounded-full bg-rose-900/90 px-2 py-0.5 text-[10px] font-bold text-rose-200">
              Mất mạng
            </span>
          )}
        </div>

        {/* Khay quân đã ăn */}
        <div className="mt-4 w-full border-t border-amber-200/15 pt-3 text-left">
          <div className="text-[10.5px] font-extrabold tracking-wider uppercase text-amber-200/75">
            Quân đã ăn ({captured.length})
          </div>
          <div className="mt-2 flex min-h-[40px] flex-wrap items-center gap-0.5 rounded-xl bg-black/40 px-2 py-1.5">
            {captured.length === 0 ? (
              <span className="w-full text-center text-[11px] italic text-stone-500">
                Chưa ăn quân nào
              </span>
            ) : (
              captured.map((pt, i) => (
                <XiangqiPieceToken
                  key={`${pt}_${i}`}
                  type={pt}
                  color={isRed ? 'green' : 'red'}
                  labelMode={labelMode}
                  className="h-7 w-7"
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden text-white select-none"
      style={{
        background:
          'radial-gradient(ellipse at 50% 38%, #472510 0%, #271207 62%, #150903 100%)',
      }}
    >
      {/* THANH CÔNG CỤ GÓC TRÊN TRÁI (CHỈ 1 NÚT BẬT/TẮT NHẠC NỀN — TIẾNG CỜ LUÔN MẶC ĐỊNH BẬT!) */}
      <div className="absolute left-3 top-2.5 z-30 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            onBackToLobby();
          }}
          title="Quay lại sảnh Cờ Tướng"
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-900 text-amber-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #422006',
          }}
        >
          <ArrowLeft className="h-4 w-4 stroke-[3]" />
        </button>

        <button
          type="button"
          onClick={() => {
            toggleMute();
            soundEngine.playPushClick();
          }}
          title={muted ? 'Bật nhạc nền (tiếng cờ luôn bật)' : 'Tắt nhạc nền (tiếng cờ luôn bật)'}
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-900 text-amber-950 cursor-pointer"
          style={{
            background: muted
              ? 'linear-gradient(180deg, #CBD5E1 0%, #64748B 100%)'
              : 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #422006',
          }}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Music className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            setShowRules(true);
          }}
          title="Xem bộ luật Cờ Tướng"
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-900 text-amber-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #422006',
          }}
        >
          <BookOpen className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            setLabelMode((v) => (v === 'han' ? 'vi' : 'han'));
          }}
          title="Đổi Chữ Hán / Tiếng Việt trên quân cờ"
          className="inline-flex h-8 items-center gap-1 rounded-full border border-amber-300/60 bg-stone-950/88 px-2.5 text-xs font-black text-amber-200 transition hover:bg-stone-900 cursor-pointer"
        >
          <Languages className="h-3.5 w-3.5 text-amber-300" />
          {labelMode === 'han' ? '漢 → VN' : 'VN → 漢'}
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            setManualFlip((v) => !v);
          }}
          title="Xoay bàn cờ 180°"
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border border-amber-900 text-amber-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #E2E8F0 0%, #94A3B8 100%)',
            boxShadow: '0 3px 0 #334155',
          }}
        >
          <RotateCw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
            else void document.exitFullscreen?.().catch(() => {});
          }}
          title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-900 text-amber-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #422006',
          }}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {onlineContext && (
        <div className="absolute right-3 top-2.5 z-30 inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-stone-950/88 px-3 py-1 font-mono text-xs font-black text-amber-300 shadow">
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />#{onlineContext.roomCode}
        </div>
      )}

      {/* BỐ CỤC ĐỐI XỨNG 3 CỘT: [TRÁI: BÊN ĐỎ] | [GIỮA: BÀN GỖ HOÀNG DƯƠNG 9×10] | [PHẢI: BÊN XANH] */}
      <main className="mx-auto flex h-full w-full max-w-[1260px] items-center justify-center gap-6 px-4 py-1.5">
        {/* CỘT TRÁI — ĐẠI DIỆN BÊN ĐỎ */}
        <aside className="flex w-[240px] shrink-0 flex-col gap-3">
          {renderSidePanelCard('red')}

          {state.pendingDrawOfferFrom &&
            state.pendingDrawOfferFrom !== myInteractiveColor &&
            state.phase === 'PLAYING' && (
              <div className="rounded-2xl border-2 border-amber-300/75 bg-amber-950/92 p-3 text-center shadow-2xl">
                <div className="text-xs font-black text-amber-200">
                  🤝 {state.players[state.pendingDrawOfferFrom].name} xin Hòa cờ!
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => dispatchAction({ type: 'RESPOND_DRAW', accept: true }, mode === 'online')}
                    className="rounded-xl bg-emerald-400 py-1.5 text-xs font-black text-slate-950 cursor-pointer"
                  >
                    Đồng ý
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchAction({ type: 'RESPOND_DRAW', accept: false }, mode === 'online')}
                    className="rounded-xl bg-white/15 py-1.5 text-xs font-black text-white cursor-pointer"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            )}
        </aside>

        {/* CHÍNH GIỮA — BÀN GỖ HOÀNG DƯƠNG THẬT 9×10 (90 GIAO ĐIỂM) */}
        <section
          className={`relative aspect-[9/10] h-full max-h-[706px] shrink-0 rounded-[22px] shadow-[0_26px_64px_rgba(0,0,0,0.8)] ${
            checkFlash ? 'animate-board-shake' : ''
          }`}
        >
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-full w-full rounded-[22px]">
            <defs>
              {/* Khung gỗ gụ nâu trầm bo vát 3D */}
              <linearGradient id={`frame_${svgUid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C4620" />
                <stop offset="45%" stopColor="#542C11" />
                <stop offset="100%" stopColor="#321807" />
              </linearGradient>

              {/* Mặt ván gỗ hoàng dương / gỗ tre vàng ấm tự nhiên */}
              <linearGradient id={`woodBase_${svgUid}`} x1="0.08" y1="0" x2="0.95" y2="1">
                <stop offset="0%" stopColor="#F5DCBA" />
                <stop offset="38%" stopColor="#E9C692" />
                <stop offset="72%" stopColor="#DDB274" />
                <stop offset="100%" stopColor="#CB9957" />
              </linearGradient>

              {/* Ánh bóng vecni gỗ mềm góc trên trái */}
              <radialGradient id={`woodSheen_${svgUid}`} cx="25%" cy="18%" r="75%">
                <stop offset="0%" stopColor="#FFF7E4" stopOpacity="0.34" />
                <stop offset="55%" stopColor="#FFF0D1" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#4A250A" stopOpacity="0.22" />
              </radialGradient>

              {/* Bộ lọc tạo thớ vân gỗ thật dọc theo tấm ván */}
              <filter id={`woodGrain_${svgUid}`} x="0%" y="0%" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.014 0.19"
                  numOctaves="3"
                  seed="7"
                  result="noise"
                />
                <feColorMatrix
                  type="matrix"
                  values="0.35 0 0 0 0.45  0.22 0 0 0 0.25  0.08 0 0 0 0.08  0 0 0 0.14 0"
                  in="noise"
                  result="grain"
                />
              </filter>

              <clipPath id={`boardInner_${svgUid}`}>
                <rect x="13" y="13" width={VB_W - 26} height={VB_H - 26} rx="12" />
              </clipPath>
            </defs>

            {/* Khung gỗ ngoài có viền vát sáng tối + góc ghép mộng */}
            <rect x="0" y="0" width={VB_W} height={VB_H} rx="20" fill={`url(#frame_${svgUid})`} />
            <rect
              x="2"
              y="2"
              width={VB_W - 4}
              height={VB_H - 4}
              rx="18"
              fill="none"
              stroke="rgba(255, 224, 174, 0.25)"
              strokeWidth="1.8"
            />
            <g stroke="#291205" strokeOpacity="0.48" strokeWidth="1.2">
              <line x1="2" y1="2" x2="15" y2="15" />
              <line x1={VB_W - 2} y1="2" x2={VB_W - 15} y2="15" />
              <line x1="2" y1={VB_H - 2} x2="15" y2={VB_H - 15} />
              <line x1={VB_W - 2} y1={VB_H - 2} x2={VB_W - 15} y2={VB_H - 15} />
            </g>

            {/* Mặt ván gỗ hoàng dương + lớp vân gỗ thật + lớp ánh vecni */}
            <rect
              x="13"
              y="13"
              width={VB_W - 26}
              height={VB_H - 26}
              rx="12"
              fill={`url(#woodBase_${svgUid})`}
              stroke="#5A2F10"
              strokeWidth="2.4"
            />
            <rect
              x="13"
              y="13"
              width={VB_W - 26}
              height={VB_H - 26}
              rx="12"
              filter={`url(#woodGrain_${svgUid})`}
              clipPath={`url(#boardInner_${svgUid})`}
            />

            {/* Các đường thớ gỗ hữu cơ nhẹ chạy dọc tấm bàn */}
            <g
              clipPath={`url(#boardInner_${svgUid})`}
              fill="none"
              stroke="#8B5320"
              strokeOpacity="0.11"
              strokeWidth="1.35"
            >
              <path d="M 10 68 Q 160 58, 320 72 T 535 64" />
              <path d="M 10 138 Q 210 148, 390 132 T 535 142" />
              <path d="M 10 218 Q 140 206, 310 222 T 535 212" />
              <path d="M 10 302 Q 200 314, 380 296 T 535 308" />
              <path d="M 10 386 Q 170 374, 350 390 T 535 382" />
              <path d="M 10 468 Q 220 478, 410 462 T 535 474" />
              <path d="M 10 544 Q 160 534, 340 550 T 535 540" />
            </g>

            {/* Vệt vecni bóng mềm */}
            <rect
              x="13"
              y="13"
              width={VB_W - 26}
              height={VB_H - 26}
              rx="12"
              fill={`url(#woodSheen_${svgUid})`}
            />

            {/* Viền đôi truyền thống khắc mực nâu trầm quanh lưới */}
            <rect
              x={PAD_X - 7}
              y={PAD_Y - 7}
              width={8 * STEP + 14}
              height={9 * STEP + 14}
              fill="none"
              stroke="#3E1E0A"
              strokeWidth="2.8"
            />
            <rect
              x={PAD_X - 11}
              y={PAD_Y - 11}
              width={8 * STEP + 22}
              height={9 * STEP + 22}
              fill="none"
              stroke="#6B3A18"
              strokeOpacity="0.45"
              strokeWidth="1"
            />

            {/* 10 Đường ngang */}
            {Array.from({ length: 10 }, (_, r) => {
              const y = PAD_Y + r * STEP;
              return (
                <line
                  key={`h_${r}`}
                  x1={PAD_X}
                  y1={y}
                  x2={PAD_X + 8 * STEP}
                  y2={y}
                  stroke="#3E1E0A"
                  strokeWidth={r === 0 || r === 9 ? '2.2' : '1.45'}
                />
              );
            })}

            {/* 9 Đường dọc */}
            {Array.from({ length: 9 }, (_, c) => {
              const x = PAD_X + c * STEP;
              if (c === 0 || c === 8) {
                return (
                  <line
                    key={`v_${c}`}
                    x1={x}
                    y1={PAD_Y}
                    x2={x}
                    y2={PAD_Y + 9 * STEP}
                    stroke="#3E1E0A"
                    strokeWidth="2.2"
                  />
                );
              }
              return (
                <g key={`v_${c}`}>
                  <line
                    x1={x}
                    y1={PAD_Y}
                    x2={x}
                    y2={PAD_Y + 4 * STEP}
                    stroke="#3E1E0A"
                    strokeWidth="1.45"
                  />
                  <line
                    x1={x}
                    y1={PAD_Y + 5 * STEP}
                    x2={x}
                    y2={PAD_Y + 9 * STEP}
                    stroke="#3E1E0A"
                    strokeWidth="1.45"
                  />
                </g>
              );
            })}

            {/* Đường chéo 2 Cung Tướng 3×3 */}
            <g stroke="#3E1E0A" strokeWidth="1.45">
              <line x1={gridPx(3, 0).x} y1={gridPx(3, 0).y} x2={gridPx(5, 2).x} y2={gridPx(5, 2).y} />
              <line x1={gridPx(5, 0).x} y1={gridPx(5, 0).y} x2={gridPx(3, 2).x} y2={gridPx(3, 2).y} />
              <line x1={gridPx(3, 7).x} y1={gridPx(3, 7).y} x2={gridPx(5, 9).x} y2={gridPx(5, 9).y} />
              <line x1={gridPx(5, 7).x} y1={gridPx(5, 7).y} x2={gridPx(3, 9).x} y2={gridPx(3, 9).y} />
            </g>

            {/* Dấu chữ thập đánh dấu vị trí Pháo & Tốt */}
            <g fill="none" stroke="#3E1E0A" strokeWidth="1.35">
              {STAR_MARKERS.flatMap(([c, r]) =>
                buildCrossTicks(c, r).map((d, idx) => <path key={`mk_${c}_${r}_${idx}`} d={d} />),
              )}
            </g>

            {/* Chữ Sông Sở Hà – Hán Giới khắc chìm mềm */}
            <text
              x={PAD_X + 2 * STEP}
              y={PAD_Y + 4.5 * STEP + 9}
              textAnchor="middle"
              fontFamily={
                labelMode === 'han'
                  ? "'KaiTi', 'STKaiti', 'Noto Serif TC', serif"
                  : "'Be Vietnam Pro', sans-serif"
              }
              fontSize={labelMode === 'han' ? '26' : '15.5'}
              fontWeight="900"
              letterSpacing={labelMode === 'han' ? '8' : '3'}
              fill="#4A250C"
              opacity="0.72"
            >
              {labelMode === 'han' ? '楚 河' : 'SỞ HÀ'}
            </text>
            <text
              x={PAD_X + 6 * STEP}
              y={PAD_Y + 4.5 * STEP + 9}
              textAnchor="middle"
              fontFamily={
                labelMode === 'han'
                  ? "'KaiTi', 'STKaiti', 'Noto Serif TC', serif"
                  : "'Be Vietnam Pro', sans-serif"
              }
              fontSize={labelMode === 'han' ? '26' : '15.5'}
              fontWeight="900"
              letterSpacing={labelMode === 'han' ? '8' : '3'}
              fill="#4A250C"
              opacity="0.72"
            >
              {labelMode === 'han' ? '漢 界' : 'HÁN GIỚI'}
            </text>
          </svg>

          {/* LỚP 90 GIAO ĐIỂM TƯƠNG TÁC + 32 QUÂN CỜ GỖ TIỆN 3D ĐỎ – XANH */}
          {Array.from({ length: 90 }, (_, idx) => {
            const { row, col } = idxToRc(idx);
            const { leftPct, topPct } = idxToBoardPct(idx);

            const piece = state.board[idx];
            const isSelected = selectedIdx === idx;
            const isLegalTarget = selectedTargets.has(idx);
            const isLastFrom = state.lastMove?.from === idx;
            const isLastTo = state.lastMove?.to === idx;
            const isCheckedGen = checkedGeneralIdx === idx;
            const isHintFrom = hintResult?.move.from === idx;
            const isHintTo = hintResult?.move.to === idx;
            const isHiddenBySlide = sliding?.toIdx === idx;

            const clickable =
              isMyTurn && (isLegalTarget || (piece !== null && piece.color === state.turn));

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleIntersectionClick(idx)}
                aria-label={`Giao điểm hàng ${row} cột ${col}`}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${
                  clickable ? 'z-20 cursor-pointer' : piece ? 'z-10 cursor-default' : 'pointer-events-none z-0'
                }`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: '10.6%',
                  height: '9.6%',
                }}
              >
                {/* Đánh dấu nước vừa đi */}
                {(isLastFrom || isLastTo) && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full border-[2.5px] border-amber-400/90 bg-amber-300/20"
                  />
                )}

                {/* Gợi ý AI */}
                {(isHintFrom || isHintTo) && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-0.5 rounded-full border-[3px] border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]"
                  />
                )}

                {/* Tướng đang bị chiếu */}
                {isCheckedGen && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-1 rounded-full bg-red-600/50 ring-4 ring-red-400 animate-pulse"
                  />
                )}

                {/* Quân Cờ Tướng gỗ tiện 3D */}
                {piece && !isHiddenBySlide && (
                  <XiangqiPieceToken
                    type={piece.type}
                    color={piece.color}
                    labelMode={labelMode}
                    selected={isSelected}
                    className={`relative z-10 h-full w-full transition-transform duration-150 ${
                      isSelected ? '-translate-y-1.5 scale-110' : ''
                    }`}
                  />
                )}

                {/* Điểm nước đi hợp lệ / vòng ăn quân */}
                {isLegalTarget && !piece && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none z-20 h-[33%] w-[33%] rounded-full bg-emerald-500 ring-2 ring-white shadow-md"
                  />
                )}
                {isLegalTarget && piece && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-0.5 z-20 rounded-full border-[3.5px] border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]"
                  />
                )}
              </button>
            );
          })}

          {/* LỚP HOẠT ẢNH LƯỚT QUÂN GỖ MƯỢT (SLIDE ~220ms) */}
          {sliding &&
            (() => {
              const fromPt = idxToBoardPct(sliding.fromIdx);
              const toPt = idxToBoardPct(sliding.toIdx);
              const curLeft = sliding.active ? toPt.leftPct : fromPt.leftPct;
              const curTop = sliding.active ? toPt.topPct : fromPt.topPct;
              return (
                <div
                  key={sliding.id}
                  aria-hidden="true"
                  className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{
                    left: `${curLeft}%`,
                    top: `${curTop}%`,
                    width: '10.6%',
                    height: '9.6%',
                    transition:
                      'left 220ms cubic-bezier(0.22, 1, 0.36, 1), top 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <XiangqiPieceToken
                    type={sliding.piece.type}
                    color={sliding.piece.color}
                    labelMode={labelMode}
                    className="h-full w-full scale-[1.06]"
                  />
                </div>
              );
            })()}

          {/* Biểu ngữ CHIẾU TƯỚNG hoặc Gợi ý AI nổi gọn */}
          {(checkFlash || hintResult) && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
              {checkFlash ? (
                <div className="whitespace-nowrap rounded-full border-2 border-yellow-300 bg-red-600 px-5 py-1 text-sm font-black tracking-widest text-white shadow-2xl">
                  ⚔️ CHIẾU TƯỚNG!
                </div>
              ) : hintResult ? (
                <div className="max-w-[430px] rounded-2xl border-2 border-emerald-300 bg-emerald-950/95 px-3.5 py-1.5 text-center text-xs font-black text-emerald-100 shadow-2xl">
                  💡 {hintResult.explanationVi}
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* CỘT PHẢI — ĐẠI DIỆN BÊN XANH + NÚT GỌN NHẸ */}
        <aside className="flex w-[240px] shrink-0 flex-col gap-3">
          {renderSidePanelCard('green')}

          <div className="flex flex-col gap-2">
            {mode === 'vs-bot' && (
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={handleRequestHint}
                className="uiverse-push-btn uiverse-dome-shine flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black text-amber-950 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                style={{
                  background: 'linear-gradient(180deg, #FDE047 0%, #F59E0B 100%)',
                  boxShadow: '0 3px 0 #92400E',
                }}
              >
                <Lightbulb className="h-4 w-4" />
                Gợi ý nước đi AI
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={state.phase !== 'PLAYING' || mode === 'vs-bot'}
                onClick={() => {
                  soundEngine.playPushClick();
                  const actor = myInteractiveColor === 'both' ? state.turn : myInteractiveColor;
                  dispatchAction({ type: 'OFFER_DRAW', from: actor }, mode === 'online');
                }}
                title={mode === 'vs-bot' ? 'Chỉ dùng khi đấu 2 người' : 'Gửi lời xin hòa'}
                className="flex items-center justify-center gap-1 rounded-xl border border-amber-300/35 bg-amber-950/60 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-900/75 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
              >
                <Handshake className="h-3.5 w-3.5" />
                Xin hòa
              </button>

              <button
                type="button"
                disabled={state.phase !== 'PLAYING'}
                onClick={() => {
                  soundEngine.playPushClick();
                  const loser = myInteractiveColor === 'both' ? state.turn : myInteractiveColor;
                  dispatchAction({ type: 'RESIGN', color: loser }, mode === 'online');
                }}
                className="flex items-center justify-center gap-1 rounded-xl border border-rose-400/40 bg-rose-950/70 py-2 text-xs font-black text-rose-200 transition hover:bg-rose-900/80 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
              >
                <Flag className="h-3.5 w-3.5" />
                Đầu hàng
              </button>
            </div>
          </div>
        </aside>
      </main>

      {showRules && <XiangqiRulesModal onClose={() => setShowRules(false)} />}
      {state.phase === 'GAME_OVER' && (
        <XiangqiVictoryModal
          state={state}
          isOnline={mode === 'online'}
          onPlayAgain={onRestartLocal}
          onBackToLobby={onBackToLobby}
        />
      )}
    </div>
  );
}
