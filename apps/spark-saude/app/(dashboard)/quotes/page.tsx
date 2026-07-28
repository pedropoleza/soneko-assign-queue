import { QuoteBuilder } from "@/components/cotacao/quote-builder";

/**
 * The quote cockpit owns the full frame height and manages its own scrolling
 * (three independent panes), so it renders without the standard PageHeader —
 * every pixel of vertical space here is working space inside the GHL iframe.
 */
export default function QuotesPage() {
  return <QuoteBuilder />;
}
