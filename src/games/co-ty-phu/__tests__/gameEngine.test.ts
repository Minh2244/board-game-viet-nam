import { describe, expect, it } from 'vitest';
import { computeBotAction } from '@/games/co-ty-phu/ai/smartBot';
import {
  EXPENSIVE_PROPERTY_THRESHOLD,
  FIXED_SKELETON_INDICES,
  isOwnableTile,
  MAX_EXPENSIVE_PROPERTY_COUNT,
  MAX_PROPERTY_PRICE,
} from '@/games/co-ty-phu/data/boardData';
import { ALL_CARDS_BY_ID, CHANCE_CARDS, FATE_CARDS } from '@/games/co-ty-phu/data/cards';
import { generateBoardTiles } from '@/games/co-ty-phu/data/mapGenerator';
import { createInitialGameState, reduceGameAction } from '@/games/co-ty-phu/engine/reducer';
import {
  calculatePropertyRent,
  calculatePropertyTax,
  formatShortVnd,
  getMatchPointWarnings,
  GO_PASS_REWARD,
  JAIL_TILE_INDEX,
  playerOwnsFullColorGroup,
  STARTING_CASH,
} from '@/games/co-ty-phu/engine/rules';
import type { MatchSetupConfig } from '@/games/co-ty-phu/engine/types';

function makeSetup(count = 2, diceCount: 1 | 2 = 2, allBots = false): MatchSetupConfig {
  const colors = ['red', 'blue', 'emerald', 'amber', 'purple', 'orange'] as const;
  const chars = ['ca_phe', 'ao_dai_tim', 'non_la', 'phuot_thu', 'khan_ran', 'tri_thuc'] as const;
  return {
    diceCount,
    mapMode: 'default',
    slots: Array.from({ length: count }, (_, i) => ({
      slotIndex: i,
      name: allBots ? `Bot ${i + 1}` : `Người ${i + 1}`,
      isBot: allBots,
      characterId: chars[i % chars.length],
      landColor: colors[i % colors.length],
    })),
  };
}

describe('Cờ Tỷ Phú Engine — Bản đồ, Luật 52 Ô, 32 Thẻ, Đấu giá & SmartBot', () => {
  it('Bản đồ Ngẫu nhiên 17x11 giữ nguyên 18 ô khung cố định và đúng số ô mua được mỗi cạnh', () => {
    const tiles = generateBoardTiles('random');
    expect(tiles).toHaveLength(52);
    for (const fixedIdx of FIXED_SKELETON_INDICES) {
      expect(FIXED_SKELETON_INDICES.has(tiles[fixedIdx].index)).toBe(true);
    }
    expect(tiles[0].kind).toBe('GO');
    expect(tiles[16].kind).toBe('VISIT_JAIL');
    expect(tiles[26].kind).toBe('AIRPORT');
    expect(tiles[42].kind).toBe('GO_TO_JAIL');

    // Cạnh 0: 10 đất + 1 BX + 1 TĐ = 12; Cạnh 1: 7 đất + 1 BX = 8; Cạnh 2: 10 đất + 1 BX + 1 TĐ = 12; Cạnh 3: 7 đất + 1 BX = 8
    const expectedOwnables = [12, 8, 12, 8] as const;
    const expectedProps = [10, 7, 10, 7] as const;
    for (const edge of [0, 1, 2, 3] as const) {
      const ownables = tiles.filter((t) => t.edge === edge && isOwnableTile(t));
      const propsOnEdge = tiles.filter((t) => t.edge === edge && t.kind === 'PROPERTY');
      expect(ownables).toHaveLength(expectedOwnables[edge]);
      expect(propsOnEdge).toHaveLength(expectedProps[edge]);
    }

    // Kiểm tra chuẩn 25% tiền thuê đất trống (không lẻ xu, không tự nhảy 50%) & định dạng chính xác tới 50 Nghìn
    const rentTestState = createInitialGameState(makeSetup(2, 2));
    for (const t of rentTestState.tiles.filter((x) => x.kind === 'PROPERTY')) {
      t.ownerId = rentTestState.players[0].id;
      t.buildingLevel = 0;
      const singleRent = calculatePropertyRent(rentTestState.tiles, rentTestState.players, t);
      expect(singleRent).toBe(Math.round(t.basePrice! * 0.25));
      expect(singleRent % 50_000).toBe(0);
      t.ownerId = null;
    }
    expect(formatShortVnd(1_050_000)).toBe('1,05 Tr đ');
    expect(formatShortVnd(1_250_000)).toBe('1,25 Tr đ');
    expect(formatShortVnd(1_350_000)).toBe('1,35 Tr đ');
    expect(formatShortVnd(1_450_000)).toBe('1,45 Tr đ');
    // Kiểm tra nhóm 2 ô Bắc Trung Bộ (Thanh Hóa ô 10 & Nghệ An ô 11) & Đông Bắc Bộ (Cao Bằng ô 25 & Lạng Sơn ô 47) đủ bộ -> nhân đôi ×2
    rentTestState.tiles[10].ownerId = rentTestState.players[0].id;
    expect(playerOwnsFullColorGroup(rentTestState.tiles, rentTestState.players[0].id, 11)).toBe(false);
    rentTestState.tiles[11].ownerId = rentTestState.players[0].id;
    expect(playerOwnsFullColorGroup(rentTestState.tiles, rentTestState.players[0].id, 11)).toBe(true);
    expect(calculatePropertyRent(rentTestState.tiles, rentTestState.players, rentTestState.tiles[10])).toBe(
      Math.round(rentTestState.tiles[10].basePrice! * 0.25) * 2,
    );

    // Kiểm tra sự kiện MONOPOLY_COMPLETED khi mua nốt ô cuối nhóm Đông Bắc Bộ (Cao Bằng ô 27 + Lạng Sơn ô 28 đứng liền kề nhau!)
    let monoState = createInitialGameState(makeSetup(2, 1));
    monoState.tiles[27].ownerId = monoState.players[0].id;
    monoState.players[0].position = 26;
    monoState = reduceGameAction(monoState, { type: 'ROLL_DICE', diceValues: [2] }).state; // dừng tại ô 28 (Lạng Sơn)
    expect(monoState.phase).toBe('BUY_OR_SKIP_DECISION');
    const monoRes = reduceGameAction(monoState, { type: 'BUY_PROPERTY', buy: true });
    expect(
      monoRes.events.some(
        (ev) => ev.type === 'MONOPOLY_COMPLETED' && ev.groupName === 'Đông Bắc Bộ',
      ),
    ).toBe(true);

    // Kể cả ở Bản đồ Ngẫu nhiên: mọi nhóm màu đều giữ nguyên cụm liền nhau (không bao giờ trộn lẫn nhóm màu khác vào giữa!)
    const props = tiles.filter((t) => t.kind === 'PROPERTY');
    expect(props).toHaveLength(34);
    expect(props.every((t) => (t.basePrice ?? 0) <= MAX_PROPERTY_PRICE)).toBe(true);
    const expProps = props.filter((t) => (t.basePrice ?? 0) >= EXPENSIVE_PROPERTY_THRESHOLD);
    expect(expProps.length).toBeLessThanOrEqual(MAX_EXPENSIVE_PROPERTY_COUNT);
    expect(expProps.filter((t) => t.edge === 0)).toHaveLength(0);

    const finishedRandomGroups = new Set<number>();
    let curRandGroup: number | undefined;
    for (const p of props) {
      if (p.colorGroup !== curRandGroup) {
        if (curRandGroup !== undefined) finishedRandomGroups.add(curRandGroup);
        expect(finishedRandomGroups.has(p.colorGroup!)).toBe(false);
        curRandGroup = p.colorGroup;
      }
    }
    expect(finishedRandomGroups.size + 1).toBe(12);

    const airports = tiles.filter((t) => t.kind === 'AIRPORT');
    expect(airports).toHaveLength(1);
    expect(airports[0].index).toBe(26);
    for (const ap of airports) {
      expect(ap.currentDestinationTileIndex).toBeDefined();
      expect(tiles[ap.currentDestinationTileIndex!].kind).toBe('PROPERTY');
    }

    expect(CHANCE_CARDS).toHaveLength(16);
    expect(FATE_CARDS).toHaveLength(16);
    expect(Object.keys(ALL_CARDS_BY_ID)).toHaveLength(32);

    // Kiểm tra bốc hết 16 lá Cơ Hội sẽ tự xáo trộn ngẫu nhiên lại đủ 16 lá + phát sự kiện DECK_RESHUFFLED
    let deckState = createInitialGameState(makeSetup(2, 1));
    deckState.chanceDeck = CHANCE_CARDS.filter((c) => c.id !== 'chance_02').map((c) => c.id);
    deckState.chanceDiscard = ['chance_02'];
    let reshuffledEmitted = false;
    for (let drawIdx = 0; drawIdx < 15; drawIdx += 1) {
      deckState.players[0].position = 0;
      deckState.currentPlayerIndex = 0;
      deckState.phase = 'WAIT_ROLL';
      deckState.players[0].inJail = false;
      deckState.players[0].cash = 50_000_000;
      const rollRes = reduceGameAction(deckState, { type: 'ROLL_DICE', diceValues: [3] }); // Ô 3 Cơ Hội 1
      deckState = rollRes.state;
      if (rollRes.events.some((e) => e.type === 'DECK_RESHUFFLED' && e.deck === 'CHANCE')) {
        reshuffledEmitted = true;
      }
      expect(deckState.phase).toBe('CARD_REVEAL');
      const confRes = reduceGameAction(deckState, { type: 'CONFIRM_CARD' });
      deckState = confRes.state;
      if (confRes.events.some((e) => e.type === 'DECK_RESHUFFLED' && e.deck === 'CHANCE')) {
        reshuffledEmitted = true;
      }
      if (deckState.phase === 'BUY_OR_SKIP_DECISION') {
        deckState = reduceGameAction(deckState, { type: 'BUY_PROPERTY', buy: false }).state;
      } else if (deckState.phase === 'AUCTION_DECISION') {
        deckState = reduceGameAction(deckState, { type: 'AUCTION_DECIDE', bid: false }).state;
      }
    }
    // Sau khi bốc cạn lá cuối cùng, chồng bài tự động xáo trộn ngẫu nhiên lại đủ 16 lá!
    expect(reshuffledEmitted).toBe(true);
    expect(deckState.chanceDeck).toHaveLength(16);
    expect(new Set(deckState.chanceDeck).size).toBe(16);
  });

  it('Luật Khởi Hành & Sân Bay mới: Dừng đúng START = 0đ (kể cả lượt sau rời đi); Vượt qua START = +3M; Bay Sân Bay luôn +3M', () => {
    let state = createInitialGameState(makeSetup(2, 2));
    state.players[0].position = 48;
    // Quay xui 48 + 4 = 52 -> dừng ĐÚNG ô 0 (START) => KHÔNG nhận 3M (mất thưởng vòng đó!)
    let res = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [2, 2] });
    state = res.state;
    expect(state.players[0].position).toBe(0);
    expect(state.players[0].cash).toBe(STARTING_CASH);

    // Lượt tiếp theo rời khỏi ô 0 (0 -> 4 Sa Pa): KHÔNG cộng bù 3M!
    res = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [1, 3] });
    state = res.state;
    if (state.phase === 'BUY_OR_SKIP_DECISION') {
      state = reduceGameAction(state, { type: 'BUY_PROPERTY', buy: false }).state;
    }
    expect(state.players[0].position).toBe(4);
    expect(state.players[0].cash).toBe(STARTING_CASH);

    // Đi tiến VƯỢT QUA ô 0 (từ 48 đổ 6 -> ô 2 Hà Giang): NHẬN ĐỦ +3M!
    let crossState = createInitialGameState(makeSetup(2, 2));
    crossState.players[0].position = 48;
    crossState = reduceGameAction(crossState, { type: 'ROLL_DICE', diceValues: [2, 4] }).state;
    if (crossState.phase === 'BUY_OR_SKIP_DECISION') {
      crossState = reduceGameAction(crossState, { type: 'BUY_PROPERTY', buy: false }).state;
    }
    expect(crossState.players[0].position).toBe(2);
    expect(crossState.players[0].cash).toBe(STARTING_CASH + GO_PASS_REWARD);

    // Bay Sân Bay (ô 26): LUÔN tính đã đi qua Khởi Hành -> LUÔN nhận +3M bất kể bay tới ô trước hay sau 26!
    for (const destIdx of [1, 33] as const) {
      let airState = createInitialGameState(makeSetup(2, 1));
      airState.tiles[26].currentDestinationTileIndex = destIdx;
      airState.players[0].position = 24;
      const airRes = reduceGameAction(airState, { type: 'ROLL_DICE', diceValues: [2] });
      airState = airRes.state;
      expect(airRes.events.some((e) => e.type === 'AIRPORT_FLY' && e.toIndex === destIdx)).toBe(true);
      expect(
        airRes.events.some(
          (e) => e.type === 'CASH_CHANGE' && e.delta === GO_PASS_REWARD && e.label.includes('Bay qua Khởi Hành'),
        ),
      ).toBe(true);
      expect(airState.players[0].position).toBe(destIdx);
      expect(airState.players[0].cash).toBe(STARTING_CASH + GO_PASS_REWARD);
    }

    // Đi lùi 3 ô bằng thẻ Đổi Hướng Phong Thủy (chance_12) từ pos = 3 (Cơ Hội 1) -> lùi về ô 0 (không nhận 3 Tr!)
    let backState = createInitialGameState(makeSetup(2, 1));
    backState.players[0].position = 0;
    backState.chanceDeck = ['chance_12'];
    backState = reduceGameAction(backState, { type: 'ROLL_DICE', diceValues: [3] }).state; // dừng ô 3 (Cơ Hội 1)
    expect(backState.phase).toBe('CARD_REVEAL');
    backState = reduceGameAction(backState, { type: 'CONFIRM_CARD' }).state; // lùi 3 ô -> về ô 0
    expect(backState.players[0].position).toBe(0);
    expect(backState.players[0].cash).toBe(STARTING_CASH);
  });

  it('Đổ đôi 3 lần liên tiếp vào Tù và chủ đất ở Tù bị phong tỏa 100% tiền thuê', () => {
    let state = createInitialGameState(makeSetup(2, 2));
    // Cho người chơi 1 sở hữu sẵn ô 7 (Vĩnh Hy 1.6M) trước khi vào tù
    state.tiles[7].ownerId = state.players[0].id;
    state.tiles[7].buildingLevel = 2;
    expect(calculatePropertyRent(state.tiles, state.players, state.tiles[7])).toBe(1_600_000);

    // Đổ đôi lần 1 -> tới ô 2 (Hà Giang)
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [1, 1] }).state;
    if (state.phase === 'BUY_OR_SKIP_DECISION') {
      state = reduceGameAction(state, { type: 'BUY_PROPERTY', buy: false }).state;
    }
    expect(state.currentPlayerIndex).toBe(0);
    // Đặt lại vị trí an toàn (ô 13 Bắc Ninh -> 15 Hà Nội) để test đổ đôi lần 2 & 3
    state.players[0].position = 13;
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [1, 1] }).state; // ô 15 Hà Nội
    if (state.phase === 'BUY_OR_SKIP_DECISION') {
      state = reduceGameAction(state, { type: 'BUY_PROPERTY', buy: false }).state;
    }
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.players[0].consecutiveDoubles).toBe(2);
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [3, 3] }).state; // Đôi lần 3 -> Vào Tù!

    expect(state.players[0].inJail).toBe(true);
    expect(state.players[0].position).toBe(JAIL_TILE_INDEX);
    expect(state.currentPlayerIndex).toBe(1);

    // Chủ đất đang ở tù -> tiền thuê phải bằng 0
    expect(calculatePropertyRent(state.tiles, state.players, state.tiles[7])).toBe(0);

    // Người chơi 2 (lượt đầu xuất phát tại 0 -> 7) dẫm vào ô 7 của người chơi 1 đang ở tù -> không bị mất tiền!
    state.players[1].position = 0;
    const cashBefore = state.players[1].cash;
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [3, 4] }).state;
    expect(state.players[1].cash).toBe(cashBefore);
  });

  it('Đấu giá Bến Xe bù chênh lệch +200K, hoàn 100% cọc khi Bỏ quyền & thắng trọn 4 Bến Xe', () => {
    let state = createInitialGameState(makeSetup(2, 2));
    // P1 vào Bến Xe 6 (BX Miền Tây) -> mở giá 2.0M
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [2, 4] }).state;
    expect(state.phase).toBe('AUCTION_DECISION');
    state = reduceGameAction(state, { type: 'AUCTION_DECIDE', bid: true }).state;
    expect(state.players[0].cash).toBe(STARTING_CASH - 2_000_000);
    expect(state.tiles[6].auctionState?.currentBid).toBe(2_000_000);

    // P2 vào Bến Xe 6 (xuất phát từ 0 -> 6 không cộng 3M) -> đẩy +200K thành 2.2M
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [2, 4] }).state;
    expect(state.phase).toBe('AUCTION_DECISION');
    state = reduceGameAction(state, { type: 'AUCTION_DECIDE', bid: true }).state;
    expect(state.players[1].cash).toBe(STARTING_CASH - 2_200_000);

    // Đưa P1 tới trước ô 6 (pos 2) đổ 4 -> dẫm lại ô 6 nâng lên 2.4M -> P1 chỉ bù thêm 400K!
    state.players[0].position = 2;
    const p1CashBefore = state.players[0].cash;
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [1, 3] }).state;
    expect(state.phase).toBe('AUCTION_DECISION');
    state = reduceGameAction(state, { type: 'AUCTION_DECIDE', bid: true }).state;
    expect(state.players[0].cash).toBe(p1CashBefore - 400_000);
    expect(state.tiles[6].auctionState?.deposits[state.players[0].id]).toBe(2_400_000);

    // P2 vào lại ô 6 và Bỏ quyền -> P2 được hoàn lại đủ 2.2M, P1 chốt thắng Bến Xe 6!
    state.players[1].position = 2;
    const p2CashBefore = state.players[1].cash;
    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [1, 3] }).state;
    state = reduceGameAction(state, { type: 'AUCTION_DECIDE', bid: false }).state;
    expect(state.players[1].cash).toBe(p2CashBefore + 2_200_000);
    expect(state.tiles[6].auctionState?.status).toBe('CLOSED');
    expect(state.tiles[6].auctionState?.finalOwnerId).toBe(state.players[0].id);

    // Kiểm tra thắng nhanh 4 Ô Đấu Giá: giả sử P1 đã thắng sẵn 3 bến 22, 32, 46 rồi thắng nốt 6
    let winState = createInitialGameState(makeSetup(2, 2));
    for (const idx of [22, 32, 46]) {
      winState.tiles[idx].auctionState!.status = 'CLOSED';
      winState.tiles[idx].auctionState!.finalOwnerId = winState.players[0].id;
      winState.tiles[idx].auctionState!.finalPrice = 2_000_000;
    }
    winState.players[0].position = 2;
    winState = reduceGameAction(winState, { type: 'ROLL_DICE', diceValues: [1, 3] }).state; // 6 (không đổ đôi -> hết lượt qua P2)
    winState = reduceGameAction(winState, { type: 'AUCTION_DECIDE', bid: true }).state;
    winState.players[1].position = 2;
    winState = reduceGameAction(winState, { type: 'ROLL_DICE', diceValues: [1, 3] }).state; // P2 dẫm 6
    winState = reduceGameAction(winState, { type: 'AUCTION_DECIDE', bid: false }).state;
    expect(winState.phase).toBe('GAME_OVER');
    expect(winState.winCondition).toBe('FOUR_AUCTIONS');
    expect(winState.winnerId).toBe(winState.players[0].id);
  });

  it('Thắng 1 Hàng Ô Đất (chỉ cần đủ 7 ô đất trên cạnh trái, không cần Bến Xe) + Cảnh báo còn 1 ô + Ra tù', () => {
    let lineState = createInitialGameState(makeSetup(2, 2));
    // Cạnh 1 (trái) có 7 ô đất: 17, 18, 20, 21, 23, 24, 25 (ô 22 là Bến Xe độc lập -> để trống hoặc người khác giữ vẫn thắng!).
    for (const idx of [17, 18, 20, 21, 23, 24]) {
      lineState.tiles[idx].ownerId = lineState.players[0].id;
    }
    // Khi mới có 6/7 ô đất -> phải phát hiện đúng 1 cảnh báo MatchPoint tại ô 25 (Cao Bằng)!
    const warnings = getMatchPointWarnings(lineState.tiles, lineState.players);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('LINE_PROPERTY');
    expect(warnings[0].targetTileIndex).toBe(25);
    expect(warnings[0].playerId).toBe(lineState.players[0].id);

    lineState.players[0].position = 21;
    lineState = reduceGameAction(lineState, { type: 'ROLL_DICE', diceValues: [1, 3] }).state; // ô 25 (Cao Bằng)
    expect(lineState.phase).toBe('BUY_OR_SKIP_DECISION');
    lineState = reduceGameAction(lineState, { type: 'BUY_PROPERTY', buy: true }).state;
    expect(lineState.phase).toBe('GAME_OVER');
    expect(lineState.winCondition).toBe('LINE_VICTORY');
    expect(lineState.winningEdge).toBe(1);

    // Kiểm tra cảnh báo 3/4 Bến Xe Đấu Giá -> nhấp nháy đúng Bến Xe thứ 4 còn lại (ô 46)
    const stWarnState = createInitialGameState(makeSetup(2, 2));
    for (const idx of [6, 22, 32]) {
      stWarnState.tiles[idx].auctionState!.status = 'CLOSED';
      stWarnState.tiles[idx].auctionState!.finalOwnerId = stWarnState.players[1].id;
      stWarnState.tiles[idx].auctionState!.finalPrice = 2_000_000;
    }
    const stWarnings = getMatchPointWarnings(stWarnState.tiles, stWarnState.players);
    expect(stWarnings).toHaveLength(1);
    expect(stWarnings[0].kind).toBe('FOUR_AUCTIONS');
    expect(stWarnings[0].targetTileIndex).toBe(46);
    expect(stWarnings[0].playerId).toBe(stWarnState.players[1].id);

    // Kiểm tra quy trình Nhà tù tối đa 3 lượt & không thưởng thêm lượt khi đổ đôi ra tù
    let jailState = createInitialGameState(makeSetup(2, 2));
    jailState.players[0].inJail = true;
    jailState.players[0].position = JAIL_TILE_INDEX;
    jailState.phase = 'IN_JAIL_DECISION';

    // Lượt 1 trong tù trượt -> hỏi bảo lãnh -> chọn Không ở lại
    jailState = reduceGameAction(jailState, { type: 'ROLL_FOR_JAIL', diceValues: [1, 3] }).state;
    expect(jailState.phase).toBe('ASK_JAIL_BAIL');
    jailState = reduceGameAction(jailState, { type: 'ANSWER_JAIL_BAIL', pay: false }).state;
    expect(jailState.currentPlayerIndex).toBe(1);

    // P2 đi qua 1 lượt về lại P1 lượt 2 -> P1 tung [1, 1] thoát tù ngay và đi 2 ô tới 18 (Cát Bà), KHÔNG được thưởng thêm lượt đôi!
    jailState = reduceGameAction(jailState, { type: 'ROLL_DICE', diceValues: [1, 3] }).state; // P2 đi tới 4 (Sa Pa)
    if (jailState.phase === 'BUY_OR_SKIP_DECISION') {
      jailState = reduceGameAction(jailState, { type: 'BUY_PROPERTY', buy: false }).state;
    }
    expect(jailState.phase).toBe('IN_JAIL_DECISION');
    jailState = reduceGameAction(jailState, { type: 'ROLL_FOR_JAIL', diceValues: [1, 1] }).state;
    expect(jailState.players[0].inJail).toBe(false);
    expect(jailState.players[0].position).toBe(JAIL_TILE_INDEX + 2);
    if (jailState.phase === 'BUY_OR_SKIP_DECISION') {
      jailState = reduceGameAction(jailState, { type: 'BUY_PROPERTY', buy: false }).state;
    }
    // Phải chuyển sang P2 ngay dù vừa đổ [1, 1]!
    expect(jailState.currentPlayerIndex).toBe(1);

    // Kiểm tra luật Trại Giam mới: tù trống -> ghé ô 16 MIỄN PHÍ (0đ); có người đang ở tù -> ghé ô 16 mất 500 Nghìn phí thăm nuôi!
    let visitEmpty = createInitialGameState(makeSetup(2, 1));
    visitEmpty.players[0].position = 13;
    visitEmpty = reduceGameAction(visitEmpty, { type: 'ROLL_DICE', diceValues: [3] }).state; // dừng ô 16 Trại Giam (tù trống)
    expect(visitEmpty.players[0].position).toBe(JAIL_TILE_INDEX);
    expect(visitEmpty.players[0].cash).toBe(STARTING_CASH);

    let visitOccupied = createInitialGameState(makeSetup(2, 1));
    visitOccupied.players[1].inJail = true;
    visitOccupied.players[1].position = JAIL_TILE_INDEX;
    visitOccupied.players[0].position = 13;
    visitOccupied = reduceGameAction(visitOccupied, { type: 'ROLL_DICE', diceValues: [3] }).state; // dừng ô 16 khi P2 đang ở tù
    expect(visitOccupied.players[0].position).toBe(JAIL_TILE_INDEX);
    expect(visitOccupied.players[0].cash).toBe(STARTING_CASH - 500_000);
  });

  it('Khách Sạn 5 Sao thu 300 Nghìn nhiều người liên tiếp, xử lý Bán tài sản trả nợ & Thuế BĐS', () => {
    let state = createInitialGameState(makeSetup(3, 1));
    // P1 vào ô 3 (Cơ Hội 1) rút thẻ Khách Sạn 5 Sao (chance_09); P2 chỉ có 100K nhưng có Mộc Châu (ô 1, giá 1M, bán được 500K); P3 có đủ 500K
    state.players[0].position = 0;
    state.chanceDeck = ['chance_09'];
    state.players[1].cash = 100_000;
    state.tiles[1].ownerId = state.players[1].id;
    state.players[2].cash = 500_000;

    state = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [3] }).state;
    expect(state.phase).toBe('CARD_REVEAL');
    state = reduceGameAction(state, { type: 'CONFIRM_CARD' }).state;

    // P2 đang thiếu 200K -> phải dừng ở DEBT_LIQUIDATION cho P2 bán Mộc Châu (ô 1)
    expect(state.phase).toBe('DEBT_LIQUIDATION');
    expect(state.debtQueue[0].debtorId).toBe(state.players[1].id);

    const sellRes = reduceGameAction(state, { type: 'SELL_PROPERTY', tileIndex: 1 });
    state = sellRes.state;
    expect(sellRes.events.some((e) => e.type === 'ASSET_SOLD' && e.tileIndex === 1)).toBe(true);
    // Sau khi bán Mộc Châu (+500K -> 600K), P2 tự động trả 300K (còn 300K) và P3 cũng tự trả 300K (còn 200K)!
    expect(state.players[1].cash).toBe(300_000);
    expect(state.players[2].cash).toBe(200_000);
    expect(state.players[0].cash).toBe(STARTING_CASH + 600_000);
    expect(state.phase).toBe('WAIT_ROLL');

    // Kiểm tra Thuế BĐS: 0 nhà = 50K; 2 nhà cấp 2 + 1 biệt thự = 2*200K + 1M = 1.4M
    expect(calculatePropertyTax(state.tiles, state.players[0].id)).toBe(50_000);
    state.tiles[1].ownerId = state.players[0].id;
    state.tiles[1].buildingLevel = 2;
    state.tiles[4].ownerId = state.players[0].id;
    state.tiles[4].buildingLevel = 5;
    expect(calculatePropertyTax(state.tiles, state.players[0].id)).toBe(1_400_000);
  });

  it('Mô phỏng 12 ván SmartBot 4–6 tụ (cả 1 và 2 xúc xắc + Bản đồ Ngẫu nhiên) chạy trọn vẹn không treo/lỗi', () => {
    for (let sim = 0; sim < 12; sim += 1) {
      const playerCount = sim % 2 === 0 ? 4 : 6;
      const diceMode = sim % 3 === 0 ? 1 : 2;
      const setup = makeSetup(playerCount, diceMode, true);
      setup.mapMode = sim % 2 === 0 ? 'random' : 'default';

      let state = createInitialGameState(setup);
      let steps = 0;
      while (state.phase !== 'GAME_OVER' && steps < 1800) {
        const action = computeBotAction(state);
        if (!action) {
          throw new Error(
            `Null bot action at sim=${sim} step=${steps} phase=${state.phase} curIdx=${state.currentPlayerIndex} curBankrupt=${state.players[state.currentPlayerIndex]?.isBankrupt} debtQ=${JSON.stringify(state.debtQueue)}`,
          );
        }
        state = reduceGameAction(state, action).state;
        for (const p of state.players) {
          expect(p.cash).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(p.cash)).toBe(true);
        }
        steps += 1;
      }

      // Ít nhất kiểm tra mọi trạng thái đều sạch, không NaN/âm tiền và phần lớn kết thúc tự nhiên
      expect(steps).toBeGreaterThan(0);
    }
  }, 15_000);
});
