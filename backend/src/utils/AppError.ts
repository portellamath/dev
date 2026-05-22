export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly errors?: Record<string, string[]> | string[];

  constructor(
    message: string,
    statusCode = 400,
    code = 'BAD_REQUEST',
    errors?: Record<string, string[]> | string[],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }

  static badRequest(message: string, errors?: Record<string, string[]>): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', errors);
  }

  static unauthorized(message = 'Não autorizado'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Acesso negado'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Recurso não encontrado'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, 'CONFLICT');
  }

  static unprocessable(message: string, errors?: Record<string, string[]>): AppError {
    return new AppError(message, 422, 'UNPROCESSABLE', errors);
  }

  static internal(message = 'Erro interno do servidor'): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }

  static tooMany(message = 'Muitas requisições'): AppError {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }
}