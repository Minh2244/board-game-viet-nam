export type PlayerSide = 0 | 1; // 0: Phe Dưới (Ô 0..4), 1: Phe Trên (Ô 6..10)
export type CharacterId = 'cu_ti' | 'be_mit';
export type BotDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Chiều rải trên vòng tròn 0..11:
 * - 'CCW' (Ngược kim đồng hồ): index tăng (i + 1) % 12  (Hàng dưới bấm Rải Phải ►, Hàng trên bấm ◄ Rải Trái)
 * - 'CW'  (Thuận kim đồng hồ): index giảm (i + 11) % 12 (Hàng dưới bấm ◄ Rải Trái, Hàng trên bấm Rải Phải ►)
 */
export type SowDirection = 'CCW' | 'CW';

export interface PitState {
  index: number;                // 0..11
  kind: 'DAN' | 'QUAN';         // 5, 11 là 'QUAN'; còn lại là 'DAN'
  ownerSide: PlayerSide | null; // 0 cho 0..4; 1 cho 6..10; null cho 5, 11
  stones: number;               // Số viên sỏi dân vật lý hiện có trong ô (1đ/viên)
  hasMandarin: boolean;         // Còn viên Quan lớn vật lý (10đ) hay không (chỉ ở ô 5, 11)
}

export interface PlayerMatchState {
  side: PlayerSide;
  name: string;
  characterId: CharacterId;
  isBot: boolean;
  capturedDan: number;          // Số viên sỏi dân vật lý đang giữ trong giỏ (0..50)
  capturedQuan: number;         // Số viên Quan lớn vật lý đã ăn được (0..2)
  borrowedDan: number;          // Số viên dân còn đang nợ đối thủ (sau khi đã tự động cấn trừ/trả nợ vật lý)
  loanedDan: number;            // Số viên dân đối thủ còn đang nợ mình (luôn bằng borrowedDan của đối thủ)
  sweptDanGross: number;        // Số viên dân thu về ban đầu từ 5 ô sân nhà khi kết thúc ván (chỉ để thống kê)
  sweptDanNet: number;          // Số viên dân thu về CÒN LẠI sau khi trích trả nợ vật lý cuối ván (dùng để tính điểm!)
  score: number;                // Điểm quy đổi ròng = capturedQuan*10 + capturedDan + sweptDanNet - borrowedDan + loanedDan
}

export interface OAnQuanRulesConfig {
  mandarinPointValue: 5 | 10;   // Giá trị mỗi viên Quan lớn: 10 điểm (tổng 70đ) hoặc 5 điểm (tổng 60đ)
  mandarinYouthRule: boolean;   // Biến thể Luật Quan Non: true = ô Quan còn viên Quan phải có >= 5 dân mới được ăn
  minStonesForMandarin: number; // Mặc định = 5 khi bật Luật Quan Non
}

export interface MoveHistoryEntry {
  turnNumber: number;
  side: PlayerSide;
  pitIndex: number;
  direction: SowDirection;
  refilledFromSelf: number;
  borrowedFromOpponent: number;
  chainPickCount: number;       // Số lần bốc nối vòng trong lượt này
  capturedDanGain: number;      // Số dân ăn được trong lượt này
  capturedQuanGain: number;     // Số Quan ăn được trong lượt này
  repaidDebtInTurn: number;     // Số dân tự động trả nợ vật lý ngay cuối lượt
  comboCount: number;           // Số ô ăn liên hoàn (1, 2, 3...)
}

export interface OAnQuanFinalSummary {
  endReason: 'BOTH_MANDARINS_EMPTY' | 'NO_LEGAL_MOVES_STALEMATE';
  winnerSide: PlayerSide | 'DRAW';
  scores: [number, number];           // [S_0, S_1] tính từ sweptDanNet và dư nợ còn lại
  sweptStonesGross: [number, number]; // [R_gross_0, R_gross_1] thu về ban đầu từ 5 ô mỗi bên
  sweptStonesNet: [number, number];   // [R_net_0, R_net_1] còn lại sau khi trả nợ vật lý cuối ván
  repaidFromSwept: [number, number];  // Số dân trích từ sweptStonesGross để trả nợ vật lý cuối ván
  neutralQuan: number;                // Số Quan còn trên 2 ô Quan khi bế tắc (0 khi hết 2 Quan)
  neutralDan: number;                 // Số Dân còn trên 2 ô Quan khi bế tắc (0 khi hết 2 Quan)
  neutralScore: number;               // S_neutral = neutralQuan * 10 + neutralDan (luôn có S_0 + S_1 + S_neutral === 70)
}

export type OAnQuanAnimStep =
  | {
      type: 'REFILL_FIVE_PITS';
      side: PlayerSide;
      fromSelf: number;
      borrowedFromOpponent: number;
      offsetOldDebt: number;
      pitsSnapshot: PitState[];
      playersSnapshot: [PlayerMatchState, PlayerMatchState];
    }
  | {
      type: 'PICKUP_PIT';
      side: PlayerSide;
      pitIndex: number;
      stoneCount: number;
      isChainContinue: boolean;
      pitsSnapshot: PitState[];
    }
  | {
      type: 'DROP_STONE';
      side: PlayerSide;
      pitIndex: number;
      remainingInHand: number;
      pitsSnapshot: PitState[];
    }
  | {
      type: 'CAPTURE_PIT';
      side: PlayerSide;
      emptyPitIndex: number;
      capturedPitIndex: number;
      stonesTaken: number;
      mandarinTaken: boolean;
      comboIndex: number;
      pitsSnapshot: PitState[];
      playersSnapshot: [PlayerMatchState, PlayerMatchState];
    }
  | {
      type: 'AUTO_REPAY_DEBT';
      debtorSide: PlayerSide;
      creditorSide: PlayerSide;
      repaidDan: number;
      playersSnapshot: [PlayerMatchState, PlayerMatchState];
    }
  | {
      type: 'STOP_TURN';
      side: PlayerSide;
      stopPitIndex: number;
      reason:
        | 'TWO_EMPTY'
        | 'HIT_MANDARIN_PIT'
        | 'BLOCKED_BY_YOUTH_MANDARIN'
        | 'AFTER_CAPTURE_NON_EMPTY'
        | 'MAX_CHAIN_GUARD';
    }
  | {
      type: 'SWEEP_REMAINING';
      endReason: 'BOTH_MANDARINS_EMPTY' | 'NO_LEGAL_MOVES_STALEMATE';
      sweptGrossBySide0: number;
      sweptGrossBySide1: number;
      sweptNetBySide0: number;
      sweptNetBySide1: number;
      repaidFromSweptBySide0: number;
      repaidFromSweptBySide1: number;
      neutralScore: number;
      finalScores: [number, number];
      winnerSide: PlayerSide | 'DRAW';
      pitsSnapshot: PitState[];
      playersSnapshot: [PlayerMatchState, PlayerMatchState];
    };

export interface OAnQuanState {
  pits: PitState[];             // Mảng cố định 12 ô (0..11)
  players: [PlayerMatchState, PlayerMatchState];
  currentSide: PlayerSide;      // Phe đang tới lượt (0 hoặc 1)
  turnCount: number;
  rules: OAnQuanRulesConfig;
  phase: 'WAITING_MOVE' | 'GAME_OVER';
  moveHistory: MoveHistoryEntry[];
  lastMove: MoveHistoryEntry | null;
  finalSummary: OAnQuanFinalSummary | null;
  roomCode?: string;
}

export interface SowMoveAction {
  type: 'SOW_MOVE';
  side?: PlayerSide;
  pitIndex: number;
  direction: SowDirection;
}
