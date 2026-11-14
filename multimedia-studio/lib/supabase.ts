import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Null when the environment variables are not set: the studio then runs in local mode,
 * without accounts or cloud projects.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export const MEDIA_BUCKET = 'editor-media';
