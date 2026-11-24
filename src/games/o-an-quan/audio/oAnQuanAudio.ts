/**
 * Hệ thống âm thanh vật lý dân gian Web Audio API thuần code cho Ô Ăn Quan (luôn mặc định bật SFX):
 * - Lụm đá (playHandScoop): tiếng bàn tay vốc sỏi cọ lòng hố gỗ + chuỗi hạt sỏi va vào nhau rột roạt.
 * - Rải đá (playStoneDrop): tiếng từng viên sỏi cuội thả rơi gõ cộc vào mặt gỗ + lách cách tăng nhẹ cao độ.
 * - Đập tay xuống ô trống khi ăn (playHandSlap): tiếng vỗ lòng bàn tay "BỐP!" giòn tai xuống mặt chiếu/gỗ.
 * - Quét sỏi & Ăn Quan (playCaptureSweep / playMandarinCapture): tiếng hốt sỏi đổ vào giỏ tre + cồng đồng đàn tranh.
 */
class OAnQuanAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /** Tiếng chạm chọn ô gỗ mềm mại */
  public playSelectPit(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.05);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  /**
   * Tiếng LỤM ĐÁ / VỐC SỎI LÊN TAY:
   * - Lớp 1: Tiếng cọ ma sát mềm khi ngón tay quét qua lòng hố gỗ (bandpass noise 1400Hz).
   * - Lớp 2: 3–4 tiếng sỏi cuội va lách cách cực nhanh khi chụm lại trong lòng bàn tay.
   */
  public playStonePickup(isChain = false, stoneCount = 5): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Tiếng quét tay cọ lòng hố gỗ
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isChain ? 1650 : 1280, now);
    filter.Q.setValueAtTime(1.8, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.14, now + 0.025);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.14);

    // 2. Chuỗi tiếng đá cuội va lách cách khi vốc vào tay
    const clinks = Math.min(4, Math.max(2, stoneCount));
    const baseFreq = isChain ? 1650 : 1380;
    for (let i = 0; i < clinks; i += 1) {
      const t = now + i * 0.028;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      const f = baseFreq + i * 240 + (i % 2) * 180;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.028);

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.095, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.036);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.042);
    }
  }

  /**
   * Tiếng RẢI TỪNG VIÊN ĐÁ xuống hố gỗ:
   * - Lớp 1: Tiếng cộc gỗ trầm ấm (wood knock).
   * - Lớp 2: Tiếng sỏi chạm sỏi sáng trong (pebble clack), tăng nhẹ cao độ theo chuỗi.
   */
  public playStoneDrop(stepIndex = 0, isMandarinPit = false): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Tiếng gõ gỗ "cộc" ngắn gọn
    const wood = ctx.createOscillator();
    const woodGain = ctx.createGain();
    wood.type = 'sine';
    const woodStart = isMandarinPit ? 240 : 320 + (stepIndex % 6) * 24;
    wood.frequency.setValueAtTime(woodStart, now);
    wood.frequency.exponentialRampToValueAtTime(woodStart * 0.42, now + 0.045);

    woodGain.gain.setValueAtTime(0.001, now);
    woodGain.gain.linearRampToValueAtTime(isMandarinPit ? 0.17 : 0.13, now + 0.004);
    woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    wood.connect(woodGain);
    woodGain.connect(ctx.destination);
    wood.start(now);
    wood.stop(now + 0.06);

    // 2. Tiếng sỏi chạm sỏi "tách" sắc nét (high click + ngắn ngũ cung)
    const pentatonic = [1046.5, 1174.6, 1318.5, 1568.0, 1760.0, 2093.0];
    const clackFreq = isMandarinPit
      ? 920
      : pentatonic[stepIndex % pentatonic.length] * (stepIndex >= 12 ? 1.08 : 1);

    const clack = ctx.createOscillator();
    const clackGain = ctx.createGain();
    clack.type = 'triangle';
    clack.frequency.setValueAtTime(clackFreq, now);
    clack.frequency.exponentialRampToValueAtTime(clackFreq * 0.68, now + 0.025);

    clackGain.gain.setValueAtTime(0.001, now);
    clackGain.gain.linearRampToValueAtTime(0.075, now + 0.003);
    clackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    clack.connect(clackGain);
    clackGain.connect(ctx.destination);
    clack.start(now);
    clack.stop(now + 0.036);
  }

  /**
   * Tiếng ĐẬP BÀN TAY XUỐNG ĐẤT / Ô TRỐNG ("BỐP!") KHI ĂN QUÂN:
   * - Lớp 1: Tiếng đập trầm chắc nịch lên mặt gỗ/chiếu (165Hz -> 44Hz).
   * - Lớp 2: Tiếng vỗ lòng bàn tay giòn tan (bandpass noise 950Hz + high slap crack 2200Hz).
   * - Khi ăn Combo liên hoàn (comboIndex >= 2), cú đập giòn và uy lực hơn!
   */
  public playHandSlap(comboIndex = 1): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const punchBoost = 1 + Math.min(comboIndex - 1, 3) * 0.14;

    // 1. Cú dậm trầm xuống nền gỗ/đất ("BỤP!")
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(170 * punchBoost, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.11);

    thumpGain.gain.setValueAtTime(0.001, now);
    thumpGain.gain.linearRampToValueAtTime(0.32, now + 0.006);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.15);

    // 2. Tiếng vỗ lòng bàn tay sắc giòn ("CHÁT / BỐP!")
    const slapNoise = ctx.createBufferSource();
    slapNoise.buffer = this.getNoiseBuffer(ctx);
    const slapBand = ctx.createBiquadFilter();
    slapBand.type = 'bandpass';
    slapBand.frequency.setValueAtTime(1050 * punchBoost, now);
    slapBand.Q.setValueAtTime(0.95, now);

    const slapGain = ctx.createGain();
    slapGain.gain.setValueAtTime(0.001, now);
    slapGain.gain.linearRampToValueAtTime(0.34, now + 0.004);
    slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    slapNoise.connect(slapBand);
    slapBand.connect(slapGain);
    slapGain.connect(ctx.destination);
    slapNoise.start(now);
    slapNoise.stop(now + 0.085);

    // 3. Độ vang giòn nhẹ của chiếu cói/vỏ gỗ
    const crisp = ctx.createBufferSource();
    crisp.buffer = this.getNoiseBuffer(ctx);
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(2400, now);

    const crispGain = ctx.createGain();
    crispGain.gain.setValueAtTime(0.001, now);
    crispGain.gain.linearRampToValueAtTime(0.14, now + 0.003);
    crispGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    crisp.connect(highPass);
    highPass.connect(crispGain);
    crispGain.connect(ctx.destination);
    crisp.start(now);
    crisp.stop(now + 0.048);
  }

  /** Tiếng hốt trọn sỏi quét đổ rào rào vào giỏ tre kèm hợp âm ngũ cung vui tai */
  public playCapture(comboIndex = 1, stonesTaken = 4): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Tiếng sỏi đổ rào rào vào giỏ tre
    const rattleCount = Math.min(6, Math.max(2, stonesTaken));
    for (let i = 0; i < rattleCount; i += 1) {
      const t = now + i * 0.032;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      const f = 1280 + i * 190 + (i % 2) * 140;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.65, t + 0.03);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.045);
    }

    // 2. Hợp âm chuông ngũ cung mừng ăn quân
    const boost = Math.min(comboIndex - 1, 4) * 85;
    const notes = [587.33 + boost, 783.99 + boost, 1046.5 + boost];
    notes.forEach((freq, i) => {
      const t = now + 0.05 + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  /** Tiếng cồng đồng & đàn tranh ngân vang khi ăn được Viên Quan Lớn (+10 điểm) */
  public playMandarinCapture(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const gong = ctx.createOscillator();
    const gongGain = ctx.createGain();
    gong.type = 'sine';
    gong.frequency.setValueAtTime(220, now);
    gong.frequency.exponentialRampToValueAtTime(196, now + 0.72);
    gongGain.gain.setValueAtTime(0.001, now);
    gongGain.gain.linearRampToValueAtTime(0.24, now + 0.015);
    gongGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    gong.connect(gongGain);
    gongGain.connect(ctx.destination);
    gong.start(now);
    gong.stop(now + 0.82);

    const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    arpeggio.forEach((f, idx) => {
      const t = now + 0.04 + idx * 0.055;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  /** Tiếng dừng lượt nhẹ nhàng */
  public playStopTurn(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Tiếng rải lại 5 viên dân đầu lượt */
  public playRefillStones(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 587.33, 659.25, 783.99, 880].forEach((f, idx) => {
      const t = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  /** Nhạc hiệu trống hội & ngũ cung mừng chiến thắng cuối ván */
  public playVictoryFanfare(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0, d: 0.14 },
      { f: 659.25, t: 0.14, d: 0.14 },
      { f: 783.99, t: 0.28, d: 0.14 },
      { f: 1046.5, t: 0.44, d: 0.45 },
      { f: 880.0, t: 0.68, d: 0.14 },
      { f: 1046.5, t: 0.84, d: 0.55 },
    ];
    for (const note of melody) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + note.t);
      g.gain.setValueAtTime(0.001, now + note.t);
      g.gain.linearRampToValueAtTime(0.17, now + note.t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + note.t);
      osc.stop(now + note.t + note.d + 0.04);
    }
  }
}

export const oAnQuanAudio = new OAnQuanAudioEngine();
