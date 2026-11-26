import { describe, expect, it } from 'vitest';
import { computeHorseBotMove, computeHorseHint } from '../ai/horseBot';
import {
  getBalancedColorsForPlayerCount,
  HORSE_COLOR_CONFIG,
  progressToTrackIndex,
  SAFE_DOOR_PROGRESS,
  TRACK_GRID_COORDS,
  TRACK_LENGTH,
} from '../engine/boardGeometry';
import { createInitialCoCaNguaState, reduceCoCaNguaAction } from '../engine/reducer';
import {
  assertHorseBoardInvariants,
  computeLegalHorseMoves,
  hasColorWon,
  LATE_GAME_TURNS_THRESHOLD,
  rollSmartHorseDice,
  shouldBoostDeployDice,
} from '../engine/rules';
import type { CoCaNguaState, HorseColor } from '../engine/types';

function make4PlayerState(): CoCaNguaState {
  return createInitialCoCaNguaState({
    players: [
      { color: 'red', name: 'Đỏ', isBot: false },
      { color: 'yellow', name: 'Vàng', isBot: false },
      { color: 'blue', name: 'Xanh Dương', isBot: false },
      { color: 'green', name: 'Xanh Lá', isBot: false },
    ],
  });
}

function setHorse(
  state: CoCaNguaState,
  id: string,
  patch: { zone: 'STABLE' | 'TRACK' | 'HOME_STAIRS'; progress?: number; stairStep?: number },
): void {
  const h = state.horses.find((x) => x.id === id)!;
  h.zone = patch.zone;
  h.progress = patch.progress ?? -1;
  h.stairStep = patch.stairStep ?? 0;
}

describe('Cờ Cá Ngựa Engine — Bộ 15 Tình Huống Kiểm Thử Luật Chuẩn Việt Nam', () => {
  it('01. Khởi tạo 2–4 người chơi (2 người tự xếp chéo góc đối xứng 180°, đủ 52 ô đường đua)', () => {
    expect(TRACK_GRID_COORDS.length).toBe(TRACK_LENGTH);
    const twoColors = getBalancedColorsForPlayerCount(2, 'red');
    expect(twoColors).toEqual(['red', 'blue']);
    const dist =
      (HORSE_COLOR_CONFIG.blue.startTrackIndex - HORSE_COLOR_CONFIG.red.startTrackIndex + 52) % 52;
    expect(dist).toBe(26);

    const st = make4PlayerState();
    expect(st.horses.length).toBe(16);
    expect(st.horses.every((h) => h.zone === 'STABLE')).toBe(true);
    assertHorseBoardInvariants(st);
  });

  it('02. Gieo 1 và gieo 6 đều được xuất chuồng + thưởng thêm lượt; gieo 2..5 không xuất được', () => {
    const st = make4PlayerState();
    for (const d of [2, 3, 4, 5]) {
      expect(computeLegalHorseMoves(st.horses, 'red', d).length).toBe(0);
    }
    for (const d of [1, 6]) {
      const { state: rolled } = reduceCoCaNguaAction(st, { type: 'ROLL_DICE', diceValue: d });
      expect(rolled.phase).toBe('SELECT_HORSE');
      expect(rolled.pendingExtraTurn).toBe(true);
      expect(rolled.legalMoves.every((m) => m.kind === 'DEPLOY')).toBe(true);
      const { state: deployed } = reduceCoCaNguaAction(rolled, {
        type: 'EXECUTE_MOVE',
        horseId: 'red_0',
      });
      expect(deployed.horses.find((h) => h.id === 'red_0')?.zone).toBe('TRACK');
      expect(deployed.horses.find((h) => h.id === 'red_0')?.progress).toBe(0);
      // Vẫn giữ lượt của Đỏ vì vừa đổ 1 hoặc 6!
      expect(deployed.currentPlayerIndex).toBe(0);
      expect(deployed.phase).toBe('WAIT_ROLL');
      assertHorseBoardInvariants(deployed);
    }
  });

  it('03. Cấm xuất chuồng nếu Ô Xuất Phát đang có quân cùng màu', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'TRACK', progress: 0 });
    const moves = computeLegalHorseMoves(st.horses, 'red', 6);
    expect(moves.some((m) => m.kind === 'DEPLOY')).toBe(false);
    expect(moves.some((m) => m.horseId === 'red_0' && m.kind === 'ADVANCE_TRACK')).toBe(true);
  });

  it('04. Xuất chuồng vào Ô Xuất Phát đang có quân đối phương -> đá quân địch về chuồng', () => {
    const st = make4PlayerState();
    // Vàng đứng tại trackIndex 0 (progress = 39 đối với Vàng vì start Vàng = 13 -> (13+39)%52 = 0)
    setHorse(st, 'yellow_0', { zone: 'TRACK', progress: 39 });
    expect(progressToTrackIndex('yellow', 39)).toBe(0);

    const { state: s1 } = reduceCoCaNguaAction(st, { type: 'ROLL_DICE', diceValue: 1 });
    const deployMove = s1.legalMoves.find((m) => m.horseId === 'red_0');
    expect(deployMove?.kickedHorseId).toBe('yellow_0');

    const { state: s2 } = reduceCoCaNguaAction(s1, { type: 'EXECUTE_MOVE', horseId: 'red_0' });
    expect(s2.horses.find((h) => h.id === 'yellow_0')?.zone).toBe('STABLE');
    expect(s2.players[0].kicksCount).toBe(1);
    assertHorseBoardInvariants(s2);
  });

  it('05. Di chuyển chuẩn đúng số nút theo chiều kim đồng hồ vượt ranh 51 -> 0', () => {
    const st = make4PlayerState();
    // Vàng ở progress 37 -> trackIndex = (13+37)%52 = 50; đi 4 bước -> trackIndex = 2!
    st.currentPlayerIndex = 1;
    setHorse(st, 'yellow_0', { zone: 'TRACK', progress: 37 });
    const moves = computeLegalHorseMoves(st.horses, 'yellow', 4);
    expect(moves[0]?.toTrackIndex).toBe(2);
    expect(moves[0]?.stepTrackPath).toEqual([51, 0, 1, 2]);
  });

  it('06. Cấm nhảy qua quân cùng màu đang đứng chắn phía trước', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'TRACK', progress: 2 });
    setHorse(st, 'red_1', { zone: 'TRACK', progress: 5 }); // Cách 3 ô
    // Gieo 4 -> red_0 KHÔNG được nhảy qua red_1; gieo 3 -> KHÔNG được đứng trùng red_1
    expect(computeLegalHorseMoves(st.horses, 'red', 4).some((m) => m.horseId === 'red_0')).toBe(false);
    expect(computeLegalHorseMoves(st.horses, 'red', 3).some((m) => m.horseId === 'red_0')).toBe(false);
    // Gieo 2 -> hợp lệ (progress 4)
    expect(computeLegalHorseMoves(st.horses, 'red', 2).some((m) => m.horseId === 'red_0')).toBe(true);
  });

  it('07. Cấm nhảy qua quân đối phương đang chắn phía trước (ví dụ cách 4 ô: gieo 5/6 bị chặn)', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'TRACK', progress: 2 }); // trackIndex 2
    setHorse(st, 'blue_0', { zone: 'TRACK', progress: 32 }); // (26+32)%52 = 6 (cách red_0 đúng 4 ô)
    expect(progressToTrackIndex('blue', 32)).toBe(6);

    // Gieo 1, 2, 3 -> đi bình thường
    expect(computeLegalHorseMoves(st.horses, 'red', 3).some((m) => m.horseId === 'red_0')).toBe(true);
    // Gieo 4 -> ĐÁ ĐƯỢC blue_0!
    const m4 = computeLegalHorseMoves(st.horses, 'red', 4).find((m) => m.horseId === 'red_0');
    expect(m4?.kickedHorseId).toBe('blue_0');
    // Gieo 5 hoặc 6 -> BỊ CHẶN, không được nhảy qua blue_0!
    expect(computeLegalHorseMoves(st.horses, 'red', 5).some((m) => m.horseId === 'red_0')).toBe(false);
    expect(computeLegalHorseMoves(st.horses, 'red', 6).some((m) => m.horseId === 'red_0')).toBe(false);
  });

  it('08. Gieo đúng số vào quân địch (ngoài Ô An Toàn) -> đá quân địch về chuồng và chiếm ô', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'TRACK', progress: 2 });
    setHorse(st, 'green_0', { zone: 'TRACK', progress: 18 }); // (39+18)%52 = 5 (cách 3 ô)

    const { state: s1 } = reduceCoCaNguaAction(st, { type: 'ROLL_DICE', diceValue: 3 });
    const { state: s2, steps } = reduceCoCaNguaAction(s1, {
      type: 'EXECUTE_MOVE',
      horseId: 'red_0',
    });
    expect(s2.horses.find((h) => h.id === 'green_0')?.zone).toBe('STABLE');
    expect(s2.horses.find((h) => h.id === 'red_0')?.progress).toBe(5);
    expect(steps.some((step) => step.type === 'HORSE_HOP' && step.kickedHorseId === 'green_0')).toBe(true);
    assertHorseBoardInvariants(s2);
  });

  it('09. 4 Ô ★ Cửa Lên Bụt ({12, 25, 38, 51}): đứng ngay cửa VẪN BỊ ĐÁ bình thường, vẫn chắn nhảy qua (chỉ lên bậc 1–6 mới bất tử)', () => {
    const st = make4PlayerState();
    // Vàng đứng tại Ô ★ Cửa Lên Bụt của chính mình: progress = 51 -> trackIndex = 12
    setHorse(st, 'yellow_0', { zone: 'TRACK', progress: SAFE_DOOR_PROGRESS });
    expect(progressToTrackIndex('yellow', SAFE_DOOR_PROGRESS)).toBe(12);

    // Đỏ đứng cách đó 3 ô (progress = 9 -> trackIndex = 9)
    setHorse(st, 'red_0', { zone: 'TRACK', progress: 9 });
    // Gieo 3 (đúng Ô ★ 12 đang có Vàng) -> ĐÁ BAY Vàng về chuồng bình thường!
    const kickMove = computeLegalHorseMoves(st.horses, 'red', 3).find((m) => m.horseId === 'red_0');
    expect(kickMove?.kickedHorseId).toBe('yellow_0');
    expect(kickMove?.toTrackIndex).toBe(12);
    // Gieo 4, 5, 6 (muốn nhảy qua Vàng trên Ô ★) -> VẪN CẤM NHẢY QUA!
    expect(computeLegalHorseMoves(st.horses, 'red', 4).some((m) => m.horseId === 'red_0')).toBe(false);
    expect(computeLegalHorseMoves(st.horses, 'red', 5).some((m) => m.horseId === 'red_0')).toBe(false);
    expect(computeLegalHorseMoves(st.horses, 'red', 6).some((m) => m.horseId === 'red_0')).toBe(false);
    // Gieo 2 (dừng trước ở ô 11) -> hợp lệ!
    expect(computeLegalHorseMoves(st.horses, 'red', 2).some((m) => m.horseId === 'red_0')).toBe(true);

    // Đỏ đứng ngay Ô ★ của Xanh Dương (trackIndex = 25 -> progress = 25) -> Xanh Dương vẫn ĐÁ được Đỏ!
    const st2 = make4PlayerState();
    setHorse(st2, 'red_0', { zone: 'TRACK', progress: 25 }); // trackIndex 25 = Cửa Xanh Dương
    setHorse(st2, 'blue_0', { zone: 'TRACK', progress: 48 }); // (26+48)%52 = 22 (cách 3 ô tới cửa 25)
    const blueKick = computeLegalHorseMoves(st2.horses, 'blue', 3).find((m) => m.horseId === 'blue_0');
    expect(blueKick?.kickedHorseId).toBe('red_0');
    expect(blueKick?.toProgress).toBe(SAFE_DOOR_PROGRESS);
  });

  it('10. Cấm đi lố quá Ô Lên Bụt (progress + dice > 51) — bắt buộc dừng đúng Ô Lên Bụt', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'TRACK', progress: 49 }); // Còn 2 bước tới cửa chuồng 51
    expect(computeLegalHorseMoves(st.horses, 'red', 3).some((m) => m.horseId === 'red_0')).toBe(false);
    expect(computeLegalHorseMoves(st.horses, 'red', 4).some((m) => m.horseId === 'red_0')).toBe(false);
    const m2 = computeLegalHorseMoves(st.horses, 'red', 2).find((m) => m.horseId === 'red_0');
    expect(m2?.toProgress).toBe(SAFE_DOOR_PROGRESS);
  });

  it('11. Đứng ngay Ô Lên Bụt (progress = 51): gieo k (1..6) leo thẳng lên bậc bụt k', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'TRACK', progress: SAFE_DOOR_PROGRESS });
    for (const k of [1, 2, 3, 4, 5, 6]) {
      const mv = computeLegalHorseMoves(st.horses, 'red', k).find((m) => m.horseId === 'red_0');
      expect(mv?.kind).toBe('ENTER_STAIRS');
      expect(mv?.toStairStep).toBe(k);
    }
  });

  it('12. Đứng tại Ô Lên Bụt nhưng bậc 2 có ngựa mình chắn -> cấm nhảy qua bậc 2 để lên 3..6', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'TRACK', progress: SAFE_DOOR_PROGRESS });
    setHorse(st, 'red_1', { zone: 'HOME_STAIRS', stairStep: 2 });

    expect(computeLegalHorseMoves(st.horses, 'red', 1).some((m) => m.horseId === 'red_0')).toBe(true);
    expect(computeLegalHorseMoves(st.horses, 'red', 2).some((m) => m.horseId === 'red_0')).toBe(false);
    expect(computeLegalHorseMoves(st.horses, 'red', 4).some((m) => m.horseId === 'red_0')).toBe(false);
  });

  it('13. Đổi bụt trên cầu thang cho phép CẢ LÊN LẪN XUỐNG từ mọi bậc 1..6 (cấm nhảy qua quân mình)', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'HOME_STAIRS', stairStep: 3 });
    setHorse(st, 'red_1', { zone: 'HOME_STAIRS', stairStep: 6 });

    // Đang ở bậc 3:
    // - Gieo 1 hoặc 2 -> ĐƯỢC ĐỔI BỤT XUỐNG bậc 1 hoặc 2 (vì bậc 1, 2 đều trống!)
    expect(
      computeLegalHorseMoves(st.horses, 'red', 1).find((m) => m.horseId === 'red_0')?.toStairStep,
    ).toBe(1);
    expect(
      computeLegalHorseMoves(st.horses, 'red', 2).find((m) => m.horseId === 'red_0')?.toStairStep,
    ).toBe(2);
    // - Gieo 3 -> trùng bậc hiện tại, không đi
    expect(computeLegalHorseMoves(st.horses, 'red', 3).some((m) => m.horseId === 'red_0')).toBe(false);
    // - Gieo 4 hoặc 5 -> lên bậc 4 hoặc 5
    expect(
      computeLegalHorseMoves(st.horses, 'red', 4).find((m) => m.horseId === 'red_0')?.toStairStep,
    ).toBe(4);
    // - Gieo 6 -> bị red_1 ở bậc 6 chặn!
    expect(computeLegalHorseMoves(st.horses, 'red', 6).some((m) => m.horseId === 'red_0')).toBe(false);

    // Đang ở bậc 6 (red_1) với red_0 chắn ở bậc 3:
    // - Gieo 4 hoặc 5 -> ĐƯỢC lùi xuống bậc 4 hoặc 5!
    expect(
      computeLegalHorseMoves(st.horses, 'red', 4).find((m) => m.horseId === 'red_1')?.toStairStep,
    ).toBe(4);
    expect(
      computeLegalHorseMoves(st.horses, 'red', 5).find((m) => m.horseId === 'red_1')?.toStairStep,
    ).toBe(5);
    // - Gieo 1 hoặc 2 -> BỊ CHẶN vì không được nhảy qua red_0 ở bậc 3!
    expect(computeLegalHorseMoves(st.horses, 'red', 1).some((m) => m.horseId === 'red_1')).toBe(false);
    expect(computeLegalHorseMoves(st.horses, 'red', 2).some((m) => m.horseId === 'red_1')).toBe(false);

    // Thực thi nước đổi bụt xuống từ 3 -> 1 qua reducer kiểm tra trạng thái & bất biến
    const { state: rolled } = reduceCoCaNguaAction(st, { type: 'ROLL_DICE', diceValue: 1 });
    const { state: steppedDown } = reduceCoCaNguaAction(rolled, {
      type: 'EXECUTE_MOVE',
      horseId: 'red_0',
    });
    expect(steppedDown.horses.find((h) => h.id === 'red_0')?.stairStep).toBe(1);
    assertHorseBoardInvariants(steppedDown);
  });

  it('14. Luật thắng 3–4–5–6: còn ngựa ở bậc 1 hoặc 2 CHƯA thắng; đẩy kín {3,4,5,6} THẮNG NGAY!', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'HOME_STAIRS', stairStep: 6 });
    setHorse(st, 'red_1', { zone: 'HOME_STAIRS', stairStep: 5 });
    setHorse(st, 'red_2', { zone: 'HOME_STAIRS', stairStep: 4 });
    setHorse(st, 'red_3', { zone: 'HOME_STAIRS', stairStep: 2 }); // Mới ở bậc 2!

    expect(hasColorWon(st.horses, 'red')).toBe(false);

    // Gieo được 3 -> red_3 đổi bụt từ 2 lên 3 -> kín {3,4,5,6} -> THẮNG NGAY LẬP TỨC!
    const { state: s1 } = reduceCoCaNguaAction(st, { type: 'ROLL_DICE', diceValue: 3 });
    const { state: s2, steps } = reduceCoCaNguaAction(s1, {
      type: 'EXECUTE_MOVE',
      horseId: 'red_3',
    });
    expect(s2.phase).toBe('GAME_OVER');
    expect(s2.winnerColor).toBe('red');
    expect(s2.rankings[0]?.color).toBe('red');
    expect(s2.rankings[0]?.winStairCount).toBe(4);
    expect(steps.some((step) => step.type === 'VICTORY' && step.winnerColor === 'red')).toBe(true);
    assertHorseBoardInvariants(s2);
  });

  it('15. Mô phỏng ván đầy đủ 4 tụ tự chơi liên tiếp đến khi có người kín bụt 3–4–5–6 mà không treo/lỗi bất biến', () => {
    const colors: HorseColor[] = ['red', 'yellow', 'blue', 'green'];
    let state = createInitialCoCaNguaState({
      players: colors.map((c) => ({ color: c, name: HORSE_COLOR_CONFIG[c].nameVi, isBot: true })),
    });

    let guard = 0;
    while (state.phase !== 'GAME_OVER' && guard < 3500) {
      guard += 1;
      if (state.phase === 'WAIT_ROLL') {
        state = reduceCoCaNguaAction(state, { type: 'ROLL_DICE' }).state;
      } else if (state.phase === 'SELECT_HORSE') {
        // Ưu tiên lên bụt / đổi bụt lên cao nhất / đá ngựa / tiến xa nhất (tránh lùi bụt vô ích trừ khi bắt buộc)
        const sorted = [...state.legalMoves].sort((a, b) => {
          const score = (m: typeof a) =>
            (m.kind === 'ENTER_STAIRS' || (m.kind === 'CLIMB_STAIRS' && m.toStairStep > m.fromStairStep)
              ? 500 + m.toStairStep * 20
              : m.kind === 'CLIMB_STAIRS' && m.toStairStep < m.fromStairStep
                ? -300
                : 0) +
            (m.kickedHorseId ? 200 : 0) +
            (m.kind === 'DEPLOY' ? 120 : 0) +
            m.toProgress;
          return score(b) - score(a);
        });
        state = reduceCoCaNguaAction(state, {
          type: 'EXECUTE_MOVE',
          horseId: sorted[0].horseId,
        }).state;
      }
      assertHorseBoardInvariants(state);
    }

    expect(state.phase).toBe('GAME_OVER');
    expect(state.winnerColor).not.toBeNull();
    expect(hasColorWon(state.horses, state.winnerColor!)).toBe(true);
    assertHorseBoardInvariants(state);
  });

  it('16. Máy AI (cả 3 cấp độ) & Gợi ý nước đi luôn chọn nước thắng ngay khi có thể xếp kín 3–4–5–6', () => {
    const st = make4PlayerState();
    setHorse(st, 'red_0', { zone: 'HOME_STAIRS', stairStep: 6 });
    setHorse(st, 'red_1', { zone: 'HOME_STAIRS', stairStep: 5 });
    setHorse(st, 'red_2', { zone: 'HOME_STAIRS', stairStep: 4 });
    setHorse(st, 'red_3', { zone: 'TRACK', progress: SAFE_DOOR_PROGRESS });
    // Thêm 1 quân đối phương ngay đầu đường nhưng Đỏ có nước lên bụt 3 thắng ngay
    setHorse(st, 'yellow_0', { zone: 'TRACK', progress: 10 });

    const { state: rolled } = reduceCoCaNguaAction(st, { type: 'ROLL_DICE', diceValue: 3 });
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const move = computeHorseBotMove(rolled, diff);
      expect(move?.horseId).toBe('red_3');
      expect(move?.toStairStep).toBe(3);
    }

    const hint = computeHorseHint(rolled);
    expect(hint?.move.horseId).toBe('red_3');
    expect(hint?.explanationVi).toContain('CHIẾN THẮNG');
  });

  it('17. Mô phỏng ván đầy đủ 4 Máy AI Cao Thủ (hard) dùng computeHorseBotMove chạy tới kết thúc', () => {
    const colors: HorseColor[] = ['red', 'yellow', 'blue', 'green'];
    let state = createInitialCoCaNguaState({
      players: colors.map((c) => ({ color: c, name: HORSE_COLOR_CONFIG[c].nameVi, isBot: true })),
    });

    let guard = 0;
    while (state.phase !== 'GAME_OVER' && guard < 3500) {
      guard += 1;
      if (state.phase === 'WAIT_ROLL') {
        state = reduceCoCaNguaAction(state, { type: 'ROLL_DICE' }).state;
      } else if (state.phase === 'SELECT_HORSE') {
        const chosen = computeHorseBotMove(state, 'hard');
        expect(chosen).not.toBeNull();
        state = reduceCoCaNguaAction(state, {
          type: 'EXECUTE_MOVE',
          horseId: chosen!.horseId,
        }).state;
      }
      assertHorseBoardInvariants(state);
    }

    expect(state.phase).toBe('GAME_OVER');
    expect(state.winnerColor).not.toBeNull();
    expect(hasColorWon(state.horses, state.winnerColor!)).toBe(true);
  });

  it('18. Xúc Xắc Thông Minh mở rộng: 0 ngựa (~60% ra 1/6), 1 ngựa + còn chuồng (~44% ra 1/6), >=2 ngựa (~33%), áp sát cửa ★ tăng tỉ lệ vào cửa', () => {
    const stuckState = make4PlayerState();
    expect(shouldBoostDeployDice(stuckState.horses, 'red')).toBe(true);

    let deployHitsStuck = 0;
    const samples = 2400;
    for (let i = 0; i < samples; i += 1) {
      const d = rollSmartHorseDice(stuckState);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
      if (d === 1 || d === 6) deployHitsStuck += 1;
    }
    const rateStuck = deployHitsStuck / samples;
    expect(rateStuck).toBeGreaterThan(0.54);
    expect(rateStuck).toBeLessThan(0.66);

    // 1 ngựa đang chạy + vẫn còn 3 ngựa trong chuồng -> boost nhẹ {1, 6} lên ~44%
    const oneOutState = make4PlayerState();
    setHorse(oneOutState, 'red_0', { zone: 'TRACK', progress: 4 });
    expect(shouldBoostDeployDice(oneOutState.horses, 'red')).toBe(false);
    let deployHitsOne = 0;
    for (let i = 0; i < samples; i += 1) {
      const d = rollSmartHorseDice(oneOutState);
      if (d === 1 || d === 6) deployHitsOne += 1;
    }
    const rateOne = deployHitsOne / samples;
    expect(rateOne).toBeGreaterThan(0.38);
    expect(rateOne).toBeLessThan(0.5);

    // Đã có >= 2 ngựa ngoài đường đua (chưa gần cửa) -> phân bố đều 1/6 (~33.3% cho {1, 6})
    const twoOutState = make4PlayerState();
    setHorse(twoOutState, 'red_0', { zone: 'TRACK', progress: 4 });
    setHorse(twoOutState, 'red_1', { zone: 'TRACK', progress: 12 });
    let deployHitsTwo = 0;
    for (let i = 0; i < samples; i += 1) {
      const d = rollSmartHorseDice(twoOutState);
      if (d === 1 || d === 6) deployHitsTwo += 1;
    }
    const rateTwo = deployHitsTwo / samples;
    expect(rateTwo).toBeGreaterThan(0.28);
    expect(rateTwo).toBeLessThan(0.39);

    // Ngựa áp sát Cửa ★ (progress = 47, cần đúng mặt 4 để dừng cửa 51) -> mặt 4 được tăng trọng số ~25%
    const nearDoorState = make4PlayerState();
    setHorse(nearDoorState, 'red_0', { zone: 'TRACK', progress: 47 });
    setHorse(nearDoorState, 'red_1', { zone: 'TRACK', progress: 12 });
    let face4Hits = 0;
    for (let i = 0; i < samples; i += 1) {
      if (rollSmartHorseDice(nearDoorState) === 4) face4Hits += 1;
    }
    const rateFace4 = face4Hits / samples;
    expect(rateFace4).toBeGreaterThan(0.2);
    expect(rateFace4).toBeLessThan(0.31);
  });

  it('19. Cờ Cá Ngựa Lượt 101+ (Tăng Tốc Toàn Diện): ưu tiên mặt lớn 5–6 khi chạy đường đua & tăng mạnh mặt về Ô ★ / đá ngựa', () => {
    const lateRaceState = make4PlayerState();
    lateRaceState.turnCount = LATE_GAME_TURNS_THRESHOLD + 1; // Lượt 101
    setHorse(lateRaceState, 'red_0', { zone: 'TRACK', progress: 8 });
    setHorse(lateRaceState, 'red_1', { zone: 'TRACK', progress: 20 });

    const samples = 2400;
    let highFaces = 0;
    let lowFaces = 0;
    for (let i = 0; i < samples; i += 1) {
      const d = rollSmartHorseDice(lateRaceState);
      if (d === 5 || d === 6) highFaces += 1;
      if (d === 2 || d === 3) lowFaces += 1;
    }
    // Mặt 5–6 (×1.75) phải áp đảo rõ rệt so với mặt 2–3 (×1.0)
    expect(highFaces / samples).toBeGreaterThan(0.38);
    expect(highFaces).toBeGreaterThan(lowFaces * 1.45);

    // Ở lượt 101+, ngựa áp sát Cửa ★ (progress 47, cần 4) có tỉ lệ ra 4 cao hơn hẳn giai đoạn đầu (~34%+)
    const lateDoorState = make4PlayerState();
    lateDoorState.turnCount = LATE_GAME_TURNS_THRESHOLD + 5;
    setHorse(lateDoorState, 'red_0', { zone: 'TRACK', progress: 47 });
    setHorse(lateDoorState, 'red_1', { zone: 'TRACK', progress: 12 });
    let lateDoorHits = 0;
    for (let i = 0; i < samples; i += 1) {
      if (rollSmartHorseDice(lateDoorState) === 4) lateDoorHits += 1;
    }
    expect(lateDoorHits / samples).toBeGreaterThan(0.3);
  });
});
