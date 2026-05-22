import { prisma } from '../config/database';

export class CartRepository {
  async findActiveByUserId(userId: string) {
    return prisma.cart.findFirst({
      where: { userId, isActive: true },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                  },
                },
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
  }

  async createCart(userId: string) {
    return prisma.cart.create({
      data: {
        userId,
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });
  }

  async addItem(cartId: string, variantId: string, quantity: number, unitPrice: number) {
    return prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      update: { quantity: { increment: quantity } },
      create: { cartId, variantId, quantity, unitPrice },
    });
  }

  async updateItem(itemId: string, quantity: number) {
    return prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  async removeItem(itemId: string) {
    return prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clearCart(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  }

  async findItemById(itemId: string) {
    return prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { variant: true },
    });
  }

  async deactivateCart(cartId: string) {
    return prisma.cart.update({
      where: { id: cartId },
      data: { isActive: false },
    });
  }
}