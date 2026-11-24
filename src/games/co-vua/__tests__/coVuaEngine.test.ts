import { describe, expect, it } from 'vitest';
import { computeChessBotMove, computeChessHint } from '../ai/chessBot';
import { createInitialChessState, reduceChessAction } from '../engine/reducer';
import { algToSq, generateLegalMoves, isInsufficientMaterial } from '../engine/rules';
import type { ChessBoard, ChessState } from '../engine/types';

function makeGame(): ChessState {
  return createInitialChessState({
    whiteName: 'Trắng',
    whiteIsBot: false,
    blackName: 'Đen',
    blackIsBot: false,
  });
}

function play(state: ChessState, fromAlg: string, toAlg: string, promotion?: 'q' | 'r' | 'b' | 'n'): ChessState {
  return reduceChessAction(state, {
    type: 'MOVE',
    from: algToSq(fromAlg),
    to: algToSq(toAlg),
    promotion,
  });
}

describe('Cờ Vua Cổ Điển FIDE — Bộ Kiểm Thử Engine & AI', () => {
  it('01. Khởi tạo 32 quân chuẩn (Hậu d1/d8, Vua e1/e8) & đúng 20 nước đi mở màn cho Trắng', () => {
    const st = makeGame();
    expect(st.board[algToSq('d1')]).toEqual({ type: 'q', color: 'white' });
    expect(st.board[algToSq('e1')]).toEqual({ type: 'k', color: 'white' });
    expect(st.board[algToSq('d8')]).toEqual({ type: 'q', color: 'black' });
    expect(st.board[algToSq('e8')]).toEqual({ type: 'k', color: 'black' });

    const openingMoves = generateLegalMoves(st.board, 'white', st.castling, st.enPassantTarget);
    expect(openingMoves).toHaveLength(20);
  });

  it('02. Chiếu Bí Scholar Mate 4 nước (Qh5 + Bc4 -> Qxf7#) kết thúc thắng ngay cho Trắng', () => {
    let st = makeGame();
    st = play(st, 'e2', 'e4');
    st = play(st, 'e7', 'e5');
    st = play(st, 'd1', 'h5');
    st = play(st, 'b8', 'c6');
    st = play(st, 'f1', 'c4');
    st = play(st, 'g8', 'f6');
    st = play(st, 'h5', 'f7');

    expect(st.phase).toBe('GAME_OVER');
    expect(st.winner).toBe('white');
    expect(st.endReason).toBe('CHECKMATE');
    expect(st.lastMove?.san).toBe('Qxf7#');
  });

  it('03. Cấm quân bị ghim (Pin) rời khỏi đường chiếu Vua', () => {
    const st = makeGame();
    const empty: ChessBoard = new Array(64).fill(null);
    empty[algToSq('e1')] = { type: 'k', color: 'white' };
    empty[algToSq('e2')] = { type: 'r', color: 'white' }; // Bị ghim bởi Xe Đen e8!
    empty[algToSq('e8')] = { type: 'r', color: 'black' };
    empty[algToSq('a8')] = { type: 'k', color: 'black' };
    st.board = empty;
    st.castling = { wK: false, wQ: false, bK: false, bQ: false };

    const rookMoves = generateLegalMoves(st.board, 'white', st.castling, null).filter(
      (m) => m.from === algToSq('e2'),
    );
    // Xe e2 chỉ được đi dọc cột E, tuyệt đối không được đi ngang sang d2/f2!
    expect(rookMoves.every((m) => m.to % 8 === 4)).toBe(true);
    expect(rookMoves.some((m) => m.to === algToSq('d2'))).toBe(false);
  });

  it('04. Nhập thành gần (O-O) & xa (O-O-O), cấm khi Vua đi qua ô bị khống chế', () => {
    const st = makeGame();
    const b: ChessBoard = new Array(64).fill(null);
    b[algToSq('e1')] = { type: 'k', color: 'white' };
    b[algToSq('h1')] = { type: 'r', color: 'white' };
    b[algToSq('a1')] = { type: 'r', color: 'white' };
    b[algToSq('e8')] = { type: 'k', color: 'black' };
    st.board = b;

    const movesFree = generateLegalMoves(st.board, 'white', st.castling, null);
    expect(movesFree.some((m) => m.isCastleKing)).toBe(true);
    expect(movesFree.some((m) => m.isCastleQueen)).toBe(true);

    // Đặt Xe Đen ở f8 khống chế f1 -> cấm nhập thành gần O-O, vẫn cho nhập thành xa O-O-O
    st.board[algToSq('f8')] = { type: 'r', color: 'black' };
    const movesBlocked = generateLegalMoves(st.board, 'white', st.castling, null);
    expect(movesBlocked.some((m) => m.isCastleKing)).toBe(false);
    expect(movesBlocked.some((m) => m.isCastleQueen)).toBe(true);

    const castled = play(st, 'e1', 'c1');
    expect(castled.board[algToSq('c1')]?.type).toBe('k');
    expect(castled.board[algToSq('d1')]?.type).toBe('r');
    expect(castled.lastMove?.san).toBe('O-O-O');
  });

  it('05. Bắt Tốt Qua Đường (En Passant) hợp lệ đúng 1 lượt kế tiếp', () => {
    let st = makeGame();
    st = play(st, 'e2', 'e4');
    st = play(st, 'a7', 'a6');
    st = play(st, 'e4', 'e5');
    st = play(st, 'd7', 'd5'); // Tốt Đen đi 2 ô cạnh Tốt Trắng e5

    expect(st.enPassantTarget).toBe(algToSq('d6'));
    const ep = play(st, 'e5', 'd6');
    expect(ep.board[algToSq('d6')]?.type).toBe('p');
    expect(ep.board[algToSq('d5')]).toBeNull(); // Tốt Đen d5 bị ăn mất!
    expect(ep.capturedByWhite).toContain('p');
  });

  it('06. Phong Cấp Tốt (Pawn Promotion) thành Hậu hoặc Mã', () => {
    const st = makeGame();
    const b: ChessBoard = new Array(64).fill(null);
    b[algToSq('a7')] = { type: 'p', color: 'white' };
    b[algToSq('e1')] = { type: 'k', color: 'white' };
    b[algToSq('h8')] = { type: 'k', color: 'black' };
    st.board = b;
    st.castling = { wK: false, wQ: false, bK: false, bQ: false };

    const promotedQ = play(st, 'a7', 'a8', 'q');
    expect(promotedQ.board[algToSq('a8')]).toEqual({ type: 'q', color: 'white' });
    expect(promotedQ.lastMove?.san).toContain('=Q');

    const promotedN = play(st, 'a7', 'a8', 'n');
    expect(promotedN.board[algToSq('a8')]).toEqual({ type: 'n', color: 'white' });
  });

  it('07. Hòa Pat (Stalemate) & Hòa thiếu quân (Insufficient Material)', () => {
    const st = makeGame();
    const b: ChessBoard = new Array(64).fill(null);
    b[algToSq('h8')] = { type: 'k', color: 'black' };
    b[algToSq('f7')] = { type: 'k', color: 'white' };
    b[algToSq('g5')] = { type: 'q', color: 'white' };
    st.board = b;
    st.castling = { wK: false, wQ: false, bK: false, bQ: false };

    // Hậu g5 -> g6 khiến Vua Đen h8 không bị chiếu nhưng hết nước đi -> Hòa Pat!
    const stalemated = play(st, 'g5', 'g6');
    expect(stalemated.phase).toBe('GAME_OVER');
    expect(stalemated.winner).toBe('DRAW');
    expect(stalemated.endReason).toBe('STALEMATE');

    const minimal: ChessBoard = new Array(64).fill(null);
    minimal[algToSq('e1')] = { type: 'k', color: 'white' };
    minimal[algToSq('c1')] = { type: 'b', color: 'white' };
    minimal[algToSq('e8')] = { type: 'k', color: 'black' };
    expect(isInsufficientMaterial(minimal)).toBe(true);
  });

  it('08. Hòa Lặp Thế 3 Lần (Threefold Repetition) & Hoàn Tác (Undo)', () => {
    let st = makeGame();
    for (let i = 0; i < 2; i += 1) {
      st = play(st, 'g1', 'f3');
      st = play(st, 'g8', 'f6');
      st = play(st, 'f3', 'g1');
      st = play(st, 'f6', 'g8');
    }
    expect(st.phase).toBe('GAME_OVER');
    expect(st.winner).toBe('DRAW');
    expect(st.endReason).toBe('THREEFOLD_REPETITION');

    const undone = reduceChessAction(st, { type: 'UNDO', plies: 1 });
    expect(undone.phase).toBe('PLAYING');
    expect(undone.winner).toBeNull();
  });

  it('09. AI Alpha-Beta & Gợi ý tìm ra nước Chiếu Bí 1 nước ngay lập tức', () => {
    const st = makeGame();
    const b: ChessBoard = new Array(64).fill(null);
    b[algToSq('h8')] = { type: 'k', color: 'black' };
    b[algToSq('g7')] = { type: 'p', color: 'black' };
    b[algToSq('h7')] = { type: 'p', color: 'black' };
    b[algToSq('a1')] = { type: 'r', color: 'white' };
    b[algToSq('e1')] = { type: 'k', color: 'white' };
    st.board = b;
    st.castling = { wK: false, wQ: false, bK: false, bQ: false };

    const best = computeChessBotMove(st, 'hard');
    expect(best?.to).toBe(algToSq('a8'));
    expect(best?.san).toBe('Ra8#');

    const hint = computeChessHint(st);
    expect(hint?.move.to).toBe(algToSq('a8'));
    expect(hint?.explanationVi).toContain('CHIẾU BÍ');
  });
});
