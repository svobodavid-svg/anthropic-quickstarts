import { NextRequest, NextResponse } from 'next/server';
import { isInvited } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Same-origin relay to the Promptchan API. Promptchan sends no CORS headers, so a browser
 * cannot call it directly; the studio calls /api/pc/... and this route forwards the request
 * with the user's own key (sent as `x-api-key`; it is never stored on the server).
 * Images, chat, catalog and account live on one host, every video endpoint on another.
 */
const MAIN_HOST = 'https://prod.aicloudnetservices.com';
const VIDEO_HOST = 'https://film.aicloudnetservices.com';

async function relay(request: NextRequest, { params }: { params: { path: string[] } }) {
  if (!(await isInvited(request))) {
    return NextResponse.json({ error: 'Nepřihlášen nebo bez pozvánky.', code: 'unauthorized', retryable: false }, { status: 401 });
  }
  const path = '/' + params.path.map(encodeURIComponent).join('/');
  // Only the documented external API, nothing else on those hosts.
  if (!path.startsWith('/api/external/')) {
    return NextResponse.json({ error: 'Neznámá cesta.', code: 'not_found', retryable: false }, { status: 404 });
  }
  const host = path.includes('/video_v4/') ? VIDEO_HOST : MAIN_HOST;
  const key = request.headers.get('x-api-key');
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  try {
    const upstream = await fetch(`${host}${path}${request.nextUrl.search}`, {
      method: request.method,
      headers: {
        ...(key ? { 'x-api-key': key } : {}),
        ...(hasBody ? { 'Content-Type': request.headers.get('content-type') ?? 'application/json' } : {}),
      },
      body: hasBody ? await request.text() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(300_000),
    });
    const headers = new Headers({ 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
    for (const name of ['retry-after', 'x-request-id']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ error: 'Promptchan neodpovídá.', code: 'upstream_unreachable', retryable: true }, { status: 502 });
  }
}

export { relay as GET, relay as POST };
