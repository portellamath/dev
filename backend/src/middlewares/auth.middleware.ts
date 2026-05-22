import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { JwtAccessPayload, AuthenticatedRequest } from '../types';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Token de acesso não fornecido');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('Token de acesso inválido');
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(AppError.unauthorized('Token expirado'));
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      next(AppError.unauthorized('Token inválido'));
      return;
    }
    next(error);
  }
};

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      next(AppError.unauthorized());
      return;
    }

    if (!roles.includes(user.role)) {
      next(AppError.forbidden('Você não tem permissão para esta ação'));
      return;
    }

    next();
  };
};

export const isAdmin = requireRole(Role.ADMIN, Role.SUPER_ADMIN);
export const isSuperAdmin = requireRole(Role.SUPER_ADMIN);

// Middleware opcional: injeta usuário se autenticado, mas não bloqueia
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    // ignora erro — é opcional
  }

  next();
};