import { PageHeader } from "@/components/shell/page-header";
import { QuoteBuilder } from "@/components/cotacao/quote-builder";

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotações"
        description="Monte uma cotação de saúde (Marketplace) e gere a proposta para o cliente aprovar. Conectada ao contato no GHL."
      />
      <QuoteBuilder />
    </div>
  );
}
