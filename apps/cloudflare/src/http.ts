import { DomainError } from '@countryballs/shared-types';
import type { ApiErrorBody } from '@countryballs/cloud-contracts';

export function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(value), { ...init, headers });
}

export async function readJson(request: Request, maxBytes = 4_096): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) throw new DomainError('MESSAGE_TOO_LARGE', 'Solicitação grande demais.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new DomainError('MESSAGE_TOO_LARGE', 'Solicitação grande demais.');
  try { return JSON.parse(text); }
  catch { throw new DomainError('INVALID_REQUEST', 'JSON inválido.'); }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'UNAUTHORIZED' ? 401 :
      error.code === 'ROOM_FULL' || error.code === 'INVALID_STATE' ? 409 : error.code === 'RATE_LIMITED' ? 429 : 400;
    return json({ error: error.message, code: error.code } satisfies ApiErrorBody, { status });
  }
  console.error('Unhandled request error', error);
  return json({ error: 'Erro interno. Tente novamente.', code: 'INTERNAL_ERROR' } satisfies ApiErrorBody, { status: 500 });
}

export function routeSegments(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean).map(segment => decodeURIComponent(segment));
}
