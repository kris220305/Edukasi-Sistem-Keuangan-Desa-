import { getQueryValue, getSupabaseAdmin, parseBody, sendJson } from "./_lib/supabase";

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return sendJson(res, 500, { error: "Supabase credentials missing in Vercel environment variables." });
    }
    if (req.method === "GET") {
      const action = getQueryValue(req.query?.action);

      if (action === "active") {
        const minutes = Number(getQueryValue(req.query?.minutes) || "5");
        const threshold = new Date(Date.now() - minutes * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from("user_sessions")
          .select("*")
          .gte("last_active", threshold)
          .order("last_active", { ascending: false });

        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data ?? []);
      }

      if (action === "all") {
        const { data, error } = await supabase
          .from("user_sessions")
          .select("*")
          .order("last_active", { ascending: false });

        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data ?? []);
      }

      const sessionId = getQueryValue(req.query?.sessionId);
      if (!sessionId) {
        return sendJson(res, 400, { error: "sessionId is required" });
      }

      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, data ?? null);
    }

    if (req.method === "PUT") {
      const body = parseBody(req.body);
      const { sessionId, formData } = body;
      
      const { error } = await supabase
        .from("user_sessions")
        .update({ form_data: formData, last_active: new Date().toISOString() })
        .eq("session_id", sessionId);
        
      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, { success: true });
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      const payloadInput =
        body.payload && typeof body.payload === "object"
          ? (body.payload as Record<string, unknown>)
          : {};

      if (!sessionId) {
        return sendJson(res, 400, { error: "sessionId is required" });
      }

      let existingProgress: Record<string, unknown> = {};
      if (payloadInput.form_progress !== undefined) {
        const { data: existing } = await supabase
          .from("user_sessions")
          .select("form_progress")
          .eq("session_id", sessionId)
          .maybeSingle();

        existingProgress =
          typeof existing?.form_progress === "object" && existing.form_progress !== null
            ? (existing.form_progress as Record<string, unknown>)
            : {};
      }

      const payload: Record<string, unknown> = {
        session_id: sessionId,
        last_active: new Date().toISOString(),
      };

      if (payloadInput.user_name !== undefined) payload.user_name = payloadInput.user_name;
      if (payloadInput.village_id !== undefined) payload.village_id = payloadInput.village_id;
      if (payloadInput.village_name !== undefined) payload.village_name = payloadInput.village_name;
      if (payloadInput.form_data !== undefined) payload.form_data = payloadInput.form_data;
      if (payloadInput.work_mode !== undefined) payload.work_mode = payloadInput.work_mode;
      if (payloadInput.group_id !== undefined) payload.group_id = payloadInput.group_id;
      if (payloadInput.form_progress !== undefined) {
        payload.form_progress = {
          ...existingProgress,
          ...(payloadInput.form_progress as Record<string, unknown>),
        };
      }

      const { data, error } = await supabase
        .from("user_sessions")
        .upsert(payload as never, { onConflict: "session_id" })
        .select("*")
        .maybeSingle();

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, data ?? null);
    }

    if (req.method === "PATCH") {
      const body = parseBody(req.body);
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

      if (!sessionId) {
        return sendJson(res, 400, { error: "sessionId is required" });
      }

      const { data, error } = await supabase
        .from("user_sessions")
        .update({ last_active: new Date().toISOString() })
        .eq("session_id", sessionId)
        .select("*")
        .maybeSingle();

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, data ?? null);
    }

    if (req.method === "DELETE") {
      const sessionId = getQueryValue(req.query?.sessionId);
      if (!sessionId) {
        return sendJson(res, 400, { error: "sessionId is required" });
      }

      const { error } = await supabase.from("user_sessions").delete().eq("session_id", sessionId);
      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, { success: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson(res, 500, { error: message });
  }
}
