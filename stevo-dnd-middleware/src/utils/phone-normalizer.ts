import { InvalidPhoneError } from './errors';

/**
 * Normaliza um telefone para o formato aceito pelo Stevo: apenas dígitos,
 * com DDI (ex.: "+55 (38) 99999-9999" -> "5538999999999").
 *
 * Regras atuais (foco Brasil, preparado para expansão internacional):
 * - Remove tudo que não é dígito (espaços, parênteses, hífens, "+", etc.).
 * - "00" inicial (prefixo de chamada internacional) é removido.
 * - Se já começa com 55 e tem tamanho de número brasileiro completo (12-13
 *   dígitos = 55 + DDD + 8/9 dígitos), mantém.
 * - Se tem 10-11 dígitos (DDD + número, sem DDI), assume Brasil e prefixa 55.
 * - Números com DDI de outro país (>= 11 dígitos que não casam com o padrão
 *   brasileiro) são mantidos como estão — ajuste aqui quando houver clientes
 *   internacionais.
 */
export function normalizePhone(rawPhone: string | null | undefined): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new InvalidPhoneError('Telefone ausente no payload');
  }

  let digits = rawPhone.replace(/\D+/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.length < 10) {
    throw new InvalidPhoneError(
      `Telefone inválido: "${rawPhone}" tem menos dígitos que o mínimo esperado (DDD + número)`
    );
  }

  // Já está com DDI brasileiro: 55 + DDD(2) + número(8 ou 9)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Sem DDI: DDD(2) + número(8 ou 9) -> assume Brasil
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Outros formatos (possível DDI internacional): valida tamanho máximo E.164
  if (digits.length > 15) {
    throw new InvalidPhoneError(`Telefone inválido: "${rawPhone}" excede o tamanho máximo E.164`);
  }

  return digits;
}
