import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminApi, buildSetupUrl, type AuditEntry, type StevoClientRow } from './api';

/**
 * Painel do administrador do middleware Stevo DND (/?page=stevo).
 * Cadastra clientes (nome + Location ID do GHL), gera links de setup
 * e mostra a auditoria das operações de bloqueio/desbloqueio.
 */
export function StevoAdminPage() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('stevo_admin_secret') ?? '');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(false);

  const [clients, setClients] = useState<StevoClientRow[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [creating, setCreating] = useState(false);
  const [setupLinks, setSetupLinks] = useState<Record<string, string>>({});

  const refresh = useCallback(async (s: string) => {
    const [clientsRes, auditRes] = await Promise.all([adminApi.list(s), adminApi.audit(s)]);
    if (clientsRes.status === 200) setClients(clientsRes.data.clients ?? []);
    if (auditRes.status === 200) setAudit(auditRes.data.entries ?? []);
  }, []);

  const login = useCallback(async (s: string) => {
    if (!s) return;
    setChecking(true);
    const { status } = await adminApi.list(s);
    setChecking(false);
    if (status !== 200) {
      toast.error('Admin secret inválido');
      return;
    }
    sessionStorage.setItem('stevo_admin_secret', s);
    setAuthed(true);
    void refresh(s);
  }, [refresh]);

  useEffect(() => {
    if (secret) void login(secret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createClient() {
    if (!newName.trim() || !newLocation.trim()) {
      toast.error('Informe o nome do cliente e o Location ID');
      return;
    }
    setCreating(true);
    const { data } = await adminApi.create(secret, newName.trim(), newLocation.trim());
    setCreating(false);
    if (data.error || !data.setupToken) {
      toast.error(data.error ?? 'Erro ao criar cliente');
      return;
    }
    const url = buildSetupUrl(data.setupToken);
    if (data.clientId) setSetupLinks((prev) => ({ ...prev, [data.clientId!]: url }));
    setNewName('');
    setNewLocation('');
    toast.success('Cliente criado — link de setup gerado');
    void refresh(secret);
  }

  async function newLink(clientId: string) {
    const { data } = await adminApi.setupLink(secret, clientId);
    if (data.error || !data.setupToken) {
      toast.error(data.error ?? 'Erro ao gerar link');
      return;
    }
    setSetupLinks((prev) => ({ ...prev, [clientId]: buildSetupUrl(data.setupToken!) }));
  }

  async function toggle(client: StevoClientRow) {
    await adminApi.toggleClient(secret, client.id, !client.active);
    void refresh(secret);
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success('Copiado');
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
        <div className="card w-full max-w-sm p-6">
          <h1 className="text-base font-semibold text-ink-900">Stevo DND — Admin</h1>
          <p className="mt-1 text-xs text-ink-500">Bloqueio de WhatsApp via Stevo, acionado pelo GHL.</p>
          <Input
            className="mt-4"
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void login(secret)}
          />
          <Button className="mt-3 w-full" loading={checking} onClick={() => void login(secret)}>
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="h-14 border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-6">
          <div className="text-sm font-semibold text-ink-900">Stevo DND — Admin</div>
          <Button variant="outline" size="sm" onClick={() => void refresh(secret)}>Atualizar</Button>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl space-y-5 px-6 py-6">
        <section className="card p-5">
          <h2 className="card-title">Novo cliente</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-600">Nome do cliente</label>
              <Input placeholder="Cliente 1" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="min-w-52 flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-600">Location ID (GHL)</label>
              <Input placeholder="ex.: ve9EPM428h8vShlRW1KT" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
            </div>
            <Button loading={creating} onClick={() => void createClient()}>Criar + gerar link</Button>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Clientes</h2></div>
          {clients.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Nenhum cliente ainda — crie o primeiro acima.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-2.5">Cliente</th>
                    <th className="px-5 py-2.5">Location ID</th>
                    <th className="px-5 py-2.5">Instâncias</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="table-row align-top">
                      <td className="px-5 py-3 font-medium text-ink-900">{c.clientName}</td>
                      <td className="px-5 py-3"><code className="text-xs">{c.locationId}</code></td>
                      <td className="px-5 py-3 text-ink-700">
                        {c.instances.length === 0
                          ? <span className="text-ink-400">nenhuma (setup pendente)</span>
                          : c.instances.map((i) => i.name + (i.active ? '' : ' (inativa)')).join(', ')}
                      </td>
                      <td className="px-5 py-3">
                        <span className={c.active ? 'pill-brand' : 'pill'}>{c.active ? 'ativo' : 'inativo'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => void newLink(c.id)}>Novo link de setup</Button>
                          <Button variant="ghost" size="sm" onClick={() => void toggle(c)}>{c.active ? 'Desativar' : 'Ativar'}</Button>
                        </div>
                        {setupLinks[c.id] && (
                          <div className="mt-2 max-w-md rounded-md border border-dashed border-ink-300 bg-ink-50 p-2 text-xs break-all">
                            {setupLinks[c.id]}
                            <Button variant="outline" size="sm" className="ml-2" onClick={() => copy(setupLinks[c.id])}>Copiar</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Auditoria — últimas 50 operações</h2></div>
          {audit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Nenhuma operação registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-2.5">Quando</th>
                    <th className="px-5 py-2.5">Ação</th>
                    <th className="px-5 py-2.5">Location</th>
                    <th className="px-5 py-2.5">Telefone</th>
                    <th className="px-5 py-2.5">Instância</th>
                    <th className="px-5 py-2.5">Resultado</th>
                    <th className="px-5 py-2.5">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e, i) => (
                    <tr key={i} className="table-row">
                      <td className="whitespace-nowrap px-5 py-2.5 text-ink-600">{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                      <td className="px-5 py-2.5">{e.action}</td>
                      <td className="px-5 py-2.5"><code className="text-xs">{e.ghl_location_id}</code></td>
                      <td className="px-5 py-2.5">{e.phone}</td>
                      <td className="px-5 py-2.5">{e.instance_name}</td>
                      <td className="px-5 py-2.5">
                        {e.success
                          ? <span className="pill-brand">OK</span>
                          : <span className="text-rose-600" title={e.message ?? ''}>falha — {e.message}</span>}
                      </td>
                      <td className="px-5 py-2.5 text-ink-600">{e.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
