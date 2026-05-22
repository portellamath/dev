import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Rate limit global
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em alguns minutos.',
    code: 'TOO_MANY_REQUESTS',
  },
  skip: (req) => req.ip === '127.0.0.1' && env.NODE_ENV === 'development',
});

// Rate limit para autenticação (anti-brute force)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'TOO_MANY_AUTH_ATTEMPTS',
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});

// Rate limit para upload
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: {
    success: false,
    message: 'Limite de uploads atingido. Tente novamente em 1 minuto.',
    code: 'TOO_MANY_UPLOADS',
  },
});

// Rate limit para webhook
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Rate limit webhook atingido',
    code: 'TOO_MANY_WEBHOOK_REQUESTS',
  },
});