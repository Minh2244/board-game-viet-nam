import {
  HORSE_COLOR_CONFIG,
  progressToTrackIndex,
  SAFE_DOOR_PROGRESS,
  SAFE_DOOR_TRACK_INDICES,
  TRACK_LENGTH,
} from '../engine/boardGeometry';
import {
  getHorseAtStairStep,
  getHorseAtTrackIndex,
  hasColorWon,
} from '../engine/rules';
import type {
  CoCaNguaState,
  HorseBotDifficulty,
  HorseColor,
  HorsePiece,
  LegalHorseMove,
} from '../engine/types';

export interface HorseHintResult {
  move: LegalHorseMove;
  explanationVi: string;
}

/**
 * Loại bỏ các nước DEPLOY trùng nhau (4 con ngựa cùng trong chuồng có giá trị chiến thuật như nhau)
 * để Bot không bị thiên lệch xác suất khi lấy mẫu ngẫu nhiên.
 */
function deduplicateMoves(moves: readonly LegalHorseMove[]): LegalHorseMove[] {
  const result: LegalHorseMove[] = [];
  let hasDeploy = false;
  for (const m of moves) {
    if (m.kind === 'DEPLOY') {
      if (hasDeploy) continue;
      hasDeploy = true;
    }
    result.push(m);
  }
  return result;
}

/** Kiểm tra nhanh xem sau khi đi nước `move`, phe đó có thắng ngay lập tức (kín 3–4–5–6) không */
function willMoveWinImmediately(horses: readonly HorsePiece[], move: LegalHorseMove): boolean {
  if (move.kind !== 'ENTER_STAIRS' && move.kind !== 'CLIMB_STAIRS') return false;
  const simulated = horses.map((h) =>
    h.id === move.horseId
      ? { ...h, zone: 'HOME_STAIRS' as const, progress: -1, stairStep: move.toStairStep }
      : h,
  );
  return hasColorWon(simulated, move.color);
}

/** Tìm bậc bụt cao nhất đang còn trống (từ 6 lùi về 1) */
function getHighestEmptyStairStep(horses: readonly HorsePiece[], color: HorseColor): number {
  for (let step = 6; step >= 1; step -= 1) {
    if (!getHorseAtStairStep(horses, color, step)) return step;
  }
  return 0;
}

/**
 * Đếm số quân ngựa đối phương có khả năng đá được vị trí `targetTrackIndex` ngay trong 1 lượt gieo (1..6).
 * Lưu ý: Kể cả 4 Ô Cửa Lên Bụt ★ vẫn có thể bị đá bình thường khi chưa leo lên bậc bụt 1–6!
 */
function countThreateningEnemies(
  horses: readonly HorsePiece[],
  myColor: HorseColor,
  targetTrackIndex: number,
  ignoreHorseId?: string | null,
): number {
  let threats = 0;
  for (const enemy of horses) {
    if (enemy.color === myColor || enemy.zone !== 'TRACK' || enemy.id === ignoreHorseId) continue;
    if (enemy.progress >= SAFE_DOOR_PROGRESS) continue;

    const enemyTrackIdx = progressToTrackIndex(enemy.color, enemy.progress);
    const dist = (targetTrackIndex - enemyTrackIdx + TRACK_LENGTH) % TRACK_LENGTH;
    if (dist < 1 || dist > 6) continue;
    // Đối phương không thể đi lố cửa chuồng của họ
    if (enemy.progress + dist > SAFE_DOOR_PROGRESS) continue;

    // Kiểm tra xem có quân nào chắn giữa đối phương và ô đích không
    let blocked = false;
    for (let s = 1; s < dist; s += 1) {
      const midIdx = progressToTrackIndex(enemy.color, enemy.progress + s);
      const midHorse = getHorseAtTrackIndex(horses, midIdx);
      if (midHorse && midHorse.id !== ignoreHorseId) {
        blocked = true;
        break;
      }
    }
    if (!blocked) threats += 1;
  }
  return threats;
}

/** Kiểm tra ô `trackIndex` có phải ô Xuất Phát của một đối phương vẫn còn ngựa trong chuồng không */
function isActiveEnemyStartSquare(
  horses: readonly HorsePiece[],
  myColor: HorseColor,
  trackIndex: number,
): boolean {
  for (const enemy of horses) {
    if (enemy.color === myColor || enemy.zone !== 'STABLE') continue;
    if (HORSE_COLOR_CONFIG[enemy.color].startTrackIndex === trackIndex) {
      return true;
    }
  }
  return false;
}

/** Chấm điểm chiến thuật cho từng nước đi hợp lệ */
function evaluateMoveScore(
  state: CoCaNguaState,
  move: LegalHorseMove,
  difficulty: HorseBotDifficulty,
): number {
  const horses = state.horses;
  const myColor = move.color;
  const isHard = difficulty === 'hard';

  // 1. THẮNG NGAY LẬP TỨC (xếp kín 4 bậc 3–4–5–6) -> Ưu tiên tuyệt đối!
  if (willMoveWinImmediately(horses, move)) {
    return 100_000;
  }

  let score = 0;
  const ownHorses = horses.filter((h) => h.color === myColor);
  const trackCount = ownHorses.filter((h) => h.zone === 'TRACK').length;
  const stairHorses = ownHorses.filter((h) => h.zone === 'HOME_STAIRS');
  const horsesNotOnWinStairs = ownHorses.filter(
    (h) => !(h.zone === 'HOME_STAIRS' && h.stairStep >= 3 && h.stairStep <= 6),
  ).length;
  const highestEmptyStair = getHighestEmptyStairStep(horses, myColor);

  // 2. LEO BỤT TỪ Ô AN TOÀN (ENTER_STAIRS)
  if (move.kind === 'ENTER_STAIRS') {
    const step = move.toStairStep;
    const anotherOwnNearDoor = ownHorses.some(
      (h) => h.id !== move.horseId && h.zone === 'TRACK' && h.progress >= 43,
    );

    if (step === highestEmptyStair && step >= 3) {
      // Xếp từ đỉnh cao nhất xuống (6 -> 5 -> 4 -> 3): KHÔNG BAO GIỜ tự chặn đường mình!
      score += 920 + step * 35;
    } else if (step >= 3) {
      score += 560 + step * 30;
      // Ở mức Cao Thủ: nếu vẫn còn nhiều ngựa phía sau mà lại chui vào bậc 3 khi bậc 6 còn trống -> giảm nhẹ điểm để ưu tiên bậc cao hơn
      if (isHard && step < highestEmptyStair && horsesNotOnWinStairs >= 2) {
        score -= (highestEmptyStair - step) * 65;
      }
    } else {
      // Bậc 1 hoặc 2: chưa tính thắng và dễ chắn cửa cầu thang!
      // Chỉ nên vào nếu có ngựa nhà đang áp sát cửa chuồng cần nhường chỗ, hoặc hết nước ngon hơn
      score += anotherOwnNearDoor ? 220 + step * 25 : isHard ? 55 + step * 15 : 130 + step * 20;
    }
    return score;
  }

  // 3. ĐỔI BỤT TRÊN CẦU THANG (CLIMB_STAIRS: lên hoặc xuống)
  if (move.kind === 'CLIMB_STAIRS') {
    const fromStep = move.fromStairStep;
    const toStep = move.toStairStep;
    const jumpGain = toStep - fromStep;

    if (jumpGain < 0) {
      // Lùi bụt xuống bậc thấp hơn: tránh tự phá thế thắng, chỉ chọn khi bắt buộc hoặc né nước đi chết ngoài đường đua!
      if (fromStep >= 3 && toStep <= 2) {
        score -= 480 + (fromStep - toStep) * 65;
      } else {
        score -= 220 + (fromStep - toStep) * 40;
      }
      return score;
    }

    if (fromStep <= 2 && toStep >= 3) {
      // Thoát khỏi bậc kẹt 1–2 lên thẳng khu chiến thắng 3–6 -> cực kỳ giá trị!
      score += 860 + toStep * 40;
      if (toStep === highestEmptyStair) score += 180;
    } else if (fromStep <= 2 && toStep === 2) {
      score += 240;
    } else {
      // Đang ở bậc 3..5 -> nhích lên bậc cao hơn (đặc biệt lên 6) để nhường bậc thấp cho ngựa sau!
      const needSpaceBelow = ownHorses.some(
        (h) => h.zone !== 'HOME_STAIRS' || h.stairStep < fromStep,
      );
      if (toStep === highestEmptyStair && needSpaceBelow) {
        score += 680 + jumpGain * 55;
      } else if (needSpaceBelow) {
        score += 420 + jumpGain * 45;
      } else {
        score += 180 + jumpGain * 20;
      }
    }
    return score;
  }

  // 4. XUẤT CHUỒNG (DEPLOY)
  if (move.kind === 'DEPLOY') {
    if (trackCount === 0) {
      score += 720; // Không có ngựa nào trên đường đua -> bắt buộc xuất ngay!
    } else if (trackCount === 1) {
      score += 410;
    } else if (trackCount === 2) {
      score += 250;
    } else {
      score += 140;
    }

    // Nếu đá được ngựa đối phương đang đứng chắn ngay ô xuất phát của mình!
    if (move.kickedHorseId) {
      const victim = horses.find((h) => h.id === move.kickedHorseId);
      score += 460 + (victim ? victim.progress * 11 : 100);
    }

    // Ở mức Khó: cân nhắc nếu có ngựa địch lăm le 1..6 ô ngay sau ô xuất phát
    if (isHard && move.toTrackIndex !== null && !move.kickedHorseId) {
      const threats = countThreateningEnemies(horses, myColor, move.toTrackIndex, move.horseId);
      score -= threats * 75;
    }
    return score;
  }

  // 5. DI CHUYỂN TRÊN ĐƯỜNG ĐUA 52 Ô (ADVANCE_TRACK)
  const fromIdx = move.fromTrackIndex!;
  const toIdx = move.toTrackIndex!;

  // Cơ bản: ưu tiên đẩy ngựa chạy xa hơn về gần Cửa Chuồng
  score += move.diceValue * 16 + move.toProgress * 3.8;

  // Vào đúng Ô Cửa Lên Bụt ★ của mình (progress = 51)! (Lưu ý: vẫn có thể bị đá nếu chưa lên bậc 1–6)
  if (move.toProgress === SAFE_DOOR_PROGRESS) {
    score += 560;
    if (stairHorses.length >= 2) score += 90;
  } else if (SAFE_DOOR_TRACK_INDICES.has(toIdx) && isHard) {
    // Chặn tạm cửa lên bụt của địch (chỉ có ích nhỏ vì địch vẫn đá được mình nếu đổ đúng số!)
    const blockingCloseEnemy = horses.some(
      (h) =>
        h.color !== myColor &&
        h.zone === 'TRACK' &&
        HORSE_COLOR_CONFIG[h.color].safeDoorTrackIndex === toIdx &&
        h.progress >= 44 &&
        h.progress < SAFE_DOOR_PROGRESS,
    );
    if (blockingCloseEnemy) score += 45;
  }

  // Đá bay ngựa đối phương!
  if (move.kickedHorseId) {
    const victim = horses.find((h) => h.id === move.kickedHorseId);
    const victimProgress = victim ? victim.progress : 10;
    score += 440 + victimProgress * 11;
  }

  // Đánh giá an toàn / thoát hiểm (Mức Thách Đấu & Cao Thủ)
  if (difficulty !== 'easy') {
    const threatsBefore = countThreateningEnemies(horses, myColor, fromIdx, move.horseId);
    const threatsAfter = countThreateningEnemies(
      horses,
      myColor,
      toIdx,
      move.kickedHorseId ?? move.horseId,
    );

    if (threatsBefore > 0 && threatsAfter === 0) {
      // Thoát hiểm ngoạn mục!
      score += 170 * threatsBefore + move.fromProgress * 2.4;
    }

    if (threatsAfter > 0) {
      // Nhảy vào tầm đá của đối phương -> phạt nặng hơn với ngựa đã đi xa!
      const dangerPenalty = isHard ? 145 : 105;
      score -= threatsAfter * (dangerPenalty + move.toProgress * 2.5);
    }

    if (isHard) {
      // Đứng ngay ô xuất phát của đối phương còn ngựa trong chuồng (dễ bị đá khi họ đổ 1 hoặc 6)
      if (isActiveEnemyStartSquare(horses, myColor, toIdx)) {
        score -= 90 + move.toProgress * 1.4;
      }

      // Đưa ngựa áp sát tầm 1 xúc xắc cuối cùng tới Ô An Toàn (progress 45..50)
      if (move.toProgress >= 45 && move.toProgress <= 50) {
        score += 65;
      }

      // Tránh chạy tới đứng sát ngay trước mũi quân mình (1..3 ô) dễ gây tự cản chân
      const blocksOwnBehind = ownHorses.some(
        (h) =>
          h.id !== move.horseId &&
          h.zone === 'TRACK' &&
          move.toProgress > h.progress &&
          move.toProgress - h.progress <= 3,
      );
      if (blocksOwnBehind && move.toProgress < SAFE_DOOR_PROGRESS) {
        score -= 35;
      }
    }
  }

  return score;
}

/**
 * Chọn nước đi tối ưu cho Máy AI theo 3 cấp độ:
 * - easy (Tập Chơi): 45% ngẫu nhiên vui vẻ, vẫn nhận ra nước thắng ngay.
 * - medium (Thách Đấu): Đánh giá chiến thuật cân bằng + dao động nhẹ tự nhiên.
 * - hard (Cao Thủ): Tối ưu xếp bậc 6→5→4→3, né tầm đá 1–6 ô, canh chặn Ô An Toàn.
 */
export function computeHorseBotMove(
  state: CoCaNguaState,
  difficulty: HorseBotDifficulty,
): LegalHorseMove | null {
  const uniqueMoves = deduplicateMoves(state.legalMoves);
  if (uniqueMoves.length === 0) return null;
  if (uniqueMoves.length === 1) return uniqueMoves[0];

  // Luôn bắt lấy nước thắng ngay ở mọi cấp độ
  const winningMove = uniqueMoves.find((m) => willMoveWinImmediately(state.horses, m));
  if (winningMove) return winningMove;

  if (difficulty === 'easy' && Math.random() < 0.45) {
    // Kể cả Máy Dễ cũng tránh lùi bụt vô nghĩa khi vẫn còn nước tiến hợp lệ khác
    const nonRetreat = uniqueMoves.filter(
      (m) => !(m.kind === 'CLIMB_STAIRS' && m.toStairStep < m.fromStairStep),
    );
    const pool = nonRetreat.length > 0 ? nonRetreat : uniqueMoves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const jitter = difficulty === 'easy' ? 180 : difficulty === 'medium' ? 28 : 4;
  let bestMove = uniqueMoves[0];
  let bestScore = -Infinity;

  for (const move of uniqueMoves) {
    const score = evaluateMoveScore(state, move, difficulty) + (Math.random() - 0.5) * jitter;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

/** Gợi ý nước đi tốt nhất + giải thích tiếng Việt ngắn gọn (dành cho nút 💡 Gợi ý ở chế độ Đấu Máy) */
export function computeHorseHint(state: CoCaNguaState): HorseHintResult | null {
  const uniqueMoves = deduplicateMoves(state.legalMoves);
  if (uniqueMoves.length === 0) return null;

  let bestMove = uniqueMoves[0];
  let bestScore = -Infinity;
  for (const move of uniqueMoves) {
    const score = evaluateMoveScore(state, move, 'hard');
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  let explanationVi = `Tiến ngựa thêm ${bestMove.diceValue} ô để áp sát Cửa Chuồng.`;

  if (willMoveWinImmediately(state.horses, bestMove)) {
    explanationVi = `Lên Bụt số ${bestMove.toStairStep} để xếp kín 4 bậc 3–4–5–6 và CHIẾN THẮNG ngay lập tức!`;
  } else if (bestMove.kickedColor) {
    const enemyName = HORSE_COLOR_CONFIG[bestMove.kickedColor].nameVi;
    explanationVi =
      bestMove.kind === 'DEPLOY'
        ? `Xuất chuồng ngay để ĐÁ bay ngựa ${enemyName} đang chắn cửa xuất phát!`
        : `Tiến ${bestMove.diceValue} ô để ĐÁ ngựa ${enemyName} về chuồng và giành lợi thế lớn!`;
  } else if (bestMove.kind === 'ENTER_STAIRS') {
    explanationVi =
      bestMove.toStairStep >= 3
        ? `Cho ngựa từ Cửa ★ leo thẳng lên Bụt số ${bestMove.toStairStep} (an toàn tuyệt đối trong cụm thắng 3–6)!`
        : `Cho ngựa vào Bụt số ${bestMove.toStairStep} để lên khu an toàn và mở trống Cửa ★ cho quân kế tiếp.`;
  } else if (bestMove.kind === 'CLIMB_STAIRS') {
    explanationVi =
      bestMove.toStairStep < bestMove.fromStairStep
        ? `Đổi bụt lùi từ bậc ${bestMove.fromStairStep} xuống Bụt số ${bestMove.toStairStep} để giữ an toàn cho quân ngoài đường đua!`
        : `Đổi bụt từ bậc ${bestMove.fromStairStep} lên Bụt số ${bestMove.toStairStep} để tiến sát thắng lợi và mở chỗ cho quân sau!`;
  } else if (bestMove.kind === 'ADVANCE_TRACK' && bestMove.toProgress === SAFE_DOOR_PROGRESS) {
    explanationVi = 'Đưa ngựa dừng đúng Ô Cửa Lên Bụt ★ để lượt sau leo bụt (lưu ý vẫn có thể bị đá nếu chưa lên bụt)!';
  } else if (bestMove.kind === 'DEPLOY') {
    explanationVi = `Tận dụng mặt ${bestMove.diceValue} xuất thêm ngựa ra đường đua (và được thêm lượt tung)!`;
  } else if (
    bestMove.kind === 'ADVANCE_TRACK' &&
    bestMove.fromTrackIndex !== null &&
    countThreateningEnemies(state.horses, bestMove.color, bestMove.fromTrackIndex, bestMove.horseId) > 0
  ) {
    explanationVi = `Đẩy ngựa thoát khỏi tầm đá của đối phương và tiến thêm ${bestMove.diceValue} ô an toàn!`;
  }

  return {
    move: bestMove,
    explanationVi,
  };
}
