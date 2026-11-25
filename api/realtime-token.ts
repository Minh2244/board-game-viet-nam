import { handleRealtimeTokenGet } from './_realtimeAuth.js';

export const config = {
  runtime: 'edge',
  regions: ['sin1'],
};

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
    const result = await handleRealtimeTokenGet(url);
    return jsonResponse(result.body, result.status);
  } catch (err) {
    console.error('[api/realtime-token GET] unexpected error:', err);
    return jsonResponse({ ok: true, enabled: false, reason: 'SERVER_ERROR' }, 200);
  }
}
