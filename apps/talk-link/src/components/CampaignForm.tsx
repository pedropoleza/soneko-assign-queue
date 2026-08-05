import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, type LinkInput } from '@/lib/api';
import { buildMessage, CODE_MODES, LANGUAGES, OBJECTIVES, PARTNER_KINDS, TONES } from '@/lib/message';
import { onlyDigits, slugify } from '@/lib/utils';
import type { AppState, CodeMode, Language, Link, Tone } from '@/types';
import { Button, Card, CardHeader, Field, Input, RadioCards, Select, Textarea } from './ui';

type Props = {
  state: AppState;
  onCreated: (link: Link) => void;
};

export function CampaignForm({ state, onCreated }: Props) {
  const [partnerName, setPartnerName] = useState('');
  const [partnerKind, setPartnerKind] = useState<string>('influencer');
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState<string>('protecao_financeira');
  const [leadName, setLeadName] = useState('');
  const [tone, setTone] = useState<Tone>('amigavel');
  const [language, setLanguage] = useState<Language>('pt');
  const [phone, setPhone] = useState(state.account.whatsapp_phone ?? '');
  const [codeMode, setCodeMode] = useState<CodeMode>('invisible');
  const [message, setMessage] = useState('');
  const [touchedMessage, setTouchedMessage] = useState(false);
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  // Enquanto a pessoa não editar o texto à mão, ele acompanha os campos.
  const generated = useMemo(
    () => buildMessage({ partnerName, objective, tone, language, leadName }),
    [partnerName, objective, tone, language, leadName],
  );

  useEffect(() => {
    if (!touchedMessage) setMessage(generated);
  }, [generated, touchedMessage]);

  const suggestedSlug = useMemo(() => {
    const a = slugify(partnerName);
    const b = slugify(campaignName);
    return [a, b].filter(Boolean).join('/');
  }, [partnerName, campaignName]);

  const partnerOptions = useMemo(
    () => state.partners.filter((p) => p.active).map((p) => p.name),
    [state.partners],
  );

  const canSubmit = partnerName.trim().length >= 2 && message.trim().length >= 10 && onlyDigits(phone).length >= 10;

  async function submit() {
    if (!canSubmit) {
      toast.error('Preencha o parceiro, o número de destino e a mensagem.');
      return;
    }
    setSaving(true);
    try {
      const existing = state.partners.find(
        (p) => p.name.trim().toLowerCase() === partnerName.trim().toLowerCase(),
      );
      const payload: LinkInput = {
        partner_id: existing?.id ?? null,
        partner_name: existing ? null : partnerName.trim(),
        partner_kind: partnerKind,
        name: campaignName.trim() || 'Campanha',
        slug: (slug || suggestedSlug || '').trim(),
        destination_phone: onlyDigits(phone),
        message: message.trim(),
        code_mode: codeMode,
        objective,
        tone,
        language,
        lead_name: leadName.trim() || null,
      };
      const link = await api.saveLink(payload);
      toast.success(`Link criado: /${link.slug}`);
      onCreated(link);
      setCampaignName('');
      setSlug('');
      setTouchedMessage(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      toast.error(
        msg === 'missing_destination_phone'
          ? 'Defina o número de destino (ou salve um padrão em Ajustes).'
          : `Não deu para criar o link: ${msg}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Nova campanha"
        subtitle="Cada campanha vira um link curto próprio, com rastreio embutido."
      />

      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da indicação" required hint="Quem está divulgando — é por aqui que a métrica é agrupada.">
            <Input
              list="partner-options"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Ex.: Maria Silva"
              autoComplete="off"
            />
            <datalist id="partner-options">
              {partnerOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>

          <Field label="Tipo de indicação">
            <Select
              value={partnerKind}
              onChange={(e) => setPartnerKind(e.target.value)}
              options={PARTNER_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da campanha" hint="Ex.: Black Friday, Lançamento, Bio de Julho.">
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex.: Black Friday"
            />
          </Field>

          <Field label="Objetivo do lead">
            <Select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              options={OBJECTIVES.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
        </div>

        <Field
          label="Endereço do link"
          hint={`Fica assim: ${state.account.short_domain || 'https://talk.sparkleads.com'}/${slug || suggestedSlug || 'parceiro/campanha'}`}
        >
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, ''))}
            placeholder={suggestedSlug || 'parceiro/campanha'}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do lead" hint="Opcional. Personaliza a mensagem quando você já sabe quem é.">
            <Input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Opcional" />
          </Field>

          <Field label="Idioma">
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              options={LANGUAGES}
            />
          </Field>
        </div>

        <Field label="Tom da mensagem">
          <RadioCards value={tone} onChange={setTone} options={TONES} />
        </Field>

        <Field
          label="Número de destino"
          required
          hint="Precisa ser o número conectado ao GHL — é o que dispara o webhook de mensagem recebida."
        >
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5511999998888"
            inputMode="numeric"
          />
        </Field>

        <Field
          label="Mensagem"
          required
          hint="É esse texto que aparece pronto no WhatsApp. Ele também funciona como impressão digital do link."
        >
          <div className="relative">
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setTouchedMessage(true);
              }}
            />
            {touchedMessage && (
              <button
                type="button"
                onClick={() => {
                  setTouchedMessage(false);
                  setMessage(generated);
                }}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-ink-500 hover:text-brand-700"
              >
                <Wand2 className="h-3 w-3" />
                gerar de novo
              </button>
            )}
          </div>
        </Field>

        <Field
          label="Marcador de rastreio"
          hint="O marcador confirma o envio com certeza total. Mesmo sem ele, o texto da mensagem ainda identifica o link."
        >
          <RadioCards
            value={codeMode}
            onChange={setCodeMode}
            options={CODE_MODES.map((m) => ({ value: m.value as CodeMode, label: m.label, hint: m.hint }))}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-4">
        <p className="text-[11px] text-ink-400">
          O link curto é gerado na hora e já começa a contar cliques.
        </p>
        <Button onClick={submit} loading={saving} disabled={!canSubmit}>
          <Sparkles className="h-3.5 w-3.5" />
          Gerar link
        </Button>
      </div>
    </Card>
  );
}
