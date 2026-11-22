/**
 * Sinh số nguyên ngẫu nhiên trong khoảng [min, max] bằng Web Crypto API.
 */
export function cryptoRandomInt(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  const range = high - low + 1;
  const maxUnbiased = Math.floor(0xffffffff / range) * range;
  const buf = new Uint32Array(1);
  let val = 0;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= maxUnbiased);
  return low + (val % range);
}

/**
 * Xáo trộn mảng theo thuật toán Fisher-Yates kết hợp Web Crypto.
 */
export function cryptoShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = cryptoRandomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
