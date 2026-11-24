export type ChessColor = 'white' | 'black';

export type ChessPieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export type ChessPromotionType = 'q' | 'r' | 'b' | 'n';

export type ChessBotDifficulty = 'easy' | 'medium' | 'hard';

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
}

/** Bàn cờ 64 ô phẳng: index = row * 8 + col (row 0 = hàng 8 Đen, row 7 = hàng 1 Trắng; col 0..7 = cột A..H) */
export type ChessBoard = (ChessPiece | null)[];

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface ChessMove {
  from: number;
  to: number;
  piece: ChessPieceType;
  color: ChessColor;
  captured?: ChessPieceType;
  promotion?: ChessPromotionType;
  isCastleKing?: boolean;
  isCastleQueen?: boolean;
  isEnPassant?: boolean;
  san: string;
}

export type ChessEndReason =
  | 'CHECKMATE'
  | 'STALEMATE'
  | 'INSUFFICIENT_MATERIAL'
  | 'THREEFOLD_REPETITION'
  | 'FIFTY_MOVE_RULE'
  | 'RESIGN'
  | 'DRAW_AGREED';

export interface ChessUndoSnapshot {
  turn: ChessColor;
  board: ChessBoard;
  castling: CastlingRights;
  enPassantTarget: number | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  inCheck: boolean;
  lastMove: ChessMove | null;
  history: ChessMove[];
  capturedByWhite: ChessPieceType[];
  capturedByBlack: ChessPieceType[];
  positionCounts: Record<string, number>;
}

export interface ChessState {
  version: number;
  roomCode?: string;
  phase: 'PLAYING' | 'GAME_OVER';
  turn: ChessColor;
  players: Record<ChessColor, { name: string; isBot: boolean }>;
  board: ChessBoard;
  castling: CastlingRights;
  /** Ô trống đích cho luật Bắt Tốt Qua Đường ở đúng lượt kế tiếp */
  enPassantTarget: number | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  inCheck: boolean;
  winner: ChessColor | 'DRAW' | null;
  endReason: ChessEndReason | null;
  lastMove: ChessMove | null;
  history: ChessMove[];
  capturedByWhite: ChessPieceType[];
  capturedByBlack: ChessPieceType[];
  positionCounts: Record<string, number>;
  pendingDrawOfferFrom: ChessColor | null;
  undoStack: ChessUndoSnapshot[];
}

export type ChessAction =
  | { type: 'MOVE'; from: number; to: number; promotion?: ChessPromotionType }
  | { type: 'UNDO'; plies?: 1 | 2 }
  | { type: 'OFFER_DRAW'; from: ChessColor }
  | { type: 'RESPOND_DRAW'; accept: boolean }
  | { type: 'RESIGN'; color: ChessColor };
