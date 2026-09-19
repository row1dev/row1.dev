import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = process.env.SUPABASE_PHOTO_BUCKET || "champagne-photos";

let cached: SupabaseClient | null = null;

/**
 * Server-side client met de service role key. De browser praat nooit rechtstreeks
 * met Supabase; alles loopt via de route handlers in app/api.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is niet geconfigureerd: zet NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isAdminKey(key: string | null | undefined): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return false;
  if (!key || key.length !== expected.length) return false;
  // constant-time-ish vergelijking
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ key.charCodeAt(i);
  }
  return diff === 0;
}
