import { createWarmRoomReverb, type WarmRoomReverbBus } from '@/shared/audio/warmRoomReverb';

// Hiệu ứng âm thanh Cờ Cá Ngựa (mặc định luôn bật SFX, không bị tắt theo nút Nhạc nền)

let hCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let reverbNode: WarmRoomReverbBus | null = null;
let noiseBuffer: AudioBuffer | null = null;

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!hCtx) {
    hCtx = new Ctor();
    const comp = hCtx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;

    masterBus = hCtx.createGain();
    masterBus.gain.value = 0.94;
    masterBus.connect(comp);
    comp.connect(hCtx.destination);

    // Vang phòng gỗ ấm siêu nhẹ (thay ConvolverNode FFT ~20x nhẹ CPU trên ĐT)
    reverbNode = createWarmRoomReverb(hCtx, {
      delayA: 0.034,
      delayB: 0.056,
      feedback: 0.22,
      lowpassHz: 2500,
      wetGain: 0.19,
      destination: masterBus,
    });

    const nLen = Math.floor(hCtx.sampleRate * 1.1);
    noiseBuffer = hCtx.createBuffer(1, nLen, hCtx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nLen; i += 1) {
      nd[i] = Math.random() * 2 - 1;
    }
  }

  if (hCtx.state === 'suspended') {
    void hCtx.resume().catch(() => {});
  }
  return hCtx;
}

function sendOut(node: AudioNode, wet = true): void {
  if (!masterBus) return;
  node.connect(masterBus);
  if (wet && reverbNode) {
    node.connect(reverbNode.input);
  }
}

function tone(
  freq1: number,
  freq2: number,
  dur: number,
  gainPeak = 0.16,
  type: OscillatorType = 'triangle',
  delay = 0,
  wet = true,
  filterHz = 0,
): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(25, freq1), t0);
  if (freq2 !== freq1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq2), t0 + dur);
  }

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(0.015, dur * 0.18));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  if (filterHz > 0) {
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(filterHz, t0);
    osc.connect(flt);
    flt.connect(gain);
  } else {
    osc.connect(gain);
  }

  sendOut(gain, wet);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noiseBurst(
  filterFreq1: number,
  filterFreq2: number,
  q: number,
  dur: number,
  gainPeak: number,
  delay = 0,
  filterType: BiquadFilterType = 'bandpass',
  wet = true,
): void {
  const ac = ensureAudio();
  if (!ac || !noiseBuffer) return;
  const t0 = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = ac.createBiquadFilter();
  filter.type = filterType;
  filter.Q.setValueAtTime(q, t0);
  filter.frequency.setValueAtTime(filterFreq1, t0);
  if (filterFreq2 !== filterFreq1) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterFreq2), t0 + dur);
  }

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(0.02, dur * 0.22));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter);
  filter.connect(gain);
  sendOut(gain, wet);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

/** Tiếng gõ gỗ/nhựa đặc trưng kiểu xúc xắc & vó ngựa đập bàn cờ */
function woodKnock(pitch = 1, vol = 0.24, delay = 0): void {
  tone(330 * pitch, 120 * pitch, 0.055, vol, 'triangle', delay, true, 1750);
  noiseBurst(1650 * pitch, 720 * pitch, 3.8, 0.032, vol * 0.72, delay, 'bandpass', true);
}

/** Tiếng đàn dây/marimba ấm sáng */
function marimbaPluck(freq: number, dur = 0.34, vol = 0.16, delay = 0): void {
  tone(freq, freq * 0.996, dur, vol, 'triangle', delay, true, 2600);
  tone(freq * 2, freq * 1.995, dur * 0.52, vol * 0.42, 'sine', delay, true);
  noiseBurst(freq * 3.4, freq * 1.8, 4.0, 0.018, vol * 0.28, delay, 'bandpass', false);
}

/** Tiếng chuông pha lê trong trẻo */
function sparkleBell(freq: number, delay = 0, vol = 0.13): void {
  tone(freq, freq * 1.004, 0.32, vol, 'sine', delay, true);
  tone(freq * 2.5, freq * 2.5, 0.18, vol * 0.42, 'sine', delay, true);
}

export const horseAudio = {
  /** Tiếng lắc cốc & vút gió tung xúc xắc bay lên không trung */
  playDiceShake(): void {
    woodKnock(1.12, 0.15, 0);
    woodKnock(1.34, 0.16, 0.055);
    woodKnock(1.06, 0.15, 0.11);
    noiseBurst(420, 1850, 1.6, 0.19, 0.12, 0.1, 'bandpass', false);
  },

  /** Tiếng xúc xắc nảy va đập xuống mặt bàn (khớp đúng 3 nhịp nảy 0, 1, 2) */
  playDiceBounce(bounceNum: number): void {
    const decay = Math.max(0.28, 1 - bounceNum * 0.28);
    woodKnock(0.96 + bounceNum * 0.1, 0.28 * decay, 0);
    woodKnock(1.22 + bounceNum * 0.09, 0.17 * decay, 0.028);
  },

  /** Hiệu ứng chuông lấp lánh khi đổ trúng 1 hoặc 6 (Xuất chuồng + Thêm lượt!) */
  playDiceLand(isBonus: boolean): void {
    if (!isBonus) return;
    [587.33, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
      sparkleBell(f, idx * 0.055, 0.13);
    });
  },

  /** Tiếng vó ngựa gõ lộc cộc vui tai mỗi bước nhảy trên đường đua */
  playHorseHop(stepIndex = 0): void {
    const stepScale = 0.94 + (stepIndex % 6) * 0.06;
    woodKnock(stepScale * 1.08, 0.21, 0);
    tone(380 * stepScale, 470 * stepScale, 0.055, 0.065, 'sine', 0.008, true);
  },

  /**
   * Tiếng NGỰA BAY TỪ CHUỒNG RA (làm mới hoàn toàn):
   * - Gió vút bứt tốc phóng ra khỏi chuồng + 3 nhịp vó phi nước đại + hồi kèn xuất trận rộn ràng!
   */
  playHorseDeploy(): void {
    // Vút gió phóng vồng lên không trung
    noiseBurst(340, 2300, 1.5, 0.24, 0.14, 0, 'bandpass', true);
    // 3 nhịp vó ngựa phi "lộp-cộp-CỘP!" khi đáp xuống ô xuất phát
    woodKnock(0.92, 0.18, 0.16);
    woodKnock(1.12, 0.21, 0.23);
    woodKnock(1.28, 0.26, 0.30);
    // Kèn hiệu khai trận tươi vui (C5 -> E5 -> G5 -> C6)
    marimbaPluck(523.25, 0.22, 0.14, 0.04);
    marimbaPluck(659.25, 0.24, 0.14, 0.11);
    marimbaPluck(783.99, 0.28, 0.15, 0.19);
    sparkleBell(1046.5, 0.27, 0.13);
  },

  /**
   * Tiếng ĐÁ NGỰA ĐỊCH BAY VỀ CHUỒNG (làm mới hoàn toàn):
   * - Cú va chạm "BỐP!" uy lực -> tiếng còi trượt hoạt hình bay vồng về chuồng -> tiếng đáp "BỊCH!" trong chuồng!
   */
  playHorseKick(): void {
    // 1. Cú đá "BỐP!" trầm mạnh + tiếng va giòn
    tone(185, 44, 0.17, 0.30, 'sine', 0, true);
    tone(260, 72, 0.14, 0.18, 'sawtooth', 0, true, 900);
    noiseBurst(2500, 580, 2.2, 0.13, 0.24, 0, 'bandpass', true);
    woodKnock(0.68, 0.28, 0.01);

    // 2. Tiếng vút bay vồng xoay tít trên không (slide-whistle hoạt hình vui nhộn)
    tone(1120, 290, 0.40, 0.14, 'sine', 0.09, true);
    tone(1680, 440, 0.36, 0.07, 'triangle', 0.10, true, 2200);
    noiseBurst(1600, 420, 1.8, 0.36, 0.10, 0.10, 'bandpass', true);

    // 3. Tiếng rơi "BỊCH!" trở về chuồng
    tone(145, 58, 0.12, 0.22, 'triangle', 0.46, true, 650);
    woodKnock(0.75, 0.20, 0.46);
  },

  /**
   * Tiếng LEO BỤT / ĐỔI BỤT (làm mới hoàn toàn):
   * - Chuỗi marimba + chuông ngân thăng hoa theo bậc 1..6; riêng bậc thắng 3–6 có hợp âm hào quang rực rỡ!
   */
  playClimbStairs(stepNum: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const idx = Math.max(0, Math.min(5, stepNum - 1));
    const root = scale[idx];

    // Gõ bậc gỗ thanh thoát + nốt marimba chính
    woodKnock(1.1 + idx * 0.08, 0.16, 0);
    marimbaPluck(root, 0.36, 0.17, 0.01);

    if (stepNum >= 3) {
      // Bậc chiến thắng 3..6 -> hợp âm rải vàng kim rạng rỡ!
      marimbaPluck(root * 1.25, 0.38, 0.14, 0.075);
      sparkleBell(root * 1.5, 0.14, 0.14);
      if (stepNum === 6) {
        // Đỉnh cao nhất Bụt số 6 -> thêm chuông ngân cao chót vót!
        sparkleBell(root * 2, 0.21, 0.15);
      }
    } else {
      sparkleBell(root * 1.25, 0.09, 0.09);
    }
  },

  /** Tiếng vào Ô An Toàn ★: chuông bảo hộ ấm vang */
  playSafeDoor(): void {
    woodKnock(1.18, 0.18, 0);
    sparkleBell(659.25, 0.03, 0.13);
    sparkleBell(987.77, 0.10, 0.14);
    sparkleBell(1318.5, 0.18, 0.11);
  },

  /** Tiếng hết nước đi chuyển lượt */
  playSkipTurn(): void {
    woodKnock(0.76, 0.15, 0);
    tone(310, 220, 0.14, 0.10, 'triangle', 0.04, true, 1200);
  },

  /** Khúc khải hoàn chiến thắng xếp kín 3–4–5–6 */
  playVictoryFanfare(): void {
    const notes: [number, number, number][] = [
      [523.25, 0.14, 0],
      [659.25, 0.14, 0.11],
      [783.99, 0.14, 0.22],
      [1046.5, 0.24, 0.34],
      [783.99, 0.14, 0.54],
      [1046.5, 0.22, 0.66],
      [1318.5, 0.52, 0.80],
    ];
    notes.forEach(([f, dur, del]) => {
      tone(f, f, dur, 0.15, 'triangle', del, true, 2800);
      marimbaPluck(f, dur + 0.14, 0.13, del);
    });
    sparkleBell(2093, 0.82, 0.14);
  },
};
