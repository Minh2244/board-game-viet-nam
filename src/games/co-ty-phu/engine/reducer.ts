import { cryptoRandomInt, cryptoShuffle } from '@/shared/crypto/random';
import { ALL_CARDS_BY_ID, CHANCE_CARDS, FATE_CARDS } from '../data/cards';
import { LAND_COLORS } from '../data/characters';
import { generateBoardTiles, pickRandomPropertyDestination } from '../data/mapGenerator';
import {
  AUCTION_BID_INCREMENT,
  AUCTION_START_PRICE,
  calculatePropertyRent,
  calculatePropertyTax,
  calculateRepairFee,
  calculateStationRent,
  calculateUtilityRent,
  checkVictory,
  formatShortVnd,
  getAuctionBidDelta,
  getSellBuildingValue,
  getSellPropertyValue,
  getTotalLiquidatableValue,
  getUpgradeCost,
  GO_PASS_REWARD,
  HERITAGE_REWARD,
  JAIL_BAIL_FEE,
  JAIL_TILE_INDEX,
  JAIL_VISIT_FEE,
  playerOwnsFullColorGroup,
  STARTING_CASH,
} from './rules';
import type {
  BoardTile,
  CardDeckKind,
  CardDef,
  DebtItem,
  GameAction,
  GameAnimEvent,
  GameState,
  LogEntry,
  MatchSetupConfig,
  PlayerState,
} from './types';

let uidSeq = 1;
function nextUid(prefix: string): string {
  uidSeq += 1;
  return `${prefix}_${uidSeq}`;
}

function addLog(state: GameState, text: string, tone: LogEntry['tone'] = 'info'): void {
  state.logs.unshift({
    id: nextUid('log'),
    turn: state.turnCount,
    text,
    tone,
  });
  if (state.logs.length > 60) {
    state.logs.length = 60;
  }
}

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

export function createInitialGameState(config: MatchSetupConfig): GameState {
  const tiles = generateBoardTiles(config.mapMode);
  const players: PlayerState[] = config.slots.map((slot, idx) => {
    const colorObj = LAND_COLORS.find((c) => c.id === slot.landColor) ?? LAND_COLORS[idx % LAND_COLORS.length];
    return {
      id: `p_${idx + 1}`,
      order: idx,
      name: slot.name.trim() || (slot.isBot ? `Máy ${idx + 1}` : `Bạn ${idx + 1}`),
      characterId: slot.characterId,
      landColor: colorObj.id,
      landHex: colorObj.hex,
      isBot: slot.isBot,
      isBankrupt: false,
      cash: STARTING_CASH,
      position: 0,
      stoppedOnGoForward: false,
      inJail: false,
      jailTurnsUsed: 0,
      consecutiveDoubles: 0,
      getOutOfJailCards: 0,
      lastDiceRollTotal: 2,
    };
  });

  const chanceDeck = cryptoShuffle(CHANCE_CARDS.map((c) => c.id));
  const fateDeck = cryptoShuffle(FATE_CARDS.map((c) => c.id));

  const codeDigits = cryptoRandomInt(100, 999);
  const state: GameState = {
    version: 1,
    roomCode: `VN${codeDigits}`,
    turnCount: 1,
    diceCount: config.diceCount,
    mapMode: config.mapMode,
    phase: 'WAIT_ROLL',
    players,
    currentPlayerIndex: 0,
    tiles,
    chanceDeck,
    chanceDiscard: [],
    fateDeck,
    fateDiscard: [],
    lastDiceValues: config.diceCount === 2 ? [1, 1] : [1],
    lastRollWasDouble: false,
    lastRollJustLeftJail: false,
    activeCard: null,
    pendingAuctionTileIndex: null,
    pendingBuyOrUpgradeTileIndex: null,
    debtQueue: [],
    pendingContinuation: null,
    winnerId: null,
    winCondition: null,
    winningEdge: null,
    logs: [],
  };

  addLog(
    state,
    `Ván mới bắt đầu (${players.length} tụ · ${config.diceCount} xúc xắc · Bản đồ ${config.mapMode === 'random' ? 'Ngẫu nhiên' : 'Mặc định'}). Lượt của ${players[0].name}.`,
    'good',
  );
  return state;
}

function sendPlayerToJail(state: GameState, events: GameAnimEvent[], player: PlayerState, reason: string): void {
  const fromIndex = player.position;
  player.position = JAIL_TILE_INDEX;
  player.stoppedOnGoForward = false;
  player.inJail = true;
  player.jailTurnsUsed = 0;
  player.consecutiveDoubles = 0;
  state.pendingContinuation = null;
  events.push({ type: 'JAIL_LOCK', playerId: player.id, fromIndex });
  addLog(state, `${player.name} bị đưa vào Nhà Tù (${reason})!`, 'danger');
}

function moveForwardSteps(
  state: GameState,
  events: GameAnimEvent[],
  player: PlayerState,
  steps: number,
): void {
  const oldPos = player.position;
  const path: number[] = [];
  for (let i = 1; i <= steps; i += 1) {
    path.push((oldPos + i) % 52);
  }
  const newPos = (oldPos + steps) % 52;
  const landedExactlyOnGo = oldPos > 0 && oldPos + steps === 52;
  const passedGo =
    (oldPos === 0 && player.stoppedOnGoForward && steps > 0) ||
    (oldPos > 0 && oldPos + steps > 52);

  player.position = newPos;
  player.stoppedOnGoForward = landedExactlyOnGo;
  if (passedGo) {
    player.cash += GO_PASS_REWARD;
    events.push({
      type: 'CASH_CHANGE',
      playerId: player.id,
      delta: GO_PASS_REWARD,
      label: `+${formatShortVnd(GO_PASS_REWARD)} Khởi Hành`,
      counterpartyId: 'BANK',
    });
    addLog(state, `${player.name} đi ngang qua ô Khởi Hành, nhận +${formatShortVnd(GO_PASS_REWARD)}!`, 'good');
  }
  events.push({ type: 'PAWN_STEP', playerId: player.id, path, backwards: false, passedGo });
}

function moveForwardToTargetTile(
  state: GameState,
  events: GameAnimEvent[],
  player: PlayerState,
  targetIndex: number,
): void {
  const oldPos = player.position;
  const forwardDist = (targetIndex - oldPos + 52) % 52 || 52;
  moveForwardSteps(state, events, player, forwardDist);
}

function moveBackwardSteps(
  events: GameAnimEvent[],
  player: PlayerState,
  steps: number,
  state: GameState,
): void {
  const oldPos = player.position;
  const path: number[] = [];
  for (let i = 1; i <= steps; i += 1) {
    path.push((oldPos - i + 52) % 52);
  }
  const newPos = (oldPos - steps + 52) % 52;
  player.position = newPos;
  player.stoppedOnGoForward = false;
  events.push({ type: 'PAWN_STEP', playerId: player.id, path, backwards: true, passedGo: false });
  addLog(state, `${player.name} lùi ${steps} ô về ${state.tiles[newPos].name} (không nhận thưởng Khởi Hành).`, 'warn');
}

function refillDeckIfEmpty(state: GameState, kind: CardDeckKind): void {
  const heldJailCards = state.players
    .filter((p) => !p.isBankrupt)
    .reduce((sum, p) => sum + p.getOutOfJailCards, 0);

  if (kind === 'CHANCE') {
    if (state.chanceDeck.length > 0) return;
    const basePool =
      heldJailCards === 0
        ? CHANCE_CARDS.map((c) => c.id)
        : state.chanceDiscard.length > 0
          ? state.chanceDiscard
          : CHANCE_CARDS.filter((c) => c.effect.type !== 'JAIL_FREE_CARD').map((c) => c.id);
    state.chanceDeck = cryptoShuffle(basePool);
    state.chanceDiscard = [];
    addLog(
      state,
      `🔄 Đã bốc hết bộ Cơ Hội — Xáo trộn ngẫu nhiên lại ${state.chanceDeck.length} lá bài!`,
      'info',
    );
    return;
  }

  if (state.fateDeck.length > 0) return;
  const basePool =
    heldJailCards === 0
      ? FATE_CARDS.map((c) => c.id)
      : state.fateDiscard.length > 0
        ? state.fateDiscard
        : FATE_CARDS.filter((c) => c.effect.type !== 'JAIL_FREE_CARD').map((c) => c.id);
  state.fateDeck = cryptoShuffle(basePool);
  state.fateDiscard = [];
  addLog(
    state,
    `🔄 Đã bốc hết bộ Khí Vận — Xáo trộn ngẫu nhiên lại ${state.fateDeck.length} lá bài!`,
    'info',
  );
}

function drawCard(state: GameState, kind: CardDeckKind): CardDef {
  refillDeckIfEmpty(state, kind);

  if (kind === 'CHANCE') {
    const cardId = state.chanceDeck.shift()!;
    const card = ALL_CARDS_BY_ID[cardId];
    if (card.effect.type !== 'JAIL_FREE_CARD') {
      state.chanceDiscard.push(cardId);
    }
    if (state.chanceDeck.length === 0) {
      refillDeckIfEmpty(state, 'CHANCE');
    }
    return card;
  }

  const cardId = state.fateDeck.shift()!;
  const card = ALL_CARDS_BY_ID[cardId];
  if (card.effect.type !== 'JAIL_FREE_CARD') {
    state.fateDiscard.push(cardId);
  }
  if (state.fateDeck.length === 0) {
    refillDeckIfEmpty(state, 'FATE');
  }
  return card;
}

function tryFinalizeAuctions(state: GameState, events: GameAnimEvent[]): void {
  const alivePlayers = state.players.filter((p) => !p.isBankrupt);
  if (alivePlayers.length === 0) return;

  for (const tile of state.tiles) {
    if (tile.kind !== 'AUCTION_STATION' || !tile.auctionState) continue;
    const auc = tile.auctionState;
    if (auc.status !== 'ACTIVE' || !auc.leaderId) continue;

    const leaderAlive = alivePlayers.some((p) => p.id === auc.leaderId);
    if (!leaderAlive) continue;

    const remainingContenders = alivePlayers.filter(
      (p) => !auc.eliminatedPlayerIds.includes(p.id),
    );
    if (remainingContenders.length === 1 && remainingContenders[0].id === auc.leaderId) {
      auc.status = 'CLOSED';
      auc.finalOwnerId = auc.leaderId;
      auc.finalPrice = auc.currentBid;
      const winner = state.players.find((p) => p.id === auc.leaderId);
      events.push({ type: 'AUCTION_SOUND', kind: 'WON' });
      events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
      if (winner) {
        addLog(
          state,
          `${winner.name} thắng Đấu Giá ${tile.name} với giá chốt ${formatShortVnd(auc.finalPrice)}!`,
          'good',
        );
      }
    }
  }
}

function executeBankruptcy(
  state: GameState,
  events: GameAnimEvent[],
  debtor: PlayerState,
  creditorId: string | 'BANK',
): void {
  if (debtor.isBankrupt) return;

  // Chuyển toàn bộ tiền mặt còn lại + toàn bộ tiền cọc đấu giá bị khóa cho chủ nợ
  let confiscatedTotal = debtor.cash;
  debtor.cash = 0;

  for (const tile of state.tiles) {
    if (tile.kind === 'AUCTION_STATION' && tile.auctionState) {
      const auc = tile.auctionState;
      const lockedDeposit = auc.deposits[debtor.id] ?? 0;
      if (lockedDeposit > 0) {
        confiscatedTotal += lockedDeposit;
        delete auc.deposits[debtor.id];
      }
      auc.bidOrder = auc.bidOrder.filter((id) => id !== debtor.id);

      if (auc.status === 'ACTIVE') {
        if (!auc.eliminatedPlayerIds.includes(debtor.id)) {
          auc.eliminatedPlayerIds.push(debtor.id);
        }
        if (auc.leaderId === debtor.id) {
          // Trả quyền dẫn đầu về người giữ giá kế trước vẫn còn cọc, hoặc mở lại 0đ
          let fallbackLeader: string | null = null;
          for (let i = auc.bidOrder.length - 1; i >= 0; i -= 1) {
            const candId = auc.bidOrder[i];
            const cand = state.players.find((p) => p.id === candId && !p.isBankrupt);
            if (cand && (auc.deposits[candId] ?? 0) > 0 && !auc.eliminatedPlayerIds.includes(candId)) {
              fallbackLeader = candId;
              break;
            }
          }
          if (fallbackLeader) {
            auc.leaderId = fallbackLeader;
            auc.currentBid = auc.deposits[fallbackLeader];
          } else {
            auc.status = 'UNOPENED';
            auc.leaderId = null;
            auc.currentBid = 0;
            auc.eliminatedPlayerIds = [];
          }
          events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
        }
      } else if (auc.status === 'CLOSED' && auc.finalOwnerId === debtor.id) {
        auc.status = 'UNOPENED';
        auc.finalOwnerId = null;
        auc.finalPrice = 0;
        auc.currentBid = 0;
        auc.leaderId = null;
        auc.bidOrder = [];
        auc.deposits = {};
        auc.eliminatedPlayerIds = [];
        events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
      }
    } else if (tile.ownerId === debtor.id) {
      tile.ownerId = null;
      tile.buildingLevel = 0;
      events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
    }
  }

  if (creditorId !== 'BANK' && confiscatedTotal > 0) {
    const creditor = state.players.find((p) => p.id === creditorId && !p.isBankrupt);
    if (creditor) {
      creditor.cash += confiscatedTotal;
      events.push({
        type: 'CASH_CHANGE',
        playerId: creditor.id,
        delta: confiscatedTotal,
        label: `+${formatShortVnd(confiscatedTotal)} Thanh lý`,
        counterpartyId: debtor.id,
      });
    }
  }

  debtor.isBankrupt = true;
  debtor.inJail = false;
  debtor.consecutiveDoubles = 0;
  debtor.getOutOfJailCards = 0;
  state.debtQueue = state.debtQueue.filter((d) => d.debtorId !== debtor.id);

  if (getCurrentPlayer(state).id === debtor.id) {
    state.pendingContinuation = null;
  }

  events.push({ type: 'BANKRUPT', playerId: debtor.id });
  addLog(state, `${debtor.name} chính thức PHÁ SẢN! Toàn bộ đất đai thu hồi về trống.`, 'danger');

  tryFinalizeAuctions(state, events);
}

function advanceTurn(state: GameState): void {
  const total = state.players.length;
  for (let step = 1; step <= total; step += 1) {
    const nextIdx = (state.currentPlayerIndex + step) % total;
    if (!state.players[nextIdx].isBankrupt) {
      state.currentPlayerIndex = nextIdx;
      state.turnCount += 1;
      state.lastRollJustLeftJail = false;
      state.pendingContinuation = null;
      state.pendingAuctionTileIndex = null;
      state.pendingBuyOrUpgradeTileIndex = null;
      state.activeCard = null;
      const nextPlayer = state.players[nextIdx];
      state.phase = nextPlayer.inJail ? 'IN_JAIL_DECISION' : 'WAIT_ROLL';
      addLog(state, `Đến lượt của ${nextPlayer.name}.`, 'info');
      return;
    }
  }
}

function finishStepAndRouteNext(state: GameState, events: GameAnimEvent[]): void {
  const victory = checkVictory(state.tiles, state.players);
  if (victory) {
    state.phase = 'GAME_OVER';
    state.winnerId = victory.winnerId;
    state.winCondition = victory.condition;
    state.winningEdge = victory.edge;
    state.pendingContinuation = null;
    state.activeCard = null;
    state.pendingAuctionTileIndex = null;
    state.pendingBuyOrUpgradeTileIndex = null;
    state.debtQueue = [];
    const winner = state.players.find((p) => p.id === victory.winnerId);
    events.push({ type: 'VICTORY', winnerId: victory.winnerId, condition: victory.condition });
    if (winner) {
      addLog(state, `CHIẾN THẮNG! ${winner.name} vô địch (${victory.condition})!`, 'good');
    }
    return;
  }

  if (state.debtQueue.length > 0) {
    processDebtQueue(state, events);
    return;
  }

  const current = getCurrentPlayer(state);
  if (
    state.pendingContinuation?.grantExtraDoubleTurn &&
    !current.isBankrupt &&
    !current.inJail &&
    !state.lastRollJustLeftJail
  ) {
    state.pendingContinuation = null;
    state.phase = 'WAIT_ROLL';
    addLog(state, `${current.name} đổ ĐÔI nên được gieo tiếp lượt thưởng!`, 'good');
    return;
  }

  advanceTurn(state);
}

function processDebtQueue(state: GameState, events: GameAnimEvent[]): void {
  while (state.debtQueue.length > 0) {
    const victory = checkVictory(state.tiles, state.players);
    if (victory) {
      finishStepAndRouteNext(state, events);
      return;
    }

    const debt = state.debtQueue[0];
    const debtor = state.players.find((p) => p.id === debt.debtorId);
    if (!debtor || debtor.isBankrupt) {
      state.debtQueue.shift();
      continue;
    }

    if (debtor.cash >= debt.amount) {
      debtor.cash -= debt.amount;
      events.push({
        type: 'CASH_CHANGE',
        playerId: debtor.id,
        delta: -debt.amount,
        label: `-${formatShortVnd(debt.amount)} ${debt.reason}`,
        counterpartyId: debt.creditorId,
      });

      if (debt.creditorId !== 'BANK') {
        const creditor = state.players.find((p) => p.id === debt.creditorId && !p.isBankrupt);
        if (creditor) {
          creditor.cash += debt.amount;
          events.push({
            type: 'CASH_CHANGE',
            playerId: creditor.id,
            delta: debt.amount,
            label: `+${formatShortVnd(debt.amount)}`,
            counterpartyId: debtor.id,
          });
        }
      }

      if (debt.onSettledAction === 'RELEASE_FROM_JAIL') {
        debtor.inJail = false;
        debtor.jailTurnsUsed = 0;
        debtor.consecutiveDoubles = 0;
        events.push({ type: 'JAIL_FREE', playerId: debtor.id });
        addLog(state, `${debtor.name} nộp ${formatShortVnd(debt.amount)} ra tù.`, 'warn');
      }

      state.debtQueue.shift();
      continue;
    }

    // Thiếu tiền mặt -> kiểm tra tài sản bán trả nợ
    const totalLiquid = getTotalLiquidatableValue(state.tiles, debtor.id);
    if (totalLiquid === 0) {
      // Không còn gì để bán -> Phá sản tự động luôn
      executeBankruptcy(state, events, debtor, debt.creditorId);
      const afterBankruptVictory = checkVictory(state.tiles, state.players);
      if (afterBankruptVictory) {
        finishStepAndRouteNext(state, events);
        return;
      }
      continue;
    }

    state.phase = 'DEBT_LIQUIDATION';
    addLog(
      state,
      `${debtor.name} thiếu ${formatShortVnd(debt.amount - debtor.cash)} để thanh toán (${debt.reason}) — cần bán tài sản!`,
      'warn',
    );
    return;
  }

  finishStepAndRouteNext(state, events);
}

function enqueueDebt(
  state: GameState,
  events: GameAnimEvent[],
  debtorId: string,
  creditorId: string | 'BANK',
  amount: number,
  reason: string,
  onSettledAction?: DebtItem['onSettledAction'],
): void {
  if (amount <= 0) {
    finishStepAndRouteNext(state, events);
    return;
  }
  state.debtQueue.push({
    id: nextUid('debt'),
    debtorId,
    creditorId,
    amount,
    reason,
    onSettledAction,
  });
  processDebtQueue(state, events);
}

function resolveTileLanding(
  state: GameState,
  events: GameAnimEvent[],
  player: PlayerState,
  tileIndex: number,
): void {
  const tile = state.tiles[tileIndex];
  addLog(state, `${player.name} dừng chân tại ${tile.name}.`, 'info');

  switch (tile.kind) {
    case 'GO':
    case 'FREE_PARKING': {
      finishStepAndRouteNext(state, events);
      return;
    }

    case 'GO_TO_JAIL': {
      sendPlayerToJail(state, events, player, 'Dẫm ô Bị Bắt Vào Tù');
      finishStepAndRouteNext(state, events);
      return;
    }

    case 'VISIT_JAIL': {
      if (player.inJail) {
        finishStepAndRouteNext(state, events);
        return;
      }
      enqueueDebt(state, events, player.id, 'BANK', JAIL_VISIT_FEE, 'Phí thăm tù');
      return;
    }

    case 'HERITAGE': {
      player.cash += HERITAGE_REWARD;
      events.push({
        type: 'CASH_CHANGE',
        playerId: player.id,
        delta: HERITAGE_REWARD,
        label: `+${formatShortVnd(HERITAGE_REWARD)} Di Sản`,
        counterpartyId: 'BANK',
      });
      addLog(state, `${player.name} nhận tài trợ Di Sản Quốc Gia +${formatShortVnd(HERITAGE_REWARD)}!`, 'good');
      finishStepAndRouteNext(state, events);
      return;
    }

    case 'TAX': {
      const tax = tile.fixedTaxAmount ?? calculatePropertyTax(state.tiles, player.id);
      enqueueDebt(state, events, player.id, 'BANK', tax, tile.name);
      return;
    }

    case 'CHANCE':
    case 'FATE': {
      const card = drawCard(state, tile.kind);
      state.activeCard = { card, drawerId: player.id, tileIndex };
      state.phase = 'CARD_REVEAL';
      events.push({ type: 'CARD_DRAWN', card, tileIndex });
      addLog(
        state,
        `${player.name} rút thẻ ${tile.kind === 'CHANCE' ? 'Cơ Hội' : 'Khí Vận'}: "${card.title}"`,
        tile.kind === 'CHANCE' ? 'good' : 'warn',
      );
      return;
    }

    case 'AIRPORT': {
      const destIndex =
        tile.currentDestinationTileIndex ?? pickRandomPropertyDestination(state.tiles);
      const fromIndex = player.position;
      player.position = destIndex;
      player.stoppedOnGoForward = false;
      tile.currentDestinationTileIndex = pickRandomPropertyDestination(state.tiles, destIndex);
      events.push({ type: 'AIRPORT_FLY', playerId: player.id, fromIndex, toIndex: destIndex });
      events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
      addLog(
        state,
        `${player.name} cất cánh từ ${tile.name} bay thẳng tới ${state.tiles[destIndex].name}!`,
        'info',
      );
      resolveTileLanding(state, events, player, destIndex);
      return;
    }

    case 'AUCTION_STATION': {
      const auc = tile.auctionState!;
      if (auc.status === 'CLOSED' && auc.finalOwnerId) {
        if (auc.finalOwnerId === player.id) {
          finishStepAndRouteNext(state, events);
          return;
        }
        const rent = calculateStationRent(state.players, tile);
        if (rent === 0) {
          const owner = state.players.find((p) => p.id === auc.finalOwnerId);
          addLog(
            state,
            `${owner?.name ?? 'Chủ Bến Xe'} đang ở tù — ${player.name} được miễn phí vé Bến Xe!`,
            'info',
          );
          finishStepAndRouteNext(state, events);
          return;
        }
        enqueueDebt(state, events, player.id, auc.finalOwnerId, rent, `Vé ${tile.name}`);
        return;
      }

      // Trạm chưa chốt: nếu đang giữ giá cao nhất hoặc đã bị loại -> bỏ qua hỏi
      if (auc.leaderId === player.id || auc.eliminatedPlayerIds.includes(player.id)) {
        finishStepAndRouteNext(state, events);
        return;
      }

      state.pendingAuctionTileIndex = tile.index;
      state.phase = 'AUCTION_DECISION';
      return;
    }

    case 'UTILITY': {
      if (!tile.ownerId) {
        if (player.cash >= (tile.basePrice ?? 2_000_000)) {
          state.pendingBuyOrUpgradeTileIndex = tile.index;
          state.phase = 'BUY_OR_SKIP_DECISION';
          return;
        }
        addLog(state, `${player.name} không đủ ${formatShortVnd(tile.basePrice ?? 2_000_000)} để mua ${tile.name}.`, 'info');
        finishStepAndRouteNext(state, events);
        return;
      }

      if (tile.ownerId === player.id) {
        finishStepAndRouteNext(state, events);
        return;
      }

      const rent = calculateUtilityRent(state.tiles, state.players, tile, player.lastDiceRollTotal);
      if (rent === 0) {
        const owner = state.players.find((p) => p.id === tile.ownerId);
        addLog(
          state,
          `${owner?.name ?? 'Chủ Thủy Điện'} đang ở tù — ${player.name} được miễn tiền điện nước!`,
          'info',
        );
        finishStepAndRouteNext(state, events);
        return;
      }
      enqueueDebt(state, events, player.id, tile.ownerId, rent, `Tiền điện ${tile.name}`);
      return;
    }

    case 'PROPERTY': {
      if (!tile.ownerId) {
        const price = tile.basePrice ?? 1_000_000;
        if (player.cash >= price) {
          state.pendingBuyOrUpgradeTileIndex = tile.index;
          state.phase = 'BUY_OR_SKIP_DECISION';
          return;
        }
        addLog(state, `${player.name} chưa đủ ${formatShortVnd(price)} mua ${tile.name}.`, 'info');
        finishStepAndRouteNext(state, events);
        return;
      }

      if (tile.ownerId === player.id) {
        const upCost = getUpgradeCost(tile);
        if (tile.buildingLevel < 5 && player.cash >= upCost) {
          state.pendingBuyOrUpgradeTileIndex = tile.index;
          state.phase = 'UPGRADE_OWN_PROPERTY';
          return;
        }
        finishStepAndRouteNext(state, events);
        return;
      }

      const rent = calculatePropertyRent(state.tiles, state.players, tile);
      if (rent === 0) {
        const owner = state.players.find((p) => p.id === tile.ownerId);
        addLog(
          state,
          `${owner?.name ?? 'Chủ đất'} đang ở tù — ${player.name} được miễn tiền thuê ${tile.name}!`,
          'info',
        );
        finishStepAndRouteNext(state, events);
        return;
      }
      const hasMonopoly =
        tile.colorGroup !== undefined && playerOwnsFullColorGroup(state.tiles, tile.ownerId, tile.colorGroup);
      const rentReason = hasMonopoly ? `Thuê ${tile.name} (×2 bộ màu)` : `Thuê ${tile.name}`;
      enqueueDebt(state, events, player.id, tile.ownerId, rent, rentReason);
      return;
    }
  }
}

function rollCryptoDice(diceCount: 1 | 2, injected?: number[]): number[] {
  if (injected && injected.length === diceCount) {
    return [...injected];
  }
  const out: number[] = [];
  for (let i = 0; i < diceCount; i += 1) {
    out.push(cryptoRandomInt(1, 6));
  }
  return out;
}

export function reduceGameAction(
  prevState: GameState,
  action: GameAction,
): { state: GameState; events: GameAnimEvent[] } {
  const state: GameState = structuredClone(prevState);
  const events: GameAnimEvent[] = [];

  if (state.phase === 'GAME_OVER') {
    return { state, events };
  }

  const current = getCurrentPlayer(state);

  switch (action.type) {
    case 'ROLL_DICE': {
      if (state.phase !== 'WAIT_ROLL') return { state, events };
      const dice = rollCryptoDice(state.diceCount, action.diceValues);
      const total = dice.reduce((a, b) => a + b, 0);
      const isDouble = state.diceCount === 2 && dice[0] === dice[1];

      state.lastDiceValues = dice;
      state.lastRollWasDouble = isDouble;
      state.lastRollJustLeftJail = false;
      current.lastDiceRollTotal = total;

      events.push({ type: 'DICE_ROLLED', playerId: current.id, values: dice, isDouble, forJail: false });
      addLog(
        state,
        `${current.name} gieo được ${dice.join(' + ')} = ${total} điểm${isDouble ? ' (ĐỔ ĐÔI!)' : ''}.`,
        isDouble ? 'good' : 'info',
      );

      if (isDouble) {
        current.consecutiveDoubles += 1;
        if (current.consecutiveDoubles >= 3) {
          sendPlayerToJail(state, events, current, 'Đổ đôi 3 lần liên tiếp');
          finishStepAndRouteNext(state, events);
          return { state, events };
        }
        state.pendingContinuation = { grantExtraDoubleTurn: true };
      } else {
        current.consecutiveDoubles = 0;
        state.pendingContinuation = { grantExtraDoubleTurn: false };
      }

      moveForwardSteps(state, events, current, total);
      resolveTileLanding(state, events, current, current.position);
      return { state, events };
    }

    case 'USE_JAIL_FREE_CARD': {
      if (state.phase !== 'IN_JAIL_DECISION' || !current.inJail || current.getOutOfJailCards <= 0) {
        return { state, events };
      }
      current.getOutOfJailCards -= 1;
      // Trả lá Thẻ Miễn Vào Tù đã dùng về lại bộ bài bỏ để lần xáo tiếp theo đủ 16 lá
      if (!state.chanceDeck.includes('chance_02') && !state.chanceDiscard.includes('chance_02')) {
        state.chanceDiscard.push('chance_02');
      } else if (!state.fateDeck.includes('fate_02') && !state.fateDiscard.includes('fate_02')) {
        state.fateDiscard.push('fate_02');
      }
      current.inJail = false;
      current.jailTurnsUsed = 0;
      current.consecutiveDoubles = 0;
      state.pendingContinuation = null;
      events.push({ type: 'JAIL_FREE', playerId: current.id });
      addLog(state, `${current.name} dùng Thẻ Miễn Vào Tù để được tự do (chờ lượt sau di chuyển).`, 'good');
      advanceTurn(state);
      return { state, events };
    }

    case 'ROLL_FOR_JAIL': {
      if (state.phase !== 'IN_JAIL_DECISION' || !current.inJail) {
        return { state, events };
      }
      const dice = rollCryptoDice(state.diceCount, action.diceValues);
      const total = dice.reduce((a, b) => a + b, 0);
      const isDouble = state.diceCount === 2 && dice[0] === dice[1];
      const escaped = state.diceCount === 2 ? isDouble : dice[0] === 6;

      current.jailTurnsUsed += 1;
      state.lastDiceValues = dice;
      state.lastRollWasDouble = false;
      current.lastDiceRollTotal = total;

      events.push({ type: 'DICE_ROLLED', playerId: current.id, values: dice, isDouble: escaped, forJail: true });

      if (escaped) {
        current.inJail = false;
        current.jailTurnsUsed = 0;
        current.consecutiveDoubles = 0;
        state.lastRollJustLeftJail = true;
        state.pendingContinuation = { grantExtraDoubleTurn: false };
        events.push({ type: 'JAIL_FREE', playerId: current.id });
        addLog(
          state,
          `${current.name} gieo được ${dice.join(' + ')} — THOÁT TÙ THÀNH CÔNG và đi tiếp ${total} ô!`,
          'good',
        );
        moveForwardSteps(state, events, current, total);
        resolveTileLanding(state, events, current, current.position);
        return { state, events };
      }

      addLog(
        state,
        `${current.name} thử vận may ra tù lượt ${current.jailTurnsUsed}/3 ra ${dice.join(' + ')} — chưa thoát.`,
        'warn',
      );

      if (current.jailTurnsUsed < 3) {
        state.phase = 'ASK_JAIL_BAIL';
        return { state, events };
      }

      // Lượt thứ 3 thất bại -> cưỡng chế nộp 1M ra tù
      addLog(state, `${current.name} hết 3 lượt tù — cưỡng chế nộp ${formatShortVnd(JAIL_BAIL_FEE)} bảo lãnh!`, 'warn');
      state.pendingContinuation = null;
      enqueueDebt(
        state,
        events,
        current.id,
        'BANK',
        JAIL_BAIL_FEE,
        'Bảo lãnh ra tù cưỡng chế',
        'RELEASE_FROM_JAIL',
      );
      return { state, events };
    }

    case 'ANSWER_JAIL_BAIL': {
      if (state.phase !== 'ASK_JAIL_BAIL') return { state, events };
      if (!action.pay || current.cash < JAIL_BAIL_FEE) {
        addLog(state, `${current.name} chọn tiếp tục ở lại trong tù.`, 'info');
        advanceTurn(state);
        return { state, events };
      }
      current.cash -= JAIL_BAIL_FEE;
      current.inJail = false;
      current.jailTurnsUsed = 0;
      current.consecutiveDoubles = 0;
      events.push({
        type: 'CASH_CHANGE',
        playerId: current.id,
        delta: -JAIL_BAIL_FEE,
        label: `-${formatShortVnd(JAIL_BAIL_FEE)} Bảo lãnh`,
        counterpartyId: 'BANK',
      });
      events.push({ type: 'JAIL_FREE', playerId: current.id });
      addLog(state, `${current.name} nộp ${formatShortVnd(JAIL_BAIL_FEE)} bảo lãnh ra tù (chờ lượt sau đi).`, 'good');
      advanceTurn(state);
      return { state, events };
    }

    case 'BUY_PROPERTY': {
      if (state.phase !== 'BUY_OR_SKIP_DECISION' || state.pendingBuyOrUpgradeTileIndex === null) {
        return { state, events };
      }
      const tile = state.tiles[state.pendingBuyOrUpgradeTileIndex];
      state.pendingBuyOrUpgradeTileIndex = null;
      const price = tile.basePrice ?? 1_000_000;

      if (action.buy && current.cash >= price && !tile.ownerId) {
        current.cash -= price;
        tile.ownerId = current.id;
        tile.buildingLevel = 0;
        events.push({
          type: 'CASH_CHANGE',
          playerId: current.id,
          delta: -price,
          label: `-${formatShortVnd(price)} Mua đất`,
          counterpartyId: 'BANK',
        });
        events.push({
          type: 'HOUSE_BUILT',
          tileIndex: tile.index,
          level: 0,
          ownerId: current.id,
          landHex: current.landHex,
        });
        events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
        addLog(state, `${current.name} mua thành công ${tile.name} giá ${formatShortVnd(price)}!`, 'good');
      } else {
        addLog(state, `${current.name} bỏ qua không mua ${tile.name}.`, 'info');
      }

      finishStepAndRouteNext(state, events);
      return { state, events };
    }

    case 'UPGRADE_PROPERTY': {
      if (state.phase !== 'UPGRADE_OWN_PROPERTY' || state.pendingBuyOrUpgradeTileIndex === null) {
        return { state, events };
      }
      const tile = state.tiles[state.pendingBuyOrUpgradeTileIndex];
      state.pendingBuyOrUpgradeTileIndex = null;
      const cost = getUpgradeCost(tile);

      if (action.upgrade && tile.ownerId === current.id && tile.buildingLevel < 5 && current.cash >= cost) {
        current.cash -= cost;
        tile.buildingLevel = (tile.buildingLevel + 1) as BoardTile['buildingLevel'];
        events.push({
          type: 'CASH_CHANGE',
          playerId: current.id,
          delta: -cost,
          label: `-${formatShortVnd(cost)} Xây dựng`,
          counterpartyId: 'BANK',
        });
        events.push({
          type: 'HOUSE_BUILT',
          tileIndex: tile.index,
          level: tile.buildingLevel,
          ownerId: current.id,
          landHex: current.landHex,
        });
        events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
        addLog(
          state,
          `${current.name} nâng cấp ${tile.name} lên ${tile.buildingLevel === 5 ? 'BIỆT THỰ' : `Nhà Cấp ${tile.buildingLevel}`} (-${formatShortVnd(cost)})!`,
          'good',
        );
      } else {
        addLog(state, `${current.name} không nâng cấp thêm tại ${tile.name}.`, 'info');
      }

      finishStepAndRouteNext(state, events);
      return { state, events };
    }

    case 'AUCTION_DECIDE': {
      if (state.phase !== 'AUCTION_DECISION' || state.pendingAuctionTileIndex === null) {
        return { state, events };
      }
      const tile = state.tiles[state.pendingAuctionTileIndex];
      state.pendingAuctionTileIndex = null;
      const auc = tile.auctionState!;

      if (action.bid) {
        const { nextBid, deltaNeeded } = getAuctionBidDelta(tile, current.id);
        if (current.cash >= deltaNeeded) {
          const wasUnopened = auc.status === 'UNOPENED';
          current.cash -= deltaNeeded;
          auc.status = 'ACTIVE';
          auc.currentBid = nextBid;
          auc.leaderId = current.id;
          auc.deposits[current.id] = nextBid;
          auc.bidOrder = auc.bidOrder.filter((id) => id !== current.id);
          auc.bidOrder.push(current.id);
          events.push({
            type: 'CASH_CHANGE',
            playerId: current.id,
            delta: -deltaNeeded,
            label: `-${formatShortVnd(deltaNeeded)} Cọc ${tile.name}`,
            counterpartyId: 'BANK',
          });
          events.push({ type: 'AUCTION_SOUND', kind: 'BID' });
          events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
          addLog(
            state,
            wasUnopened
              ? `${current.name} mở đấu giá ${tile.name} mức ${formatShortVnd(AUCTION_START_PRICE)}!`
              : `${current.name} nâng đấu giá ${tile.name} lên ${formatShortVnd(nextBid)} (bù thêm ${formatShortVnd(deltaNeeded)})!`,
            'good',
          );
          tryFinalizeAuctions(state, events);
          finishStepAndRouteNext(state, events);
          return { state, events };
        }
      }

      // Người chơi bấm Bỏ quyền hoặc không đủ tiền bù cọc
      if (auc.status === 'UNOPENED') {
        events.push({ type: 'AUCTION_SOUND', kind: 'PASS' });
        addLog(state, `${current.name} chưa mở đấu giá ${tile.name}.`, 'info');
      } else {
        const refund = auc.deposits[current.id] ?? 0;
        if (refund > 0) {
          current.cash += refund;
          delete auc.deposits[current.id];
          events.push({
            type: 'CASH_CHANGE',
            playerId: current.id,
            delta: refund,
            label: `+${formatShortVnd(refund)} Hoàn cọc`,
            counterpartyId: 'BANK',
          });
        }
        auc.bidOrder = auc.bidOrder.filter((id) => id !== current.id);
        if (!auc.eliminatedPlayerIds.includes(current.id)) {
          auc.eliminatedPlayerIds.push(current.id);
        }
        events.push({ type: 'AUCTION_SOUND', kind: 'PASS' });
        events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
        addLog(
          state,
          `${current.name} Bỏ quyền đấu giá ${tile.name}${refund > 0 ? ` (nhận lại ${formatShortVnd(refund)} cọc)` : ''}.`,
          'warn',
        );
        tryFinalizeAuctions(state, events);
      }

      finishStepAndRouteNext(state, events);
      return { state, events };
    }

    case 'CONFIRM_CARD': {
      if (state.phase !== 'CARD_REVEAL' || !state.activeCard) return { state, events };
      const { card } = state.activeCard;
      state.activeCard = null;
      const eff = card.effect;

      switch (eff.type) {
        case 'GO_TO_JAIL': {
          sendPlayerToJail(state, events, current, `Thẻ: ${card.title}`);
          finishStepAndRouteNext(state, events);
          return { state, events };
        }

        case 'JAIL_FREE_CARD': {
          current.getOutOfJailCards += 1;
          addLog(state, `${current.name} nhận thêm 1 Thẻ Miễn Vào Tù!`, 'good');
          finishStepAndRouteNext(state, events);
          return { state, events };
        }

        case 'CASH_DELTA': {
          if (eff.amount >= 0) {
            current.cash += eff.amount;
            events.push({
              type: 'CASH_CHANGE',
              playerId: current.id,
              delta: eff.amount,
              label: `+${formatShortVnd(eff.amount)} ${card.title}`,
              counterpartyId: 'BANK',
            });
            finishStepAndRouteNext(state, events);
          } else {
            enqueueDebt(state, events, current.id, 'BANK', Math.abs(eff.amount), card.title);
          }
          return { state, events };
        }

        case 'FLY_NEAREST_AIRPORT': {
          const airports = state.tiles.filter((t) => t.kind === 'AIRPORT');
          let airportIndex = airports[0]?.index ?? 26;
          let minDist = 999;
          for (const ap of airports) {
            const dist = (ap.index - current.position + 52) % 52 || 52;
            if (dist < minDist) {
              minDist = dist;
              airportIndex = ap.index;
            }
          }
          const fromPos = current.position;
          current.position = airportIndex;
          current.stoppedOnGoForward = false;
          events.push({ type: 'AIRPORT_FLY', playerId: current.id, fromIndex: fromPos, toIndex: airportIndex });
          resolveTileLanding(state, events, current, airportIndex);
          return { state, events };
        }

        case 'MOVE_TO_TILE': {
          const resolvedTarget =
            card.id === 'chance_06'
              ? state.tiles.find((t) => t.name.includes('Sài Gòn'))?.index ?? eff.targetIndex
              : eff.targetIndex;
          moveForwardToTargetTile(state, events, current, resolvedTarget);
          resolveTileLanding(state, events, current, current.position);
          return { state, events };
        }

        case 'MOVE_BACKWARDS': {
          moveBackwardSteps(events, current, eff.steps, state);
          resolveTileLanding(state, events, current, current.position);
          return { state, events };
        }

        case 'COLLECT_FROM_OTHERS': {
          // Thu tuần tự từng đối thủ còn sống theo thứ tự lượt kế tiếp
          const totalPlayers = state.players.length;
          for (let offset = 1; offset < totalPlayers; offset += 1) {
            const idx = (state.currentPlayerIndex + offset) % totalPlayers;
            const opp = state.players[idx];
            if (!opp.isBankrupt) {
              state.debtQueue.push({
                id: nextUid('debt'),
                debtorId: opp.id,
                creditorId: current.id,
                amount: eff.amountPerPlayer,
                reason: card.title,
              });
            }
          }
          if (state.debtQueue.length === 0) {
            finishStepAndRouteNext(state, events);
          } else {
            processDebtQueue(state, events);
          }
          return { state, events };
        }

        case 'PAY_EACH_OTHER': {
          const totalPlayers = state.players.length;
          for (let offset = 1; offset < totalPlayers; offset += 1) {
            const idx = (state.currentPlayerIndex + offset) % totalPlayers;
            const opp = state.players[idx];
            if (!opp.isBankrupt) {
              state.debtQueue.push({
                id: nextUid('debt'),
                debtorId: current.id,
                creditorId: opp.id,
                amount: eff.amountPerPlayer,
                reason: card.title,
              });
            }
          }
          if (state.debtQueue.length === 0) {
            finishStepAndRouteNext(state, events);
          } else {
            processDebtQueue(state, events);
          }
          return { state, events };
        }

        case 'REPAIR_BUILDINGS': {
          const fee = calculateRepairFee(state.tiles, current.id, eff.houseFee, eff.villaFee);
          if (fee === 0) {
            addLog(state, `${current.name} chưa có công trình nào nên miễn phí sửa chữa!`, 'good');
            finishStepAndRouteNext(state, events);
          } else {
            enqueueDebt(state, events, current.id, 'BANK', fee, card.title);
          }
          return { state, events };
        }
      }
      return { state, events };
    }

    case 'SELL_BUILDING': {
      if (state.phase !== 'DEBT_LIQUIDATION' || state.debtQueue.length === 0) return { state, events };
      const debtorId = state.debtQueue[0].debtorId;
      const debtor = state.players.find((p) => p.id === debtorId);
      const tile = state.tiles[action.tileIndex];
      if (!debtor || !tile || tile.ownerId !== debtor.id || tile.buildingLevel <= 0) {
        return { state, events };
      }
      const value = getSellBuildingValue(tile);
      tile.buildingLevel = (tile.buildingLevel - 1) as BoardTile['buildingLevel'];
      debtor.cash += value;
      events.push({
        type: 'CASH_CHANGE',
        playerId: debtor.id,
        delta: value,
        label: `+${formatShortVnd(value)} Bán nhà`,
        counterpartyId: 'BANK',
      });
      events.push({ type: 'ASSET_SOLD', tileIndex: tile.index, kind: 'BUILDING', playerId: debtor.id });
      events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
      addLog(state, `${debtor.name} bán 1 cấp nhà tại ${tile.name} thu ${formatShortVnd(value)}.`, 'warn');
      processDebtQueue(state, events);
      return { state, events };
    }

    case 'SELL_PROPERTY': {
      if (state.phase !== 'DEBT_LIQUIDATION' || state.debtQueue.length === 0) return { state, events };
      const debtorId = state.debtQueue[0].debtorId;
      const debtor = state.players.find((p) => p.id === debtorId);
      const tile = state.tiles[action.tileIndex];
      if (!debtor || !tile) return { state, events };

      if (tile.kind === 'AUCTION_STATION') {
        if (tile.auctionState?.status !== 'CLOSED' || tile.auctionState.finalOwnerId !== debtor.id) {
          return { state, events };
        }
        const val = getSellPropertyValue(tile);
        tile.auctionState = {
          status: 'UNOPENED',
          currentBid: 0,
          leaderId: null,
          bidOrder: [],
          deposits: {},
          eliminatedPlayerIds: [],
          finalOwnerId: null,
          finalPrice: 0,
        };
        debtor.cash += val;
        events.push({
          type: 'CASH_CHANGE',
          playerId: debtor.id,
          delta: val,
          label: `+${formatShortVnd(val)} Bán Bến Xe`,
          counterpartyId: 'BANK',
        });
        events.push({ type: 'ASSET_SOLD', tileIndex: tile.index, kind: 'PROPERTY', playerId: debtor.id });
        events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
        addLog(state, `${debtor.name} bán đứt ${tile.name} thu ${formatShortVnd(val)}.`, 'warn');
        processDebtQueue(state, events);
        return { state, events };
      }

      if (tile.ownerId !== debtor.id || tile.buildingLevel > 0) return { state, events };
      const value = getSellPropertyValue(tile);
      tile.ownerId = null;
      debtor.cash += value;
      events.push({
        type: 'CASH_CHANGE',
        playerId: debtor.id,
        delta: value,
        label: `+${formatShortVnd(value)} Bán đất`,
        counterpartyId: 'BANK',
      });
      events.push({ type: 'ASSET_SOLD', tileIndex: tile.index, kind: 'PROPERTY', playerId: debtor.id });
      events.push({ type: 'TILE_CHANGED', tileIndex: tile.index });
      addLog(state, `${debtor.name} bán đất ${tile.name} thu ${formatShortVnd(value)}.`, 'warn');
      processDebtQueue(state, events);
      return { state, events };
    }

    case 'DECLARE_BANKRUPTCY': {
      if (state.phase !== 'DEBT_LIQUIDATION' || state.debtQueue.length === 0) return { state, events };
      const debt = state.debtQueue[0];
      const debtor = state.players.find((p) => p.id === debt.debtorId);
      if (!debtor) return { state, events };
      // Chỉ cho phép tuyên bố phá sản khi bán sạch tài sản cũng không đủ trả khoản nợ
      if (debtor.cash + getTotalLiquidatableValue(state.tiles, debtor.id) >= debt.amount) {
        return { state, events };
      }
      // Quy đổi toàn bộ giá trị thanh lý còn lại thành tiền để chuyển hết cho chủ nợ
      const liquidationTotal = getTotalLiquidatableValue(state.tiles, debtor.id);
      debtor.cash += liquidationTotal;
      executeBankruptcy(state, events, debtor, debt.creditorId);
      processDebtQueue(state, events);
      return { state, events };
    }
  }
}

export const AUCTION_STEP_EXPORT = AUCTION_BID_INCREMENT;
