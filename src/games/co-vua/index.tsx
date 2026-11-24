import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { cryptoRandomInt } from '@/shared/crypto/random';
import type { GameComponentProps } from '@/shared/types/gameEntry';
import { createInitialChessState } from './engine/reducer';
import type { ChessAction, ChessBotDifficulty, ChessColor, ChessState } from './engine/types';
import { LocalSetupView, type LocalChessSetupConfig } from './lobby/LocalSetupView';
import { ModeSelectView } from './lobby/ModeSelectView';
import {
  clearOfflineChessMatch,
  loadOfflineChessMatch,
  type SavedOfflineChessMatch,
} from './lobby/offlineSave';
import { OnlineLobbyView } from './lobby/OnlineLobbyView';
import {
  ChessOnlineClient,
  clearPersistedChessSession,
  generateChessRoomCode,
  getOrCreateChessToken,
  loadPersistedChessSession,
  type ChessRoomSnapshot,
  type OnlineTransportStatus,
  type PersistedChessSession,
  type RemoteChessActionEvent,
} from './network/onlineRoomClient';
import { ChessBoardView, type ChessOnlineContext } from './ui/ChessBoardView';

type LobbyScreen = 'mode-select' | 'local-setup' | 'online-lobby';
type PersistedView =
  | 'mode-select'
  | 'local-setup'
  | 'playing-offline'
  | 'online-lobby'
  | 'playing-online';

const VIEW_STATE_KEY = 'bgvn_covua_view_state_v1';

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

export default function CoVuaGame({ onExitToHub }: GameComponentProps) {
  const initialViewRef = useRef<PersistedView | null>(readPersistedView());
  const initialOfflineRef = useRef<SavedOfflineChessMatch | null>(loadOfflineChessMatch());
  const initialOnlineRef = useRef<PersistedChessSession | null>(loadPersistedChessSession());
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
  const [lastLocalConfig, setLastLocalConfig] = useState<LocalChessSetupConfig | null>(null);
  const [savedOfflineMatch, setSavedOfflineMatch] = useState<SavedOfflineChessMatch | null>(
    () => initialOfflineRef.current,
  );

  const [activeMatch, setActiveMatch] = useState<{
    state: ChessState;
    mode: 'vs-bot' | 'pass-and-play' | 'online';
    botDifficulty: ChessBotDifficulty;
    humanColor: ChessColor;
    autoFlip: boolean;
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
        humanColor: initialOfflineRef.current.humanColor,
        autoFlip: initialOfflineRef.current.autoFlip,
        key: 1,
      };
    }
    return null;
  });

  const [myToken] = useState<string>(() => getOrCreateChessToken());
  const [resumableOnlineSession, setResumableOnlineSession] =
    useState<PersistedChessSession | null>(() => initialOnlineRef.current);
  const [autoRestoringCode, setAutoRestoringCode] = useState<string | null>(() =>
    shouldAutoRestoreOnline ? initialOnlineRef.current?.roomCode ?? null : null,
  );
  const [onlineSnapshot, setOnlineSnapshot] = useState<ChessRoomSnapshot | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineTransportStatus>('CONNECTING');
  const [onlineStatusMsg, setOnlineStatusMsg] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const onlineClientRef = useRef<ChessOnlineClient | null>(null);
  const remoteActionHandlerRef = useRef<((ev: RemoteChessActionEvent) => void) | null>(null);
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
    soundEngine.setBgmScene('co-vua');
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
    setResumableOnlineSession(loadPersistedChessSession());
  }, []);

  const createOnlineClient = useCallback(
    (roomCode: string, playerName: string, isHost: boolean) => {
      onlineClientRef.current?.destroy();
      const client = new ChessOnlineClient({
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
                const me = snap.humans.find((h) => h.playerToken === myToken);
                return {
                  state: snap.matchState!,
                  mode: 'online',
                  botDifficulty: 'medium',
                  humanColor: me?.color ?? 'white',
                  autoFlip: false,
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
          onPeerJoined: () => soundEngine.playRoomJoin(),
        },
      });
      onlineClientRef.current = client;
      return client;
    },
    [myToken],
  );

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
          const me = restored.humans.find((h) => h.playerToken === myToken);
          setActiveMatch({
            state: restored.matchState,
            mode: 'online',
            botDifficulty: 'medium',
            humanColor: me?.color ?? 'white',
            autoFlip: false,
            key: Date.now(),
          });
        }
        setAutoRestoringCode(null);
      })
      .catch((err) => {
        if (cancelled) return;
        client.destroy();
        onlineClientRef.current = null;
        clearPersistedChessSession();
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

  const handleStartLocalMatch = (config: LocalChessSetupConfig) => {
    setLastLocalConfig(config);
    clearOfflineChessMatch();
    setSavedOfflineMatch(null);

    const resolvedHuman: ChessColor =
      config.humanColor === 'random'
        ? cryptoRandomInt(0, 1) === 0
          ? 'white'
          : 'black'
        : config.humanColor;

    const fresh = createInitialChessState({
      whiteName:
        config.mode === 'vs-bot'
          ? resolvedHuman === 'white'
            ? 'Bạn (Trắng)'
            : 'Máy AI (Trắng)'
          : config.whiteName,
      whiteIsBot: config.mode === 'vs-bot' && resolvedHuman === 'black',
      blackName:
        config.mode === 'vs-bot'
          ? resolvedHuman === 'black'
            ? 'Bạn (Đen)'
            : 'Máy AI (Đen)'
          : config.blackName,
      blackIsBot: config.mode === 'vs-bot' && resolvedHuman === 'white',
    });

    setActiveMatch((prev) => ({
      state: fresh,
      mode: config.mode,
      botDifficulty: config.botDifficulty,
      humanColor: resolvedHuman,
      autoFlip: config.autoFlip,
      key: (prev?.key ?? 0) + 1,
    }));
  };

  const handleCreateOnlineRoom = async (playerName: string) => {
    setOnlineError(null);
    setOnlineLoading(true);
    const code = generateChessRoomCode();
    const client = createOnlineClient(code, playerName, true);
    try {
      const confirmed = await client.startAsHost();
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
        const me = restored.humans.find((h) => h.playerToken === myToken);
        setActiveMatch({
          state: restored.matchState,
          mode: 'online',
          botDifficulty: 'medium',
          humanColor: me?.color ?? 'white',
          autoFlip: false,
          key: Date.now(),
        });
      }
    } catch (err) {
      client.destroy();
      onlineClientRef.current = null;
      clearPersistedChessSession();
      syncRoomUrl(null);
      setResumableOnlineSession(null);
      setOnlineError(err instanceof Error ? err.message : 'Phòng cũ đã đóng.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleStartOnlineMatch = () => {
    const initial = onlineClientRef.current?.startMatch();
    const snap = onlineClientRef.current?.getSnapshot();
    if (!initial || !snap) return;
    const me = snap.humans.find((h) => h.playerToken === myToken);
    setActiveMatch((prev) => ({
      state: initial,
      mode: 'online',
      botDifficulty: 'medium',
      humanColor: me?.color ?? 'white',
      autoFlip: false,
      key: (prev?.key ?? 0) + 1,
    }));
  };

  const handleDissolveRoom = useCallback(() => {
    cleanupOnlineClient('Ván Cờ Vua Online đã kết thúc.');
    setActiveMatch(null);
    setScreen('mode-select');
    setOnlineError(null);
  }, [cleanupOnlineClient]);

  const registerRemoteActionHandler = useCallback(
    (fn: (ev: RemoteChessActionEvent) => void) => {
      remoteActionHandlerRef.current = fn;
      return () => {
        if (remoteActionHandlerRef.current === fn) remoteActionHandlerRef.current = null;
      };
    },
    [],
  );

  const handleCommitOnlineAction = useCallback((action: ChessAction, nextState: ChessState) => {
    onlineClientRef.current?.broadcastCommittedAction(action, nextState);
  }, []);

  if (autoRestoringCode) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-sky-300/45 bg-slate-900/90 px-8 py-6 text-center shadow-2xl">
          <Loader2 className="h-9 w-9 animate-spin text-sky-300" />
          <div className="text-base font-black text-sky-200">
            Đang khôi phục phòng Cờ Vua #{autoRestoringCode}...
          </div>
        </div>
      </div>
    );
  }

  if (activeMatch) {
    let onlineContext: ChessOnlineContext | undefined;
    if (activeMatch.mode === 'online' && onlineSnapshot && onlineClientRef.current) {
      const me = onlineSnapshot.humans.find((h) => h.playerToken === myToken);
      onlineContext = {
        roomCode: onlineSnapshot.roomCode,
        localColor: me?.color ?? 'white',
        snapshot: onlineSnapshot,
        onCommitAction: handleCommitOnlineAction,
        registerRemoteActionHandler,
      };
    }

    return (
      <ChessBoardView
        key={activeMatch.key}
        initialState={activeMatch.state}
        mode={activeMatch.mode}
        botDifficulty={activeMatch.botDifficulty}
        humanColor={activeMatch.humanColor}
        autoFlip={activeMatch.autoFlip}
        onlineContext={onlineContext}
        onRestartLocal={() => {
          if (lastLocalConfig) {
            handleStartLocalMatch(lastLocalConfig);
          } else {
            handleStartLocalMatch({
              mode: activeMatch.mode === 'pass-and-play' ? 'pass-and-play' : 'vs-bot',
              whiteName: activeMatch.state.players.white.name,
              blackName: activeMatch.state.players.black.name,
              humanColor: activeMatch.humanColor,
              botDifficulty: activeMatch.botDifficulty,
              autoFlip: activeMatch.autoFlip,
            });
          }
        }}
        onBackToLobby={() => {
          if (activeMatch.mode === 'online') {
            handleDissolveRoom();
          } else {
            setActiveMatch(null);
            setSavedOfflineMatch(loadOfflineChessMatch());
            setScreen('mode-select');
          }
        }}
      />
    );
  }

  if (screen === 'mode-select') {
    return (
      <ModeSelectView
        savedOfflineMatch={savedOfflineMatch}
        resumableOnlineSession={resumableOnlineSession}
        initialRoomCode={initialUrlRoomRef.current}
        onlineLoading={onlineLoading}
        onlineError={onlineError}
        defaultPlayerName="Kỳ Thủ"
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
            humanColor: savedOfflineMatch.humanColor,
            autoFlip: savedOfflineMatch.autoFlip,
            key: Date.now(),
          });
        }}
        onCreateOnlineRoom={(name) => void handleCreateOnlineRoom(name)}
        onJoinOnlineRoom={(code, name) => void handleJoinOnlineRoom(code, name)}
        onReconnectOnlineSession={() => void handleReconnectOnline()}
      />
    );
  }

  if (screen === 'local-setup') {
    return (
      <LocalSetupView
        initialMode={localPreset}
        onBack={() => setScreen('mode-select')}
        onStartMatch={handleStartLocalMatch}
      />
    );
  }

  if (screen === 'online-lobby' && onlineSnapshot && onlineClientRef.current) {
    return (
      <OnlineLobbyView
        snapshot={onlineSnapshot}
        myToken={myToken}
        isHost={onlineClientRef.current.isHost}
        transportStatus={onlineStatus}
        transportMessage={onlineStatusMsg}
        onSwapColors={() => onlineClientRef.current?.swapColors()}
        onStartMatch={handleStartOnlineMatch}
        onLeaveOrDissolve={handleDissolveRoom}
      />
    );
  }

  return null;
}
