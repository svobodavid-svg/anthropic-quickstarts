import { NextRequest, NextResponse } from 'next/server';
import { isInvited } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const XAI_URL = 'https://api.x.ai/v1/chat/completions';
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
