import { getSupabaseAdmin, sendJson } from "./_lib/supabase";

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();
    const { action } = req.query;

    if (req.method === "POST") {
      if (action === "kick-user") {
        const { sessionId } = req.body;
        await supabase.from("group_members").delete().eq("session_id", sessionId);
        const { error } = await supabase.from("user_sessions").delete().eq("session_id", sessionId);
        try {
          await supabase.storage.from("screenshots").remove([`${sessionId}.png`]);
        } catch { /* ignore */ }
        
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { success: true });
      }

      if (action === "delete-pdf") {
        const { path } = req.body;
        const { error } = await supabase.storage.from("report-pdfs").remove([path]);
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { success: true });
      }
      if (action === "kick-all") {
        const { error: gmErr } = await supabase
          .from("group_members")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: gErr } = await supabase
          .from("groups")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: sErr } = await supabase
          .from("user_sessions")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        if (gmErr || gErr || sErr) {
          return sendJson(res, 500, { error: (sErr || gErr || gmErr)?.message });
        }
        return sendJson(res, 200, { success: true });
      }

      if (action === "delete-all-reports") {
        const { error } = await supabase
          .from("submitted_reports")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { success: true });
      }

      if (action === "delete-report") {
        const { id } = req.body;
        const { error } = await supabase.from("submitted_reports").delete().eq("id", id);
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { success: true });
      }

      if (action === "reset-progress") {
        const { sessionId } = req.body;
        const { error } = await supabase
          .from("user_sessions")
          .update({
            form_progress: {},
            form_data: {},
            last_active: new Date().toISOString(),
          })
          .eq("session_id", sessionId);
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { success: true });
      }

      if (action === "reset-all-progress") {
        const { error } = await supabase
          .from("user_sessions")
          .update({
            form_progress: {},
            form_data: {},
            last_active: new Date().toISOString(),
          })
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { success: true });
      }

      if (action === "delete-all-pdfs") {
        const { paths } = req.body;
        if (paths && paths.length > 0) {
          await supabase.storage.from("report-pdfs").remove(paths);
        }
        return sendJson(res, 200, { success: true });
      }
    }

    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson(res, 500, { error: message });
  }
}
