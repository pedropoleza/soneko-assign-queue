/**
 * Erros de domínio do middleware. Cada erro carrega o status HTTP
 * que deve ser devolvido ao GHL e uma mensagem segura (sem dados sensíveis).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 500, code = 'internal_error') {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Segredo do webhook ausente ou inválido') {
    super(message, 401, 'unauthorized');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'validation_error');
  }
}

export class InvalidPhoneError extends AppError {
  constructor(message: string) {
    super(message, 400, 'invalid_phone');
  }
}

export class UnknownLocationError extends AppError {
  constructor(locationId: string) {
    super(`Location "${locationId}" não está configurada neste middleware`, 404, 'unknown_location');
  }
}

export class NoActiveInstanceError extends AppError {
  constructor(locationId: string) {
    super(`Location "${locationId}" não possui nenhuma instância Stevo ativa`, 422, 'no_active_instance');
  }
}
