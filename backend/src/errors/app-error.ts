export class AppError extends Error {
  statusCode: number;
  details?: unknown;
  // Identificador estable para que el frontend distinga casos sin parsear el
  // mensaje (ej. "EMAIL_NOT_VERIFIED"). Opcional: la mayoría de los errores no lo necesita.
  code?: string;

  constructor(statusCode: number, message: string, details?: unknown, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}
