export type XiangqiColor = 'red' | 'green';

/** k=Tướng, a=Sĩ, e=Tượng, r=Xe, c=Pháo, n=Mã, p=Tốt */
export type XiangqiPieceType = 'k' | 'a' | 'e' | 'r' | 'c' | 'n' | 'p';

export type XiangqiBotDifficulty = 'easy' | 'medium' | 'hard';

export interface XiangqiPiece {
  type: XiangqiPieceType;
  color: XiangqiColor;
}

/** Bàn cờ 90 giao điểm phẳng (9 cột × 10 hàng): idx = row * 9 + col (row 0..4 = Xanh, row 5..9 = Đỏ) */
export type XiangqiBoard = (XiangqiPiece | null)[];

export interface XiangqiMove {
  from: number;
  to: number;
  piece: XiangqiPieceType;
  color: XiangqiColor;
  captured?: XiangqiPieceType;
  givesCheck: boolean;
  /** Ký hiệu tiếng Việt dễ đọc (VD: "Pháo (7,1) → (7,4)") */
  notationVi: string;
}

export type XiangqiEndReason =
  | 'CHECKMATE'
  | 'STALEMATE_LOSS'
  | 'INSUFFICIENT_ATTACK'
  | 'THREEFOLD_REPETITION'
  | 'SIXTY_MOVE_RULE'
  | 'RESIGN'
  | 'DRAW_AGREED';

export interface XiangqiUndoSnapshot {
  turn: XiangqiColor;
  board: XiangqiBoard;
  halfMoveClock: number;
  fullMoveNumber: number;
  inCheck: boolean;
  lastMove: XiangqiMove | null;
  history: XiangqiMove[];
  capturedByRed: XiangqiPieceType[];
  capturedByGreen: XiangqiPieceType[];
  positionCounts: Record<string, number>;
  checkRepeatCounts: Record<string, number>;
}

export interface XiangqiState {
  version: number;
  roomCode?: string;
  phase: 'PLAYING' | 'GAME_OVER';
  turn: XiangqiColor;
  players: Record<XiangqiColor, { name: string; isBot: boolean }>;
  board: XiangqiBoard;
  halfMoveClock: number;
  fullMoveNumber: number;
  inCheck: boolean;
  winner: XiangqiColor | 'DRAW' | null;
  endReason: XiangqiEndReason | null;
  lastMove: XiangqiMove | null;
  history: XiangqiMove[];
  capturedByRed: XiangqiPieceType[];
  capturedByGreen: XiangqiPieceType[];
  positionCounts: Record<string, number>;
  /** Theo dõi số lần lặp lại thế cờ kèm chiếu để chặn luật Chiếu Dai Liên Tiếp */
  checkRepeatCounts: Record<string, number>;
  pendingDrawOfferFrom: XiangqiColor | null;
  undoStack: XiangqiUndoSnapshot[];
}

export type XiangqiAction =
  | { type: 'MOVE'; from: number; to: number }
  | { type: 'UNDO'; plies?: 1 | 2 }
  | { type: 'OFFER_DRAW'; from: XiangqiColor }
  | { type: 'RESPOND_DRAW'; accept: boolean }
  | { type: 'RESIGN'; color: XiangqiColor };
