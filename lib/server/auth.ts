import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * With Supabase configured, only signed-in, invited users may use the server's routes:
 * the caller's token is checked against the `allowed_emails` policy (a member sees their
 * own row). Without Supabase (local mode) everyone is let in.
 */
export async function isInvited(request: NextRequest): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return true;
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
