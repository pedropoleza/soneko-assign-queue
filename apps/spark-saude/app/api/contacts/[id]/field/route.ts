import { z } from "zod";
import { updateFieldData } from "@/lib/ghl";
import { jsonError, jsonOk, locationFromRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEMANTIC_FIELDS = [
  "dataRenovacao",
  "validoAPartir",
  "policyStartDate",
  "nextPolicyAnniversary",
  "nextFollowup",
  "seguradora",
  "planoEscolhido",
  "formaPagamento",
  "monthlyPremium",
  "documentacaoRecebida",
  "underwritingStatus",
  "pessoasNaCasa",
  "pessoasNoSeguro",
  "rendaCasa",
  "idioma",
  "beneficiario",
  "primaryBeneficiary",
  "intencaoRenovar",
  "motivoNaoRenovar",
  "mudouRenda",
  "mudouEndereco",
  "mudouDependentes",
  "mainObjection",
  "submittedProposal",
] as const;

const bodySchema = z.object({
  field: z.enum(SEMANTIC_FIELDS),
  value: z.union([z.string().max(2000), z.number()]),
});

/** Update a single custom field (e.g. set data_renovacao). Confirmed on the front. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { field, value } = bodySchema.parse(await req.json());
    return jsonOk(await updateFieldData(locationFromRequest(req), id, field, value));
  } catch (err) {
    return jsonError(err);
  }
}
