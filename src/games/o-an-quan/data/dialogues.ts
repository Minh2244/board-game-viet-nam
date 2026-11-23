import { cryptoRandomInt } from '@/shared/crypto/random';

export type DialogueTopic =
  | 'thinking'
  | 'capture'
  | 'combo'
  | 'mandarin'
  | 'lost_mandarin'
  | 'refill_self'
  | 'refill_borrow'
  | 'repaid_debt';

const DIALOGUES: Record<DialogueTopic, readonly string[]> = {
  thinking: [
    'Đi ô nào lời nhất ta...',
    'Chờ mình tính nước này nha!',
    'Để xem rải trái hay phải đây...',
  ],
  capture: [
    'Ăn gọn một mẻ!',
    'Hốt sạch ô này về giỏ!',
    'Nước đi chuẩn không cần chỉnh!',
  ],
  combo: [
    'Combo liên hoàn quá đã!',
    'Ăn chặp một dây luôn nè!',
    'Quá trời sỏi bay về giỏ rồi!',
  ],
  mandarin: [
    'Ới giời, hốt trọn ổ Quan rồi!',
    'Quan lớn về tay mình nha!',
    'Một phát ăn ngay +10 điểm Quan!',
  ],
  lost_mandarin: [
    'Ối, mất trắng ô Quan rồi!',
    'Chết dở, sơ hở cái mất Quan!',
    'Khoan đã, để mình gỡ lại bàn sau!',
  ],
  refill_self: [
    'Trống sân rồi, rải lại 5 dân nào!',
    'Xuất 5 dân gây giống đánh tiếp!',
  ],
  refill_borrow: [
    'Cho mình vay tạm mấy viên dân nhé!',
    'Hết dân rồi, cho mượn chút lát trả!',
  ],
  repaid_debt: [
    'Ăn được rồi, mình trả nợ dân liền nè!',
    'Sòng phẳng nhé, trả đủ sỏi vừa vay!',
  ],
};

export function pickFolkDialogue(topic: DialogueTopic): string {
  const pool = DIALOGUES[topic];
  return pool[cryptoRandomInt(0, pool.length - 1)];
}
