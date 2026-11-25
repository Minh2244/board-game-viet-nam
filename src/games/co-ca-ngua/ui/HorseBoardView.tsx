import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Gauge,
  Lightbulb,
  Maximize2,
  Minimize2,
  Swords,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { computeHorseBotMove, computeHorseHint, type HorseHintResult } from '../ai/horseBot';
import { horseAudio } from '../audio/horseAudio';
import {
  CLOCKWISE_COLORS,
  getTrackIndexRingColor,
  HORSE_COLOR_CONFIG,
  isSafeDoorTrackIndex,
  isStartTrackIndex,
  progressToTrackIndex,
  SAFE_DOOR_PROGRESS,
  TRACK_GRID_COORDS,
  WINNING_STAIR_STEPS,
} from '../engine/boardGeometry';
import { reduceCoCaNguaAction, validateCoCaNguaAction } from '../engine/reducer';
import { countWinStairHorses, rollSmartHorseDice } from '../engine/rules';
import type {
  CoCaNguaAction,
  CoCaNguaState,
  HorseAnimStep,
  HorseBotDifficulty,
  HorseColor,
  HorsePiece,
  LegalHorseMove,
} from '../engine/types';
import { clearOfflineCoCaNguaMatch, saveOfflineCoCaNguaMatch } from '../lobby/offlineSave';
import {
  ONLINE_DISCONNECT_GRACE_MS,
  type CoCaNguaRoomSnapshot,
  type RemoteHorseActionEvent,
} from '../network/onlineRoomClient';
import { Dice3DWidget } from './Dice3DWidget';
import { HorsePieceSvg } from './HorsePieceSvg';
import { CoCaNguaRulesModal, CoCaNguaVictoryModal } from './Modals';

export interface CoCaNguaOnlineContext {
  roomCode: string;
  localColor: HorseColor;
  isHost: boolean;
  snapshot: CoCaNguaRoomSnapshot;
  onCommitAction: (actorColor: HorseColor, action: CoCaNguaAction, nextState: CoCaNguaState) => void;
  registerRemoteActionHandler: (fn: (ev: RemoteHorseActionEvent) => void) => () => void;
  onDissolveRoom: () => void;
}

interface HorseBoardViewProps {
  initialState: CoCaNguaState;
  mode: 'vs-bot' | 'pass-and-play' | 'online';
  botDifficulty: HorseBotDifficulty;
  onlineContext?: CoCaNguaOnlineContext;
  onRestartLocal: () => void;
  onBackToLobby: () => void;
}

interface FlyingHorseFx {
  horseId: string;
  color: HorseColor;
  initialLeftPct: number;
  initialTopPct: number;
  kind: 'deploy' | 'kick-return';
}

interface ImpactBurstFx {
  id: number;
  leftPct: number;
  topPct: number;
  tone: 'deploy' | 'kick' | 'stairs' | 'safe';
  label: string;
}

// Hệ tọa độ chuẩn của bàn cờ giấy 15×15 bên trong khung vuông 600×600
const BOARD_VIEWBOX = 600;
const BOARD_MARGIN = 12;
const CELL_SIZE = 38.4; // 15 * 38.4 = 576; 12 + 576 + 12 = 600

function gridCenterPx(col: number, row: number): { x: number; y: number } {
  return {
    x: BOARD_MARGIN + (col + 0.5) * CELL_SIZE,
    y: BOARD_MARGIN + (row + 0.5) * CELL_SIZE,
  };
}

function gridCenterPct(col: number, row: number): { leftPct: number; topPct: number } {
  const { x, y } = gridCenterPx(col, row);
  return {
    leftPct: (x / BOARD_VIEWBOX) * 100,
    topPct: (y / BOARD_VIEWBOX) * 100,
  };
}

function getHorseVisualCoord(horse: HorsePiece): { col: number; row: number } {
  const cfg = HORSE_COLOR_CONFIG[horse.color];
  if (horse.zone === 'STABLE') {
    return cfg.stableSlots[horse.slotIndex];
  }
  if (horse.zone === 'TRACK') {
    const trackIdx = progressToTrackIndex(horse.color, horse.progress);
    return TRACK_GRID_COORDS[trackIdx];
  }
  const idx = Math.max(0, Math.min(5, horse.stairStep - 1));
  return cfg.stairCoords[idx];
}

function getMoveTargetCoord(move: LegalHorseMove): { col: number; row: number } | null {
  if (move.toTrackIndex !== null) {
    return TRACK_GRID_COORDS[move.toTrackIndex];
  }
  if (move.toStairStep >= 1 && move.toStairStep <= 6) {
    return HORSE_COLOR_CONFIG[move.color].stairCoords[move.toStairStep - 1];
  }
  return null;
}

/** Tạo đường cong mũi tên mượt giữa 2 điểm trên bàn cờ SVG */
function buildCurvedArrowPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  bendSign = 1,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  // Rút ngắn hai đầu một chút để mũi tên không đè lên tâm quân cờ
  const trimStart = Math.min(14, dist * 0.22);
  const trimEnd = Math.min(18, dist * 0.28);
  const sx = from.x + (dx / dist) * trimStart;
  const sy = from.y + (dy / dist) * trimStart;
  const ex = to.x - (dx / dist) * trimEnd;
  const ey = to.y - (dy / dist) * trimEnd;

  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const perpX = (-dy / dist) * Math.min(26, dist * 0.22) * bendSign;
  const perpY = (dx / dist) * Math.min(26, dist * 0.22) * bendSign;
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${(mx + perpX).toFixed(1)} ${(my + perpY).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function HorseBoardView({
  initialState,
  mode,
  botDifficulty,
  onlineContext,
  onRestartLocal,
  onBackToLobby,
}: HorseBoardViewProps) {
  const svgUid = useId().replace(/:/g, '');
  const [canonicalState, setCanonicalState] = useState<CoCaNguaState>(initialState);
  const canonicalRef = useRef<CoCaNguaState>(initialState);

  const [playbackHorses, setPlaybackHorses] = useState<HorsePiece[]>(initialState.horses);
  const [displayDiceValue, setDisplayDiceValue] = useState<number | null>(initialState.lastDiceValue);
  const [diceRollSeq, setDiceRollSeq] = useState(0);
  const [hoppingHorseId, setHoppingHorseId] = useState<string | null>(null);
  const [flyingFx, setFlyingFx] = useState<FlyingHorseFx | null>(null);
  const [impactBurst, setImpactBurst] = useState<ImpactBurstFx | null>(null);
  const [isBoardShaking, setIsBoardShaking] = useState(false);
  const [floatingBanner, setFloatingBanner] = useState<{
    text: string;
    tone: 'gold' | 'kick' | 'good' | 'info';
  } | null>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const mountedRef = useRef(true);

  const [speedMult, setSpeedMult] = useState<1 | 2>(1);
  const speedRef = useRef<1 | 2>(1);
  speedRef.current = speedMult;

  const [hoveredHorseId, setHoveredHorseId] = useState<string | null>(null);
  const [hintResult, setHintResult] = useState<HorseHintResult | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nowClock, setNowClock] = useState(() => Date.now());

  const { muted, toggleMute } = useAudioStore();

  const remoteQueueRef = useRef<RemoteHorseActionEvent[]>([]);
  const processingRemoteRef = useRef(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstSeqRef = useRef(1);
  const boardSectionRef = useRef<HTMLElement | null>(null);
  const flyingWrapRef = useRef<HTMLDivElement | null>(null);
  const flyingBodyRef = useRef<HTMLDivElement | null>(null);
  const flyingShadowRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'online') return;
    const id = setInterval(() => setNowClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    soundEngine.playPushClick();
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    if (mode === 'online') return;
    if (canonicalState.phase === 'GAME_OVER') {
      clearOfflineCoCaNguaMatch();
      return;
    }
    saveOfflineCoCaNguaMatch({
      mode,
      botDifficulty,
      state: canonicalState,
    });
  }, [canonicalState, mode, botDifficulty]);

  const showBanner = useCallback(
    (text: string, tone: 'gold' | 'kick' | 'good' | 'info' = 'info', durationMs = 1750) => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setFloatingBanner({ text, tone });
      bannerTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setFloatingBanner(null);
      }, durationMs);
    },
    [],
  );

  const spawnBurst = useCallback(
    (col: number, row: number, tone: ImpactBurstFx['tone'], label: string, durationMs = 780) => {
      const { leftPct, topPct } = gridCenterPct(col, row);
      const id = burstSeqRef.current++;
      setImpactBurst({ id, leftPct, topPct, tone, label });
      setTimeout(() => {
        if (mountedRef.current) {
          setImpactBurst((curr) => (curr?.id === id ? null : curr));
        }
      }, durationMs);
    },
    [],
  );

  /** Diễn hoạt ngựa bay theo cung parabol 60fps thuần GPU DOM ref (0 React re-render toàn bàn cờ!) */
  const animateParabolicFlight = useCallback(
    (opts: {
      horseId: string;
      color: HorseColor;
      from: { col: number; row: number };
      to: { col: number; row: number };
      peakLiftPx: number;
      peakScale: number;
      spinDeg: number;
      durationMs: number;
      kind: 'deploy' | 'kick-return';
    }): Promise<void> => {
      const fromPct = gridCenterPct(opts.from.col, opts.from.row);
      const toPct = gridCenterPct(opts.to.col, opts.to.row);

      setFlyingFx({
        horseId: opts.horseId,
        color: opts.color,
        initialLeftPct: fromPct.leftPct,
        initialTopPct: fromPct.topPct,
        kind: opts.kind,
      });

      return new Promise((resolve) => {
        const startTime = performance.now();
        const step = (now: number) => {
          if (!mountedRef.current) {
            resolve();
            return;
          }
          const t = Math.min(1, Math.max(0, (now - startTime) / opts.durationMs));
          const ease = 1 - Math.pow(1 - t, 1.65);
          const leftPct = fromPct.leftPct + (toPct.leftPct - fromPct.leftPct) * ease;
          const topPct = fromPct.topPct + (toPct.topPct - fromPct.topPct) * ease;
          const arc = Math.sin(t * Math.PI);
          const liftPx = -arc * opts.peakLiftPx;
          const scale = 1 + arc * (opts.peakScale - 1);
          const rotateDeg =
            opts.kind === 'kick-return' ? t * opts.spinDeg : arc * opts.spinDeg;

          const wrap = flyingWrapRef.current;
          const boardEl = boardSectionRef.current;
          if (wrap && boardEl) {
            const bw = boardEl.clientWidth || 600;
            const bh = boardEl.clientHeight || 600;
            const pxX = (leftPct / 100) * bw;
            const pxY = (topPct / 100) * bh;
            wrap.style.transform = `translate3d(${pxX}px, ${pxY}px, 0) translate(-50%, -56%)`;
          }
          if (flyingBodyRef.current) {
            flyingBodyRef.current.style.transform = `translate3d(0, ${liftPx}px, 0) scale(${scale}) rotate(${rotateDeg}deg)`;
          }
          if (flyingShadowRef.current) {
            flyingShadowRef.current.style.transform = `scale(${Math.max(0.45, 1.15 - scale * 0.35)})`;
          }

          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            setFlyingFx(null);
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    },
    [],
  );

  /** Phát chuỗi hoạt ảnh nâng cao (Xúc xắc 3D nhảy rớt, Ngựa bay xuất chuồng, Đá bay về chuồng, Leo bụt hào quang) */
  const playAnimationSteps = useCallback(
    async (
      prevHorses: HorsePiece[],
      nextState: CoCaNguaState,
      steps: HorseAnimStep[],
    ): Promise<void> => {
      const isFast = speedRef.current === 2;
      const factor = isFast ? 0.56 : 1;
      let working = prevHorses.map((h) => ({ ...h }));

      for (const step of steps) {
        if (!mountedRef.current) return;

        if (step.type === 'DICE_ROLLED') {
          // Kích hoạt xúc xắc 3D khối lập phương nhảy lên & nảy 3 nhịp ngay trung tâm bàn!
          setDisplayDiceValue(step.diceValue);
          setDiceRollSeq((s) => s + 1);
          await sleep(isFast ? 560 : 930);
          if (!mountedRef.current) return;

          if (step.bonusTurn && step.hasLegalMoves) {
            showBanner(`✨ Đổ ${step.diceValue} nút — Xuất chuồng & Thêm lượt!`, 'gold', 1550);
          }
          await sleep(Math.round(120 * factor));
        } else if (step.type === 'NO_MOVES_SKIP') {
          horseAudio.playSkipTurn();
          showBanner(
            step.keepsTurn
              ? `Đổ ${step.diceValue} không đi được — Vẫn được tung thêm lượt!`
              : `Đổ ${step.diceValue} chưa có nước đi — Chuyển lượt!`,
            'info',
            1250,
          );
          await sleep(Math.round(680 * factor));
        } else if (step.type === 'HORSE_DEPLOY') {
          const mover = working.find((h) => h.id === step.horseId);
          const victim = step.kickedHorseId
            ? working.find((h) => h.id === step.kickedHorseId)
            : null;
          const fromCoord = mover
            ? HORSE_COLOR_CONFIG[mover.color].stableSlots[mover.slotIndex]
            : TRACK_GRID_COORDS[step.toTrackIndex];
          const toCoord = TRACK_GRID_COORDS[step.toTrackIndex];

          horseAudio.playHorseDeploy();
          await animateParabolicFlight({
            horseId: step.horseId,
            color: step.color,
            from: fromCoord,
            to: toCoord,
            peakLiftPx: 82,
            peakScale: 1.52,
            spinDeg: 14,
            durationMs: Math.round(390 * factor),
            kind: 'deploy',
          });
          if (!mountedRef.current) return;

          working = working.map((h) =>
            h.id === step.horseId
              ? { ...h, zone: 'TRACK', progress: 0, stairStep: 0 }
              : h,
          );
          setPlaybackHorses([...working]);
          spawnBurst(toCoord.col, toCoord.row, 'deploy', '🐎 XUẤT!');

          if (victim && step.kickedColor) {
            horseAudio.playHorseKick();
            setIsBoardShaking(true);
            spawnBurst(toCoord.col, toCoord.row, 'kick', '💥 BỐP!');
            showBanner(
              `💥 ĐÁ NGỰA ${HORSE_COLOR_CONFIG[step.kickedColor].nameVi.toUpperCase()} VỀ CHUỒNG!`,
              'kick',
              1900,
            );
            const victimStable = HORSE_COLOR_CONFIG[victim.color].stableSlots[victim.slotIndex];
            await animateParabolicFlight({
              horseId: victim.id,
              color: victim.color,
              from: toCoord,
              to: victimStable,
              peakLiftPx: 112,
              peakScale: 1.55,
              spinDeg: 780,
              durationMs: Math.round(510 * factor),
              kind: 'kick-return',
            });
            if (!mountedRef.current) return;
            working = working.map((h) =>
              h.id === victim.id ? { ...h, zone: 'STABLE', progress: -1, stairStep: 0 } : h,
            );
            setPlaybackHorses([...working]);
            setIsBoardShaking(false);
          } else {
            await sleep(Math.round(140 * factor));
          }
        } else if (step.type === 'HORSE_HOP') {
          const mover = working.find((h) => h.id === step.horseId);
          if (mover) {
            setHoppingHorseId(step.horseId);
            const startProgress = mover.progress;
            for (let i = 0; i < step.trackPath.length; i += 1) {
              if (!mountedRef.current) return;
              const nextProg = startProgress + i + 1;
              working = working.map((h) =>
                h.id === step.horseId
                  ? { ...h, zone: 'TRACK', progress: nextProg, stairStep: 0 }
                  : h,
              );
              setPlaybackHorses([...working]);
              horseAudio.playHorseHop(i);
              await sleep(Math.round(145 * factor));
            }
            setHoppingHorseId(null);

            const destIdx = step.trackPath[step.trackPath.length - 1];
            const destCoord = TRACK_GRID_COORDS[destIdx];

            if (step.kickedHorseId && step.kickedColor) {
              const victim = working.find((h) => h.id === step.kickedHorseId);
              horseAudio.playHorseKick();
              setIsBoardShaking(true);
              spawnBurst(destCoord.col, destCoord.row, 'kick', '💥 BỐP!');
              showBanner(
                `💥 ĐÁ NGỰA ${HORSE_COLOR_CONFIG[step.kickedColor].nameVi.toUpperCase()} VỀ CHUỒNG!`,
                'kick',
                1900,
              );

              if (victim) {
                const victimStable = HORSE_COLOR_CONFIG[victim.color].stableSlots[victim.slotIndex];
                await animateParabolicFlight({
                  horseId: victim.id,
                  color: victim.color,
                  from: destCoord,
                  to: victimStable,
                  peakLiftPx: 118,
                  peakScale: 1.56,
                  spinDeg: 840,
                  durationMs: Math.round(520 * factor),
                  kind: 'kick-return',
                });
                if (!mountedRef.current) return;
                working = working.map((h) =>
                  h.id === victim.id
                    ? { ...h, zone: 'STABLE', progress: -1, stairStep: 0 }
                    : h,
                );
                setPlaybackHorses([...working]);
              }
              setIsBoardShaking(false);
            } else if (step.reachedSafeDoor) {
              horseAudio.playSafeDoor();
              spawnBurst(destCoord.col, destCoord.row, 'safe', '★ CỬA BỤT!');
              showBanner('★ TỚI CỬA LÊN BỤT — LƯỢT SAU ĐƯỢC LEO BỤT!', 'good', 1650);
              await sleep(Math.round(190 * factor));
            }
          }
        } else if (step.type === 'HORSE_CLIMB') {
          setHoppingHorseId(step.horseId);
          const climbingDown = !step.fromSafeDoor && step.toStairStep < step.fromStairStep;
          const dir = climbingDown ? -1 : 1;
          const firstStep = step.fromSafeDoor ? 1 : step.fromStairStep + dir;
          for (
            let s = firstStep;
            dir > 0 ? s <= step.toStairStep : s >= step.toStairStep;
            s += dir
          ) {
            if (!mountedRef.current) return;
            working = working.map((h) =>
              h.id === step.horseId
                ? { ...h, zone: 'HOME_STAIRS', progress: -1, stairStep: s }
                : h,
            );
            setPlaybackHorses([...working]);
            if (s !== step.toStairStep) {
              horseAudio.playHorseHop(Math.abs(s - firstStep));
              await sleep(Math.round(125 * factor));
            }
          }
          const landedCoord = HORSE_COLOR_CONFIG[step.color].stairCoords[step.toStairStep - 1];
          horseAudio.playClimbStairs(step.toStairStep);
          spawnBurst(
            landedCoord.col,
            landedCoord.row,
            'stairs',
            climbingDown
              ? `⬇️ BỤT ${step.toStairStep}`
              : step.toStairStep >= 3
                ? `🏆 BỤT ${step.toStairStep}!`
                : `⬆️ BỤT ${step.toStairStep}`,
            900,
          );
          showBanner(
            step.fromSafeDoor
              ? `🏆 LEO THẲNG LÊN BỤT SỐ ${step.toStairStep}!`
              : climbingDown
                ? `⬇️ ĐỔI BỤT XUỐNG BẬC SỐ ${step.toStairStep}!`
                : `⬆️ ĐỔI BỤT LÊN BẬC SỐ ${step.toStairStep}!`,
            !climbingDown && step.toStairStep >= 3 ? 'gold' : 'good',
            1550,
          );
          setHoppingHorseId(null);
          await sleep(Math.round(220 * factor));
        } else if (step.type === 'VICTORY') {
          horseAudio.playVictoryFanfare();
          showBanner(`👑 ${step.winnerName.toUpperCase()} CHIẾN THẮNG!`, 'gold', 2400);
          await sleep(Math.round(380 * factor));
        }
      }

      if (!mountedRef.current) return;
      setPlaybackHorses(nextState.horses);
      setDisplayDiceValue(nextState.lastDiceValue);
    },
    [animateParabolicFlight, showBanner, spawnBurst],
  );

  const commitAction = useCallback(
    async (action: CoCaNguaAction, broadcastToOnline: boolean) => {
      if (isAnimatingRef.current) return;
      const current = canonicalRef.current;
      const actor = current.players[current.currentPlayerIndex];

      // Dùng rollSmartHorseDice để tăng tỉ lệ ra 1 & 6 lên 60% khi chưa có ngựa ra đường đua!
      const resolvedAction: CoCaNguaAction =
        action.type === 'ROLL_DICE'
          ? { type: 'ROLL_DICE', diceValue: action.diceValue ?? rollSmartHorseDice(current) }
          : action;

      const check = validateCoCaNguaAction(current, resolvedAction);
      if (!check.valid) return;

      const { state: nextState, steps } = reduceCoCaNguaAction(current, resolvedAction);
      if (nextState === current) return;

      setHintResult(null);
      setHoveredHorseId(null);
      isAnimatingRef.current = true;
      setIsAnimating(true);

      if (broadcastToOnline && onlineContext) {
        onlineContext.onCommitAction(actor.color, resolvedAction, nextState);
      }

      const prevHorses = current.horses;
      canonicalRef.current = nextState;

      await playAnimationSteps(prevHorses, nextState, steps);
      if (!mountedRef.current) return;

      setCanonicalState(nextState);
      isAnimatingRef.current = false;
      setIsAnimating(false);
    },
    [onlineContext, playAnimationSteps],
  );

  const drainRemoteQueue = useCallback(async () => {
    if (processingRemoteRef.current || isAnimatingRef.current) return;
    processingRemoteRef.current = true;

    try {
      while (remoteQueueRef.current.length > 0 && mountedRef.current) {
        const ev = remoteQueueRef.current.shift()!;
        const current = canonicalRef.current;
        const check = validateCoCaNguaAction(current, ev.action, ev.actorColor);

        isAnimatingRef.current = true;
        setIsAnimating(true);
        setHintResult(null);

        if (check.valid) {
          const { state: verifiedNext, steps } = reduceCoCaNguaAction(current, ev.action);
          const prevHorses = current.horses;
          canonicalRef.current = verifiedNext;
          await playAnimationSteps(prevHorses, verifiedNext, steps);
          if (mountedRef.current) {
            setCanonicalState(verifiedNext);
          }
        } else if (ev.resultingState) {
          canonicalRef.current = ev.resultingState;
          setPlaybackHorses(ev.resultingState.horses);
          setDisplayDiceValue(ev.resultingState.lastDiceValue);
          setCanonicalState(ev.resultingState);
        }

        if (mountedRef.current) {
          isAnimatingRef.current = false;
          setIsAnimating(false);
        }
      }
    } finally {
      processingRemoteRef.current = false;
    }
  }, [playAnimationSteps]);

  useEffect(() => {
    if (!onlineContext) return;
    return onlineContext.registerRemoteActionHandler((ev) => {
      remoteQueueRef.current.push(ev);
      void drainRemoteQueue();
    });
  }, [onlineContext, drainRemoteQueue]);

  const currentPlayer = canonicalState.players[canonicalState.currentPlayerIndex];

  const currentOnlineHuman = useMemo(() => {
    if (!onlineContext) return null;
    return onlineContext.snapshot.humans.find((h) => h.color === currentPlayer.color) ?? null;
  }, [onlineContext, currentPlayer.color]);

  const isBotTurnNow = useMemo(() => {
    if (canonicalState.phase === 'GAME_OVER') return false;
    if (mode === 'vs-bot') return currentPlayer.isBot;
    if (mode === 'pass-and-play') return false;
    if (mode === 'online' && onlineContext) {
      if (!onlineContext.isHost) return false;
      return currentPlayer.isBot || Boolean(currentOnlineHuman?.botTakeover);
    }
    return false;
  }, [canonicalState.phase, mode, currentPlayer.isBot, onlineContext, currentOnlineHuman]);

  const canLocalHumanAct = useMemo(() => {
    if (canonicalState.phase === 'GAME_OVER' || isAnimating) return false;
    if (mode === 'vs-bot') return !currentPlayer.isBot;
    if (mode === 'pass-and-play') return true;
    if (mode === 'online' && onlineContext) {
      return !currentPlayer.isBot && currentPlayer.color === onlineContext.localColor;
    }
    return false;
  }, [canonicalState.phase, isAnimating, mode, currentPlayer, onlineContext]);

  const canRollNow = canLocalHumanAct && canonicalState.phase === 'WAIT_ROLL';
  const canPickHorseNow = canLocalHumanAct && canonicalState.phase === 'SELECT_HORSE';

  // Vòng chạy tự động của Máy AI
  useEffect(() => {
    if (!isBotTurnNow || isAnimating || canonicalState.phase === 'GAME_OVER') return;
    const delay = speedRef.current === 2 ? 280 : 520;

    const timer = setTimeout(() => {
      if (!mountedRef.current || isAnimatingRef.current) return;
      if (canonicalRef.current.phase === 'WAIT_ROLL') {
        void commitAction({ type: 'ROLL_DICE' }, mode === 'online');
      } else if (canonicalRef.current.phase === 'SELECT_HORSE') {
        const diff =
          mode === 'online' && onlineContext
            ? onlineContext.snapshot.botDifficulty
            : botDifficulty;
        const best = computeHorseBotMove(canonicalRef.current, diff);
        if (best) {
          void commitAction({ type: 'EXECUTE_MOVE', horseId: best.horseId }, mode === 'online');
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isBotTurnNow, isAnimating, canonicalState, mode, botDifficulty, onlineContext, commitAction]);

  const legalMoveByHorseId = useMemo(() => {
    const map = new Map<string, LegalHorseMove>();
    if (!canPickHorseNow) return map;
    for (const m of canonicalState.legalMoves) {
      map.set(m.horseId, m);
    }
    return map;
  }, [canPickHorseNow, canonicalState.legalMoves]);

  const targetTrackMoves = useMemo(() => {
    const map = new Map<number, LegalHorseMove>();
    if (!canPickHorseNow) return map;
    for (const m of canonicalState.legalMoves) {
      if (m.toTrackIndex !== null && !map.has(m.toTrackIndex)) {
        map.set(m.toTrackIndex, m);
      }
    }
    return map;
  }, [canPickHorseNow, canonicalState.legalMoves]);

  const targetStairMoves = useMemo(() => {
    const map = new Map<string, LegalHorseMove>();
    if (!canPickHorseNow) return map;
    for (const m of canonicalState.legalMoves) {
      if (m.toStairStep >= 1 && m.toStairStep <= 6) {
        const key = `${m.color}:${m.toStairStep}`;
        if (!map.has(key)) map.set(key, m);
      }
    }
    return map;
  }, [canPickHorseNow, canonicalState.legalMoves]);

  // Danh sách các mũi tên dẫn đường trực quan cho các quân ngựa có thể đi (gộp các quân trong chuồng về 1 mũi tên gọn)
  const guideArrows = useMemo(() => {
    if (!canPickHorseNow) return [];
    const result: { move: LegalHorseMove; from: { x: number; y: number }; to: { x: number; y: number }; highlighted: boolean }[] = [];
    let deployShown = false;

    for (const move of canonicalState.legalMoves) {
      const isHovered = hoveredHorseId === move.horseId;
      const isHinted = hintResult?.move.horseId === move.horseId;
      if (move.kind === 'DEPLOY') {
        if (deployShown && !isHovered && !isHinted) continue;
        if (isHovered || isHinted) {
          // Thay thế mũi tên deploy mặc định nếu đang rê chuột vào quân khác trong chuồng
          const prevIdx = result.findIndex((r) => r.move.kind === 'DEPLOY');
          if (prevIdx >= 0) result.splice(prevIdx, 1);
        }
        deployShown = true;
      }
      const horse = playbackHorses.find((h) => h.id === move.horseId);
      const targetCoord = getMoveTargetCoord(move);
      if (!horse || !targetCoord) continue;
      const fromCoord = getHorseVisualCoord(horse);
      result.push({
        move,
        from: gridCenterPx(fromCoord.col, fromCoord.row),
        to: gridCenterPx(targetCoord.col, targetCoord.row),
        highlighted: isHovered || isHinted || canonicalState.legalMoves.length === 1,
      });
    }
    return result;
  }, [canPickHorseNow, canonicalState.legalMoves, hoveredHorseId, hintResult, playbackHorses]);

  // Phím Space để tung xúc xắc nhanh hoặc đi nước duy nhất
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || showRules || canonicalState.phase === 'GAME_OVER') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (canRollNow) {
        e.preventDefault();
        void commitAction({ type: 'ROLL_DICE' }, mode === 'online');
      } else if (canPickHorseNow) {
        const moves = canonicalState.legalMoves;
        const allDeploy = moves.length > 0 && moves.every((m) => m.kind === 'DEPLOY');
        if (moves.length === 1 || allDeploy) {
          e.preventDefault();
          void commitAction({ type: 'EXECUTE_MOVE', horseId: moves[0].horseId }, mode === 'online');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canRollNow, canPickHorseNow, canonicalState.legalMoves, canonicalState.phase, showRules, commitAction, mode]);

  const handleRequestHint = () => {
    if (!canPickHorseNow) return;
    soundEngine.playPushClick();
    const hint = computeHorseHint(canonicalState);
    setHintResult(hint);
  };

  const previewMove: LegalHorseMove | null = useMemo(() => {
    if (!canPickHorseNow) return null;
    if (hoveredHorseId && legalMoveByHorseId.has(hoveredHorseId)) {
      return legalMoveByHorseId.get(hoveredHorseId)!;
    }
    if (hintResult && legalMoveByHorseId.has(hintResult.move.horseId)) {
      return hintResult.move;
    }
    return null;
  }, [canPickHorseNow, hoveredHorseId, legalMoveByHorseId, hintResult]);

  // Thẻ người chơi gọn đẹp đặt 4 góc hai bên bàn cờ
  const renderPlayerCard = (color: HorseColor) => {
    const player = canonicalState.players.find((p) => p.color === color);
    const vis = HORSE_COLOR_CONFIG[color];
    if (!player) {
      return (
        <div
          key={color}
          className="flex h-[126px] flex-col items-center justify-center rounded-2xl border border-dashed border-amber-200/20 bg-stone-950/32 px-3 text-center"
        >
          <HorsePieceSvg color={color} className="h-9 w-9 opacity-30" />
          <div className="mt-1 text-[10.5px] font-bold text-amber-100/45">
            Chuồng {vis.nameVi} (Trống)
          </div>
        </div>
      );
    }

    const isTurn = canonicalState.phase !== 'GAME_OVER' && currentPlayer.color === color;
    const isMeOnline = mode === 'online' && onlineContext?.localColor === color;
    const winCount = countWinStairHorses(playbackHorses, color);
    const occupiedSteps = new Set(
      playbackHorses
        .filter((h) => h.color === color && h.zone === 'HOME_STAIRS')
        .map((h) => h.stairStep),
    );
    const onlineHuman = onlineContext?.snapshot.humans.find((h) => h.color === color);
    const disconnectedLeftSec =
      onlineHuman && !onlineHuman.connected && onlineHuman.disconnectedAt
        ? Math.max(
            0,
            Math.ceil((ONLINE_DISCONNECT_GRACE_MS - (nowClock - onlineHuman.disconnectedAt)) / 1000),
          )
        : null;

    return (
      <div
        key={color}
        className={`relative flex flex-col justify-between rounded-2xl border-2 px-3 py-2.5 shadow-xl transition-all ${
          isTurn ? 'scale-[1.02]' : 'opacity-90'
        }`}
        style={{
          background: 'linear-gradient(180deg, rgba(48,26,12,0.92) 0%, rgba(28,14,6,0.96) 100%)',
          borderColor: isTurn ? '#FACC15' : `${vis.main}BB`,
          boxShadow: isTurn
            ? '0 0 22px rgba(250, 204, 21, 0.38), 0 8px 18px rgba(0,0,0,0.45)'
            : '0 8px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
            style={{ backgroundColor: vis.soft, borderColor: vis.main }}
          >
            <HorsePieceSvg color={color} className="h-8 w-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <div className="truncate text-sm font-black text-amber-50">
                {player.name}
                {isMeOnline && <span className="ml-1 text-[10px] text-yellow-300">(Bạn)</span>}
              </div>
              {player.kicksCount > 0 && (
                <span
                  title="Số lần đá ngựa đối phương"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-black text-rose-200"
                >
                  <Swords className="h-2.5 w-2.5" />
                  {player.kicksCount}
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1">
              {isTurn ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9.5px] font-black text-stone-950">
                  ▶ ĐANG TỚI LƯỢT
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black text-white"
                  style={{ backgroundColor: vis.main }}
                >
                  {player.isBot && <Bot className="h-2.5 w-2.5" />}
                  {vis.shortName.toUpperCase()}
                </span>
              )}

              {onlineHuman && !onlineHuman.connected && (
                <span className="rounded-full bg-rose-950/90 px-1.5 py-0.5 text-[9px] font-black text-rose-200">
                  {onlineHuman.botTakeover
                    ? '🤖 Máy đỡ'
                    : `Mất mạng (${disconnectedLeftSec ?? 0}s)`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4 Bậc thắng 3–4–5–6 */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-extrabold text-amber-200">
            <span>Bụt thắng (3–6):</span>
            <span className="text-yellow-300">{winCount}/4</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {WINNING_STAIR_STEPS.map((step) => {
              const filled = occupiedSteps.has(step);
              return (
                <div
                  key={step}
                  className="flex h-[26px] items-center justify-center rounded-lg border text-xs font-black transition-all"
                  style={{
                    backgroundColor: filled ? vis.main : 'rgba(255,255,255,0.08)',
                    borderColor: filled ? '#FDE047' : 'rgba(255,255,255,0.2)',
                    color: filled ? '#FFFFFF' : '#A8A29E',
                    boxShadow: filled ? '0 0 8px rgba(253,224,71,0.35)' : undefined,
                  }}
                >
                  {step}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden text-white select-none"
      style={{
        background: 'linear-gradient(135deg, #9A612E 0%, #7C4A21 50%, #5B3314 100%)',
      }}
    >
      {/* Vân gỗ sồi ngang ấm */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(180deg, transparent 0px, transparent 62px, rgba(59,29,8,0.6) 62px, rgba(59,29,8,0.6) 64px)',
        }}
      />

      {/* NÚT CÔNG CỤ NỔI GÓC TRÊN TRÁI (BỎ HẲN THANH TIÊU ĐỀ "CỜ CÁ NGỰA" ĐỂ BÀN CỜ GIẤY PHÓNG TO TỐI ĐA!) */}
      <div className="pointer-events-auto absolute left-3 top-2.5 z-30 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            onBackToLobby();
          }}
          title="Quay lại sảnh Cờ Cá Ngựa"
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
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            setShowRules(true);
          }}
          title="Xem luật chơi chuẩn Việt Nam"
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
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}
          className="uiverse-push-btn uiverse-dome-shine flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-900 text-amber-950 cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #EAB308 100%)',
            boxShadow: '0 3px 0 #422006',
          }}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPushClick();
            setSpeedMult((v) => (v === 1 ? 2 : 1));
          }}
          title="Chuyển tốc độ diễn hoạt 1× / 2×"
          className="inline-flex h-8 items-center gap-1 rounded-full border border-amber-300/60 bg-stone-950/80 px-2.5 text-xs font-black text-amber-200 transition hover:bg-stone-900 cursor-pointer"
        >
          <Gauge className="h-3.5 w-3.5 text-amber-300" />
          {speedMult}×
        </button>
      </div>

      {/* NÚT GỢI Ý / MÃ PHÒNG ONLINE NỔI GÓC TRÊN PHẢI */}
      <div className="pointer-events-auto absolute right-3 top-2.5 z-30 flex items-center gap-2">
        {onlineContext && (
          <span className="inline-flex h-8 items-center gap-1 rounded-full border border-cyan-300/50 bg-stone-950/85 px-3 font-mono text-xs font-black text-amber-300 shadow">
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />#{onlineContext.roomCode}
          </span>
        )}
        {mode === 'vs-bot' ? (
          <button
            type="button"
            disabled={!canPickHorseNow}
            onClick={handleRequestHint}
            className="uiverse-push-btn uiverse-dome-shine inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-emerald-50 px-3 text-xs font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            style={{
              background: 'linear-gradient(180deg, #6EE7B7 0%, #10B981 100%)',
              boxShadow: '0 3px 0 #065F46',
            }}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Gợi ý
          </button>
        ) : (
          <div className="rounded-full border border-amber-300/45 bg-stone-950/75 px-3 py-1 text-xs font-black text-amber-200">
            Lượt #{canonicalState.turnCount}
          </div>
        )}
      </div>

      {/* KHU VỰC CHÍNH: TỜ GIẤY BÀN CỜ PHỦ TRỌN CHIỀU CAO MÀN HÌNH! */}
      <main className="relative z-10 mx-auto flex min-h-0 flex-1 w-full max-w-[1260px] items-center justify-center gap-4 px-3 py-1.5">
        {/* CỘT TRÁI: CHỈ 2 THẺ CHUỒNG ĐỎ (TRÊN) & XANH LÁ (DƯỚI) */}
        <aside className="flex h-full w-[224px] shrink-0 flex-col justify-between pb-2 pt-12">
          {renderPlayerCard('red')}
          {renderPlayerCard('green')}
        </aside>

        {/* BÀN CỜ GIẤY TRUYỀN THỐNG VIỆT NAM 15×15 TO HẾT CỠ (PHỦ GẦN 98% CHIỀU CAO!) */}
        <section
          ref={boardSectionRef}
          className={`relative aspect-square h-full max-h-[706px] shrink-0 rounded-[22px] p-0 shadow-[0_16px_38px_rgba(24,10,3,0.64)] transition-transform ${
            isBoardShaking ? 'animate-board-shake' : ''
          }`}
          style={{ contain: 'layout style paint' }}
        >
          {/* SVG NỀN BÀN CỜ + MŨI TÊN CHỈ ĐƯỜNG */}
          <svg
            viewBox={`0 0 ${BOARD_VIEWBOX} ${BOARD_VIEWBOX}`}
            className="h-full w-full rounded-[22px]"
          >
            <defs>
              <linearGradient id={`paper_${svgUid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="60%" stopColor="#FAF7F0" />
                <stop offset="100%" stopColor="#F2ECE1" />
              </linearGradient>
              {/* Đầu mũi tên dẫn đường vàng & xanh ngọc */}
              <marker
                id={`arrowGold_${svgUid}`}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M 0 0.8 L 7.2 4 L 0 7.2 Z" fill="#F59E0B" />
              </marker>
              <marker
                id={`arrowEmerald_${svgUid}`}
                markerWidth="9"
                markerHeight="9"
                refX="6.5"
                refY="4.5"
                orient="auto"
              >
                <path d="M 0 0.8 L 8 4.5 L 0 8.2 Z" fill="#10B981" />
              </marker>
              <marker
                id={`arrowKick_${svgUid}`}
                markerWidth="9"
                markerHeight="9"
                refX="6.5"
                refY="4.5"
                orient="auto"
              >
                <path d="M 0 0.8 L 8 4.5 L 0 8.2 Z" fill="#DC2626" />
              </marker>
            </defs>

            {/* Nền giấy trắng ngà */}
            <rect
              x="2"
              y="2"
              width={BOARD_VIEWBOX - 4}
              height={BOARD_VIEWBOX - 4}
              rx="20"
              fill={`url(#paper_${svgUid})`}
              stroke="#D6C7B2"
              strokeWidth="4"
            />

            {/* 4 CHUỒNG 4 GÓC */}
            {CLOCKWISE_COLORS.map((color) => {
              const cfg = HORSE_COLOR_CONFIG[color];
              const sx = BOARD_MARGIN + cfg.stableOrigin.col * CELL_SIZE + 3;
              const sy = BOARD_MARGIN + cfg.stableOrigin.row * CELL_SIZE + 3;
              const sw = 6 * CELL_SIZE - 6;
              const cx = sx + sw / 2;
              const cy = sy + sw / 2 + 4;
              const isActiveTurnStable =
                currentPlayer.color === color && canonicalState.phase !== 'GAME_OVER';
              const isPlaying = canonicalState.players.some((p) => p.color === color);

              return (
                <g key={color} opacity={isPlaying ? 1 : 0.45}>
                  <rect
                    x={sx}
                    y={sy}
                    width={sw}
                    height={sw}
                    rx="14"
                    fill="#FFFFFF"
                    stroke={cfg.main}
                    strokeWidth={isActiveTurnStable ? '4.4' : '3.2'}
                  />
                  <rect
                    x={sx + 6}
                    y={sy + 6}
                    width={sw - 12}
                    height={sw - 12}
                    rx="10"
                    fill={cfg.soft}
                    stroke={cfg.main}
                    strokeOpacity="0.35"
                    strokeWidth="1.2"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r="82"
                    fill="#FFFFFF"
                    stroke={cfg.main}
                    strokeWidth="2.8"
                  />
                  <g transform={`translate(${cx}, ${cy + 2}) scale(0.88)`} opacity="0.18" fill={cfg.main}>
                    <path d="M -44 12 C -32 0, -14 -12, 8 -14 C 18 -16, 26 -28, 34 -34 C 38 -37, 45 -33, 46 -27 C 47 -22, 42 -18, 36 -18 C 30 -14, 28 -4, 38 6 C 46 13, 49 21, 44 25 C 39 27, 32 20, 24 12 C 16 8, 6 10, -4 14 C -10 22, -18 32, -26 34 C -31 35, -31 28, -24 20 C -34 24, -46 25, -52 18 C -55 14, -49 12, -44 12 Z" />
                  </g>
                  <rect
                    x={cx - 58}
                    y={sy - 2}
                    width="116"
                    height="20"
                    rx="10"
                    fill={cfg.main}
                  />
                  <text
                    x={cx}
                    y={sy + 11.5}
                    textAnchor="middle"
                    fontFamily="'Be Vietnam Pro','Segoe UI',sans-serif"
                    fontSize="9.8"
                    fontWeight="900"
                    letterSpacing="0.5"
                    fill="#FFFFFF"
                  >
                    CHUỒNG {cfg.nameVi.toUpperCase()}
                  </text>

                  {cfg.stableSlots.map((slot, slotIdx) => {
                    const pt = gridCenterPx(slot.col, slot.row);
                    return (
                      <circle
                        key={slotIdx}
                        cx={pt.x}
                        cy={pt.y}
                        r="18"
                        fill={cfg.soft}
                        stroke={cfg.main}
                        strokeOpacity="0.55"
                        strokeWidth="1.8"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* 4 CẦU THANG BỤT 1–6 */}
            {CLOCKWISE_COLORS.map((color) => {
              const cfg = HORSE_COLOR_CONFIG[color];
              return cfg.stairCoords.map((coord, idx) => {
                const stepNum = idx + 1;
                const pt = gridCenterPx(coord.col, coord.row);
                const isWinStep = stepNum >= 3;
                const targetKey = `${color}:${stepNum}`;
                const isTarget = targetStairMoves.has(targetKey);
                const isPreview =
                  previewMove !== null &&
                  previewMove.color === color &&
                  previewMove.toStairStep === stepNum;

                return (
                  <g key={targetKey}>
                    <rect
                      x={pt.x - 16.8}
                      y={pt.y - 16.8}
                      width="33.6"
                      height="33.6"
                      rx="6"
                      fill={cfg.main}
                      stroke={isPreview ? '#34D399' : isWinStep ? '#FDE047' : '#FFFFFF'}
                      strokeWidth={isPreview ? '3.4' : isWinStep ? '2.2' : '1.2'}
                    />
                    {isTarget && (
                      <rect
                        x={pt.x - 19}
                        y={pt.y - 19}
                        width="38"
                        height="38"
                        rx="7.5"
                        fill="none"
                        stroke="#FACC15"
                        strokeWidth="2.6"
                        strokeDasharray="4 2"
                      />
                    )}
                    <text
                      x={pt.x}
                      y={pt.y + 6}
                      textAnchor="middle"
                      fontFamily="'Be Vietnam Pro','Segoe UI',sans-serif"
                      fontSize="16.5"
                      fontWeight="900"
                      fill="#FFFFFF"
                    >
                      {stepNum}
                    </text>
                  </g>
                );
              });
            })}

            {/* 52 Ô ĐƯỜNG ĐUA TRÒN */}
            {TRACK_GRID_COORDS.map((coord, idx) => {
              const pt = gridCenterPx(coord.col, coord.row);
              const ringColor = HORSE_COLOR_CONFIG[getTrackIndexRingColor(idx)];
              const startColor = isStartTrackIndex(idx);
              const safeDoorColor = isSafeDoorTrackIndex(idx);
              const targetMove = targetTrackMoves.get(idx);
              const isPreviewDest = previewMove?.toTrackIndex === idx;
              const isPreviewPath =
                previewMove !== null &&
                previewMove.stepTrackPath.includes(idx) &&
                previewMove.toTrackIndex !== idx;

              return (
                <g key={idx}>
                  {isPreviewPath && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="17.2"
                      fill="rgba(250, 204, 21, 0.28)"
                      stroke="#F59E0B"
                      strokeWidth="2"
                    />
                  )}

                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="14.8"
                    fill={
                      isPreviewDest
                        ? targetMove?.kickedHorseId
                          ? '#FEE2E2'
                          : '#FEF9C3'
                        : safeDoorColor
                          ? ringColor.soft
                          : '#FFFFFF'
                    }
                    stroke={
                      isPreviewDest
                        ? targetMove?.kickedHorseId
                          ? '#DC2626'
                          : '#10B981'
                        : ringColor.main
                    }
                    strokeWidth={isPreviewDest ? '3.5' : startColor || safeDoorColor ? '2.8' : '2.2'}
                  />

                  {startColor && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="10"
                      fill="none"
                      stroke={HORSE_COLOR_CONFIG[startColor].main}
                      strokeWidth="1.7"
                    />
                  )}

                  {safeDoorColor && (
                    <text
                      x={pt.x}
                      y={pt.y + 5.2}
                      textAnchor="middle"
                      fontFamily="'Segoe UI',sans-serif"
                      fontSize="14.5"
                      fontWeight="900"
                      fill={HORSE_COLOR_CONFIG[safeDoorColor].main}
                    >
                      ★
                    </text>
                  )}

                  {targetMove && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="18"
                      fill="none"
                      stroke={targetMove.kickedHorseId ? '#EF4444' : '#F59E0B'}
                      strokeWidth="2.6"
                      strokeDasharray="4 2.5"
                    />
                  )}
                </g>
              );
            })}

            {/* Đĩa gỗ/ngà trung tâm cho xúc xắc 3D to */}
            <circle
              cx={BOARD_VIEWBOX / 2}
              cy={BOARD_VIEWBOX / 2}
              r="34"
              fill="#F5ECE0"
              stroke="#C4B299"
              strokeWidth="2.8"
            />

            {/* CÁC MŨI TÊN DẪN ĐƯỜNG CHỈ RÕ NGỰA NÀO CÓ THỂ ĐI ĐẾN Ô NÀO */}
            {guideArrows.map((item, idx) => {
              const isKick = Boolean(item.move.kickedHorseId);
              const isHighlighted = item.highlighted;
              const strokeColor = isKick ? '#DC2626' : isHighlighted ? '#10B981' : '#F59E0B';
              const markerId = isKick
                ? `url(#arrowKick_${svgUid})`
                : isHighlighted
                  ? `url(#arrowEmerald_${svgUid})`
                  : `url(#arrowGold_${svgUid})`;
              const d = buildCurvedArrowPath(item.from, item.to, idx % 2 === 0 ? 1 : -1);

              return (
                <g key={`arrow_${item.move.horseId}`} opacity={isHighlighted ? 0.98 : 0.72}>
                  {/* Viền trắng ngoài cho mũi tên nổi rõ trên mọi màu nền */}
                  <path
                    d={d}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={isHighlighted ? '6.6' : '5'}
                    strokeLinecap="round"
                    opacity="0.72"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? '3.8' : '2.7'}
                    strokeLinecap="round"
                    strokeDasharray={isHighlighted ? '8 5' : '6 5'}
                    markerEnd={markerId}
                    className="animate-cash-arc"
                  />
                </g>
              );
            })}
          </svg>

          {/* LỚP TƯƠNG TÁC Ô ĐÍCH + NHÃN HÀNH ĐỘNG (ĐÁ! / XUẤT! / BỤT X / ★ AN TOÀN) */}
          {canPickHorseNow &&
            Array.from(targetTrackMoves.entries()).map(([trackIdx, move]) => {
              const coord = TRACK_GRID_COORDS[trackIdx];
              const { leftPct, topPct } = gridCenterPct(coord.col, coord.row);
              const badgeText = move.kickedHorseId
                ? '💥 ĐÁ!'
                : move.kind === 'DEPLOY'
                  ? '🐎 XUẤT!'
                  : move.toProgress === SAFE_DOOR_PROGRESS
                    ? '★ LÊN BỤT'
                    : null;

              return (
                <button
                  key={`dest_t_${trackIdx}`}
                  type="button"
                  onClick={() =>
                    void commitAction({ type: 'EXECUTE_MOVE', horseId: move.horseId }, mode === 'online')
                  }
                  onMouseEnter={() => setHoveredHorseId(move.horseId)}
                  onMouseLeave={() => setHoveredHorseId(null)}
                  title={move.kickedHorseId ? 'Chạm để ĐÁ ngựa đối phương!' : 'Chạm để di chuyển tới ô này'}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: '6.8%',
                    height: '6.8%',
                  }}
                >
                  {badgeText && (
                    <span
                      className={`pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-black text-white shadow-md ${
                        move.kickedHorseId
                          ? 'bg-red-600'
                          : move.kind === 'DEPLOY'
                            ? 'bg-emerald-600'
                            : 'bg-amber-600'
                      }`}
                    >
                      {badgeText}
                    </span>
                  )}
                </button>
              );
            })}

          {canPickHorseNow &&
            Array.from(targetStairMoves.entries()).map(([key, move]) => {
              const coord = HORSE_COLOR_CONFIG[move.color].stairCoords[move.toStairStep - 1];
              const { leftPct, topPct } = gridCenterPct(coord.col, coord.row);
              return (
                <button
                  key={`dest_s_${key}`}
                  type="button"
                  onClick={() =>
                    void commitAction({ type: 'EXECUTE_MOVE', horseId: move.horseId }, mode === 'online')
                  }
                  onMouseEnter={() => setHoveredHorseId(move.horseId)}
                  onMouseLeave={() => setHoveredHorseId(null)}
                  title={`Chạm để lên Bụt số ${move.toStairStep}`}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-lg cursor-pointer"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: '6.6%',
                    height: '6.6%',
                  }}
                >
                  <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-stone-950 shadow">
                    🏆 Bụt {move.toStairStep}
                  </span>
                </button>
              );
            })}

          {/* LỚP 16 QUÂN CÁ NGỰA 2.5D TO RÕ + MŨI TÊN CHỈ QUÂN CÓ THỂ ĐI */}
          {playbackHorses.map((horse) => {
            // Ẩn quân ngựa tĩnh khi nó đang bay parabol trên lớp FlyingFx!
            if (flyingFx && flyingFx.horseId === horse.id) return null;

            const coord = getHorseVisualCoord(horse);
            const { leftPct, topPct } = gridCenterPct(coord.col, coord.row);
            const legalMove = legalMoveByHorseId.get(horse.id);
            const selectable = Boolean(legalMove);
            const isHinted = hintResult?.move.horseId === horse.id;
            const isHopping = hoppingHorseId === horse.id;
            const isSelectedHover = hoveredHorseId === horse.id;

            return (
              <button
                key={horse.id}
                type="button"
                disabled={!selectable}
                onClick={() => {
                  if (!selectable) return;
                  void commitAction({ type: 'EXECUTE_MOVE', horseId: horse.id }, mode === 'online');
                }}
                onMouseEnter={() => selectable && setHoveredHorseId(horse.id)}
                onMouseLeave={() => selectable && setHoveredHorseId(null)}
                aria-label={`Ngựa ${HORSE_COLOR_CONFIG[horse.color].nameVi} số ${horse.slotIndex + 1}`}
                className={`absolute flex items-center justify-center transition-all duration-150 ${
                  selectable
                    ? 'z-30 cursor-pointer hover:scale-[1.18]'
                    : isHopping
                      ? 'z-30'
                      : 'z-20 pointer-events-none'
                }`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: '10.4%',
                  height: '10.4%',
                  transform: `translate(-50%, ${isHopping ? '-84%' : isSelectedHover ? '-68%' : '-58%'}) scale(${
                    isHopping ? 1.2 : 1
                  })`,
                }}
              >
                {/* Mũi tên chỉ rõ quân ngựa này có thể đi ngay! */}
                {selectable && !isHopping && (
                  <span
                    className={`pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce ${
                      isHinted ? 'text-emerald-400' : 'text-yellow-300'
                    }`}
                  >
                    <span
                      className={`rounded-full border px-1.5 py-[1px] text-[9px] font-black shadow-md ${
                        isHinted
                          ? 'border-emerald-950 bg-emerald-400 text-emerald-950'
                          : 'border-amber-950 bg-yellow-300 text-amber-950'
                      }`}
                    >
                      {isHinted ? '💡▼' : '▼'}
                    </span>
                  </span>
                )}

                <HorsePieceSvg
                  color={horse.color}
                  selectable={selectable}
                  selected={isSelectedHover}
                  hinted={isHinted}
                  className="h-full w-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.34)]"
                />
              </button>
            );
          })}

          {/* LỚP NGỰA ĐANG BAY PARABOL THUẦN GPU DOM REF (0 React re-render suốt chuyến bay!) */}
          {flyingFx && (
            <div
              ref={flyingWrapRef}
              className="pointer-events-none absolute left-0 top-0 z-40 flex items-center justify-center will-change-transform"
              style={{
                width: '9.6%',
                height: '9.6%',
                transform: `translate3d(${((boardSectionRef.current?.clientWidth || 600) * flyingFx.initialLeftPct) / 100}px, ${((boardSectionRef.current?.clientHeight || 600) * flyingFx.initialTopPct) / 100}px, 0) translate(-50%, -56%)`,
              }}
            >
              {/* Bóng đổ mặt đất nằm dưới quỹ đạo bay (dùng radial-gradient thay blur) */}
              <span
                ref={flyingShadowRef}
                className="absolute bottom-1 h-4 w-9 rounded-full"
                style={{
                  background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 75%)',
                  transform: 'scale(0.8)',
                  willChange: 'transform',
                }}
              />
              <div
                ref={flyingBodyRef}
                className="h-full w-full"
                style={{
                  transform: 'translate3d(0, 0px, 0) scale(1) rotate(0deg)',
                  willChange: 'transform',
                }}
              >
                <HorsePieceSvg
                  color={flyingFx.color}
                  className="h-full w-full drop-shadow-[0_10px_10px_rgba(0,0,0,0.45)]"
                />
              </div>
            </div>
          )}

          {/* HIỆU ỨNG SÓNG VA CHẠM / HÀO QUANG LÊN BỤT / XUẤT CHUỒNG TẠI Ô ĐÍCH */}
          {impactBurst && (
            <div
              key={impactBurst.id}
              className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${impactBurst.leftPct}%`,
                top: `${impactBurst.topPct}%`,
              }}
            >
              <div
                className={`h-14 w-14 rounded-full border-4 animate-oaq-shock-ring ${
                  impactBurst.tone === 'kick'
                    ? 'border-red-500 bg-yellow-300/35'
                    : impactBurst.tone === 'stairs'
                      ? 'border-yellow-300 bg-amber-400/35'
                      : impactBurst.tone === 'safe'
                        ? 'border-cyan-300 bg-cyan-400/30'
                        : 'border-emerald-400 bg-emerald-300/30'
                }`}
              />
              <div
                className={`absolute left-1/2 top-0 whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-[11px] font-black shadow-xl animate-oaq-bop-pop ${
                  impactBurst.tone === 'kick'
                    ? 'border-yellow-200 bg-red-600 text-white'
                    : impactBurst.tone === 'stairs'
                      ? 'border-amber-950 bg-yellow-300 text-amber-950'
                      : impactBurst.tone === 'safe'
                        ? 'border-cyan-100 bg-cyan-600 text-white'
                        : 'border-emerald-100 bg-emerald-600 text-white'
                }`}
              >
                {impactBurst.label}
              </div>
            </div>
          )}

          {/* XÚC XẮC 3D LỚN NHẢY RỚT NHƯ CỜ TỶ PHÚ NGAY TRUNG TÂM BÀN CỜ (7,7) */}
          <div className="absolute left-1/2 top-1/2 z-[35] -translate-x-1/2 -translate-y-1/2">
            <Dice3DWidget
              value={displayDiceValue}
              rollSeq={diceRollSeq}
              speedMult={speedMult}
              canRoll={canRollNow}
              onRoll={() => void commitAction({ type: 'ROLL_DICE' }, mode === 'online')}
              size={56}
            />
          </div>

          {/* BIỂU NGỮ SỰ KIỆN NỔI HOẶC GỢI Ý AI GỌN ĐẸP Ở MÉP TRÊN BÀN */}
          {(floatingBanner || hintResult) && (
            <div className="pointer-events-none absolute left-1/2 top-2.5 z-40 -translate-x-1/2">
              {floatingBanner ? (
                <div
                  className={`whitespace-nowrap rounded-full border-2 px-4 py-1 text-xs font-black tracking-wide shadow-2xl ${
                    floatingBanner.tone === 'kick'
                      ? 'border-yellow-300 bg-red-600 text-white'
                      : floatingBanner.tone === 'gold'
                        ? 'border-amber-950 bg-yellow-300 text-amber-950'
                        : floatingBanner.tone === 'good'
                          ? 'border-emerald-200 bg-emerald-600 text-white'
                          : 'border-amber-200/70 bg-stone-950/92 text-amber-100'
                  }`}
                >
                  {floatingBanner.text}
                </div>
              ) : hintResult ? (
                <div className="max-w-[440px] rounded-2xl border-2 border-emerald-300 bg-emerald-950/95 px-3.5 py-1.5 text-center text-xs font-black text-emerald-100 shadow-2xl">
                  💡 {hintResult.explanationVi}
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* CỘT PHẢI: CHỈ 2 THẺ CHUỒNG VÀNG (TRÊN) & XANH DƯƠNG (DƯỚI) */}
        <aside className="flex h-full w-[224px] shrink-0 flex-col justify-between pb-2 pt-12">
          {renderPlayerCard('yellow')}
          {renderPlayerCard('blue')}
        </aside>
      </main>

      {showRules && <CoCaNguaRulesModal onClose={() => setShowRules(false)} />}
      {canonicalState.phase === 'GAME_OVER' && (
        <CoCaNguaVictoryModal
          state={canonicalState}
          isOnline={mode === 'online'}
          onPlayAgain={onRestartLocal}
          onBackToLobby={onBackToLobby}
        />
      )}
    </div>
  );
}
