import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * With Supabase configured, only signed-in, invited users may spend the xAI key: the
 * caller's token is checked against the `allowed_emails` policy (a member sees their own row).
 */
async function isInvited(request: NextRequest): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return true; // local mode
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/allowed_emails?select=email&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: auth },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({ configured: !!process.env.XAI_API_KEY });
}

export async function POST(request: NextRequest) {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'XAI_API_KEY není nastaven na serveru.' }, { status: 503 });
  }
  if (!(await isInvited(request))) {
    return NextResponse.json({ error: 'Nepřihlášen nebo bez pozvánky.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 80) {
    return NextResponse.json({ error: 'Neplatná zpráva.' }, { status: 400 });
  }

  // Only these fields are forwarded; the model is chosen by the server.
  const payload = {
    model: process.env.XAI_MODEL || 'grok-4',
    messages: body.messages,
    ...(Array.isArray(body.tools) && body.tools.length <= 16 ? { tools: body.tools, tool_choice: 'auto' } : {}),
    temperature: 0.4,
    max_tokens: 2000,
  };

  try {
    const upstream = await fetch(XAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? data?.error ?? `xAI HTTP ${upstream.status}` },
        { status: upstream.status === 429 ? 429 : 502 }
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'xAI neodpovídá.' }, { status: 504 });
  }
}
