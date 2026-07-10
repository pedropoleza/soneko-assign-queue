// Motor de substituição de variáveis (seção 2.5 + Etapa 2).
// Portável (sem deps) — roda nas Edge Functions (Deno) e é testável com Node.
//
// Regras:
//  - Só aceita variáveis da allow-list. Variáveis fora da lista são REJEITADAS.
//  - Template vazio é inválido.
//  - Texto final é truncado ao teto de caracteres (D4) antes do TTS.

export const ALLOWED_VARIABLES = [
  'first_name',
  'full_name',
  'phone',
  'email',
  'business_name',
  'user_name',
  'appointment_date',
  'appointment_time',
  'pipeline_stage',
  'custom_service',
] as const;

export type AllowedVariable = (typeof ALLOWED_VARIABLES)[number];
export type TemplateVars = Partial<Record<AllowedVariable, string>>;

export const MAX_CHARS_PER_AUDIO = 800;

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Extrai os nomes de variáveis referenciados no template. */
export function extractVariables(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) found.add(m[1]);
  return [...found];
}

export type ValidationResult = { ok: boolean; errors: string[]; unknownVars: string[] };

/** Valida o template contra a allow-list e regras estruturais. */
export function validateTemplate(text: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = (text ?? '').trim();
  if (!trimmed) errors.push('template_vazio');

  const unknownVars = extractVariables(trimmed).filter(
    (v) => !(ALLOWED_VARIABLES as readonly string[]).includes(v),
  );
  if (unknownVars.length) errors.push(`variaveis_nao_permitidas:${unknownVars.join(',')}`);

  return { ok: errors.length === 0, errors, unknownVars };
}

export type RenderResult = { text: string; characters: number; truncated: boolean };

/**
 * Substitui as variáveis pelos valores. Variáveis ausentes viram string vazia.
 * Colapsa espaços resultantes e trunca ao teto de caracteres.
 */
export function renderTemplate(
  text: string,
  vars: TemplateVars,
  maxChars: number = MAX_CHARS_PER_AUDIO,
): RenderResult {
  const replaced = text.replace(VAR_RE, (_full, name: string) => {
    if ((ALLOWED_VARIABLES as readonly string[]).includes(name)) {
      return (vars as Record<string, string>)[name] ?? '';
    }
    return '';
  });

  const normalized = replaced.replace(/[ \t]{2,}/g, ' ').replace(/\s+\n/g, '\n').trim();
  const truncated = normalized.length > maxChars;
  const finalText = truncated ? normalized.slice(0, maxChars).trim() : normalized;

  return { text: finalText, characters: finalText.length, truncated };
}
