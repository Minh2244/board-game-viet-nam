import { BookOpen, Crown, RotateCcw, Swords, Trophy, X } from 'lucide-react';
import { HORSE_COLOR_CONFIG } from '../engine/boardGeometry';
import type { CoCaNguaState } from '../engine/types';
import { HorsePieceSvg } from './HorsePieceSvg';

export function CoCaNguaRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border-2 border-amber-300/75 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 text-amber-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header siêu gọn */}
        <div className="flex items-center justify-between gap-2 border-b border-amber-200/20 bg-amber-950/45 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-black tracking-wide text-amber-300">
              <BookOpen className="h-4 w-4" />
              LUẬT CỜ CÁ NGỰA CHUẨN VIỆT NAM
            </div>
            <span className="rounded-full border border-amber-300/45 bg-amber-500/20 px-2.5 py-0.5 text-[10.5px] font-black text-amber-200">
              1 Xúc Xắc · 4 Màu · Kín 3–4–5–6 Thắng
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

        {/* 6 Thẻ siêu gọn, đọc lướt 5 giây là hiểu trọn bộ luật — KHÔNG cần cuộn! */}
        <div className="grid grid-cols-2 gap-2.5 p-3.5">
          <div className="rounded-2xl border border-amber-300/25 bg-white/[0.04] p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-stone-950">
                1
              </span>
              <h3 className="text-xs font-black text-amber-300">4 Màu &amp; Vòng Đua</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              Mỗi bên có <strong>4 ngựa</strong> chạy theo <strong>chiều kim đồng hồ</strong> trọn vòng đua về cầu
              thang màu mình. Chơi 2 người tự ngồi đối góc cân xứng.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-black text-slate-950">
                2
              </span>
              <h3 className="text-xs font-black text-emerald-300">Gieo 1 hoặc 6: Xuất Chuồng + Thêm Lượt</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              Trúng <strong>1</strong> hoặc <strong>6</strong> được xuất ngựa ra <strong>Ô Xuất Phát</strong> (viền
              đôi) <strong>và tung thêm 1 lượt</strong>. Khi chưa có ngựa ra ngoài, tỉ lệ ra 1 &amp; 6 được tăng lên!
            </p>
          </div>

          <div className="rounded-2xl border border-rose-300/30 bg-rose-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-400 text-[11px] font-black text-slate-950">
                3
              </span>
              <h3 className="text-xs font-black text-rose-200">Cấm Nhảy Qua Quân &amp; Đá Ngựa Địch</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              Mỗi ô tối đa 1 quân, <strong>cấm nhảy qua mọi quân ngựa</strong> chắn phía trước. Đi đúng số vào ô có
              quân địch → <strong className="text-rose-300">ĐÁ bay về chuồng</strong>!
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-black text-slate-950">
                4
              </span>
              <h3 className="text-xs font-black text-cyan-300">4 Ô An Toàn ★ (Ô Lên Bụt)</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              4 ô có ngôi sao <strong className="text-amber-300">★</strong> trước cầu thang là vùng an toàn:{' '}
              <strong>không thể bị đá</strong> nhưng vẫn chắn đường không cho quân khác nhảy qua.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300/30 bg-amber-950/20 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-300 text-[11px] font-black text-stone-950">
                5
              </span>
              <h3 className="text-xs font-black text-amber-200">Dừng Đúng Cửa &amp; Leo / Đổi Bụt</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              Phải dừng <strong>đúng Ô ★</strong> (cấm đi lố). Từ Ô ★ đổ số mấy leo thẳng bậc đó; đang đứng bậc thấp
              đổ số <strong>lớn hơn</strong> (đường trống) được đổi bụt lên đúng số đó!
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-300/45 bg-yellow-950/25 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-black text-stone-950">
                6
              </span>
              <h3 className="text-xs font-black text-yellow-300">Thắng Ngay Khi Kín 4 Bậc 3–4–5–6</h3>
            </div>
            <p className="text-[11.5px] leading-snug text-amber-50/90">
              Ai xếp đủ <strong>4 ngựa kín 4 bậc đỉnh 3 – 4 – 5 – 6</strong> (viền vàng) thắng ngay! Quân còn ở bậc 1
              hoặc 2 cần đổi bụt lên khu 3–6.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoCaNguaVictoryModal({
  state,
  isOnline,
  onPlayAgain,
  onBackToLobby,
}: {
  state: CoCaNguaState;
  isOnline: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}) {
  if (state.phase !== 'GAME_OVER' || !state.winnerColor) return null;
  const winnerPlayer = state.players.find((p) => p.color === state.winnerColor);
  const winnerVisual = HORSE_COLOR_CONFIG[state.winnerColor];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4">
      <div className="relative flex w-full max-w-[620px] flex-col overflow-hidden rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-950/98 via-stone-950/98 to-stone-950 p-5 text-white shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-500/25 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-amber-200">
            <Trophy className="h-4 w-4 text-amber-300" />
            Xếp Kín 4 Bậc Đỉnh 3–4–5–6 · Sau {state.turnCount} Lượt
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <HorsePieceSvg color={state.winnerColor} className="h-14 w-14" />
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-200/85">
                <Crown className="h-4 w-4 text-yellow-300" />
                Quán quân · Phe {winnerVisual.nameVi}
              </div>
              <h2 className="text-2xl font-black tracking-wide text-amber-300">
                🎉 {(winnerPlayer?.name ?? winnerVisual.nameVi).toUpperCase()} CHIẾN THẮNG!
              </h2>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {state.rankings.map((row) => {
            const vis = HORSE_COLOR_CONFIG[row.color];
            const isFirst = row.rank === 1;
            return (
              <div
                key={row.color}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2 ${
                  isFirst
                    ? 'border-yellow-300 bg-amber-500/20 ring-2 ring-yellow-300/45'
                    : 'border-white/12 bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                      isFirst
                        ? 'bg-yellow-400 text-stone-950'
                        : row.rank === 2
                          ? 'bg-slate-300 text-slate-950'
                          : row.rank === 3
                            ? 'bg-amber-700 text-amber-100'
                            : 'bg-white/15 text-slate-300'
                    }`}
                  >
                    #{row.rank}
                  </span>
                  <HorsePieceSvg color={row.color} className="h-9 w-9 shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-black text-white">
                      <span>{row.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                        style={{ backgroundColor: vis.main }}
                      >
                        {vis.shortName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-amber-200/75">Bụt 3–6</div>
                    <div className="text-base font-black text-yellow-300">{row.winStairCount}/4</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase text-rose-200/80">
                      <Swords className="h-3 w-3" />
                      Đá ngựa
                    </div>
                    <div className="text-base font-black text-rose-300">{row.kicksCount}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
            Về Sảnh Cờ Cá Ngựa
          </button>
        </div>
      </div>
    </div>
  );
}
