import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { cryptoRandomInt } from '@/shared/crypto/random';
import type { GameComponentProps } from '@/shared/types/gameEntry';
import { createInitialCoCaNguaState } from './engine/reducer';
import type {
  CoCaNguaAction,
  CoCaNguaState,
  HorseBotDifficulty,
  HorseColor,
} from './engine/types';
import { LocalSetupView, type LocalCoCaNguaSetupConfig } from './lobby/LocalSetupView';
import { ModeSelectView } from './lobby/ModeSelectView';
import {
  clearOfflineCoCaNguaMatch,
  loadOfflineCoCaNguaMatch,
  type SavedOfflineCoCaNguaMatch,
} from './lobby/offlineSave';
import { OnlineLobbyView } from './lobby/OnlineLobbyView';
import {
  clearPersistedCoCaNguaSession,
  CoCaNguaOnlineClient,
  generateCoCaNguaRoomCode,
  getOrCreateCoCaNguaToken,
  loadPersistedCoCaNguaSession,
  type CoCaNguaRoomSnapshot,
  type OnlineTransportStatus,
  type PersistedCoCaNguaSession,
  type RemoteHorseActionEvent,
} from './network/onlineRoomClient';
import { HorseBoardView, type CoCaNguaOnlineContext } from './ui/HorseBoardView';

type LobbyScreen = 'mode-select' | 'local-setup' | 'online-lobby';
type PersistedView =
  | 'mode-select'
  | 'local-setup'
  | 'playing-offline'
  | 'online-lobby'
  | 'playing-online';

const VIEW_STATE_KEY = 'bgvn_cocangua_view_state_v1';

function readPersistedView(): PersistedView | null {
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

function writePersistedView(view: PersistedView | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (view === null) window.sessionStorage.removeItem(VIEW_STATE_KEY);
    else window.sessionStorage.setItem(VIEW_STATE_KEY, view);
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

function syncRoomUrl(_roomCode: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('game') && !url.searchParams.has('room')) return;
    url.searchParams.delete('game');
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch {
    // Ignore
  }
}

export default function CoCaNguaGame({ onExitToHub }: GameComponentProps) {
  const initialViewRef = useRef<PersistedView | null>(readPersistedView());
  const initialOfflineRef = useRef<SavedOfflineCoCaNguaMatch | null>(loadOfflineCoCaNguaMatch());
  const initialOnlineRef = useRef<PersistedCoCaNguaSession | null>(loadPersistedCoCaNguaSession());
  const initialUrlRoomRef = useRef<string>(readUrlRoomCode());

  const shouldAutoRestoreOnline = Boolean(
    initialOnlineRef.current &&
      (initialViewRef.current === 'online-lobby' ||
        initialViewRef.current === 'playing-online' ||
        initialUrlRoomRef.current === initialOnlineRef.current.roomCode),
  );

  const [screen, setScreen] = useState<LobbyScreen>(() =>
    initialViewRef.current === 'local-setup' ? 'local-setup' : 'mode-select',
  );
  const [localPreset, setLocalPreset] = useState<'vs-bot' | 'pass-and-play'>('vs-bot');
  const [lastLocalConfig, setLastLocalConfig] = useState<LocalCoCaNguaSetupConfig | null>(null);

  const [savedOfflineMatch, setSavedOfflineMatch] = useState<SavedOfflineCoCaNguaMatch | null>(
    () => initialOfflineRef.current,
  );

  const [activeMatch, setActiveMatch] = useState<{
    state: CoCaNguaState;
    mode: 'vs-bot' | 'pass-and-play' | 'online';
    botDifficulty: HorseBotDifficulty;
    key: number;
  } | null>(() => {
    if (
      !shouldAutoRestoreOnline &&
      initialViewRef.current === 'playing-offline' &&
      initialOfflineRef.current
    ) {
      return {
        state: initialOfflineRef.current.state,
        mode: initialOfflineRef.current.mode,
        botDifficulty: initialOfflineRef.current.botDifficulty,
        key: 1,
      };
    }
    return null;
  });

  // Trạng thái Online 6 số
  const [myToken] = useState<string>(() => getOrCreateCoCaNguaToken());
  const [resumableOnlineSession, setResumableOnlineSession] =
    useState<PersistedCoCaNguaSession | null>(() => initialOnlineRef.current);
  const [autoRestoringCode, setAutoRestoringCode] = useState<string | null>(() =>
    shouldAutoRestoreOnline ? initialOnlineRef.current?.roomCode ?? null : null,
  );
  const [onlineSnapshot, setOnlineSnapshot] = useState<CoCaNguaRoomSnapshot | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineTransportStatus>('CONNECTING');
  const [onlineStatusMsg, setOnlineStatusMsg] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const onlineClientRef = useRef<CoCaNguaOnlineClient | null>(null);
  const remoteActionHandlerRef = useRef<((ev: RemoteHorseActionEvent) => void) | null>(null);
  const { muted } = useAudioStore();

  useEffect(() => {
    if (autoRestoringCode) return;
    if (activeMatch) {
      writePersistedView(activeMatch.mode === 'online' ? 'playing-online' : 'playing-offline');
    } else {
      writePersistedView(screen);
    }
  }, [activeMatch, screen, autoRestoringCode]);

  useEffect(() => {
    syncRoomUrl(null);
  }, []);

  useEffect(() => {
    soundEngine.setBgmScene('co-ca-ngua');
    const unlock = () => {
      if (!useAudioStore.getState().muted) soundEngine.unlockBgmOnGesture();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [muted]);

  useEffect(() => {
    return () => {
      onlineClientRef.current?.destroy();
      onlineClientRef.current = null;
      soundEngine.setBgmScene(null);
    };
  }, []);

  const cleanupOnlineClient = useCallback((dissolveReason?: string) => {
    const client = onlineClientRef.current;
    if (client) {
      if (dissolveReason) client.dissolveOrLeave(dissolveReason);
      else client.destroy();
      onlineClientRef.current = null;
    }
    syncRoomUrl(null);
    setOnlineSnapshot(null);
    setOnlineLoading(false);
    setResumableOnlineSession(loadPersistedCoCaNguaSession());
  }, []);

  const createOnlineClient = useCallback(
    (roomCode: string, playerName: string, isHost: boolean) => {
      onlineClientRef.current?.destroy();
      const client = new CoCaNguaOnlineClient({
        roomCode,
        playerToken: myToken,
        playerName,
        isHost,
        callbacks: {
          onSnapshot: (snap) => {
            setOnlineSnapshot(snap);
            syncRoomUrl(snap.roomCode);
            if (snap.phase === 'PLAYING' && snap.matchState) {
              setActiveMatch((prev) => {
                if (prev?.mode === 'online') return prev;
                soundEngine.playEnterGame();
                return {
                  state: snap.matchState!,
                  mode: 'online',
                  botDifficulty: snap.botDifficulty,
                  key: (prev?.key ?? 0) + 1,
                };
              });
            }
          },
          onStatusChange: (st, msg) => {
            setOnlineStatus(st);
            setOnlineStatusMsg(msg);
          },
          onRemoteAction: (ev) => {
            remoteActionHandlerRef.current?.(ev);
          },
          onStateResync: (authoritativeState) => {
            setActiveMatch((prev) =>
              prev?.mode === 'online'
                ? { ...prev, state: authoritativeState, key: prev.key + 1 }
                : prev,
            );
          },
          onRoomClosed: (reason) => {
            onlineClientRef.current = null;
            syncRoomUrl(null);
            setOnlineSnapshot(null);
            setActiveMatch((prev) => (prev?.mode === 'online' ? null : prev));
            setScreen('mode-select');
            setOnlineLoading(false);
            setAutoRestoringCode(null);
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

  // Tự động khôi phục phòng Online sau khi F5
  useEffect(() => {
    const saved = initialOnlineRef.current;
    if (!shouldAutoRestoreOnline || !saved) return;
    let cancelled = false;
    const client = createOnlineClient(saved.roomCode, saved.playerName, saved.isHost);
    void client
      .rejoinExistingRoom()
      .then((restored) => {
        if (cancelled) return;
        setScreen('online-lobby');
        if (restored.phase === 'PLAYING' && restored.matchState) {
          setActiveMatch({
            state: restored.matchState,
            mode: 'online',
            botDifficulty: restored.botDifficulty,
            key: Date.now(),
          });
        }
        setAutoRestoringCode(null);
      })
      .catch((err) => {
        if (cancelled) return;
        client.destroy();
        onlineClientRef.current = null;
        clearPersistedCoCaNguaSession();
        syncRoomUrl(null);
        setResumableOnlineSession(null);
        setAutoRestoringCode(null);
        setScreen('mode-select');
        setOnlineError(err instanceof Error ? err.message : 'Phòng Online trước đó đã đóng.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartLocalMatch = (config: LocalCoCaNguaSetupConfig) => {
    setLastLocalConfig(config);
    clearOfflineCoCaNguaMatch();
    setSavedOfflineMatch(null);

    // Tạo trạng thái theo chiều kim đồng hồ chuẩn, rồi xác định người đi trước
    const tempState = createInitialCoCaNguaState({
      players: config.players,
    });
    let startIdx = 0;
    if (config.startingPolicy === 'random') {
      startIdx = cryptoRandomInt(0, tempState.players.length - 1);
    } else {
      const firstColor = config.players[0]?.color;
      const found = tempState.players.findIndex((p) => p.color === firstColor);
      startIdx = found >= 0 ? found : 0;
    }

    const fresh = createInitialCoCaNguaState({
      players: config.players,
      startingPlayerIndex: startIdx,
    });

    setActiveMatch((prev) => ({
      state: fresh,
      mode: config.mode,
      botDifficulty: config.botDifficulty,
      key: (prev?.key ?? 0) + 1,
    }));
  };

  const handleCreateOnlineRoom = async (playerName: string) => {
    setOnlineError(null);
    setOnlineLoading(true);
    const code = generateCoCaNguaRoomCode();
    const client = createOnlineClient(code, playerName, true);
    try {
      const confirmed = await client.startAsHost(1);
      syncRoomUrl(confirmed);
      setScreen('online-lobby');
    } catch (err) {
      client.destroy();
      onlineClientRef.current = null;
      setOnlineSnapshot(null);
      setOnlineError(err instanceof Error ? err.message : 'Không thể tạo phòng Online.');
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

  const handleReconnectOnline = async () => {
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
        setActiveMatch({
          state: restored.matchState,
          mode: 'online',
          botDifficulty: restored.botDifficulty,
          key: Date.now(),
        });
      }
    } catch (err) {
      client.destroy();
      onlineClientRef.current = null;
      clearPersistedCoCaNguaSession();
      syncRoomUrl(null);
      setResumableOnlineSession(null);
      setOnlineError(err instanceof Error ? err.message : 'Phòng cũ đã đóng.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleStartOnlineMatch = () => {
    const initial = onlineClientRef.current?.startMatch();
    if (!initial) return;
    const snap = onlineClientRef.current?.getSnapshot();
    setActiveMatch((prev) => ({
      state: initial,
      mode: 'online',
      botDifficulty: snap?.botDifficulty ?? 'medium',
      key: (prev?.key ?? 0) + 1,
    }));
  };

  const handleDissolveRoom = useCallback(() => {
    cleanupOnlineClient('Ván Cờ Cá Ngựa Online đã kết thúc.');
    setActiveMatch(null);
    setScreen('mode-select');
    setOnlineError(null);
  }, [cleanupOnlineClient]);

  const registerRemoteActionHandler = useCallback(
    (fn: (ev: RemoteHorseActionEvent) => void) => {
      remoteActionHandlerRef.current = fn;
      return () => {
        if (remoteActionHandlerRef.current === fn) remoteActionHandlerRef.current = null;
      };
    },
    [],
  );

  const handleCommitOnlineAction = useCallback(
    (actorColor: HorseColor, action: CoCaNguaAction, nextState: CoCaNguaState) => {
      onlineClientRef.current?.broadcastCommittedAction(actorColor, action, nextState);
    },
    [],
  );

  const onlineContext = useMemo<CoCaNguaOnlineContext | undefined>(() => {
    if (activeMatch?.mode !== 'online' || !onlineSnapshot || !onlineClientRef.current) {
      return undefined;
    }
    const me = onlineSnapshot.humans.find((h) => h.playerToken === myToken);
    return {
      roomCode: onlineSnapshot.roomCode,
      localColor: me?.color ?? 'red',
      isHost: onlineClientRef.current.isHost,
      snapshot: onlineSnapshot,
      onCommitAction: handleCommitOnlineAction,
      registerRemoteActionHandler,
      onDissolveRoom: handleDissolveRoom,
    };
  }, [
    activeMatch?.mode,
    onlineSnapshot,
    myToken,
    handleCommitOnlineAction,
    registerRemoteActionHandler,
    handleDissolveRoom,
  ]);

  // 0. Đang khôi phục phòng Online sau khi F5
  if (autoRestoringCode) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-950 p-6 text-white">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-amber-300/45 bg-stone-900/90 px-8 py-6 text-center shadow-2xl">
          <Loader2 className="h-9 w-9 animate-spin text-amber-300" />
          <div className="text-base font-black text-amber-200">
            Đang khôi phục phòng Cờ Cá Ngựa #{autoRestoringCode}...
          </div>
        </div>
      </div>
    );
  }

  // 1. Đang chơi ván Cờ Cá Ngựa
  if (activeMatch) {
    return (
      <HorseBoardView
        key={activeMatch.key}
        initialState={activeMatch.state}
        mode={activeMatch.mode}
        botDifficulty={activeMatch.botDifficulty}
        onlineContext={onlineContext}
        onRestartLocal={() => {
          if (lastLocalConfig) {
            handleStartLocalMatch(lastLocalConfig);
          } else {
            handleStartLocalMatch({
              mode: activeMatch.mode === 'pass-and-play' ? 'pass-and-play' : 'vs-bot',
              playerCount: activeMatch.state.players.length as 2 | 3 | 4,
              botDifficulty: activeMatch.botDifficulty,
              startingPolicy: 'first',
              players: activeMatch.state.players.map((p) => ({
                color: p.color,
                name: p.name,
                isBot: p.isBot,
              })),
            });
          }
        }}
        onBackToLobby={() => {
          if (activeMatch.mode === 'online') {
            handleDissolveRoom();
          } else {
            setActiveMatch(null);
            setSavedOfflineMatch(loadOfflineCoCaNguaMatch());
            setScreen('mode-select');
          }
        }}
      />
    );
  }

  // 2. Sảnh Chọn Chế Độ
  if (screen === 'mode-select') {
    return (
      <ModeSelectView
        savedOfflineMatch={savedOfflineMatch}
        resumableOnlineSession={resumableOnlineSession}
        initialRoomCode={initialUrlRoomRef.current}
        onlineLoading={onlineLoading}
        onlineError={onlineError}
        defaultPlayerName="Kỵ Sĩ"
        onBackToHub={() => {
          cleanupOnlineClient();
          writePersistedView(null);
          onExitToHub();
        }}
        onOpenLocalSetup={(preset) => {
          setLocalPreset(preset);
          setScreen('local-setup');
        }}
        onResumeOfflineMatch={() => {
          if (!savedOfflineMatch) return;
          soundEngine.playEnterGame();
          setActiveMatch({
            state: savedOfflineMatch.state,
            mode: savedOfflineMatch.mode,
            botDifficulty: savedOfflineMatch.botDifficulty,
            key: Date.now(),
          });
        }}
        onCreateOnlineRoom={(name) => void handleCreateOnlineRoom(name)}
        onJoinOnlineRoom={(code, name) => void handleJoinOnlineRoom(code, name)}
        onReconnectOnlineSession={() => void handleReconnectOnline()}
      />
    );
  }

  // 3. Thiết lập ván Offline (Đấu Máy AI / 2–4 Người Chung 1 Máy)
  if (screen === 'local-setup') {
    return (
      <LocalSetupView
        initialMode={localPreset}
        onBack={() => setScreen('mode-select')}
        onStartMatch={handleStartLocalMatch}
      />
    );
  }

  // 4. Phòng chờ Online 6 số
  if (screen === 'online-lobby' && onlineSnapshot && onlineClientRef.current) {
    return (
      <OnlineLobbyView
        snapshot={onlineSnapshot}
        myToken={myToken}
        isHost={onlineClientRef.current.isHost}
        transportStatus={onlineStatus}
        transportMessage={onlineStatusMsg}
        onUpdateMember={(token, patch) => onlineClientRef.current?.updateMember(token, patch)}
        onSetBotCount={(cnt) => onlineClientRef.current?.setBotCount(cnt)}
        onSetBotDifficulty={(diff) => onlineClientRef.current?.setBotDifficulty(diff)}
        onKickMember={(token) => onlineClientRef.current?.kickMember(token)}
        onStartMatch={handleStartOnlineMatch}
        onLeaveOrDissolve={handleDissolveRoom}
      />
    );
  }

  return null;
}
