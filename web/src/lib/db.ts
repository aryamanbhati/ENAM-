import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Server-only client. Uses the secret key when present (writes), else the publishable key (reads). */
export function db(): SupabaseClient {
  if (admin) return admin;
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Supabase env vars missing");
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

export function canWrite(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
