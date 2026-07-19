/** Human-friendly labels for GHL tags (display only). */
const OVERRIDES: Record<string, string> = {
  linha_saude: "Linha saúde",
  linha_vida: "Linha vida",
  requer_atencao: "Requer atenção",
  informacao_pendente: "Informação pendente",
  documento_pendente: "Documento pendente",
  renovacao_avisada: "Renovação avisada",
  renovacao_pendente: "Renovação pendente",
  renovacao_feita: "Renovação feita",
  nao_renovou: "Não renovou",
  em_revisao: "Em revisão",
  cliente_ativo: "Cliente ativo",
  cliente_inativo: "Cliente inativo",
  cliente_onboarding: "Onboarding",
  lead_novo: "Lead novo",
  cotacao_solicitada: "Cotação solicitada",
  cotacao_enviada: "Cotação enviada",
  opcao_escolhida: "Opção escolhida",
  aplicacao_iniciada: "Aplicação iniciada",
  aplicacao_em_analise: "Em análise",
  aprovado: "Aprovado",
  pagamento_confirmado: "Pagamento confirmado",
  sem_resposta: "Sem resposta",
  lembrete_enviado: "Lembrete enviado",
  form_nao_preenchido: "Form não preenchido",
};

export function humanizeTag(tag: string): string {
  return OVERRIDES[tag] ?? tag.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export const ATTENTION_TAGS = ["requer_atencao", "informacao_pendente", "documento_pendente"];

export function isAttentionTag(tag: string): boolean {
  return ATTENTION_TAGS.includes(tag);
}
