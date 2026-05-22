import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidateTarget = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, target: ValidateTarget = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req[target]);

      if (!result.success) {
        const errors: Record<string, string[]> = {};
        result.error.errors.forEach((err) => {
          const field = err.path.join('.') || 'root';
          if (!errors[field]) errors[field] = [];
          errors[field].push(err.message);
        });

        res.status(422).json({
          success: false,
          message: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          errors,
        });
        return;
      }

      req[target] = result.data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };