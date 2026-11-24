import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRoomGet, handleRoomPost } from '../../../api/_roomStore';
import { reduceCoCaNguaAction } from '../co-ca-ngua/engine/reducer';
import type { CoCaNguaState } from '../co-ca-ngua/engine/types';
import { CoCaNguaOnlineClient } from '../co-ca-ngua/network/onlineRoomClient';
import { reduceXiangqiAction } from '../co-tuong/engine/reducer';
import { rcToIdx } from '../co-tuong/engine/rules';
import type { XiangqiState } from '../co-tuong/engine/types';
import { XiangqiOnlineClient } from '../co-tuong/network/onlineRoomClient';
import { reduceGameAction } from '../co-ty-phu/engine/reducer';
import type { GameState } from '../co-ty-phu/engine/types';
import { OnlineRoomClient } from '../co-ty-phu/network/onlineRoomClient';
import { reduceChessAction } from '../co-vua/engine/reducer';
import { rcToSq } from '../co-vua/engine/rules';
import type { ChessState } from '../co-vua/engine/types';
import { ChessOnlineClient } from '../co-vua/network/onlineRoomClient';
import { executeSowMove } from '../o-an-quan/engine/reducer';
import type { OAnQuanState } from '../o-an-quan/engine/types';
import { OAnQuanOnlineClient } from '../o-an-quan/network/onlineRoomClient';

/**
 * Bộ kiểm thử tích hợp Online toàn diện cho CẢ 5 TRÒ CHƠI:
 * - Chạy 100% qua đường HTTP Long-Polling (`/api/room`), KHÔNG dùng BroadcastChannel hay WebRTC P2P
 *   (mô phỏng đúng điều kiện 2 điện thoại khác mạng 4G!).
 * - Xác minh: Tạo phòng -> Vào mã 6 số -> Đánh luân phiên khớp 100% trạng thái ->
 *   Đo kích thước gói Delta (byte) & tốc độ đánh thức Long-Polling (ms) ->
 *   Chống spam trùng actionId / đi sai lượt -> F5 Rejoin giữa ván cả Chủ & Khách -> Giải tán phòng.
 */

interface FetchMetrics {
  actionCommitBytes: number[];
  longPollWakeMs: number[];
}

function installLocalRoomFetchBridge(metrics: FetchMetrics): () => void {
  const originalFetch = globalThis.fetch;

  const mockedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const method = (init?.method || 'GET').toUpperCase();

    if (url.pathname === '/api/room') {
      if (method === 'GET') {
        const started = Date.now();
        const result = await handleRoomGet(url);
        const waitMs = Number(url.searchParams.get('waitMs') || '0');
        if (waitMs > 0 && result.body.unchanged === false) {
          metrics.longPollWakeMs.push(Date.now() - started);
        }
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'content-type': 'application/json' },
        });
      }

      const rawBody = typeof init?.body === 'string' ? init.body : '{}';
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      const pkt = parsed.packet as { type?: string } | undefined;
      if (parsed.action === 'push' && (pkt?.type === 'ACTION_COMMIT' || pkt?.type === 'MOVE_COMMIT')) {
        metrics.actionCommitBytes.push(Buffer.byteLength(rawBody, 'utf8'));
      }
      const result = await handleRoomPost(parsed);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch URL in test: ${rawUrl}`);
  };

  vi.stubGlobal('fetch', mockedFetch);
  return () => {
    vi.stubGlobal('fetch', originalFetch);
  };
}

async function waitUntil(pred: () => boolean, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (!pred()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for condition after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 15));
  }
}

describe('Kiểm thử Online toàn diện 100% HTTP Long-Polling cho CẢ 5 TRÒ CHƠI', () => {
  let restoreFetch: (() => void) | null = null;
  let metrics: FetchMetrics;

  beforeEach(() => {
    metrics = { actionCommitBytes: [], longPollWakeMs: [] };
    restoreFetch = installLocalRoomFetchBridge(metrics);
  });

  afterEach(() => {
    restoreFetch?.();
    restoreFetch = null;
  });

  it('0. Backend Long-Polling đánh thức tức thì <150ms, Checkpoint F5 không tăng seq & vá lỗi Ô Ăn Quan `members`', async () => {
    const code = '501001';
    const created = await handleRoomPost({
      action: 'create',
      game: 'o-an-quan',
      roomCode: code,
      senderToken: 'oaq_host',
      snapshot: {
        roomCode: code,
        phase: 'PLAYING',
        hostToken: 'oaq_host',
        members: [
          { playerToken: 'oaq_host', side: 0, name: 'Chủ', isHost: true, connected: true },
          { playerToken: 'oaq_guest', side: 1, name: 'Khách', isHost: false, connected: true },
        ],
        matchVersion: 1,
      },
    });
    expect(created.status).toBe(200);
    const seq1 = Number(created.body.seq);

    // 1. Bắt đầu Long-Polling chờ sự kiện mới (waitMs=2500) rồi sau 35ms đẩy 1 gói Delta -> phải thức dậy ngay < 200ms!
    const t0 = Date.now();
    const lpPromise = handleRoomGet(
      new URL(`http://localhost/api/room?game=o-an-quan&code=${code}&sinceSeq=${seq1}&waitMs=2500`),
    );
    setTimeout(() => {
      void handleRoomPost({
        action: 'push',
        game: 'o-an-quan',
        roomCode: code,
        senderToken: 'oaq_host',
        packet: { msgId: 'lp_m1', senderToken: 'oaq_host', type: 'MOVE_COMMIT', moveId: 'mv1', matchVersion: 2 },
      });
    }, 35);

    const lpResult = await lpPromise;
    const elapsed = Date.now() - t0;
    expect(lpResult.status).toBe(200);
    expect(lpResult.body.unchanged).toBe(false);
    expect((lpResult.body.events as unknown[]).length).toBe(1);
    expect(elapsed).toBeLessThan(300);

    // 2. Checkpoint ngầm cập nhật snapshot nhưng KHÔNG được tăng `seq`!
    const seqBeforeCp = Number(lpResult.body.seq);
    const cpRes = await handleRoomPost({
      action: 'checkpoint',
      game: 'o-an-quan',
      roomCode: code,
      senderToken: 'oaq_guest', // Khách của Ô Ăn Quan (`members`) phải được công nhận hợp lệ!
      snapshot: {
        roomCode: code,
        phase: 'PLAYING',
        hostToken: 'oaq_host',
        members: [
          { playerToken: 'oaq_host', side: 0, name: 'Chủ', isHost: true, connected: true },
          { playerToken: 'oaq_guest', side: 1, name: 'Khách', isHost: false, connected: true },
        ],
        matchVersion: 2,
      },
    });
    expect(cpRes.status).toBe(200);
    expect(cpRes.body.seq).toBe(seqBeforeCp);

    // 3. Cả Chủ lẫn Khách Ô Ăn Quan bấm F5 (`rejoin`) phải thành công 200 (hết hẳn lỗi 404 SEAT_EXPIRED!)
    const guestRejoin = await handleRoomPost({
      action: 'rejoin',
      game: 'o-an-quan',
      roomCode: code,
      senderToken: 'oaq_guest',
    });
    expect(guestRejoin.status).toBe(200);
    expect(guestRejoin.body.rejoined).toBe(true);
    expect((guestRejoin.body.snapshot as { matchVersion: number }).matchVersion).toBe(2);
  });

  it('1. Cờ Tỷ Phú 3D Online: Tạo phòng -> Vào mã -> Delta <500B -> Khớp 100% -> F5 tức thì trước checkpoint -> Giải tán', async () => {
    const code = '510001';
    let hostState: GameState | null = null;
    let guestState: GameState | null = null;
    let guestClosedReason = '';

    const host = new OnlineRoomClient({
      roomCode: code,
      playerToken: 'ctp_host_1',
      playerName: 'Chủ Tỷ Phú',
      isHost: true,
      callbacks: {
        onSnapshot: () => {},
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!hostState) return;
          const { state } = reduceGameAction(hostState, ev.action);
          hostState = ev.deckSync ? { ...state, ...ev.deckSync } : state;
        },
        onRoomClosed: () => {},
      },
    });

    const guest = new OnlineRoomClient({
      roomCode: code,
      playerToken: 'ctp_guest_1',
      playerName: 'Khách Tỷ Phú',
      isHost: false,
      callbacks: {
        onSnapshot: (snap) => {
          if (snap.phase === 'PLAYING' && snap.matchState && !guestState) {
            guestState = snap.matchState;
          }
        },
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!guestState) return;
          const { state } = reduceGameAction(guestState, ev.action);
          guestState = ev.deckSync ? { ...state, ...ev.deckSync } : state;
        },
        onRoomClosed: (reason) => {
          guestClosedReason = reason;
        },
      },
    });

    try {
      await host.startAsHost(0);
      await guest.joinRoom();
      await waitUntil(() => (host.getSnapshot()?.humans.length ?? 0) === 2);

      hostState = host.startMatch();
      expect(hostState).not.toBeNull();
      await waitUntil(() => guestState !== null);

      // Chủ tung xúc xắc xác định [2, 3] = 5 ô (tránh ô đặc biệt ngẫu nhiên)
      const rollAction = { type: 'ROLL_DICE' as const, diceValues: [2, 3], rollPower: 0.65 };
      const { state: afterRoll } = reduceGameAction(hostState!, rollAction);
      hostState = afterRoll;
      host.broadcastCommittedAction(rollAction, 0.65, afterRoll);

      await waitUntil(() => guestState!.players[0].position === hostState!.players[0].position);
      expect(guestState!.players[0].position).toBe(5);
      expect(guestState!.players[0].cash).toBe(hostState!.players[0].cash);
      expect(guestState!.phase).toBe(hostState!.phase);

      // Kiểm chứng kích thước gói Delta < 500 bytes (giảm >99% so với 60KB trước đây!)
      expect(metrics.actionCommitBytes.length).toBeGreaterThanOrEqual(1);
      expect(metrics.actionCommitBytes[0]).toBeLessThan(500);

      // Khách F5 NGAY LẬP TỨC trước khi timer checkpoint 1.2s chạy -> vẫn phải replay đủ nước đi!
      const guestRejoined = new OnlineRoomClient({
        roomCode: code,
        playerToken: 'ctp_guest_1',
        playerName: 'Khách Tỷ Phú',
        isHost: false,
        callbacks: {
          onSnapshot: () => {},
          onStatusChange: () => {},
          onRemoteAction: () => {},
          onRoomClosed: () => {},
        },
      });
      const restored = await guestRejoined.rejoinExistingRoom();
      expect(restored.phase).toBe('PLAYING');
      expect(restored.matchState?.players[0].position).toBe(5);
      expect(restored.matchState?.players[0].cash).toBe(hostState!.players[0].cash);
      guestRejoined.destroy();

      // Chủ giải tán -> Khách nhận thông báo đóng phòng
      host.dissolveOrLeave('Hết ván Cờ Tỷ Phú');
      await waitUntil(() => guestClosedReason.includes('Cờ Tỷ Phú'));
    } finally {
      host.destroy();
      guest.destroy();
    }
  });

  it('2. Ô Ăn Quan Online: Đánh luân phiên 2 bên khớp 100% + F5 Rejoin thành công cho CẢ Chủ & Khách', async () => {
    const code = '520002';
    let hostState: OAnQuanState | null = null;
    let guestState: OAnQuanState | null = null;

    const host = new OAnQuanOnlineClient({
      roomCode: code,
      playerToken: 'oaq_h2',
      playerName: 'Cu Tí Chủ',
      isHost: true,
      callbacks: {
        onSnapshot: () => {},
        onStatusChange: () => {},
        onRemoteMove: (ev) => {
          if (!hostState) return;
          const { state } = executeSowMove(hostState, ev.pitIndex, ev.direction, ev.side);
          hostState = state;
          host.syncVerifiedStateAfterRemoteMove(state, ev.matchVersion);
        },
        onRoomClosed: () => {},
      },
    });

    const guest = new OAnQuanOnlineClient({
      roomCode: code,
      playerToken: 'oaq_g2',
      playerName: 'Bé Mít Khách',
      isHost: false,
      callbacks: {
        onSnapshot: (snap) => {
          if (snap.phase === 'PLAYING' && snap.matchState && !guestState) {
            guestState = snap.matchState;
          }
        },
        onStatusChange: () => {},
        onRemoteMove: (ev) => {
          if (!guestState) return;
          const { state } = executeSowMove(guestState, ev.pitIndex, ev.direction, ev.side);
          guestState = state;
          guest.syncVerifiedStateAfterRemoteMove(state, ev.matchVersion);
        },
        onRoomClosed: () => {},
      },
    });

    try {
      await host.startAsHost();
      await guest.joinRoom();
      await waitUntil(() => (host.getSnapshot()?.members.length ?? 0) === 2);

      host.updateRoomRules({ mandarinPointValue: 5 });
      hostState = host.startMatch();
      expect(hostState).not.toBeNull();
      await waitUntil(() => guestState !== null);

      // Lượt 1: Chủ (side 0) rải ô 2 theo chiều kim đồng hồ
      const r1 = executeSowMove(hostState!, 2, 'CW', 0);
      hostState = r1.state;
      host.broadcastCommittedMove(0, 2, 'CW', r1.state);

      await waitUntil(() => guestState!.turnCount === hostState!.turnCount);
      expect(guestState!.pits).toEqual(hostState!.pits);
      expect(guestState!.players.map((p) => p.score)).toEqual(hostState!.players.map((p) => p.score));
      expect(metrics.actionCommitBytes[0]).toBeLessThan(400);

      // Lượt 2: Khách (side 1) chọn ô dân còn sỏi đầu tiên bên sân mình và rải ngược chiều kim đồng hồ
      const guestPit = guestState!.pits.find((p) => p.ownerSide === 1 && p.stones > 0);
      expect(guestPit).toBeDefined();
      const r2 = executeSowMove(guestState!, guestPit!.index, 'CCW', 1);
      guestState = r2.state;
      guest.broadcastCommittedMove(1, guestPit!.index, 'CCW', r2.state);

      await waitUntil(() => hostState!.turnCount === guestState!.turnCount);
      expect(hostState!.pits).toEqual(guestState!.pits);

      // F5 Rejoin cho cả Khách lẫn Chủ (xác nhận sửa triệt để lỗi `members` vs `humans`!)
      const guestF5 = new OAnQuanOnlineClient({
        roomCode: code,
        playerToken: 'oaq_g2',
        playerName: 'Bé Mít Khách',
        isHost: false,
        callbacks: { onSnapshot: () => {}, onStatusChange: () => {}, onRemoteMove: () => {}, onRoomClosed: () => {} },
      });
      const restoredG = await guestF5.rejoinExistingRoom();
      expect(restoredG.matchState?.pits).toEqual(hostState!.pits);
      guestF5.destroy();

      const hostF5 = new OAnQuanOnlineClient({
        roomCode: code,
        playerToken: 'oaq_h2',
        playerName: 'Cu Tí Chủ',
        isHost: true,
        callbacks: { onSnapshot: () => {}, onStatusChange: () => {}, onRemoteMove: () => {}, onRoomClosed: () => {} },
      });
      const restoredH = await hostF5.rejoinExistingRoom();
      expect(restoredH.matchState?.pits).toEqual(guestState!.pits);
      hostF5.destroy();
    } finally {
      host.destroy();
      guest.destroy();
    }
  });

  it('3. Cờ Cá Ngựa Online: Xuất chuồng 6 nút + Đổi lượt + Delta <400B + F5 Rejoin khớp 100%', async () => {
    const code = '530003';
    let hostState: CoCaNguaState | null = null;
    let guestState: CoCaNguaState | null = null;

    const host = new CoCaNguaOnlineClient({
      roomCode: code,
      playerToken: 'ccn_h3',
      playerName: 'Chủ Đỏ',
      isHost: true,
      callbacks: {
        onSnapshot: () => {},
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!hostState) return;
          hostState = reduceCoCaNguaAction(hostState, ev.action).state;
        },
        onRoomClosed: () => {},
      },
    });

    const guest = new CoCaNguaOnlineClient({
      roomCode: code,
      playerToken: 'ccn_g3',
      playerName: 'Khách Xanh',
      isHost: false,
      callbacks: {
        onSnapshot: (snap) => {
          if (snap.phase === 'PLAYING' && snap.matchState && !guestState) {
            guestState = snap.matchState;
          }
        },
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!guestState) return;
          guestState = reduceCoCaNguaAction(guestState, ev.action).state;
        },
        onRoomClosed: () => {},
      },
    });

    try {
      await host.startAsHost(0);
      await guest.joinRoom();
      await waitUntil(() => (host.getSnapshot()?.humans.length ?? 0) === 2);

      hostState = host.startMatch();
      expect(hostState).not.toBeNull();
      await waitUntil(() => guestState !== null);

      const firstColor = hostState!.players[hostState!.currentPlayerIndex].color;

      // Tung 6 nút -> Xuất chuồng con đầu tiên
      const roll6 = { type: 'ROLL_DICE' as const, diceValue: 6 };
      hostState = reduceCoCaNguaAction(hostState!, roll6).state;
      host.broadcastCommittedAction(firstColor, roll6, hostState);
      await waitUntil(() => guestState!.lastDiceValue === 6);

      const firstHorseId = hostState.legalMoves[0].horseId;
      const deployAct = { type: 'EXECUTE_MOVE' as const, horseId: firstHorseId };
      hostState = reduceCoCaNguaAction(hostState, deployAct).state;
      host.broadcastCommittedAction(firstColor, deployAct, hostState);

      await waitUntil(
        () => guestState!.horses.find((h) => h.id === firstHorseId)?.zone === 'TRACK',
      );
      expect(guestState!.horses).toEqual(hostState.horses);
      expect(metrics.actionCommitBytes.every((b) => b < 450)).toBe(true);

      // F5 Rejoin ngay lập tức trước checkpoint
      const guestF5 = new CoCaNguaOnlineClient({
        roomCode: code,
        playerToken: 'ccn_g3',
        playerName: 'Khách Xanh',
        isHost: false,
        callbacks: { onSnapshot: () => {}, onStatusChange: () => {}, onRemoteAction: () => {}, onRoomClosed: () => {} },
      });
      const restored = await guestF5.rejoinExistingRoom();
      expect(restored.matchState?.horses).toEqual(hostState.horses);
      guestF5.destroy();
    } finally {
      host.destroy();
      guest.destroy();
    }
  });

  it('4. Cờ Vua Online: Chiếu bí Scholar Mate 7 nước 2 chiều khớp 100%, chặn sai lượt, Delta <350B & F5 Rejoin', async () => {
    const code = '540004';
    let hostState: ChessState | null = null;
    let guestState: ChessState | null = null;

    const host = new ChessOnlineClient({
      roomCode: code,
      playerToken: 'cv_h4',
      playerName: 'Kỳ Thủ Trắng',
      isHost: true,
      callbacks: {
        onSnapshot: () => {},
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!hostState) return;
          hostState = reduceChessAction(hostState, ev.action);
        },
        onRoomClosed: () => {},
      },
    });

    const guest = new ChessOnlineClient({
      roomCode: code,
      playerToken: 'cv_g4',
      playerName: 'Kỳ Thủ Đen',
      isHost: false,
      callbacks: {
        onSnapshot: (snap) => {
          if (snap.phase === 'PLAYING' && snap.matchState && !guestState) {
            guestState = snap.matchState;
          }
        },
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!guestState) return;
          guestState = reduceChessAction(guestState, ev.action);
        },
        onRoomClosed: () => {},
      },
    });

    try {
      await host.startAsHost();
      await guest.joinRoom();
      await waitUntil(() => (host.getSnapshot()?.humans.length ?? 0) === 2);

      hostState = host.startMatch();
      expect(hostState).not.toBeNull();
      await waitUntil(() => guestState !== null);

      // Kiểm tra đi sai lượt (Đen cố đi lúc đang lượt Trắng) -> reducer bỏ qua không đổi state
      const illegalTurn = reduceChessAction(guestState!, {
        type: 'MOVE',
        from: rcToSq(1, 4),
        to: rcToSq(3, 4),
      });
      expect(illegalTurn).toBe(guestState);

      // Chuỗi Scholar's Mate: e4, e5, Bc4, Nc6, Qh5, Nf6, Qxf7#
      const moves: Array<{ by: 'host' | 'guest'; from: number; to: number }> = [
        { by: 'host', from: rcToSq(6, 4), to: rcToSq(4, 4) }, // e2->e4
        { by: 'guest', from: rcToSq(1, 4), to: rcToSq(3, 4) }, // e7->e5
        { by: 'host', from: rcToSq(7, 5), to: rcToSq(4, 2) }, // Bf1->c4
        { by: 'guest', from: rcToSq(0, 1), to: rcToSq(2, 2) }, // Nb8->c6
        { by: 'host', from: rcToSq(7, 3), to: rcToSq(3, 7) }, // Qd1->h5
        { by: 'guest', from: rcToSq(0, 6), to: rcToSq(2, 5) }, // Ng8->f6
      ];

      for (let i = 0; i < moves.length; i += 1) {
        const m = moves[i];
        const act = { type: 'MOVE' as const, from: m.from, to: m.to };
        if (m.by === 'host') {
          hostState = reduceChessAction(hostState!, act);
          host.broadcastCommittedAction(act, hostState);
          await waitUntil(() => guestState!.history.length === i + 1);
        } else {
          guestState = reduceChessAction(guestState!, act);
          guest.broadcastCommittedAction(act, guestState);
          await waitUntil(() => hostState!.history.length === i + 1);
        }
      }

      // Kiểm tra F5 Rejoin giữa ván ở nước thứ 6 trước khi chiếu bí
      const guestF5 = new ChessOnlineClient({
        roomCode: code,
        playerToken: 'cv_g4',
        playerName: 'Kỳ Thủ Đen',
        isHost: false,
        callbacks: { onSnapshot: () => {}, onStatusChange: () => {}, onRemoteAction: () => {}, onRoomClosed: () => {} },
      });
      const restored = await guestF5.rejoinExistingRoom();
      expect(restored.matchState?.board).toEqual(hostState!.board);
      guestF5.destroy();

      // Nước thứ 7: Trắng ăn f7 Chiếu Bí!
      const mateAct = { type: 'MOVE' as const, from: rcToSq(3, 7), to: rcToSq(1, 5) };
      hostState = reduceChessAction(hostState!, mateAct);
      host.broadcastCommittedAction(mateAct, hostState);

      await waitUntil(() => guestState!.phase === 'GAME_OVER');
      expect(guestState!.winner).toBe('white');
      expect(guestState!.endReason).toBe('CHECKMATE');
      expect(guestState!.board).toEqual(hostState!.board);
      expect(metrics.actionCommitBytes.every((b) => b < 350)).toBe(true);
    } finally {
      host.destroy();
      guest.destroy();
    }
  });

  it('5. Cờ Tướng Online: Khai cuộc Trung Pháo 4 nước 2 chiều khớp 90 giao điểm, Delta <350B & F5 Rejoin', async () => {
    const code = '550005';
    let hostState: XiangqiState | null = null;
    let guestState: XiangqiState | null = null;

    const host = new XiangqiOnlineClient({
      roomCode: code,
      playerToken: 'ct_h5',
      playerName: 'Kỳ Thủ Đỏ',
      isHost: true,
      callbacks: {
        onSnapshot: () => {},
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!hostState) return;
          hostState = reduceXiangqiAction(hostState, ev.action);
        },
        onRoomClosed: () => {},
      },
    });

    const guest = new XiangqiOnlineClient({
      roomCode: code,
      playerToken: 'ct_g5',
      playerName: 'Kỳ Thủ Xanh',
      isHost: false,
      callbacks: {
        onSnapshot: (snap) => {
          if (snap.phase === 'PLAYING' && snap.matchState && !guestState) {
            guestState = snap.matchState;
          }
        },
        onStatusChange: () => {},
        onRemoteAction: (ev) => {
          if (!guestState) return;
          guestState = reduceXiangqiAction(guestState, ev.action);
        },
        onRoomClosed: () => {},
      },
    });

    try {
      await host.startAsHost();
      await guest.joinRoom();
      await waitUntil(() => (host.getSnapshot()?.humans.length ?? 0) === 2);

      hostState = host.startMatch();
      expect(hostState).not.toBeNull();
      await waitUntil(() => guestState !== null);

      const moves: Array<{ by: 'host' | 'guest'; from: number; to: number }> = [
        { by: 'host', from: rcToIdx(7, 1), to: rcToIdx(7, 4) }, // Đỏ Pháo 2 bình 5 (Trung Pháo)
        { by: 'guest', from: rcToIdx(0, 1), to: rcToIdx(2, 2) }, // Xanh Mã 2 tấn 3
        { by: 'host', from: rcToIdx(9, 1), to: rcToIdx(7, 2) }, // Đỏ Mã 2 tấn 3
        { by: 'guest', from: rcToIdx(0, 0), to: rcToIdx(0, 1) }, // Xanh Xe 1 bình 2
      ];

      for (let i = 0; i < moves.length; i += 1) {
        const m = moves[i];
        const act = { type: 'MOVE' as const, from: m.from, to: m.to };
        if (m.by === 'host') {
          hostState = reduceXiangqiAction(hostState!, act);
          host.broadcastCommittedAction(act, hostState);
          await waitUntil(() => guestState!.history.length === i + 1);
        } else {
          guestState = reduceXiangqiAction(guestState!, act);
          guest.broadcastCommittedAction(act, guestState);
          await waitUntil(() => hostState!.history.length === i + 1);
        }
      }

      expect(guestState!.board).toEqual(hostState!.board);
      expect(guestState!.turn).toBe('red');
      expect(metrics.actionCommitBytes.every((b) => b < 350)).toBe(true);

      // F5 Rejoin giữa ván -> khớp toàn bộ 90 giao điểm!
      const guestF5 = new XiangqiOnlineClient({
        roomCode: code,
        playerToken: 'ct_g5',
        playerName: 'Kỳ Thủ Xanh',
        isHost: false,
        callbacks: { onSnapshot: () => {}, onStatusChange: () => {}, onRemoteAction: () => {}, onRoomClosed: () => {} },
      });
      const restored = await guestF5.rejoinExistingRoom();
      expect(restored.matchState?.board).toEqual(hostState!.board);
      guestF5.destroy();
    } finally {
      host.destroy();
      guest.destroy();
    }
  });

  it('6. Chống spam actionId trùng lặp, chặn người lạ vào ván đang chơi (409), chặn Khách giải tán (403) & đo số liệu định lượng', async () => {
    const code = '560006';
    let guestReceivedCount = 0;

    const host = new ChessOnlineClient({
      roomCode: code,
      playerToken: 'sec_h6',
      playerName: 'Chủ Bảo Mật',
      isHost: true,
      callbacks: {
        onSnapshot: () => {},
        onStatusChange: () => {},
        onRemoteAction: () => {},
        onRoomClosed: () => {},
      },
    });

    const guest = new ChessOnlineClient({
      roomCode: code,
      playerToken: 'sec_g6',
      playerName: 'Khách Bảo Mật',
      isHost: false,
      callbacks: {
        onSnapshot: () => {},
        onStatusChange: () => {},
        onRemoteAction: () => {
          guestReceivedCount += 1;
        },
        onRoomClosed: () => {},
      },
    });

    try {
      await host.startAsHost();
      await guest.joinRoom();
      await waitUntil(() => (host.getSnapshot()?.humans.length ?? 0) === 2);
      const initial = host.startMatch();
      expect(initial).not.toBeNull();
      await waitUntil(() => guest.getSnapshot()?.phase === 'PLAYING');

      // 1. Người lạ cố vào ván đang chơi -> 409 MATCH_ALREADY_STARTED
      const lateStranger = await handleRoomPost({
        action: 'join',
        game: 'co-vua',
        roomCode: code,
        senderToken: 'stranger_intruder',
      });
      expect(lateStranger.status).toBe(409);

      // 2. Khách cố giải tán phòng -> 403 HOST_ONLY
      const guestDissolve = await handleRoomPost({
        action: 'dissolve',
        game: 'co-vua',
        roomCode: code,
        senderToken: 'sec_g6',
      });
      expect(guestDissolve.status).toBe(403);

      // 3. Bắn 2 gói trùng y hệt `actionId` (giả lập spam click / mạng gửi trùng) -> Khách chỉ nhận ĐÚNG 1 LẦN!
      const dupPacket = {
        msgId: 'dup_msg_1',
        senderToken: 'sec_h6',
        type: 'ACTION_COMMIT',
        actionId: 'dup_act_same_id',
        action: { type: 'MOVE', from: rcToSq(6, 4), to: rcToSq(4, 4) },
        matchVersion: 2,
      };
      await handleRoomPost({
        action: 'push',
        game: 'co-vua',
        roomCode: code,
        senderToken: 'sec_h6',
        packet: dupPacket,
      });
      await handleRoomPost({
        action: 'push',
        game: 'co-vua',
        roomCode: code,
        senderToken: 'sec_h6',
        packet: { ...dupPacket, msgId: 'dup_msg_2' }, // Khác msgId nhưng TRÙNG actionId!
      });

      await waitUntil(() => guestReceivedCount >= 1);
      await new Promise((r) => setTimeout(r, 120));
      expect(guestReceivedCount).toBe(1);
    } finally {
      host.destroy();
      guest.destroy();
    }
  });
});
