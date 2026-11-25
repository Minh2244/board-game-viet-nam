import { attachAutoDisconnect, createIdleAudioContextManager } from '@/shared/audio/audioLifecycle';
import { createWarmRoomReverb, type WarmRoomReverbBus } from '@/shared/audio/warmRoomReverb';

/**
 * Âm thanh đánh Cờ Tướng gỗ truyền thống chuẩn phòng thu (Web Audio API + vang mặt bàn gỗ siêu nhẹ):
 * - Mặc định LUÔN BẬT (không bị tắt theo nút Nhạc nền!).
 * - Tái hiện tiếng quân gỗ tiện tròn đập xuống mặt bàn gỗ hoàng dương "CỘP!" đanh giòn, uy lực cực đã tai.
 */

let xCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let reverbNode: WarmRoomReverbBus | null = null;
let noiseBuffer: AudioBuffer | null = null;
const idleAudio = createIdleAudioContextManager(() => xCtx, 8000);

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!xCtx) {
    xCtx = new Ctor();
    const comp = xCtx.createDynamicsCompressor();
    comp.threshold.value = -13;
    comp.knee.value = 16;
    comp.ratio.value = 4.2;
    comp.attack.value = 0.0025;
    comp.release.value = 0.15;

    masterBus = xCtx.createGain();
    masterBus.gain.value = 0.96;
    masterBus.connect(comp);
    comp.connect(xCtx.destination);

    // Độ vang mặt bàn gỗ đặc siêu nhẹ (thay ConvolverNode FFT ~20x nhẹ CPU trên ĐT)
    reverbNode = createWarmRoomReverb(xCtx, {
      delayA: 0.033,
      delayB: 0.055,
      feedback: 0.23,
      lowpassHz: 2350,
      wetGain: 0.23,
      destination: masterBus,
    });

    const nLen = Math.floor(xCtx.sampleRate * 0.45);
    noiseBuffer = xCtx.createBuffer(1, nLen, xCtx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nLen; i += 1) nd[i] = Math.random() * 2 - 1;
  }

  idleAudio.touch();
  return xCtx;
}

function send(node: AudioNode, wet = true): void {
  if (!masterBus) return;
  node.connect(masterBus);
  if (wet && reverbNode) node.connect(reverbNode.input);
}

/** Tiếng đập quân Cờ Tướng gỗ "CỘP!" đanh giòn vang bàn gỗ cực thật */
function xiangqiWoodSnap(pitch = 1, vol = 0.34, delay = 0): void {
  const ac = ensureAudio();
  if (!ac || !masterBus) return;
  const t0 = ac.currentTime + delay;

  // Lớp 1: Độ dày thân bàn gỗ đặc ("CỘP" trầm uy lực)
  const thump = ac.createOscillator();
  const thumpGain = ac.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(265 * pitch, t0);
  thump.frequency.exponentialRampToValueAtTime(74 * pitch, t0 + 0.068);
  thumpGain.gain.setValueAtTime(0.0001, t0);
  thumpGain.gain.linearRampToValueAtTime(vol, t0 + 0.003);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.082);
  thump.connect(thumpGain);
  send(thumpGain, true);
  attachAutoDisconnect(thump, [thumpGain]);
  thump.start(t0);
  thump.stop(t0 + 0.095);

  // Lớp 2: Âm đanh đặc trưng của đĩa gỗ tiện tròn (wood-block crack ~960Hz)
  const crack = ac.createOscillator();
  const crackFlt = ac.createBiquadFilter();
  const crackGain = ac.createGain();
  crack.type = 'triangle';
  crack.frequency.setValueAtTime(980 * pitch, t0);
  crack.frequency.exponentialRampToValueAtTime(420 * pitch, t0 + 0.028);
  crackFlt.type = 'bandpass';
  crackFlt.frequency.setValueAtTime(1150 * pitch, t0);
  crackFlt.Q.setValueAtTime(3.2, t0);
  crackGain.gain.setValueAtTime(0.0001, t0);
  crackGain.gain.linearRampToValueAtTime(vol * 0.65, t0 + 0.0025);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.036);
  crack.connect(crackFlt);
  crackFlt.connect(crackGain);
  send(crackGain, true);
  attachAutoDisconnect(crack, [crackFlt, crackGain]);
  crack.start(t0);
  crack.stop(t0 + 0.048);

  // Lớp 3: Mặt gỗ vỗ đanh giòn (transient snap ~2300Hz)
  if (noiseBuffer) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(2300 * pitch, t0);
    flt.Q.setValueAtTime(2.8, t0);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.linearRampToValueAtTime(vol * 0.72, t0 + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
    src.connect(flt);
    flt.connect(ng);
    send(ng, true);
    attachAutoDisconnect(src, [flt, ng]);
    src.start(t0);
    src.stop(t0 + 0.035);
  }
}

function gongTone(freq: number, dur: number, vol = 0.14, delay = 0, type: OscillatorType = 'triangle'): void {
  const ac = ensureAudio();
  if (!ac || !masterBus) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  send(gain, true);
  attachAutoDisconnect(osc, [gain]);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const xiangqiAudio = {
  /** Tiếng nhấc quân gỗ nhẹ trên bàn cờ */
  playSelect(): void {
    xiangqiWoodSnap(1.42, 0.14, 0);
  },
  /** Tiếng đặt quân Cờ Tướng gỗ "CỘP!" giòn chắc nịch */
  playMove(): void {
    xiangqiWoodSnap(1.0 + (Math.random() - 0.5) * 0.07, 0.34, 0);
  },
  /** Tiếng ăn quân "BỐP – CỘP!" đầy uy lực */
  playCapture(): void {
    xiangqiWoodSnap(1.36, 0.25, 0);
    xiangqiWoodSnap(0.74, 0.42, 0.034);
  },
  /** Tiếng trống đại + chiêng đồng Á Đông oai nghiêm khi CHIẾU TƯỚNG! */
  playCheck(): void {
    xiangqiWoodSnap(0.72, 0.38, 0);
    // Trống đại
    const ac = ensureAudio();
    if (ac && masterBus) {
      const t0 = ac.currentTime + 0.02;
      const drum = ac.createOscillator();
      const dg = ac.createGain();
      drum.type = 'sine';
      drum.frequency.setValueAtTime(145, t0);
      drum.frequency.exponentialRampToValueAtTime(52, t0 + 0.32);
      dg.gain.setValueAtTime(0.0001, t0);
      dg.gain.linearRampToValueAtTime(0.28, t0 + 0.008);
      dg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
      drum.connect(dg);
      send(dg, true);
      attachAutoDisconnect(drum, [dg]);
      drum.start(t0);
      drum.stop(t0 + 0.4);
    }
    // Chiêng đồng ngân vang
    gongTone(493.88, 0.42, 0.14, 0.04, 'triangle');
    gongTone(739.99, 0.48, 0.12, 0.08, 'sine');
    gongTone(1108.73, 0.35, 0.07, 0.11, 'sine');
  },
  /** Khúc ngũ cung Á Đông khải hoàn */
  playVictory(): void {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    notes.forEach((f, i) => gongTone(f, i === 5 ? 0.62 : 0.24, 0.14, i * 0.085, 'triangle'));
  },
  playDraw(): void {
    gongTone(440, 0.28, 0.11, 0, 'sine');
    gongTone(392, 0.38, 0.11, 0.15, 'sine');
  },
};
