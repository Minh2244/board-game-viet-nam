import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Dices,
  History,
  Loader2,
  Map,
  Palette,
  Play,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { HUB_BG_WARM_WOOD_URL } from '@/hub/themes';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import type { GameComponentProps } from '@/shared/types/gameEntry';
import { CO_TY_PHU_CHARACTERS, LAND_COLORS } from './data/characters';
import { createInitialGameState } from './engine/reducer';
import type {
  CharacterId,
  GameAction,
  GameState,
  LandColorId,
  PlayerSlotDraft,
} from './engine/types';
import { ModeSelectView } from './lobby/ModeSelectView';
import { clearOfflineGame, loadOfflineGame } from './lobby/offlineSave';
import { OnlineLobbyView } from './lobby/OnlineLobbyView';
import {
  clearPersistedOnlineSession,
  generateRoomCode6Digits,
  getOrCreatePlayerToken,
  loadPersistedOnlineSession,
  OnlineRoomClient,
  type OnlineRoomSnapshot,
  type OnlineTransportStatus,
  type PersistedOnlineSession,
  type RemoteGameActionEvent,
} from './network/onlineRoomClient';
import { GameBoardView, type OnlineGameContext } from './ui/GameBoardView';

type LobbyScreenMode = 'mode-select' | 'local-setup' | 'online-lobby';
type PersistedViewState =
  | 'mode-select'
  | 'local-setup'
  | 'playing-offline'
  | 'online-lobby'
  | 'playing-online';

const VIEW_STATE_KEY = 'bgvn_cotyphu_view_state_v1';

function readPersistedViewState(): PersistedViewState | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.sessionStorage.getItem(VIEW_STATE_KEY);
    if (
      val === 'mode-select' ||
      val === 'local-setup' ||
      val === 'playing-offline' ||
      val === 'online-lobby' ||
      val === 'playing-online'
    ) {
      return val;
    }
  } catch {
    // Ignore
  }
  return null;
}

function writePersistedViewState(state: PersistedViewState | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (state === null) {
      window.sessionStorage.removeItem(VIEW_STATE_KEY);
    } else {
      window.sessionStorage.setItem(VIEW_STATE_KEY, state);
    }
  } catch {
    // Ignore
  }
}

function readUrlRoomCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    const code = new URLSearchParams(window.location.search).get('room') || '';
    return /^\d{6}$/.test(code) ? code : '';
  } catch {
    return '';
  }
}

function syncRoomUrl(roomCode: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (roomCode) {
      url.searchParams.set('game', 'co-ty-phu');
      url.searchParams.set('room', roomCode);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch {
    // Ignore
  }
}

function buildBalancedSlots(
  humanCount: number,
  botCount: number,
  prevSlots: readonly PlayerSlotDraft[] = [],
): PlayerSlotDraft[] {
  const safeHumans = Math.max(1, Math.min(6, humanCount));
  let safeBots = Math.max(0, Math.min(4, botCount));
  if (safeHumans + safeBots > 6) {
    safeBots = Math.max(0, 6 - safeHumans);
  }
  if (safeHumans + safeBots < 2) {
    safeBots = 1;
  }

  const prevHumans = prevSlots.filter((s) => !s.isBot);
  const prevBots = prevSlots.filter((s) => s.isBot);

  const result: PlayerSlotDraft[] = [];
  const usedChars = new Set<CharacterId>();
  const usedColors = new Set<LandColorId>();

  const pickChar = (preferred?: CharacterId, fallbackIdx = 0): CharacterId => {
    if (preferred) {
      usedChars.add(preferred);
      return preferred;
    }
    const free = CO_TY_PHU_CHARACTERS.find((c) => !usedChars.has(c.id));
    const chosen = (free ?? CO_TY_PHU_CHARACTERS[fallbackIdx % CO_TY_PHU_CHARACTERS.length]).id;
    usedChars.add(chosen);
    return chosen;
  };

  const pickColor = (preferred?: LandColorId, fallbackIdx = 0): LandColorId => {
    if (preferred && !usedColors.has(preferred)) {
      usedColors.add(preferred);
      return preferred;
    }
    const free = LAND_COLORS.find((c) => !usedColors.has(c.id));
    const chosen = (free ?? LAND_COLORS[fallbackIdx % LAND_COLORS.length]).id;
    usedColors.add(chosen);
    return chosen;
  };

  for (let i = 0; i < safeHumans; i += 1) {
    const existing = prevHumans[i];
    result.push({
      slotIndex: i,
      name: existing?.name.trim() || `Bạn ${i + 1}`,
      isBot: false,
      characterId: pickChar(existing?.characterId, i),
      landColor: pickColor(existing?.landColor, i),
    });
  }

  for (let j = 0; j < safeBots; j += 1) {
    const existing = prevBots[j];
    const idx = safeHumans + j;
    result.push({
      slotIndex: idx,
      name: existing?.name.trim() || `Máy ${j + 1}`,
      isBot: true,
      characterId: pickChar(existing?.characterId, idx),
      landColor: pickColor(existing?.landColor, idx),
    });
  }

  return result;
}

const INITIAL_SLOTS: PlayerSlotDraft[] = buildBalancedSlots(1, 3);

export default function CoTyPhuGame({ onExitToHub }: GameComponentProps) {
  const initialViewRef = useRef<PersistedViewState | null>(readPersistedViewState());
  const initialSavedOfflineRef = useRef<GameState | null>(loadOfflineGame());
  const initialSavedOnlineRef = useRef<PersistedOnlineSession | null>(loadPersistedOnlineSession());
  const initialUrlRoomCodeRef = useRef<string>(readUrlRoomCode());

  const shouldAutoRestoreOnline = Boolean(
    initialSavedOnlineRef.current &&
      (initialViewRef.current === 'online-lobby' ||
        initialViewRef.current === 'playing-online' ||
        initialUrlRoomCodeRef.current === initialSavedOnlineRef.current.roomCode),
  );

  const [screen, setScreen] = useState<LobbyScreenMode>(() =>
    initialViewRef.current === 'local-setup' ? 'local-setup' : 'mode-select',
  );
  const [slots, setSlots] = useState<PlayerSlotDraft[]>(INITIAL_SLOTS);
  const [diceMode, setDiceMode] = useState<1 | 2>(2);
  const [mapMode, setMapMode] = useState<'default' | 'random'>('default');
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);

  // Tự mở thẳng lại bàn cờ Offline nếu người chơi vừa bấm F5 giữa ván (không văng ra Sảnh!)
  const [activeMatch, setActiveMatch] = useState<{
    state: GameState;
    key: number;
    isOnline: boolean;
  } | null>(() => {
    if (
      !shouldAutoRestoreOnline &&
      initialViewRef.current === 'playing-offline' &&
      initialSavedOfflineRef.current
    ) {
      return {
        state: initialSavedOfflineRef.current,
        key: 1,
        isOnline: false,
      };
    }
    return null;
  });
  const [savedMatch, setSavedMatch] = useState<GameState | null>(() => initialSavedOfflineRef.current);

  // Trạng thái Phòng Online (Vercel API /api/room + Upstash Redis HTTPS 443)
  const [myToken] = useState<string>(() => getOrCreatePlayerToken());
  const [resumableOnlineSession, setResumableOnlineSession] =
    useState<PersistedOnlineSession | null>(() => initialSavedOnlineRef.current);
  const [autoRestoringRoomCode, setAutoRestoringRoomCode] = useState<string | null>(() =>
    shouldAutoRestoreOnline ? initialSavedOnlineRef.current?.roomCode ?? null : null,
  );
  const [onlineSnapshot, setOnlineSnapshot] = useState<OnlineRoomSnapshot | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineTransportStatus>('CONNECTING');
  const [onlineStatusMsg, setOnlineStatusMsg] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const onlineClientRef = useRef<OnlineRoomClient | null>(null);
  const remoteActionHandlerRef = useRef<((ev: RemoteGameActionEvent) => void) | null>(null);

  const { muted, toggleMute } = useAudioStore();

  // Ghi nhớ màn hình hiện tại để khi bấm F5 luôn giữ đúng trang / đúng ván đang chơi
  useEffect(() => {
    if (autoRestoringRoomCode) return;
    if (activeMatch) {
      writePersistedViewState(activeMatch.isOnline ? 'playing-online' : 'playing-offline');
    } else {
      writePersistedViewState(screen);
    }
  }, [activeMatch, screen, autoRestoringRoomCode]);

  // Giữ nhạc nền lễ hội 124 BPM phát vui tươi xuyên suốt màn Chọn Chế Độ & Phòng Chờ; tắt khi bước vào ván cờ
  useEffect(() => {
    const inLobby = !activeMatch;
    soundEngine.setHubActive(inLobby);
    if (inLobby && !muted) {
      soundEngine.startHubBgm();
    }

    const unlock = () => {
      if (!activeMatch && !useAudioStore.getState().muted) {
        soundEngine.setHubActive(true);
        soundEngine.startHubBgm();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
    };
  }, [activeMatch, muted]);

  // Dọn kết nối Online khi thoát hẳn khỏi game Cờ Tỷ Phú
  useEffect(() => {
    return () => {
      onlineClientRef.current?.destroy();
      onlineClientRef.current = null;
      soundEngine.setHubActive(false);
    };
  }, []);

  const cleanupOnlineClient = useCallback((dissolveReason?: string) => {
    const client = onlineClientRef.current;
    if (client) {
      if (dissolveReason) {
        client.dissolveOrLeave(dissolveReason);
      } else {
        client.destroy();
      }
      onlineClientRef.current = null;
    }
    syncRoomUrl(null);
    setOnlineSnapshot(null);
    setOnlineLoading(false);
    setResumableOnlineSession(loadPersistedOnlineSession());
  }, []);

  const createOnlineClient = useCallback(
    (roomCode: string, playerName: string, isHost: boolean) => {
      onlineClientRef.current?.destroy();
      const client = new OnlineRoomClient({
        roomCode,
        playerToken: myToken,
        playerName,
        isHost,
        callbacks: {
          onSnapshot: (snap) => {
            setOnlineSnapshot(snap);
            syncRoomUrl(snap.roomCode);
            // Tự động mở bàn cờ trên máy Khách ngay khi Chủ phòng bấm BẮT ĐẦU (hoặc khi F5 vào lại ván đang chơi)
            if (snap.phase === 'PLAYING' && snap.matchState) {
              setActiveMatch((prev) => {
                if (prev?.isOnline) return prev;
                soundEngine.playEnterGame();
                return {
                  state: snap.matchState!,
                  key: (prev?.key ?? 0) + 1,
                  isOnline: true,
                };
              });
            }
          },
          onStatusChange: (status, message) => {
            setOnlineStatus(status);
            setOnlineStatusMsg(message);
          },
          onRemoteAction: (ev) => {
            remoteActionHandlerRef.current?.(ev);
          },
          onRoomClosed: (reason) => {
            onlineClientRef.current = null;
            syncRoomUrl(null);
            setOnlineSnapshot(null);
            setActiveMatch((prev) => (prev?.isOnline ? null : prev));
            setScreen('mode-select');
            setOnlineLoading(false);
            setAutoRestoringRoomCode(null);
            setOnlineError(reason);
            setResumableOnlineSession(null);
          },
          onPeerJoined: () => {
            soundEngine.playRoomJoin();
          },
        },
      });
      onlineClientRef.current = client;
      return client;
    },
    [myToken],
  );

  // Tự động khôi phục phòng Online ngay sau khi bấm F5 (dùng được cho cả Chủ phòng lẫn Khách — KHÔNG VĂNG!)
  useEffect(() => {
    const saved = initialSavedOnlineRef.current;
    if (!shouldAutoRestoreOnline || !saved) return;

    let cancelled = false;
    const client = createOnlineClient(saved.roomCode, saved.playerName, saved.isHost);
    void client
      .rejoinExistingRoom()
      .then((restoredSnap) => {
        if (cancelled) return;
        setScreen('online-lobby');
        if (restoredSnap.phase === 'PLAYING' && restoredSnap.matchState) {
          setActiveMatch({
            state: restoredSnap.matchState,
            key: Date.now(),
            isOnline: true,
          });
        }
        setAutoRestoringRoomCode(null);
      })
      .catch((err) => {
        if (cancelled) return;
        client.destroy();
        onlineClientRef.current = null;
        clearPersistedOnlineSession();
        syncRoomUrl(null);
        setResumableOnlineSession(null);
        setAutoRestoringRoomCode(null);
        setScreen('mode-select');
        setOnlineError(
          err instanceof Error ? err.message : 'Phòng Online trước đó đã đóng hoặc hết hạn.',
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateOnlineRoom = async (playerName: string) => {
    setOnlineError(null);
    setOnlineLoading(true);
    const code = generateRoomCode6Digits();
    const client = createOnlineClient(code, playerName, true);
    try {
      const confirmedCode = await client.startAsHost(2); // Chỉ mở sảnh khi máy chủ đã cấp mã 6 số thành công 100%!
      syncRoomUrl(confirmedCode);
      setScreen('online-lobby');
    } catch (err) {
      client.destroy();
      onlineClientRef.current = null;
      setOnlineSnapshot(null);
      setOnlineError(err instanceof Error ? err.message : 'Không thể khởi tạo phòng Online.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleJoinOnlineRoom = async (roomCode: string, playerName: string) => {
    setOnlineError(null);
    setOnlineLoading(true);
    const client = createOnlineClient(roomCode, playerName, false);
    try {
      await client.joinRoom();
      syncRoomUrl(roomCode);
      setScreen('online-lobby');
    } catch (err) {
      client.destroy();
      onlineClientRef.current = null;
      setOnlineSnapshot(null);
      setOnlineError(err instanceof Error ? err.message : 'Không tìm thấy phòng Online.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleReconnectOnlineSession = async () => {
    if (!resumableOnlineSession) return;
    setOnlineError(null);
    setOnlineLoading(true);
    const { roomCode, playerName, isHost } = resumableOnlineSession;
    const client = createOnlineClient(roomCode, playerName, isHost);
    try {
      const restored = await client.rejoinExistingRoom();
      syncRoomUrl(roomCode);
      setScreen('online-lobby');
      if (restored.phase === 'PLAYING' && restored.matchState) {
        setActiveMatch({ state: restored.matchState, key: Date.now(), isOnline: true });
      }
    } catch (err) {
      client.destroy();
      onlineClientRef.current = null;
      clearPersistedOnlineSession();
      syncRoomUrl(null);
      setResumableOnlineSession(null);
      setOnlineError(
        err instanceof Error ? err.message : 'Phòng cũ đã đóng hoặc quá hạn.',
      );
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleStartOnlineMatch = () => {
    const client = onlineClientRef.current;
    if (!client) return;
    const initial = client.startMatch();
    if (!initial) return;
    setActiveMatch((prev) => ({
      state: initial,
      key: (prev?.key ?? 0) + 1,
      isOnline: true,
    }));
  };

  const handleDissolveOnlineRoom = useCallback(() => {
    cleanupOnlineClient('Ván Online đã kết thúc — Phòng được giải tán.');
    setActiveMatch(null);
    setScreen('mode-select');
    setOnlineError(null);
  }, [cleanupOnlineClient]);

  const registerRemoteActionHandler = useCallback(
    (fn: (ev: RemoteGameActionEvent) => void) => {
      remoteActionHandlerRef.current = fn;
      return () => {
        if (remoteActionHandlerRef.current === fn) {
          remoteActionHandlerRef.current = null;
        }
      };
    },
    [],
  );

  const handleCommitLocalOnlineAction = useCallback(
    (action: GameAction, rollPower: number, nextState: GameState) => {
      onlineClientRef.current?.broadcastCommittedAction(action, rollPower, nextState);
    },
    [],
  );

  const startFreshOfflineMatch = () => {
    soundEngine.playEnterGame();
    clearOfflineGame();
    const fresh = createInitialGameState({ slots, diceCount: diceMode, mapMode });
    setSavedMatch(null);
    setActiveMatch((prev) => ({ state: fresh, key: (prev?.key ?? 0) + 1, isOnline: false }));
  };

  const resumeSavedOfflineMatch = () => {
    if (!savedMatch) return;
    soundEngine.playEnterGame();
    setActiveMatch((prev) => ({ state: savedMatch, key: (prev?.key ?? 0) + 1, isOnline: false }));
  };

  // 0. ĐANG TỰ KHÔI PHỤC PHÒNG ONLINE NGAY SAU KHI F5
  if (autoRestoringRoomCode) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-slate-950 p-6 text-white">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-cyan-400/45 bg-slate-900/90 px-8 py-6 text-center shadow-2xl">
          <Loader2 className="h-9 w-9 animate-spin text-cyan-300" />
          <div className="text-base font-black tracking-wide text-amber-200">
            Đang khôi phục phòng Online #{autoRestoringRoomCode}...
          </div>
          <div className="text-xs text-slate-300">
            Giữ nguyên ghế &amp; bàn cờ của bạn, chờ xíu nhé!
          </div>
        </div>
      </div>
    );
  }

  // 1. ĐANG TRONG VÁN CỜ (OFFLINE HOẶC ONLINE)
  if (activeMatch) {
    let onlineContext: OnlineGameContext | undefined;
    if (activeMatch.isOnline && onlineSnapshot && onlineClientRef.current) {
      const meMember = onlineSnapshot.humans.find((h) => h.playerToken === myToken);
      onlineContext = {
        roomCode: onlineSnapshot.roomCode,
        localPlayerId: meMember?.seatId ?? null,
        isHost: onlineClientRef.current.isHost,
        snapshot: onlineSnapshot,
        onCommitLocalAction: handleCommitLocalOnlineAction,
        registerRemoteActionHandler,
        onDissolveRoom: handleDissolveOnlineRoom,
      };
    }

    return (
      <GameBoardView
        key={activeMatch.key}
        initialState={activeMatch.state}
        onlineContext={onlineContext}
        onRestartSameSetup={startFreshOfflineMatch}
        onBackToLobby={() => {
          if (activeMatch.isOnline) {
            handleDissolveOnlineRoom();
          } else {
            setActiveMatch(null);
            setSavedMatch(loadOfflineGame());
            setScreen('local-setup');
          }
        }}
      />
    );
  }

  // 2. MÀN HÌNH CHỌN CHẾ ĐỘ (CHƠI VỚI MÁY & NHIỀU NGƯỜI | CHƠI ONLINE MÃ 6 SỐ)
  if (screen === 'mode-select') {
    return (
      <ModeSelectView
        savedOfflineMatch={savedMatch}
        resumableOnlineSession={resumableOnlineSession}
        initialRoomCode={initialUrlRoomCodeRef.current}
        onlineLoading={onlineLoading}
        onlineError={onlineError}
        defaultPlayerName={slots[0]?.name || 'Bạn 1'}
        onBackToHub={() => {
          cleanupOnlineClient();
          writePersistedViewState(null);
          onExitToHub();
        }}
        onOpenLocalSetup={(preset) => {
          setSlots((prev) =>
            preset === 'pass-and-play'
              ? buildBalancedSlots(2, 2, prev)
              : buildBalancedSlots(1, 3, prev),
          );
          setActiveSlotIdx(0);
          setScreen('local-setup');
        }}
        onResumeOfflineMatch={resumeSavedOfflineMatch}
        onCreateOnlineRoom={(name) => void handleCreateOnlineRoom(name)}
        onJoinOnlineRoom={(code, name) => void handleJoinOnlineRoom(code, name)}
        onReconnectOnlineSession={() => void handleReconnectOnlineSession()}
      />
    );
  }

  // 3. SẢNH PHÒNG CHỜ ONLINE (MÃ 6 CHỮ SỐ · GHẾ NGƯỜI + 0–4 MÁY)
  if (screen === 'online-lobby' && onlineSnapshot && onlineClientRef.current) {
    return (
      <OnlineLobbyView
        snapshot={onlineSnapshot}
        myToken={myToken}
        isHost={onlineClientRef.current.isHost}
        transportStatus={onlineStatus}
        statusMessage={onlineStatusMsg}
        onLeaveRoom={() => {
          cleanupOnlineClient(
            onlineClientRef.current?.isHost
              ? 'Chủ phòng đã giải tán phòng chờ.'
              : 'Bạn đã rời phòng.',
          );
          setScreen('mode-select');
        }}
        onUpdateMember={(targetToken, patch) => {
          onlineClientRef.current?.updateMember(targetToken, patch);
        }}
        onSetBotCount={(cnt) => {
          onlineClientRef.current?.setBotCount(cnt);
        }}
        onUpdateSettings={(patch) => {
          onlineClientRef.current?.updateMatchSettings(patch);
        }}
        onKickMember={(targetToken) => {
          onlineClientRef.current?.kickMember(targetToken);
        }}
        onStartMatch={handleStartOnlineMatch}
      />
    );
  }

  // 4. SẢNH THIẾT LẬP CHƠI VỚI MÁY & 1 THIẾT BỊ NHIỀU NGƯỜI (BỘ CHỌN TÁCH RIÊNG: NGƯỜI 1–6 & MÁY 0–4)
  const humanCount = slots.filter((s) => !s.isBot).length;
  const botCount = slots.filter((s) => s.isBot).length;

  const selectedSlot = slots[activeSlotIdx] ?? slots[0];
  const selectedChar =
    CO_TY_PHU_CHARACTERS.find((c) => c.id === selectedSlot.characterId) ??
    CO_TY_PHU_CHARACTERS[0];
  const selectedLandColor =
    LAND_COLORS.find((c) => c.id === selectedSlot.landColor) ?? LAND_COLORS[0];

  const handleSetHumanCount = (nextHumans: number) => {
    soundEngine.playPushClick();
    const curBots = slots.filter((s) => s.isBot).length;
    const balanced = buildBalancedSlots(nextHumans, curBots, slots);
    setSlots(balanced);
    if (activeSlotIdx >= balanced.length) {
      setActiveSlotIdx(balanced.length - 1);
    }
  };

  const handleSetBotCount = (nextBots: number) => {
    soundEngine.playPushClick();
    const curHumans = slots.filter((s) => !s.isBot).length;
    // Nếu tổng vượt quá 6 -> tự giảm Số Người cho khớp tổng <= 6; nếu tổng < 2 -> tăng Số Người lên 2
    let adjustedHumans = curHumans;
    if (adjustedHumans + nextBots > 6) {
      adjustedHumans = Math.max(1, 6 - nextBots);
    }
    if (adjustedHumans + nextBots < 2) {
      adjustedHumans = 2;
    }
    const balanced = buildBalancedSlots(adjustedHumans, nextBots, slots);
    setSlots(balanced);
    if (activeSlotIdx >= balanced.length) {
      setActiveSlotIdx(balanced.length - 1);
    }
  };

  const updateActiveSlotName = (name: string) => {
    setSlots((prev) => prev.map((s, i) => (i === activeSlotIdx ? { ...s, name } : s)));
  };

  const pickCharacterForActive = (charId: CharacterId) => {
    soundEngine.playPushClick();
    setSlots((prev) =>
      prev.map((s, i) => (i === activeSlotIdx ? { ...s, characterId: charId } : s)),
    );
  };

  const pickLandColorForActive = (colorId: LandColorId) => {
    soundEngine.playPushClick();
    setSlots((prev) => {
      const currentColor = prev[activeSlotIdx]?.landColor;
      if (!currentColor || currentColor === colorId) return prev;
      const otherIdx = prev.findIndex((s, i) => i !== activeSlotIdx && s.landColor === colorId);
      return prev.map((s, i) => {
        if (i === activeSlotIdx) return { ...s, landColor: colorId };
        if (i === otherIdx) return { ...s, landColor: currentColor };
        return s;
      });
    });
  };

  const handleToggleAudio = () => {
    const wasMuted = muted;
    toggleMute();
    if (wasMuted) {
      soundEngine.setHubActive(true);
      soundEngine.startHubBgm();
      soundEngine.playPushClick();
    }
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-950/65 via-emerald-950/55 to-stone-950/75"
      />

      <div className="relative z-10 flex h-full w-full flex-row items-start justify-between gap-4 px-5 py-3.5">
        {/* Nút Quay lại chọn chế độ & nút Loa */}
        <header className="flex shrink-0 flex-col items-stretch gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playPushClick();
              setScreen('mode-select');
            }}
            className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
              boxShadow: '0 4px 0 #9A3412, 0 8px 18px rgba(0,0,0,0.35)',
            }}
          >
            <ArrowLeft className="h-4 w-4 stroke-[3]" />
            Chọn chế độ
          </button>

          <button
            type="button"
            onClick={handleToggleAudio}
            title={muted ? 'Bật nhạc nền sảnh' : 'Tắt âm thanh'}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/25 bg-slate-900/75 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-slate-800 cursor-pointer"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-rose-300" /> : <Volume2 className="h-3.5 w-3.5" />}
            {muted ? 'Đang tắt nhạc' : 'Nhạc sảnh bật'}
          </button>
        </header>

        {/* Thiết lập ván chơi Offline 2 cột Trái – Phải trên khung ngang 1220×590 */}
        <main className="mx-auto grid h-full w-full max-w-[1100px] flex-1 grid-cols-12 gap-4">
          {/* Cột trái: Bộ chọn Số Người (1–6) + Số Máy (0–4) + Danh sách tụ + Cài đặt */}
          <section className="mobile-flat-shadow col-span-7 flex flex-col gap-2.5 rounded-[24px] border border-emerald-400/40 bg-stone-900/92 p-4 shadow-2xl backdrop-blur-md">
            <div className="border-b border-white/10 pb-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-black tracking-wide text-emerald-300">
                    CHƠI VỚI MÁY &amp; NHIỀU NGƯỜI
                  </h1>
                  <p className="text-xs text-stone-300">
                    Đang chọn <strong className="text-emerald-300">{humanCount} Người</strong> +{' '}
                    <strong className="text-amber-300">{botCount} Máy</strong> ={' '}
                    <strong className="text-white">{slots.length} tụ</strong> (tối đa 6 tụ · tối đa 4 Máy)
                  </p>
                </div>
              </div>

              {/* 2 BỘ NÚT TÁCH RIÊNG: SỐ NGƯỜI (1–6) & SỐ MÁY (0–4) */}
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between gap-1.5 rounded-2xl border border-emerald-400/30 bg-black/40 px-3 py-1.5">
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-emerald-300">
                    <User className="h-3.5 w-3.5" />
                    Người:
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        data-testid={`human-count-${cnt}`}
                        onClick={() => handleSetHumanCount(cnt)}
                        className={`h-7 w-7 rounded-full text-xs font-black transition cursor-pointer ${
                          humanCount === cnt
                            ? 'bg-emerald-500 text-white shadow'
                            : 'text-stone-300 hover:bg-white/10'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1.5 rounded-2xl border border-amber-400/30 bg-black/40 px-3 py-1.5">
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-amber-300">
                    <Bot className="h-3.5 w-3.5" />
                    Máy:
                  </span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        data-testid={`bot-count-${cnt}`}
                        onClick={() => handleSetBotCount(cnt)}
                        className={`h-7 w-7 rounded-full text-xs font-black transition cursor-pointer ${
                          botCount === cnt
                            ? 'bg-amber-400 text-slate-950 shadow'
                            : 'text-stone-300 hover:bg-white/10'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách 2–6 tụ */}
            <div className="grid grid-cols-2 gap-2.5">
              {slots.map((slot, idx) => {
                const charInfo =
                  CO_TY_PHU_CHARACTERS.find((c) => c.id === slot.characterId) ??
                  CO_TY_PHU_CHARACTERS[0];
                const landInfo =
                  LAND_COLORS.find((c) => c.id === slot.landColor) ?? LAND_COLORS[0];
                const isSelected = idx === activeSlotIdx;
                return (
                  <div
                    key={`${slot.isBot ? 'bot' : 'hum'}_${idx}`}
                    onClick={() => setActiveSlotIdx(idx)}
                    style={{
                      borderColor: isSelected ? landInfo.hex : undefined,
                      boxShadow: isSelected ? `0 0 16px ${landInfo.hex}55` : undefined,
                    }}
                    className={`flex items-center justify-between gap-2 rounded-2xl border p-2.5 transition cursor-pointer ${
                      isSelected
                        ? 'bg-black/45'
                        : 'border-white/15 bg-black/30 hover:border-white/30'
                    }`}
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
                          title={`Màu đất: ${landInfo.name}`}
                          className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-stone-900 shadow"
                          style={{ backgroundColor: landInfo.hex }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">
                          {slot.name.trim() || (slot.isBot ? `Máy ${idx + 1}` : `Bạn ${idx + 1}`)}
                        </div>
                        <div className="truncate text-xs font-medium text-emerald-200/90">
                          {charInfo.name}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${
                        slot.isBot
                          ? 'border border-amber-400/50 bg-amber-500/25 text-amber-200'
                          : 'border border-emerald-400/60 bg-emerald-500/30 text-emerald-100'
                      }`}
                    >
                      {slot.isBot ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      {slot.isBot ? 'Máy' : 'Người'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Cài đặt đầu ván: 1/2 Xúc xắc & Bố cục bàn cờ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                  <Dices className="h-4 w-4 text-cyan-300" />
                  Chế độ Xúc xắc (đầu ván)
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([1, 2] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        soundEngine.playPushClick();
                        setDiceMode(cnt);
                      }}
                      className={`rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                        diceMode === cnt
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'bg-white/10 text-stone-200 hover:bg-white/20'
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
                  Bố cục ô bàn cờ
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPushClick();
                      setMapMode('default');
                    }}
                    className={`rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                      mapMode === 'default'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'bg-white/10 text-stone-200 hover:bg-white/20'
                    }`}
                  >
                    Mặc định
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPushClick();
                      setMapMode('random');
                    }}
                    className={`rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                      mapMode === 'random'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'bg-white/10 text-stone-200 hover:bg-white/20'
                    }`}
                  >
                    Ngẫu nhiên
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-row gap-2.5">
              {savedMatch && (
                <button
                  type="button"
                  onClick={resumeSavedOfflineMatch}
                  className="uiverse-push-btn uiverse-dome-shine flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-base font-black text-white cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                    boxShadow: '0 6px 0 #B45309, 0 12px 24px rgba(245,158,11,0.35)',
                  }}
                >
                  <History className="h-4 w-4" />
                  TIẾP TỤC VÁN DỞ (L{savedMatch.turnCount})
                </button>
              )}
              <button
                type="button"
                onClick={startFreshOfflineMatch}
                className="uiverse-push-btn uiverse-dome-shine flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-lg font-black text-white cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 52%, #06B6D4 100%)',
                  boxShadow: '0 6px 0 #047857, 0 12px 24px rgba(16,185,129,0.45)',
                }}
              >
                <Play className="h-5 w-5 fill-white" />
                {savedMatch ? 'VÁN MỚI' : 'BẮT ĐẦU VÁN CHƠI'}
              </button>
            </div>
          </section>

          {/* Cột phải: Tùy chỉnh Tên tụ + Màu đất + Nhân vật Chibi */}
          <section className="mobile-flat-shadow col-span-5 flex flex-col justify-between gap-2 rounded-[24px] border border-amber-300/35 bg-stone-900/92 p-4 shadow-2xl backdrop-blur-md">
            <div className="w-full text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-200">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: selectedLandColor.hex }}
                />
                Đang chỉnh: {selectedSlot.name.trim() || `Tụ ${activeSlotIdx + 1}`}
              </div>
              <h2 className="mt-1 text-xl font-black text-white">{selectedChar.name}</h2>
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
                <label htmlFor="slot-name-input" className="shrink-0 text-xs font-bold text-stone-300">
                  Tên tụ:
                </label>
                <input
                  id="slot-name-input"
                  type="text"
                  maxLength={18}
                  value={selectedSlot.name}
                  onChange={(e) => updateActiveSlotName(e.target.value)}
                  placeholder={selectedSlot.isBot ? `Máy ${activeSlotIdx + 1}` : `Bạn ${activeSlotIdx + 1}`}
                  className="w-full rounded-xl border border-white/15 bg-stone-950/75 px-3 py-1.5 text-xs font-bold text-white outline-none transition focus:border-emerald-400"
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
                    const isCurrent = c.id === selectedSlot.landColor;
                    const owner = slots.find((s, i) => i !== activeSlotIdx && s.landColor === c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        title={
                          owner
                            ? `${c.name} (đang chọn bởi ${owner.name} — bấm để đổi)`
                            : c.name
                        }
                        aria-label={`Chọn màu đất ${c.name}`}
                        onClick={() => pickLandColorForActive(c.id)}
                        className={`relative flex h-7 w-full items-center justify-center rounded-lg border-2 transition cursor-pointer hover:scale-105 sm:h-8 ${
                          isCurrent
                            ? 'scale-105 border-white shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                            : 'border-white/25 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {isCurrent && <Check className="h-3.5 w-3.5 stroke-[3] text-white drop-shadow" />}
                        {!isCurrent && owner && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white/80 shadow" />
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
                    onClick={() => pickCharacterForActive(ch.id)}
                    className={`group flex flex-col items-center rounded-xl border p-1.5 transition cursor-pointer ${
                      picked
                        ? 'border-emerald-400 bg-emerald-950/75 ring-2 ring-emerald-300/70'
                        : 'border-white/15 bg-black/30 hover:border-white/40'
                    }`}
                  >
                    <img
                      src={ch.avatarUrl}
                      alt={ch.name}
                      className="h-11 w-11 rounded-lg object-cover transition group-hover:scale-105"
                    />
                    <span className="mt-1 line-clamp-2 text-center text-[10px] leading-tight font-bold text-stone-200">
                      {ch.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <div className="hidden w-[64px] shrink-0 xl:block 2xl:w-[116px]" aria-hidden="true" />
      </div>
    </div>
  );
}
