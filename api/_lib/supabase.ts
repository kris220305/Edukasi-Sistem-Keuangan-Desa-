import { createClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Don't throw here, return empty string so we can handle it later
    return "";
  }
  return value;
}

export function getSupabaseAdmin() {
  const url = getEnv("VITE_SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !key) {
    throw new Error(`Missing Supabase credentials (URL: ${!!url}, Key: ${!!key}). Please set environment variables in Vercel dashboard.`);
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function sendJson(res: any, status: number, data: unknown) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(data));
}

export function getQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === "object") {
    return body as Record<string, unknown>;
  }
  return {};
}
