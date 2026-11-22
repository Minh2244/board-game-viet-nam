export type TileKind =
  | 'GO'
  | 'VISIT_JAIL'
  | 'FREE_PARKING'
  | 'GO_TO_JAIL'
  | 'PROPERTY'
  | 'AUCTION_STATION'
  | 'AIRPORT'
  | 'UTILITY'
  | 'CHANCE'
  | 'FATE'
  | 'TAX'
  | 'HERITAGE';

export type EdgeIndex = 0 | 1 | 2 | 3;

export type CharacterId =
  | 'ca_phe'
  | 'khan_ran'
  | 'phuot_thu'
  | 'tri_thuc'
  | 'ao_dai_tim'
  | 'non_la'
  | 'doanh_nhan'
  | 'vung_cao';

export type LandColorId =
  | 'red'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'cyan';

export interface LandColorOption {
  id: LandColorId;
  name: string;
  hex: string;
  ringHex: string;
}

export interface ColorGroupInfo {
  id: number; // 1..10
  name: string;
  tierName: string;
  hex: string;
}

export interface BoardTileDef {
  index: number; // 0..51
  edge: EdgeIndex | null; // null với 4 ô góc
  gridPos: { col: number; row: number }; // tọa độ 0..16 × 0..10 trên lưới chữ nhật 17×11
  kind: TileKind;
  name: string;
  colorGroup?: number; // 1..10 với ô PROPERTY
  basePrice?: number; // Giá đất / giá mua cố định
  fixedTaxAmount?: number; // Mức thuế cố định (ví dụ Thuế Du Lịch 500K)
}

export interface AuctionTileState {
  status: 'UNOPENED' | 'ACTIVE' | 'CLOSED';
  currentBid: number;
  leaderId: string | null;
  bidOrder: string[]; // Thứ tự lịch sử các người đang giữ giá để fallback khi có người phá sản
  deposits: Record<string, number>;
  eliminatedPlayerIds: string[];
  finalOwnerId: string | null;
  finalPrice: number;
}

export interface BoardTile extends BoardTileDef {
  ownerId: string | null;
  buildingLevel: 0 | 1 | 2 | 3 | 4 | 5; // 1..4: Nhà cấp 1..4, 5: Biệt thự
  auctionState?: AuctionTileState;
  currentDestinationTileIndex?: number;
}

export interface PlayerSlotDraft {
  slotIndex: number;
  name: string;
  isBot: boolean;
  characterId: CharacterId;
  landColor: LandColorId;
}

export interface MatchSetupConfig {
  slots: PlayerSlotDraft[];
  diceCount: 1 | 2;
  mapMode: 'default' | 'random';
}

export interface PlayerState {
  id: string;
  order: number;
  name: string;
  characterId: CharacterId;
  landColor: LandColorId;
  landHex: string;
  isBot: boolean;
  isBankrupt: boolean;
  cash: number;
  position: number;
  stoppedOnGoForward: boolean;
  inJail: boolean;
  jailTurnsUsed: number; // 0..3
  consecutiveDoubles: number;
  getOutOfJailCards: number;
  lastDiceRollTotal: number;
}

export type CardDeckKind = 'CHANCE' | 'FATE';

export type CardEffectType =
  | { type: 'CASH_DELTA'; amount: number }
  | { type: 'GO_TO_JAIL' }
  | { type: 'JAIL_FREE_CARD' }
  | { type: 'FLY_NEAREST_AIRPORT' }
  | { type: 'MOVE_TO_TILE'; targetIndex: number }
  | { type: 'MOVE_BACKWARDS'; steps: number }
  | { type: 'COLLECT_FROM_OTHERS'; amountPerPlayer: number }
  | { type: 'PAY_EACH_OTHER'; amountPerPlayer: number }
  | { type: 'REPAIR_BUILDINGS'; houseFee: number; villaFee: number };

export interface CardDef {
  id: string;
  deck: CardDeckKind;
  title: string;
  description: string;
  effect: CardEffectType;
}

export interface DebtItem {
  id: string;
  debtorId: string;
  creditorId: string | 'BANK';
  amount: number;
  reason: string;
  onSettledAction?: 'RELEASE_FROM_JAIL';
}

export type GamePhase =
  | 'WAIT_ROLL'
  | 'IN_JAIL_DECISION'
  | 'ASK_JAIL_BAIL'
  | 'BUY_OR_SKIP_DECISION'
  | 'UPGRADE_OWN_PROPERTY'
  | 'AUCTION_DECISION'
  | 'CARD_REVEAL'
  | 'DEBT_LIQUIDATION'
  | 'GAME_OVER';

export type WinConditionType = 'LINE_VICTORY' | 'FOUR_AUCTIONS' | 'LAST_MAN_STANDING';

export interface ActiveCardPrompt {
  card: CardDef;
  drawerId: string;
  tileIndex: number;
}

export interface PendingContinuation {
  grantExtraDoubleTurn: boolean;
}

export interface LogEntry {
  id: string;
  turn: number;
  text: string;
  tone: 'info' | 'good' | 'warn' | 'danger';
}

export interface GameState {
  version: number;
  roomCode: string;
  turnCount: number;
  diceCount: 1 | 2;
  mapMode: 'default' | 'random';
  phase: GamePhase;
  players: PlayerState[];
  currentPlayerIndex: number;
  tiles: BoardTile[];
  chanceDeck: string[];
  chanceDiscard: string[];
  fateDeck: string[];
  fateDiscard: string[];
  lastDiceValues: number[];
  lastRollWasDouble: boolean;
  lastRollJustLeftJail: boolean;
  activeCard: ActiveCardPrompt | null;
  pendingAuctionTileIndex: number | null;
  pendingBuyOrUpgradeTileIndex: number | null;
  debtQueue: DebtItem[];
  pendingContinuation: PendingContinuation | null;
  winnerId: string | null;
  winCondition: WinConditionType | null;
  winningEdge: EdgeIndex | null;
  logs: LogEntry[];
}

export type GameAction =
  | { type: 'ROLL_DICE'; diceValues?: number[] }
  | { type: 'USE_JAIL_FREE_CARD' }
  | { type: 'ROLL_FOR_JAIL' ; diceValues?: number[] }
  | { type: 'ANSWER_JAIL_BAIL'; pay: boolean }
  | { type: 'BUY_PROPERTY'; buy: boolean }
  | { type: 'UPGRADE_PROPERTY'; upgrade: boolean }
  | { type: 'AUCTION_DECIDE'; bid: boolean }
  | { type: 'CONFIRM_CARD' }
  | { type: 'SELL_BUILDING'; tileIndex: number }
  | { type: 'SELL_PROPERTY'; tileIndex: number }
  | { type: 'DECLARE_BANKRUPTCY' };

export type GameAnimEvent =
  | { type: 'DICE_ROLLED'; playerId: string; values: number[]; isDouble: boolean; forJail: boolean }
  | { type: 'PAWN_STEP'; playerId: string; path: number[]; backwards: boolean; passedGo: boolean }
  | { type: 'AIRPORT_FLY'; playerId: string; fromIndex: number; toIndex: number }
  | { type: 'JAIL_LOCK'; playerId: string; fromIndex: number }
  | { type: 'JAIL_FREE'; playerId: string }
  | { type: 'CASH_CHANGE'; playerId: string; delta: number; label: string; counterpartyId?: string | 'BANK' }
  | { type: 'CARD_DRAWN'; card: CardDef; tileIndex: number }
  | { type: 'HOUSE_BUILT'; tileIndex: number; level: number; ownerId: string; landHex: string }
  | { type: 'ASSET_SOLD'; tileIndex: number; kind: 'BUILDING' | 'PROPERTY'; playerId: string }
  | { type: 'TILE_CHANGED'; tileIndex: number }
  | { type: 'AUCTION_SOUND'; kind: 'BID' | 'WON' | 'PASS' }
  | { type: 'BANKRUPT'; playerId: string }
  | { type: 'VICTORY'; winnerId: string; condition: WinConditionType };
