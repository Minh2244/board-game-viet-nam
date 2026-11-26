import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachAutoDisconnect,
  attachMultiSourceAutoDisconnect,
  createIdleAudioContextManager,
} from '@/shared/audio/audioLifecycle';
import {
  AblyFastLane,
  type AblyConnectionStateChangeLike,
  type AblyRealtimeLike,
} from '@/shared/network/ablyFastLane';
import { createOrderedActionBuffer, fetchJsonWithTimeout } from '@/shared/network/onlineReliability';
import { computeBotAction } from '../co-ty-phu/ai/smartBot';
import { CHANCE_CARDS } from '../co-ty-phu/data/cards';
import { createInitialGameState, reduceGameAction } from '../co-ty-phu/engine/reducer';
import { OnlineRoomClient, type OnlineRoomSnapshot } from '../co-ty-phu/network/onlineRoomClient';

function createFakeAudioNode() {
  return {
    disconnect: vi.fn(),
    onended: null as ((ev: Event) => void) | null,
  };
}

describe('Online Freeze & Long-Session Stability Audit', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('attachAutoDisconnect ngắt sạch toàn bộ node tạm (source/filter/gain) ngay khi phát xong', () => {
    const src = createFakeAudioNode();
    const flt = createFakeAudioNode();
    const gain = createFakeAudioNode();

    attachAutoDisconnect(
      src as unknown as AudioScheduledSourceNode,
      [flt as unknown as AudioNode, gain as unknown as AudioNode],
    );

    expect(typeof src.onended).toBe('function');
    src.onended?.(new Event('ended'));

    expect(src.disconnect).toHaveBeenCalledTimes(1);
    expect(flt.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
    expect(src.onended).toBeNull();
  });

  it('attachMultiSourceAutoDisconnect chỉ ngắt node dùng chung sau khi oscillator cuối cùng kết thúc', () => {
    const osc1 = createFakeAudioNode();
    const osc2 = createFakeAudioNode();
    const sharedFilter = createFakeAudioNode();
    const sharedGain = createFakeAudioNode();

    attachMultiSourceAutoDisconnect(
      [osc1 as unknown as AudioScheduledSourceNode, osc2 as unknown as AudioScheduledSourceNode],
      [sharedFilter as unknown as AudioNode, sharedGain as unknown as AudioNode],
    );

    osc1.onended?.(new Event('ended'));
    expect(osc1.disconnect).toHaveBeenCalledTimes(1);
    expect(sharedFilter.disconnect).not.toHaveBeenCalled();
    expect(sharedGain.disconnect).not.toHaveBeenCalled();

    osc2.onended?.(new Event('ended'));
    expect(osc2.disconnect).toHaveBeenCalledTimes(1);
    expect(sharedFilter.disconnect).toHaveBeenCalledTimes(1);
    expect(sharedGain.disconnect).toHaveBeenCalledTimes(1);
  });

  it('createIdleAudioContextManager tự suspend SFX AudioContext sau ngưỡng im lặng và resume khi phát lại', async () => {
    vi.useFakeTimers();
    const fakeCtx = {
      state: 'running' as AudioContextState,
      suspend: vi.fn(async () => {
        fakeCtx.state = 'suspended';
      }),
      resume: vi.fn(async () => {
        fakeCtx.state = 'running';
      }),
    };

    const mgr = createIdleAudioContextManager(() => fakeCtx as unknown as AudioContext, 8000);
    mgr.touch();

    await vi.advanceTimersByTimeAsync(7900);
    expect(fakeCtx.suspend).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(fakeCtx.suspend).toHaveBeenCalledTimes(1);
    expect(fakeCtx.state).toBe('suspended');

    mgr.touch();
    expect(fakeCtx.resume).toHaveBeenCalledTimes(1);
    mgr.dispose();
  });

  it('fetchJsonWithTimeout tự động hủy request bị treo bằng AbortController sau timeoutMs', async () => {
    vi.useFakeTimers();
    const abortSpy = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            abortSpy();
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      }),
    );

    const pending = fetchJsonWithTimeout('/api/room', { method: 'POST', body: '{}' }, 1500);
    // Gắn catch trước khi tua timer để tránh unhandled rejection warning của Node/Vitest
    const rejectionAssertion = expect(pending).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(1600);
    await rejectionAssertion;
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  it('AblyFastLane ưu tiên Ably khi thông (không cần WebRTC fallback) và kích hoạt onFallbackNeeded khi tắt/hết hạn mức', async () => {
    const listeners: ((c: AblyConnectionStateChangeLike) => void)[] = [];
    const onFallback = vi.fn();
    const onAvail = vi.fn();

    const connectedLane = new AblyFastLane({
      game: 'co-ty-phu',
      roomCode: '123456',
      clientId: 'tk_a',
      onPacket: vi.fn(),
      onAvailabilityChange: onAvail,
      onFallbackNeeded: onFallback,
      tokenFetchFn: async () => ({
        ok: true,
        enabled: true,
        channelName: 'bgvn:co-ty-phu:123456',
        tokenRequest: { keyName: 'demo' },
      }),
      ablyClientFactory: () =>
        ({
          connection: {
            state: 'connecting',
            on: (fn) => {
              listeners.push(fn);
            },
          },
          channels: {
            get: () => ({
              subscribe: vi.fn(),
              publish: vi.fn(),
            }),
          },
          close: vi.fn(),
        }) as AblyRealtimeLike,
    });

    await connectedLane.start();
    expect(connectedLane.shouldPreferAbly()).toBe(true);
    listeners.forEach((fn) => fn({ current: 'connected' }));
    expect(connectedLane.isAvailable()).toBe(true);
    expect(onAvail).toHaveBeenCalledWith(true);
    expect(onFallback).not.toHaveBeenCalled();

    // Khi Ably báo lỗi vượt quota (42900) -> lập tức degrade và kích hoạt fallback!
    listeners.forEach((fn) =>
      fn({ current: 'failed', reason: { code: 42900, statusCode: 429, message: 'Rate limit exceeded' } }),
    );
    expect(connectedLane.isPermanentlyDegraded()).toBe(true);
    expect(connectedLane.shouldPreferAbly()).toBe(false);
    expect(onFallback).toHaveBeenCalled();
    connectedLane.destroy();

    // Khi server không bật Ably -> báo onFallbackNeeded ngay lập tức
    const onDisabledFallback = vi.fn();
    const disabledLane = new AblyFastLane({
      game: 'co-ty-phu',
      roomCode: '654321',
      clientId: 'tk_b',
      onPacket: vi.fn(),
      onAvailabilityChange: vi.fn(),
      onFallbackNeeded: onDisabledFallback,
      tokenFetchFn: async () => ({ ok: true, enabled: false }),
    });
    await disabledLane.start();
    expect(disabledLane.shouldPreferAbly()).toBe(false);
    expect(onDisabledFallback).toHaveBeenCalledTimes(1);
    disabledLane.destroy();
  });

  it('OnlineRoomClient không mở RTCPeerConnection thừa khi Ably đang hoạt động và chặn gói ACTION_COMMIT cũ hơn matchVersion', () => {
    const rtcSpy = vi.fn();
    vi.stubGlobal('RTCPeerConnection', rtcSpy);

    const onRemoteAction = vi.fn();
    const client = new OnlineRoomClient({
      roomCode: '953513',
      playerToken: 'tk_aaa',
      playerName: 'Minh',
      isHost: true,
      callbacks: {
        onSnapshot: vi.fn(),
        onStatusChange: vi.fn(),
        onRemoteAction,
        onRoomClosed: vi.fn(),
      },
    });

    const initialState = createInitialGameState({
      slots: [
        { slotIndex: 0, name: 'Minh', isBot: false, characterId: 'ca_phe', landColor: 'red' },
        { slotIndex: 1, name: 'Kem', isBot: false, characterId: 'ao_dai_tim', landColor: 'purple' },
      ],
      diceCount: 2,
      mapMode: 'default',
    });

    const snap: OnlineRoomSnapshot = {
      roomCode: '953513',
      phase: 'PLAYING',
      hostToken: 'tk_aaa',
      botCount: 0,
      diceCount: 2,
      mapMode: 'default',
      humans: [
        {
          playerToken: 'tk_aaa',
          seatId: initialState.players[0].id,
          name: 'Minh',
          characterId: 'ca_phe',
          landColor: 'red',
          isHost: true,
          isBot: false,
          connected: true,
          disconnectedAt: null,
          botTakeover: false,
        },
        {
          playerToken: 'tk_zzz',
          seatId: initialState.players[1].id,
          name: 'Kem',
          characterId: 'ao_dai_tim',
          landColor: 'purple',
          isHost: false,
          isBot: false,
          connected: true,
          disconnectedAt: null,
          botTakeover: false,
        },
      ],
      bots: [],
      matchState: initialState,
      matchVersion: 56,
      updatedAt: Date.now(),
    };

    const internal = client as unknown as {
      snapshot: OnlineRoomSnapshot | null;
      ablyConnected: boolean;
      ensureRtcPeers: () => void;
      handleIncomingPacket: (pkt: Record<string, unknown>) => void;
    };

    internal.snapshot = snap;
    internal.ablyConnected = true;
    internal.ensureRtcPeers();
    expect(rtcSpy).not.toHaveBeenCalled();

    // Gói ACTION_COMMIT lạc nhịp có matchVersion <= 56 phải bị bỏ qua hoàn toàn (chống rewind / đúp bước)
    internal.handleIncomingPacket({
      msgId: 'msg_stale_55',
      senderToken: 'tk_zzz',
      type: 'ACTION_COMMIT',
      actionId: 'act_stale_55',
      action: { type: 'CONFIRM_CARD' },
      rollPower: 0.5,
      matchVersion: 55,
    });
    internal.handleIncomingPacket({
      msgId: 'msg_dup_56',
      senderToken: 'tk_zzz',
      type: 'ACTION_COMMIT',
      actionId: 'act_dup_56',
      action: { type: 'CONFIRM_CARD' },
      rollPower: 0.5,
      matchVersion: 56,
    });
    expect(onRemoteAction).not.toHaveBeenCalled();

    // Gói mới hợp lệ matchVersion = 57 đi qua bình thường
    internal.handleIncomingPacket({
      msgId: 'msg_fresh_57',
      senderToken: 'tk_zzz',
      type: 'ACTION_COMMIT',
      actionId: 'act_fresh_57',
      action: { type: 'ROLL_DICE', diceValues: [3, 4], rollPower: 0.6 },
      rollPower: 0.6,
      matchVersion: 57,
    });
    expect(onRemoteAction).toHaveBeenCalledTimes(1);
    expect(internal.snapshot?.matchVersion).toBe(57);

    client.destroy();
  });

  it('Reducer CONFIRM_CARD là idempotent khi Chủ phòng fallback và người rút gửi gần như cùng lúc', () => {
    const base = createInitialGameState({
      slots: [
        { slotIndex: 0, name: 'Minh', isBot: false, characterId: 'ca_phe', landColor: 'red' },
        { slotIndex: 1, name: 'Kem', isBot: false, characterId: 'ao_dai_tim', landColor: 'purple' },
      ],
      diceCount: 2,
      mapMode: 'default',
    });

    const bonusCard = CHANCE_CARDS.find((c) => c.effect.type === 'CASH_DELTA' && c.effect.amount > 0)!;
    const cardRevealState = {
      ...base,
      phase: 'CARD_REVEAL' as const,
      activeCard: {
        card: bonusCard,
        drawerId: base.players[0].id,
        tileIndex: 3,
        continueAfter: false,
      },
    };

    const first = reduceGameAction(cardRevealState, { type: 'CONFIRM_CARD' });
    expect(first.state.phase).not.toBe('CARD_REVEAL');
    expect(first.state.activeCard).toBeNull();

    // Lần 2 không còn ở CARD_REVEAL -> phải giữ nguyên state, không cộng tiền 2 lần!
    const cashAfterFirst = first.state.players[0].cash;
    const second = reduceGameAction(first.state, { type: 'CONFIRM_CARD' });
    expect(second.state.players[0].cash).toBe(cashAfterFirst);
    expect(second.events).toHaveLength(0);
  });

  it('createOrderedActionBuffer & OnlineRoomClient giữ đúng thứ tự khi gói v+2 đến trước v+1 (chống lệch lượt / đơ bàn)', () => {
    const buf = createOrderedActionBuffer<{ ver: number }>();
    expect(buf.ingest(55, 56, { ver: 55 })).toEqual({ status: 'stale' });
    expect(buf.ingest(58, 56, { ver: 58 })).toEqual({ status: 'buffered_gap', missingVersion: 57 });
    expect(buf.hasPending()).toBe(true);
    const ready = buf.ingest(57, 56, { ver: 57 });
    expect(ready).toEqual({ status: 'ready', orderedPackets: [{ ver: 57 }, { ver: 58 }] });
    expect(buf.hasPending()).toBe(false);

    // Kiểm chứng trực tiếp trên OnlineRoomClient Cờ Tỷ Phú: v=58 tới trước v=57 phải tạm giữ, khi v=57 về mới xả đúng thứ tự 57 -> 58!
    const receivedOrder: number[] = [];
    const client = new OnlineRoomClient({
      roomCode: '953513',
      playerToken: 'tk_host',
      playerName: 'Minh',
      isHost: true,
      callbacks: {
        onSnapshot: vi.fn(),
        onStatusChange: vi.fn(),
        onRemoteAction: (ev) => receivedOrder.push(ev.matchVersion),
        onRoomClosed: vi.fn(),
      },
    });
    const baseState = createInitialGameState({
      slots: [
        { slotIndex: 0, name: 'Minh', isBot: false, characterId: 'ca_phe', landColor: 'red' },
        { slotIndex: 1, name: 'Kem', isBot: false, characterId: 'ao_dai_tim', landColor: 'purple' },
      ],
      diceCount: 2,
      mapMode: 'default',
    });
    const internal = client as unknown as {
      snapshot: OnlineRoomSnapshot | null;
      handleIncomingPacket: (pkt: Record<string, unknown>) => void;
    };
    internal.snapshot = {
      roomCode: '953513',
      phase: 'PLAYING',
      hostToken: 'tk_host',
      botCount: 0,
      diceCount: 2,
      mapMode: 'default',
      humans: [],
      bots: [],
      matchState: baseState,
      matchVersion: 56,
      updatedAt: Date.now(),
    };

    // Gói 58 đến trước gói 57 -> KHÔNG được áp dụng lệch hoặc nâng matchVersion lên 58!
    internal.handleIncomingPacket({
      msgId: 'msg_ooo_58',
      senderToken: 'tk_guest',
      type: 'ACTION_COMMIT',
      actionId: 'act_ooo_58',
      action: { type: 'BUY_PROPERTY', buy: false },
      rollPower: 0.5,
      matchVersion: 58,
    });
    expect(receivedOrder).toEqual([]);
    expect(internal.snapshot?.matchVersion).toBe(56);

    // Gói 57 đến sau -> xả chuẩn 57 trước rồi mới đến 58!
    internal.handleIncomingPacket({
      msgId: 'msg_ooo_57',
      senderToken: 'tk_guest',
      type: 'ACTION_COMMIT',
      actionId: 'act_ooo_57',
      action: { type: 'ROLL_DICE', diceValues: [1, 2], rollPower: 0.6 },
      rollPower: 0.6,
      matchVersion: 57,
    });
    expect(receivedOrder).toEqual([57, 58]);
    expect(internal.snapshot?.matchVersion).toBe(58);
    client.destroy();
  });

  it('computeBotAction hỗ trợ forceActAsBot=true cho ghế người chơi mất mạng (botTakeover) ở cả WAIT_ROLL lẫn DEBT_LIQUIDATION', () => {
    const base = createInitialGameState({
      slots: [
        { slotIndex: 0, name: 'Minh', isBot: false, characterId: 'ca_phe', landColor: 'red' },
        { slotIndex: 1, name: 'Kem', isBot: false, characterId: 'ao_dai_tim', landColor: 'purple' },
      ],
      diceCount: 2,
      mapMode: 'default',
    });

    // Mặc định ghế người (isBot: false) trả null để không tự đánh nhầm
    expect(computeBotAction(base)).toBeNull();
    // Khi botTakeover bật (forceActAsBot = true) -> Bot phải ra hành động ROLL_DICE thay vì kẹt vĩnh viễn!
    expect(computeBotAction(base, true)).toEqual({ type: 'ROLL_DICE' });

    // Khi người mất mạng rơi vào DEBT_LIQUIDATION -> Bot tiếp quản cũng phải tự xử lý bán/phá sản, không được trả null!
    const debtState = {
      ...base,
      phase: 'DEBT_LIQUIDATION' as const,
      debtQueue: [
        {
          id: 'debt_takeover_1',
          debtorId: base.players[0].id,
          creditorId: base.players[1].id,
          amount: 50_000_000,
          reason: 'Tiền thuê',
        },
      ],
    };
    expect(computeBotAction(debtState)).toBeNull();
    expect(computeBotAction(debtState, true)).toEqual({ type: 'DECLARE_BANKRUPTCY' });
  });

  it('Sân Bay Online đồng bộ chính xác điểm đến kế tiếp qua deckSync.airportDestinations, không bao giờ lệch 2 máy', () => {
    const initial = createInitialGameState({
      slots: [
        { slotIndex: 0, name: 'Minh', isBot: false, characterId: 'ca_phe', landColor: 'red' },
        { slotIndex: 1, name: 'Kem', isBot: false, characterId: 'ao_dai_tim', landColor: 'purple' },
      ],
      diceCount: 1,
      mapMode: 'default',
    });
    initial.players[0].position = 24;
    initial.tiles[26].currentDestinationTileIndex = 10; // Điểm đến chuyến 1 = Thanh Hóa (ô 10)

    const hostSnap: OnlineRoomSnapshot = {
      roomCode: '888111',
      phase: 'PLAYING',
      hostToken: 'tk_host',
      botCount: 0,
      diceCount: 1,
      mapMode: 'default',
      humans: [],
      bots: [],
      matchState: structuredClone(initial),
      matchVersion: 10,
      updatedAt: Date.now(),
    };
    const guestSnap: OnlineRoomSnapshot = structuredClone(hostSnap);

    const hostSentPackets: Record<string, unknown>[] = [];
    const hostClient = new OnlineRoomClient({
      roomCode: '888111',
      playerToken: 'tk_host',
      playerName: 'Minh',
      isHost: true,
      callbacks: {
        onSnapshot: vi.fn(),
        onStatusChange: vi.fn(),
        onRemoteAction: vi.fn(),
        onRoomClosed: vi.fn(),
      },
    });

    const guestActions: number[] = [];
    const guestClient = new OnlineRoomClient({
      roomCode: '888111',
      playerToken: 'tk_guest',
      playerName: 'Kem',
      isHost: false,
      callbacks: {
        onSnapshot: vi.fn(),
        onStatusChange: vi.fn(),
        onRemoteAction: (ev) => {
          guestActions.push(ev.resultingState?.tiles[26].currentDestinationTileIndex ?? -1);
        },
        onRoomClosed: vi.fn(),
      },
    });

    const hostInternal = hostClient as unknown as {
      snapshot: OnlineRoomSnapshot | null;
      sendOverFastLanes: (pkt: Record<string, unknown>) => void;
      pushActionCommitReliable: (pkt: Record<string, unknown>) => void;
    };
    const guestInternal = guestClient as unknown as {
      snapshot: OnlineRoomSnapshot | null;
      handleIncomingPacket: (pkt: Record<string, unknown>) => void;
    };

    hostInternal.snapshot = hostSnap;
    guestInternal.snapshot = guestSnap;
    hostInternal.pushActionCommitReliable = (pkt) => {
      hostSentPackets.push(pkt);
    };

    // Host tung [2] đáp đúng Sân Bay (24 + 2 = 26) -> bay tới ô 10 & random điểm đến mới khác 10
    const action1 = { type: 'ROLL_DICE' as const, diceValues: [2], rollPower: 0.6 };
    const afterHost1 = reduceGameAction(hostInternal.snapshot.matchState!, action1).state;
    const hostNewAirportDest = afterHost1.tiles[26].currentDestinationTileIndex!;
    expect(hostNewAirportDest).not.toBe(10);

    hostClient.broadcastCommittedAction(action1, 0.6, afterHost1);
    expect(hostSentPackets).toHaveLength(1);
    const pkt1 = hostSentPackets[0] as {
      deckSync?: { airportDestinations?: Record<number, number> };
    };
    expect(pkt1.deckSync?.airportDestinations?.[26]).toBe(hostNewAirportDest);

    // Guest nhận gói ACTION_COMMIT (không có resultingState) -> vẫn phải cập nhật đúng điểm đến mới của Host!
    guestInternal.handleIncomingPacket(hostSentPackets[0]);
    expect(guestInternal.snapshot?.matchState?.tiles[26].currentDestinationTileIndex).toBe(
      hostNewAirportDest,
    );
    expect(guestActions[0]).toBe(hostNewAirportDest);

    hostClient.destroy();
    guestClient.destroy();
  });
});
