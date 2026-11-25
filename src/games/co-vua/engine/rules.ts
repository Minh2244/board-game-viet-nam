import type {
  CastlingRights,
  ChessBoard,
  ChessColor,
  ChessMove,
  ChessPiece,
  ChessPieceType,
  ChessPromotionType,
} from './types';

export const CHESS_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export const PIECE_NAME_VI: Record<ChessPieceType, string> = {
  k: 'Vua',
  q: 'Hậu',
  r: 'Xe',
  b: 'Tượng',
  n: 'Mã',
  p: 'Tốt',
};

export const PIECE_MATERIAL: Record<ChessPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const SAN_LETTER: Record<ChessPieceType, string> = {
  k: 'K',
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
  p: '',
};

export function oppositeColor(color: ChessColor): ChessColor {
  return color === 'white' ? 'black' : 'white';
}

export function rcToSq(row: number, col: number): number {
  return row * 8 + col;
}

export function sqToRc(sq: number): { row: number; col: number } {
  return { row: Math.floor(sq / 8), col: sq % 8 };
}

export function sqToAlg(sq: number): string {
  const { row, col } = sqToRc(sq);
  return `${CHESS_FILES[col]}${8 - row}`;
}

export function algToSq(alg: string): number {
  const col = CHESS_FILES.indexOf(alg[0]?.toLowerCase() as (typeof CHESS_FILES)[number]);
  const rank = Number(alg[1]);
  return rcToSq(8 - rank, col);
}

/** Khởi tạo bàn cờ 32 quân chuẩn FIDE (Hậu Trắng d1, Vua Trắng e1; Hậu Đen d8, Vua Đen e8) */
export function createInitialChessBoard(): ChessBoard {
  const board: ChessBoard = new Array<ChessPiece | null>(64).fill(null);
  const backRank: ChessPieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  for (let col = 0; col < 8; col += 1) {
    board[rcToSq(0, col)] = { type: backRank[col], color: 'black' };
    board[rcToSq(1, col)] = { type: 'p', color: 'black' };
    board[rcToSq(6, col)] = { type: 'p', color: 'white' };
    board[rcToSq(7, col)] = { type: backRank[col], color: 'white' };
  }
  return board;
}

export function getPositionHash(
  board: ChessBoard,
  turn: ChessColor,
  castling: CastlingRights,
  enPassantTarget: number | null,
): string {
  let bStr = '';
  for (let i = 0; i < 64; i += 1) {
    const p = board[i];
    if (!p) {
      bStr += '.';
    } else {
      bStr += p.color === 'white' ? p.type.toUpperCase() : p.type;
    }
  }
  const cStr =
    (castling.wK ? 'K' : '') +
    (castling.wQ ? 'Q' : '') +
    (castling.bK ? 'k' : '') +
    (castling.bQ ? 'q' : '');
  // Theo Luật FIDE Điều 9.2: chỉ ghi nhận ô En Passant vào hash lặp 3 lần nếu phe tới lượt thực sự có Tốt đứng cạnh sẵn sàng bắt qua đường
  let effectiveEp: number | null = null;
  if (enPassantTarget !== null) {
    const epRc = sqToRc(enPassantTarget);
    const pawnRow = turn === 'white' ? epRc.row + 1 : epRc.row - 1;
    if (pawnRow >= 0 && pawnRow < 8) {
      for (const dc of [-1, 1]) {
        const c = epRc.col + dc;
        if (c >= 0 && c < 8) {
          const adj = board[rcToSq(pawnRow, c)];
          if (adj && adj.color === turn && adj.type === 'p') {
            effectiveEp = enPassantTarget;
            break;
          }
        }
      }
    }
  }
  return `${bStr}|${turn[0]}|${cStr || '-'}|${effectiveEp ?? '-'}`;
}

export function findKingSquare(board: ChessBoard, color: ChessColor): number {
  for (let i = 0; i < 64; i += 1) {
    const p = board[i];
    if (p && p.color === color && p.type === 'k') return i;
  }
  return -1;
}

/** Kiểm tra ô `sq` có đang bị ít nhất 1 quân của phe `byColor` tấn công hay không */
export function isSquareAttacked(board: ChessBoard, sq: number, byColor: ChessColor): boolean {
  const { row, col } = sqToRc(sq);

  // 1. Tốt tấn công chéo (Tốt Trắng ở hàng dưới row+1 đánh lên; Tốt Đen ở row-1 đánh xuống)
  const pawnSrcRow = byColor === 'white' ? row + 1 : row - 1;
  if (pawnSrcRow >= 0 && pawnSrcRow < 8) {
    for (const dc of [-1, 1]) {
      const c = col + dc;
      if (c >= 0 && c < 8) {
        const p = board[rcToSq(pawnSrcRow, c)];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }
  }

  // 2. Mã chữ L (8 hướng)
  const knightOffsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const [dr, dc] of knightOffsets) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[rcToSq(r, c)];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  // 3. Vua lân cận 8 hướng
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const p = board[rcToSq(r, c)];
        if (p && p.color === byColor && p.type === 'k') return true;
      }
    }
  }

  // 4. Xe / Hậu theo 4 hướng ngang dọc
  const orthoDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of orthoDirs) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[rcToSq(r, c)];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // 5. Tượng / Hậu theo 4 hướng chéo
  const diagDirs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dr, dc] of diagDirs) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[rcToSq(r, c)];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

export function isKingInCheck(board: ChessBoard, color: ChessColor): boolean {
  const kSq = findKingSquare(board, color);
  if (kSq < 0) return false;
  return isSquareAttacked(board, kSq, oppositeColor(color));
}

export interface RawChessMove {
  from: number;
  to: number;
  piece: ChessPieceType;
  color: ChessColor;
  captured?: ChessPieceType;
  promotion?: ChessPromotionType;
  isCastleKing?: boolean;
  isCastleQueen?: boolean;
  isEnPassant?: boolean;
}

/** Áp dụng 1 nước đi lên bản sao bàn cờ + cập nhật quyền nhập thành và ô En Passant */
export function applyMoveToBoard(
  board: ChessBoard,
  move: RawChessMove,
  castling: CastlingRights,
): {
  nextBoard: ChessBoard;
  nextCastling: CastlingRights;
  nextEnPassant: number | null;
} {
  const nextBoard = board.slice();
  const nextCastling = { ...castling };
  let nextEnPassant: number | null = null;

  nextBoard[move.from] = null;

  if (move.isEnPassant) {
    const { row: fromRow } = sqToRc(move.from);
    const { col: toCol } = sqToRc(move.to);
    nextBoard[rcToSq(fromRow, toCol)] = null;
  }

  nextBoard[move.to] = {
    type: move.promotion ?? move.piece,
    color: move.color,
  };

  if (move.isCastleKing) {
    const row = move.color === 'white' ? 7 : 0;
    nextBoard[rcToSq(row, 7)] = null;
    nextBoard[rcToSq(row, 5)] = { type: 'r', color: move.color };
  } else if (move.isCastleQueen) {
    const row = move.color === 'white' ? 7 : 0;
    nextBoard[rcToSq(row, 0)] = null;
    nextBoard[rcToSq(row, 3)] = { type: 'r', color: move.color };
  }

  // Nếu Tốt tiến 2 bước -> đặt ô En Passant ở giữa
  if (move.piece === 'p') {
    const { row: fr } = sqToRc(move.from);
    const { row: tr, col: tc } = sqToRc(move.to);
    if (Math.abs(tr - fr) === 2) {
      nextEnPassant = rcToSq((fr + tr) / 2, tc);
    }
  }

  // Mất quyền nhập thành nếu Vua hoặc Xe di chuyển hoặc bị ăn tại góc
  if (move.piece === 'k') {
    if (move.color === 'white') {
      nextCastling.wK = false;
      nextCastling.wQ = false;
    } else {
      nextCastling.bK = false;
      nextCastling.bQ = false;
    }
  }
  if (move.from === 63 || move.to === 63) nextCastling.wK = false;
  if (move.from === 56 || move.to === 56) nextCastling.wQ = false;
  if (move.from === 7 || move.to === 7) nextCastling.bK = false;
  if (move.from === 0 || move.to === 0) nextCastling.bQ = false;

  return { nextBoard, nextCastling, nextEnPassant };
}

function generatePseudoLegalMoves(
  board: ChessBoard,
  color: ChessColor,
  castling: CastlingRights,
  enPassantTarget: number | null,
): RawChessMove[] {
  const moves: RawChessMove[] = [];
  const enemy = oppositeColor(color);
  const promoPieces: ChessPromotionType[] = ['q', 'r', 'b', 'n'];

  for (let sq = 0; sq < 64; sq += 1) {
    const piece = board[sq];
    if (!piece || piece.color !== color) continue;
    const { row, col } = sqToRc(sq);

    if (piece.type === 'p') {
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;
      const promoRow = color === 'white' ? 0 : 7;

      // Tiến thẳng 1 ô
      const r1 = row + dir;
      if (r1 >= 0 && r1 < 8) {
        const sq1 = rcToSq(r1, col);
        if (!board[sq1]) {
          if (r1 === promoRow) {
            for (const promo of promoPieces) {
              moves.push({ from: sq, to: sq1, piece: 'p', color, promotion: promo });
            }
          } else {
            moves.push({ from: sq, to: sq1, piece: 'p', color });
            // Tiến 2 ô từ hàng xuất phát
            if (row === startRow) {
              const r2 = row + dir * 2;
              const sq2 = rcToSq(r2, col);
              if (!board[sq2]) {
                moves.push({ from: sq, to: sq2, piece: 'p', color });
              }
            }
          }
        }

        // Ăn chéo trái/phải + Bắt Tốt Qua Đường
        for (const dc of [-1, 1]) {
          const tc = col + dc;
          if (tc < 0 || tc >= 8) continue;
          const targetSq = rcToSq(r1, tc);
          const target = board[targetSq];
          if (target && target.color === enemy) {
            if (r1 === promoRow) {
              for (const promo of promoPieces) {
                moves.push({
                  from: sq,
                  to: targetSq,
                  piece: 'p',
                  color,
                  captured: target.type,
                  promotion: promo,
                });
              }
            } else {
              moves.push({ from: sq, to: targetSq, piece: 'p', color, captured: target.type });
            }
          } else if (enPassantTarget !== null && targetSq === enPassantTarget) {
            moves.push({
              from: sq,
              to: targetSq,
              piece: 'p',
              color,
              captured: 'p',
              isEnPassant: true,
            });
          }
        }
      }
      continue;
    }

    if (piece.type === 'n') {
      const offsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
        const to = rcToSq(r, c);
        const target = board[to];
        if (!target || target.color === enemy) {
          moves.push({ from: sq, to, piece: 'n', color, captured: target?.type });
        }
      }
      continue;
    }

    if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
      const dirs: [number, number][] = [];
      if (piece.type === 'r' || piece.type === 'q') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }
      if (piece.type === 'b' || piece.type === 'q') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }
      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const to = rcToSq(r, c);
          const target = board[to];
          if (!target) {
            moves.push({ from: sq, to, piece: piece.type, color });
          } else {
            if (target.color === enemy) {
              moves.push({ from: sq, to, piece: piece.type, color, captured: target.type });
            }
            break;
          }
          r += dr;
          c += dc;
        }
      }
      continue;
    }

    if (piece.type === 'k') {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
          const to = rcToSq(r, c);
          const target = board[to];
          if (!target || target.color === enemy) {
            moves.push({ from: sq, to, piece: 'k', color, captured: target?.type });
          }
        }
      }

      // Nhập thành gần (O-O) & Nhập thành xa (O-O-O) đủ cả 5 điều kiện FIDE!
      const homeRow = color === 'white' ? 7 : 0;
      const kingHomeSq = rcToSq(homeRow, 4);
      if (sq === kingHomeSq && !isSquareAttacked(board, kingHomeSq, enemy)) {
        const canShort = color === 'white' ? castling.wK : castling.bK;
        const canLong = color === 'white' ? castling.wQ : castling.bQ;

        if (canShort) {
          const fSq = rcToSq(homeRow, 5);
          const gSq = rcToSq(homeRow, 6);
          const hRook = board[rcToSq(homeRow, 7)];
          if (
            hRook &&
            hRook.color === color &&
            hRook.type === 'r' &&
            !board[fSq] &&
            !board[gSq] &&
            !isSquareAttacked(board, fSq, enemy) &&
            !isSquareAttacked(board, gSq, enemy)
          ) {
            moves.push({ from: sq, to: gSq, piece: 'k', color, isCastleKing: true });
          }
        }

        if (canLong) {
          const bSq = rcToSq(homeRow, 1);
          const cSq = rcToSq(homeRow, 2);
          const dSq = rcToSq(homeRow, 3);
          const aRook = board[rcToSq(homeRow, 0)];
          if (
            aRook &&
            aRook.color === color &&
            aRook.type === 'r' &&
            !board[bSq] &&
            !board[cSq] &&
            !board[dSq] &&
            !isSquareAttacked(board, dSq, enemy) &&
            !isSquareAttacked(board, cSq, enemy)
          ) {
            moves.push({ from: sq, to: cSq, piece: 'k', color, isCastleQueen: true });
          }
        }
      }
    }
  }

  return moves;
}

/** Sinh nhanh danh sách nước đi hợp lệ (không format SAN — dùng trong vòng lặp tìm kiếm AI Alpha-Beta) */
export function generateLegalRawMoves(
  board: ChessBoard,
  color: ChessColor,
  castling: CastlingRights,
  enPassantTarget: number | null,
): RawChessMove[] {
  const pseudo = generatePseudoLegalMoves(board, color, castling, enPassantTarget);
  const legal: RawChessMove[] = [];
  for (const m of pseudo) {
    const { nextBoard } = applyMoveToBoard(board, m, castling);
    if (!isKingInCheck(nextBoard, color)) {
      legal.push(m);
    }
  }
  return legal;
}

/** Sinh danh sách nước đi hợp lệ đầy đủ kèm ký hiệu chuẩn đại số SAN (e4, Nf3, O-O, e8=Q+, Qh7#) */
export function generateLegalMoves(
  board: ChessBoard,
  color: ChessColor,
  castling: CastlingRights,
  enPassantTarget: number | null,
): ChessMove[] {
  const legalRaw = generateLegalRawMoves(board, color, castling, enPassantTarget);
  const enemy = oppositeColor(color);

  return legalRaw.map((m) => {
    let baseSan = '';
    if (m.isCastleKing) {
      baseSan = 'O-O';
    } else if (m.isCastleQueen) {
      baseSan = 'O-O-O';
    } else {
      const pieceChar = SAN_LETTER[m.piece];
      let disamb = '';
      if (m.piece !== 'p' && m.piece !== 'k') {
        const ambiguous = legalRaw.filter(
          (other) => other.from !== m.from && other.to === m.to && other.piece === m.piece,
        );
        if (ambiguous.length > 0) {
          const fromRc = sqToRc(m.from);
          const sameFile = ambiguous.some((o) => sqToRc(o.from).col === fromRc.col);
          const sameRank = ambiguous.some((o) => sqToRc(o.from).row === fromRc.row);
          if (!sameFile) disamb = CHESS_FILES[fromRc.col];
          else if (!sameRank) disamb = String(8 - fromRc.row);
          else disamb = sqToAlg(m.from);
        }
      }
      const captureChar = m.captured
        ? m.piece === 'p'
          ? `${CHESS_FILES[sqToRc(m.from).col]}x`
          : 'x'
        : '';
      const promoChar = m.promotion ? `=${m.promotion.toUpperCase()}` : '';
      baseSan = `${pieceChar}${disamb}${captureChar}${sqToAlg(m.to)}${promoChar}`;
    }

    const { nextBoard, nextCastling, nextEnPassant } = applyMoveToBoard(board, m, castling);
    const givesCheck = isKingInCheck(nextBoard, enemy);
    let suffix = '';
    if (givesCheck) {
      const enemyReplies = generateLegalRawMoves(nextBoard, enemy, nextCastling, nextEnPassant);
      suffix = enemyReplies.length === 0 ? '#' : '+';
    }

    return { ...m, san: `${baseSan}${suffix}` };
  });
}

/** Kiểm tra hòa do không đủ quân chiếu bí theo luật FIDE */
export function isInsufficientMaterial(board: ChessBoard): boolean {
  const minors: { type: ChessPieceType; color: ChessColor; sqColor: number }[] = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const p = board[sq];
    if (!p || p.type === 'k') continue;
    if (p.type === 'q' || p.type === 'r' || p.type === 'p') return false;
    const { row, col } = sqToRc(sq);
    minors.push({ type: p.type, color: p.color, sqColor: (row + col) % 2 });
  }
  if (minors.length <= 1) return true; // K vs K, K+B vs K, K+N vs K
  if (
    minors.length === 2 &&
    minors[0].type === 'b' &&
    minors[1].type === 'b' &&
    minors[0].color !== minors[1].color &&
    minors[0].sqColor === minors[1].sqColor
  ) {
    return true; // K+B vs K+B cùng màu ô
  }
  return false;
}

/** Tính chênh lệch điểm vật chất hiện tại trên bàn cờ */
export function getMaterialDiff(board: ChessBoard): { whiteAdv: number; blackAdv: number } {
  let w = 0;
  let b = 0;
  for (const p of board) {
    if (!p) continue;
    if (p.color === 'white') w += PIECE_MATERIAL[p.type];
    else b += PIECE_MATERIAL[p.type];
  }
  return {
    whiteAdv: Math.max(0, w - b),
    blackAdv: Math.max(0, b - w),
  };
}
