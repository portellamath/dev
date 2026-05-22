import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): Response => {
  // ==========================================
  // AppError (erros operacionais)
  // ==========================================
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[AppError] ${err.message}`, {
        url: req.url,
        method: req.method,
        statusCode: err.statusCode,
        stack: err.stack,
      });
    }

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  // ==========================================
  // Zod Validation Error
  // ==========================================
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const field = e.path.join('.');
      if (!errors[field]) errors[field] = [];
      errors[field].push(e.message);
    });

    return res.status(422).json({
      success: false,
      message: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      errors,
    });
  }

  // ==========================================
  // Prisma Errors
  // ==========================================
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[]) ?? [];
      return res.status(409).json({
        success: false,
        message: `Já existe um registro com ${fields.join(', ')} informado`,
        code: 'UNIQUE_CONSTRAINT',
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Registro não encontrado',
        code: 'NOT_FOUND',
      });
    }

    if (err.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Referência inválida — registro relacionado não existe',
        code: 'FOREIGN_KEY_CONSTRAINT',
      });
    }

    logger.error(`[Prisma P${err.code}] ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erro de banco de dados',
      code: 'DATABASE_ERROR',
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos para operação no banco',
      code: 'DB_VALIDATION_ERROR',
    });
  }

  // ==========================================
  // Erro desconhecido / não operacional
  // ==========================================
  logger.error(`[UnhandledError] ${err.message}`, {
    url: req.url,
    method: req.method,
    stack: err.stack,
  });

  return res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

// Handler para rotas não encontradas
export const notFoundHandler = (req: Request, res: Response): Response => {
  return res.status(404).json({
    success: false,
    message: `Rota ${req.method} ${req.url} não encontrada`,
    code: 'ROUTE_NOT_FOUND',
  });
};