import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cart.service';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendNoContent } from '../utils/response';

const cartService = new CartService();

export class CartController {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const cart = await cartService.getCart(user.id);
      sendSuccess(res, cart);
    } catch (error) {
      next(error);
    }
  }

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const cart = await cartService.addItem(user.id, req.body);
      sendSuccess(res, cart, 'Item adicionado ao carrinho');
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const cart = await cartService.updateItem(user.id, req.params.itemId, req.body);
      sendSuccess(res, cart, 'Carrinho atualizado');
    } catch (error) {
      next(error);
    }
  }

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const cart = await cartService.removeItem(user.id, req.params.itemId);
      sendSuccess(res, cart, 'Item removido do carrinho');
    } catch (error) {
      next(error);
    }
  }

  async clear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      await cartService.clearCart(user.id);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
}