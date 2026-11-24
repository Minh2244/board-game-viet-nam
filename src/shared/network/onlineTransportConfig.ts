/**
 * Cấu hình dùng chung cho kết nối Online 5 trò chơi:
 * - Giữ thanh địa chỉ trình duyệt sạch (chỉ tạo link mời Online qua nút sao chép riêng).
 * - Hỗ trợ cờ kiểm thử `transport=http` hoặc `window.__BGVN_FORCE_HTTP_ONLY__` để ép chạy 100% HTTP Long-Polling
 *   (tắt BroadcastChannel & WebRTC P2P nhằm mô phỏng chính xác điều kiện mạng 4G khác thiết bị).
 */

declare global {
  interface Window {
    __BGVN_FORCE_HTTP_ONLY__?: boolean;
  }
}

export function isFastLaneDisabled(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.__BGVN_FORCE_HTTP_ONLY__) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('transport') === 'http') return true;
    if (window.sessionStorage.getItem('bgvn_force_http_only') === '1') return true;
  } catch {
    // Ignore
  }
  return false;
}

export function buildInviteUrl(gameId: string, roomCode: string): string {
  if (typeof window === 'undefined') {
    return `/?game=${encodeURIComponent(gameId)}&room=${encodeURIComponent(roomCode)}`;
  }
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('game', gameId);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

export function cleanGameUrlParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('game') && !url.searchParams.has('room')) return;
    url.searchParams.delete('game');
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch {
    // Ignore
  }
}
