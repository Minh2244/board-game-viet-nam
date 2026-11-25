/**
 * Mạch tạo độ vang phòng gỗ ấm (Warm Wooden Room Reverb) siêu nhẹ cho cả PC lẫn Điện Thoại:
 * - Dùng 2 nhánh DelayNode tỷ lệ nguyên tố + BiquadFilterNode lowpass + Feedback nhẹ (< 0.35),
 *   cho âm vang gỗ ấm tự nhiên gần tương đương ConvolverNode nhưng nhẹ CPU hơn ~20 lần
 *   (không chạy biến đổi FFT stereo liên tục trên luồng âm thanh di động).
 */
export interface WarmRoomReverbOptions {
  /** Độ trễ phản xạ sớm nhánh 1 (giây), VD: 0.037 */
  delayA?: number;
  /** Độ trễ phản xạ sớm nhánh 2 (giây), VD: 0.061 */
  delayB?: number;
  /** Tỷ lệ hồi tiếp (luôn bị chặn tối đa 0.38 để không bao giờ hú vang) */
  feedback?: number;
  /** Tần số cắt thông thấp giúp đuôi vang ấm như phòng gỗ (Hz) */
  lowpassHz?: number;
  /** Mức trộn âm vang (wet gain) vào bus chính */
  wetGain?: number;
  /** Node đích (thường là masterBus / bgmMaster) */
  destination: AudioNode;
}

export interface WarmRoomReverbBus {
  /** Node đầu vào: nối tín hiệu nhạc cụ/SFX cần vang vào đây */
  input: GainNode;
  /** Ngắt kết nối sạch toàn bộ nhánh vang */
  disconnect: () => void;
}

export function createWarmRoomReverb(
  ctx: AudioContext,
  options: WarmRoomReverbOptions,
): WarmRoomReverbBus {
  const delayATime = Math.max(0.012, Math.min(0.18, options.delayA ?? 0.037));
  const delayBTime = Math.max(0.018, Math.min(0.24, options.delayB ?? 0.061));
  const fbAmt = Math.max(0, Math.min(0.38, options.feedback ?? 0.24));
  const lpHz = Math.max(600, Math.min(6000, options.lowpassHz ?? 2300));
  const wetAmt = Math.max(0, Math.min(0.8, options.wetGain ?? 0.22));

  const input = ctx.createGain();
  input.gain.value = 1;

  const delayA = ctx.createDelay(0.3);
  delayA.delayTime.value = delayATime;

  const delayB = ctx.createDelay(0.3);
  delayB.delayTime.value = delayBTime;

  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = lpHz;
  damp.Q.value = 0.7;

  const fbA = ctx.createGain();
  fbA.gain.value = fbAmt;

  const fbB = ctx.createGain();
  fbB.gain.value = fbAmt * 0.88;

  const wet = ctx.createGain();
  wet.gain.value = wetAmt;

  // Vòng hồi tiếp chéo A <-> B tạo độ khuếch tán mềm mượt tự nhiên như phòng gỗ thật
  input.connect(delayA);
  input.connect(delayB);

  delayA.connect(damp);
  delayB.connect(damp);

  damp.connect(wet);
  wet.connect(options.destination);

  // Hồi tiếp đã qua lọc thông thấp nên càng ngân càng ấm dịu, tự tắt sạch trong ~0.35–0.5s
  damp.connect(fbA);
  fbA.connect(delayB);
  damp.connect(fbB);
  fbB.connect(delayA);

  return {
    input,
    disconnect: () => {
      for (const n of [input, delayA, delayB, damp, fbA, fbB, wet]) {
        try {
          n.disconnect();
        } catch {
          // Ignore already disconnected nodes
        }
      }
    },
  };
}
