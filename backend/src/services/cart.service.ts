import { prisma } from '../config/database';
import { CartRepository } from '../repositories/cart.repository';
import { AppError } from '../utils/AppError';
import { AddCartItemInput, UpdateCartItemInput } from '../validators/cart.validator';

export class CartService {
  private cartRepo = new CartRepository();

  async getCart(userId: string) {
    let cart = await this.cartRepo.findActiveByUserId(userId);

    if (!cart) {
      cart = await this.cartRepo.createCart(userId);
      cart = await this.cartRepo.findActiveByUserId(userId);
    }

    if (!cart) throw AppError.internal('Erro ao carregar carrinho');

    // Calcula totais
    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    return {
      ...cart,
      subtotal: Number(subtotal.toFixed(2)),
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async addItem(userId: string, input: AddCartItemInput) {
    // Valida variante
    const variant = await prisma.productVariant.findFirst({
      where: { id: input.variantId, deletedAt: null, isActive: true },
      include: { product: true },
    });

    if (!variant) throw AppError.notFound('Variante não encontrada');
    if (!variant.isActive || !variant.product.isActive) {
      throw AppError.badRequest('Produto indisponível');
    }
    if (variant.stockQty < input.quantity) {
      throw AppError.badRequest(
        `Estoque insuficiente. Disponível: ${variant.stockQty}`,
      );
    }

    let cart = await this.cartRepo.findActiveByUserId(userId);
    if (!cart) {
      cart = await this.cartRepo.createCart(userId);
    }

    const unitPrice = variant.price ?? variant.product.salePrice ?? variant.product.basePrice;

    // Verifica se item já no carrinho — limite de 99
    const existingItem = cart.items?.find((i) => i.variantId === input.variantId);
    if (existingItem) {
      const newQty = existingItem.quantity + input.quantity;
      if (newQty > 99) {
        throw AppError.badRequest('Quantidade máxima por item é 99');
      }
      if (variant.stockQty < newQty) {
        throw AppError.badRequest(`Estoque insuficiente. Disponível: ${variant.stockQty}`);
      }
    }

    await this.cartRepo.addItem(cart.id, input.variantId, input.quantity, Number(unitPrice));

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, input: UpdateCartItemInput) {
    const cart = await this.cartRepo.findActiveByUserId(userId);
    if (!cart) throw AppError.notFound('Carrinho não encontrado');

    const item = cart.items?.find((i) => i.id === itemId);
    if (!item) throw AppError.notFound('Item não encontrado no carrinho');

    const variant = await prisma.productVariant.findFirst({
      where: { id: item.variantId, deletedAt: null },
    });

    if (!variant) throw AppError.notFound('Variante não encontrada');
    if (variant.stockQty < input.quantity) {
      throw AppError.badRequest(`Estoque insuficiente. Disponível: ${variant.stockQty}`);
    }

    await this.cartRepo.updateItem(itemId, input.quantity);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.cartRepo.findActiveByUserId(userId);
    if (!cart) throw AppError.notFound('Carrinho não encontrado');

    const item = cart.items?.find((i) => i.id === itemId);
    if (!item) throw AppError.notFound('Item não encontrado no carrinho');

    await this.cartRepo.removeItem(itemId);
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.cartRepo.findActiveByUserId(userId);
    if (cart) {
      await this.cartRepo.clearCart(cart.id);
    }
  }
}