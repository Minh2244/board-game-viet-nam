import { useId } from 'react';
import type { CharacterId } from '../engine/types';

export type HandPose =
  | 'reach_open'     // Xòe rộng 5 ngón chuẩn bị lụm đá
  | 'scoop_grab'     // Co cụp 5 ngón nắm chặt sỏi lên tay
  | 'carry_hold'     // Cầm nắm đá êm ái bay sang ô kế tiếp
  | 'drop_pinch'     // Nhích mở ngón cái & ngón trỏ thả 1 viên đá rơi xuống hố
  | 'slap_windup'    // Xòe căng 5 ngón vung cao lên trời chờ đập
  | 'slap_impact'    // Đập bẹp dứt khoát xuống mặt ô trống ("BỐP!")
  | 'sweep_capture'; // Ôm chặt sỏi & Viên Ngọc Quan quét bay vào giỏ tre

export interface ActiveHandActor {
  x: number;
  y: number;
  pose: HandPose;
  poseKey: number;           // Đổi key để kích hoạt lại animation co nắm / đập / thả đá đúng nhịp
  characterId: CharacterId;
  fromTop: boolean;          // true nếu là phe hàng trên (hướng tay tự nhiên từ trên xuống)
  stonesInHand: number;      // Số viên sỏi đang giữ trong lòng bàn tay
  holdingMandarin: boolean;  // Đang ôm Viên Đá Ngọc Quan lớn vừa ăn
  transitionMs: number;      // Thời gian lướt mượt tới tọa độ mới
  floatingPoints?: string;   // VD: "+14đ!"
}

export interface SlapShockwave {
  id: number;
  x: number;
  y: number;
  label: string;
}

export interface DropRipple {
  id: number;
  x: number;
  y: number;
}

/**
 * Bàn Tay 2.5D vẽ nét cong tự nhiên (Organic Bezier SVG — không còn dạng hình chữ nhật thô)
 * với 4 bộ giải phẫu tay rõ nét:
 * 1. Bàn Tay Xòe Rộng Tự Nhiên (reach_open / slap_windup / slap_impact)
 * 2. Bàn Tay Co Cụp 5 Ngón Nắm Đá (scoop_grab / sweep_capture)
 * 3. Bàn Tay Nghiêng 3/4 Cầm & Nhả Từng Viên Sỏi (carry_hold / drop_pinch)
 * Kèm bóng đổ theo độ cao 3D thật, viên sỏi rơi từ đầu ngón tay và sóng đập "BỐP!" rõ nét.
 */
export function HandActorOverlay({
  hand,
  shockwave,
  dropRipple,
}: {
  hand: ActiveHandActor | null;
  shockwave: SlapShockwave | null;
  dropRipple: DropRipple | null;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const skinId = `oaqHandSkin_${uid}`;
  const sleeveId = `oaqSleeve_${uid}`;
  const jadeId = `oaqHandJade_${uid}`;
  const isBoy = hand?.characterId === 'cu_ti';
  const sleeveLight = isBoy ? '#9A6340' : '#FB7185';
  const sleeveDark = isBoy ? '#5C3520' : '#BE123C';
  const sleeveBorder = isBoy ? '#34190B' : '#6B1028';
  const cuffAccent = isBoy ? '#FDE68A' : '#FEF08A';

  /** Chiều cao ảo (px) & độ co giãn của bàn tay so với mặt bàn để tạo cảm giác 3D rất thật */
  const getHandMetrics = (actor: ActiveHandActor) => {
    const rot = actor.fromTop ? 168 : -10;
    switch (actor.pose) {
      case 'reach_open':
        return { liftY: -22, scale: 1.08, rot, shadowScale: 0.78, shadowOpacity: 0.28 };
      case 'scoop_grab':
        return { liftY: -6, scale: 1.0, rot: rot + (actor.fromTop ? 4 : -4), shadowScale: 1.0, shadowOpacity: 0.45 };
      case 'carry_hold':
        return { liftY: -24, scale: 1.02, rot: rot + (actor.fromTop ? -6 : 6), shadowScale: 0.75, shadowOpacity: 0.26 };
      case 'drop_pinch':
        return { liftY: -12, scale: 0.98, rot: rot + (actor.fromTop ? -12 : 12), shadowScale: 0.9, shadowOpacity: 0.38 };
      case 'slap_windup':
        return { liftY: -46, scale: 1.28, rot, shadowScale: 0.62, shadowOpacity: 0.2 };
      case 'slap_impact':
        return { liftY: 2, scale: 1.04, rot, shadowScale: 1.18, shadowOpacity: 0.56 };
      case 'sweep_capture':
        return { liftY: -20, scale: 1.08, rot: rot + (actor.fromTop ? 12 : -12), shadowScale: 0.82, shadowOpacity: 0.3 };
    }
  };

  /** Vẽ dáng BÀN TAY XÒE RỘNG 5 NGÓN TỰ NHIÊN (dùng khi chuẩn bị lụm, vung tay lên cao & đập BỐP!) */
  const renderOpenSpreadHand = (isSlapImpact: boolean) => (
    <g>
      {/* Dáng bàn tay liền mạch 5 ngón thon tự nhiên bằng đường cong Bezier */}
      <path
        d="
          M 44 106
          C 37 100, 31 90, 26 78
          C 20 69, 13 60, 14 52
          C 15 46, 22 46, 27 52
          L 36 62
          C 35 48, 30 33, 31 24
          C 32 17, 40 16, 43 23
          L 49 44
          C 49 30, 48 15, 51 9
          C 54 3, 62 4, 63 11
          L 64 42
          C 68 28, 72 15, 76 11
          C 80 7, 87 10, 86 17
          L 79 47
          C 85 37, 92 28, 97 26
          C 102 24, 107 29, 104 36
          L 90 66
          C 90 83, 86 96, 78 106
          Z
        "
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* Đổ bóng mềm bên trong lòng bàn tay & ngấn đốt ngón tay */}
      <path
        d="M 41 68 C 52 60, 68 60, 81 69"
        fill="none"
        stroke="#D4956A"
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 48 80 C 57 76, 67 77, 75 83"
        fill="none"
        stroke="#D4956A"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Điểm nhấn đầu ngón tay hồng nhẹ */}
      <ellipse cx="19" cy="52" rx="3.2" ry="4" transform="rotate(-28 19 52)" fill="#F9B596" opacity="0.65" />
      <ellipse cx="36" cy="22" rx="3.2" ry="4.5" transform="rotate(-8 36 22)" fill="#F9B596" opacity="0.65" />
      <ellipse cx="56" cy="11" rx="3.5" ry="4.8" fill="#F9B596" opacity="0.65" />
      <ellipse cx="80" cy="15" rx="3.3" ry="4.5" transform="rotate(14 80 15)" fill="#F9B596" opacity="0.65" />
      <ellipse cx="99" cy="31" rx="3" ry="4" transform="rotate(26 99 31)" fill="#F9B596" opacity="0.65" />

      {/* Vệt sáng viền khi vừa đập bẹp mặt gỗ */}
      {isSlapImpact && (
        <ellipse
          cx="61"
          cy="66"
          rx="34"
          ry="24"
          fill="none"
          stroke="#FEF08A"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          opacity="0.9"
        />
      )}
    </g>
  );

  /** Vẽ dáng BÀN TAY CO CỤP NẮM CHẶT ĐÁ (dùng lúc lụm đá & ôm sỏi/Quan quét vào giỏ) */
  const renderClenchedGrabHand = (stonesCount: number, hasMandarin: boolean) => (
    <g>
      {/* Khối lòng bàn tay khum tròn nắm sỏi */}
      <path
        d="
          M 42 106
          C 31 98, 25 84, 27 68
          C 29 52, 42 42, 60 42
          C 78 42, 92 52, 93 69
          C 94 85, 87 98, 78 106
          Z
        "
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />

      {/* Phần khe tối lòng bàn tay chứa sỏi cuội & Viên Ngọc Quan */}
      <ellipse cx="60" cy="60" rx="24" ry="15" fill="#9E623C" opacity="0.52" />

      {/* Sỏi cuội nằm gọn trong lòng bàn tay đang nắm chặt */}
      {stonesCount >= 1 && (
        <ellipse cx="50" cy="61" rx="8.5" ry="5.8" fill="#F5F5F4" stroke="#57534E" strokeWidth="1.5" />
      )}
      {stonesCount >= 2 && (
        <ellipse cx="66" cy="60" rx="8.5" ry="5.8" fill="#D6B892" stroke="#5C3A1E" strokeWidth="1.5" />
      )}
      {stonesCount >= 3 && (
        <ellipse cx="58" cy="53" rx="8.2" ry="5.5" fill="#A8A29E" stroke="#44403C" strokeWidth="1.5" />
      )}
      {stonesCount >= 4 && (
        <ellipse cx="45" cy="54" rx="7.5" ry="5.2" fill="#B68553" stroke="#5C3A1E" strokeWidth="1.5" />
      )}
      {stonesCount >= 5 && (
        <ellipse cx="72" cy="54" rx="7.5" ry="5.2" fill="#E7E5E4" stroke="#57534E" strokeWidth="1.5" />
      )}
      {hasMandarin && (
        <g>
          <ellipse cx="60" cy="55" rx="15" ry="11.5" fill={`url(#${jadeId})`} stroke="#064E3B" strokeWidth="2.2" />
          <ellipse cx="55" cy="51" rx="4.5" ry="2.8" transform="rotate(-18 55 51)" fill="#FFFFFF" opacity="0.6" />
        </g>
      )}

      {/* 4 NGÓN TAY CO CỤP GẬP KHỚP ÔM CHẶT PHÍA TRÊN SỎI (rõ từng đốt cong!) */}
      <path
        d="M 32 54 C 31 39, 44 37, 46 51 C 46 57, 34 59, 32 54 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.4"
      />
      <path
        d="M 46 49 C 46 33, 60 33, 61 48 C 61 55, 47 56, 46 49 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.4"
      />
      <path
        d="M 61 50 C 62 34, 76 35, 76 50 C 75 56, 62 56, 61 50 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.4"
      />
      <path
        d="M 76 55 C 78 41, 90 43, 89 57 C 88 63, 76 62, 76 55 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.4"
      />

      {/* Ngón cái quặp ngang khóa chặt miệng nắm tay phía trước */}
      <path
        d="M 28 77 C 24 65, 36 59, 52 65 C 61 69, 60 79, 49 81 C 39 83, 30 82, 28 77 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.5"
      />
      {/* Ngấn khớp ngón cái */}
      <path d="M 41 68 Q 44 73 41 77" fill="none" stroke="#D4956A" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );

  /** Vẽ dáng BÀN TAY CẦM & RẢI TỪNG VIÊN ĐÁ (ngón trỏ & ngón cái chụm thả viên sỏi ở đầu mũi tay) */
  const renderCarryOrDropHand = (isReleasingDrop: boolean, stonesCount: number) => (
    <g>
      {/* Thân bàn tay nghiêng 3/4 tự nhiên */}
      <path
        d="
          M 44 106
          C 34 98, 28 84, 30 68
          C 32 54, 43 44, 58 43
          C 75 42, 89 52, 91 69
          C 92 85, 86 98, 78 106
          Z
        "
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />

      {/* Các viên sỏi còn lại nằm gọn trong lòng bàn tay */}
      <ellipse cx="64" cy="63" rx="18" ry="12" fill="#9E623C" opacity="0.45" />
      {stonesCount >= 1 && (
        <ellipse cx="58" cy="64" rx="7.5" ry="5.2" fill="#F5F5F4" stroke="#57534E" strokeWidth="1.4" />
      )}
      {stonesCount >= 2 && (
        <ellipse cx="70" cy="61" rx="7.5" ry="5.2" fill="#D6B892" stroke="#5C3A1E" strokeWidth="1.4" />
      )}
      {stonesCount >= 3 && (
        <ellipse cx="63" cy="56" rx="7" ry="4.8" fill="#A8A29E" stroke="#44403C" strokeWidth="1.4" />
      )}

      {/* 3 ngón giữa, áp út, út khum giữ sỏi bên phải */}
      <path
        d="M 55 51 C 56 37, 68 38, 69 51 C 69 57, 56 57, 55 51 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.3"
      />
      <path
        d="M 68 53 C 70 40, 81 42, 81 55 C 80 61, 69 60, 68 53 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.3"
      />
      <path
        d="M 79 60 C 82 49, 92 52, 91 64 C 89 69, 79 67, 79 60 Z"
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.3"
      />

      {/* NGÓN TRỎ vươn ra phía mũi tay (nhích mở lên khi đang thả đá!) */}
      <path
        d={
          isReleasingDrop
            ? 'M 47 52 C 42 35, 36 22, 41 16 C 46 11, 54 16, 55 27 L 57 49 Z'
            : 'M 47 52 C 40 38, 33 27, 36 21 C 40 16, 48 19, 52 30 L 57 49 Z'
        }
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* NGÓN CÁI đối diện ngón trỏ (nhích tách ra khi thả đá!) */}
      <path
        d={
          isReleasingDrop
            ? 'M 32 74 C 19 64, 14 50, 20 44 C 25 39, 34 45, 39 56 L 45 71 Z'
            : 'M 32 74 C 21 61, 18 46, 25 40 C 31 36, 39 43, 43 54 L 47 70 Z'
        }
        fill={`url(#${skinId})`}
        stroke="#4A2510"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Viên đá đang kẹp ở đầu ngón tay (hoặc vừa tách khỏi khe ngón rơi thẳng xuống hố!) */}
      {isReleasingDrop ? (
        <g>
          <ellipse
            cx="26"
            cy="26"
            rx="8"
            ry="6"
            fill="#FEF3C7"
            stroke="#78350F"
            strokeWidth="1.9"
          />
          <path
            d="M 28 34 L 28 43 M 22 33 L 20 40"
            stroke="#FDE047"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <ellipse
          cx="30"
          cy="33"
          rx="7.2"
          ry="5.4"
          fill="#F5F5F4"
          stroke="#57534E"
          strokeWidth="1.6"
        />
      )}
    </g>
  );

  const metrics = hand ? getHandMetrics(hand) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
      {/* Hiệu ứng viên sỏi rơi thẳng xuống tâm ô + vòng sóng tròn rõ nét */}
      {dropRipple && (
        <div
          key={dropRipple.id}
          style={{ left: dropRipple.x, top: dropRipple.y }}
          className="absolute"
        >
          <div className="animate-oaq-shock-ring absolute h-16 w-16 rounded-full border-2 border-amber-200/90" />
          <div className="animate-oaq-stone-fall absolute h-3.5 w-4.5 rounded-full border border-amber-900 bg-amber-100 shadow-md" />
        </div>
      )}

      {/* Hiệu ứng ĐẬP TAY "BỐP!" cực rõ nét: 2 vòng sóng xung kích + 8 tia lực + 6 hạt bụi văng tỏa + chữ BỐP! */}
      {shockwave && (
        <div
          key={shockwave.id}
          style={{ left: shockwave.x, top: shockwave.y }}
          className="absolute"
        >
          {/* Vòng sóng ngoài & trong */}
          <div className="animate-oaq-shock-ring absolute h-28 w-28 rounded-full border-[4px] border-amber-300 bg-amber-300/20" />
          <div
            className="animate-oaq-shock-ring absolute h-20 w-20 rounded-full border-[3px] border-white/95"
            style={{ animationDelay: '50ms' }}
          />

          {/* 8 tia va chạm đậm nét + 6 hạt bụi gỗ bắn ra xung quanh */}
          <svg
            viewBox="0 0 150 150"
            className="absolute -translate-x-1/2 -translate-y-1/2 h-36 w-36 drop-shadow-[0_3px_8px_rgba(0,0,0,0.65)]"
          >
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1="75"
                y1="24"
                x2="75"
                y2="6"
                stroke="#FEF08A"
                strokeWidth="4.8"
                strokeLinecap="round"
                transform={`rotate(${deg} 75 75)`}
              />
            ))}
            {[20, 75, 140, 205, 260, 325].map((deg) => (
              <circle
                key={deg}
                cx="75"
                cy="18"
                r="4.2"
                fill="#FDBA74"
                opacity="0.9"
                transform={`rotate(${deg} 75 75)`}
              />
            ))}
          </svg>

          {/* Chữ 💥 BỐP! nảy bật mạnh phía trên ô vừa đập */}
          <div className="animate-oaq-bop-pop absolute -top-9 whitespace-nowrap rounded-full border-2 border-yellow-100 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-4 py-1 text-base font-black tracking-wider text-white shadow-[0_6px_18px_rgba(0,0,0,0.72)]">
            💥 {shockwave.label}
          </div>
        </div>
      )}

      {/* Bàn Tay 2.5D Nét Cong Tự Nhiên + Bóng Đổ Độ Cao 3D (thuần GPU translate3d — 0 Layout Thrashing!) */}
      {hand && metrics && (
        <div
          style={{
            left: 0,
            top: 0,
            transform: `translate3d(${hand.x}px, ${hand.y}px, 0)`,
            transition: `transform ${hand.transitionMs}ms cubic-bezier(0.25, 1, 0.5, 1)`,
          }}
          className="absolute will-change-transform"
        >
          {/* Bóng đổ nằm sát mặt bàn gỗ dùng radial-gradient mềm (y hệt blur-md nhưng 0 tốn GPU blur!) */}
          <div
            style={{
              background: 'radial-gradient(ellipse, rgba(12, 10, 9, 0.78) 0%, rgba(12, 10, 9, 0.35) 52%, rgba(12, 10, 9, 0) 76%)',
              transform: `translate3d(-50%, -25%, 0) scale(${metrics.shadowScale})`,
              opacity: metrics.shadowOpacity,
              transition: 'transform 160ms ease-out, opacity 160ms ease-out',
            }}
            className="absolute h-16 w-28 rounded-full"
          />

          {/* Thân bàn tay nâng theo độ cao liftY & góc xoay tự nhiên */}
          <div
            style={{
              transform: `translate(-50%, calc(-52% + ${metrics.liftY}px)) rotate(${metrics.rot}deg) scale(${metrics.scale})`,
              transition: 'transform 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="relative"
          >
            {/* Vỏ animation nảy/co bóp theo từng cử động cụ thể (key theo poseKey) */}
            <div
              key={`${hand.pose}-${hand.poseKey}`}
              className={
                hand.pose === 'slap_impact'
                  ? 'animate-oaq-slap-slam'
                  : hand.pose === 'scoop_grab'
                    ? 'animate-oaq-grab-clench'
                    : ''
              }
            >
              {/* Nhãn điểm bay lên khi ôm chiến lợi phẩm về giỏ */}
              {hand.floatingPoints && (
                <div
                  style={{ transform: `rotate(${-metrics.rot}deg)` }}
                  className="absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-yellow-100 bg-emerald-600 px-3 py-0.5 text-sm font-black text-white shadow-xl"
                >
                  {hand.floatingPoints}
                </div>
              )}

              {/* Huy hiệu đếm số sỏi còn đang giữ trên tay */}
              {hand.stonesInHand > 0 &&
                hand.pose !== 'reach_open' &&
                hand.pose !== 'slap_windup' &&
                hand.pose !== 'slap_impact' && (
                  <div
                    style={{ transform: `rotate(${-metrics.rot}deg)` }}
                    className="absolute -right-2 -top-1 z-20 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-amber-100 bg-stone-950/92 px-1.5 text-xs font-black text-amber-300 shadow-lg"
                  >
                    {hand.stonesInHand}
                  </div>
                )}

              <svg
                viewBox="0 0 120 142"
                className="h-[112px] w-[96px] overflow-visible drop-shadow-[0_6px_8px_rgba(24,8,2,0.38)]"
              >
                <defs>
                  <linearGradient id={skinId} x1="0.2" y1="0" x2="0.85" y2="1">
                    <stop offset="0%" stopColor="#FFF0DD" />
                    <stop offset="65%" stopColor="#FAD5B0" />
                    <stop offset="100%" stopColor="#E3A878" />
                  </linearGradient>
                  <linearGradient id={sleeveId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={sleeveLight} />
                    <stop offset="100%" stopColor={sleeveDark} />
                  </linearGradient>
                  <linearGradient id={jadeId} x1="0.2" y1="0" x2="0.85" y2="1">
                    <stop offset="0%" stopColor="#FEF9C3" />
                    <stop offset="45%" stopColor="#34D399" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                </defs>

                {/* Cổ tay & ống tay áo truyền thống xắn gọn */}
                <path
                  d="M 44 101 L 78 101 L 86 134 Q 61 140 36 134 Z"
                  fill={`url(#${sleeveId})`}
                  stroke={sleeveBorder}
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                {/* Nếp viền cổ tay áo mềm mại */}
                <path
                  d="M 41 105 Q 61 112 81 105"
                  fill="none"
                  stroke={cuffAccent}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  opacity="0.82"
                />
                <path
                  d="M 44 114 Q 61 119 78 114"
                  fill="none"
                  stroke={sleeveBorder}
                  strokeWidth="1.6"
                  opacity="0.45"
                />

                {hand.pose === 'reach_open' ||
                hand.pose === 'slap_windup' ||
                hand.pose === 'slap_impact'
                  ? renderOpenSpreadHand(hand.pose === 'slap_impact')
                  : hand.pose === 'scoop_grab' || hand.pose === 'sweep_capture'
                    ? renderClenchedGrabHand(hand.stonesInHand, hand.holdingMandarin)
                    : renderCarryOrDropHand(hand.pose === 'drop_pinch', hand.stonesInHand)}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
