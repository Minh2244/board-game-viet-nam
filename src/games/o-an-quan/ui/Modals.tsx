import { BookOpen, RotateCcw, Trophy, X } from 'lucide-react';
import { OAnQuanCharacterArt } from '../data/characters';
import { getTotalGamePoints } from '../engine/rules';
import type { OAnQuanRulesConfig, OAnQuanState } from '../engine/types';

export function OAnQuanRulesModal({
  rules,
  onClose,
}: {
  rules: OAnQuanRulesConfig;
  onClose: () => void;
}) {
  const qVal = rules.mandarinPointValue ?? 10;
  const totalPoints = getTotalGamePoints(rules);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90%] w-full max-w-[860px] flex-col overflow-hidden rounded-3xl border-2 border-amber-300/70 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 text-amber-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh tiêu đề & tóm tắt cấu hình ván hiện tại */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/20 bg-amber-950/35 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 text-base font-black tracking-wide text-amber-300">
              <BookOpen className="h-5 w-5" />
              LUẬT CHƠI Ô ĂN QUAN DÂN GIAN
            </div>
            <span className="rounded-full border border-emerald-300/45 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-black text-emerald-200">
              1 Quan = {qVal}đ · Tổng {totalPoints}đ
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${
                rules.mandarinYouthRule
                  ? 'border-amber-300/60 bg-amber-500/25 text-amber-200'
                  : 'border-white/20 bg-white/10 text-stone-300'
              }`}
            >
              Quan Non: {rules.mandarinYouthRule ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng luật"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-amber-100 transition hover:bg-white/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 6 Thẻ luật trực quan, dễ đọc, không dùng thuật ngữ kỹ thuật */}
        <div className="grid grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2">
          {/* 1. Bàn cờ & Tính điểm */}
          <div className="rounded-2xl border border-amber-300/25 bg-white/[0.04] p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-stone-950">
                1
              </span>
              <h3 className="text-[13.5px] font-black text-amber-300">Bàn Cờ &amp; Cách Tính Điểm</h3>
            </div>
            <p className="text-[12.5px] leading-relaxed text-amber-50/92">
              Bàn cờ có <strong>10 ô Dân</strong> (mỗi bên 5 ô × 5 viên sỏi, <strong>1 dân = 1đ</strong>) và{' '}
              <strong>2 ô Quan</strong> bán nguyệt hai đầu (mỗi viên ngọc Quan ={' '}
              <strong className="text-emerald-300">{qVal}đ</strong>). Tổng điểm toàn bàn luôn bằng{' '}
              <strong>{totalPoints} điểm</strong>.
            </p>
          </div>

          {/* 2. Chọn ô & Rải sỏi */}
          <div className="rounded-2xl border border-amber-300/25 bg-white/[0.04] p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-stone-950">
                2
              </span>
              <h3 className="text-[13.5px] font-black text-amber-300">Chọn Ô &amp; Rải Sỏi</h3>
            </div>
            <p className="text-[12.5px] leading-relaxed text-amber-50/92">
              Đến lượt, chạm <strong>1 trong 5 ô Dân có sỏi</strong> bên sân mình rồi bấm{' '}
              <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[11px] font-black text-amber-200">
                ◄ Rải Trái
              </span>{' '}
              hoặc{' '}
              <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[11px] font-black text-amber-200">
                Rải Phải ►
              </span>
              . Rải đều <strong>1 viên/ô</strong> theo đúng chiều đã chọn, đi qua cả 2 ô Quan (và đi giáp vòng nếu có từ 12 viên trở lên).
            </p>
          </div>

          {/* 3. Nối lượt vs Dừng lượt */}
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-950/20 p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-slate-950">
                3
              </span>
              <h3 className="text-[13.5px] font-black text-cyan-300">Nối Lượt hay Dừng Lượt?</h3>
            </div>
            <ul className="space-y-1 text-[12.5px] leading-relaxed text-amber-50/92">
              <li>
                • Thả xong viên cuối, nếu ô kế tiếp là <strong>Ô Dân có quân</strong> → bốc hết ô đó{' '}
                <strong className="text-cyan-200">rải nối lượt tiếp</strong>.
              </li>
              <li>
                • Nếu gặp <strong>Ô Quan đang có quân</strong> → <strong className="text-rose-300">dừng lượt ngay</strong>{' '}
                (không được bốc quân trong ô Quan đi rải).
              </li>
            </ul>
          </div>

          {/* 4. Đập tay Ăn quân & Combo */}
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-950/25 p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-black text-slate-950">
                4
              </span>
              <h3 className="text-[13.5px] font-black text-emerald-300">Đập Tay Ăn Quân &amp; Ăn Liên Hoàn</h3>
            </div>
            <p className="text-[12.5px] leading-relaxed text-amber-50/92">
              Thả xong viên cuối mà thấy cặp{' '}
              <span className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-black text-yellow-200">
                Ô Trống
              </span>{' '}
              →{' '}
              <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[11px] font-black text-emerald-200">
                Ô Có Quân
              </span>{' '}
              → đập tay <strong>&ldquo;BỐP!&rdquo;</strong> ăn trọn ô đó! Nếu tiếp sau lại có thêm cặp{' '}
              <strong>Trống → Có quân</strong> thì <strong>ăn liên hoàn (Combo ×2, ×3...)</strong>. Dứt chuỗi ăn là chuyển lượt ngay.
            </p>
          </div>

          {/* 5. Hết dân sân nhà — Rải dân & Vay nợ */}
          <div className="rounded-2xl border border-rose-300/25 bg-rose-950/20 p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-400 text-xs font-black text-slate-950">
                5
              </span>
              <h3 className="text-[13.5px] font-black text-rose-200">Hết Dân Sân Nhà: Rải Dân &amp; Vay Nợ</h3>
            </div>
            <p className="text-[12.5px] leading-relaxed text-amber-50/92">
              Tới lượt mà cả 5 ô sân mình trống sạch, bạn trích <strong>5 dân trong giỏ</strong> rải lại (1 viên/ô, không bẻ viên Quan). Nếu thiếu sẽ tự động{' '}
              <strong className="text-rose-200">vay dân đối thủ</strong> — nợ vay được <strong>trừ vào điểm của bạn</strong> (cộng cho chủ nợ) và{' '}
              <strong>tự trả lại ngay</strong> khi bạn ăn được dân mới!
            </p>
          </div>

          {/* 6. Kết thúc ván & Luật Quan Non */}
          <div className="rounded-2xl border border-amber-300/35 bg-amber-950/25 p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300 text-xs font-black text-stone-950">
                6
              </span>
              <h3 className="text-[13.5px] font-black text-amber-200">Hết Quan Kéo Quân Về &amp; Quan Non</h3>
            </div>
            <p className="text-[12.5px] leading-relaxed text-amber-50/92">
              Khi <strong>cả 2 ô Quan trống sạch</strong> (hoặc gộp 2 giỏ không đủ 5 dân để rải lại), dân còn bên sân ai người nấy thu về, trả hết nợ vay rồi tổng kết điểm —{' '}
              <strong>ai cao điểm hơn là thắng!</strong>
              <br />
              <span className="text-amber-200/90">
                • <strong>Luật Quan Non</strong>:{' '}
                {rules.mandarinYouthRule
                  ? 'ĐANG BẬT — Ô Quan còn viên Quan lớn phải đủ từ 5 dân trở lên mới được ăn.'
                  : 'ĐANG TẮT — Cứ tạo thế Trống → Ô Quan là được ăn Quan ngay.'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OAnQuanVictoryModal({
  state,
  isOnline,
  onPlayAgain,
  onBackToLobby,
}: {
  state: OAnQuanState;
  isOnline: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}) {
  const summary = state.finalSummary;
  if (!summary) return null;

  const qVal = state.rules.mandarinPointValue ?? 10;
  const totalPoints = getTotalGamePoints(state.rules);
  const p0 = state.players[0];
  const p1 = state.players[1];
  const winnerPlayer =
    summary.winnerSide === 'DRAW' ? null : state.players[summary.winnerSide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/76 p-4">
      <div className="relative flex w-full max-w-[680px] flex-col overflow-hidden rounded-3xl border-2 border-amber-300/75 bg-gradient-to-b from-amber-950/98 via-stone-950/98 to-stone-950 p-5 text-white shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-500/25 px-4 py-1 text-xs font-black uppercase tracking-widest text-amber-200">
            <Trophy className="h-4 w-4 text-amber-300" />
            {summary.endReason === 'BOTH_MANDARINS_EMPTY'
              ? 'Hết Quan, Tàn Dân, Thu Quân Kéo Về!'
              : 'Kết Thúc Do Bế Tắc Không Đủ 5 Dân Rải Lại'}
          </div>

          <h2 className="mt-2 text-2xl font-black tracking-wide text-amber-300">
            {winnerPlayer
              ? `🎉 ${winnerPlayer.name.toUpperCase()} CHIẾN THẮNG!`
              : '🤝 HÒA CỜ BẤT PHÂN THẮNG BẠI!'}
          </h2>
        </div>

        {/* Bảng kế toán chi tiết minh bạch 2 bên */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[p0, p1].map((p, idx) => {
            const isWin = summary.winnerSide === p.side;
            return (
              <div
                key={p.side}
                className={`flex flex-col rounded-2xl border p-3.5 ${
                  isWin
                    ? 'border-amber-300 bg-amber-500/18 ring-2 ring-amber-300/50'
                    : 'border-white/15 bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <OAnQuanCharacterArt
                    characterId={p.characterId}
                    mood={isWin ? 'excited' : 'idle'}
                    className="h-16 w-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white">{p.name}</div>
                    <div className="text-2xl font-black text-amber-300">
                      {summary.scores[idx]} điểm
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2 text-[11px] text-amber-100/85">
                  <div className="flex justify-between">
                    <span>Quan đã ăn ({p.capturedQuan} × {qVal}đ):</span>
                    <strong>+{p.capturedQuan * qVal}đ</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Dân trong giỏ cuối ván:</span>
                    <strong>+{p.capturedDan}đ</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      {summary.repaidFromSwept[idx] > 0
                        ? `Dân kéo về (Thu ${summary.sweptStonesGross[idx]}, giữ lại):`
                        : 'Dân kéo về sân nhà:'}
                    </span>
                    <strong>+{summary.sweptStonesNet[idx]}đ</strong>
                  </div>
                  {summary.repaidFromSwept[idx] > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span>Trích dân kéo về trả nợ đối thủ:</span>
                      <strong>-{summary.repaidFromSwept[idx]} dân</strong>
                    </div>
                  )}
                  {p.borrowedDan > 0 && (
                    <div className="flex justify-between text-rose-300">
                      <span>Trừ dư nợ chưa trả:</span>
                      <strong>-{p.borrowedDan}đ</strong>
                    </div>
                  )}
                  {p.loanedDan > 0 && (
                    <div className="flex justify-between text-emerald-300">
                      <span>Cộng quyền đòi nợ:</span>
                      <strong>+{p.loanedDan}đ</strong>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Công bố riêng Điểm Trung Lập nếu kết thúc do Bế Tắc */}
        {summary.neutralScore > 0 && (
          <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-950/60 px-3.5 py-2 text-center text-xs font-bold text-amber-200">
            Quân Trung Lập còn trên 2 ô Quan ({summary.neutralQuan} Quan + {summary.neutralDan} dân):{' '}
            <strong>{summary.neutralScore} điểm</strong> · Tổng bảo toàn:{' '}
            <strong>
              {summary.scores[0]} + {summary.scores[1]} + {summary.neutralScore} = {totalPoints} điểm
            </strong>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-3">
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
            Về Sảnh Ô Ăn Quan
          </button>
        </div>
      </div>
    </div>
  );
}
