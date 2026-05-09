import { getQueryValue, getSupabaseAdmin, parseBody, sendJson } from "./_lib/supabase";

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const villageId = getQueryValue(req.query?.villageId);
      
      if (villageId) {
        const { data, error } = await supabase
          .from("village_group_limits")
          .select("village_id, village_name, min_members, max_members")
          .eq("village_id", villageId)
          .maybeSingle();

        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data ?? null);
      }

      const { data, error } = await supabase
        .from("village_group_limits")
        .select("village_id, village_name, min_members, max_members");

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, data ?? []);
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = parseBody(req.body);
      
      const { data, error } = await supabase
        .from("village_group_limits")
        .upsert(
          {
            village_id: body.village_id,
            village_name: body.village_name,
            min_members: Math.max(1, Math.floor(Number(body.min_members || 1))),
            max_members: Math.max(1, Math.floor(Number(body.max_members || 10))),
          },
          { onConflict: "village_id" }
        )
        .select()
        .single();

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, data);
    }

    res.setHeader("Allow", "GET, POST, PUT");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson(res, 500, { error: message });
  }
}
