/**
 * Âm thanh đánh Cờ Vua Cổ Điển chuẩn phòng thu (Web Audio API + vang phòng gỗ ConvolverNode):
 * - Mặc định LUÔN BẬT (không bị tắt theo nút Nhạc nền!).
 * - Mô phỏng quân Staunton gỗ đặc chạm mặt bàn gỗ óc chó nhiều lớp (body thud + wood resonance + transient click).
 */

let cCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!cCtx) {
    cCtx = new Ctor();
    const comp = cCtx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.14;

    masterBus = cCtx.createGain();
    masterBus.gain.value = 0.94;
    masterBus.connect(comp);
    comp.connect(cCtx.destination);

    // Phòng gỗ cổ điển vang ấm 0.28s
    const irLen = Math.floor(cCtx.sampleRate * 0.28);
    const ir = cCtx.createBuffer(2, irLen, cCtx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i += 1) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.1) * 0.22;
      }
    }
    reverbNode = cCtx.createConvolver();
    reverbNode.buffer = ir;
    const wet = cCtx.createGain();
    wet.gain.value = 0.24;
    reverbNode.connect(wet);
    wet.connect(masterBus);

    const nLen = Math.floor(cCtx.sampleRate * 0.45);
    noiseBuffer = cCtx.createBuffer(1, nLen, cCtx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nLen; i += 1) nd[i] = Math.random() * 2 - 1;
  }

  if (cCtx.state === 'suspended') void cCtx.resume().catch(() => {});
  return cCtx;
}

function send(node: AudioNode, wet = true): void {
  if (!masterBus) return;
  node.connect(masterBus);
  if (wet && reverbNode) node.connect(reverbNode);
}

/** Tiếng đặt quân gỗ Staunton nặng chắc tay lên mặt bàn gỗ */
function stauntonWoodThud(pitch = 1, vol = 0.3, delay = 0): void {
  const ac = ensureAudio();
  if (!ac || !masterBus) return;
  const t0 = ac.currentTime + delay;

  // Lớp 1: Thân gỗ trầm ấm ("tock" đáy quân cờ có bọc nỉ nhẹ)
  const body = ac.createOscillator();
  const bodyGain = ac.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(215 * pitch, t0);
  body.frequency.exponentialRampToValueAtTime(76 * pitch, t0 + 0.058);
  bodyGain.gain.setValueAtTime(0.0001, t0);
  bodyGain.gain.linearRampToValueAtTime(vol, t0 + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.072);
  body.connect(bodyGain);
  send(bodyGain, true);
  body.start(t0);
  body.stop(t0 + 0.085);

  // Lớp 2: Cộng hưởng gỗ cứng ở dải trung
  const wood = ac.createOscillator();
  const woodFlt = ac.createBiquadFilter();
  const woodGain = ac.createGain();
  wood.type = 'triangle';
  wood.frequency.setValueAtTime(560 * pitch, t0);
  wood.frequency.exponentialRampToValueAtTime(230 * pitch, t0 + 0.032);
  woodFlt.type = 'bandpass';
  woodFlt.frequency.setValueAtTime(780 * pitch, t0);
  woodFlt.Q.setValueAtTime(2.6, t0);
  woodGain.gain.setValueAtTime(0.0001, t0);
  woodGain.gain.linearRampToValueAtTime(vol * 0.52, t0 + 0.003);
  woodGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.038);
  wood.connect(woodFlt);
  woodFlt.connect(woodGain);
  send(woodGain, true);
  wood.start(t0);
  wood.stop(t0 + 0.05);

  // Lớp 3: Va chạm mặt gỗ khô sắc gọn (18ms)
  if (noiseBuffer) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(1850 * pitch, t0);
    flt.Q.setValueAtTime(3.4, t0);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.linearRampToValueAtTime(vol * 0.58, t0 + 0.0025);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);
    src.connect(flt);
    flt.connect(ng);
    send(ng, true);
    src.start(t0);
    src.stop(t0 + 0.032);
  }
}

function chime(freq: number, dur = 0.28, vol = 0.13, delay = 0, type: OscillatorType = 'sine'): void {
  const ac = ensureAudio();
  if (!ac || !masterBus) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  send(gain, true);
  osc.start(t0);
  osc.stop(t0 + dur + 0.04);
}

export const chessAudio = {
  /** Tiếng nhấc quân nhẹ nhàng khi chạm chọn */
  playSelect(): void {
    stauntonWoodThud(1.38, 0.13, 0);
  },
  /** Tiếng đặt quân Staunton xuống ô gỗ trầm chắc */
  playMove(): void {
    stauntonWoodThud(1.0 + (Math.random() - 0.5) * 0.06, 0.29, 0);
  },
  /** Tiếng ăn quân dứt khoát 2 nhịp (gạt + đặt quân mạnh) */
  playCapture(): void {
    stauntonWoodThud(1.32, 0.22, 0);
    stauntonWoodThud(0.76, 0.36, 0.036);
  },
  /** Tiếng nhập thành: Vua + Xe đặt liền 2 nhịp chuẩn cổ điển */
  playCastle(): void {
    stauntonWoodThud(0.94, 0.28, 0);
    stauntonWoodThud(1.14, 0.26, 0.105);
  },
  /** Tiếng Chiếu Vua: đặt quân mạnh + trống trầm + chuông đồng cảnh báo */
  playCheck(): void {
    stauntonWoodThud(0.82, 0.32, 0);
    chime(146.83, 0.26, 0.18, 0.015, 'sine');
    chime(659.25, 0.24, 0.13, 0.035, 'triangle');
    chime(987.77, 0.32, 0.11, 0.1, 'sine');
  },
  /** Tiếng Phong cấp: hợp âm pha lê bay lên */
  playPromote(): void {
    stauntonWoodThud(1.12, 0.25, 0);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => chime(f, 0.32, 0.13, i * 0.055, 'triangle'));
  },
  /** Khúc khải hoàn khi Chiếu Bí */
  playVictory(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      chime(f, i === 4 ? 0.55 : 0.24, 0.14, i * 0.09, 'triangle'),
    );
  },
  /** Âm thanh hòa cờ êm dịu */
  playDraw(): void {
    chime(440, 0.28, 0.11, 0, 'sine');
    chime(392, 0.38, 0.11, 0.15, 'sine');
  },
};
