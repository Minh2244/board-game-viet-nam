export function DiceLogoBadge() {
  return (
    <div
      className="relative flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5 pr-3.5 shadow-[0_8px_22px_rgba(0,0,0,0.28)] sm:gap-3 sm:px-3.5 sm:py-2 sm:pr-6"
      style={{
        background: 'linear-gradient(180deg, rgba(255, 248, 236, 0.36) 0%, rgba(212, 186, 154, 0.30) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1.5px solid rgba(255, 255, 255, 0.45)',
      }}
    >
      {/* Huy hiệu Xúc xắc 3D Vector sắc nét */}
      <div className="relative -my-1 -ml-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-amber-500 p-[2px] shadow-[0_6px_14px_rgba(0,0,0,0.3)] sm:-my-2 sm:-ml-1 sm:h-14 sm:w-14 sm:rounded-2xl">
        <div className="relative flex h-full w-full items-center justify-center rounded-[10px] bg-gradient-to-b from-[#2A1D13] to-[#1B120B] sm:rounded-[14px]">
          <svg viewBox="0 0 64 64" className="h-7 w-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] sm:h-10 sm:w-10" aria-hidden="true">
            {/* Nền khiên vàng ánh nhẹ */}
            <path
              d="M32 4 L56 14 V32 C56 46 45 55 32 60 C19 55 8 46 8 32 V14 Z"
              fill="url(#shieldGrad)"
              stroke="#FEF08A"
              strokeWidth="2.5"
            />
            <defs>
              <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="55%" stopColor="#0D9488" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            {/* Xúc xắc 3D nghiêng */}
            <polygon points="32,14 48,22 32,30 16,22" fill="#FFFBEB" />
            <polygon points="16,22 32,30 32,48 16,40" fill="#E7E0C8" />
            <polygon points="48,22 32,30 32,48 48,40" fill="#D4C7A3" />
            <polyline points="16,22 32,30 48,22" fill="none" stroke="#92400E" strokeWidth="1.4" />
            <line x1="32" y1="30" x2="32" y2="48" stroke="#92400E" strokeWidth="1.4" />
            {/* Chấm đỏ mặt 1 trên đỉnh & chấm đen 2 mặt bên */}
            <circle cx="32" cy="22" r="3.1" fill="#DC2626" />
            <circle cx="21" cy="31" r="2.1" fill="#1F2937" />
            <circle cx="27" cy="39" r="2.1" fill="#1F2937" />
            <circle cx="37" cy="34" r="2" fill="#1F2937" />
            <circle cx="43" cy="30" r="2" fill="#1F2937" />
            <circle cx="40" cy="36" r="2" fill="#1F2937" />
            <circle cx="37" cy="42" r="2" fill="#1F2937" />
            <circle cx="43" cy="38" r="2" fill="#1F2937" />
          </svg>
        </div>
      </div>

      {/* Thanh nhấn cầu vồng dọc kiểu UIverse */}
      <div
        className="h-7 w-1 shrink-0 rounded-full sm:h-9"
        style={{
          background: 'linear-gradient(180deg, #34D399 0%, #38BDF8 38%, #FBBF24 72%, #F43F5E 100%)',
        }}
      />

      {/* Tiêu đề & phụ đề */}
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-black tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] sm:text-xl">
          BOARD GAME VIỆT NAM
        </div>
        <div className="truncate text-[10px] font-medium text-amber-50/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:text-sm">
          Chọn trò chơi để bắt đầu
        </div>
      </div>
    </div>
  );
}
