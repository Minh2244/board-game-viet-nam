import { memo } from 'react';

/**
 * Nền sân gạch tàu đất nung rải nắng chiều ấm áp + bóng lá tre 4 góc (100% SVG/CSS nhẹ 60fps).
 */
export const CourtyardBackground = memo(function CourtyardBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Nền gạch tàu đất nung */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#9C4828',
          backgroundImage: `
            radial-gradient(ellipse at 50% 35%, rgba(255, 224, 158, 0.34) 0%, rgba(164, 72, 38, 0.12) 48%, rgba(44, 16, 8, 0.56) 100%),
            repeating-linear-gradient(0deg, rgba(64, 24, 10, 0.35) 0px, rgba(64, 24, 10, 0.35) 2px, transparent 2px, transparent 58px),
            repeating-linear-gradient(90deg, rgba(64, 24, 10, 0.28) 0px, rgba(64, 24, 10, 0.28) 2px, transparent 2px, transparent 86px)
          `,
        }}
      />

      {/* Vệt nắng chiều ấm xiên chéo qua sân */}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          background:
            'linear-gradient(125deg, rgba(255, 232, 168, 0.5) 0%, rgba(255, 210, 128, 0.14) 36%, transparent 58%, rgba(28, 10, 4, 0.32) 100%)',
        }}
      />

      {/* Cành lá tre góc trên trái */}
      <svg
        viewBox="0 0 260 220"
        className="absolute -left-4 -top-4 h-52 w-64 opacity-80 drop-shadow-[0_6px_10px_rgba(20,8,2,0.45)]"
      >
        <path d="M-8 10 Q70 35 160 12" stroke="#365314" strokeWidth="4" fill="none" />
        <path d="M18 16 Q95 75 185 68" stroke="#365314" strokeWidth="3.2" fill="none" />
        <path d="M5 10 Q42 88 26 165" stroke="#365314" strokeWidth="3" fill="none" />
        <ellipse cx="95" cy="24" rx="34" ry="8" transform="rotate(-14 95 24)" fill="#4D7C0F" />
        <ellipse cx="145" cy="18" rx="32" ry="7.5" transform="rotate(-6 145 18)" fill="#65A30D" />
        <ellipse cx="105" cy="58" rx="36" ry="8.5" transform="rotate(24 105 58)" fill="#3F6212" />
        <ellipse cx="162" cy="68" rx="34" ry="7.5" transform="rotate(8 162 68)" fill="#65A30D" />
        <ellipse cx="42" cy="96" rx="34" ry="8" transform="rotate(64 42 96)" fill="#4D7C0F" />
        <ellipse cx="22" cy="145" rx="30" ry="7" transform="rotate(82 22 145)" fill="#3F6212" />
      </svg>

      {/* Cành lá tre góc dưới phải */}
      <svg
        viewBox="0 0 260 220"
        className="absolute -bottom-5 -right-4 h-52 w-64 rotate-180 opacity-80 drop-shadow-[0_6px_10px_rgba(20,8,2,0.45)]"
      >
        <path d="M-8 10 Q70 35 160 12" stroke="#365314" strokeWidth="4" fill="none" />
        <path d="M18 16 Q95 75 185 68" stroke="#365314" strokeWidth="3.2" fill="none" />
        <ellipse cx="95" cy="24" rx="34" ry="8" transform="rotate(-14 95 24)" fill="#4D7C0F" />
        <ellipse cx="145" cy="18" rx="32" ry="7.5" transform="rotate(-6 145 18)" fill="#65A30D" />
        <ellipse cx="105" cy="58" rx="36" ry="8.5" transform="rotate(24 105 58)" fill="#3F6212" />
        <ellipse cx="162" cy="68" rx="34" ry="7.5" transform="rotate(8 162 68)" fill="#65A30D" />
      </svg>

      {/* Lá tre mảnh góc dưới trái */}
      <svg viewBox="0 0 180 140" className="absolute -bottom-3 -left-3 h-32 w-44 opacity-65">
        <ellipse cx="44" cy="110" rx="34" ry="7.5" transform="rotate(-24 44 110)" fill="#3F6212" />
        <ellipse cx="94" cy="122" rx="30" ry="7" transform="rotate(-8 94 122)" fill="#4D7C0F" />
      </svg>
    </div>
  );
});
