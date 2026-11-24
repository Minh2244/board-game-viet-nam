import { describe, expect, it } from 'vitest';
import { computeXiangqiBotMove, computeXiangqiHint } from '../ai/xiangqiBot';
import { createInitialXiangqiState, reduceXiangqiAction } from '../engine/reducer';
import {
  areGeneralsFacing,
  generateLegalXiangqiMoves,
  rcToIdx,
} from '../engine/rules';
import type { XiangqiBoard, XiangqiState } from '../engine/types';

function makeGame(): XiangqiState {
  return createInitialXiangqiState({
    redName: 'Đỏ',
    redIsBot: false,
    greenName: 'Xanh',
    greenIsBot: false,
  });
}

function emptyBoard(): XiangqiBoard {
  return new Array(90).fill(null);
}

describe('Cờ Tướng Truyền Thống (Đỏ – Xanh) — Bộ Kiểm Thử Luật & AI', () => {
  it('01. Khởi tạo đúng 32 quân trên 90 giao điểm & đúng 44 nước mở màn cho Bên Đỏ', () => {
    const st = makeGame();
    expect(st.board).toHaveLength(90);
    expect(st.board.filter(Boolean)).toHaveLength(32);
    expect(st.board[rcToIdx(9, 4)]).toEqual({ type: 'k', color: 'red' });
    expect(st.board[rcToIdx(0, 4)]).toEqual({ type: 'k', color: 'green' });
    expect(areGeneralsFacing(st.board)).toBe(false);

    const opening = generateLegalXiangqiMoves(st.board, 'red');
    expect(opening).toHaveLength(44);
  });

  it('02. Luật Lộ Mặt Tướng: cấm Tướng đối mặt & cấm rút quân chắn giữa 2 Tướng', () => {
    const b = emptyBoard();
    b[rcToIdx(9, 4)] = { type: 'k', color: 'red' };
    b[rcToIdx(0, 4)] = { type: 'k', color: 'green' };
    b[rcToIdx(5, 4)] = { type: 'r', color: 'red' }; // Quân duy nhất chắn giữa 2 Tướng

    const rookMoves = generateLegalXiangqiMoves(b, 'red').filter((m) => m.from === rcToIdx(5, 4));
    // Xe Đỏ ở (5,4) CHỈ được đi dọc cột 4, cấm đi ngang làm lộ mặt 2 Tướng!
    expect(rookMoves.every((m) => m.to % 9 === 4)).toBe(true);
    expect(rookMoves.some((m) => m.to === rcToIdx(5, 3))).toBe(false);

    // Tướng Đỏ ở (9,3) cũng cấm bước sang (9,4) đối mặt Tướng Xanh ở (0,4)
    const b2 = emptyBoard();
    b2[rcToIdx(9, 3)] = { type: 'k', color: 'red' };
    b2[rcToIdx(0, 4)] = { type: 'k', color: 'green' };
    const kingMoves = generateLegalXiangqiMoves(b2, 'red');
    expect(kingMoves.some((m) => m.to === rcToIdx(9, 4))).toBe(false);
  });

  it('03. Cản chân Mã (Blocked Horse Leg): bị quân bất kỳ đứng sát chặn không thể nhảy', () => {
    const b = emptyBoard();
    b[rcToIdx(9, 3)] = { type: 'k', color: 'red' };
    b[rcToIdx(0, 5)] = { type: 'k', color: 'green' };
    b[rcToIdx(5, 4)] = { type: 'n', color: 'red' };
    b[rcToIdx(4, 4)] = { type: 'p', color: 'green' }; // Cản chân Mã phía trên!

    const nMoves = generateLegalXiangqiMoves(b, 'red').filter((m) => m.from === rcToIdx(5, 4));
    // Bị chặn 2 hướng nhảy lên (3,3) và (3,5), vẫn còn 6 hướng còn lại
    expect(nMoves.some((m) => m.to === rcToIdx(3, 3))).toBe(false);
    expect(nMoves.some((m) => m.to === rcToIdx(3, 5))).toBe(false);
    expect(nMoves).toHaveLength(6);
  });

  it('04. Cản mắt Tượng & Cấm Tượng qua sông', () => {
    const b = emptyBoard();
    b[rcToIdx(9, 3)] = { type: 'k', color: 'red' };
    b[rcToIdx(0, 5)] = { type: 'k', color: 'green' };
    b[rcToIdx(5, 4)] = { type: 'e', color: 'red' }; // Tượng Đỏ ngay bờ sông
    b[rcToIdx(6, 3)] = { type: 'p', color: 'red' }; // Cản mắt chéo dưới-trái

    const eMoves = generateLegalXiangqiMoves(b, 'red').filter((m) => m.from === rcToIdx(5, 4));
    // Không thể đi lên (3,2) / (3,6) vì qua sông; không thể xuống (7,2) vì cản mắt (6,3); chỉ đi được (7,6)!
    expect(eMoves.map((m) => m.to)).toEqual([rcToIdx(7, 6)]);
  });

  it('05. Luật Ngòi Pháo: đi thường không nhảy; ăn quân phải nhảy đúng 1 ngòi (0 hoặc >=2 quân đều cấm)', () => {
    const b = emptyBoard();
    b[rcToIdx(9, 3)] = { type: 'k', color: 'red' };
    b[rcToIdx(0, 5)] = { type: 'k', color: 'green' };
    b[rcToIdx(7, 1)] = { type: 'c', color: 'red' };
    b[rcToIdx(5, 1)] = { type: 'p', color: 'red' }; // Ngòi 1
    b[rcToIdx(2, 1)] = { type: 'r', color: 'green' }; // Mục tiêu sau đúng 1 ngòi -> ĂN ĐƯỢC!
    b[rcToIdx(0, 1)] = { type: 'n', color: 'green' }; // Sau 2 quân -> KHÔNG ĐƯỢC ĂN!
    b[rcToIdx(7, 4)] = { type: 'p', color: 'green' }; // Không có ngòi chắn ngang -> KHÔNG ĐƯỢC ĂN!

    const cMoves = generateLegalXiangqiMoves(b, 'red').filter((m) => m.from === rcToIdx(7, 1));
    expect(cMoves.some((m) => m.to === rcToIdx(2, 1) && m.captured === 'r')).toBe(true);
    expect(cMoves.some((m) => m.to === rcToIdx(0, 1))).toBe(false);
    expect(cMoves.some((m) => m.to === rcToIdx(7, 4))).toBe(false);
  });

  it('06. Tốt chưa qua sông chỉ đi thẳng; qua sông được đi thẳng + đi ngang, cấm đi lùi', () => {
    const b = emptyBoard();
    b[rcToIdx(9, 3)] = { type: 'k', color: 'red' };
    b[rcToIdx(0, 5)] = { type: 'k', color: 'green' };
    b[rcToIdx(6, 2)] = { type: 'p', color: 'red' }; // Chưa qua sông
    b[rcToIdx(4, 6)] = { type: 'p', color: 'red' }; // Đã qua sông

    const pBefore = generateLegalXiangqiMoves(b, 'red').filter((m) => m.from === rcToIdx(6, 2));
    expect(pBefore.map((m) => m.to)).toEqual([rcToIdx(5, 2)]);

    const pAfter = generateLegalXiangqiMoves(b, 'red').filter((m) => m.from === rcToIdx(4, 6));
    expect(pAfter.map((m) => m.to).sort()).toEqual(
      [rcToIdx(3, 6), rcToIdx(4, 5), rcToIdx(4, 7)].sort(),
    );
  });

  it('07. Chiếu Bí (Checkmate) & Khốn Bí (Hết nước đi -> THUA theo chuẩn Cờ Tướng) & AI Tìm Tuyệt Sát', () => {
    const st = makeGame();
    const b = emptyBoard();
    b[rcToIdx(0, 4)] = { type: 'k', color: 'green' };
    b[rcToIdx(9, 4)] = { type: 'k', color: 'red' }; // Trợ công chiếu mặt Tướng!
    b[rcToIdx(1, 0)] = { type: 'r', color: 'red' }; // Xe Đỏ bình 5 chiếu bí? Không, cột 4 có Tướng -> đặt Xe ở (2,3) tấn (0,3)
    b[rcToIdx(2, 3)] = { type: 'r', color: 'red' };
    b[rcToIdx(0, 5)] = { type: 'a', color: 'green' }; // Tự cản mặt phải
    b[rcToIdx(1, 4)] = { type: 'a', color: 'green' }; // Chắn giữa 2 Tướng, khi Xe Đỏ ăn hoặc chiếu góc
    // Dùng thế chiếu bí sạch 100%: Tướng Xanh (0,3), Tướng Đỏ (9,4), Xe Đỏ (2,3) chắn? Đặt Tướng Xanh (0,3), Xe Đỏ (1,8) -> (1,3) chiếu bí kết hợp Xe (0,8)
    const bMate = emptyBoard();
    bMate[rcToIdx(0, 3)] = { type: 'k', color: 'green' };
    bMate[rcToIdx(9, 5)] = { type: 'k', color: 'red' };
    bMate[rcToIdx(1, 0)] = { type: 'r', color: 'red' }; // Khóa hàng 1
    bMate[rcToIdx(2, 8)] = { type: 'r', color: 'red' }; // Lên (0,8) chiếu bí hàng 0!
    st.board = bMate;

    const best = computeXiangqiBotMove(st, 'hard');
    expect(best?.from).toBe(rcToIdx(2, 8));
    expect(best?.to).toBe(rcToIdx(0, 8));

    const hint = computeXiangqiHint(st);
    expect(hint?.explanationVi).toContain('CHIẾU BÍ');

    const mated = reduceXiangqiAction(st, { type: 'MOVE', from: rcToIdx(2, 8), to: rcToIdx(0, 8) });
    expect(mated.phase).toBe('GAME_OVER');
    expect(mated.winner).toBe('red');
    expect(mated.endReason).toBe('CHECKMATE');

    // Khốn bí (không bị chiếu nhưng hết nước đi -> vẫn THUA trong Cờ Tướng!)
    const stStale = makeGame();
    const bStale = emptyBoard();
    bStale[rcToIdx(0, 3)] = { type: 'k', color: 'green' };
    bStale[rcToIdx(9, 4)] = { type: 'k', color: 'red' }; // Khóa cột 4 (lộ mặt Tướng!)
    bStale[rcToIdx(2, 1)] = { type: 'r', color: 'red' }; // Tiến lên (1,1) khóa hàng 1 -> Tướng Xanh (0,3) không bị chiếu nhưng không còn nước đi!
    stStale.board = bStale;
    const staled = reduceXiangqiAction(stStale, { type: 'MOVE', from: rcToIdx(2, 1), to: rcToIdx(1, 1) });
    expect(staled.phase).toBe('GAME_OVER');
    expect(staled.winner).toBe('red');
    expect(staled.endReason).toBe('STALEMATE_LOSS');
  });
});
