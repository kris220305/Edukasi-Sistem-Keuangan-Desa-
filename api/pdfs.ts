import { getSupabaseAdmin, sendJson } from "./_lib/supabase";

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data: folders } = await supabase.storage.from("report-pdfs").list("", { limit: 100 });
      if (!folders) return sendJson(res, 200, []);

      const allPdfs = [];
      for (const folder of folders) {
        if (folder.id === null && folder.name === ".emptyFolderPlaceholder") continue;
        const { data: files } = await supabase.storage.from("report-pdfs").list(folder.name, { limit: 50 });
        if (files) {
          for (const f of files) {
            if (f.name.endsWith(".pdf")) {
              const path = `${folder.name}/${f.name}`;
              const { data: urlData } = supabase.storage.from("report-pdfs").getPublicUrl(path);
              allPdfs.push({
                name: f.name,
                fullPath: path,
                url: urlData.publicUrl,
                folder: folder.name,
                created_at: f.created_at || "",
              });
            }
          }
        }
      }
      allPdfs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sendJson(res, 200, allPdfs);
    }

    if (req.method === "POST") {
      const { fileName, fileBase64, contentType } = req.body;
      const buffer = Buffer.from(fileBase64, 'base64');
      
      const { data, error } = await supabase.storage
        .from("report-pdfs")
        .upload(fileName, buffer, {
          upsert: true,
          contentType: contentType || "application/pdf",
        });

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
