import { afterEach, describe, expect, it, vi } from 'vitest';
import { soundEngine, useAudioStore } from '@/shared/audio/soundEngine';
import { cryptoRandomInt, cryptoShuffle } from '@/shared/crypto/random';
import { readJson, removeKey, writeJson } from '@/shared/storage/local';
import { HUB_BG_WARM_WOOD_URL, HUB_THEMES } from '@/hub/themes';

describe('Tiện ích dùng chung (Crypto RNG, LocalStorage, Audio, Themes)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cryptoRandomInt trả về số nguyên hợp lệ trong [min, max] kể cả trường hợp biên', () => {
    expect(cryptoRandomInt(4, 4)).toBe(4);
    expect(cryptoRandomInt(5, 2)).toBe(5);

    const seen = new Set<number>();
    for (let i = 0; i < 180; i += 1) {
      const n = cryptoRandomInt(1, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });

  it('cryptoShuffle xáo trộn Fisher-Yates không làm biến đổi mảng gốc', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const snapshot = [...source];
    const shuffled = cryptoShuffle(source);

    expect(source).toEqual(snapshot);
    expect(shuffled).toHaveLength(source.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source);
  });

  it('readJson / writeJson / removeKey hoạt động an toàn kể cả khi localStorage lỗi hoặc hỏng JSON', () => {
    // Môi trường Node không có window
    expect(readJson('missing', { ok: true })).toEqual({ ok: true });
    expect(() => writeJson('k', { a: 1 })).not.toThrow();
    expect(() => removeKey('k')).not.toThrow();

    // Giả lập trình duyệt với localStorage đầy đủ và dữ liệu lỗi
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });

    writeJson('save_slot', { turn: 3, money: 15_000_000 });
    expect(readJson('save_slot', { turn: 0, money: 0 })).toEqual({ turn: 3, money: 15_000_000 });

    store.set('corrupted_json', '{not-valid-json');
    expect(readJson('corrupted_json', 'fallback')).toBe('fallback');

    removeKey('save_slot');
    expect(readJson('save_slot', null)).toBeNull();
  });

  it('useAudioStore bật/tắt tiếng đồng bộ và soundEngine an toàn khi không có AudioContext', () => {
    useAudioStore.getState().setMuted(false);
    expect(useAudioStore.getState().muted).toBe(false);

    useAudioStore.getState().toggleMute();
    expect(useAudioStore.getState().muted).toBe(true);

    expect(() => {
      soundEngine.setHubActive(true);
      soundEngine.startHubBgm();
      soundEngine.playPushClick();
      soundEngine.playCarouselStep();
      soundEngine.playComingSoon();
      soundEngine.playEnterGame();
      soundEngine.setHubActive(false);
    }).not.toThrow();

    expect(useAudioStore.getState().bgmPlaying).toBe(false);
    useAudioStore.getState().setMuted(false);
  });

  it('HUB_THEMES có đủ 4 giao diện với Gỗ Nắng Ấm là mặc định v1.0', () => {
    expect(Object.keys(HUB_THEMES)).toEqual(['wood', 'mint', 'sunset', 'neon']);
    expect(HUB_THEMES.wood.isPrimaryWood).toBe(true);
    expect(HUB_THEMES.wood.comingSoonInV1).toBeUndefined();
    expect(HUB_BG_WARM_WOOD_URL.length).toBeGreaterThan(0);
  });
});
