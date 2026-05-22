import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/response';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(
        req.body,
        req.ip,
        req.get('User-Agent'),
      );
      sendCreated(res, result, 'Conta criada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(
        req.body,
        req.ip,
        req.get('User-Agent'),
      );
      sendSuccess(res, result, 'Login realizado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshTokens(
        refreshToken,
        req.ip,
        req.get('User-Agent'),
      );
      sendSuccess(res, result, 'Tokens renovados com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { refreshToken } = req.body;
      await authService.logout(user.id, refreshToken);
      sendSuccess(res, null, 'Logout realizado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(user.id, currentPassword, newPassword);
      sendSuccess(res, null, 'Senha alterada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      sendSuccess(res, { user });
    } catch (error) {
      next(error);
    }
  }
}