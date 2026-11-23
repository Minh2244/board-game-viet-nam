import { describe, expect, it } from 'vitest';
import { handleRoomGet, handleRoomPost } from '../../../../api/_roomStore';

describe('Room Store (/api/room) — Mã 6 số chống trùng, F5 Rejoin, Cách ly game & Giải tán', () => {
  it('Tạo phòng cấp mã 6 số không trùng (HSETNX), sai mã báo 404 tức thì, cách ly theo game', async () => {
    const create1 = await handleRoomPost({
      action: 'create',
      game: 'co-ty-phu',
      roomCode: '112233',
      senderToken: 'host_A',
      snapshot: {
        roomCode: '112233',
        phase: 'LOBBY',
        hostToken: 'host_A',
        humans: [{ playerToken: 'host_A', name: 'Chủ A', isHost: true, connected: true }],
        bots: [],
      },
    });
    expect(create1.status).toBe(200);
    expect(create1.body.ok).toBe(true);
    expect(create1.body.roomCode).toBe('112233');

    // Tạo phòng thứ 2 cố tình gửi trùng mã '112233' -> Server tự đổi sang mã 6 số mới, KHÔNG BAO GIỜ ghi đè!
    const create2 = await handleRoomPost({
      action: 'create',
      game: 'co-ty-phu',
      roomCode: '112233',
      senderToken: 'host_B',
      snapshot: { roomCode: '112233', phase: 'LOBBY', hostToken: 'host_B', humans: [], bots: [] },
    });
    expect(create2.status).toBe(200);
    expect(create2.body.roomCode).not.toBe('112233');
    expect(String(create2.body.roomCode)).toMatch(/^\d{6}$/);

    // Cùng mã '112233' ở game khác ('o-an-quan') hoàn toàn tách biệt, không đụng phòng Cờ Tỷ Phú
    const createOtherGame = await handleRoomPost({
      action: 'create',
      game: 'o-an-quan',
      roomCode: '112233',
      senderToken: 'host_oaq',
      snapshot: { roomCode: '112233', phase: 'LOBBY', hostToken: 'host_oaq' },
    });
    expect(createOtherGame.status).toBe(200);
    expect(createOtherGame.body.roomCode).toBe('112233');

    // Nhập mã sai -> trả 404 tức thì
    const wrongJoin = await handleRoomPost({
      action: 'join',
      game: 'co-ty-phu',
      roomCode: '999999',
      senderToken: 'guest_X',
    });
    expect(wrongJoin.status).toBe(404);
    expect(wrongJoin.body.error).toBe('ROOM_NOT_FOUND');
  });

  it('Hỗ trợ khách vào phòng, đẩy nước đi, F5 rejoin cho cả Chủ & Khách và giải tán phòng sạch', async () => {
    const created = await handleRoomPost({
      action: 'create',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'host_1',
      snapshot: {
        roomCode: '445566',
        phase: 'LOBBY',
        hostToken: 'host_1',
        humans: [{ playerToken: 'host_1', name: 'Chủ 1', isHost: true, connected: true }],
        bots: [],
        matchVersion: 0,
      },
    });
    expect(created.status).toBe(200);

    // Guest mới gửi join
    const joinRes = await handleRoomPost({
      action: 'join',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'guest_1',
      packet: { type: 'JOIN_REQUEST', playerToken: 'guest_1', name: 'Khách 1' },
    });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.rejoined).toBe(false);

    // Host poll thấy ngay sự kiện JOIN_REQUEST mới (sinceSeq=1)
    const poll1 = await handleRoomGet(new URL('http://localhost/api/room?game=co-ty-phu&code=445566&sinceSeq=1'));
    expect(poll1.status).toBe(200);
    expect(poll1.body.unchanged).toBe(false);
    expect((poll1.body.events as unknown[]).length).toBe(1);

    // Poll lại cùng seq -> unchanged: true (tiết kiệm 100% băng thông)
    const pollSame = await handleRoomGet(
      new URL(`http://localhost/api/room?game=co-ty-phu&code=445566&sinceSeq=${poll1.body.seq}`),
    );
    expect(pollSame.status).toBe(200);
    expect(pollSame.body.unchanged).toBe(true);

    // Host cập nhật snapshot bắt đầu ván PLAYING (gồm host_1 + guest_1)
    const pushStart = await handleRoomPost({
      action: 'push',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'host_1',
      phase: 'PLAYING',
      snapshot: {
        roomCode: '445566',
        phase: 'PLAYING',
        hostToken: 'host_1',
        humans: [
          { playerToken: 'host_1', name: 'Chủ 1', isHost: true, connected: false, disconnectedAt: 1000, botTakeover: false },
          { playerToken: 'guest_1', name: 'Khách 1', isHost: false, connected: true, disconnectedAt: null, botTakeover: false },
        ],
        bots: [],
        matchVersion: 3,
      },
      packet: { type: 'ROOM_SNAPSHOT' },
    });
    expect(pushStart.status).toBe(200);

    // Người lạ cố vào ván đã bắt đầu -> bị từ chối 409 tức thì
    const lateJoin = await handleRoomPost({
      action: 'join',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'stranger_9',
    });
    expect(lateJoin.status).toBe(409);

    // Chủ phòng bấm F5 -> gọi rejoin -> khôi phục ngay snapshot PLAYING + connected=true!
    const hostF5 = await handleRoomPost({
      action: 'rejoin',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'host_1',
    });
    expect(hostF5.status).toBe(200);
    expect(hostF5.body.rejoined).toBe(true);
    expect(hostF5.body.phase).toBe('PLAYING');
    const restoredHumans = (hostF5.body.snapshot as { humans: Array<{ playerToken: string; connected: boolean }> }).humans;
    expect(restoredHumans.find((h) => h.playerToken === 'host_1')?.connected).toBe(true);

    // Khách không được phép giải tán phòng (403 HOST_ONLY)
    const guestDissolve = await handleRoomPost({
      action: 'dissolve',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'guest_1',
    });
    expect(guestDissolve.status).toBe(403);
    expect(guestDissolve.body.error).toBe('HOST_ONLY');

    // Gói tin cũ hơn (matchVersion=1 < 3) KHÔNG được ghi đè snapshot hiện tại (matchVersion=3)
    const stalePush = await handleRoomPost({
      action: 'push',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'guest_1',
      snapshot: {
        roomCode: '445566',
        phase: 'PLAYING',
        hostToken: 'host_1',
        humans: [
          { playerToken: 'host_1', name: 'Chủ 1', isHost: true, connected: true },
          { playerToken: 'guest_1', name: 'Khách 1', isHost: false, connected: true },
        ],
        bots: [],
        matchVersion: 1,
      },
    });
    expect(stalePush.status).toBe(200);

    // Heartbeat chỉ cập nhật nhịp tim, KHÔNG làm tăng seq hay ghi đè snapshot
    const hb = await handleRoomPost({
      action: 'heartbeat',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'guest_1',
    });
    expect(hb.status).toBe(200);
    expect(hb.body.seq).toBe(stalePush.body.seq);
    expect((hb.body.heartbeats as Record<string, number>).guest_1).toBeTypeOf('number');

    const checkSnap = await handleRoomGet(
      new URL('http://localhost/api/room?game=co-ty-phu&code=445566&sinceSeq=0&full=1'),
    );
    expect((checkSnap.body.snapshot as { matchVersion: number }).matchVersion).toBe(3);

    // Giải tán phòng (Chủ phòng) -> các yêu cầu sau nhận 410 ROOM_DISSOLVED
    const dis = await handleRoomPost({
      action: 'dissolve',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'host_1',
      packet: { type: 'DISSOLVE_ROOM', reason: 'Hết ván' },
    });
    expect(dis.status).toBe(200);

    const afterDis = await handleRoomPost({
      action: 'join',
      game: 'co-ty-phu',
      roomCode: '445566',
      senderToken: 'guest_1',
    });
    expect(afterDis.status).toBe(410);
  });

  it('Chống phình dữ liệu cuối ván: sau 35 nước đi liên tiếp vẫn giữ giới hạn MAX_EVENTS_KEPT và delta/heartbeat siêu gọn', async () => {
    const code = '778899';
    const created = await handleRoomPost({
      action: 'create',
      game: 'co-ty-phu',
      roomCode: code,
      senderToken: 'host_perf',
      snapshot: {
        roomCode: code,
        phase: 'PLAYING',
        hostToken: 'host_perf',
        humans: [
          { playerToken: 'host_perf', name: 'Chủ', isHost: true, connected: true },
          { playerToken: 'guest_perf', name: 'Khách', isHost: false, connected: true },
        ],
        bots: [],
        matchVersion: 1,
      },
    });
    expect(created.status).toBe(200);

    let lastSeq = Number(created.body.seq);
    for (let v = 2; v <= 36; v += 1) {
      const res = await handleRoomPost({
        action: 'push',
        game: 'co-ty-phu',
        roomCode: code,
        senderToken: v % 2 === 0 ? 'host_perf' : 'guest_perf',
        phase: 'PLAYING',
        snapshot: {
          roomCode: code,
          phase: 'PLAYING',
          hostToken: 'host_perf',
          humans: [
            { playerToken: 'host_perf', name: 'Chủ', isHost: true, connected: true },
            { playerToken: 'guest_perf', name: 'Khách', isHost: false, connected: true },
          ],
          bots: [],
          matchVersion: v,
        },
        packet: {
          msgId: `m_${v}`,
          senderToken: v % 2 === 0 ? 'host_perf' : 'guest_perf',
          type: 'ACTION_COMMIT',
          actionId: `act_${v}`,
          matchVersion: v,
        },
      });
      expect(res.status).toBe(200);
      lastSeq = Number(res.body.seq);
    }

    // Lấy delta 3 nước cuối phải siêu nhanh và trả đúng 3 sự kiện
    const delta = await handleRoomGet(
      new URL(`http://localhost/api/room?game=co-ty-phu&code=${code}&sinceSeq=${lastSeq - 3}`),
    );
    expect(delta.status).toBe(200);
    expect((delta.body.events as unknown[]).length).toBe(3);

    // Lấy full snapshot -> số sự kiện giữ lại bị cắt gọn <= 24, matchVersion mới nhất = 36
    const full = await handleRoomGet(
      new URL(`http://localhost/api/room?game=co-ty-phu&code=${code}&sinceSeq=0&full=1`),
    );
    expect(full.status).toBe(200);
    expect((full.body.events as unknown[]).length).toBeLessThanOrEqual(24);
    expect((full.body.snapshot as { matchVersion: number }).matchVersion).toBe(36);

    // Heartbeat gọn nhẹ không làm tăng seq
    const hb = await handleRoomPost({
      action: 'heartbeat',
      game: 'co-ty-phu',
      roomCode: code,
      senderToken: 'guest_perf',
    });
    expect(hb.status).toBe(200);
    expect(hb.body.seq).toBe(lastSeq);
  });
});
