import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { cryptoRandomInt } from '@/shared/crypto/random';
import type { GameComponentProps } from '@/shared/types/gameEntry';
import { createInitialOAnQuanState } from './engine/reducer';
import type {
  BotDifficulty,
  OAnQuanState,
  PlayerSide,
  SowDirection,
} from './engine/types';
import { LocalSetupView, type LocalMatchSetupConfig } from './lobby/LocalSetupView';
import { ModeSelectView } from './lobby/ModeSelectView';
import {
  clearOfflineOAnQuanMatch,
  loadOfflineOAnQuanMatch,
  type SavedOfflineOAnQuanMatch,
} from './lobby/offlineSave';
import { OnlineLobbyView } from './lobby/OnlineLobbyView';
import {
  clearPersistedOAnQuanSession,
  generateOAnQuanRoomCode,
  getOrCreateOAnQuanToken,
  loadPersistedOAnQuanSession,
  OAnQuanOnlineClient,
  type OAnQuanRoomSnapshot,
  type OnlineTransportStatus,
  type PersistedOAnQuanSession,
  type RemoteOAnQuanMoveEvent,
} from './network/onlineRoomClient';
import { GameBoardView, type OAnQuanOnlineContext } from './ui/GameBoardView';

type LobbyScreen = 'mode-select' | 'local-setup' | 'online-lobby';
type PersistedView =
  | 'mode-select'
  | 'local-setup'
  | 'playing-offline'
  | 'online-lobby'
  | 'playing-online';

const VIEW_STATE_KEY = 'bgvn_oanquan_view_state_v1';

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

function syncRoomUrl(roomCode: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('game', 'o-an-quan');
    if (roomCode) url.searchParams.set('room', roomCode);
    else url.searchParams.delete('room');
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch {
    // Ignore
  }
}

export default function OAnQuanGame({ onExitToHub }: GameComponentProps) {
  const initialViewRef = useRef<PersistedView | null>(readPersistedView());
  const initialOfflineRef = useRef<SavedOfflineOAnQuanMatch | null>(loadOfflineOAnQuanMatch());
  const initialOnlineRef = useRef<PersistedOAnQuanSession | null>(loadPersistedOAnQuanSession());
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
  const [lastLocalConfig, setLastLocalConfig] = useState<LocalMatchSetupConfig | null>(null);

  const [savedOfflineMatch, setSavedOfflineMatch] = useState<SavedOfflineOAnQuanMatch | null>(
    () => initialOfflineRef.current,
  );

  const [activeMatch, setActiveMatch] = useState<{
    state: OAnQuanState;
    mode: 'vs-bot' | 'pass-and-play' | 'online';
    botDifficulty: BotDifficulty;
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
  const [myToken] = useState<string>(() => getOrCreateOAnQuanToken());
  const [resumableOnlineSession, setResumableOnlineSession] =
    useState<PersistedOAnQuanSession | null>(() => initialOnlineRef.current);
  const [autoRestoringCode, setAutoRestoringCode] = useState<string | null>(() =>
    shouldAutoRestoreOnline ? initialOnlineRef.current?.roomCode ?? null : null,
  );
  const [onlineSnapshot, setOnlineSnapshot] = useState<OAnQuanRoomSnapshot | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineTransportStatus>('CONNECTING');
  const [onlineStatusMsg, setOnlineStatusMsg] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const onlineClientRef = useRef<OAnQuanOnlineClient | null>(null);
  const remoteMoveHandlerRef = useRef<((ev: RemoteOAnQuanMoveEvent) => void) | null>(null);
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
    const inLobby = !activeMatch;
    soundEngine.setHubActive(inLobby);
    if (inLobby && !muted) {
      soundEngine.startHubBgm();
    }
  }, [activeMatch, muted]);

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
      if (dissolveReason) client.dissolveOrLeave(dissolveReason);
      else client.destroy();
      onlineClientRef.current = null;
    }
    syncRoomUrl(null);
    setOnlineSnapshot(null);
    setOnlineLoading(false);
    setResumableOnlineSession(loadPersistedOAnQuanSession());
  }, []);

  const createOnlineClient = useCallback(
    (roomCode: string, playerName: string, isHost: boolean) => {
      onlineClientRef.current?.destroy();
      const client = new OAnQuanOnlineClient({
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
                  botDifficulty: 'medium',
                  key: (prev?.key ?? 0) + 1,
                };
              });
            }
          },
          onStatusChange: (st, msg) => {
            setOnlineStatus(st);
            setOnlineStatusMsg(msg);
          },
          onRemoteMove: (ev) => {
            remoteMoveHandlerRef.current?.(ev);
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
            botDifficulty: 'medium',
            key: Date.now(),
          });
        }
        setAutoRestoringCode(null);
      })
      .catch((err) => {
        if (cancelled) return;
        client.destroy();
        onlineClientRef.current = null;
        clearPersistedOAnQuanSession();
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

  const handleStartLocalMatch = (config: LocalMatchSetupConfig) => {
    setLastLocalConfig(config);
    clearOfflineOAnQuanMatch();
    setSavedOfflineMatch(null);
    const startSide: PlayerSide =
      config.startingSide === 'random' ? (cryptoRandomInt(0, 1) as PlayerSide) : config.startingSide;
    const fresh = createInitialOAnQuanState({
      player0: { name: config.player0Name, characterId: config.player0Char, isBot: false },
      player1: {
        name: config.player1Name,
        characterId: config.player1Char,
        isBot: config.mode === 'vs-bot',
      },
      startingSide: startSide,
      rules: {
        mandarinPointValue: config.mandarinPointValue,
        mandarinYouthRule: config.mandarinYouthRule,
        minStonesForMandarin: 5,
      },
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
    const code = generateOAnQuanRoomCode();
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
        setActiveMatch({
          state: restored.matchState,
          mode: 'online',
          botDifficulty: 'medium',
          key: Date.now(),
        });
      }
    } catch (err) {
      client.destroy();
      onlineClientRef.current = null;
      clearPersistedOAnQuanSession();
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
    setActiveMatch((prev) => ({
      state: initial,
      mode: 'online',
      botDifficulty: 'medium',
      key: (prev?.key ?? 0) + 1,
    }));
  };

  const handleDissolveRoom = useCallback(() => {
    cleanupOnlineClient('Ván Ô Ăn Quan Online đã kết thúc.');
    setActiveMatch(null);
    setScreen('mode-select');
    setOnlineError(null);
  }, [cleanupOnlineClient]);

  const registerRemoteMoveHandler = useCallback((fn: (ev: RemoteOAnQuanMoveEvent) => void) => {
    remoteMoveHandlerRef.current = fn;
    return () => {
      if (remoteMoveHandlerRef.current === fn) remoteMoveHandlerRef.current = null;
    };
  }, []);

  const handleCommitLocalOnlineMove = useCallback(
    (side: PlayerSide, pitIndex: number, direction: SowDirection, nextState: OAnQuanState) => {
      onlineClientRef.current?.broadcastCommittedMove(side, pitIndex, direction, nextState);
    },
    [],
  );

  const handleSyncRemoteVerifiedState = useCallback(
    (verifiedState: OAnQuanState, matchVersion: number) => {
      onlineClientRef.current?.syncVerifiedStateAfterRemoteMove(verifiedState, matchVersion);
    },
    [],
  );

  // 0. Đang khôi phục phòng Online sau khi F5
  if (autoRestoringCode) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-950 p-6 text-white">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-amber-300/45 bg-stone-900/90 px-8 py-6 text-center shadow-2xl">
          <Loader2 className="h-9 w-9 animate-spin text-amber-300" />
          <div className="text-base font-black text-amber-200">
            Đang khôi phục phòng Ô Ăn Quan #{autoRestoringCode}...
          </div>
        </div>
      </div>
    );
  }

  // 1. Đang chơi ván Ô Ăn Quan (Offline hoặc Online)
  if (activeMatch) {
    let onlineContext: OAnQuanOnlineContext | undefined;
    if (activeMatch.mode === 'online' && onlineSnapshot && onlineClientRef.current) {
      const me = onlineSnapshot.members.find((m) => m.playerToken === myToken);
      onlineContext = {
        roomCode: onlineSnapshot.roomCode,
        localSide: me?.side ?? 0,
        isHost: onlineClientRef.current.isHost,
        snapshot: onlineSnapshot,
        onCommitLocalMove: handleCommitLocalOnlineMove,
        onSyncRemoteVerifiedState: handleSyncRemoteVerifiedState,
        registerRemoteMoveHandler,
        onDissolveRoom: handleDissolveRoom,
      };
    }

    return (
      <GameBoardView
        key={activeMatch.key}
        initialState={activeMatch.state}
        mode={activeMatch.mode}
        botDifficulty={activeMatch.botDifficulty}
        onlineContext={onlineContext}
        onRestartLocal={() => {
          if (lastLocalConfig) {
            handleStartLocalMatch(lastLocalConfig);
          } else {
            const p0 = activeMatch.state.players[0];
            const p1 = activeMatch.state.players[1];
            handleStartLocalMatch({
              mode: activeMatch.mode === 'pass-and-play' ? 'pass-and-play' : 'vs-bot',
              player0Name: p0.name,
              player1Name: p1.name,
              player0Char: p0.characterId,
              player1Char: p1.characterId,
              botDifficulty: activeMatch.botDifficulty,
              startingSide: 0,
              mandarinPointValue: activeMatch.state.rules.mandarinPointValue ?? 10,
              mandarinYouthRule: activeMatch.state.rules.mandarinYouthRule,
            });
          }
        }}
        onBackToLobby={() => {
          if (activeMatch.mode === 'online') {
            handleDissolveRoom();
          } else {
            setActiveMatch(null);
            setSavedOfflineMatch(loadOfflineOAnQuanMatch());
            setScreen('mode-select');
          }
        }}
      />
    );
  }

  // 2. Sảnh Chọn Chế Độ (Đấu Máy AI / 2 Người 1 Máy / Phòng Online Mã 6 Số)
  if (screen === 'mode-select') {
    return (
      <ModeSelectView
        savedOfflineMatch={savedOfflineMatch}
        resumableOnlineSession={resumableOnlineSession}
        initialRoomCode={initialUrlRoomRef.current}
        onlineLoading={onlineLoading}
        onlineError={onlineError}
        defaultPlayerName="Cu Tí"
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

  // 3. Thiết lập ván Offline (Đấu Máy AI 3 cấp / 2 Người 1 Máy)
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
        onUpdateRules={(patch) => onlineClientRef.current?.updateRoomRules(patch)}
        onStartMatch={handleStartOnlineMatch}
        onLeaveOrDissolve={handleDissolveRoom}
      />
    );
  }

  return null;
}
