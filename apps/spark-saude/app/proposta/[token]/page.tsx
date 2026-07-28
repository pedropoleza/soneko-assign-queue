import { ProposalView } from "@/components/cotacao/proposal-view";

export const dynamic = "force-dynamic";

/** Public proposal page (Ponta B). No dashboard chrome — its own Leão brand. */
export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ProposalView token={token} />;
}
