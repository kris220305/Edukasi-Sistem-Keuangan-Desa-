import { getSupabaseAdmin, sendJson } from "./_lib/supabase";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "POST") {
      const { fileName, fileBase64, contentType } = req.body;

      if (!fileName || !fileBase64) {
        return sendJson(res, 400, { error: "fileName and fileBase64 are required" });
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(fileBase64, 'base64');

      const { data, error } = await supabase.storage
        .from("screenshots")
        .upload(fileName, buffer, {
          upsert: true,
          contentType: contentType || "image/jpeg",
        });

      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, { success: true, data });
    }

    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson(res, 500, { error: message });
  }
}
