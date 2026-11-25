import { create } from 'zustand';
import { readJson, writeJson } from '@/shared/storage/local';
import {
  attachAutoDisconnect,
  attachMultiSourceAutoDisconnect,
  createIdleAudioContextManager,
} from './audioLifecycle';
import { gameBgmEngine, type GameBgmScene } from './gameBgmEngine';

export type BgmScene = 'hub' | GameBgmScene | null;

const MUTE_STORAGE_KEY = 'bgvn_hub_muted';

// Tự động nhận nhạc nền Suno MP3/OGG/WAV nếu người dùng chép vào src/hub/assets/bgm*.{mp3,ogg,wav}
const customSunoTracks = import.meta.glob('../../hub/assets/bgm*.{mp3,ogg,wav}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const CUSTOM_BGM_URL: string | null = Object.values(customSunoTracks)[0] ?? null;

interface AudioStore {
  muted: boolean;
  bgmPlaying: boolean;
  hasCustomBgm: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  muted: readJson<boolean>(MUTE_STORAGE_KEY, false),
  bgmPlaying: false,
  hasCustomBgm: Boolean(CUSTOM_BGM_URL),
  toggleMute: () =>
    set((s) => {
      const next = !s.muted;
      writeJson(MUTE_STORAGE_KEY, next);
      if (next) {
        stopBgmInternal();
        gameBgmEngine.stop();
        return { muted: true, bgmPlaying: false };
      }
      // Bật lại đúng bản nhạc nền của màn/game hiện tại
      queueMicrotask(() => resumeActiveBgmScene());
      return { muted: false };
    }),
  setMuted: (muted: boolean) => {
    writeJson(MUTE_STORAGE_KEY, muted);
    if (muted) {
      stopBgmInternal();
      gameBgmEngine.stop();
      set({ muted: true, bgmPlaying: false });
      return;
    }
    set({ muted: false });
    queueMicrotask(() => resumeActiveBgmScene());
  },
}));

let audioCtx: AudioContext | null = null;
let bgmMasterGain: GainNode | null = null;
let bgmCompressor: DynamicsCompressorNode | null = null;
let noiseBufferCache: AudioBuffer | null = null;
let bgmAudioEl: HTMLAudioElement | null = null;
let bgmSchedulerId: ReturnType<typeof setInterval> | null = null;
let hubActive = false;
let currentBgmScene: BgmScene = null;
let bgmStep = 0;
let nextNoteTime = 0;
let hubVisibilityHooked = false;
const hubIdleAudio = createIdleAudioContextManager(
  () => (!hubActive || useAudioStore.getState().muted ? audioCtx : null),
  3500,
);

function hookHubVisibility(): void {
  if (hubVisibilityHooked || typeof document === 'undefined') return;
  hubVisibilityHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return;
    if (document.hidden) {
      if (audioCtx.state === 'running') {
        void audioCtx.suspend().catch(() => {});
      }
    } else if (hubActive && !useAudioStore.getState().muted && audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
  });
}

// Nhịp độ lễ hội dân gian hiện đại sôi động: 124 BPM (16 bước / ô nhịp = 121ms mỗi móc kép)
const BPM = 124;
const SIXTEENTH_SEC = 60 / BPM / 4;
const TOTAL_STEPS = 128; // 8 ô nhịp (Phần A sôi động + Phần B cao trào sáo trúc)

// Bảng tần số nốt nhạc chuẩn (Hz) — Âm giai Đô Trưởng Ngũ Cung tươi sáng
const N = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
} as const;

interface MelodyHit {
  freq: number;
  durSteps: number;
  grace?: boolean; // Luyến láy dân gian mượt
  accent?: number;
}

// 8 hợp âm tươi sáng theo từng nửa ô nhịp (mỗi ô 16 bước có 2 khe hợp âm 8 bước)
const CHORD_SLOTS: readonly { root: number; fifth: number; triad: readonly number[] }[] = [
  // Ô 1: C
  { root: N.C3, fifth: N.G2, triad: [N.C4, N.E4, N.G4] },
  { root: N.C3, fifth: N.G3, triad: [N.C4, N.E4, N.G4] },
  // Ô 2: G
  { root: N.G2, fifth: N.D3, triad: [N.B3, N.D4, N.G4] },
  { root: N.G2, fifth: N.D3, triad: [N.B3, N.D4, N.G4] },
  // Ô 3: Am7
  { root: N.A2, fifth: N.E3, triad: [N.C4, N.E4, N.A4] },
  { root: N.A2, fifth: N.E3, triad: [N.C4, N.E4, N.G4] },
  // Ô 4: F -> G
  { root: N.F2, fifth: N.C3, triad: [N.A3, N.C4, N.F4] },
  { root: N.G2, fifth: N.D3, triad: [N.B3, N.D4, N.G4] },
  // Ô 5: Fmaj7 (Cao trào Phần B)
  { root: N.F2, fifth: N.C3, triad: [N.A3, N.C4, N.E4, N.F4] },
  { root: N.F2, fifth: N.C3, triad: [N.A3, N.C4, N.F4] },
  // Ô 6: G6
  { root: N.G2, fifth: N.D3, triad: [N.B3, N.D4, N.E4, N.G4] },
  { root: N.G2, fifth: N.D3, triad: [N.B3, N.D4, N.G4] },
  // Ô 7: Em7 -> Am7
  { root: N.E2, fifth: N.B2, triad: [N.G3, N.B3, N.E4] },
  { root: N.A2, fifth: N.E3, triad: [N.C4, N.E4, N.A4] },
  // Ô 8: Dm7 -> G7 (dẫn về C cực cuốn)
  { root: N.D2, fifth: N.A2, triad: [N.A3, N.C4, N.D4, N.F4] },
  { root: N.G2, fifth: N.D3, triad: [N.B3, N.D4, N.F4, N.G4] },
];

// Giai điệu chính Đàn Tranh (Pluck) 128 bước (8 ô nhịp) — rộn ràng, nảy giòn kiểu hội xuân
const ZITHER_MELODY: Readonly<Record<number, MelodyHit>> = {
  // Ô 1 (C): C5 - E5 - G5 - A5 - G5 - E5 - D5 - E5
  0: { freq: N.C5, durSteps: 2, accent: 1.0 },
  2: { freq: N.E5, durSteps: 2, accent: 0.9 },
  4: { freq: N.G5, durSteps: 2, grace: true, accent: 1.05 },
  6: { freq: N.A5, durSteps: 2, accent: 0.95 },
  8: { freq: N.G5, durSteps: 3, accent: 1.0 },
  11: { freq: N.E5, durSteps: 1, accent: 0.85 },
  12: { freq: N.D5, durSteps: 2, accent: 0.9 },
  14: { freq: N.E5, durSteps: 2, accent: 0.95 },

  // Ô 2 (G): D5 - G5 - E5 - D5 - B4 - D5 - G4
  16: { freq: N.D5, durSteps: 2, grace: true, accent: 1.0 },
  18: { freq: N.G5, durSteps: 2, accent: 1.05 },
  20: { freq: N.E5, durSteps: 2, accent: 0.9 },
  22: { freq: N.D5, durSteps: 2, accent: 0.85 },
  24: { freq: N.B4, durSteps: 2, accent: 0.88 },
  26: { freq: N.D5, durSteps: 2, accent: 0.92 },
  28: { freq: N.G5, durSteps: 4, grace: true, accent: 1.0 },

  // Ô 3 (Am): A5 - G5 - E5 - C5 - D5 - E5 - G5 - E5
  32: { freq: N.A5, durSteps: 2, grace: true, accent: 1.05 },
  34: { freq: N.G5, durSteps: 2, accent: 0.92 },
  36: { freq: N.E5, durSteps: 2, accent: 0.95 },
  38: { freq: N.C5, durSteps: 2, accent: 0.85 },
  40: { freq: N.D5, durSteps: 2, accent: 0.9 },
  42: { freq: N.E5, durSteps: 2, accent: 0.96 },
  44: { freq: N.G5, durSteps: 2, accent: 1.0 },
  46: { freq: N.E5, durSteps: 2, accent: 0.9 },

  // Ô 4 (F -> G): A4 - C5 - D5 - E5 | G5 - A5 - G5 - D5
  48: { freq: N.A4, durSteps: 2, accent: 0.9 },
  50: { freq: N.C5, durSteps: 2, accent: 0.95 },
  52: { freq: N.D5, durSteps: 2, grace: true, accent: 1.0 },
  54: { freq: N.E5, durSteps: 2, accent: 0.95 },
  56: { freq: N.G5, durSteps: 2, accent: 1.05 },
  58: { freq: N.A5, durSteps: 2, accent: 1.0 },
  60: { freq: N.G5, durSteps: 2, accent: 0.95 },
  62: { freq: N.D5, durSteps: 2, accent: 0.9 },

  // Ô 5 (F — Phần B bay bổng): C6 - A5 - G5 - A5 - C6 - A5 - G5
  64: { freq: N.C6, durSteps: 2, grace: true, accent: 1.1 },
  66: { freq: N.A5, durSteps: 2, accent: 0.95 },
  68: { freq: N.G5, durSteps: 2, accent: 0.9 },
  70: { freq: N.A5, durSteps: 2, accent: 1.0 },
  72: { freq: N.C6, durSteps: 3, accent: 1.08 },
  75: { freq: N.A5, durSteps: 1, accent: 0.88 },
  76: { freq: N.G5, durSteps: 2, accent: 0.95 },
  78: { freq: N.A5, durSteps: 2, accent: 0.95 },

  // Ô 6 (G): D6 - C6 - A5 - G5 - E5 - G5 - A5 - G5
  80: { freq: N.D6, durSteps: 2, grace: true, accent: 1.1 },
  82: { freq: N.C6, durSteps: 2, accent: 1.0 },
  84: { freq: N.A5, durSteps: 2, accent: 0.95 },
  86: { freq: N.G5, durSteps: 2, accent: 0.92 },
  88: { freq: N.E5, durSteps: 2, accent: 0.9 },
  90: { freq: N.G5, durSteps: 2, accent: 0.96 },
  92: { freq: N.A5, durSteps: 2, accent: 1.0 },
  94: { freq: N.G5, durSteps: 2, accent: 0.92 },

  // Ô 7 (Em7 -> Am7): E5 - G5 - B5 - A5 | C6 - A5 - G5 - E5
  96: { freq: N.E5, durSteps: 2, accent: 0.95 },
  98: { freq: N.G5, durSteps: 2, accent: 0.98 },
  100: { freq: N.B5, durSteps: 2, grace: true, accent: 1.05 },
  102: { freq: N.A5, durSteps: 2, accent: 0.95 },
  104: { freq: N.C6, durSteps: 2, grace: true, accent: 1.08 },
  106: { freq: N.A5, durSteps: 2, accent: 0.96 },
  108: { freq: N.G5, durSteps: 2, accent: 0.94 },
  110: { freq: N.E5, durSteps: 2, accent: 0.9 },

  // Ô 8 (Dm7 -> G7): D5 - E5 - G5 - A5 | G5 - E5 - D5 - G5 (dồn trống về C)
  112: { freq: N.D5, durSteps: 2, accent: 0.95 },
  114: { freq: N.E5, durSteps: 2, accent: 0.98 },
  116: { freq: N.G5, durSteps: 2, accent: 1.02 },
  118: { freq: N.A5, durSteps: 2, accent: 1.05 },
  120: { freq: N.G5, durSteps: 2, grace: true, accent: 1.05 },
  122: { freq: N.E5, durSteps: 2, accent: 0.95 },
  124: { freq: N.D5, durSteps: 2, accent: 0.95 },
  126: { freq: N.G5, durSteps: 2, accent: 1.05 },
};

// Sáo trúc ngân vang đối đáp nhẹ ở các điểm nhấn (Ô 2, 4, 5, 6, 8)
const FLUTE_FILLS: Readonly<Record<number, { freq: number; durSteps: number }>> = {
  28: { freq: N.G5, durSteps: 4 },
  60: { freq: N.D6, durSteps: 4 },
  64: { freq: N.C6, durSteps: 4 },
  72: { freq: N.E6, durSteps: 4 },
  80: { freq: N.D6, durSteps: 4 },
  88: { freq: N.G5, durSteps: 4 },
  104: { freq: N.C6, durSteps: 4 },
  120: { freq: N.G5, durSteps: 4 },
};

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  hookHubVisibility();
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function getBgmMaster(ctx: AudioContext): GainNode {
  if (!bgmMasterGain || bgmMasterGain.context !== ctx) {
    bgmCompressor = ctx.createDynamicsCompressor();
    bgmCompressor.threshold.value = -16;
    bgmCompressor.knee.value = 18;
    bgmCompressor.ratio.value = 4;
    bgmCompressor.attack.value = 0.005;
    bgmCompressor.release.value = 0.14;

    bgmMasterGain = ctx.createGain();
    bgmMasterGain.gain.value = 0.72;
    bgmMasterGain.connect(bgmCompressor);
    bgmCompressor.connect(ctx.destination);
  }
  return bgmMasterGain;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBufferCache && noiseBufferCache.sampleRate === ctx.sampleRate) {
    return noiseBufferCache;
  }
  const length = Math.floor(ctx.sampleRate * 0.25);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBufferCache = buf;
  return buf;
}

function playTone(
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  gainPeak = 0.12,
  type: OscillatorType = 'triangle',
) {
  // Hiệu ứng SFX mặc định luôn bật (chỉ nút Nhạc nền tắt BGM, không tắt SFX!)
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  hubIdleAudio.touch();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  attachAutoDisconnect(osc, [gain]);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

/** 1. Đàn Tranh gảy giòn tươi vui (có luyến láy dân gian) */
function scheduleZitherNote(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  hit: MelodyHit,
) {
  const dur = Math.max(0.22, hit.durSteps * SIXTEENTH_SEC * 1.45);
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'triangle';

  const startFreq = hit.grace ? hit.freq * 0.92 : hit.freq;
  osc1.frequency.setValueAtTime(startFreq, time);
  osc2.frequency.setValueAtTime(startFreq * 2, time);
  if (hit.grace) {
    osc1.frequency.exponentialRampToValueAtTime(hit.freq, time + 0.036);
    osc2.frequency.exponentialRampToValueAtTime(hit.freq * 2, time + 0.036);
  }

  const osc2Gain = ctx.createGain();
  osc2Gain.gain.setValueAtTime(0.26, time);

  filter.type = 'lowpass';
  filter.Q.setValueAtTime(2.2, time);
  filter.frequency.setValueAtTime(3600, time);
  filter.frequency.exponentialRampToValueAtTime(920, time + dur * 0.85);

  const peak = 0.17 * (hit.accent ?? 1);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(peak * 0.35, time + 0.09);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc1.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  attachMultiSourceAutoDisconnect([osc1, osc2], [osc2Gain, filter, gain]);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + dur + 0.03);
  osc2.stop(time + dur + 0.03);
}

/** 2. Sáo Trúc ngân nhẹ tạo cao trào vui nhộn */
function scheduleFluteNote(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  durSteps: number,
) {
  const dur = durSteps * SIXTEENTH_SEC * 1.15;
  const osc = ctx.createOscillator();
  const vib = ctx.createOscillator();
  const vibGain = ctx.createGain();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 0.985, time);
  osc.frequency.exponentialRampToValueAtTime(freq, time + 0.045);

  vib.type = 'sine';
  vib.frequency.setValueAtTime(5.6, time);
  vibGain.gain.setValueAtTime(freq * 0.012, time);
  vib.connect(vibGain);
  vibGain.connect(osc.frequency);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.11, time + 0.055);
  gain.gain.setValueAtTime(0.095, time + dur * 0.72);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(gain);
  gain.connect(dest);
  attachMultiSourceAutoDisconnect([osc, vib], [vibGain, gain]);

  osc.start(time);
  vib.start(time);
  osc.stop(time + dur + 0.03);
  vib.stop(time + dur + 0.03);
}

/** 3. Bass nảy đầy đặn đi cùng trống */
function scheduleBassNote(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  durSec: number,
  accent = 1,
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(520, time);
  filter.frequency.exponentialRampToValueAtTime(190, time + durSec);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.24 * accent, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + durSec);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  attachAutoDisconnect(osc, [filter, gain]);
  osc.start(time);
  osc.stop(time + durSec + 0.02);
}

/** 4. Quạt hợp âm Ukulele / Guitar phách nghịch rộn ràng */
function scheduleChordStrum(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  notes: readonly number[],
  accent = 1,
) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1350, time);
  filter.Q.setValueAtTime(0.9, time);
  filter.connect(dest);

  const sources: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  notes.forEach((f, idx) => {
    const t0 = time + idx * 0.009;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.055 * accent, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);

    osc.connect(g);
    g.connect(filter);
    sources.push(osc);
    gains.push(g);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  });
  attachMultiSourceAutoDisconnect(sources, [...gains, filter]);
}

/** 5a. Trống Kick chắc khỏe */
function scheduleKick(ctx: AudioContext, dest: AudioNode, time: number, accent = 1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(155, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.09);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.36 * accent, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

  osc.connect(gain);
  gain.connect(dest);
  attachAutoDisconnect(osc, [gain]);
  osc.start(time);
  osc.stop(time + 0.17);
}

/** 5b. Trống Snare + Vỗ tay / Phách tre giòn tan */
function scheduleSnareClap(ctx: AudioContext, dest: AudioNode, time: number, accent = 1) {
  // Lớp nhiễu snare
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.setValueAtTime(2100, time);
  hp.Q.setValueAtTime(0.85, time);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(0.16 * accent, time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);

  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  attachAutoDisconnect(src, [hp, g]);
  src.start(time);
  src.stop(time + 0.13);

  // Tiếng phách gỗ giòn
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(280, time);
  body.frequency.exponentialRampToValueAtTime(135, time + 0.05);
  bodyGain.gain.setValueAtTime(0.14 * accent, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.075);

  body.connect(bodyGain);
  bodyGain.connect(dest);
  attachAutoDisconnect(body, [bodyGain]);
  body.start(time);
  body.stop(time + 0.09);
}

/** 5c. Hi-hat / Xắc xô nhịp nhảy */
function scheduleHiHat(ctx: AudioContext, dest: AudioNode, time: number, open = false, accent = 1) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(6800, time);

  const dur = open ? 0.11 : 0.036;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime((open ? 0.075 : 0.055) * accent, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  attachAutoDisconnect(src, [hp, g]);
  src.start(time);
  src.stop(time + dur + 0.02);
}

/** 5d. Tiếng Song Loan / Mõ tre lễ hội điểm xuyết */
function scheduleWoodblock(ctx: AudioContext, dest: AudioNode, time: number, high = true) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const f = high ? 1180 : 880;
  osc.frequency.setValueAtTime(f, time);
  osc.frequency.exponentialRampToValueAtTime(f * 0.92, time + 0.045);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.085, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

  osc.connect(gain);
  gain.connect(dest);
  attachAutoDisconnect(osc, [gain]);
  osc.start(time);
  osc.stop(time + 0.07);
}

function scheduleBgmStep(ctx: AudioContext, dest: AudioNode, step: number, time: number) {
  const inBar = step % 16;
  const chordSlot = CHORD_SLOTS[Math.floor(step / 8) % CHORD_SLOTS.length];
  const isTurnaroundBar = step >= 112;

  // 1. Trống Kick (nhịp pop sôi động: 0, 6, 8, 10)
  if (inBar === 0 || inBar === 8 || inBar === 10 || (inBar === 6 && step % 32 >= 16)) {
    scheduleKick(ctx, dest, time, inBar === 0 ? 1.05 : 0.9);
  }

  // 2. Snare / Phách tre ở phách 2 & 4 (bước 4, 12) + dồn trống nhẹ cuối ô 8
  if (inBar === 4 || inBar === 12) {
    scheduleSnareClap(ctx, dest, time, 1.0);
  } else if (isTurnaroundBar && (inBar === 14 || inBar === 15)) {
    scheduleSnareClap(ctx, dest, time, 0.78);
  }

  // 3. Hi-hat lắc đều móc đơn & móc kép nhấn nhá
  if (inBar % 2 === 0) {
    const isOffbeatOpen = inBar === 14;
    scheduleHiHat(ctx, dest, time, isOffbeatOpen, inBar % 4 === 2 ? 1.1 : 0.75);
  } else if (inBar === 7 || inBar === 15) {
    scheduleHiHat(ctx, dest, time, false, 0.55);
  }

  // 4. Song loan / mõ tre vui tai ở phách nghịch
  if (inBar === 3 || inBar === 11) {
    scheduleWoodblock(ctx, dest, time, inBar === 3);
  }

  // 5. Bass nảy (root -> fifth -> octave)
  if (inBar === 0 || inBar === 8) {
    scheduleBassNote(ctx, dest, time, chordSlot.root, SIXTEENTH_SEC * 2.2, 1.0);
  } else if (inBar === 3 || inBar === 6) {
    scheduleBassNote(ctx, dest, time, chordSlot.fifth, SIXTEENTH_SEC * 1.6, 0.85);
  } else if (inBar === 10 || inBar === 14) {
    scheduleBassNote(ctx, dest, time, chordSlot.root * 2, SIXTEENTH_SEC * 1.4, 0.78);
  }

  // 6. Quạt hợp âm phách nghịch (2, 6, 10, 14)
  if (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14) {
    scheduleChordStrum(ctx, dest, time, chordSlot.triad, inBar === 2 || inBar === 10 ? 1.0 : 0.78);
  }

  // 7. Giai điệu chính Đàn Tranh
  const zitherHit = ZITHER_MELODY[step];
  if (zitherHit) {
    scheduleZitherNote(ctx, dest, time, zitherHit);
  }

  // 8. Sáo Trúc ngân điểm xuyết
  const fluteHit = FLUTE_FILLS[step];
  if (fluteHit) {
    scheduleFluteNote(ctx, dest, time, fluteHit.freq, fluteHit.durSteps);
  }
}

function pumpBgmScheduler() {
  if (!hubActive || useAudioStore.getState().muted) return;
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const master = getBgmMaster(ctx);
  // Lookahead 140ms giúp nhịp 124 BPM đều tăm tắp không bị giật lag
  if (nextNoteTime < ctx.currentTime - 0.1) {
    nextNoteTime = ctx.currentTime + 0.03;
  }
  while (nextNoteTime < ctx.currentTime + 0.14) {
    scheduleBgmStep(ctx, master, bgmStep % TOTAL_STEPS, nextNoteTime);
    nextNoteTime += SIXTEENTH_SEC;
    bgmStep = (bgmStep + 1) % TOTAL_STEPS;
  }
}

function stopBgmInternal() {
  if (bgmSchedulerId !== null) {
    clearInterval(bgmSchedulerId);
    bgmSchedulerId = null;
  }
  if (bgmAudioEl) {
    bgmAudioEl.pause();
  }
  if (bgmMasterGain && audioCtx) {
    try {
      bgmMasterGain.disconnect();
      bgmCompressor?.disconnect();
    } catch {
      // Ignore if already disconnected
    }
    bgmMasterGain = null;
    bgmCompressor = null;
  }
  hubIdleAudio.touch();
  useAudioStore.setState({ bgmPlaying: false });
}

function resumeActiveBgmScene() {
  if (typeof window === 'undefined' || useAudioStore.getState().muted) return;
  if (currentBgmScene === 'hub') {
    gameBgmEngine.stop();
    hubActive = true;
    soundEngine.startHubBgm();
  } else if (currentBgmScene) {
    hubActive = false;
    stopBgmInternal();
    gameBgmEngine.start(currentBgmScene);
    useAudioStore.setState({ bgmPlaying: true });
  }
}

export const soundEngine = {
  /** Chọn bản nhạc nền riêng theo màn chơi ('hub' hoặc 1 trong 5 game; null để dừng hẳn) */
  setBgmScene(scene: BgmScene) {
    currentBgmScene = scene;
    if (scene === null) {
      hubActive = false;
      stopBgmInternal();
      gameBgmEngine.stop();
      return;
    }
    if (scene === 'hub') {
      gameBgmEngine.stop();
      hubActive = true;
      if (!useAudioStore.getState().muted) {
        soundEngine.startHubBgm();
      }
      return;
    }
    hubActive = false;
    stopBgmInternal();
    if (!useAudioStore.getState().muted) {
      gameBgmEngine.start(scene);
      useAudioStore.setState({ bgmPlaying: true });
    }
  },
  /** Đánh dấu có đang ở Sảnh Ngoài / Sảnh Chờ Game hay không */
  setHubActive(active: boolean) {
    hubActive = active;
    if (active) {
      currentBgmScene = 'hub';
      gameBgmEngine.stop();
    } else {
      if (currentBgmScene === 'hub') currentBgmScene = null;
      stopBgmInternal();
    }
  },
  /** Tiếng nhấn nút 3D lún xuống nhẹ */
  playPushClick() {
    playTone(540, 270, 0.08, 0.14, 'triangle');
  },
  /** Tiếng chuyển / phóng to thẻ game trên dải ngang */
  playCarouselStep() {
    playTone(440, 660, 0.075, 0.12, 'sine');
  },
  /** Tiếng mở popup game sắp ra mắt */
  playComingSoon() {
    playTone(587, 880, 0.12, 0.13, 'sine');
  },
  /** Tiếng khởi động vào game */
  playEnterGame() {
    playTone(523, 784, 0.12, 0.14, 'triangle');
    setTimeout(() => playTone(784, 1046, 0.15, 0.12, 'triangle'), 75);
  },
  /** Tiếng báo có người vừa tham gia phòng Online */
  playRoomJoin() {
    playTone(587, 880, 0.1, 0.12, 'sine');
    setTimeout(() => playTone(880, 1174, 0.12, 0.11, 'triangle'), 70);
  },
  /** Khởi chạy nhạc nền lễ hội 124 BPM (chỉ hoạt động khi đang ở Sảnh / Phòng chờ) */
  startHubBgm() {
    if (typeof window === 'undefined' || !hubActive || useAudioStore.getState().muted) return;

    if (CUSTOM_BGM_URL && typeof Audio !== 'undefined') {
      if (!bgmAudioEl) {
        bgmAudioEl = new Audio(CUSTOM_BGM_URL);
        bgmAudioEl.loop = true;
      }
      bgmAudioEl.volume = 0.72;
      if (bgmAudioEl.paused) {
        void bgmAudioEl
          .play()
          .then(() => {
            if (hubActive && !useAudioStore.getState().muted) {
              useAudioStore.setState({ bgmPlaying: true });
            } else {
              bgmAudioEl?.pause();
            }
          })
          .catch(() => {
            // Đợi lần chạm kế tiếp theo chính sách autoplay trình duyệt
          });
      }
      return;
    }

    const ctx = getCtx();
    if (!ctx) return;

    const ensureLoopRunning = () => {
      if (!hubActive || useAudioStore.getState().muted) return;
      if (bgmSchedulerId === null) {
        nextNoteTime = ctx.currentTime + 0.04;
        pumpBgmScheduler();
        bgmSchedulerId = setInterval(pumpBgmScheduler, 25);
      }
      useAudioStore.setState({ bgmPlaying: true });
    };

    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        ensureLoopRunning();
      });
      return;
    }

    ensureLoopRunning();
  },
  /** Tạm dừng nhạc nền */
  stopHubBgm() {
    stopBgmInternal();
    gameBgmEngine.stop();
  },
  /** Mở khóa AudioContext sau lần chạm đầu tiên của người dùng và phát đúng bài nhạc nền hiện tại */
  unlockBgmOnGesture() {
    resumeActiveBgmScene();
  },
};
