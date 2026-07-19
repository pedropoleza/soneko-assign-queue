import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { ClientsView } from "@/components/clients/clients-view";
import { LoadingRows } from "@/components/ui/data-state";

export default function ClientsPage() {
  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Carteira da linha saúde. Busque e clique em um cliente para abrir o painel 360."
      />
      <Suspense fallback={<LoadingRows rows={8} />}>
        <ClientsView />
      </Suspense>
    </div>
  );
}
