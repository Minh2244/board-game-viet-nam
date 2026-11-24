import { BookOpen, Crown, Handshake, RotateCcw, Trophy, X } from 'lucide-react';
import { PIECE_NAME_VI } from '../engine/rules';
import type { ChessColor, ChessEndReason, ChessPromotionType, ChessState } from '../engine/types';
import { ChessPieceSvg } from './ChessPieceSvg';

const END_REASON_VI: Record<ChessEndReason, string> = {
  CHECKMATE: 'Chiếu Bí tuyệt đối!',
  STALEMATE: 'Hòa Pat — Không còn nước đi hợp lệ',
  INSUFFICIENT_MATERIAL: 'Hòa cờ — Không đủ lực lượng chiếu bí',
  THREEFOLD_REPETITION: 'Hòa cờ — Lặp lại thế cờ 3 lần',
  FIFTY_MOVE_RULE: 'Hòa cờ — Luật 50 nước không ăn quân',
  RESIGN: 'Đối phương đã xin đầu hàng',
  DRAW_AGREED: 'Hai kỳ thủ đồng ý hòa cờ',
};

export function ChessRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border-2 border-slate-300/60 bg-gradient-to-b from-slate-900 via-zinc-950 to-zinc-950 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/15 bg-slate-900/80 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-black tracking-wide text-amber-300">
              <BookOpen className="h-4 w-4" />
              LUẬT CỜ VUA CỔ ĐIỂN QUỐC TẾ (FIDE)
            </div>
            <span className="rounded-full border border-slate-400/40 bg-white/10 px-2.5 py-0.5 text-[10.5px] font-black text-slate-200">
              Đen – Trắng · Chơi thoải mái không giới hạn giờ
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng luật"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-slate-100 transition hover:bg-white/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-3.5">
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-stone-950">
                1
              </span>
              <h3 className="text-xs font-black text-amber-300">Mục Tiêu &amp; Lượt Đi</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-slate-200/90">
              <strong>Trắng đi trước</strong>, Đen đi sau trên bàn 64 ô Đen–Trắng. Mục tiêu là{' '}
              <strong>Chiếu Bí Vua đối phương</strong> (Vua bị chiếu và không thể thoát).
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400 text-[11px] font-black text-slate-950">
                2
              </span>
              <h3 className="text-xs font-black text-sky-300">Cách Đi 6 Loại Quân</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-slate-200/90">
              <strong>Xe</strong> ngang/dọc · <strong>Tượng</strong> chéo · <strong>Hậu</strong> ngang/dọc/chéo ·{' '}
              <strong>Mã</strong> chữ L (duy nhất được nhảy qua quân) · <strong>Vua</strong> 1 ô 8 hướng ·{' '}
              <strong>Tốt</strong> tiến thẳng, ăn chéo 1 ô.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-black text-slate-950">
                3
              </span>
              <h3 className="text-xs font-black text-emerald-300">Nhập Thành (O-O / O-O-O)</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-slate-200/90">
              Khi Vua &amp; Xe chưa từng di chuyển, khoảng giữa trống, Vua không bị chiếu và không đi qua ô bị khống
              chế → Vua di chuyển <strong>2 ô về phía Xe</strong> để nhập thành.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-black text-slate-950">
                4
              </span>
              <h3 className="text-xs font-black text-cyan-300">Phong Cấp &amp; Bắt Tốt Qua Đường</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-slate-200/90">
              • Tốt tới hàng cuối được chọn phong <strong>Hậu, Xe, Tượng hoặc Mã</strong>.<br />• Khi Tốt địch tiến 2 ô
              đứng sát cạnh Tốt mình, có quyền <strong>ăn chéo qua đường</strong> ngay ở lượt kế tiếp.
            </p>
          </div>

          <div className="rounded-2xl border border-rose-300/25 bg-rose-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-400 text-[11px] font-black text-slate-950">
                5
              </span>
              <h3 className="text-xs font-black text-rose-300">Chiếu Vua &amp; Luật Ghim Quân</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-slate-200/90">
              Không được đi nước khiến Vua của chính mình bị chiếu. Khi Vua bị chiếu (ô đỏ rực), bắt buộc phải đỡ
              chiếu, ăn quân chiếu hoặc chạy Vua.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300/30 bg-amber-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-300 text-[11px] font-black text-stone-950">
                6
              </span>
              <h3 className="text-xs font-black text-amber-200">Các Trường Hợp Hòa Cờ</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-slate-200/90">
              <strong>Hòa Pat</strong> (hết nước đi nhưng không bị chiếu), <strong>thiếu quân chiếu bí</strong>,{' '}
              <strong>lặp thế 3 lần</strong>, <strong>luật 50 nước</strong> hoặc hai bên <strong>đồng ý hòa</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChessPromotionModal({
  color,
  onSelect,
  onCancel,
}: {
  color: ChessColor;
  onSelect: (piece: ChessPromotionType) => void;
  onCancel: () => void;
}) {
  const choices: ChessPromotionType[] = ['q', 'r', 'b', 'n'];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onCancel}
    >
      <div
        className="flex flex-col items-center gap-3 rounded-3xl border-2 border-amber-300/80 bg-zinc-950 px-6 py-5 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-black tracking-wide text-amber-300">
          👑 CHỌN QUÂN PHONG CẤP TỐT
        </div>
        <div className="grid grid-cols-4 gap-3">
          {choices.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 p-3 transition hover:scale-105 hover:border-amber-300 hover:bg-amber-400/20 cursor-pointer"
            >
              <ChessPieceSvg type={p} color={color} className="h-14 w-14" />
              <span className="text-xs font-black text-amber-100">{PIECE_NAME_VI[p]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChessVictoryModal({
  state,
  isOnline,
  onPlayAgain,
  onBackToLobby,
}: {
  state: ChessState;
  isOnline: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}) {
  if (state.phase !== 'GAME_OVER' || !state.winner) return null;
  const isDraw = state.winner === 'DRAW';
  const winnerPlayer = state.winner !== 'DRAW' ? state.players[state.winner] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4">
      <div className="relative flex w-full max-w-[520px] flex-col items-center rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-slate-900 via-zinc-950 to-zinc-950 p-6 text-center text-white shadow-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-500/20 px-4 py-1 text-xs font-black uppercase tracking-wider text-amber-200">
          {isDraw ? <Handshake className="h-4 w-4" /> : <Trophy className="h-4 w-4 text-yellow-300" />}
          {state.endReason ? END_REASON_VI[state.endReason] : 'Kết thúc ván cờ'}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {!isDraw && (
            <ChessPieceSvg type="k" color={state.winner as ChessColor} className="h-14 w-14" />
          )}
          <div className="text-left">
            {!isDraw && (
              <div className="flex items-center gap-1 text-xs font-bold uppercase text-amber-200/80">
                <Crown className="h-3.5 w-3.5 text-yellow-300" />
                {state.winner === 'white' ? 'Bên Trắng Thắng' : 'Bên Đen Thắng'}
              </div>
            )}
            <h2 className="text-2xl font-black tracking-wide text-amber-300">
              {isDraw
                ? '🤝 HÒA CỜ BẤT PHÂN THẮNG BẠI!'
                : `🎉 ${(winnerPlayer?.name ?? '').toUpperCase()} CHIẾN THẮNG!`}
            </h2>
          </div>
        </div>

        <p className="mt-2 text-xs font-semibold text-slate-300">
          Tổng số nước đã đi: <strong>{state.history.length} nửa nước</strong> ({state.fullMoveNumber} lượt).
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
            Về Sảnh Cờ Vua
          </button>
        </div>
      </div>
    </div>
  );
}
