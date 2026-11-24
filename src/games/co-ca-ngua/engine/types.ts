export type HorseColor = 'red' | 'yellow' | 'blue' | 'green';

export type HorseBotDifficulty = 'easy' | 'medium' | 'hard';

export type HorseZone = 'STABLE' | 'TRACK' | 'HOME_STAIRS';

export type HorseMoveKind = 'DEPLOY' | 'ADVANCE_TRACK' | 'ENTER_STAIRS' | 'CLIMB_STAIRS';

export type HorseGamePhase = 'WAIT_ROLL' | 'SELECT_HORSE' | 'GAME_OVER';

export interface HorsePiece {
  id: string; // VD: 'red_0' .. 'red_3'
  color: HorseColor;
  slotIndex: 0 | 1 | 2 | 3;
  zone: HorseZone;
  /** -1 khi ở STABLE hoặc HOME_STAIRS; 0..51 khi đang chạy trên vòng đường đua (51 = Ô Lên Bụt An Toàn) */
  progress: number;
  /** 0 khi chưa lên bụt; 1..6 khi đang đứng trên bậc cầu thang bụt của màu mình */
  stairStep: number;
}

export interface HorsePlayerState {
  color: HorseColor;
  name: string;
  isBot: boolean;
  /** Tổng số lần đá ngựa đối phương trong ván (dùng cho bảng tổng kết) */
  kicksCount: number;
}

export interface LegalHorseMove {
  horseId: string;
  color: HorseColor;
  kind: HorseMoveKind;
  diceValue: number;
  fromProgress: number;
  toProgress: number;
  fromTrackIndex: number | null;
  toTrackIndex: number | null;
  fromStairStep: number;
  toStairStep: number;
  kickedHorseId: string | null;
  kickedColor: HorseColor | null;
  /** Lộ trình các ô trackIndex đi qua (để diễn hoạt nhảy từng bước parabol) */
  stepTrackPath: number[];
}

export interface HorseLogEntry {
  id: string;
  turn: number;
  text: string;
  tone: 'info' | 'good' | 'warn' | 'kick';
}

export interface HorseRankingRow {
  rank: number;
  color: HorseColor;
  name: string;
  isBot: boolean;
  winStairCount: number; // Số ngựa đã đứng trên các bậc 3..6 (4 = Thắng!)
  totalStairPoints: number;
  totalTrackProgress: number;
  kicksCount: number;
}

export interface CoCaNguaState {
  version: number;
  roomCode?: string;
  phase: HorseGamePhase;
  turnCount: number;
  players: HorsePlayerState[]; // 2..4 người theo đúng chiều kim đồng hồ
  currentPlayerIndex: number;
  horses: HorsePiece[]; // players.length * 4 quân
  lastDiceValue: number | null;
  /** true khi vừa gieo được 1 hoặc 6 -> giữ lượt sau khi hoàn tất nước đi */
  pendingExtraTurn: boolean;
  legalMoves: LegalHorseMove[];
  winnerColor: HorseColor | null;
  rankings: HorseRankingRow[];
  lastMoveSummary: string | null;
  logs: HorseLogEntry[];
}

export type HorseAnimStep =
  | {
      type: 'DICE_ROLLED';
      color: HorseColor;
      diceValue: number;
      bonusTurn: boolean;
      hasLegalMoves: boolean;
    }
  | {
      type: 'HORSE_DEPLOY';
      horseId: string;
      color: HorseColor;
      toTrackIndex: number;
      kickedHorseId: string | null;
      kickedColor: HorseColor | null;
    }
  | {
      type: 'HORSE_HOP';
      horseId: string;
      color: HorseColor;
      trackPath: number[];
      kickedHorseId: string | null;
      kickedColor: HorseColor | null;
      reachedSafeDoor: boolean;
    }
  | {
      type: 'HORSE_CLIMB';
      horseId: string;
      color: HorseColor;
      fromStairStep: number;
      toStairStep: number;
      fromSafeDoor: boolean;
    }
  | {
      type: 'NO_MOVES_SKIP';
      color: HorseColor;
      diceValue: number;
      keepsTurn: boolean;
    }
  | {
      type: 'VICTORY';
      winnerColor: HorseColor;
      winnerName: string;
    };

export type CoCaNguaAction =
  | { type: 'ROLL_DICE'; diceValue?: number }
  | { type: 'EXECUTE_MOVE'; horseId: string };
