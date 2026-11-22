import { create } from 'zustand';
import { readJson, writeJson } from '@/shared/storage/local';

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
      }
      return { muted: next, bgmPlaying: false };
    }),
  setMuted: (muted: boolean) => {
    writeJson(MUTE_STORAGE_KEY, muted);
    if (muted) {
      stopBgmInternal();
    }
    set({ muted, bgmPlaying: false });
  },
}));

let audioCtx: AudioContext | null = null;
let bgmMasterGain: GainNode | null = null;
let bgmAudioEl: HTMLAudioElement | null = null;
let bgmTimerId: ReturnType<typeof setInterval> | null = null;
let hubActive = false;
let bgmStep = 0;

// Giai điệu ngũ cung ấm áp + hợp âm nền (Đô - Rê - Mi - Sol - La)
const MELODY_NOTES: readonly (number | null)[] = [
  523.25, // C5
  659.25, // E5
  587.33, // D5
  null,
  440.0, // A4
  523.25, // C5
  659.25, // E5
  null,
  392.0, // G4
  440.0, // A4
  523.25, // C5
  null,
  587.33, // D5
  523.25, // C5
  440.0, // A4
  392.0, // G4
];

const CHORD_PADS: readonly (readonly number[])[] = [
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 329.63], // G6
  [164.81, 196.0, 246.94, 293.66], // Em7
  [220.0, 261.63, 329.63, 392.0], // Am7
];

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
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
    bgmMasterGain = ctx.createGain();
    bgmMasterGain.gain.value = 0.85;
    bgmMasterGain.connect(ctx.destination);
  }
  return bgmMasterGain;
}

function playTone(
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  gainPeak = 0.12,
  type: OscillatorType = 'triangle',
) {
  if (useAudioStore.getState().muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

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
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

function playMelodyVoice(ctx: AudioContext, dest: AudioNode, freq: number) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);

  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(freq * 2, now);

  const overGain = ctx.createGain();
  overGain.gain.setValueAtTime(0.22, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1600, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

  osc.connect(filter);
  overtone.connect(overGain);
  overGain.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(now);
  overtone.start(now);
  osc.stop(now + 0.76);
  overtone.stop(now + 0.76);
}

function playChordPad(ctx: AudioContext, dest: AudioNode, freqs: readonly number[]) {
  const now = ctx.currentTime;
  const padGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(880, now);

  padGain.gain.setValueAtTime(0.0001, now);
  padGain.gain.linearRampToValueAtTime(0.075, now + 0.25);
  padGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);

  filter.connect(padGain);
  padGain.connect(dest);

  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + 1.9);
  }
}

function playHubBgmStep() {
  if (!hubActive || useAudioStore.getState().muted) return;
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const master = getBgmMaster(ctx);
  if (bgmStep % 4 === 0) {
    const chordIdx = Math.floor(bgmStep / 4) % CHORD_PADS.length;
    playChordPad(ctx, master, CHORD_PADS[chordIdx]);
  }
  const note = MELODY_NOTES[bgmStep % MELODY_NOTES.length];
  if (note !== null) {
    playMelodyVoice(ctx, master, note);
  }
  bgmStep += 1;
}

function stopBgmInternal() {
  if (bgmTimerId !== null) {
    clearInterval(bgmTimerId);
    bgmTimerId = null;
  }
  if (bgmAudioEl) {
    bgmAudioEl.pause();
  }
  if (bgmMasterGain && audioCtx) {
    try {
      bgmMasterGain.disconnect();
    } catch {
      // Ignore if already disconnected
    }
    bgmMasterGain = null;
  }
  useAudioStore.setState({ bgmPlaying: false });
}

export const soundEngine = {
  /** Đánh dấu có đang ở màn hình Sảnh Ngoài hay không (nhạc nền CHỈ phát ở Sảnh) */
  setHubActive(active: boolean) {
    hubActive = active;
    if (!active) {
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
  /** Khởi chạy nhạc nền (chỉ hoạt động khi đang ở Sảnh Ngoài) */
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
      if (bgmTimerId === null) {
        playHubBgmStep();
        bgmTimerId = setInterval(playHubBgmStep, 460);
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
  /** Tạm dừng nhạc nền sảnh */
  stopHubBgm() {
    stopBgmInternal();
  },
};
