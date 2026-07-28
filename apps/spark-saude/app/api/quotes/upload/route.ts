import { uploadPrint } from "@/lib/cotacao/storage";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8_000_000; // 8 MB

/** POST /api/quotes/upload — multipart print upload → private storage + signed URL. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(new Error("Arquivo ausente."));
    if (!file.type.startsWith("image/")) return jsonError(new Error("Envie uma imagem (print)."));
    if (file.size > MAX_BYTES) return jsonError(new Error("Imagem muito grande (máx. 8 MB)."));
    const { url } = await uploadPrint(file);
    return jsonOk({ url });
  } catch (err) {
    return jsonError(err);
  }
}
