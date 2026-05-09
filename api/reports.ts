import { getSupabaseAdmin, sendJson } from "./_lib/supabase";

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("submitted_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, data || []);
    }

    if (req.method === "POST") {
      const { group_id, session_id, submitted_by, village_id, village_name, report_data } = req.body;
      
      const { data, error } = await supabase
        .from("submitted_reports")
        .insert({ group_id, session_id, submitted_by, village_id, village_name, report_data })
        .select()
        .single();

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, data);
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson(res, 500, { error: message });
  }
}
