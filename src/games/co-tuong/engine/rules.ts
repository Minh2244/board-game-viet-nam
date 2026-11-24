import type {
  XiangqiBoard,
  XiangqiColor,
  XiangqiMove,
  XiangqiPiece,
  XiangqiPieceType,
} from './types';

export const XIANGQI_COLS = 9;
export const XIANGQI_ROWS = 10;

export const XIANGQI_HANZI: Record<XiangqiColor, Record<XiangqiPieceType, string>> = {
  red: {
    k: '帥',
    a: '仕',
    e: '相',
    r: '俥',
    c: '炮',
    n: '傌',
    p: '兵',
  },
  green: {
    k: '將',
    a: '士',
    e: '象',
    r: '車',
    c: '砲',
    n: '馬',
    p: '卒',
  },
};

export const XIANGQI_NAME_VI: Record<XiangqiPieceType, string> = {
  k: 'Tướng',
  a: 'Sĩ',
  e: 'Tượng',
  r: 'Xe',
  c: 'Pháo',
  n: 'Mã',
  p: 'Tốt',
};

export function oppositeXiangqiColor(color: XiangqiColor): XiangqiColor {
  return color === 'red' ? 'green' : 'red';
}

export function rcToIdx(row: number, col: number): number {
  return row * XIANGQI_COLS + col;
}

export function idxToRc(idx: number): { row: number; col: number } {
  return { row: Math.floor(idx / XIANGQI_COLS), col: idx % XIANGQI_COLS };
}

export function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < XIANGQI_ROWS && col >= 0 && col < XIANGQI_COLS;
}

export function isInsidePalace(color: XiangqiColor, row: number, col: number): boolean {
  if (col < 3 || col > 5) return false;
  return color === 'red' ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
}

export function hasCrossedRiver(color: XiangqiColor, row: number): boolean {
  return color === 'red' ? row <= 4 : row >= 5;
}

/** Khởi tạo chuẩn 32 quân trên 90 giao điểm (Xanh ở hàng 0..4, Đỏ ở hàng 5..9) */
export function createInitialXiangqiBoard(): XiangqiBoard {
  const b: XiangqiBoard = new Array<XiangqiPiece | null>(90).fill(null);
  const back: XiangqiPieceType[] = ['r', 'n', 'e', 'a', 'k', 'a', 'e', 'n', 'r'];

  for (let col = 0; col < 9; col += 1) {
    b[rcToIdx(0, col)] = { type: back[col], color: 'green' };
    b[rcToIdx(9, col)] = { type: back[col], color: 'red' };
  }

  // 2 Pháo mỗi bên
  b[rcToIdx(2, 1)] = { type: 'c', color: 'green' };
  b[rcToIdx(2, 7)] = { type: 'c', color: 'green' };
  b[rcToIdx(7, 1)] = { type: 'c', color: 'red' };
  b[rcToIdx(7, 7)] = { type: 'c', color: 'red' };

  // 5 Tốt mỗi bên tại cột 0, 2, 4, 6, 8
  for (const col of [0, 2, 4, 6, 8]) {
    b[rcToIdx(3, col)] = { type: 'p', color: 'green' };
    b[rcToIdx(6, col)] = { type: 'p', color: 'red' };
  }

  return b;
}

export function getXiangqiPositionHash(board: XiangqiBoard, turn: XiangqiColor): string {
  let s = '';
  for (let i = 0; i < 90; i += 1) {
    const p = board[i];
    if (!p) s += '.';
    else s += p.color === 'red' ? p.type.toUpperCase() : p.type;
  }
  return `${s}|${turn[0]}`;
}

export function findGeneralIdx(board: XiangqiBoard, color: XiangqiColor): number {
  const rStart = color === 'red' ? 7 : 0;
  const rEnd = color === 'red' ? 9 : 2;
  for (let r = rStart; r <= rEnd; r += 1) {
    for (let c = 3; c <= 5; c += 1) {
      const idx = rcToIdx(r, c);
      const p = board[idx];
      if (p && p.color === color && p.type === 'k') return idx;
    }
  }
  // Fallback quét toàn bàn nếu test tùy biến đặt Tướng
  for (let i = 0; i < 90; i += 1) {
    const p = board[i];
    if (p && p.color === color && p.type === 'k') return i;
  }
  return -1;
}

/** Kiểm tra Luật Lộ Mặt Tướng: 2 Tướng cùng cột dọc và không có bất kỳ quân nào chắn giữa */
export function areGeneralsFacing(board: XiangqiBoard): boolean {
  const redK = findGeneralIdx(board, 'red');
  const greenK = findGeneralIdx(board, 'green');
  if (redK < 0 || greenK < 0) return false;

  const rRc = idxToRc(redK);
  const gRc = idxToRc(greenK);
  if (rRc.col !== gRc.col) return false;

  const minR = Math.min(rRc.row, gRc.row);
  const maxR = Math.max(rRc.row, gRc.row);
  for (let r = minR + 1; r < maxR; r += 1) {
    if (board[rcToIdx(r, rRc.col)] !== null) return false;
  }
  return true;
}

/** Kiểm tra Tướng của `color` có đang bị quân đối phương chiếu hay không */
export function isGeneralInCheck(board: XiangqiBoard, color: XiangqiColor): boolean {
  const kIdx = findGeneralIdx(board, color);
  if (kIdx < 0) return false;
  const enemy = oppositeXiangqiColor(color);
  const { row: kr, col: kc } = idxToRc(kIdx);

  // 1. Kiểm tra Lộ Mặt Tướng (cũng tính là bị Tướng địch khống chế)
  if (areGeneralsFacing(board)) return true;

  // 2. Kiểm tra Xe & Pháo theo 4 tia ngang dọc
  const ortho = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of ortho) {
    let r = kr + dr;
    let c = kc + dc;
    let screens = 0;
    while (isInsideBoard(r, c)) {
      const p = board[rcToIdx(r, c)];
      if (p) {
        if (screens === 0) {
          if (p.color === enemy && p.type === 'r') return true;
          screens = 1;
        } else {
          if (p.color === enemy && p.type === 'c') return true;
          break;
        }
      }
      r += dr;
      c += dc;
    }
  }

  // 3. Kiểm tra Mã địch tấn công tới (kr, kc) — lưu ý chân Mã nằm sát phía quân Mã!
  const horseChecks: [number, number, number, number][] = [
    // [drFromKing, dcFromKing, drLegFromKing, dcLegFromKing]
    [-2, -1, -1, -1],
    [-2, 1, -1, 1],
    [2, -1, 1, -1],
    [2, 1, 1, 1],
    [-1, -2, -1, -1],
    [1, -2, 1, -1],
    [-1, 2, -1, 1],
    [1, 2, 1, 1],
  ];
  for (const [dr, dc, lr, lc] of horseChecks) {
    const nr = kr + dr;
    const nc = kc + dc;
    if (!isInsideBoard(nr, nc)) continue;
    const p = board[rcToIdx(nr, nc)];
    if (p && p.color === enemy && p.type === 'n') {
      // Giao điểm chân Mã (liền kề quân Mã theo chiều dài chữ L) phải trống!
      if (board[rcToIdx(kr + lr, kc + lc)] === null) return true;
    }
  }

  // 4. Kiểm tra Tốt địch tấn công (từ phía trước mặt Tướng hoặc hai bên ngang khi Tốt đã qua sông)
  const enemyPawnFromRow = color === 'red' ? kr - 1 : kr + 1;
  if (isInsideBoard(enemyPawnFromRow, kc)) {
    const p = board[rcToIdx(enemyPawnFromRow, kc)];
    if (p && p.color === enemy && p.type === 'p') return true;
  }
  for (const dc of [-1, 1]) {
    const nc = kc + dc;
    if (isInsideBoard(kr, nc)) {
      const p = board[rcToIdx(kr, nc)];
      if (p && p.color === enemy && p.type === 'p' && hasCrossedRiver(enemy, kr)) {
        return true;
      }
    }
  }

  return false;
}

export interface RawXiangqiMove {
  from: number;
  to: number;
  piece: XiangqiPieceType;
  color: XiangqiColor;
  captured?: XiangqiPieceType;
}

export function applyXiangqiMoveToBoard(board: XiangqiBoard, move: RawXiangqiMove): XiangqiBoard {
  const next = board.slice();
  next[move.to] = next[move.from];
  next[move.from] = null;
  return next;
}

function generatePseudoXiangqiMoves(board: XiangqiBoard, color: XiangqiColor): RawXiangqiMove[] {
  const moves: RawXiangqiMove[] = [];
  const enemy = oppositeXiangqiColor(color);

  for (let idx = 0; idx < 90; idx += 1) {
    const p = board[idx];
    if (!p || p.color !== color) continue;
    const { row, col } = idxToRc(idx);

    if (p.type === 'k') {
      // Tướng: đi ngang/dọc 1 ô trong Cung 3×3
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = row + dr;
        const nc = col + dc;
        if (!isInsidePalace(color, nr, nc)) continue;
        const to = rcToIdx(nr, nc);
        const target = board[to];
        if (!target || target.color === enemy) {
          moves.push({ from: idx, to, piece: 'k', color, captured: target?.type });
        }
      }
      continue;
    }

    if (p.type === 'a') {
      // Sĩ: đi chéo 1 ô trong Cung 3×3
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        const nr = row + dr;
        const nc = col + dc;
        if (!isInsidePalace(color, nr, nc)) continue;
        const to = rcToIdx(nr, nc);
        const target = board[to];
        if (!target || target.color === enemy) {
          moves.push({ from: idx, to, piece: 'a', color, captured: target?.type });
        }
      }
      continue;
    }

    if (p.type === 'e') {
      // Tượng: đi chéo 2 ô, KHÔNG qua sông, kiểm tra CẢN MẮT TƯỢNG
      for (const [dr, dc] of [
        [-2, -2],
        [-2, 2],
        [2, -2],
        [2, 2],
      ]) {
        const nr = row + dr;
        const nc = col + dc;
        if (!isInsideBoard(nr, nc)) continue;
        // Cấm qua sông
        if (color === 'red' && nr < 5) continue;
        if (color === 'green' && nr > 4) continue;
        // Kiểm tra mắt Tượng ở chính giữa
        const eyeIdx = rcToIdx(row + dr / 2, col + dc / 2);
        if (board[eyeIdx] !== null) continue;
        const to = rcToIdx(nr, nc);
        const target = board[to];
        if (!target || target.color === enemy) {
          moves.push({ from: idx, to, piece: 'e', color, captured: target?.type });
        }
      }
      continue;
    }

    if (p.type === 'r') {
      // Xe: đi ngang/dọc tự do, không nhảy quân
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        let nr = row + dr;
        let nc = col + dc;
        while (isInsideBoard(nr, nc)) {
          const to = rcToIdx(nr, nc);
          const target = board[to];
          if (!target) {
            moves.push({ from: idx, to, piece: 'r', color });
          } else {
            if (target.color === enemy) {
              moves.push({ from: idx, to, piece: 'r', color, captured: target.type });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
      continue;
    }

    if (p.type === 'c') {
      // Pháo: đi thường như Xe; ăn quân BẮT BUỘC nhảy qua chính xác 1 ngòi Pháo!
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        let nr = row + dr;
        let nc = col + dc;
        let jumped = false;
        while (isInsideBoard(nr, nc)) {
          const to = rcToIdx(nr, nc);
          const target = board[to];
          if (!jumped) {
            if (!target) {
              moves.push({ from: idx, to, piece: 'c', color });
            } else {
              // Gặp quân đầu tiên -> làm ngòi Pháo!
              jumped = true;
            }
          } else if (target) {
            if (target.color === enemy) {
              moves.push({ from: idx, to, piece: 'c', color, captured: target.type });
            }
            break; // Không được nhảy qua quân thứ 2
          }
          nr += dr;
          nc += dc;
        }
      }
      continue;
    }

    if (p.type === 'n') {
      // Mã: đi chữ L, kiểm tra CẢN CHÂN MÃ tại giao điểm liền kề theo hướng thẳng!
      const knightPatterns: [number, number, number, number][] = [
        [-2, -1, -1, 0],
        [-2, 1, -1, 0],
        [2, -1, 1, 0],
        [2, 1, 1, 0],
        [-1, -2, 0, -1],
        [1, -2, 0, -1],
        [-1, 2, 0, 1],
        [1, 2, 0, 1],
      ];
      for (const [dr, dc, legDr, legDc] of knightPatterns) {
        const nr = row + dr;
        const nc = col + dc;
        if (!isInsideBoard(nr, nc)) continue;
        // Nếu giao điểm chân Mã có quân -> bị cản chân!
        if (board[rcToIdx(row + legDr, col + legDc)] !== null) continue;
        const to = rcToIdx(nr, nc);
        const target = board[to];
        if (!target || target.color === enemy) {
          moves.push({ from: idx, to, piece: 'n', color, captured: target?.type });
        }
      }
      continue;
    }

    if (p.type === 'p') {
      // Tốt: luôn tiến 1 bước; sau khi qua sông được đi ngang 1 bước; KHÔNG lùi
      const forwardDr = color === 'red' ? -1 : 1;
      const dirs: [number, number][] = [[forwardDr, 0]];
      if (hasCrossedRiver(color, row)) {
        dirs.push([0, -1], [0, 1]);
      }
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (!isInsideBoard(nr, nc)) continue;
        const to = rcToIdx(nr, nc);
        const target = board[to];
        if (!target || target.color === enemy) {
          moves.push({ from: idx, to, piece: 'p', color, captured: target?.type });
        }
      }
    }
  }

  return moves;
}

/** Sinh nhanh danh sách nước hợp lệ (lọc Tự Chiếu & Lộ Mặt Tướng — dùng trong AI Alpha-Beta) */
export function generateLegalRawXiangqiMoves(
  board: XiangqiBoard,
  color: XiangqiColor,
): RawXiangqiMove[] {
  const pseudo = generatePseudoXiangqiMoves(board, color);
  const legal: RawXiangqiMove[] = [];
  for (const m of pseudo) {
    const next = applyXiangqiMoveToBoard(board, m);
    if (!isGeneralInCheck(next, color)) {
      legal.push(m);
    }
  }
  return legal;
}

function formatXiangqiNotation(move: RawXiangqiMove, givesCheck: boolean): string {
  const f = idxToRc(move.from);
  const t = idxToRc(move.to);
  // Quy ước cột truyền thống 1..9 tính từ phải sang trái của Đỏ (trái sang phải của Xanh)
  const fromFile = move.color === 'red' ? 9 - f.col : f.col + 1;
  const toFile = move.color === 'red' ? 9 - t.col : t.col + 1;
  const name = XIANGQI_NAME_VI[move.piece];

  let action = 'bình';
  let dest = toFile;
  if (f.row !== t.row) {
    const movingForward = move.color === 'red' ? t.row < f.row : t.row > f.row;
    action = movingForward ? 'tấn' : 'thoái';
    if (move.piece === 'r' || move.piece === 'c' || move.piece === 'p' || move.piece === 'k') {
      dest = Math.abs(t.row - f.row);
    }
  }
  return `${name} ${fromFile} ${action} ${dest}${givesCheck ? ' (Chiếu!)' : ''}`;
}

/** Sinh nước đi hợp lệ đầy đủ (có lọc thêm luật Cấm Chiếu Dai liên tiếp lần 3!) */
export function generateLegalXiangqiMoves(
  board: XiangqiBoard,
  color: XiangqiColor,
  checkRepeatCounts?: Record<string, number>,
): XiangqiMove[] {
  const raw = generateLegalRawXiangqiMoves(board, color);
  const enemy = oppositeXiangqiColor(color);

  const enriched: XiangqiMove[] = raw.map((m) => {
    const next = applyXiangqiMoveToBoard(board, m);
    const givesCheck = isGeneralInCheck(next, enemy);
    return {
      ...m,
      givesCheck,
      notationVi: formatXiangqiNotation(m, givesCheck),
    };
  });

  if (!checkRepeatCounts) return enriched;

  // Chống Chiếu Dai: nếu một nước vừa chiếu vừa đẩy bàn cờ vào trạng thái đã lặp chiếu >= 2 lần -> khóa nước đó!
  const filtered = enriched.filter((m) => {
    if (!m.givesCheck) return true;
    const next = applyXiangqiMoveToBoard(board, m);
    const key = `${color}:${getXiangqiPositionHash(next, enemy)}`;
    return (checkRepeatCounts[key] ?? 0) < 2;
  });

  return filtered.length > 0 ? filtered : enriched;
}

/** Kiểm tra cả hai bên đều hết quân có thể qua sông tấn công (Xe, Pháo, Mã, Tốt) -> Hòa thiếu lực */
export function isInsufficientXiangqiAttack(board: XiangqiBoard): boolean {
  for (const p of board) {
    if (!p) continue;
    if (p.type === 'r' || p.type === 'c' || p.type === 'n' || p.type === 'p') {
      return false;
    }
  }
  return true;
}
