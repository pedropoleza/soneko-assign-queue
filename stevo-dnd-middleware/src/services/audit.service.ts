import { logger } from '../utils/logger';

/**
 * Registro de auditoria de cada operação por instância.
 * Hoje escreve em log estruturado (stdout, coletável por qualquer agregador).
 * Evolução futura: persistir em banco (Postgres/Supabase) mantendo esta interface.
 */
export interface AuditEntry {
  timestamp: string;
  action: 'block' | 'unblock';
  locationId: string;
  clientName: string;
  contactId: string;
  normalizedPhone: string;
  instance: string;
  success: boolean;
  message: string;
  source: string;
  reason: string;
}

export const auditService = {
  record(entry: Omit<AuditEntry, 'timestamp'>): void {
    const full: AuditEntry = { timestamp: new Date().toISOString(), ...entry };
    // Log estruturado com namespace fixo para facilitar filtro/exportação.
    // Nunca incluir apiKey aqui (o logger também redige por segurança).
    logger.info({ audit: full }, `[AUDIT] ${full.action} ${full.normalizedPhone} @ ${full.instance}: ${full.success ? 'OK' : 'FALHA'}`);
  },
};
