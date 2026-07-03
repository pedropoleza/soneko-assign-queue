import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { setupApi, type GhlConfig, type SetupInstance } from './api';

interface FormInstance extends SetupInstance {
  key: number; // chave local do React
  testResult?: { ok: boolean; message: string };
}

/**
 * Página de setup do cliente (/?page=stevo-setup&token=...).
 * Aberta pelo link único gerado no painel admin; permite cadastrar as
 * instâncias Stevo (URL do servidor + API Key), testar a conexão contra a
 * API real e, ao salvar, exibe a configuração pronta do webhook para o GHL.
 */
export function StevoSetupPage({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [clientName, setClientName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [instances, setInstances] = useState<FormInstance[]>([]);
  const [saving, setSaving] = useState(false);
  const [ghlConfig, setGhlConfig] = useState<GhlConfig | null>(null);
  const [seq, setSeq] = useState(1);

  useEffect(() => {
    void (async () => {
      const { status, data } = await setupApi.load(token);
      setLoading(false);
      if (status !== 200 || data.error) {
        setInvalid(true);
        return;
      }
      setClientName(data.clientName ?? '');
      setLocationId(data.locationId ?? '');
      const loaded = (data.instances ?? []).map((i, idx) => ({ ...i, key: idx + 1, apiKey: '' }));
      setInstances(loaded.length > 0 ? loaded : [emptyInstance(1)]);
      setSeq(loaded.length + 2);
    })();
  }, [token]);

  function emptyInstance(key: number): FormInstance {
    return { key, name: '', serverUrl: '', apiKey: '', active: true };
  }

  function update(key: number, patch: Partial<FormInstance>) {
    setInstances((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function addInstance() {
    setInstances((prev) => [...prev, emptyInstance(seq)]);
    setSeq((s) => s + 1);
  }

  function removeInstance(key: number) {
    setInstances((prev) => prev.filter((i) => i.key !== key));
  }

  async function test(inst: FormInstance) {
    update(inst.key, { testResult: { ok: false, message: 'Testando...' } });
    const { data } = await setupApi.test(token, inst.serverUrl.trim(), (inst.apiKey ?? '').trim(), inst.id);
    update(inst.key, { testResult: { ok: data.ok === true, message: data.message ?? data.error ?? 'Erro no teste' } });
  }

  async function save() {
    setSaving(true);
    const { data } = await setupApi.save(
      token,
      instances.map(({ key: _key, testResult: _t, maskedKey: _m, ...rest }) => rest),
    );
    setSaving(false);
    if (data.error || !data.ghlConfig) {
      toast.error(data.error ?? 'Erro ao salvar');
      return;
    }
    setGhlConfig(data.ghlConfig);
    toast.success('Configuração salva');
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success('Copiado');
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-ink-50 text-sm text-ink-500">Carregando…</div>;
  }

  if (invalid) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
        <div className="card max-w-md p-6 text-center">
          <div className="text-sm font-medium text-ink-900">Link inválido ou expirado</div>
          <p className="mt-1 text-xs text-ink-500">Peça um novo link de configuração ao administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <div className="card p-5">
          <h1 className="text-base font-semibold text-ink-900">Configuração Stevo — {clientName}</h1>
          <p className="mt-1 text-xs text-ink-500">Location GHL: <code>{locationId}</code></p>
        </div>

        <div className="card p-5">
          <h2 className="card-title">Instâncias Stevo (números de WhatsApp)</h2>
          <p className="mt-1 text-xs text-ink-500">
            A URL do servidor (https://smv2-N.stevo.chat) e a API Key aparecem no painel da instância no StevoManager V2.
          </p>

          <div className="mt-4 space-y-4">
            {instances.map((inst) => (
              <div key={inst.key} className="rounded-lg border border-ink-200 bg-ink-50/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-800">Instância</span>
                  <Button variant="danger" size="sm" onClick={() => removeInstance(inst.key)}>Remover</Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-ink-600">Nome</label>
                    <Input placeholder="Número Principal" value={inst.name} onChange={(e) => update(inst.key, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-600">URL do servidor Stevo</label>
                    <Input placeholder="https://smv2-1.stevo.chat" value={inst.serverUrl} onChange={(e) => update(inst.key, { serverUrl: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-600">
                      API Key {inst.maskedKey ? `(atual: ${inst.maskedKey} — deixe em branco para manter)` : ''}
                    </label>
                    <Input
                      type="password"
                      placeholder={inst.maskedKey ? 'manter a atual' : 'cole a API Key da instância'}
                      value={inst.apiKey ?? ''}
                      onChange={(e) => update(inst.key, { apiKey: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => void test(inst)}>Testar conexão</Button>
                  {inst.testResult && (
                    <span className={`text-xs ${inst.testResult.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {inst.testResult.message}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={addInstance}>+ Adicionar instância</Button>
            <Button loading={saving} onClick={() => void save()}>Salvar configuração</Button>
          </div>
        </div>

        {ghlConfig && (
          <div className="card p-5">
            <h2 className="card-title">✅ Salvo — agora configure o GHL</h2>
            <div className="mt-3 space-y-4 text-sm text-ink-800">
              <p>
                <strong>Workflow de bloqueio</strong> — trigger: DND WhatsApp habilitado ou tag{' '}
                <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">stevo_block_whatsapp</code>.<br />
                <strong>Workflow de desbloqueio</strong> — trigger: DND removido ou tag{' '}
                <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">stevo_unblock_whatsapp</code>.
              </p>
              <p>Nos dois workflows, adicione a ação <strong>Custom Webhook</strong> com:</p>
              <ConfigBlock label="URL (method POST)" value={ghlConfig.webhookUrl} onCopy={copy} />
              <ConfigBlock
                label="Headers"
                value={`${ghlConfig.secretHeader}: ${ghlConfig.secretValue}\nContent-Type: application/json`}
                onCopy={copy}
              />
              <ConfigBlock label="Body — bloqueio" value={JSON.stringify(ghlConfig.blockBody, null, 2)} onCopy={copy} />
              <ConfigBlock label="Body — desbloqueio" value={JSON.stringify(ghlConfig.unblockBody, null, 2)} onCopy={copy} />
              <p className="text-xs text-ink-500">Guarde o secret com cuidado — ele autoriza bloqueios nesta location.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ConfigBlock({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-600">{label}</span>
        <Button variant="ghost" size="sm" onClick={() => onCopy(value)}>Copiar</Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-ink-900 p-3 text-xs text-ink-100">{value}</pre>
    </div>
  );
}
