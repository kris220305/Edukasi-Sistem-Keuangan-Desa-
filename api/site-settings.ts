import { getSupabaseAdmin, parseBody, sendJson } from "./_lib/supabase";

const SITE_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return sendJson(res, 500, { error: "Supabase credentials missing in Vercel environment variables." });
    }
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", SITE_SETTINGS_ID)
        .single();

      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, data ?? null);
    }

    if (req.method === "PATCH") {
      const body = parseBody(req.body);
      const updates: Record<string, unknown> = {};

      if (body.is_locked !== undefined) updates.is_locked = body.is_locked;
      if (body.max_users !== undefined) updates.max_users = body.max_users;

      const { data, error } = await supabase
        .from("site_settings")
        .update(updates)
        .eq("id", SITE_SETTINGS_ID)
        .select("*")
        .single();

      if (error) {
        return sendJson(res, 500, { error: error.message });
      }

      return sendJson(res, 200, data ?? null);
    }

    res.setHeader("Allow", "GET, PATCH");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson(res, 500, { error: message });
  }
}
