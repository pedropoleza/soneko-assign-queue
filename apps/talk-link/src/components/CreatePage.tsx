import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  HeartHandshake,
  MessageCircle,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, type LinkInput } from '@/lib/api';
import { buildMessage, LANGUAGES, PARTNER_KINDS, TONES } from '@/lib/message';
import { onlyDigits } from '@/lib/utils';
import type { AppState, CodeMode, Language, Link, Tone } from '@/types';
import { Button, Chip, Input, Step, Textarea } from './ui';
import { ChatPreview } from './ChatPreview';

const SUBJECTS = [
  { value: 'protecao_financeira', label: 'Proteção financeira', Icon: Shield },
  { value: 'seguro_vida', label: 'Seguro de vida', Icon: HeartHandshake },
  { value: 'aposentadoria', label: 'Aposentadoria', Icon: TrendingUp },
  { value: 'recrutamento', label: 'Carreira', Icon: Briefcase },
  { value: 'outro', label: 'Outro assunto', Icon: MessageCircle },
] as const;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function CreatePage({ state, onCreated }: { state: AppState; onCreated: (l: Link) => void }) {
  const [partner, setPartner] = useState('');
  const [kind, setKind] = useState<string>('influencer');
  const [subject, setSubject] = useState<string>('protecao_financeira');
  const [tone, setTone] = useState<Tone>('amigavel');
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tudo daqui para baixo tem um padrão que serve para 9 em cada 10 campanhas.
  const [more, setMore] = useState(false);
  const [campaign, setCampaign] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState(state.account.whatsapp_phone ?? '');
  const [language, setLanguage] = useState<Language>('pt');
  // Invisível serve para praticamente toda campanha; deixou de ser pergunta.
  const codeMode: CodeMode = 'invisible';

  const known = useMemo(
    () => state.partners.filter((p) => p.active).map((p) => p.name),
    [state.partners],
  );
  const isNewPartner =
    partner.trim().length > 0 &&
    !known.some((n) => n.toLowerCase() === partner.trim().toLowerCase());

  const generated = useMemo(
    () => buildMessage({ partnerName: partner, objective: subject, tone, language }),
    [partner, subject, tone, language],
  );

  useEffect(() => {
    if (!edited) setMessage(generated);
  }, [generated, edited]);

  const defaultCampaign = useMemo(() => {
    const s = SUBJECTS.find((x) => x.value === subject)?.label ?? 'Campanha';
    return `${s} · ${MESES[new Date().getMonth()]}`;
  }, [subject]);

  const ready = partner.trim().length >= 2 && message.trim().length >= 10 && onlyDigits(phone).length >= 10;

  async function submit() {
    if (!ready) {
      if (onlyDigits(phone).length < 10) {
        toast.error('Falta o número de WhatsApp que vai receber — está em “Mais opções”.');
        setMore(true);
      } else {
        toast.error('Diga quem está indicando para criar o link.');
      }
      return;
    }
    setSaving(true);
    try {
      const existing = state.partners.find(
        (p) => p.name.trim().toLowerCase() === partner.trim().toLowerCase(),
      );
      const payload: LinkInput = {
        partner_id: existing?.id ?? null,
        partner_name: existing ? null : partner.trim(),
        partner_kind: kind,
        name: campaign.trim() || defaultCampaign,
        slug: slug.trim(),
        destination_phone: onlyDigits(phone),
        message: message.trim(),
        code_mode: codeMode,
        objective: subject,
        tone,
        language,
      };
      const link = await api.saveLink(payload);
      // Sem tela de ajustes, o primeiro número informado vira o padrão da conta.
      if (!state.account.whatsapp_phone && onlyDigits(phone)) {
        api.saveSettings({ whatsapp_phone: onlyDigits(phone) }).catch(() => {});
      }
      onCreated(link);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      toast.error(
        msg === 'missing_destination_phone'
          ? 'Informe o número de WhatsApp em “Mais opções” antes de criar o link.'
          : `Não deu para criar o link. ${msg}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="card p-6 sm:p-7">
        <div className="mb-7">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Criar um link</h1>
          <p className="mt-1 text-sm text-ink-2">
            Três respostas e o link fica pronto para o influenciador postar.
          </p>
        </div>

        <div className="space-y-7">
          <Step
            n={1}
            title="Quem está indicando?"
            aside={known.length > 0 ? <span className="text-[12px] text-ink-3">{known.length} cadastrados</span> : undefined}
          >
            <Input
              list="known-partners"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="Nome do influenciador, loja ou parceiro"
              autoComplete="off"
            />
            <datalist id="known-partners">
              {known.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>

            {isNewPartner && (
              <div className="rise mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-ink-3">Novo por aqui. É:</span>
                {PARTNER_KINDS.map((k) => (
                  <Chip
                    key={k.value}
                    on={kind === k.value}
                    onClick={() => setKind(k.value)}
                    className="px-3 py-1.5 text-[13px]"
                  >
                    {k.label}
                  </Chip>
                ))}
              </div>
            )}
          </Step>

          <Step n={2} title="Sobre o que a pessoa quer falar?">
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(({ value, label, Icon }) => (
                <Chip
                  key={value}
                  on={subject === value}
                  onClick={() => setSubject(value)}
                  icon={<Icon className="h-4 w-4" />}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </Step>

          <Step
            n={3}
            title="A mensagem"
            aside={
              <button
                type="button"
                onClick={() => {
                  setEdited(false);
                  setMessage(generated);
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 transition hover:text-accent-deep"
              >
                <RefreshCw className="h-3 w-3" />
                gerar de novo
              </button>
            }
          >
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <Chip
                  key={t.value}
                  on={tone === t.value}
                  onClick={() => setTone(t.value)}
                  className="px-3 py-1.5 text-[13px]"
                >
                  {t.label}
                </Chip>
              ))}
            </div>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setEdited(true);
              }}
            />
          </Step>
        </div>

        <div className="mt-7 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="flex w-full items-center gap-2 text-left text-[13px] font-medium text-ink-2 transition hover:text-ink"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${more ? 'rotate-180' : ''}`} />
            Mais opções
            <span className="hidden text-[12px] font-normal text-ink-3 sm:inline">
              campanha, número, endereço, idioma
            </span>
          </button>

          {more && (
            <div className="rise mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Nome da campanha</span>
                <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder={defaultCampaign} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Endereço do link</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, ''))}
                  placeholder="gerado automaticamente"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Número que recebe</span>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Idioma</span>
                <select
                  className="field cursor-pointer"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>


            </div>
          )}
        </div>

        {/* Rodapé do cartão, no padrão dos outros painéis: ação à direita. */}
        <div className="-mx-6 mt-7 flex items-center justify-between gap-3 border-t border-line px-6 pt-4 sm:-mx-7 sm:px-7">
          <p className="text-xs text-ink-3">O link já nasce contando cliques.</p>
          <Button onClick={submit} loading={saving} disabled={!ready}>
            <Sparkles className="h-3.5 w-3.5" />
            Criar link
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <p className="eyebrow mb-2.5">Prévia</p>
        <ChatPreview message={message} businessName={state.account.name} phone={phone} />
      </div>
    </div>
  );
}
