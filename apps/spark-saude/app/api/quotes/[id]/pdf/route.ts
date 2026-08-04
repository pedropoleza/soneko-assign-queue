import { renderProposalPdf, renderProposalPdfUrl } from "@/lib/cotacao/proposal-pdf";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/quotes/{id}/pdf — open/download the branded proposal in the browser. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { bytes, filename } = await renderProposalPdf(id);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/quotes/{id}/pdf — store it and hand back the signed URL. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return jsonOk({ url: await renderProposalPdfUrl(id) });
  } catch (err) {
    return jsonError(err);
  }
}
