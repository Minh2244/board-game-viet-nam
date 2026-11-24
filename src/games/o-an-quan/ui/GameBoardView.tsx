import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Gauge,
  Lightbulb,
  Maximize2,
  Minimize2,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAudioStore } from '@/shared/audio/soundEngine';
import { useLandscapeStage } from '@/shared/ui/LandscapeViewport';
import { computeBestHint, computeBotMove, type EvaluatedMoveChoice } from '../ai/smartBot';
import { oAnQuanAudio } from '../audio/oAnQuanAudio';
import {
  OAnQuanCharacterArt,
  WovenBasketSvg,
  type CharacterMood,
} from '../data/characters';
import { pickFolkDialogue } from '../data/dialogues';
import { executeSowMove } from '../engine/reducer';
import {
  getOwnedPitIndices,
  getTotalGamePoints,
  getVisualBoardLayout,
  isMandarinPitIndex,
  validateSowAction,
  visualHorizontalToSowDirection,
} from '../engine/rules';
import type {
  BotDifficulty,
  OAnQuanAnimStep,
  OAnQuanState,
  PitState,
  PlayerMatchState,
  PlayerSide,
  SowDirection,
} from '../engine/types';
import { clearOfflineOAnQuanMatch, saveOfflineOAnQuanMatch } from '../lobby/offlineSave';
import {
  ONLINE_DISCONNECT_GRACE_MS,
  type OAnQuanRoomSnapshot,
  type RemoteOAnQuanMoveEvent,
} from '../network/onlineRoomClient';
import { CourtyardBackground } from './CourtyardArt';
import {
  HandActorOverlay,
  type ActiveHandActor,
  type DropRipple,
  type SlapShockwave,
} from './HandActorOverlay';
import { OAnQuanRulesModal, OAnQuanVictoryModal } from './Modals';
import { StonePitCell } from './StonePitCell';

export interface OAnQuanOnlineContext {
  roomCode: string;
  localSide: PlayerSide; // 0: Chủ phòng, 1: Khách (tự xoay góc nhìn POV 180°!)
  isHost: boolean;
  snapshot: OAnQuanRoomSnapshot;
  onCommitLocalMove: (
    side: PlayerSide,
    pitIndex: number,
    direction: SowDirection,
    nextState: OAnQuanState,
  ) => void;
  onSyncRemoteVerifiedState: (verifiedState: OAnQuanState, matchVersion: number) => void;
  registerRemoteMoveHandler: (fn: (ev: RemoteOAnQuanMoveEvent) => void) => () => void;
  onDissolveRoom: () => void;
}

interface GameBoardViewProps {
  initialState: OAnQuanState;
  mode: 'vs-bot' | 'pass-and-play' | 'online';
  botDifficulty: BotDifficulty;
  onlineContext?: OAnQuanOnlineContext;
  onRestartLocal: () => void;
  onBackToLobby: () => void;
}

interface ActiveHighlight {
  pitIndex: number;
  tone: 'pickup' | 'drop' | 'capture' | 'refill' | 'empty-bridge';
}

export function GameBoardView({
  initialState,
  mode,
  botDifficulty,
  onlineContext,
  onRestartLocal,
  onBackToLobby,
}: GameBoardViewProps) {
  // Tách biệt hoàn toàn Canonical GameState và Animation Playback State
  const [canonicalState, setCanonicalState] = useState<OAnQuanState>(initialState);
  const canonicalRef = useRef<OAnQuanState>(initialState);
  const [playbackPits, setPlaybackPits] = useState<PitState[]>(initialState.pits);
  const [playbackPlayers, setPlaybackPlayers] = useState<[PlayerMatchState, PlayerMatchState]>(
    initialState.players,
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);

  const [selectedPitIdx, setSelectedPitIdx] = useState<number | null>(null);
  const [speedMult, setSpeedMult] = useState<1 | 2>(1);
  const speedRef = useRef<1 | 2>(1);
  speedRef.current = speedMult;

  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null);
  const [bridgeEmptyIdx, setBridgeEmptyIdx] = useState<number | null>(null);
  const [handBanner, setHandBanner] = useState<{
    text: string;
    tone: 'gold' | 'emerald' | 'cyan';
  } | null>(null);

  // Trạng thái Bàn Tay Chibi 2.5D (cầm đá, lụm đá, rải đá, đập tay BỐP! và quét vào giỏ)
  const [activeHand, setActiveHand] = useState<ActiveHandActor | null>(null);
  const [slapShockwave, setSlapShockwave] = useState<SlapShockwave | null>(null);
  const [dropRipple, setDropRipple] = useState<DropRipple | null>(null);
  const [isBoardShaking, setIsBoardShaking] = useState(false);

  const stageRootRef = useRef<HTMLDivElement | null>(null);
  const leftBasketRef = useRef<HTMLDivElement | null>(null);
  const rightBasketRef = useRef<HTMLDivElement | null>(null);
  const fxSeqRef = useRef(1);
  const { toLocalRect } = useLandscapeStage();

  const [hintResult, setHintResult] = useState<EvaluatedMoveChoice | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nowClock, setNowClock] = useState(() => Date.now());

  // Cảm xúc & bong bóng thoại của 2 bé Cu Tí / Bé Mít (tự ẩn sau ~2.2s)
  const [moods, setMoods] = useState<[CharacterMood, CharacterMood]>(['idle', 'idle']);
  const [bubbles, setBubbles] = useState<[string | null, string | null]>([null, null]);
  const bubbleTimersRef = useRef<[ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]>([
    null,
    null,
  ]);

  const remoteQueueRef = useRef<RemoteOAnQuanMoveEvent[]>([]);
  const onlineContextRef = useRef(onlineContext);
  onlineContextRef.current = onlineContext;
  const mountedRef = useRef(true);

  const { muted, toggleMute } = useAudioStore();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      bubbleTimersRef.current.forEach((t) => t && clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (!onlineContext) return;
    const t = setInterval(() => setNowClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, [onlineContext]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Ignore on unsupported browsers
    }
  }, []);

  const showCharacterReaction = useCallback(
    (side: PlayerSide, mood: CharacterMood, text: string, durationMs = 2300) => {
      setMoods((prev) => (side === 0 ? [mood, prev[1]] : [prev[0], mood]));
      setBubbles((prev) => (side === 0 ? [text, prev[1]] : [prev[0], text]));
      const existing = bubbleTimersRef.current[side];
      if (existing) clearTimeout(existing);
      bubbleTimersRef.current[side] = setTimeout(() => {
        if (!mountedRef.current) return;
        setBubbles((prev) => (side === 0 ? [null, prev[1]] : [prev[0], null]));
        setMoods((prev) => (side === 0 ? ['idle', prev[1]] : [prev[0], 'idle']));
      }, durationMs);
    },
    [],
  );

  // Góc nhìn POV 180°: Trong chế độ Online, Khách (localSide === 1) nhìn thấy 5 ô của mình ở hàng dưới!
  const viewerSide: PlayerSide = onlineContext ? onlineContext.localSide : 0;
  const boardLayout = useMemo(() => getVisualBoardLayout(viewerSide), [viewerSide]);

  // Nhân vật bên TRÁI luôn đại diện cho Hàng Dưới (Phe của mình); Nhân vật bên PHẢI đại diện cho Hàng Trên (Đối thủ)
  const leftPlayerSide: PlayerSide = viewerSide;
  const rightPlayerSide: PlayerSide = viewerSide === 0 ? 1 : 0;
  const leftPlayer = playbackPlayers[leftPlayerSide];
  const rightPlayer = playbackPlayers[rightPlayerSide];

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, Math.max(45, Math.round(ms / speedRef.current))));

  const triggerBoardShake = useCallback(() => {
    setIsBoardShaking(true);
    setTimeout(() => {
      if (mountedRef.current) setIsBoardShaking(false);
    }, 280);
  }, []);

  /** Lấy tọa độ tâm (x, y) chuẩn trong hệ tọa độ sân khấu ngang 1220×686 (hoạt động chuẩn cả khi điện thoại xoay 90°) */
  const getPitCenter = useCallback(
    (pitIndex: number): { x: number; y: number } | null => {
      const root = stageRootRef.current;
      if (!root) return null;
      const el = root.querySelector<HTMLElement>(`[data-pit-index="${pitIndex}"]`);
      const rect = toLocalRect(el);
      return rect ? { x: rect.cx, y: rect.cy } : null;
    },
    [toLocalRect],
  );

  const getBasketCenter = useCallback(
    (side: PlayerSide): { x: number; y: number } | null => {
      const el = side === leftPlayerSide ? leftBasketRef.current : rightBasketRef.current;
      const rect = toLocalRect(el);
      return rect ? { x: rect.cx, y: rect.cy } : null;
    },
    [leftPlayerSide, toLocalRect],
  );

  /** Phát chuỗi diễn hoạt OAnQuanAnimStep[] chậm rãi, rõ nét từng nhịp: Xòe tay -> Co nắm lụm đá -> Lướt & Nhả từng viên -> Giơ cao Đập BỐP! -> Quét vào giỏ */
  const playAnimationSteps = useCallback(
    async (steps: readonly OAnQuanAnimStep[], finalState: OAnQuanState) => {
      let dropSeq = 0;

      for (const step of steps) {
        if (!mountedRef.current) return;

        switch (step.type) {
          case 'REFILL_FIVE_PITS': {
            const actorChar = finalState.players[step.side].characterId;
            const fromTop = step.side !== viewerSide;
            const owned = getOwnedPitIndices(step.side);
            const basketPos = getBasketCenter(step.side);

            setHandBanner({
              text:
                step.borrowedFromOpponent > 0
                  ? `🌱 ${finalState.players[step.side].name} rải lại 5 dân (vay ${step.borrowedFromOpponent} dân đối thủ)`
                  : `🌱 ${finalState.players[step.side].name} trích 5 dân rải lại 5 ô sân nhà`,
              tone: 'emerald',
            });
            showCharacterReaction(
              step.side,
              step.borrowedFromOpponent > 0 ? 'worried' : 'thinking',
              pickFolkDialogue(step.borrowedFromOpponent > 0 ? 'refill_borrow' : 'refill_self'),
            );

            if (basketPos) {
              setActiveHand({
                x: basketPos.x,
                y: basketPos.y,
                pose: 'scoop_grab',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: 5,
                holdingMandarin: false,
                transitionMs: Math.round(240 / speedRef.current),
              });
              await sleep(280);
            }

            oAnQuanAudio.playRefillStones();
            for (let i = 0; i < owned.length; i += 1) {
              if (!mountedRef.current) return;
              const pIdx = owned[i];
              const pt = getPitCenter(pIdx);
              if (pt) {
                setActiveHand({
                  x: pt.x,
                  y: pt.y,
                  pose: 'carry_hold',
                  poseKey: ++fxSeqRef.current,
                  characterId: actorChar,
                  fromTop,
                  stonesInHand: 5 - i,
                  holdingMandarin: false,
                  transitionMs: Math.round(200 / speedRef.current),
                });
                await sleep(170);
                if (!mountedRef.current) return;
                setActiveHand({
                  x: pt.x,
                  y: pt.y,
                  pose: 'drop_pinch',
                  poseKey: ++fxSeqRef.current,
                  characterId: actorChar,
                  fromTop,
                  stonesInHand: 4 - i,
                  holdingMandarin: false,
                  transitionMs: 90,
                });
                setDropRipple({ id: ++fxSeqRef.current, x: pt.x, y: pt.y });
              }
              setActiveHighlight({ pitIndex: pIdx, tone: 'refill' });
              await sleep(170);
            }

            setPlaybackPits(step.pitsSnapshot);
            setPlaybackPlayers(step.playersSnapshot);
            await sleep(280);
            break;
          }

          case 'PICKUP_PIT': {
            const actorChar = finalState.players[step.side].characterId;
            const fromTop = step.side !== viewerSide;
            const pt = getPitCenter(step.pitIndex);

            setBridgeEmptyIdx(null);
            setActiveHighlight({ pitIndex: step.pitIndex, tone: 'pickup' });
            setHandBanner({
              text: step.isChainContinue
                ? `🔄 BỐC NỐI VÒNG (+${step.stoneCount} viên trên tay)!`
                : `✋ Xòe tay lụm ${step.stoneCount} viên sỏi tại Ô ${step.pitIndex + 1}...`,
              tone: step.isChainContinue ? 'cyan' : 'gold',
            });

            if (pt) {
              // Pha 1: Bàn tay XÒE RỘNG 5 NGÓN bay từ từ tới trên miệng ô
              setActiveHand({
                x: pt.x,
                y: pt.y,
                pose: 'reach_open',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: 0,
                holdingMandarin: false,
                transitionMs: Math.round(280 / speedRef.current),
              });
              await sleep(260);
              if (!mountedRef.current) return;

              // Pha 2: CO CỤP 5 NGÓN NẮM CHẶT ĐÁ LÊN TAY!
              oAnQuanAudio.playStonePickup(step.isChainContinue, step.stoneCount);
              setPlaybackPits(step.pitsSnapshot);
              setActiveHand({
                x: pt.x,
                y: pt.y,
                pose: 'scoop_grab',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: step.stoneCount,
                holdingMandarin: false,
                transitionMs: 110,
              });
              await sleep(step.isChainContinue ? 360 : 320);
            } else {
              oAnQuanAudio.playStonePickup(step.isChainContinue, step.stoneCount);
              setPlaybackPits(step.pitsSnapshot);
              await sleep(340);
            }
            break;
          }

          case 'DROP_STONE': {
            dropSeq += 1;
            const actorChar = finalState.players[step.side].characterId;
            const fromTop = step.side !== viewerSide;
            const pt = getPitCenter(step.pitIndex);

            if (pt) {
              // Pha 1: Cầm đá LƯỚT CHẬM RÃI tới ô kế tiếp
              setActiveHand({
                x: pt.x,
                y: pt.y,
                pose: 'carry_hold',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: step.remainingInHand + 1,
                holdingMandarin: false,
                transitionMs: Math.round(240 / speedRef.current),
              });
              await sleep(225);
              if (!mountedRef.current) return;

              // Pha 2: MỞ NHẸ NGÓN TRỎ & NGÓN CÁI THẢ 1 VIÊN ĐÁ RƠI XUỐNG HỐ!
              oAnQuanAudio.playStoneDrop(dropSeq, isMandarinPitIndex(step.pitIndex));
              setPlaybackPits(step.pitsSnapshot);
              setActiveHighlight({ pitIndex: step.pitIndex, tone: 'drop' });
              setDropRipple({ id: ++fxSeqRef.current, x: pt.x, y: pt.y });
              setActiveHand({
                x: pt.x,
                y: pt.y,
                pose: 'drop_pinch',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: step.remainingInHand,
                holdingMandarin: false,
                transitionMs: 90,
              });
            } else {
              oAnQuanAudio.playStoneDrop(dropSeq, isMandarinPitIndex(step.pitIndex));
              setPlaybackPits(step.pitsSnapshot);
              setActiveHighlight({ pitIndex: step.pitIndex, tone: 'drop' });
            }

            setHandBanner({
              text:
                step.remainingInHand > 0
                  ? `✋ Đang rải sỏi · Còn ${step.remainingInHand} viên trên tay`
                  : `✨ Vừa thả viên sỏi cuối cùng tại Ô ${step.pitIndex + 1}`,
              tone: 'gold',
            });
            await sleep(220);
            break;
          }

          case 'CAPTURE_PIT': {
            const qVal = finalState.rules.mandarinPointValue ?? 10;
            const pts = (step.mandarinTaken ? qVal : 0) + step.stonesTaken;
            const actorChar = finalState.players[step.side].characterId;
            const fromTop = step.side !== viewerSide;
            const emptyPt = getPitCenter(step.emptyPitIndex);
            const targetPt = getPitCenter(step.capturedPitIndex);
            const basketPt = getBasketCenter(step.side);
            const slapLabel = step.comboIndex >= 2 ? `BỐP ×${step.comboIndex}!` : 'BỐP!';

            // PHA A: VUNG BÀN TAY XÒE CĂNG LÊN CAO (giữ rõ trên không trung) RỒI ĐẬP MẠNH "BỐP!" XUỐNG Ô TRỐNG!
            setBridgeEmptyIdx(step.emptyPitIndex);
            setActiveHighlight({ pitIndex: step.capturedPitIndex, tone: 'capture' });
            setHandBanner({
              text: `💥 VUNG TAY ĐẬP Ô TRỐNG ĂN QUÂN${step.comboIndex >= 2 ? ` (COMBO ×${step.comboIndex})` : ''}!`,
              tone: 'gold',
            });

            if (emptyPt) {
              // 1. Giơ bàn tay xòe to lên cao trên ô trống
              setActiveHand({
                x: emptyPt.x,
                y: emptyPt.y,
                pose: 'slap_windup',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: 0,
                holdingMandarin: false,
                transitionMs: Math.round(280 / speedRef.current),
              });
              await sleep(320);
              if (!mountedRef.current) return;

              // 2. Đập thẳng xuống mặt gỗ + Âm thanh BỐP! + Sóng đôi + Tia va chạm + Rung bàn cờ
              oAnQuanAudio.playHandSlap(step.comboIndex);
              triggerBoardShake();
              setActiveHand({
                x: emptyPt.x,
                y: emptyPt.y,
                pose: 'slap_impact',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: 0,
                holdingMandarin: false,
                transitionMs: 70,
              });
              setSlapShockwave({
                id: ++fxSeqRef.current,
                x: emptyPt.x,
                y: emptyPt.y,
                label: slapLabel,
              });
              await sleep(380);
            } else {
              oAnQuanAudio.playHandSlap(step.comboIndex);
              triggerBoardShake();
              await sleep(280);
            }

            if (!mountedRef.current) return;
            setSlapShockwave(null);

            // PHA B: LƯỚT SANG Ô BỊ ĂN -> XÒE TAY -> CO CỤP NẮM TRỌN SỎI (+ VIÊN NGỌC QUAN)
            if (targetPt) {
              setActiveHand({
                x: targetPt.x,
                y: targetPt.y,
                pose: 'reach_open',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: 0,
                holdingMandarin: false,
                transitionMs: Math.round(240 / speedRef.current),
              });
              await sleep(220);
              if (!mountedRef.current) return;

              setActiveHand({
                x: targetPt.x,
                y: targetPt.y,
                pose: 'scoop_grab',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: step.stonesTaken,
                holdingMandarin: step.mandarinTaken,
                transitionMs: 110,
                floatingPoints: `+${pts}đ!`,
              });
            }

            setPlaybackPits(step.pitsSnapshot);
            if (step.mandarinTaken) {
              oAnQuanAudio.playMandarinCapture();
            } else {
              oAnQuanAudio.playCapture(step.comboIndex, step.stonesTaken);
            }

            setHandBanner({
              text: step.mandarinTaken
                ? `💎 HỐT TRỌN Ổ QUAN! +${pts} ĐIỂM${step.comboIndex >= 2 ? ` (COMBO ×${step.comboIndex})` : ''}!`
                : step.comboIndex >= 2
                  ? `🔥 COMBO ĂN LIÊN HOÀN ×${step.comboIndex}! +${pts} ĐIỂM!`
                  : `✨ ĂN GỌN +${pts} ĐIỂM!`,
              tone: 'emerald',
            });

            const oppSide: PlayerSide = step.side === 0 ? 1 : 0;
            if (step.mandarinTaken) {
              showCharacterReaction(step.side, 'excited', pickFolkDialogue('mandarin'), 2600);
              showCharacterReaction(oppSide, 'worried', pickFolkDialogue('lost_mandarin'), 2500);
            } else if (step.comboIndex >= 2) {
              showCharacterReaction(step.side, 'excited', pickFolkDialogue('combo'), 2400);
            } else {
              showCharacterReaction(step.side, 'happy', pickFolkDialogue('capture'), 2100);
            }

            await sleep(280);
            if (!mountedRef.current) return;

            // PHA C: ÔM TRỌN CHIẾN LỢI PHẨM BAY TỪ TỪ VỀ GIỎ TRE RỒI XÒE TAY THẢ VÀO GIỎ!
            if (basketPt) {
              setActiveHand({
                x: basketPt.x,
                y: basketPt.y,
                pose: 'sweep_capture',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: step.stonesTaken,
                holdingMandarin: step.mandarinTaken,
                transitionMs: Math.round(440 / speedRef.current),
                floatingPoints: `+${pts}đ!`,
              });
              await sleep(450);
              if (!mountedRef.current) return;

              // Mở tay thả quân vào giỏ
              setActiveHand({
                x: basketPt.x,
                y: basketPt.y,
                pose: 'reach_open',
                poseKey: ++fxSeqRef.current,
                characterId: actorChar,
                fromTop,
                stonesInHand: 0,
                holdingMandarin: false,
                transitionMs: 120,
              });
            }

            setPlaybackPlayers(step.playersSnapshot);
            await sleep(step.mandarinTaken ? 360 : 240);
            break;
          }

          case 'AUTO_REPAY_DEBT': {
            setActiveHand(null);
            setPlaybackPlayers(step.playersSnapshot);
            setHandBanner({
              text: `🤝 Tự động trích ${step.repaidDan} dân vừa ăn để trả nợ vật lý!`,
              tone: 'cyan',
            });
            showCharacterReaction(step.debtorSide, 'happy', pickFolkDialogue('repaid_debt'));
            await sleep(560);
            break;
          }

          case 'STOP_TURN': {
            setActiveHand(null);
            oAnQuanAudio.playStopTurn();
            setActiveHighlight({ pitIndex: step.stopPitIndex, tone: 'drop' });
            const reasonText =
              step.reason === 'HIT_MANDARIN_PIT'
                ? '⛔ Đụng Ô Quan đang có quân — Dừng lượt!'
                : step.reason === 'BLOCKED_BY_YOUTH_MANDARIN'
                  ? '🛡️ Quan Non (< 5 dân) — Chưa được ăn!'
                  : step.reason === 'TWO_EMPTY'
                    ? '⏸️ Gặp 2 ô trống liên tiếp — Hết lượt!'
                    : '✅ Hoàn tất chuỗi ăn — Chuyển lượt!';
            setHandBanner({ text: reasonText, tone: 'gold' });
            await sleep(420);
            break;
          }

          case 'SWEEP_REMAINING': {
            setActiveHand(null);
            oAnQuanAudio.playVictoryFanfare();
            setPlaybackPits(step.pitsSnapshot);
            setPlaybackPlayers(step.playersSnapshot);
            setHandBanner({
              text:
                step.endReason === 'BOTH_MANDARINS_EMPTY'
                  ? '🏆 Hết Quan, tàn dân, thu quân kéo về!'
                  : '🏁 Bế tắc không đủ 5 dân rải lại — Tổng kết ván!',
              tone: 'emerald',
            });
            await sleep(680);
            break;
          }
        }
      }

      if (!mountedRef.current) return;
      setActiveHand(null);
      setSlapShockwave(null);
      setDropRipple(null);
      setActiveHighlight(null);
      setBridgeEmptyIdx(null);
      setHandBanner(null);
      setPlaybackPits(finalState.pits);
      setPlaybackPlayers(finalState.players);
      setCanonicalState(finalState);
    },
    [showCharacterReaction, viewerSide, getPitCenter, getBasketCenter, triggerBoardShake],
  );

  /** Thực thi 1 nước đi (cả cục bộ lẫn từ xa qua Online sau khi xác thực validateSowAction) */
  const dispatchMove = useCallback(
    async (
      pitIndex: number,
      direction: SowDirection,
      options?: { isRemote?: boolean; actorSide?: PlayerSide; remoteMatchVersion?: number },
    ) => {
      if (isAnimatingRef.current) return;
      const curState = canonicalRef.current;
      const actorSide = options?.actorSide ?? curState.currentSide;

      // Xác thực chặt chẽ mọi nước đi (cả Offline lẫn Online) qua validateSowAction
      const validCheck = validateSowAction(curState, actorSide, pitIndex, direction);
      if (!validCheck.valid) {
        return;
      }

      isAnimatingRef.current = true;
      setIsAnimating(true);
      setSelectedPitIdx(null);
      setHintResult(null);

      const { state: nextState, steps } = executeSowMove(curState, pitIndex, direction, actorSide);
      canonicalRef.current = nextState;

      // Lưu ván Offline tự động (hoặc phát tán nước đi lên phòng Online)
      const online = onlineContextRef.current;
      if (online) {
        if (!options?.isRemote) {
          online.onCommitLocalMove(actorSide, pitIndex, direction, nextState);
        } else if (options.remoteMatchVersion !== undefined) {
          online.onSyncRemoteVerifiedState(nextState, options.remoteMatchVersion);
        }
      } else if (mode === 'vs-bot' || mode === 'pass-and-play') {
        if (nextState.phase === 'GAME_OVER') {
          clearOfflineOAnQuanMatch();
        } else {
          saveOfflineOAnQuanMatch({ mode, botDifficulty, state: nextState });
        }
      }

      await playAnimationSteps(steps, nextState);

      if (!mountedRef.current) return;

      // Xử lý nối tiếp nước đi Online đang xếp hàng (nếu có)
      const queued = remoteQueueRef.current.shift();
      if (queued) {
        isAnimatingRef.current = false;
        void dispatchMove(queued.pitIndex, queued.direction, {
          isRemote: true,
          actorSide: queued.side,
          remoteMatchVersion: queued.matchVersion,
        });
      } else {
        isAnimatingRef.current = false;
        setIsAnimating(false);
      }
    },
    [mode, botDifficulty, playAnimationSteps],
  );

  // Đăng ký lắng nghe nước đi Online từ đối thủ
  useEffect(() => {
    if (!onlineContext) return;
    return onlineContext.registerRemoteMoveHandler((ev) => {
      if (isAnimatingRef.current) {
        remoteQueueRef.current.push(ev);
      } else {
        void dispatchMove(ev.pitIndex, ev.direction, {
          isRemote: true,
          actorSide: ev.side,
          remoteMatchVersion: ev.matchVersion,
        });
      }
    });
  }, [onlineContext, dispatchMove]);

  // Kiểm tra trạng thái Online của người đang tới lượt (rớt mạng > 2 phút -> Bot AI đánh thay)
  const activeOnlineMember = onlineContext?.snapshot.members.find(
    (m) => m.side === canonicalState.currentSide,
  );
  const isWaitingReconnect = Boolean(
    onlineContext &&
      activeOnlineMember &&
      !activeOnlineMember.connected &&
      !activeOnlineMember.botTakeover,
  );
  const reconnectSecLeft =
    isWaitingReconnect && activeOnlineMember?.disconnectedAt
      ? Math.max(
          0,
          Math.ceil((ONLINE_DISCONNECT_GRACE_MS - (nowClock - activeOnlineMember.disconnectedAt)) / 1000),
        )
      : 0;

  const isBotActingNow = useMemo(() => {
    if (canonicalState.phase !== 'WAITING_MOVE' || isAnimating) return false;
    if (onlineContext) {
      // Nếu đối thủ rớt mạng quá 2 phút và mình là người còn kết nối -> Bot tự đánh thay
      return Boolean(activeOnlineMember?.botTakeover && onlineContext.localSide !== canonicalState.currentSide);
    }
    return canonicalState.players[canonicalState.currentSide].isBot;
  }, [canonicalState, isAnimating, onlineContext, activeOnlineMember]);

  // Chạy lượt Máy AI (với độ trễ tự nhiên + biểu cảm suy nghĩ)
  useEffect(() => {
    if (!isBotActingNow) return;
    const botSide = canonicalState.currentSide;
    showCharacterReaction(botSide, 'thinking', pickFolkDialogue('thinking'), 1300);

    const thinkDelay = speedRef.current === 2 ? 420 : 760;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      const choice = computeBotMove(canonicalRef.current, botDifficulty);
      if (choice) {
        void dispatchMove(choice.pitIndex, choice.direction, { actorSide: botSide });
      }
    }, thinkDelay);

    return () => clearTimeout(timer);
  }, [isBotActingNow, canonicalState.currentSide, canonicalState.turnCount, botDifficulty, dispatchMove, showCharacterReaction]);

  // Xác định người dùng hiện tại có quyền bấm chọn ô hay không
  const canHumanInteract =
    canonicalState.phase === 'WAITING_MOVE' &&
    !isAnimating &&
    !isWaitingReconnect &&
    !isBotActingNow &&
    (onlineContext ? canonicalState.currentSide === onlineContext.localSide : true);

  const handleSelectPit = useCallback(
    (pitIndex: number) => {
      if (!canHumanInteract) return;
      const pit = canonicalRef.current.pits[pitIndex];
      if (!pit || pit.kind !== 'DAN' || pit.ownerSide !== canonicalRef.current.currentSide || pit.stones <= 0) {
        return;
      }
      oAnQuanAudio.playSelectPit();
      setSelectedPitIdx((prev) => (prev === pitIndex ? null : pitIndex));
    },
    [canHumanInteract],
  );

  const handleChooseVisualDirection = (visualChoice: 'LEFT' | 'RIGHT') => {
    if (selectedPitIdx === null || !canHumanInteract) return;
    const dir = visualHorizontalToSowDirection(selectedPitIdx, visualChoice, viewerSide);
    void dispatchMove(selectedPitIdx, dir);
  };

  const handleRequestHint = () => {
    if (!canHumanInteract || mode !== 'vs-bot') return;
    const best = computeBestHint(canonicalRef.current);
    if (best) {
      oAnQuanAudio.playSelectPit();
      setHintResult(best);
      setSelectedPitIdx(best.pitIndex);
    }
  };

  const getPitHighlightTone = (pitIndex: number) => {
    if (activeHighlight?.pitIndex === pitIndex) return activeHighlight.tone;
    if (bridgeEmptyIdx === pitIndex) return 'empty-bridge';
    return null;
  };

  const activeTurnPlayer = canonicalState.players[canonicalState.currentSide];
  const isLeftTurn = canonicalState.currentSide === leftPlayerSide && canonicalState.phase === 'WAITING_MOVE';
  const isRightTurn = canonicalState.currentSide === rightPlayerSide && canonicalState.phase === 'WAITING_MOVE';
  const mandarinPointValue = canonicalState.rules.mandarinPointValue ?? 10;
  const totalGamePoints = getTotalGamePoints(canonicalState.rules);

  return (
    <div
      ref={stageRootRef}
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden px-2.5 py-2.5 text-white select-none ${
        isBoardShaking ? 'animate-board-shake' : ''
      }`}
    >
      {/* Nền sân gạch tàu nắng ấm & lá tre 4 góc */}
      <CourtyardBackground />

      {/* Lớp diễn hoạt Bàn Tay Chibi 2.5D (cầm đá, lụm đá, rải đá, đập tay BỐP! & quét vào giỏ) */}
      <HandActorOverlay
        hand={activeHand}
        shockwave={slapShockwave}
        dropRipple={dropRipple}
      />

      {/* HÀNG TRÊN: NÚT ĐIỀU KHIỂN · TIÊU ĐỀ · TỐC ĐỘ 1x/2x & GỢI Ý */}
      <header className="relative z-20 flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToLobby}
            title="Quay lại Sảnh Ô Ăn Quan"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#4A2510] bg-gradient-to-b from-[#F5DEB3] to-[#C68B59] text-[#4A2510] shadow-[0_4px_0_#4A2510] transition hover:brightness-105 cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.8]" />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? 'Bật nhạc nền (tiếng cờ luôn bật)' : 'Tắt nhạc nền (tiếng cờ luôn bật)'}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#4A2510] bg-gradient-to-b from-[#F5DEB3] to-[#C68B59] text-[#4A2510] shadow-[0_4px_0_#4A2510] transition hover:brightness-105 cursor-pointer"
          >
            {muted ? <VolumeX className="h-5 w-5 text-rose-700" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            title={`Bộ Luật ${totalGamePoints} Điểm`}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#4A2510] bg-gradient-to-b from-[#F5DEB3] to-[#C68B59] text-[#4A2510] shadow-[0_4px_0_#4A2510] transition hover:brightness-105 cursor-pointer"
          >
            <BookOpen className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#4A2510] bg-gradient-to-b from-[#F5DEB3] to-[#C68B59] text-[#4A2510] shadow-[0_4px_0_#4A2510] transition hover:brightness-105 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Huy hiệu trung tâm */}
        <div className="flex items-center gap-2 rounded-full border-2 border-[#5D3316] bg-gradient-to-b from-[#F9E7C2] to-[#DEB887] px-5 py-1.5 text-sm font-black tracking-wide text-[#422006] shadow-[0_4px_0_#4A2510]">
          <span>Ô ĂN QUAN DÂN GIAN</span>
          {onlineContext && (
            <span className="rounded-full bg-cyan-900/90 px-2 py-0.5 font-mono text-xs text-cyan-200">
              #{onlineContext.roomCode}
            </span>
          )}
          <span className="text-[#9A3412]">· Lượt {canonicalState.turnCount}</span>
          <span className="rounded-full bg-emerald-900/90 px-2 py-0.5 text-[10px] text-emerald-200">
            Quan {mandarinPointValue}đ
          </span>
          {canonicalState.rules.mandarinYouthRule && (
            <span className="rounded-full bg-amber-900/90 px-2 py-0.5 text-[10px] text-amber-200">
              Quan Non
            </span>
          )}
        </div>

        {/* Góc phải: Tốc độ 1x/2x + Gợi ý nước đi */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSpeedMult((s) => (s === 1 ? 2 : 1))}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#4A2510] bg-gradient-to-b from-[#F5DEB3] to-[#C68B59] px-3.5 py-1.5 text-xs font-black text-[#422006] shadow-[0_4px_0_#4A2510] transition hover:brightness-105 cursor-pointer"
          >
            <Gauge className="h-4 w-4" />
            Tốc độ: {speedMult}×
          </button>

          {mode === 'vs-bot' && (
            <button
              type="button"
              disabled={!canHumanInteract}
              onClick={handleRequestHint}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#4A2510] bg-gradient-to-b from-[#FEF08A] to-[#F59E0B] px-3.5 py-1.5 text-xs font-black text-[#422006] shadow-[0_4px_0_#4A2510] transition hover:brightness-105 disabled:opacity-50 cursor-pointer"
            >
              <Lightbulb className="h-4 w-4" />
              Gợi ý nước đi
            </button>
          )}
        </div>
      </header>

      {/* KHU VỰC GIỮA: 2 BÉ ĐỨNG GẦN CHIẾU CÓI (KHÔNG VIỀN XUNG QUANH!) + CHIẾU CÓI 12 Ô CHÍNH GIỮA */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center gap-2 px-1 min-[1340px]:gap-7">
        {/* BÉ BÊN TRÁI (PHE DƯỚI / BẠN) — ĐỨNG GẦN CHIẾU CÓI, BỎ HOÀN TOÀN VIỀN KHUNG! */}
        <div className="relative flex w-[132px] shrink-0 flex-col items-center justify-center">
          {/* Bong bóng thoại căn giữa phía trên đầu */}
          {bubbles[leftPlayerSide] && (
            <div className="animate-bounce pointer-events-none absolute -top-11 left-1/2 z-30 w-[160px] -translate-x-1/2 rounded-2xl border-2 border-[#5D3316] bg-[#FFFBEB] px-2.5 py-1.5 text-center text-[11px] font-black text-[#422006] shadow-lg">
              {bubbles[leftPlayerSide]}
            </div>
          )}

          {/* Vòng hào quang nhẹ phía sau nhân vật khi đang tới lượt (không khung vuông!) */}
          <div className="relative flex flex-col items-center">
            {isLeftTurn && (
              <div className="pointer-events-none absolute inset-x-2 top-6 bottom-2 rounded-full bg-amber-300/35 blur-xl" />
            )}
            <OAnQuanCharacterArt
              characterId={leftPlayer.characterId}
              mood={moods[leftPlayerSide]}
              facing="right"
              className={`relative h-[164px] w-[128px] transition-transform duration-300 ${
                isLeftTurn ? 'scale-105' : 'opacity-95'
              }`}
            />
          </div>

          {/* Nhãn tên gọn + Giỏ tre + Thông số Quan/Dân/Điểm */}
          <div
            className={`-mt-2 rounded-full px-3.5 py-0.5 text-xs font-black shadow-md ${
              isLeftTurn
                ? 'bg-amber-400 text-stone-950 ring-2 ring-yellow-100'
                : 'bg-stone-950/80 text-amber-100'
            }`}
          >
            {isLeftTurn ? '▶ ' : ''}
            {leftPlayer.name}
          </div>

          <div ref={leftBasketRef} className="mt-1">
            <WovenBasketSvg
              capturedQuan={leftPlayer.capturedQuan}
              capturedDan={leftPlayer.capturedDan}
              className="h-14 w-24"
            />
          </div>

          <div className="-mt-1 rounded-full bg-stone-950/82 px-2.5 py-0.5 text-[10.5px] font-black text-amber-200 shadow">
            Quan: {leftPlayer.capturedQuan} · Dân: {leftPlayer.capturedDan} ·{' '}
            <span className="text-emerald-300">{leftPlayer.score}đ</span>
          </div>
          {leftPlayer.borrowedDan > 0 && (
            <div className="mt-1 rounded-full bg-rose-600/95 px-2.5 py-0.5 text-[10px] font-black text-white shadow">
              Nợ đối thủ {leftPlayer.borrowedDan} dân
            </div>
          )}
          {leftPlayer.loanedDan > 0 && (
            <div className="mt-1 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-black text-white shadow">
              Cho vay {leftPlayer.loanedDan} dân
            </div>
          )}
        </div>

        {/* TRUNG TÂM: TẤM CHIẾU CÓI VIỀN THỔ CẨM ĐỎ VÀNG + BÀN GỖ 12 Ô */}
        <div className="relative flex shrink-0 flex-col items-center justify-center">
          {/* Biểu ngữ diễn hoạt rải sỏi / gợi ý phía trên chiếu */}
          <div className="mb-1.5 flex h-7 items-center justify-center">
            {handBanner ? (
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-0.5 text-xs font-black shadow-lg ${
                  handBanner.tone === 'emerald'
                    ? 'border-emerald-200 bg-emerald-900/95 text-emerald-100'
                    : handBanner.tone === 'cyan'
                      ? 'border-cyan-200 bg-cyan-900/95 text-cyan-100'
                      : 'border-amber-200 bg-stone-950/92 text-amber-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>{handBanner.text}</span>
              </div>
            ) : hintResult ? (
              <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-cyan-300 bg-cyan-950/95 px-4 py-0.5 text-xs font-black text-cyan-100 shadow-lg">
                <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
                <span>{hintResult.explanationVi}</span>
              </div>
            ) : null}
          </div>

          {/* Tấm Chiếu Cói Vàng Rơm Viền Thổ Cẩm Đỏ */}
          <div
            className="relative rounded-[28px] p-[14px] shadow-[0_20px_42px_rgba(24,8,2,0.68)]"
            style={{
              background:
                'repeating-linear-gradient(45deg, #991B1B 0px, #991B1B 10px, #B91C1C 10px, #B91C1C 20px)',
              border: '3px solid #F59E0B',
            }}
          >
            {/* Dải hoa văn thổ cẩm vàng đồng chạy viền trong */}
            <div
              className="rounded-[18px] border-2 border-amber-300/75 px-5 py-4"
              style={{
                backgroundColor: '#E5C67E',
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(161, 114, 42, 0.16) 0px, rgba(161, 114, 42, 0.16) 2px, transparent 2px, transparent 5px)',
              }}
            >
              {/* Khung bàn gỗ chạm 12 ô bo tròn hai đầu */}
              <div
                className="flex h-[264px] items-center gap-2.5 rounded-[128px] border-[4px] border-[#4A2510] px-3 py-2.5 shadow-[0_12px_24px_rgba(32,12,2,0.58),inset_0_2px_4px_rgba(255,228,181,0.35)]"
                style={{
                  background: 'linear-gradient(180deg, #B97E4C 0%, #8C5529 52%, #6E3E1A 100%)',
                }}
              >
                {/* Ô Quan Trái màn hình */}
                <StonePitCell
                  pit={playbackPits[boardLayout.leftMandarinIndex]}
                  isSelectable={false}
                  isSelected={false}
                  isHintTarget={false}
                  highlightTone={getPitHighlightTone(boardLayout.leftMandarinIndex)}
                  mandarinSide="left"
                  mandarinPointValue={mandarinPointValue}
                />

                {/* 10 Ô Dân ở giữa (2 hàng × 5 ô) */}
                <div className="flex flex-col justify-between gap-2.5">
                  {/* Hàng Trên (Đối thủ / Phe Trên) */}
                  <div className="flex items-center gap-2">
                    {boardLayout.topRowIndices.map((pitIdx) => {
                      const pit = playbackPits[pitIdx];
                      const canSelectThis =
                        canHumanInteract &&
                        pit.ownerSide === canonicalState.currentSide &&
                        pit.stones > 0;
                      return (
                        <StonePitCell
                          key={pitIdx}
                          pit={pit}
                          isSelectable={canSelectThis}
                          isSelected={selectedPitIdx === pitIdx}
                          isHintTarget={hintResult?.pitIndex === pitIdx}
                          highlightTone={getPitHighlightTone(pitIdx)}
                          onSelect={handleSelectPit}
                        />
                      );
                    })}
                  </div>

                  {/* Hàng Dưới (Bạn / Phe Dưới) */}
                  <div className="flex items-center gap-2">
                    {boardLayout.bottomRowIndices.map((pitIdx) => {
                      const pit = playbackPits[pitIdx];
                      const canSelectThis =
                        canHumanInteract &&
                        pit.ownerSide === canonicalState.currentSide &&
                        pit.stones > 0;
                      return (
                        <StonePitCell
                          key={pitIdx}
                          pit={pit}
                          isSelectable={canSelectThis}
                          isSelected={selectedPitIdx === pitIdx}
                          isHintTarget={hintResult?.pitIndex === pitIdx}
                          highlightTone={getPitHighlightTone(pitIdx)}
                          onSelect={handleSelectPit}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Ô Quan Phải màn hình */}
                <StonePitCell
                  pit={playbackPits[boardLayout.rightMandarinIndex]}
                  isSelectable={false}
                  isSelected={false}
                  isHintTarget={false}
                  highlightTone={getPitHighlightTone(boardLayout.rightMandarinIndex)}
                  mandarinSide="right"
                  mandarinPointValue={mandarinPointValue}
                />
              </div>

              {/* Hai nút chọn hướng ◄ RẢI TRÁI & RẢI PHẢI ► nổi ngay mép dưới bàn gỗ khi đã chạm chọn ô */}
              <div className="mt-3 flex h-12 items-center justify-center gap-4">
                {selectedPitIdx !== null && canHumanInteract ? (
                  <>
                    <button
                      type="button"
                      data-testid="oaq-sow-left-btn"
                      onClick={() => handleChooseVisualDirection('LEFT')}
                      className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-2xl border-2 border-[#4A2510] px-7 py-2 text-sm font-black tracking-wide text-[#FFFBEB] cursor-pointer"
                      style={{
                        background: 'linear-gradient(180deg, #B46934 0%, #7C3E16 100%)',
                        boxShadow: '0 4px 0 #3E1D09, 0 8px 18px rgba(0,0,0,0.42)',
                      }}
                    >
                      ◄ RẢI TRÁI
                    </button>
                    <button
                      type="button"
                      data-testid="oaq-sow-right-btn"
                      onClick={() => handleChooseVisualDirection('RIGHT')}
                      className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-2xl border-2 border-[#4A2510] px-7 py-2 text-sm font-black tracking-wide text-[#FFFBEB] cursor-pointer"
                      style={{
                        background: 'linear-gradient(180deg, #B46934 0%, #7C3E16 100%)',
                        boxShadow: '0 4px 0 #3E1D09, 0 8px 18px rgba(0,0,0,0.42)',
                      }}
                    >
                      RẢI PHẢI ►
                    </button>
                  </>
                ) : (
                  <div className="rounded-full bg-[#4A2510]/15 px-4 py-1 text-xs font-black text-[#4A2510]/85">
                    {isWaitingReconnect
                      ? `⏳ Đang chờ ${activeTurnPlayer.name} kết nối lại (${reconnectSecLeft}s)...`
                      : isAnimating
                        ? '✨ Đang diễn hoạt rải sỏi...'
                        : isBotActingNow
                          ? `🤖 ${activeTurnPlayer.name} đang suy tính nước đi...`
                          : canHumanInteract
                            ? `👆 Chạm vào 1 trong 5 ô dân của ${activeTurnPlayer.name} để chọn hướng rải`
                            : `⏳ Đang chờ ${activeTurnPlayer.name} đi lượt...`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BÉ BÊN PHẢI (PHE TRÊN / ĐỐI THỦ) — ĐỨNG GẦN CHIẾU CÓI, BỎ HOÀN TOÀN VIỀN KHUNG! */}
        <div className="relative flex w-[132px] shrink-0 flex-col items-center justify-center">
          {bubbles[rightPlayerSide] && (
            <div className="animate-bounce pointer-events-none absolute -top-11 left-1/2 z-30 w-[160px] -translate-x-1/2 rounded-2xl border-2 border-[#5D3316] bg-[#FFFBEB] px-2.5 py-1.5 text-center text-[11px] font-black text-[#422006] shadow-lg">
              {bubbles[rightPlayerSide]}
            </div>
          )}

          <div className="relative flex flex-col items-center">
            {isRightTurn && (
              <div className="pointer-events-none absolute inset-x-2 top-6 bottom-2 rounded-full bg-emerald-300/35 blur-xl" />
            )}
            <OAnQuanCharacterArt
              characterId={rightPlayer.characterId}
              mood={moods[rightPlayerSide]}
              facing="left"
              className={`relative h-[164px] w-[128px] transition-transform duration-300 ${
                isRightTurn ? 'scale-105' : 'opacity-95'
              }`}
            />
          </div>

          <div
            className={`-mt-2 rounded-full px-3.5 py-0.5 text-xs font-black shadow-md ${
              isRightTurn
                ? 'bg-emerald-400 text-stone-950 ring-2 ring-emerald-100'
                : 'bg-stone-950/80 text-amber-100'
            }`}
          >
            {isRightTurn ? '▶ ' : ''}
            {rightPlayer.name}
          </div>

          <div ref={rightBasketRef} className="mt-1">
            <WovenBasketSvg
              capturedQuan={rightPlayer.capturedQuan}
              capturedDan={rightPlayer.capturedDan}
              className="h-14 w-24"
            />
          </div>

          <div className="-mt-1 rounded-full bg-stone-950/82 px-2.5 py-0.5 text-[10.5px] font-black text-amber-200 shadow">
            Quan: {rightPlayer.capturedQuan} · Dân: {rightPlayer.capturedDan} ·{' '}
            <span className="text-emerald-300">{rightPlayer.score}đ</span>
          </div>
          {rightPlayer.borrowedDan > 0 && (
            <div className="mt-1 rounded-full bg-rose-600/95 px-2.5 py-0.5 text-[10px] font-black text-white shadow">
              Nợ đối thủ {rightPlayer.borrowedDan} dân
            </div>
          )}
          {rightPlayer.loanedDan > 0 && (
            <div className="mt-1 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-black text-white shadow">
              Cho vay {rightPlayer.loanedDan} dân
            </div>
          )}
        </div>
      </main>

      {/* THANH CHÂN TRANG GỌN SẮC NÉT */}
      <footer className="relative z-20 flex items-center justify-center pb-0.5">
        <div className="rounded-full border-2 border-[#5D3316] bg-gradient-to-b from-[#F9E7C2] to-[#DEB887] px-6 py-1 text-xs font-black text-[#422006] shadow-[0_3px_0_#4A2510]">
          {canonicalState.phase === 'GAME_OVER'
            ? `🏆 Ván đấu đã kết thúc — Xem bảng tổng kết ${totalGamePoints} điểm!`
            : `Lượt của ${activeTurnPlayer.name} — ${
                canHumanInteract
                  ? 'Chạm chọn 1 trong 5 ô dân có sỏi rồi bấm ◄ Rải Trái hoặc Rải Phải ►'
                  : 'Đang chờ lượt đối thủ...'
              }`}
        </div>
      </footer>

      {showRules && (
        <OAnQuanRulesModal
          rules={canonicalState.rules}
          onClose={() => setShowRules(false)}
        />
      )}

      {canonicalState.phase === 'GAME_OVER' && !isAnimating && (
        <OAnQuanVictoryModal
          state={canonicalState}
          isOnline={Boolean(onlineContext)}
          onPlayAgain={onRestartLocal}
          onBackToLobby={onBackToLobby}
        />
      )}
    </div>
  );
}
