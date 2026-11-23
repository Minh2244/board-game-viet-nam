import { describe, expect, it } from 'vitest';
import { computeBestHint, computeBotMove } from '../ai/smartBot';
import {
  createInitialOAnQuanState,
  executeSowMove,
  prepareTurnState,
} from '../engine/reducer';
import {
  assertBoardInvariants,
  computePlayerScore,
  MANDARIN_LEFT_INDEX,
  MANDARIN_RIGHT_INDEX,
  TOTAL_GAME_POINTS,
  TOTAL_PHYSICAL_DAN,
} from '../engine/rules';
import type { OAnQuanState } from '../engine/types';

/**
 * Helper tạo thế cờ tùy chỉnh nhưng vẫn đảm bảo đủ đúng 50 viên dân vật lý & 2 viên Quan vật lý.
 */
function buildCustomTestState(config: {
  pitStones: number[]; // 12 phần tử cho ô 0..11
  pitMandarins?: [boolean, boolean]; // [ô 5, ô 11]
  p0CapturedQuan?: number;
  p1CapturedQuan?: number;
  p0CapturedDan?: number;
  p1CapturedDan?: number;
  p0BorrowedDan?: number;
  p1BorrowedDan?: number;
  currentSide?: 0 | 1;
  mandarinPointValue?: 5 | 10;
  mandarinYouthRule?: boolean;
}): OAnQuanState {
  const qVal = config.mandarinPointValue ?? 10;
  const base = createInitialOAnQuanState({
    startingSide: config.currentSide ?? 0,
    rules: {
      mandarinPointValue: qVal,
      mandarinYouthRule: config.mandarinYouthRule ?? false,
      minStonesForMandarin: 5,
    },
  });

  if (config.pitStones.length !== 12) {
    throw new Error('pitStones phải có đúng 12 phần tử');
  }
  for (let i = 0; i < 12; i += 1) {
    base.pits[i].stones = config.pitStones[i];
  }
  const [hasM5, hasM11] = config.pitMandarins ?? [true, true];
  base.pits[MANDARIN_RIGHT_INDEX].hasMandarin = hasM5;
  base.pits[MANDARIN_LEFT_INDEX].hasMandarin = hasM11;

  const boardDan = base.pits.reduce((s, p) => s + p.stones, 0);
  const remainingDan = TOTAL_PHYSICAL_DAN - boardDan;

  const p0Dan = config.p0CapturedDan ?? remainingDan;
  const p1Dan = config.p1CapturedDan ?? remainingDan - p0Dan;

  base.players[0].capturedDan = p0Dan;
  base.players[1].capturedDan = p1Dan;
  base.players[0].capturedQuan = config.p0CapturedQuan ?? (hasM5 ? 0 : 1);
  base.players[1].capturedQuan = config.p1CapturedQuan ?? (hasM11 ? 0 : 1);

  const b0 = config.p0BorrowedDan ?? 0;
  const b1 = config.p1BorrowedDan ?? 0;
  base.players[0].borrowedDan = b0;
  base.players[1].loanedDan = b0;
  base.players[1].borrowedDan = b1;
  base.players[0].loanedDan = b1;

  base.players[0].score = computePlayerScore(base.players[0], qVal);
  base.players[1].score = computePlayerScore(base.players[1], qVal);

  assertBoardInvariants(base);
  return base;
}

describe('Ô Ăn Quan Engine — Bộ 15 Tình Huống Kiểm Thử Luật Bắt Buộc (15/15)', () => {
  it('01. Rải 1 viên, 5 viên, 12 viên và hơn 12 viên (> 12 viên đi giáp vòng qua cả ô xuất phát)', () => {
    // 1a. Rải 1 viên từ ô 0 sang phải (CCW) -> rơi vào ô 1 (ô 2 đang có quân nên dừng vì ô 1 nối lượt hoặc nếu ô 1 trống và ô 2 có quân thì ăn)
    const state1 = buildCustomTestState({
      // Ô 0 có 1 viên, ô 1 trống, ô 2 trống -> rải 1 viên vào ô 1, ô 2 trống, ô 3 trống -> dừng lượt (2 ô trống liên tiếp)
      pitStones: [1, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 0],
    });
    const res1 = executeSowMove(state1, 0, 'CCW');
    expect(res1.state.pits[0].stones).toBe(0);
    expect(res1.state.pits[1].stones).toBe(1);

    // 1b. Rải 5 viên từ ô 0 sang phải (CCW) ở bàn cờ khởi tạo: rải vào 1,2,3,4,5 (viên cuối rơi vào Quan 5, ô 6 có 5 quân -> nối lượt bốc ô 6!)
    const initial = createInitialOAnQuanState();
    const res5 = executeSowMove(initial, 0, 'CCW');
    expect(res5.state.lastMove?.chainPickCount).toBeGreaterThanOrEqual(1);
    assertBoardInvariants(res5.state);

    // 1c. Rải đúng 12 viên từ ô 0 (CCW): đi giáp đúng 1 vòng 12 ô, viên thứ 12 rơi lại vào chính ô 0!
    // Để dừng ngay sau 1 vòng (không nối lượt), đặt ô 1 = 0 và ô 2 = 0?
    // Lưu ý: khi rải 12 viên từ ô 0, mọi ô 1..11 và cả ô 0 đều được cộng +1 viên!
    // Vậy muốn sau khi rải 12 viên mà dừng ngay tại ô 0 thì ô kế tiếp (ô 1) phải là Quan hoặc ta đặt 12 viên ở ô 4 (CCW):
    // Bốc 12 viên ở ô 4 -> rải qua 5,6,7,8,9,10,11,0,1,2,3,4 (viên thứ 12 rơi lại vào chính ô 4, ô kế tiếp là Ô Quan 5 đang có quân -> dừng ngay!)
    const state12 = buildCustomTestState({
      pitStones: [0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0],
    });
    const res12 = executeSowMove(state12, 4, 'CCW');
    // Tất cả 12 ô (0..11), bao gồm cả 2 ô Quan (5, 11) và chính ô xuất phát (4), đều nhận đúng 1 viên!
    for (let idx = 0; idx < 12; idx += 1) {
      expect(res12.state.pits[idx].stones).toBe(1);
    }
    expect(res12.state.lastMove?.chainPickCount).toBe(0);

    // 1d. Rải > 12 viên (15 viên từ ô 1 sang CCW):
    // 12 viên đầu rải khắp 12 ô (+1 mỗi ô), 3 viên còn lại rải thêm vào ô 2 (+2), ô 3 (+2), ô 4 (+2).
    // Viên thứ 15 rơi vào ô 4 -> ô kế tiếp là Ô Quan 5 (đang có Quan + 1 dân) -> dừng lượt ngay!
    const state15 = buildCustomTestState({
      pitStones: [0, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    const res15 = executeSowMove(state15, 1, 'CCW');
    expect(res15.state.pits[1].stones).toBe(1); // Ô xuất phát nhận lại 1 viên khi đi giáp vòng
    expect(res15.state.pits[2].stones).toBe(2);
    expect(res15.state.pits[3].stones).toBe(2);
    expect(res15.state.pits[4].stones).toBe(2);
    expect(res15.state.pits[5].stones).toBe(1); // Quan phải nhận 1 viên
    expect(res15.state.pits[11].stones).toBe(1); // Quan trái nhận 1 viên
  });

  it('02. Rải nối lượt qua nhiều ô dân liên tiếp (giữ nguyên chiều rải ban đầu)', () => {
    // Ô 0 có 1 viên (rải vào 1, lastIdx = 1)
    // -> nextIdx = 2 (có 1 viên): Bốc nối lượt lần 1 từ Ô 2, rải vào Ô 3 (lastIdx = 3)
    // -> nextIdx = 4 (có 1 viên): Bốc nối lượt lần 2 từ Ô 4, rải vào Ô Quan 5 (lastIdx = 5)
    // -> nextIdx = 6 trống, Ô 7 trống (2 ô trống liên tiếp) -> dừng lượt!
    const state = buildCustomTestState({
      pitStones: [1, 0, 1, 0, 1, 0, 0, 0, 5, 0, 0, 0],
    });
    const { state: next } = executeSowMove(state, 0, 'CCW');
    expect(next.lastMove?.chainPickCount).toBe(2);
    expect(next.pits[0].stones).toBe(0);
    expect(next.pits[1].stones).toBe(1);
    expect(next.pits[2].stones).toBe(0);
    expect(next.pits[3].stones).toBe(1);
    expect(next.pits[4].stones).toBe(0);
    expect(next.pits[5].stones).toBe(1);
    assertBoardInvariants(next);
  });

  it('03. Rải qua cả hai ô Quan (thả 1 viên vào ô Quan và đi tiếp khi trên tay còn quân)', () => {
    // Ô 3 có 10 viên (CCW): rải qua 4, Quan 5, 6, 7, 8, 9, 10, Quan 11, 0, 1 (ô 2 trống, ô 3 trống -> dừng)
    const state = buildCustomTestState({
      pitStones: [0, 0, 0, 10, 0, 0, 1, 0, 0, 0, 0, 0],
    });
    const { state: next } = executeSowMove(state, 3, 'CCW');
    expect(next.pits[MANDARIN_RIGHT_INDEX].stones).toBe(1);
    expect(next.pits[MANDARIN_LEFT_INDEX].stones).toBe(1);
    expect(next.pits[0].stones).toBe(1);
    expect(next.pits[1].stones).toBe(1);
    assertBoardInvariants(next);
  });

  it('04. Viên cuối rơi trước ô dân trống -> xét ăn ô kế tiếp sau ô dân trống', () => {
    // Ô 0 có 2 viên (CCW) -> rải vào 1, 2. Ô 3 trống (0), Ô 4 có 6 viên, Ô 5 có Quan -> Ăn trọn 6 viên ở Ô 4!
    const state = buildCustomTestState({
      pitStones: [2, 0, 0, 0, 6, 0, 1, 0, 0, 0, 0, 0],
    });
    const { state: next } = executeSowMove(state, 0, 'CCW');
    expect(next.lastMove?.capturedDanGain).toBe(6);
    expect(next.pits[4].stones).toBe(0);
    expect(next.players[0].capturedDan).toBe(state.players[0].capturedDan + 6);
  });

  it('05. Viên cuối rơi trước ô Quan trống -> xét ăn ô dân kế tiếp bên kia hố Quan trống', () => {
    // Ô Quan 5 đã bị ăn sạch trước đó (hasMandarin = false, stones = 0).
    // Ô 3 có 1 viên (CCW) -> rơi vào ô 4. Ô kế tiếp là Ô Quan 5 đang TRỐNG -> ăn toàn bộ 7 viên ở Ô 6!
    const state = buildCustomTestState({
      pitStones: [0, 0, 0, 1, 0, 0, 7, 1, 0, 0, 0, 0],
      pitMandarins: [false, true],
      p0CapturedQuan: 1,
      p1CapturedQuan: 0,
    });
    const { state: next } = executeSowMove(state, 3, 'CCW');
    expect(next.lastMove?.capturedDanGain).toBe(7);
    expect(next.pits[6].stones).toBe(0);
  });

  it('06. Viên cuối rơi trước ô Quan còn quân -> dừng lượt ngay lập tức', () => {
    // 6a. Ô Quan 5 còn viên Quan lớn: Ô 3 có 1 viên (CCW) -> rơi vào ô 4, kế tiếp là Ô Quan 5 -> dừng lượt!
    const stateWithQuan = buildCustomTestState({
      pitStones: [0, 0, 0, 1, 0, 0, 5, 0, 0, 0, 0, 0],
    });
    const resA = executeSowMove(stateWithQuan, 3, 'CCW');
    expect(resA.state.lastMove?.capturedDanGain).toBe(0);
    expect(resA.state.lastMove?.capturedQuanGain).toBe(0);
    expect(resA.steps.some((s) => s.type === 'STOP_TURN' && s.reason === 'HIT_MANDARIN_PIT')).toBe(
      true,
    );

    // 6b. Ô Quan 5 đã mất viên Quan lớn nhưng còn 2 viên sỏi dân trong hố Quan -> vẫn phải dừng lượt, cấm bốc hố Quan đi rải tiếp!
    const stateQuanOnlyStones = buildCustomTestState({
      pitStones: [0, 0, 0, 1, 0, 2, 5, 0, 0, 0, 0, 0],
      pitMandarins: [false, true],
      p0CapturedQuan: 1,
      p1CapturedQuan: 0,
    });
    const resB = executeSowMove(stateQuanOnlyStones, 3, 'CCW');
    expect(resB.state.pits[5].stones).toBe(2);
    expect(resB.state.lastMove?.chainPickCount).toBe(0);
    expect(resB.steps.some((s) => s.type === 'STOP_TURN' && s.reason === 'HIT_MANDARIN_PIT')).toBe(
      true,
    );
  });

  it('07. Ăn một ô dân, ăn liên hoàn nhiều ô (Combo) và bắt buộc dừng lượt ngay khi dứt chuỗi ăn', () => {
    // Ô 0 có 1 viên (CCW) -> rơi vào ô 1.
    // Thế liên hoàn: [Ô 2 trống] -> [Ô 3 có 4 dân] -> [Ô 4 trống] -> [Ô Quan 5 có Quan + 2 dân] -> [Ô 6 có 3 dân (KHÔNG trống!)] -> [Ô 7 có 5 dân]
    // Kỳ vọng:
    // - Ăn Ô 3 (+4 dân)
    // - Nhảy con trỏ sang Ô 4 (trống sẵn) -> Ăn Ô Quan 5 (+1 Quan, +2 dân)
    // - Nhảy con trỏ sang Ô 6 (đang có 3 dân, không trống) -> DỪNG CHUỖI ĂN VÀ KẾT THÚC LƯỢT NGAY (tuyệt đối không bốc Ô 6 rải tiếp và không dùng Ô 5 vừa ăn làm ô trống để ăn Ô 6!).
    const state = buildCustomTestState({
      pitStones: [1, 0, 0, 4, 0, 2, 3, 5, 0, 0, 0, 0],
    });
    const { state: next, steps } = executeSowMove(state, 0, 'CCW');
    expect(next.lastMove?.comboCount).toBe(2);
    expect(next.lastMove?.capturedDanGain).toBe(6); // 4 + 2
    expect(next.lastMove?.capturedQuanGain).toBe(1);
    expect(next.pits[6].stones).toBe(3); // Ô 6 còn nguyên 3 viên, không bị ăn cũng không bị bốc rải tiếp!
    expect(steps.some((s) => s.type === 'STOP_TURN' && s.reason === 'AFTER_CAPTURE_NON_EMPTY')).toBe(
      true,
    );
  });

  it('08. Ăn Quan non khi bật và tắt tùy chọn (mandarinYouthRule)', () => {
    // Ô 2 có 1 viên (CCW) -> rơi vào ô 3, ô 4 trống, Ô Quan 5 có 1 Quan + 3 dân (< 5 dân: Quan Non)
    const stateOff = buildCustomTestState({
      pitStones: [0, 0, 1, 0, 0, 3, 2, 0, 0, 0, 0, 0],
      mandarinYouthRule: false,
    });
    const resOff = executeSowMove(stateOff, 2, 'CCW');
    expect(resOff.state.lastMove?.capturedQuanGain).toBe(1);
    expect(resOff.state.lastMove?.capturedDanGain).toBe(3);

    // Khi bật Luật Quan Non: Ô Quan 5 mới có 3 dân (< 5) -> Bị chặn không được ăn!
    const stateOnBlocked = buildCustomTestState({
      pitStones: [0, 0, 1, 0, 0, 3, 2, 0, 0, 0, 0, 0],
      mandarinYouthRule: true,
    });
    const resBlocked = executeSowMove(stateOnBlocked, 2, 'CCW');
    expect(resBlocked.state.lastMove?.capturedQuanGain).toBe(0);
    expect(resBlocked.state.lastMove?.capturedDanGain).toBe(0);
    expect(resBlocked.state.pits[5].hasMandarin).toBe(true);
    expect(
      resBlocked.steps.some(
        (s) => s.type === 'STOP_TURN' && s.reason === 'BLOCKED_BY_YOUTH_MANDARIN',
      ),
    ).toBe(true);

    // Khi bật Luật Quan Non nhưng Ô Quan 5 đã đủ 5 dân -> Được ăn trọn ổ (1 Quan + 5 dân = 15đ)!
    const stateOnMature = buildCustomTestState({
      pitStones: [0, 0, 1, 0, 0, 5, 2, 0, 0, 0, 0, 0],
      mandarinYouthRule: true,
    });
    const resMature = executeSowMove(stateOnMature, 2, 'CCW');
    expect(resMature.state.lastMove?.capturedQuanGain).toBe(1);
    expect(resMature.state.lastMove?.capturedDanGain).toBe(5);
  });

  it('09. Cả 5 ô dân của một phe đều trống -> tự động phát hiện và kích hoạt rải dân đầu lượt', () => {
    const state = buildCustomTestState({
      pitStones: [0, 0, 0, 0, 0, 2, 4, 4, 4, 4, 4, 2], // Tổng trên bàn = 24 dân
      p0CapturedDan: 13,
      p1CapturedDan: 13, // 24 + 13 + 13 = 50 dân vật lý
      currentSide: 0,
    });
    const { state: prepared, steps } = prepareTurnState(state);
    expect(steps[0]?.type).toBe('REFILL_FIVE_PITS');
    for (let i = 0; i < 5; i += 1) {
      expect(prepared.pits[i].stones).toBe(1);
    }
    expect(prepared.players[0].capturedDan).toBe(8); // 13 - 5 = 8
    assertBoardInvariants(prepared);
  });

  it('10. Vay dân đối thủ khi thiếu dân vật lý (kể cả khi đã ăn Quan) & Tự động hoàn trả nợ vật lý cuối lượt', () => {
    // Phe 0 đã ăn 1 Quan (10đ) nhưng chỉ có 2 viên dân vật lý trong giỏ (capturedDan = 2).
    // Cả 5 ô dân của Phe 0 đều trống (0) -> Phe 0 không được bẻ viên Quan mà phải dùng 2 dân của mình + vay 3 dân từ giỏ Phe 1!
    // Sau khi rải 1 viên/ô vào 0..4, Phe 0 đi Ô 2 sang phải (CCW): rơi vào Ô 3 (nối lượt bốc 2 viên ở Ô 3 rải vào Ô 4, Quan 5? Không, đặt Ô 4 = 0 sau khi rải?
    // Hãy test bước prepareTurnState trước, rồi test bước ăn dân tự trả nợ!)
    const state = buildCustomTestState({
      pitStones: [0, 0, 0, 0, 0, 0, 10, 10, 10, 10, 0, 0],
      pitMandarins: [false, true],
      p0CapturedQuan: 1,
      p1CapturedQuan: 0,
      p0CapturedDan: 2,
      p1CapturedDan: 8,
      currentSide: 0,
    });

    const { state: afterRefill } = prepareTurnState(state);
    expect(afterRefill.players[0].capturedDan).toBe(0);
    expect(afterRefill.players[1].capturedDan).toBe(5); // 8 - 3 cho vay = 5
    expect(afterRefill.players[0].borrowedDan).toBe(3);
    expect(afterRefill.players[1].loanedDan).toBe(3);
    for (let i = 0; i < 5; i += 1) {
      expect(afterRefill.pits[i].stones).toBe(1);
    }

    // Bây giờ Phe 0 đi Ô 3 sang phải (CCW):
    // Ô 3 có 1 viên -> rơi vào Ô 4 (thành 2 viên) -> bốc 2 viên ở Ô 4 rải vào Ô Quan 5 (trống -> thành 1), Ô 6 (10 -> 11)...
    // Để Phe 0 ăn được ngay 10 viên ở Ô 6 và tự động trả nợ 3 viên cho Phe 1, ta chọn Ô 4 sang phải (CCW)?
    // Từ Ô 4 (1 viên) rải vào Ô Quan 5 (thành 1 viên), kế tiếp là Ô 6 có 10 viên...
    // Còn nếu từ Ô 2 (1 viên) rải sang phải: rơi vào Ô 3 (thành 2 viên) -> bốc 2 viên ở Ô 3 rải vào Ô 4 (thành 2), Ô Quan 5 (thành 1)...
    // Hãy dựng thế cờ Phe 0 đang nợ Phe 1 3 viên dân (borrowedDan = 3) và đi 1 nước ăn được 5 viên dân:
    const debtState = buildCustomTestState({
      pitStones: [1, 0, 0, 5, 0, 0, 10, 10, 10, 4, 0, 0],
      p0CapturedDan: 0,
      p1CapturedDan: 10,
      p0BorrowedDan: 3,
      currentSide: 0,
    });
    // Phe 0 đi Ô 0 (1 viên) sang CCW -> rơi vào Ô 1, Ô 2 trống -> ăn 5 viên dân ở Ô 3!
    // Vừa ăn 5 viên dân trong khi đang nợ 3 viên -> hệ thống tự động trích 3 viên dân trả ngay vào giỏ Phe 1!
    const { state: afterRepay, steps } = executeSowMove(debtState, 0, 'CCW');
    expect(steps.some((s) => s.type === 'AUTO_REPAY_DEBT')).toBe(true);
    expect(afterRepay.players[0].borrowedDan).toBe(0);
    expect(afterRepay.players[1].loanedDan).toBe(0);
    expect(afterRepay.players[0].capturedDan).toBe(2); // Ăn 5 - trả nợ 3 = còn 2
    expect(afterRepay.players[1].capturedDan).toBe(13); // 10 + nhận trả nợ 3 = 13
    assertBoardInvariants(afterRepay);
  });

  it('11. Hai bên không đủ 5 dân vật lý để rải lại (< 5 dân) -> kết thúc ván do Bế Tắc', () => {
    // 5 ô dân của Phe 0 đều trống (0). Giỏ Phe 0 có 2 dân, giỏ Phe 1 có 2 dân (tổng = 4 < 5), 46 dân còn lại nằm ở 2 ô Quan và hàng trên.
    const state = buildCustomTestState({
      pitStones: [0, 0, 0, 0, 0, 20, 6, 5, 5, 5, 5, 0],
      p0CapturedDan: 2,
      p1CapturedDan: 2,
      currentSide: 0,
    });
    const { state: endState } = prepareTurnState(state);
    expect(endState.phase).toBe('GAME_OVER');
    expect(endState.finalSummary?.endReason).toBe('NO_LEGAL_MOVES_STALEMATE');
    assertBoardInvariants(endState);
  });

  it('12. Kết thúc ván khi hai Quan hết quân (BOTH_MANDARINS_EMPTY) & bảo toàn tổng điểm 70', () => {
    // Ô Quan 11 đã trống từ trước. Ô Quan 5 chỉ còn 1 viên Quan lớn (0 dân).
    // Phe 0 đi Ô 2 (1 viên, CCW) -> rơi vào Ô 3, Ô 4 trống -> ăn Ô Quan 5!
    // Ngay sau chuỗi ăn, cả 2 ô Quan đều trống sạch -> Kết thúc ván, thu dân trên 5 ô mỗi bên!
    const state = buildCustomTestState({
      pitStones: [2, 3, 1, 0, 0, 0, 4, 4, 0, 0, 0, 0],
      pitMandarins: [true, false],
      p0CapturedQuan: 0,
      p1CapturedQuan: 1,
      p0CapturedDan: 20,
      p1CapturedDan: 16,
      currentSide: 0,
    });
    const { state: endState } = executeSowMove(state, 2, 'CCW');
    expect(endState.phase).toBe('GAME_OVER');
    expect(endState.finalSummary?.endReason).toBe('BOTH_MANDARINS_EMPTY');
    expect(endState.finalSummary?.neutralScore).toBe(0);
    // Phe 0 thu về từ 5 ô dưới: ô 0 (2) + ô 1 (3) + ô 3 (1 viên vừa rải) = 6 viên
    expect(endState.finalSummary?.sweptStonesGross[0]).toBe(6);
    // Phe 1 thu về từ 5 ô trên: ô 6 (4) + ô 7 (4) = 8 viên
    expect(endState.finalSummary?.sweptStonesGross[1]).toBe(8);
    expect(
      (endState.finalSummary?.scores[0] ?? 0) + (endState.finalSummary?.scores[1] ?? 0),
    ).toBe(TOTAL_GAME_POINTS);
  });

  it('13. Kết thúc ván do bế tắc khi Quan vẫn còn quân -> tách riêng điểm trung lập S_neutral (S0 + S1 + S_neutral = 70)', () => {
    // Cả 2 ô Quan vẫn còn nguyên 2 viên Quan (20đ) + 30 viên dân trong ô Quan 5 (tổng điểm trung lập ở 2 ô Quan = 50đ).
    // Hàng trên (Phe 1) có 18 viên dân trên bàn. Giỏ cả 2 bên chỉ có tổng 2 viên dân (< 5).
    // Đến lượt Phe 0 mà cả 5 ô dân của Phe 0 đều trống -> Bế tắc!
    const state = buildCustomTestState({
      pitStones: [0, 0, 0, 0, 0, 30, 4, 4, 4, 3, 3, 0],
      pitMandarins: [true, true],
      p0CapturedDan: 1,
      p1CapturedDan: 1,
      currentSide: 0,
    });
    const { state: endState } = prepareTurnState(state);
    expect(endState.phase).toBe('GAME_OVER');
    expect(endState.finalSummary?.endReason).toBe('NO_LEGAL_MOVES_STALEMATE');
    expect(endState.finalSummary?.neutralQuan).toBe(2);
    expect(endState.finalSummary?.neutralDan).toBe(30);
    expect(endState.finalSummary?.neutralScore).toBe(50);
    const [s0, s1] = endState.finalSummary!.scores;
    expect(s0).toBe(1);
    expect(s1).toBe(19); // 1 trong giỏ + 18 thu về từ hàng trên
    expect(s0 + s1 + endState.finalSummary!.neutralScore).toBe(TOTAL_GAME_POINTS);
  });

  it('14. Kiểm tra tổng số dân vật lý luôn bằng 50 và Quan luôn bằng 2 qua các ván mô phỏng AI đấu nhau', () => {
    for (const youthRule of [false, true]) {
      let state = createInitialOAnQuanState({
        rules: { mandarinPointValue: 10, mandarinYouthRule: youthRule, minStonesForMandarin: 5 },
      });
      let guard = 0;
      while (state.phase === 'WAITING_MOVE' && guard < 250) {
        guard += 1;
        const move = computeBotMove(state, guard % 2 === 0 ? 'medium' : 'easy');
        expect(move).not.toBeNull();
        const res = executeSowMove(state, move!.pitIndex, move!.direction);
        state = res.state;
        assertBoardInvariants(state);
      }
      expect(state.phase).toBe('GAME_OVER');
      assertBoardInvariants(state);
    }
  });

  it('15. Kiểm tra tách sweptDanGross / sweptDanNet và kế toán trả nợ cuối ván (ví dụ A nợ B 3 dân, cuối ván A thu về 2 dân)', () => {
    // Đúng ví dụ chuẩn:
    // - Phe 0 (A) đang nợ Phe 1 (B) 3 dân (borrowedDan_0 = 3, loanedDan_1 = 3).
    // - Khi ván đấu kết thúc, trên 5 ô sân nhà của A còn 2 dân (R_gross_A = 2), trên 5 ô của B còn 0 dân (R_gross_B = 0).
    // - Để kích hoạt kết thúc ván ở nước đi này: Ô Quan 11 đã trống, Ô Quan 5 còn 1 viên Quan lớn.
    //   Phe 1 (B) đi Ô 8 (1 viên, CW: 8 -> 7), Ô 6 trống -> B ăn Ô Quan 5 làm hết sạch cả 2 ô Quan!
    //   Trên sân của A lúc đó có 2 viên dân ở Ô 0.
    const state = buildCustomTestState({
      pitStones: [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      pitMandarins: [true, false],
      p0CapturedQuan: 1,
      p1CapturedQuan: 0,
      p0CapturedDan: 0, // A đang có 0 dân trong giỏ (vì đang nợ B 3 dân)
      p1CapturedDan: 47, // 2 + 1 + 47 = 50 dân vật lý
      p0BorrowedDan: 3,
      currentSide: 1,
    });

    const { state: endState } = executeSowMove(state, 8, 'CW');
    expect(endState.phase).toBe('GAME_OVER');
    const summary = endState.finalSummary!;
    const pA = endState.players[0];
    const pB = endState.players[1];

    // 1. Dân thu về ban đầu của A là 2, của B là 1 (viên vừa rải từ ô 8 sang ô 7)
    expect(summary.sweptStonesGross[0]).toBe(2);
    expect(summary.sweptStonesGross[1]).toBe(1);

    // 2. A dùng cả 2 dân thu về để trả nợ vật lý cho B -> sweptDanNet của A còn 0, B nhận +2 vào capturedDan
    expect(summary.repaidFromSwept[0]).toBe(2);
    expect(pA.sweptDanGross).toBe(2);
    expect(pA.sweptDanNet).toBe(0);
    expect(pB.capturedDan).toBe(49); // 47 + 2 dân A trả nợ vật lý

    // 3. Nợ còn lại giảm từ 3 xuống 1 cho cả hai bên
    expect(pA.borrowedDan).toBe(1);
    expect(pB.loanedDan).toBe(1);

    // 4. Điểm chung cuộc:
    // - A: 1 Quan (10) + capturedDan (0) + sweptDanNet (0) - borrowedDan (1) = 9 điểm
    // - B: 1 Quan (10) + capturedDan (49) + sweptDanNet (1) + loanedDan (1) = 61 điểm
    // Tổng = 9 + 61 = 70 điểm (không bị tính trùng 2 viên dân đã trả!)
    expect(pA.score).toBe(9);
    expect(pB.score).toBe(61);
    expect(summary.scores).toEqual([9, 61]);

    // 5. Gợi ý nước đi trên bàn cờ mới hoạt động chuẩn xác
    const fresh = createInitialOAnQuanState();
    const hint = computeBestHint(fresh);
    expect(hint).not.toBeNull();
    expect(hint!.pitIndex).toBeGreaterThanOrEqual(0);
    expect(hint!.pitIndex).toBeLessThanOrEqual(4);
  });

  it('16. Chế độ Quan 5 điểm dân gian (tổng bảo toàn 60 điểm) & máy Tập Chơi / Thách Đấu chạy trọn ván không lỗi', () => {
    // Kiểm tra ăn 1 Quan + 3 dân trong chế độ 5đ/Quan -> cộng đúng 5 + 3 = 8đ
    const state5 = buildCustomTestState({
      pitStones: [0, 0, 1, 0, 0, 3, 2, 0, 0, 0, 0, 0],
      mandarinPointValue: 5,
    });
    const beforeScore = state5.players[0].score;
    const { state: afterCap } = executeSowMove(state5, 2, 'CCW');
    expect(afterCap.players[0].capturedQuan).toBe(1);
    expect(afterCap.players[0].score).toBe(beforeScore + 5 + 3);
    assertBoardInvariants(afterCap);

    // Mô phỏng trọn ván chế độ 5đ/Quan giữa Bot Tập Chơi (easy) và Thách Đấu (medium)
    let sim = createInitialOAnQuanState({
      rules: { mandarinPointValue: 5, mandarinYouthRule: false, minStonesForMandarin: 5 },
    });
    let guard = 0;
    while (sim.phase === 'WAITING_MOVE' && guard < 250) {
      guard += 1;
      const move = computeBotMove(sim, sim.currentSide === 0 ? 'easy' : 'medium');
      expect(move).not.toBeNull();
      sim = executeSowMove(sim, move!.pitIndex, move!.direction).state;
      assertBoardInvariants(sim);
    }
    expect(sim.phase).toBe('GAME_OVER');
    const summary = sim.finalSummary!;
    expect(summary.scores[0] + summary.scores[1] + summary.neutralScore).toBe(60);
  });
});
