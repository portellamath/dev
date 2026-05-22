import winston from 'winston';
import path from 'path';
import fs from 'fs';

const LOG_DIR = process.env.LOG_DIR ?? './logs';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'debug';

// Garante que o diretório de logs existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Formato customizado para console
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${ts}] ${level}: ${stack ?? message}${metaStr}`;
  }),
);

// Formato JSON para arquivos
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    // Console (dev)
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test',
    }),

    // Arquivo de erros
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),

    // Arquivo combinado
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 10,
    }),

    // Arquivo de auth
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'auth.log'),
      level: 'info',
      format: combine(
        timestamp(),
        json(),
        winston.format((info) => {
          if (info.type === 'AUTH') return info;
          return false;
        })(),
      ),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// Log helpers tipados
export const logAuth = (
  action: string,
  userId: string | null,
  meta?: Record<string, unknown>,
) => {
  logger.info(action, { type: 'AUTH', userId, ...meta });
};

export const logPayment = (
  action: string,
  orderId: string,
  meta?: Record<string, unknown>,
) => {
  logger.info(action, { type: 'PAYMENT', orderId, ...meta });
};

export const logAdmin = (
  action: string,
  adminId: string,
  meta?: Record<string, unknown>,
) => {
  logger.info(action, { type: 'ADMIN', adminId, ...meta });
};