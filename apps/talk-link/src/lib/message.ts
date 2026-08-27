import type { Language, Tone } from '@/types';

export const OBJECTIVES = [
  { value: 'protecao_financeira', label: 'Proteção Financeira' },
  { value: 'seguro_vida', label: 'Seguro de Vida' },
  { value: 'aposentadoria', label: 'Aposentadoria' },
  { value: 'recrutamento', label: 'Recrutamento (Carreira)' },
  { value: 'outro', label: 'Outro' },
] as const;

export const TONES: Array<{ value: Tone; label: string; hint: string }> = [
  { value: 'amigavel', label: 'Amigável', hint: 'Próximo, conversa de WhatsApp mesmo' },
  { value: 'profissional', label: 'Profissional', hint: 'Formal, para público mais corporativo' },
  { value: 'direto', label: 'Curto e direto', hint: 'Duas linhas, sem rodeio' },
];

export const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

export const PARTNER_KINDS = [
  { value: 'influencer', label: 'Influenciador' },
  { value: 'store', label: 'Loja' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'other', label: 'Outro' },
] as const;

const SUBJECT: Record<Language, Record<string, string>> = {
  pt: {
    protecao_financeira: 'proteção financeira',
    seguro_vida: 'seguro de vida',
    aposentadoria: 'planejamento de aposentadoria',
    recrutamento: 'a oportunidade de carreira',
    outro: 'os serviços de vocês',
  },
  en: {
    protecao_financeira: 'financial protection',
    seguro_vida: 'life insurance',
    aposentadoria: 'retirement planning',
    recrutamento: 'the career opportunity',
    outro: 'your services',
  },
  es: {
    protecao_financeira: 'protección financiera',
    seguro_vida: 'seguro de vida',
    aposentadoria: 'planificación de jubilación',
    recrutamento: 'la oportunidad de carrera',
    outro: 'sus servicios',
  },
};

export type MessageInput = {
  partnerName: string;
  objective: string;
  tone: Tone;
  language: Language;
  leadName?: string;
};

/**
 * Gera a mensagem que vai pré-preenchida no WhatsApp.
 *
 * Ela precisa ser *única por link* — é essa unicidade que permite reconhecer a
 * mensagem quando ela chega no CRM, mesmo se o marcador de rastreio for perdido.
 * Por isso o nome do parceiro sempre entra no texto.
 */
export function buildMessage({ partnerName, objective, tone, language, leadName }: MessageInput): string {
  const subject = SUBJECT[language][objective] ?? SUBJECT[language].outro;
  const partner = partnerName.trim() || (language === 'pt' ? 'um parceiro' : 'a partner');
  const lead = (leadName ?? '').trim();

  if (language === 'en') {
    switch (tone) {
      case 'profissional':
        return `Hello! ${lead ? `My name is ${lead}. ` : ''}I was referred by ${partner} and I'd like more information about ${subject}.`;
      case 'direto':
        return `Hi! I came from ${partner}. I'd like to know about ${subject}.`;
      default:
        return `Hi there!${lead ? ` I'm ${lead}.` : ''} I came through ${partner}'s recommendation and I'd love to understand more about ${subject}. Can you help me?`;
    }
  }

  if (language === 'es') {
    switch (tone) {
      case 'profissional':
        return `¡Hola! ${lead ? `Mi nombre es ${lead}. ` : ''}Me recomendó ${partner} y me gustaría recibir más información sobre ${subject}.`;
      case 'direto':
        return `¡Hola! Vengo de ${partner}. Quiero saber sobre ${subject}.`;
      default:
        return `¡Hola! ¿Todo bien?${lead ? ` Soy ${lead}.` : ''} Vengo por la recomendación de ${partner} y quería entender mejor sobre ${subject}. ¿Me puedes ayudar?`;
    }
  }

  switch (tone) {
    case 'profissional':
      return `Olá! ${lead ? `Meu nome é ${lead}. ` : ''}Recebi a indicação de ${partner} e gostaria de mais informações sobre ${subject}.`;
    case 'direto':
      return `Oi! Vim por ${partner}. Quero saber sobre ${subject}.`;
    default:
      return `Oi! Tudo bem?${lead ? ` Meu nome é ${lead}.` : ''} Vim pela indicação de ${partner} e queria entender melhor sobre ${subject}. Pode me ajudar?`;
  }
}

export const CODE_MODES = [
  {
    value: 'invisible',
    label: 'Invisível',
    hint: 'Marcador de largura zero no fim do texto. A pessoa não vê nada.',
  },
  {
    value: 'discreet',
    label: 'Discreto',
    hint: 'Adiciona “(ref: XXXXX)” no fim. Visível, mas discreto.',
  },
  { value: 'visible', label: 'Visível', hint: 'Adiciona “Código: XXXXX” no fim.' },
  { value: 'none', label: 'Nenhum', hint: 'Sem marcador. A atribuição usa só o texto da mensagem.' },
] as const;
