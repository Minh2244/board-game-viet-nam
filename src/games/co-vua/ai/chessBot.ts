import {
  applyMoveToBoard,
  generateLegalMoves,
  generateLegalRawMoves,
  isKingInCheck,
  oppositeColor,
  PIECE_NAME_VI,
  sqToAlg,
  sqToRc,
  type RawChessMove,
} from '../engine/rules';
import type {
  CastlingRights,
  ChessBoard,
  ChessBotDifficulty,
  ChessColor,
  ChessMove,
  ChessPieceType,
  ChessState,
} from '../engine/types';

export interface ChessHintResult {
  move: ChessMove;
  explanationVi: string;
}

const PIECE_CENTIPAWN: Record<ChessPieceType, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20_000,
};

// Piece-Square Tables (theo góc nhìn Bên Trắng: row 0 = hàng 8, row 7 = hàng 1)
const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  12, 12, 22, 32, 32, 22, 12, 12,
  5, 5, 12, 26, 26, 12, 5, 5,
  0, 0, 4, 24, 24, 4, 0, 0,
  5, -4, -8, 2, 2, -8, -4, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 4, 4, 0, -20, -40,
  -30, 4, 14, 18, 18, 14, 4, -30,
  -30, 5, 18, 22, 22, 18, 5, -30,
  -30, 4, 18, 22, 22, 18, 4, -30,
  -30, 6, 12, 16, 16, 12, 6, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 8, 12, 12, 8, 0, -10,
  -10, 6, 8, 12, 12, 8, 6, -10,
  -10, 0, 12, 12, 12, 12, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 6, 0, 0, 0, 0, 6, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK = [
  0, 0, 2, 4, 4, 2, 0, 0,
  6, 12, 12, 12, 12, 12, 12, 6,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  0, 0, 2, 8, 8, 2, 0, 0,
];

const PST_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 6, 6, 6, 6, 0, -10,
  -5, 0, 6, 8, 8, 6, 0, -5,
  0, 0, 6, 8, 8, 6, 0, -5,
  -10, 5, 6, 6, 6, 6, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

const PST_KING_MID = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 32, 10, 0, 0, 10, 32, 20,
];

function getPstBonus(type: ChessPieceType, sq: number, color: ChessColor): number {
  const { row, col } = sqToRc(sq);
  const idx = color === 'white' ? row * 8 + col : (7 - row) * 8 + col;
  switch (type) {
    case 'p':
      return PST_PAWN[idx];
    case 'n':
      return PST_KNIGHT[idx];
    case 'b':
      return PST_BISHOP[idx];
    case 'r':
      return PST_ROOK[idx];
    case 'q':
      return PST_QUEEN[idx];
    case 'k':
      return PST_KING_MID[idx];
  }
}

function evaluateBoard(board: ChessBoard, perspective: ChessColor): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq += 1) {
    const p = board[sq];
    if (!p) continue;
    const val = PIECE_CENTIPAWN[p.type] + getPstBonus(p.type, sq, p.color);
    score += p.color === perspective ? val : -val;
  }
  return score;
}

function orderMoves(moves: RawChessMove[]): RawChessMove[] {
  return [...moves].sort((a, b) => {
    const scoreOf = (m: RawChessMove) => {
      let s = 0;
      if (m.captured) s += PIECE_CENTIPAWN[m.captured] * 10 - PIECE_CENTIPAWN[m.piece];
      if (m.promotion) s += PIECE_CENTIPAWN[m.promotion] * 8;
      if (m.isCastleKing || m.isCastleQueen) s += 80;
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
}

function negamax(
  board: ChessBoard,
  turn: ChessColor,
  castling: CastlingRights,
  enPassantTarget: number | null,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = generateLegalRawMoves(board, turn, castling, enPassantTarget);
  if (moves.length === 0) {
    if (isKingInCheck(board, turn)) {
      return -90_000 - depth * 100; // Chiếu bí sớm ưu tiên hơn
    }
    return 0; // Hòa Pat
  }
  if (depth <= 0) {
    return evaluateBoard(board, turn);
  }

  let best = -Infinity;
  const ordered = orderMoves(moves);

  for (const m of ordered) {
    const { nextBoard, nextCastling, nextEnPassant } = applyMoveToBoard(board, m, castling);
    const val = -negamax(
      nextBoard,
      oppositeColor(turn),
      nextCastling,
      nextEnPassant,
      depth - 1,
      -beta,
      -alpha,
    );
    if (val > best) best = val;
    if (val > alpha) alpha = val;
    if (alpha >= beta) break;
  }
  return best;
}

export function computeChessBotMove(
  state: ChessState,
  difficulty: ChessBotDifficulty,
): ChessMove | null {
  const legalMoves = generateLegalMoves(
    state.board,
    state.turn,
    state.castling,
    state.enPassantTarget,
  );
  if (legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  // Luôn bắt lấy nước Chiếu Bí ngay ở mọi cấp độ!
  const mateInOne = legalMoves.find((m) => m.san.endsWith('#'));
  if (mateInOne) return mateInOne;

  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const noiseAmp = difficulty === 'easy' ? 130 : difficulty === 'medium' ? 24 : 4;

  const scored: { move: ChessMove; score: number }[] = [];
  for (const m of legalMoves) {
    // Tránh phong cấp quân yếu trừ khi là nước duy nhất
    if (m.promotion && m.promotion !== 'q' && m.promotion !== 'n') continue;
    const { nextBoard, nextCastling, nextEnPassant } = applyMoveToBoard(
      state.board,
      m,
      state.castling,
    );
    const val =
      -negamax(
        nextBoard,
        oppositeColor(state.turn),
        nextCastling,
        nextEnPassant,
        depth - 1,
        -100_000,
        100_000,
      ) +
      (Math.random() - 0.5) * noiseAmp;
    scored.push({ move: m, score: val });
  }

  scored.sort((a, b) => b.score - a.score);
  return (scored[0]?.move ?? legalMoves[0]) as ChessMove;
}

export function computeChessHint(state: ChessState): ChessHintResult | null {
  const best = computeChessBotMove(state, 'hard');
  if (!best) return null;

  const pieceName = PIECE_NAME_VI[best.piece];
  const dest = sqToAlg(best.to).toUpperCase();
  let explanationVi = `Đi ${pieceName} tới ô ${dest} (${best.san}) để cải thiện thế trận và kiểm soát trung tâm.`;

  if (best.san.endsWith('#')) {
    explanationVi = `Đi ${pieceName} tới ${dest} (${best.san}) để CHIẾU BÍ và chiến thắng ngay lập tức!`;
  } else if (best.isCastleKing || best.isCastleQueen) {
    explanationVi = `Nhập thành (${best.san}) để đưa Vua vào vị trí an toàn và kết nối Xe!`;
  } else if (best.promotion) {
    explanationVi = `Đẩy Tốt lên ${dest} phong ${PIECE_NAME_VI[best.promotion]} (${best.san}) tạo ưu thế áp đảo!`;
  } else if (best.captured && best.san.endsWith('+')) {
    explanationVi = `Dùng ${pieceName} ăn ${PIECE_NAME_VI[best.captured]} tại ${dest} đồng thời CHIẾU Vua đối phương!`;
  } else if (best.captured) {
    explanationVi = `Dùng ${pieceName} ăn ${PIECE_NAME_VI[best.captured]} tại ${dest} (${best.san}) giành lợi thế quân!`;
  } else if (best.san.endsWith('+')) {
    explanationVi = `Đưa ${pieceName} tới ${dest} (${best.san}) để CHIẾU Vua và gây áp lực mạnh!`;
  }

  return { move: best, explanationVi };
}
