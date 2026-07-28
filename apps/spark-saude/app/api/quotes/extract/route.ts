import { extractPlanFromPrint } from "@/lib/cotacao/extract";
import { uploadPrint } from "@/lib/cotacao/storage";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/quotes/extract — read a plan screenshot and return the plan fields.
 * The print is also stored privately and returned as a signed URL, so the same
 * upload both fills the form and stays attached as the visual backing (§6).
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(new Error("Envie um arquivo de imagem."));
    if (file.size > 10 * 1024 * 1024) return jsonError(new Error("Imagem muito grande (máx. 10 MB)."));

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Extract first: if the print is unreadable there's no point storing it.
    const plan = await extractPlanFromPrint(bytes, file.type || "image/png");
    const { url } = await uploadPrint(file);

    return jsonOk({ plan, printUrl: url });
  } catch (err) {
    return jsonError(err);
  }
}
