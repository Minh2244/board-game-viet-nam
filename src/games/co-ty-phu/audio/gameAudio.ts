import { useAudioStore } from '@/shared/audio/soundEngine';
import type { CharacterId } from '../engine/types';

let gCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined' || useAudioStore.getState().muted) return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!gCtx) {
    gCtx = new Ctor();
    const comp = gCtx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;

    masterBus = gCtx.createGain();
    masterBus.gain.value = 0.94;
    masterBus.connect(comp);
    comp.connect(gCtx.destination);

    // Độ vang phòng gỗ ấm (0.38s stereo impulse response) cho cảm giác bàn cờ thật
    const irLen = Math.floor(gCtx.sampleRate * 0.38);
    const ir = gCtx.createBuffer(2, irLen, gCtx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i += 1) {
        const decay = Math.pow(1 - i / irLen, 2.8);
        data[i] = (Math.random() * 2 - 1) * decay * 0.28;
      }
    }
    reverbNode = gCtx.createConvolver();
    reverbNode.buffer = ir;
    const revGain = gCtx.createGain();
    revGain.gain.value = 0.24;
    reverbNode.connect(revGain);
    revGain.connect(masterBus);

    const nLen = Math.floor(gCtx.sampleRate * 1.2);
    noiseBuffer = gCtx.createBuffer(1, nLen, gCtx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nLen; i += 1) {
      nd[i] = Math.random() * 2 - 1;
    }
  }

  if (gCtx.state === 'suspended') {
    void gCtx.resume();
  }
  return gCtx;
}

function sendOut(node: AudioNode, wet = true): void {
  if (!masterBus) return;
  node.connect(masterBus);
  if (wet && reverbNode) {
    node.connect(reverbNode);
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
) {
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
) {
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

/** Tiếng gõ gỗ đặc trưng kiểu bàn cờ gỗ cổ điển */
function woodKnock(pitch = 1, vol = 0.24, delay = 0): void {
  tone(310 * pitch, 115 * pitch, 0.055, vol, 'triangle', delay, true, 1650);
  noiseBurst(1550 * pitch, 680 * pitch, 3.8, 0.032, vol * 0.72, delay, 'bandpass', true);
}

/** Tiếng gảy dây đàn ngũ cung ấm */
function pluckString(freq: number, dur = 0.34, vol = 0.16, delay = 0): void {
  tone(freq, freq * 0.996, dur, vol, 'triangle', delay, true, 2400);
  tone(freq * 2, freq * 1.995, dur * 0.55, vol * 0.4, 'sine', delay, true);
  noiseBurst(freq * 3.5, freq * 1.8, 4.0, 0.02, vol * 0.3, delay, 'bandpass', false);
}

/** Tiếng chuông kim loại / đồng xu ngân trong */
function coinPing(freq: number, delay = 0, vol = 0.14): void {
  tone(freq, freq * 1.003, 0.28, vol, 'sine', delay, true);
  tone(freq * 2.52, freq * 2.52, 0.16, vol * 0.45, 'sine', delay, true);
}

const CHAR_HOP_PITCH: Record<CharacterId, number> = {
  ca_phe: 1.05,
  khan_ran: 0.92,
  phuot_thu: 1.12,
  tri_thuc: 1.22,
  ao_dai_tim: 1.18,
  non_la: 1.14,
  doanh_nhan: 1.28,
  vung_cao: 1.08,
};

export const gameAudio = {
  /** Tiếng lắc cốc gỗ tăng dần khi nhấn giữ nạp lực tung xúc xắc */
  playDiceChargeTick(charge01: number): void {
    const pitch = 0.95 + charge01 * 0.42 + (Math.random() - 0.5) * 0.08;
    const vol = 0.11 + charge01 * 0.11;
    woodKnock(pitch, vol, 0);
  },

  /** Tiếng thả cốc & vút gió tung xúc xắc */
  playDiceShake(power01 = 0.6): void {
    const p = Math.min(1, Math.max(0.3, power01));
    woodKnock(1.12, 0.14, 0);
    woodKnock(1.32, 0.15, 0.055);
    woodKnock(1.06, 0.14, 0.11);
    noiseBurst(420, 1450 + p * 600, 1.5, 0.16, 0.09 + p * 0.05, 0.12, 'bandpass', false);
  },

  /** Tiếng 2 viên xúc xắc nảy va chạm xuống mặt bàn gỗ */
  playDiceBounce(bounceNum: number, power01 = 0.6): void {
    const decay = Math.max(0.24, 1 - bounceNum * 0.27);
    const boost = 0.8 + power01 * 0.35;
    woodKnock(0.95 + bounceNum * 0.09, 0.26 * decay * boost, 0);
    woodKnock(1.14 + bounceNum * 0.08, 0.22 * decay * boost, 0.036);
  },

  /** Hiệu ứng chuông pha lê bùng sáng khi Đổ Đôi */
  playDoubleSparkle(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, idx) => coinPing(f, idx * 0.062, 0.14));
  },

  /** Âm thanh đặc trưng riêng cho từng nhân vật trong 8 nhân vật Việt Nam */
  playCharacterSignature(charId: CharacterId): void {
    switch (charId) {
      case 'ca_phe':
        // Minh Phin: tiếng khuấy đá ly cà phê + gảy nhẹ
        coinPing(2480, 0, 0.11);
        coinPing(3120, 0.07, 0.09);
        pluckString(440, 0.2, 0.12, 0.13);
        pluckString(554.37, 0.24, 0.12, 0.2);
        break;
      case 'khan_ran':
        // Tư Miền Tây: đàn kìm ngũ cung hào sảng
        pluckString(293.66, 0.2, 0.15, 0);
        pluckString(392.0, 0.2, 0.15, 0.075);
        pluckString(440.0, 0.22, 0.16, 0.15);
        pluckString(587.33, 0.3, 0.16, 0.225);
        break;
      case 'phuot_thu':
        // Khôi Phượt: tiếng ga nhẹ + còi "bíp bíp" thân thiện
        tone(110, 210, 0.13, 0.12, 'sawtooth', 0, false, 480);
        tone(680, 700, 0.075, 0.12, 'triangle', 0.12, true);
        tone(680, 720, 0.095, 0.13, 'triangle', 0.22, true);
        break;
      case 'tri_thuc':
        // Khoa Kính Cận: tiếng gõ bàn tính + chuông sáng ý
        woodKnock(1.6, 0.13, 0);
        woodKnock(1.85, 0.13, 0.06);
        coinPing(1174.7, 0.13, 0.11);
        coinPing(1760.0, 0.2, 0.1);
        break;
      case 'ao_dai_tim':
        // Ngọc Áo Tím: tiếng đàn tranh Cố Đô Huế dịu dàng
        [587.33, 659.25, 880, 987.77, 1174.66].forEach((f, i) =>
          pluckString(f, 0.34, 0.11, i * 0.045),
        );
        break;
      case 'non_la':
        // Út Nón Lá: tiếng sáo trúc êm ái
        tone(587.33, 783.99, 0.17, 0.13, 'sine', 0, true);
        tone(783.99, 880, 0.15, 0.12, 'sine', 0.14, true);
        noiseBurst(2400, 3000, 4, 0.16, 0.025, 0.02, 'bandpass', true);
        break;
      case 'doanh_nhan':
        // Chị Đại Vy: tiếng guốc tự tin + chuông chốt deal sang chảnh
        woodKnock(1.75, 0.15, 0);
        woodKnock(1.9, 0.14, 0.1);
        coinPing(1046.5, 0.2, 0.13);
        coinPing(1567.98, 0.27, 0.14);
        break;
      case 'vung_cao':
        // Mây Thổ Cẩm: tiếng chuông bạc vùng cao + hợp âm khèn ấm
        coinPing(2637, 0, 0.085);
        coinPing(3136, 0.055, 0.075);
        tone(349.23, 349.23, 0.26, 0.11, 'triangle', 0.09, true, 1200);
        tone(523.25, 523.25, 0.26, 0.11, 'triangle', 0.09, true, 1400);
        break;
    }
  },

  /** Tiếng đế cờ gỗ gõ lộp cộp mỗi bước nhảy của nhân vật */
  playPawnHop(stepIndex: number, backwards = false, charId?: CharacterId): void {
    const charPitch = charId ? CHAR_HOP_PITCH[charId] : 1;
    if (backwards) {
      woodKnock(0.84 * charPitch, 0.18, 0);
      tone(340, 210, 0.07, 0.07, 'sine', 0, true);
      return;
    }
    const stepScale = 0.96 + (stepIndex % 6) * 0.055;
    woodKnock(stepScale * charPitch, 0.2, 0);
    tone(360 * stepScale * charPitch, 440 * stepScale * charPitch, 0.055, 0.06, 'sine', 0.01, true);
  },

  /** Tiếng nhận tiền: đếm tiền giấy xoẹt + đồng xu leng keng */
  playReceiveMoney(): void {
    noiseBurst(2600, 1600, 1.6, 0.09, 0.13, 0, 'bandpass', false);
    noiseBurst(3100, 1800, 1.8, 0.08, 0.1, 0.06, 'bandpass', false);
    coinPing(1318.5, 0.1, 0.13);
    coinPing(1568.0, 0.17, 0.14);
    coinPing(2093.0, 0.24, 0.13);
  },

  /** Tiếng trừ tiền: đóng hộc gỗ + nốt trầm nhẹ */
  playPayMoney(): void {
    woodKnock(0.7, 0.18, 0);
    noiseBurst(1900, 900, 1.5, 0.07, 0.09, 0.02, 'bandpass', false);
    tone(392, 330, 0.14, 0.14, 'triangle', 0.07, true, 1200);
    tone(311.1, 246.9, 0.22, 0.14, 'triangle', 0.18, true, 1000);
  },

  /** Tiếng mua đất (level 0), búa gỗ xây nhà (1–4) & khánh thành Biệt Thự (level 5) */
  playBuildOrBuy(level: number): void {
    if (level <= 0) {
      // Đóng dấu chủ quyền + hợp âm ấm
      tone(155, 68, 0.09, 0.24, 'sine', 0, true);
      woodKnock(0.88, 0.22, 0.05);
      pluckString(523.25, 0.24, 0.13, 0.11);
      pluckString(659.25, 0.28, 0.14, 0.18);
      return;
    }
    // Búa gỗ xây dựng
    woodKnock(0.92, 0.24, 0);
    woodKnock(1.12, 0.24, 0.11);
    if (level >= 5) {
      // Biệt thự: hợp âm vàng kim rạng rỡ
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        pluckString(f, 0.42, 0.14, 0.16 + i * 0.055);
      });
      coinPing(2093, 0.42, 0.12);
      return;
    }
    const base = 392 + level * 48;
    pluckString(base, 0.25, 0.13, 0.16);
    pluckString(base * 1.25, 0.3, 0.14, 0.23);
  },

  /** Tiếng bán nhà / thanh lý đất thu hồi tiền */
  playSellAsset(): void {
    woodKnock(1.16, 0.18, 0);
    woodKnock(0.86, 0.18, 0.09);
    tone(440, 349.2, 0.14, 0.12, 'triangle', 0.15, true, 1400);
    coinPing(1046.5, 0.22, 0.12);
    coinPing(880, 0.3, 0.1);
  },

  /** Tiếng búa gỗ đấu giá Bến Xe */
  playAuction(kind: 'BID' | 'WON' | 'PASS'): void {
    if (kind === 'PASS') {
      woodKnock(0.75, 0.14, 0);
      tone(320, 220, 0.14, 0.1, 'triangle', 0.04, true, 1200);
      return;
    }
    woodKnock(0.82, 0.26, 0);
    woodKnock(0.94, 0.24, 0.1);
    if (kind === 'WON') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluckString(f, 0.34, 0.14, 0.18 + i * 0.06));
    }
  },

  /** Tiếng còi cảnh sát & sập song sắt khi bị Bắt Vào Tù */
  playJailLock(): void {
    tone(660, 920, 0.17, 0.12, 'sawtooth', 0, true, 1800);
    tone(920, 620, 0.17, 0.12, 'sawtooth', 0.17, true, 1800);
    // Tiếng sập cửa sắt *KENG*
    tone(155, 72, 0.26, 0.24, 'square', 0.36, true, 760);
    noiseBurst(2200, 680, 4.5, 0.2, 0.22, 0.36, 'bandpass', true);
  },

  /** Tiếng mở khóa & thoát tù thành công */
  playJailFree(): void {
    woodKnock(1.5, 0.15, 0);
    pluckString(440, 0.22, 0.13, 0.06);
    pluckString(554.37, 0.24, 0.14, 0.13);
    coinPing(880, 0.21, 0.14);
  },

  /** Tiếng máy bay phản lực cất cánh êm ở Sân Bay */
  playAirplaneTakeoff(): void {
    noiseBurst(260, 2100, 2.2, 0.62, 0.15, 0, 'bandpass', true);
    noiseBurst(1900, 380, 2.0, 0.5, 0.12, 0.58, 'lowpass', true);
    tone(220, 460, 0.48, 0.08, 'sine', 0.08, true);
  },

  /** Tiếng rút & lật thẻ bài giấy Cơ Hội / Khí Vận */
  playCardDraw(deck: 'CHANCE' | 'FATE'): void {
    noiseBurst(3100, 1100, 1.4, 0.11, 0.16, 0, 'bandpass', false);
    if (deck === 'CHANCE') {
      noiseBurst(2400, 3800, 2.0, 0.08, 0.1, 0.09, 'bandpass', true);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        pluckString(f, 0.36, 0.13, 0.12 + i * 0.055),
      );
    } else {
      tone(110, 72, 0.26, 0.22, 'sine', 0.08, true);
      tone(440, 415.3, 0.24, 0.13, 'triangle', 0.12, true, 1500);
      tone(349.2, 311.1, 0.32, 0.14, 'triangle', 0.25, true, 1200);
      tone(293.66, 261.63, 0.38, 0.13, 'sine', 0.38, true);
    }
  },

  /** Tiếng phá sản kịch tính (kèn trượt trầm + búa + xu vỡ) */
  playBankrupt(): void {
    const brass: [number, number, number, number][] = [
      [311.1, 293.7, 0.22, 0],
      [277.2, 261.6, 0.24, 0.22],
      [246.9, 233.1, 0.26, 0.46],
      [220, 155.6, 0.58, 0.72],
    ];
    brass.forEach(([f1, f2, d, del]) => {
      tone(f1, f2, d, 0.16, 'sawtooth', del, true, 680);
      tone(f1 * 0.5, f2 * 0.5, d, 0.13, 'triangle', del, true, 420);
    });
    woodKnock(0.6, 0.26, 0.92);
    coinPing(1400, 1.0, 0.08);
    coinPing(1180, 1.07, 0.06);
  },

  /** Hồi chuông cảnh báo ngắn kịch tính khi có người chỉ còn thiếu 1 ô là thắng ngay */
  playMatchPointWarning(): void {
    tone(783.99, 880, 0.14, 0.14, 'triangle', 0, true, 2400);
    tone(1046.5, 1174.66, 0.18, 0.13, 'sine', 0.16, true);
    coinPing(1568, 0.18, 0.09);
  },

  /** Kèn & đàn chúc mừng Nhà Vô Địch */
  playVictoryFanfare(): void {
    const notes: [number, number, number][] = [
      [523.25, 0.13, 0],
      [523.25, 0.13, 0.13],
      [523.25, 0.13, 0.26],
      [659.25, 0.2, 0.39],
      [587.33, 0.15, 0.56],
      [783.99, 0.22, 0.71],
      [1046.5, 0.55, 0.88],
    ];
    notes.forEach(([f, dur, del]) => {
      tone(f, f, dur, 0.15, 'triangle', del, true, 2600);
      pluckString(f, dur + 0.15, 0.12, del);
    });
    coinPing(2093, 0.9, 0.13);
  },
};
