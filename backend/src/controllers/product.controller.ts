import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';

const productService = new ProductService();

export class ProductController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productService.listProducts(req.query as never);
      sendSuccess(res, result.data, 'Produtos listados', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.getProductBySlug(req.params.slug);
      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.getProductById(req.params.id);
      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = (req as AuthenticatedRequest).user;
      const product = await productService.createProduct(req.body, admin.id);
      sendCreated(res, product, 'Produto criado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = (req as AuthenticatedRequest).user;
      const product = await productService.updateProduct(req.params.id, req.body, admin.id);
      sendSuccess(res, product, 'Produto atualizado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = (req as AuthenticatedRequest).user;
      await productService.deleteProduct(req.params.id, admin.id);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async createVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = (req as AuthenticatedRequest).user;
      const variant = await productService.createVariant(req.params.id, req.body, admin.id);
      sendCreated(res, variant, 'Variante criada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = (req as AuthenticatedRequest).user;
      const variant = await productService.updateVariant(req.params.variantId, req.body, admin.id);
      sendSuccess(res, variant, 'Variante atualizada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async updateStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = (req as AuthenticatedRequest).user;
      const { quantity, reason } = req.body;
      const variant = await productService.updateStock(
        req.params.variantId,
        quantity,
        admin.id,
        reason,
      );
      sendSuccess(res, variant, 'Estoque atualizado com sucesso');
    } catch (error) {
      next(error);
    }
  }
}