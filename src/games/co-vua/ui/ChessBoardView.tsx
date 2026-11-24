import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Flag,
  Handshake,
  Lightbulb,
  Maximize2,
  Minimize2,
  Music,
  RotateCw,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { computeChessBotMove, computeChessHint, type ChessHintResult } from '../ai/chessBot';
import { chessAudio } from '../audio/chessAudio';
import { reduceChessAction } from '../engine/reducer';
import {
  CHESS_FILES,
  findKingSquare,
  generateLegalMoves,
  getMaterialDiff,
  rcToSq,
  sqToRc,
} from '../engine/rules';
import type {
  ChessAction,
  ChessBotDifficulty,
  ChessColor,
  ChessMove,
  ChessPiece,
  ChessPromotionType,
  ChessState,
} from '../engine/types';
import { clearOfflineChessMatch, saveOfflineChessMatch } from '../lobby/offlineSave';
import type {
  ChessRoomSnapshot,
  RemoteChessActionEvent,
} from '../network/onlineRoomClient';
import { ChessPieceSvg } from './ChessPieceSvg';
import { ChessPromotionModal, ChessRulesModal, ChessVictoryModal } from './Modals';

export interface ChessOnlineContext {
  roomCode: string;
  localColor: ChessColor;
  snapshot: ChessRoomSnapshot;
  onCommitAction: (action: ChessAction, nextState: ChessState) => void;
  registerRemoteActionHandler: (fn: (ev: RemoteChessActionEvent) => void) => () => void;
}

interface ChessBoardViewProps {
  initialState: ChessState;
  mode: 'vs-bot' | 'pass-and-play' | 'online';
  botDifficulty: ChessBotDifficulty;
  humanColor: ChessColor;
  autoFlip: boolean;
  onlineContext?: ChessOnlineContext;
  onRestartLocal: () => void;
  onBackToLobby: () => void;
}

interface SlidingChessPiece {
  id: number;
  piece: ChessPiece;
  fromSq: number;
  toSq: number;
  active: boolean;
}

export function ChessBoardView({
  initialState,
  mode,
  botDifficulty,
  humanColor,
  autoFlip,
  onlineContext,
  onRestartLocal,
  onBackToLobby,
}: ChessBoardViewProps) {
  const [state, setState] = useState<ChessState>(initialState);
  const stateRef = useRef<ChessState>(initialState);
  stateRef.current = state;

  const [selectedSq, setSelectedSq] = useState<number | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: number; to: number } | null>(null);
  const [hintResult, setHintResult] = useState<ChessHintResult | null>(null);
  const [manualFlip, setManualFlip] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [sliding, setSliding] = useState<SlidingChessPiece | null>(null);

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
      clearOfflineChessMatch();
      return;
    }
    saveOfflineChessMatch({
      mode,
      botDifficulty,
      humanColor,
      autoFlip,
      state,
    });
  }, [state, mode, botDifficulty, humanColor, autoFlip]);

  const triggerSlideAnim = useCallback((next: ChessState) => {
    const last = next.lastMove;
    if (!last) return;
    const movedPiece = next.board[last.to];
    if (!movedPiece) return;

    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    const id = ++slideIdRef.current;
    setSliding({
      id,
      piece: movedPiece,
      fromSq: last.from,
      toSq: last.to,
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

  const playSoundForState = useCallback((next: ChessState) => {
    if (next.phase === 'GAME_OVER') {
      if (next.winner === 'DRAW') chessAudio.playDraw();
      else chessAudio.playVictory();
      return;
    }
    const last = next.lastMove;
    if (!last) return;
    if (next.inCheck) chessAudio.playCheck();
    else if (last.promotion) chessAudio.playPromote();
    else if (last.isCastleKing || last.isCastleQueen) chessAudio.playCastle();
    else if (last.captured) chessAudio.playCapture();
    else chessAudio.playMove();
  }, []);

  const dispatchAction = useCallback(
    (action: ChessAction, broadcast: boolean) => {
      const next = reduceChessAction(stateRef.current, action);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      setSelectedSq(null);
      setPendingPromo(null);
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
      const verified = reduceChessAction(stateRef.current, ev.action);
      const next = verified !== stateRef.current ? verified : (ev.resultingState ?? stateRef.current);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      setSelectedSq(null);
      setPendingPromo(null);
      setHintResult(null);
      if (ev.action.type === 'MOVE') {
        triggerSlideAnim(next);
        playSoundForState(next);
      }
    });
  }, [onlineContext, playSoundForState, triggerSlideAnim]);

  const myInteractiveColor: ChessColor | 'both' =
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

  // Lượt Máy AI suy nghĩ & đánh mượt mà
  useEffect(() => {
    if (!isBotTurn) return;
    setBotThinking(true);
    const timer = setTimeout(() => {
      const best = computeChessBotMove(stateRef.current, botDifficulty);
      setBotThinking(false);
      if (best) {
        dispatchAction(
          { type: 'MOVE', from: best.from, to: best.to, promotion: best.promotion },
          false,
        );
      }
    }, 340);
    return () => {
      clearTimeout(timer);
      setBotThinking(false);
    };
  }, [isBotTurn, state.history.length, botDifficulty, dispatchAction]);

  const legalMoves = useMemo(() => {
    if (state.phase !== 'PLAYING') return [];
    return generateLegalMoves(state.board, state.turn, state.castling, state.enPassantTarget);
  }, [state.phase, state.board, state.turn, state.castling, state.enPassantTarget]);

  const selectedTargets = useMemo(() => {
    const map = new Map<number, ChessMove[]>();
    if (selectedSq === null || !isMyTurn) return map;
    for (const m of legalMoves) {
      if (m.from === selectedSq) {
        const arr = map.get(m.to) ?? [];
        arr.push(m);
        map.set(m.to, arr);
      }
    }
    return map;
  }, [selectedSq, isMyTurn, legalMoves]);

  // Góc nhìn bàn cờ
  const bottomColor: ChessColor = useMemo(() => {
    let base: ChessColor = 'white';
    if (mode === 'online' && onlineContext) base = onlineContext.localColor;
    else if (mode === 'vs-bot') base = humanColor;
    else if (mode === 'pass-and-play' && autoFlip) base = state.turn;
    return manualFlip ? (base === 'white' ? 'black' : 'white') : base;
  }, [mode, onlineContext, humanColor, autoFlip, state.turn, manualFlip]);

  const isFlipped = bottomColor === 'black';
  const checkedKingSq = state.inCheck ? findKingSquare(state.board, state.turn) : -1;
  const materialDiff = useMemo(() => getMaterialDiff(state.board), [state.board]);

  const handleSquareClick = (sq: number) => {
    if (!isMyTurn) return;

    if (selectedSq !== null && selectedTargets.has(sq)) {
      const candidates = selectedTargets.get(sq)!;
      if (candidates.some((m) => m.promotion)) {
        setPendingPromo({ from: selectedSq, to: sq });
        return;
      }
      dispatchAction({ type: 'MOVE', from: selectedSq, to: sq }, mode === 'online');
      return;
    }

    const piece = state.board[sq];
    if (piece && piece.color === state.turn) {
      if (selectedSq !== sq) chessAudio.playSelect();
      setSelectedSq(selectedSq === sq ? null : sq);
      return;
    }

    setSelectedSq(null);
  };

  const handleConfirmPromo = (promo: ChessPromotionType) => {
    if (!pendingPromo) return;
    dispatchAction(
      { type: 'MOVE', from: pendingPromo.from, to: pendingPromo.to, promotion: promo },
      mode === 'online',
    );
  };

  const handleRequestHint = () => {
    if (!isMyTurn || mode !== 'vs-bot') return;
    soundEngine.playPushClick();
    const res = computeChessHint(state);
    setHintResult(res);
    if (res) setSelectedSq(res.move.from);
  };

  /** Thẻ đại diện phe lớn, đối xứng 2 bên: BÊN TRẮNG (Trái) — BÊN ĐEN (Phải) */
  const renderSidePanelCard = (color: ChessColor) => {
    const p = state.players[color];
    const isWhiteSide = color === 'white';
    const isTurn = state.phase === 'PLAYING' && state.turn === color;
    const captured = isWhiteSide ? state.capturedByWhite : state.capturedByBlack;
    const adv = isWhiteSide ? materialDiff.whiteAdv : materialDiff.blackAdv;
    const onlineHuman = onlineContext?.snapshot.humans.find((h) => h.color === color);
    const isMe = mode === 'online' && onlineContext?.localColor === color;

    return (
      <div
        className={`flex flex-col items-center rounded-[26px] border-2 px-4 py-5 text-center shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-300 ${
          isTurn
            ? 'scale-[1.02] border-amber-300 bg-gradient-to-b from-stone-900/95 to-stone-950/95 ring-4 ring-amber-400/25'
            : 'border-amber-200/20 bg-stone-950/82 opacity-88'
        }`}
      >
        {/* Nhãn phe */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-black tracking-widest uppercase shadow ${
            isWhiteSide
              ? 'bg-[#F6F3EA] text-stone-900'
              : 'border border-slate-500/50 bg-[#1B2027] text-slate-100'
          }`}
        >
          {p.isBot && <Bot className="h-3.5 w-3.5" />}
          {isWhiteSide ? 'BÊN TRẮNG' : 'BÊN ĐEN'}
        </span>

        {/* Biểu tượng Vua đại diện lớn */}
        <div
          className={`relative my-4 flex h-24 w-24 items-center justify-center rounded-2xl border-2 shadow-inner ${
            isWhiteSide
              ? 'border-amber-200/60 bg-gradient-to-br from-[#3A281D] to-[#1F150F]'
              : 'border-amber-200/45 bg-gradient-to-br from-[#EFECE2] to-[#D4CCBC]'
          }`}
        >
          <ChessPieceSvg
            type="k"
            color={color}
            className={`h-20 w-20 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] transition-transform duration-300 ${
              isTurn ? 'scale-105' : ''
            }`}
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
              ⚔️ CHIẾU!
            </span>
          )}
          {onlineHuman && !onlineHuman.connected && (
            <span className="rounded-full bg-rose-900/90 px-2 py-0.5 text-[10px] font-bold text-rose-200">
              Mất mạng
            </span>
          )}
        </div>

        {/* Khay quân đã ăn & điểm lợi thế */}
        <div className="mt-4 w-full border-t border-amber-200/15 pt-3 text-left">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold tracking-wider uppercase text-amber-200/75">
            <span>Quân đã ăn ({captured.length})</span>
            {adv > 0 && (
              <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-black text-emerald-300">
                +{adv}
              </span>
            )}
          </div>
          <div
            className={`mt-2 flex min-h-[38px] flex-wrap items-center gap-0.5 rounded-xl px-2 py-1.5 ${
              isWhiteSide ? 'bg-[#E5DFD2]/85' : 'bg-black/45'
            }`}
          >
            {captured.length === 0 ? (
              <span
                className={`w-full text-center text-[11px] italic ${
                  isWhiteSide ? 'text-stone-600' : 'text-stone-500'
                }`}
              >
                Chưa ăn quân nào
              </span>
            ) : (
              captured.map((pt, i) => (
                <ChessPieceSvg
                  key={`${pt}_${i}`}
                  type={pt}
                  color={isWhiteSide ? 'black' : 'white'}
                  className="h-6 w-6"
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Vẽ 64 ô theo thứ tự hiển thị
  const displayRows = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayCols = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const sqToVisualPos = (sq: number) => {
    const { row, col } = sqToRc(sq);
    return {
      vRow: isFlipped ? 7 - row : row,
      vCol: isFlipped ? 7 - col : col,
    };
  };

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden text-white select-none"
      style={{
        background:
          'radial-gradient(ellipse at 50% 35%, #3B2518 0%, #20130C 58%, #100906 100%)',
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
          title="Quay lại sảnh Cờ Vua"
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/45 text-stone-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #713F12',
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
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/45 text-stone-950 cursor-pointer"
          style={{
            background: muted
              ? 'linear-gradient(180deg, #CBD5E1 0%, #64748B 100%)'
              : 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #713F12',
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
          title="Xem luật Cờ Vua FIDE"
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/45 text-stone-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #713F12',
          }}
        >
          <BookOpen className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            setManualFlip((v) => !v);
          }}
          title="Xoay bàn cờ 180°"
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-stone-950 cursor-pointer"
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
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/45 text-stone-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #713F12',
          }}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* MÃ PHÒNG ONLINE GÓC PHẢI */}
      {onlineContext && (
        <div className="absolute right-3 top-2.5 z-30 inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-stone-950/88 px-3 py-1 font-mono text-xs font-black text-amber-300 shadow">
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />#{onlineContext.roomCode}
        </div>
      )}

      {/* BỐ CỤC ĐỐI XỨNG 3 CỘT: [TRÁI: BÊN TRẮNG] | [GIỮA: BÀN CỜ CHUẨN BÌA SIÊU TO] | [PHẢI: BÊN ĐEN] */}
      <main className="mx-auto flex h-full w-full max-w-[1260px] items-center justify-center gap-6 px-4 py-2">
        {/* CỘT TRÁI — ĐẠI DIỆN BÊN TRẮNG */}
        <aside className="flex w-[240px] shrink-0 flex-col gap-3">
          {renderSidePanelCard('white')}

          {/* Lời đề nghị hòa nổi gọn khi đối thủ xin hòa */}
          {state.pendingDrawOfferFrom &&
            state.pendingDrawOfferFrom !== myInteractiveColor &&
            state.phase === 'PLAYING' && (
              <div className="rounded-2xl border-2 border-amber-300/75 bg-amber-950/92 p-3 text-center shadow-2xl">
                <div className="text-xs font-black text-amber-200">
                  🤝 {state.players[state.pendingDrawOfferFrom].name} đề nghị Hòa cờ!
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

        {/* CHÍNH GIỮA — BÀN CỜ VUA 8×8 TRẮNG NGÀ – ĐEN THAN KHUNG GỖ CHỈ VÀNG CHUẨN BÌA */}
        <section
          className="relative flex aspect-square h-full max-h-[696px] shrink-0 flex-col rounded-[22px] p-[13px] shadow-[0_24px_60px_rgba(0,0,0,0.82)]"
          style={{
            background:
              'linear-gradient(145deg, #6E462B 0%, #4A2C18 48%, #2E1A0E 100%)',
            boxShadow:
              '0 24px 60px rgba(0,0,0,0.82), inset 0 2px 3px rgba(255,228,185,0.28), inset 0 -3px 6px rgba(0,0,0,0.65)',
          }}
        >
          {/* Đường chỉ viền vàng kim mảnh chuẩn ảnh bìa */}
          <div className="relative flex flex-1 overflow-hidden rounded-[10px] border-[2px] border-[#D4AF37]/85 p-[2px] shadow-inner">
            {/* Lưới 8×8 ô Trắng ngà – Đen than */}
            <div className="relative grid flex-1 grid-cols-8 grid-rows-8 overflow-hidden rounded-[7px]">
              {displayRows.map((boardRow, vRow) =>
                displayCols.map((boardCol, vCol) => {
                  const sq = rcToSq(boardRow, boardCol);
                  const isLight = (boardRow + boardCol) % 2 === 0;
                  const piece = state.board[sq];
                  const isSelected = selectedSq === sq;
                  const isLastFrom = state.lastMove?.from === sq;
                  const isLastTo = state.lastMove?.to === sq;
                  const isCheckedKing = checkedKingSq === sq;
                  const isHintFrom = hintResult?.move.from === sq;
                  const isHintTo = hintResult?.move.to === sq;
                  const targetMoves = selectedTargets.get(sq);
                  const isLegalTarget = Boolean(targetMoves);
                  const isHiddenBySlide = sliding?.toSq === sq;

                  let bgColor = isLight ? '#F6F3EA' : '#2B333B';
                  if (isLastFrom || isLastTo) {
                    bgColor = isLight ? '#F4E4A1' : '#7A682D';
                  }
                  if (isSelected) {
                    bgColor = '#34D399';
                  }

                  return (
                    <button
                      key={sq}
                      type="button"
                      onClick={() => handleSquareClick(sq)}
                      aria-label={`Ô ${CHESS_FILES[boardCol]}${8 - boardRow}`}
                      style={{ backgroundColor: bgColor }}
                      className={`relative flex items-center justify-center transition-colors duration-150 ${
                        isMyTurn && (isLegalTarget || (piece && piece.color === state.turn))
                          ? 'cursor-pointer'
                          : 'cursor-default'
                      }`}
                    >
                      {/* Tọa độ hàng (1–8) ở cột trái cùng */}
                      {vCol === 0 && (
                        <span
                          className={`pointer-events-none absolute left-1 top-0.5 text-[10px] font-black leading-none ${
                            isLight ? 'text-stone-600/85' : 'text-stone-300/75'
                          }`}
                        >
                          {8 - boardRow}
                        </span>
                      )}
                      {/* Tọa độ cột (A–H) ở hàng dưới cùng */}
                      {vRow === 7 && (
                        <span
                          className={`pointer-events-none absolute bottom-0.5 right-1 text-[10px] font-black uppercase leading-none ${
                            isLight ? 'text-stone-600/85' : 'text-stone-300/75'
                          }`}
                        >
                          {CHESS_FILES[boardCol]}
                        </span>
                      )}

                      {/* Vòng cảnh báo đỏ dưới Vua bị Chiếu */}
                      {isCheckedKing && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-red-600/55 ring-4 ring-inset ring-red-400 animate-pulse"
                        />
                      )}

                      {/* Highlight Gợi ý AI */}
                      {(isHintFrom || isHintTo) && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-emerald-400"
                        />
                      )}

                      {/* Quân cờ Staunton 3D bóng mịn */}
                      {piece && !isHiddenBySlide && (
                        <ChessPieceSvg
                          type={piece.type}
                          color={piece.color}
                          className={`relative z-10 h-[88%] w-[88%] transition-transform duration-150 ${
                            isSelected ? '-translate-y-1.5 scale-[1.09]' : ''
                          }`}
                        />
                      )}

                      {/* Dấu chấm nước đi hợp lệ / vòng ăn quân */}
                      {isLegalTarget && !piece && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none z-20 h-[28%] w-[28%] rounded-full bg-emerald-500/90 ring-2 ring-white/80 shadow"
                        />
                      )}
                      {isLegalTarget && piece && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-1 z-20 rounded-full border-[3.5px] border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.85)]"
                        />
                      )}
                    </button>
                  );
                }),
              )}

              {/* LỚP HOẠT ẢNH LƯỚT QUÂN CỜ MƯỢT (SLIDE ~220ms) */}
              {sliding &&
                (() => {
                  const fromPos = sqToVisualPos(sliding.fromSq);
                  const toPos = sqToVisualPos(sliding.toSq);
                  const curCol = sliding.active ? toPos.vCol : fromPos.vCol;
                  const curRow = sliding.active ? toPos.vRow : fromPos.vRow;
                  return (
                    <div
                      key={sliding.id}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 top-0 z-30 flex h-[12.5%] w-[12.5%] items-center justify-center"
                      style={{
                        transform: `translate3d(${curCol * 100}%, ${curRow * 100}%, 0)`,
                        transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      <ChessPieceSvg
                        type={sliding.piece.type}
                        color={sliding.piece.color}
                        className="h-[88%] w-[88%] scale-[1.05]"
                      />
                    </div>
                  );
                })()}
            </div>
          </div>

          {/* Gợi ý AI nổi gọn ở mép trên bàn cờ */}
          {hintResult && (
            <div className="pointer-events-none absolute left-1/2 top-5 z-40 -translate-x-1/2">
              <div className="max-w-[460px] rounded-2xl border-2 border-emerald-300 bg-emerald-950/95 px-3.5 py-1.5 text-center text-xs font-black text-emerald-100 shadow-2xl">
                💡 {hintResult.explanationVi}
              </div>
            </div>
          )}
        </section>

        {/* CỘT PHẢI — ĐẠI DIỆN BÊN ĐEN + NÚT GỌN NHẸ */}
        <aside className="flex w-[240px] shrink-0 flex-col gap-3">
          {renderSidePanelCard('black')}

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
                className="flex items-center justify-center gap-1 rounded-xl border border-amber-200/25 bg-stone-900/85 py-2 text-xs font-black text-amber-100 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
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

      {showRules && <ChessRulesModal onClose={() => setShowRules(false)} />}
      {pendingPromo && (
        <ChessPromotionModal
          color={state.turn}
          onSelect={handleConfirmPromo}
          onCancel={() => setPendingPromo(null)}
        />
      )}
      {state.phase === 'GAME_OVER' && (
        <ChessVictoryModal
          state={state}
          isOnline={mode === 'online'}
          onPlayAgain={onRestartLocal}
          onBackToLobby={onBackToLobby}
        />
      )}
    </div>
  );
}
