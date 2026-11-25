/**
 * Bộ tổng hợp Nhạc Nền (BGM) riêng biệt cho từng trò chơi (Web Audio API thuần code, 0 KB tải mạng):
 * - `co-ty-phu` (106 BPM): Du lịch thương hội tươi vui (Marimba + Guitar nhẹ + Đàn tranh điểm xuyết)
 * - `o-an-quan` (76 BPM): Đồng quê Việt Nam êm dịu (Đàn tranh ngũ cung + Sáo trúc + Phách tre nhẹ)
 * - `co-ca-ngua` (114 BPM): Lễ hội đua ngựa rộn ràng (Marimba gỗ + Pizzicato nảy nhịp + Chuông nhẹ)
 * - `co-vua` (70 BPM): Thính phòng cổ điển tập trung (Felt Piano ấm + Cello trầm lắng)
 * - `co-tuong` (66 BPM): Thiền trà Á Đông khoan thai (Cổ cầm / Đàn tranh rải dây + Sáo tiêu)
 *
 * Âm lượng nền dịu êm để làm không khí thư giãn và tuyệt đối không lấn át âm thanh đánh cờ (SFX).
 */

import { attachAutoDisconnect, attachMultiSourceAutoDisconnect } from './audioLifecycle';
import { createWarmRoomReverb, type WarmRoomReverbBus } from './warmRoomReverb';

export type GameBgmScene = 'co-ty-phu' | 'o-an-quan' | 'co-ca-ngua' | 'co-vua' | 'co-tuong';

const F = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Gs4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66,
} as const;

interface SceneRuntime {
  scene: GameBgmScene;
  step: number;
  nextTime: number;
  timerId: ReturnType<typeof setInterval> | null;
}

const SCENE_BPM: Record<GameBgmScene, number> = {
  'co-ty-phu': 106,
  'o-an-quan': 76,
  'co-ca-ngua': 114,
  'co-vua': 70,
  'co-tuong': 66,
};

let bgmCtx: AudioContext | null = null;
let bgmMaster: GainNode | null = null;
let bgmReverb: WarmRoomReverbBus | null = null;
let bgmNoise: AudioBuffer | null = null;
let runtime: SceneRuntime | null = null;
let visibilityHooked = false;

function hookBgmVisibility(): void {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (!bgmCtx) return;
    if (document.hidden) {
      if (bgmCtx.state === 'running') {
        void bgmCtx.suspend().catch(() => {});
      }
    } else if (runtime && bgmCtx.state === 'suspended') {
      void bgmCtx.resume().catch(() => {});
    }
  });
}

function ensureBgmAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  hookBgmVisibility();
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!bgmCtx) {
    bgmCtx = new Ctor();
  }
  if (!bgmMaster || bgmMaster.context !== bgmCtx) {
    const comp = bgmCtx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.008;
    comp.release.value = 0.18;

    bgmMaster = bgmCtx.createGain();
    bgmMaster.gain.value = 0.42;
    bgmMaster.connect(comp);
    comp.connect(bgmCtx.destination);

    // Phòng vang gỗ ấm siêu nhẹ (Dual-Tap Delay + Lowpass ~20x nhẹ hơn ConvolverNode FFT trên ĐT!)
    bgmReverb = createWarmRoomReverb(bgmCtx, {
      delayA: 0.053,
      delayB: 0.089,
      feedback: 0.26,
      lowpassHz: 2100,
      wetGain: 0.25,
      destination: bgmMaster,
    });

    const nLen = Math.floor(bgmCtx.sampleRate * 0.3);
    bgmNoise = bgmCtx.createBuffer(1, nLen, bgmCtx.sampleRate);
    const nd = bgmNoise.getChannelData(0);
    for (let i = 0; i < nLen; i += 1) nd[i] = Math.random() * 2 - 1;
  }
  return bgmCtx;
}

function connectOut(node: AudioNode, useReverb = true): void {
  if (!bgmMaster) return;
  node.connect(bgmMaster);
  if (useReverb && bgmReverb) node.connect(bgmReverb.input);
}

/** Phím Felt Piano mềm ấm (dùng cho Cờ Vua) */
function playPiano(ctx: AudioContext, time: number, freq: number, dur: number, vol = 0.13): void {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const flt = ctx.createBiquadFilter();
  const g = ctx.createGain();

  osc1.type = 'triangle';
  osc2.type = 'sine';
  osc1.frequency.setValueAtTime(freq, time);
  osc2.frequency.setValueAtTime(freq * 2, time);

  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.18, time);

  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(Math.min(2400, freq * 4.5), time);
  flt.frequency.exponentialRampToValueAtTime(Math.max(380, freq * 1.6), time + dur);

  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.015);
  g.gain.exponentialRampToValueAtTime(vol * 0.42, time + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc1.connect(flt);
  osc2.connect(g2);
  g2.connect(flt);
  flt.connect(g);
  connectOut(g, true);
  attachMultiSourceAutoDisconnect([osc1, osc2], [g2, flt, g]);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + dur + 0.04);
  osc2.stop(time + dur + 0.04);
}

/** Dây Cello trầm ấm ngân dài (dùng cho Cờ Vua) */
function playCelloPad(ctx: AudioContext, time: number, freq: number, dur: number, vol = 0.085): void {
  const osc = ctx.createOscillator();
  const flt = ctx.createBiquadFilter();
  const g = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(420, time);

  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.25);
  g.gain.setValueAtTime(vol * 0.85, time + Math.max(0.3, dur - 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(flt);
  flt.connect(g);
  connectOut(g, true);
  attachAutoDisconnect(osc, [flt, g]);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

/** Đàn Tranh / Cổ Cầm Á Đông (dùng cho Ô Ăn Quan, Cờ Tướng, Cờ Tỷ Phú) */
function playGuzheng(
  ctx: AudioContext,
  time: number,
  freq: number,
  dur: number,
  vol = 0.13,
  grace = false,
): void {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const flt = ctx.createBiquadFilter();
  const g = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'triangle';
  const startF = grace ? freq * 0.93 : freq;
  osc1.frequency.setValueAtTime(startF, time);
  osc2.frequency.setValueAtTime(startF * 2, time);
  if (grace) {
    osc1.frequency.exponentialRampToValueAtTime(freq, time + 0.045);
    osc2.frequency.exponentialRampToValueAtTime(freq * 2, time + 0.045);
  }

  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.24, time);

  flt.type = 'lowpass';
  flt.Q.setValueAtTime(2.0, time);
  flt.frequency.setValueAtTime(2800, time);
  flt.frequency.exponentialRampToValueAtTime(620, time + dur * 0.9);

  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.008);
  g.gain.exponentialRampToValueAtTime(vol * 0.32, time + 0.14);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc1.connect(flt);
  osc2.connect(g2);
  g2.connect(flt);
  flt.connect(g);
  connectOut(g, true);
  attachMultiSourceAutoDisconnect([osc1, osc2], [g2, flt, g]);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + dur + 0.05);
  osc2.stop(time + dur + 0.05);
}

/** Sáo Trúc / Sáo Tiêu thoáng đãng có rung nhẹ (dùng cho Ô Ăn Quan & Cờ Tướng) */
function playFlute(ctx: AudioContext, time: number, freq: number, dur: number, vol = 0.095): void {
  const osc = ctx.createOscillator();
  const vib = ctx.createOscillator();
  const vibG = ctx.createGain();
  const g = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 0.985, time);
  osc.frequency.exponentialRampToValueAtTime(freq, time + 0.06);

  vib.type = 'sine';
  vib.frequency.setValueAtTime(4.8, time);
  vibG.gain.setValueAtTime(freq * 0.01, time);
  vib.connect(vibG);
  vibG.connect(osc.frequency);

  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.09);
  g.gain.setValueAtTime(vol * 0.85, time + Math.max(0.12, dur * 0.72));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(g);
  connectOut(g, true);
  attachMultiSourceAutoDisconnect([osc, vib], [vibG, g]);
  osc.start(time);
  vib.start(time);
  osc.stop(time + dur + 0.04);
  vib.stop(time + dur + 0.04);
}

/** Marimba gỗ trong trẻo (dùng cho Cờ Tỷ Phú & Cờ Cá Ngựa) */
function playMarimba(ctx: AudioContext, time: number, freq: number, dur: number, vol = 0.15): void {
  const osc = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const og = ctx.createGain();
  const g = ctx.createGain();

  osc.type = 'sine';
  overtone.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  overtone.frequency.setValueAtTime(freq * 4, time);
  og.gain.setValueAtTime(0.08, time);

  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(g);
  overtone.connect(og);
  og.connect(g);
  connectOut(g, true);
  attachMultiSourceAutoDisconnect([osc, overtone], [og, g]);
  osc.start(time);
  overtone.start(time);
  osc.stop(time + dur + 0.03);
  overtone.stop(time + dur + 0.03);
}

/** Bass pizzicato ấm nhẹ */
function playBass(ctx: AudioContext, time: number, freq: number, dur: number, vol = 0.16): void {
  const osc = ctx.createOscillator();
  const flt = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(420, time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(flt);
  flt.connect(g);
  connectOut(g, false);
  attachAutoDisconnect(osc, [flt, g]);
  osc.start(time);
  osc.stop(time + dur + 0.03);
}

/** Phách gỗ / shaker siêu nhẹ tạo nhịp thở dễ chịu */
function playSoftPerc(ctx: AudioContext, time: number, kind: 'wood' | 'shaker', vol = 0.05): void {
  if (kind === 'wood') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, time);
    osc.frequency.exponentialRampToValueAtTime(520, time + 0.035);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    osc.connect(g);
    connectOut(g, true);
    attachAutoDisconnect(osc, [g]);
    osc.start(time);
    osc.stop(time + 0.055);
    return;
  }
  if (!bgmNoise) return;
  const src = ctx.createBufferSource();
  src.buffer = bgmNoise;
  const flt = ctx.createBiquadFilter();
  flt.type = 'highpass';
  flt.frequency.setValueAtTime(5800, time);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
  src.connect(flt);
  flt.connect(g);
  connectOut(g, false);
  attachAutoDisconnect(src, [flt, g]);
  src.start(time);
  src.stop(time + 0.05);
}

// ============================================================================
// 5 BẢN HÒA ÂM RIÊNG BIỆT (64 BƯỚC = 4 Ô NHỊP 16TH-NOTE MỖI BÀI)
// ============================================================================

const MONOPOLY_BASS = [F.G2, F.D3, F.E2, F.B2, F.C3, F.G2, F.D3, F.A2];
const MONOPOLY_MELODY: Readonly<Record<number, { f: number; d: number; z?: boolean }>> = {
  0: { f: F.G4, d: 0.28 }, 3: { f: F.B4, d: 0.24 }, 6: { f: F.D5, d: 0.34, z: true }, 10: { f: F.E5, d: 0.28 }, 12: { f: F.D5, d: 0.28 },
  16: { f: F.B4, d: 0.32 }, 20: { f: F.A4, d: 0.26 }, 22: { f: F.G4, d: 0.3 }, 26: { f: F.E4, d: 0.28 }, 28: { f: F.G4, d: 0.32, z: true },
  32: { f: F.C5, d: 0.32 }, 35: { f: F.B4, d: 0.26 }, 38: { f: F.A4, d: 0.32 }, 42: { f: F.G4, d: 0.26 }, 44: { f: F.E4, d: 0.34 },
  48: { f: F.D4, d: 0.28 }, 52: { f: F.G4, d: 0.28, z: true }, 54: { f: F.A4, d: 0.28 }, 58: { f: F.B4, d: 0.34 }, 60: { f: F.A4, d: 0.32 },
};

const OANQUAN_GUZHENG: Readonly<Record<number, { f: number; g?: boolean }>> = {
  0: { f: F.D4 }, 2: { f: F.A4 }, 4: { f: F.B4, g: true }, 8: { f: F.A4 }, 12: { f: F.G4 }, 14: { f: F.E4 },
  16: { f: F.D4 }, 20: { f: F.E4 }, 22: { f: F.G4, g: true }, 24: { f: F.A4 }, 28: { f: F.D5 },
  32: { f: F.E5, g: true }, 36: { f: F.D5 }, 40: { f: F.B4 }, 42: { f: F.A4 }, 44: { f: F.G4 },
  48: { f: F.A4 }, 50: { f: F.B4 }, 52: { f: F.A4, g: true }, 56: { f: F.G4 }, 60: { f: F.E4 },
};
const OANQUAN_FLUTE: Readonly<Record<number, { f: number; d: number }>> = {
  8: { f: F.D5, d: 1.1 },
  24: { f: F.A4, d: 1.0 },
  40: { f: F.B4, d: 1.1 },
  56: { f: F.D5, d: 1.2 },
};

const HORSE_BASS = [F.F2, F.C3, F.D2, F.A2, F.G2, F.D3, F.C3, F.G2];
const HORSE_MELODY: Readonly<Record<number, { f: number; d: number }>> = {
  0: { f: F.F4, d: 0.22 }, 2: { f: F.A4, d: 0.2 }, 4: { f: F.C5, d: 0.28 }, 7: { f: F.D5, d: 0.22 }, 10: { f: F.C5, d: 0.22 }, 12: { f: F.A4, d: 0.24 },
  16: { f: F.D5, d: 0.24 }, 18: { f: F.C5, d: 0.2 }, 20: { f: F.A4, d: 0.26 }, 24: { f: F.G4, d: 0.24 }, 28: { f: F.A4, d: 0.28 },
  32: { f: F.Bb4, d: 0.22 }, 34: { f: F.A4, d: 0.2 }, 36: { f: F.G4, d: 0.26 }, 40: { f: F.C5, d: 0.24 }, 44: { f: F.Bb4, d: 0.24 },
  48: { f: F.A4, d: 0.24 }, 50: { f: F.G4, d: 0.2 }, 52: { f: F.F4, d: 0.28 }, 56: { f: F.G4, d: 0.22 }, 60: { f: F.A4, d: 0.26 },
};

// Cờ Vua: Cổ điển thính phòng Am - F - C - G (64 bước)
const CHESS_CHORDS: readonly { cello: number; arp: readonly number[] }[] = [
  { cello: F.A2, arp: [F.A3, F.E4, F.A4, F.C5, F.E4, F.C5, F.B4, F.A4] },
  { cello: F.F2, arp: [F.F3, F.C4, F.F4, F.A4, F.C4, F.A4, F.G4, F.F4] },
  { cello: F.C3, arp: [F.C4, F.G4, F.C5, F.E5, F.G4, F.D5, F.C5, F.B4] },
  { cello: F.G2, arp: [F.G3, F.D4, F.G4, F.B4, F.D4, F.A4, F.G4, F.E4] },
];
const CHESS_TOP_MOTIF: Readonly<Record<number, { f: number; d: number }>> = {
  0: { f: F.E5, d: 1.1 }, 8: { f: F.C5, d: 0.9 }, 16: { f: F.A4, d: 1.2 }, 28: { f: F.B4, d: 0.7 },
  32: { f: F.C5, d: 1.1 }, 40: { f: F.E5, d: 0.9 }, 48: { f: F.D5, d: 1.2 }, 56: { f: F.B4, d: 1.0 },
};

// Cờ Tướng: Thiền trà Á Đông E ngũ cung (E-G-A-B-D)
const XIANGQI_PLUCKS: Readonly<Record<number, { f: number; d: number; g?: boolean }>> = {
  0: { f: F.E4, d: 1.25 }, 4: { f: F.B4, d: 1.1, g: true }, 8: { f: F.A4, d: 1.0 }, 12: { f: F.G4, d: 0.95 },
  16: { f: F.E4, d: 1.3 }, 22: { f: F.D4, d: 1.0 }, 26: { f: F.E4, d: 1.15, g: true },
  32: { f: F.G4, d: 1.15 }, 36: { f: F.A4, d: 1.1, g: true }, 40: { f: F.B4, d: 1.25 }, 44: { f: F.D5, d: 1.2 },
  48: { f: F.B4, d: 1.2, g: true }, 54: { f: F.A4, d: 1.05 }, 58: { f: F.G4, d: 1.15 },
};
const XIANGQI_XIAO: Readonly<Record<number, { f: number; d: number }>> = {
  4: { f: F.E5, d: 1.6 },
  24: { f: F.B4, d: 1.5 },
  40: { f: F.D5, d: 1.6 },
  56: { f: F.E4, d: 1.7 },
};

function scheduleSceneStep(ctx: AudioContext, scene: GameBgmScene, step: number, time: number): void {
  const s = step % 64;
  const bar = Math.floor(s / 16);
  const inBar = s % 16;

  switch (scene) {
    case 'co-ty-phu': {
      const halfBar = Math.floor(s / 8) % MONOPOLY_BASS.length;
      if (inBar === 0 || inBar === 8) {
        playBass(ctx, time, MONOPOLY_BASS[halfBar], 0.34, 0.15);
      } else if (inBar === 6 || inBar === 14) {
        playBass(ctx, time, MONOPOLY_BASS[halfBar] * 1.5, 0.22, 0.09);
      }
      if (inBar === 4 || inBar === 12) playSoftPerc(ctx, time, 'shaker', 0.032);
      if (inBar === 10) playSoftPerc(ctx, time, 'wood', 0.036);
      const hit = MONOPOLY_MELODY[s];
      if (hit) {
        if (hit.z) playGuzheng(ctx, time, hit.f, hit.d * 1.35, 0.1, true);
        else playMarimba(ctx, time, hit.f, hit.d, 0.125);
      }
      break;
    }

    case 'o-an-quan': {
      if (inBar === 0) {
        const roots = [F.D3, F.G2, F.A2, F.D3];
        playBass(ctx, time, roots[bar], 1.1, 0.11);
      }
      if (inBar === 0 || inBar === 8) playSoftPerc(ctx, time, 'wood', 0.028);
      const gz = OANQUAN_GUZHENG[s];
      if (gz) playGuzheng(ctx, time, gz.f, 0.85, 0.115, gz.g);
      const fl = OANQUAN_FLUTE[s];
      if (fl) playFlute(ctx, time, fl.f, fl.d, 0.085);
      break;
    }

    case 'co-ca-ngua': {
      const halfBar = Math.floor(s / 8) % HORSE_BASS.length;
      if (inBar === 0 || inBar === 6 || inBar === 8 || inBar === 14) {
        playBass(ctx, time, HORSE_BASS[halfBar], 0.2, 0.13);
      }
      if (inBar % 4 === 2) playSoftPerc(ctx, time, 'shaker', 0.03);
      if (inBar === 4 || inBar === 12) playSoftPerc(ctx, time, 'wood', 0.038);
      const hit = HORSE_MELODY[s];
      if (hit) playMarimba(ctx, time, hit.f, hit.d, 0.135);
      break;
    }

    case 'co-vua': {
      const chord = CHESS_CHORDS[bar];
      if (inBar === 0) {
        playCelloPad(ctx, time, chord.cello, 3.1, 0.085);
      }
      if (inBar % 2 === 0) {
        const arpNote = chord.arp[(inBar / 2) % chord.arp.length];
        playPiano(ctx, time, arpNote, 0.95, 0.095);
      }
      const motif = CHESS_TOP_MOTIF[s];
      if (motif) {
        playPiano(ctx, time, motif.f, motif.d, 0.125);
      }
      break;
    }

    case 'co-tuong': {
      if (inBar === 0) {
        const drones = [F.E2, F.B2, F.A2, F.E2];
        playCelloPad(ctx, time, drones[bar], 3.3, 0.065);
      }
      const pl = XIANGQI_PLUCKS[s];
      if (pl) playGuzheng(ctx, time, pl.f, pl.d, 0.12, pl.g);
      const xiao = XIANGQI_XIAO[s];
      if (xiao) playFlute(ctx, time, xiao.f, xiao.d, 0.085);
      if (s === 0 || s === 32) playSoftPerc(ctx, time, 'wood', 0.03);
      break;
    }
  }
}

function pumpGameBgm(): void {
  if (!runtime || !bgmCtx || bgmCtx.state !== 'running') return;
  const stepSec = 60 / SCENE_BPM[runtime.scene] / 4;
  if (runtime.nextTime < bgmCtx.currentTime - 0.14) {
    runtime.nextTime = bgmCtx.currentTime + 0.04;
  }
  while (runtime.nextTime < bgmCtx.currentTime + 0.24) {
    scheduleSceneStep(bgmCtx, runtime.scene, runtime.step, runtime.nextTime);
    runtime.nextTime += stepSec;
    runtime.step = (runtime.step + 1) % 64;
  }
}

export const gameBgmEngine = {
  start(scene: GameBgmScene): void {
    if (typeof window === 'undefined') return;
    if (runtime?.scene === scene && runtime.timerId !== null) {
      if (bgmCtx?.state === 'suspended') {
        void bgmCtx.resume().catch(() => {});
      }
      return;
    }
    this.stop();

    const ctx = ensureBgmAudio();
    if (!ctx) return;

    const launch = () => {
      if (runtime && runtime.scene !== scene) return;
      runtime = {
        scene,
        step: 0,
        nextTime: ctx.currentTime + 0.05,
        timerId: null,
      };
      if (bgmMaster) {
        bgmMaster.gain.cancelScheduledValues(ctx.currentTime);
        bgmMaster.gain.setValueAtTime(0.001, ctx.currentTime);
        bgmMaster.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 0.45);
      }
      pumpGameBgm();
      runtime.timerId = setInterval(pumpGameBgm, 75);
    };

    if (ctx.state === 'suspended') {
      runtime = { scene, step: 0, nextTime: 0, timerId: null };
      void ctx
        .resume()
        .then(() => {
          if (runtime?.scene === scene && runtime.timerId === null) {
            launch();
          }
        })
        .catch(() => {});
      return;
    }
    launch();
  },

  stop(): void {
    if (runtime?.timerId !== null && runtime?.timerId !== undefined) {
      clearInterval(runtime.timerId);
    }
    runtime = null;
    if (bgmMaster && bgmCtx) {
      try {
        bgmMaster.gain.cancelScheduledValues(bgmCtx.currentTime);
        bgmMaster.gain.setValueAtTime(0.0001, bgmCtx.currentTime);
        bgmMaster.disconnect();
        bgmReverb?.disconnect();
      } catch {
        // Ignore
      }
      bgmMaster = null;
      bgmReverb = null;
    }
    if (bgmCtx && bgmCtx.state === 'running') {
      void bgmCtx.suspend().catch(() => {});
    }
  },
};
