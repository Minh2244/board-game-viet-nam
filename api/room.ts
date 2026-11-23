import { handleRoomGet, handleRoomPost } from '../server/roomStore';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const result = await handleRoomGet(url);
    return jsonResponse(result.body, result.status);
  } catch (err) {
    console.error('[api/room GET] unexpected error:', err);
    return jsonResponse(
      { ok: false, error: 'SERVER_ERROR', message: 'Lỗi máy chủ kết nối phòng, vui lòng thử lại.' },
      500,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return jsonResponse(
      { ok: false, error: 'BAD_JSON', message: 'Dữ liệu yêu cầu không đúng định dạng JSON.' },
      400,
    );
  }

  try {
    const result = await handleRoomPost(body);
    return jsonResponse(result.body, result.status);
  } catch (err) {
    console.error('[api/room POST] unexpected error:', err);
    return jsonResponse(
      { ok: false, error: 'SERVER_ERROR', message: 'Lỗi xử lý yêu cầu phòng, vui lòng thử lại.' },
      500,
    );
  }
}
