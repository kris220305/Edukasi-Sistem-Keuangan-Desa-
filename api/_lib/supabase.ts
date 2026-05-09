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
  const url = process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  // Logging mask untuk debugging di Vercel Logs (Aman, tidak membocorkan key penuh)
  console.log("Supabase Connection Check:", {
    hasUrl: !!url,
    urlPrefix: url.substring(0, 10),
    hasServiceRole: !!serviceRoleKey,
    hasAnonKey: !!anonKey,
    envCount: Object.keys(process.env).filter(k => k.includes("SUPABASE")).length
  });

  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function sendJson(res: any, status: number, data: unknown) {
  res.status(status).json(data);
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
