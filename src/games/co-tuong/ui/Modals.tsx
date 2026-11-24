import { BookOpen, Crown, Handshake, RotateCcw, Trophy, X } from 'lucide-react';
import type { XiangqiColor, XiangqiEndReason, XiangqiState } from '../engine/types';
import { XiangqiPieceToken } from './XiangqiPieceToken';

const END_REASON_VI: Record<XiangqiEndReason, string> = {
  CHECKMATE: 'Chiếu Bí tuyệt sát!',
  STALEMATE_LOSS: 'Khốn Bí — Hết nước đi hợp lệ (Xử thua theo luật Cờ Tướng)',
  INSUFFICIENT_ATTACK: 'Hòa cờ — Cả hai bên không còn quân qua sông tấn công',
  THREEFOLD_REPETITION: 'Hòa cờ — Lặp thế cờ bất biến 3 lần',
  SIXTY_MOVE_RULE: 'Hòa cờ — Luật 60 nước không ăn quân',
  RESIGN: 'Đối phương đã xin đầu hàng',
  DRAW_AGREED: 'Hai kỳ thủ đồng ý hòa cờ',
};

export function XiangqiRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border-2 border-amber-300/70 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 text-amber-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-amber-200/20 bg-amber-950/45 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-black tracking-wide text-amber-300">
              <BookOpen className="h-4 w-4" />
              LUẬT CỜ TƯỚNG TIÊU CHUẨN (QUÂN ĐỎ – XANH)
            </div>
            <span className="rounded-full border border-amber-300/45 bg-amber-500/20 px-2.5 py-0.5 text-[10.5px] font-black text-amber-200">
              9×10 Giao Điểm · Không Giới Hạn Giờ
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng luật"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-amber-100 transition hover:bg-white/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-3.5">
          <div className="rounded-2xl border border-amber-300/25 bg-white/[0.04] p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-stone-950">
                1
              </span>
              <h3 className="text-xs font-black text-amber-300">Bàn 90 Giao Điểm &amp; Đỏ Đi Trước</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              Quân đặt trên <strong>giao điểm</strong> của 9 đường dọc × 10 đường ngang, ngăn cách bởi{' '}
              <strong>Sông (Sở Hà – Hán Giới)</strong>. <strong className="text-red-400">Bên Đỏ đi trước</strong>,{' '}
              <strong className="text-emerald-400">Bên Xanh đi sau</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-rose-300/25 bg-rose-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-400 text-[11px] font-black text-slate-950">
                2
              </span>
              <h3 className="text-xs font-black text-rose-300">Tướng, Sĩ &amp; Luật Lộ Mặt Tướng</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              <strong>Tướng</strong> đi ngang/dọc 1 bước, <strong>Sĩ</strong> đi chéo 1 bước — cả hai chỉ ở trong{' '}
              <strong>Cung 3×3</strong>. Tuyệt đối <strong>cấm 2 Tướng đối mặt nhau</strong> cùng cột dọc mà không có quân chắn!
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-black text-slate-950">
                3
              </span>
              <h3 className="text-xs font-black text-emerald-300">Xe &amp; Luật Ngòi Pháo</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              <strong>Xe</strong> đi ngang/dọc tự do, không nhảy quân. <strong>Pháo</strong> đi thường như Xe, nhưng khi{' '}
              <strong>ăn quân bắt buộc nhảy qua đúng 1 quân làm ngòi Pháo</strong>!
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-black text-slate-950">
                4
              </span>
              <h3 className="text-xs font-black text-cyan-300">Cản Chân Mã &amp; Cản Mắt Tượng</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              <strong>Mã</strong> đi chữ L nhưng bị <strong>cản chân</strong> nếu điểm liền kề hướng thẳng có quân.{' '}
              <strong>Tượng</strong> đi chéo 2 ô, <strong>không qua sông</strong> và bị <strong>cản mắt</strong> nếu điểm giữa có quân.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300/25 bg-amber-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-300 text-[11px] font-black text-stone-950">
                5
              </span>
              <h3 className="text-xs font-black text-amber-200">Tốt Qua Sông &amp; Chống Chiếu Dai</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              <strong>Tốt</strong> chưa qua sông chỉ tiến thẳng; qua sông được tiến thẳng hoặc đi ngang 1 bước (không lùi).{' '}
              <strong>Cấm chiếu dai liên tiếp</strong> lặp lại cùng thế cờ 3 lần.
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-300/35 bg-yellow-950/25 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-black text-stone-950">
                6
              </span>
              <h3 className="text-xs font-black text-yellow-300">Thắng / Thua &amp; Hòa Cờ</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              <strong>Chiếu bí</strong> hoặc làm đối phương <strong>hết sạch nước đi hợp lệ (Khốn bí)</strong> đều{' '}
              <strong className="text-yellow-300">THẮNG NGAY</strong>! Hòa khi hết quân tấn công, luật 60 nước hoặc hai bên đồng ý.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function XiangqiVictoryModal({
  state,
  isOnline,
  onPlayAgain,
  onBackToLobby,
}: {
  state: XiangqiState;
  isOnline: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}) {
  if (state.phase !== 'GAME_OVER' || !state.winner) return null;
  const isDraw = state.winner === 'DRAW';
  const winnerPlayer = state.winner !== 'DRAW' ? state.players[state.winner] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4">
      <div className="relative flex w-full max-w-[520px] flex-col items-center rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-950/98 via-stone-950/98 to-stone-950 p-6 text-center text-white shadow-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-500/20 px-4 py-1 text-xs font-black uppercase tracking-wider text-amber-200">
          {isDraw ? <Handshake className="h-4 w-4" /> : <Trophy className="h-4 w-4 text-yellow-300" />}
          {state.endReason ? END_REASON_VI[state.endReason] : 'Kết thúc ván cờ'}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {!isDraw && (
            <XiangqiPieceToken type="k" color={state.winner as XiangqiColor} className="h-14 w-14" />
          )}
          <div className="text-left">
            {!isDraw && (
              <div className="flex items-center gap-1 text-xs font-bold uppercase text-amber-200/80">
                <Crown className="h-3.5 w-3.5 text-yellow-300" />
                {state.winner === 'red' ? 'Bên Đỏ Thắng' : 'Bên Xanh Thắng'}
              </div>
            )}
            <h2 className="text-2xl font-black tracking-wide text-amber-300">
              {isDraw
                ? '🤝 HÒA CỜ BẤT PHÂN THẮNG BẠI!'
                : `🎉 ${(winnerPlayer?.name ?? '').toUpperCase()} CHIẾN THẮNG!`}
            </h2>
          </div>
        </div>

        <p className="mt-2 text-xs font-semibold text-amber-100/80">
          Tổng cộng <strong>{state.history.length} nước đi</strong> ({state.fullMoveNumber} hiệp).
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          {!isOnline && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="uiverse-push-btn uiverse-dome-shine inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-black text-slate-950 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #34F5A8 0%, #10B981 55%, #06B6D4 100%)',
                boxShadow: '0 4px 0 #047857',
              }}
            >
              <RotateCcw className="h-4 w-4" />
              CHƠI VÁN MỚI
            </button>
          )}
          <button
            type="button"
            onClick={onBackToLobby}
            className="rounded-2xl border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-black text-white transition hover:bg-white/20 cursor-pointer"
          >
            Về Sảnh Cờ Tướng
          </button>
        </div>
      </div>
    </div>
  );
}
