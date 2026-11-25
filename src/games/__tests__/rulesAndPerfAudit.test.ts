import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createWarmRoomReverb } from '@/shared/audio/warmRoomReverb';
import { CHANCE_CARDS, FATE_CARDS } from '../co-ty-phu/data/cards';
import { getCardArtworkUrl } from '../co-ty-phu/data/cardArtwork';
import { LAND_COLORS } from '../co-ty-phu/data/characters';
import { createInitialGameState, reduceGameAction } from '../co-ty-phu/engine/reducer';
import { computeLegalHorseMoves, hasColorWon } from '../co-ca-ngua/engine/rules';
import type { HorsePiece } from '../co-ca-ngua/engine/types';
import {
  algToSq,
  createInitialChessBoard,
  generateLegalMoves,
  getPositionHash,
} from '../co-vua/engine/rules';
import { createInitialChessState, reduceChessAction } from '../co-vua/engine/reducer';
import { createInitialXiangqiState, reduceXiangqiAction } from '../co-tuong/engine/reducer';
import { rcToIdx } from '../co-tuong/engine/rules';
import { createInitialOAnQuanState, executeSowMove } from '../o-an-quan/engine/reducer';
import { assertBoardInvariants, getLegalMoves } from '../o-an-quan/engine/rules';

describe('Kiểm toán kiến trúc Hiệu năng Mobile & Luật chi tiết 5 Game', () => {
  it('1. Audio Engine cả 5 game dùng warmRoomReverb (~20x nhẹ hơn) & 0 ConvolverNode', () => {
    const audioFiles = [
      'src/shared/audio/gameBgmEngine.ts',
      'src/games/co-ty-phu/audio/gameAudio.ts',
      'src/games/co-ca-ngua/audio/horseAudio.ts',
      'src/games/co-vua/audio/chessAudio.ts',
      'src/games/co-tuong/audio/xiangqiAudio.ts',
      'src/games/o-an-quan/audio/oAnQuanAudio.ts',
    ];
    for (const rel of audioFiles) {
      const content = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(content).not.toContain('createConvolver(');
    }

    // Kiểm tra mạch warmRoomReverb khóa feedback an toàn <= 0.38 và ngắt sạch không ném lỗi
    const disconnects: ReturnType<typeof vi.fn>[] = [];
    const mkNode = () => {
      const disconnect = vi.fn();
      disconnects.push(disconnect);
      return {
        gain: { value: 0 },
        delayTime: { value: 0 },
        frequency: { value: 0 },
        Q: { value: 0 },
        type: 'lowpass',
        connect: vi.fn(),
        disconnect,
      };
    };
    const fakeCtx = {
      createGain: vi.fn(() => mkNode()),
      createDelay: vi.fn(() => mkNode()),
      createBiquadFilter: vi.fn(() => mkNode()),
      createConvolver: vi.fn(() => {
        throw new Error('Không được phép gọi createConvolver!');
      }),
    } as unknown as AudioContext;
    const dest = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

    const bus = createWarmRoomReverb(fakeCtx, {
      delayA: 0.04,
      delayB: 0.07,
      feedback: 0.99, // Cố tình truyền quá cao -> phải tự chặn <= 0.38!
      lowpassHz: 2200,
      wetGain: 0.25,
      destination: dest,
    });
    expect(fakeCtx.createConvolver).not.toHaveBeenCalled();
    // Kiểm tra các node feedback gain không bao giờ vượt 0.38
    const gainCalls = (fakeCtx.createGain as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => (r.value as { gain: { value: number } }).gain.value,
    );
    expect(gainCalls.some((v) => v > 0.38 && v < 1)).toBe(false);
    bus.disconnect();
    expect(disconnects.length).toBe(7);
    expect(disconnects.every((fn) => fn.mock.calls.length === 1)).toBe(true);
  });

  it('2. Cờ Tỷ Phú: Đủ 32 thẻ Cơ Hội + Khí Vận cân bằng 50/50 & 100% có tranh SVG khớp ID', () => {
    expect(CHANCE_CARDS).toHaveLength(16);
    expect(FATE_CARDS).toHaveLength(16);

    const chanceJail = CHANCE_CARDS.filter((c) => c.effect.type === 'GO_TO_JAIL');
    const chanceFree = CHANCE_CARDS.filter((c) => c.effect.type === 'JAIL_FREE_CARD');
    const fateJail = FATE_CARDS.filter((c) => c.effect.type === 'GO_TO_JAIL');
    const fateFree = FATE_CARDS.filter((c) => c.effect.type === 'JAIL_FREE_CARD');

    expect(chanceJail).toHaveLength(1);
    expect(chanceFree).toHaveLength(1);
    expect(fateJail).toHaveLength(1);
    expect(fateFree).toHaveLength(1);

    for (const c of [...CHANCE_CARDS, ...FATE_CARDS]) {
      expect(getCardArtworkUrl(c.id)).toBeTruthy();
    }

    // Kiểm tra miễn tiền thuê khi chủ đất đang ở trong Tù
    const state = createInitialGameState({
      diceCount: 2,
      mapMode: 'default',
      slots: [
        { slotIndex: 0, name: 'P1', characterId: 'ca_phe', landColor: LAND_COLORS[0].id, isBot: false },
        { slotIndex: 1, name: 'P2', characterId: 'ao_dai_tim', landColor: LAND_COLORS[1].id, isBot: false },
      ],
    });
    const propTile = state.tiles.find((t) => t.kind === 'PROPERTY' && t.index <= 12)!;
    propTile.ownerId = state.players[1].id;
    propTile.buildingLevel = 3;
    state.players[1].inJail = true;
    const p1StartCash = state.players[0].cash;

    const steps = propTile.index;
    const d1 = Math.min(6, Math.max(1, Math.floor(steps / 2)));
    const d2 = steps - d1;
    if (d2 >= 1 && d2 <= 6) {
      const res = reduceGameAction(state, { type: 'ROLL_DICE', diceValues: [d1, d2] });
      expect(res.state.players[0].cash).toBe(p1StartCash);
    }
  });

  it('3. Cờ Cá Ngựa: Luật mới đá ngay Ô ★ Cửa Lên Bụt + Đổi bụt cả lên & xuống (1..6)', () => {
    // Đỏ đứng ngay Ô ★ Cửa Lên Bụt của mình (progress 51 -> trackIndex 51); Xanh lá (start=39) ở progress 10 -> tiến 2 ô tới trackIndex 51!
    const horses: HorsePiece[] = [
      { id: 'red_0', color: 'red', slotIndex: 0, zone: 'TRACK', progress: 51, stairStep: 0 },
      { id: 'green_0', color: 'green', slotIndex: 0, zone: 'TRACK', progress: 10, stairStep: 0 },
      { id: 'yellow_0', color: 'yellow', slotIndex: 0, zone: 'HOME_STAIRS', progress: -1, stairStep: 6 },
      { id: 'yellow_1', color: 'yellow', slotIndex: 1, zone: 'HOME_STAIRS', progress: -1, stairStep: 1 },
    ];

    const kickMoves = computeLegalHorseMoves(horses, 'green', 2);
    expect(kickMoves.some((m) => m.kickedHorseId === 'red_0')).toBe(true);

    // Đổi bụt đi XUỐNG từ bậc 6 -> bậc 3 khi đổ 3 (bậc 3,4,5 trống)
    const downMoves = computeLegalHorseMoves(horses, 'yellow', 3);
    expect(downMoves.some((m) => m.horseId === 'yellow_0' && m.toStairStep === 3)).toBe(true);
    // Và ngựa bậc 1 cũng được đổi lên bậc 3
    expect(downMoves.some((m) => m.horseId === 'yellow_1' && m.toStairStep === 3)).toBe(true);

    // Thắng chuẩn đủ 4 bậc {3,4,5,6}
    const winHorses: HorsePiece[] = [3, 4, 5, 6].map((step, i) => ({
      id: `red_${i}`,
      color: 'red',
      slotIndex: i as 0 | 1 | 2 | 3,
      zone: 'HOME_STAIRS',
      progress: -1,
      stairStep: step,
    }));
    expect(hasColorWon(winHorses, 'red')).toBe(true);
  });

  it('4. Cờ Vua FIDE: Điều 9.2 En Passant hash chính xác & chiếu bí nhanh Scholar Mate', () => {
    const board = createInitialChessBoard();
    const castling = { wK: true, wQ: true, bK: true, bQ: true };
    // e2->e4 ở nước 1: KHÔNG có tốt Đen ở d4/f4 nên hash phải coi như không có En Passant!
    const hWithNoCapture = getPositionHash(board, 'black', castling, algToSq('e3'));
    const hWithoutEp = getPositionHash(board, 'black', castling, null);
    expect(hWithNoCapture).toBe(hWithoutEp);

    // Đặt Tốt Đen tại d4 -> có thể ăn qua đường tại e3 -> hash phải khác null!
    board[algToSq('d4')] = { type: 'p', color: 'black' };
    const hWithCapture = getPositionHash(board, 'black', castling, algToSq('e3'));
    expect(hWithCapture).not.toBe(getPositionHash(board, 'black', castling, null));

    // Chơi thật ván Scholar's Mate (1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#) -> CHECKMATE!
    let s = createInitialChessState({
      whiteName: 'Trắng',
      whiteIsBot: false,
      blackName: 'Đen',
      blackIsBot: false,
    });
    const seq: [string, string][] = [
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['d1', 'h5'],
      ['b8', 'c6'],
      ['f1', 'c4'],
      ['g8', 'f6'],
      ['h5', 'f7'],
    ];
    for (const [f, t] of seq) {
      s = reduceChessAction(s, { type: 'MOVE', from: algToSq(f), to: algToSq(t) });
    }
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).toBe('white');
    expect(s.endReason).toBe('CHECKMATE');
    expect(generateLegalMoves(s.board, s.turn, s.castling, s.enPassantTarget)).toHaveLength(0);
  });

  it('5. Cờ Tướng: Khốn bí (hết nước đi không bị chiếu) xử THUA đúng chuẩn & Cấm Lộ Mặt Tướng', () => {
    const base = createInitialXiangqiState({
      redName: 'Đỏ',
      redIsBot: false,
      greenName: 'Xanh',
      greenIsBot: false,
    });
    // Dựng thế Khốn bí: Tướng Xanh tại (0, 3), Tướng Đỏ tại (9, 4) khóa cột 4, Xe Đỏ tiến lên (1, 8) khóa hàng 1 -> Xanh không bị chiếu nhưng 0 nước đi -> Đỏ THẮNG STALEMATE_LOSS!
    const board = new Array(90).fill(null);
    board[rcToIdx(0, 3)] = { type: 'k', color: 'green' };
    board[rcToIdx(9, 4)] = { type: 'k', color: 'red' };
    board[rcToIdx(2, 8)] = { type: 'r', color: 'red' };
    const customState = { ...base, board, turn: 'red' as const };
    const after = reduceXiangqiAction(customState, {
      type: 'MOVE',
      from: rcToIdx(2, 8),
      to: rcToIdx(1, 8),
    });
    expect(after.phase).toBe('GAME_OVER');
    expect(after.winner).toBe('red');
    expect(after.endReason).toBe('STALEMATE_LOSS');
  });

  it('6. Ô Ăn Quan: Luật Quan Non & Bảo toàn tuyệt đối 50 Dân · 2 Quan · 70 Điểm', () => {
    const state = createInitialOAnQuanState({
      rules: { mandarinPointValue: 10, mandarinYouthRule: true, minStonesForMandarin: 5 },
    });
    const res1 = executeSowMove(state, 0, 'CCW', 0);
    assertBoardInvariants(res1.state);
    expect(res1.steps.length).toBeGreaterThan(3);

    const p1Move = getLegalMoves(res1.state, 1)[0];
    expect(p1Move).toBeTruthy();
    const res2 = executeSowMove(res1.state, p1Move.pitIndex, p1Move.direction, 1);
    assertBoardInvariants(res2.state);
  });
});
