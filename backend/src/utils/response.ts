import { Response } from 'express';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Operação realizada com sucesso',
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Criado com sucesso',
): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};