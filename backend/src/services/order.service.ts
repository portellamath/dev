import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { OrderRepository } from '../repositories/order.repository';
import { CartRepository } from '../repositories/cart.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { AppError } from '../utils/AppError';
import { generateOrderNumber } from '../utils/slug';
import { parsePagination, buildPaginatedResult } from '../utils/pagination';
import { logPayment, logAdmin } from '../config/logger';
import { CreateOrderInput, OrderQueryInput, UpdateOrderStatusInput } from '../validators/order.validator';

export class OrderService {
  private orderRepo = new OrderRepository();
  private cartRepo = new CartRepository();
  private auditRepo = new AuditRepository();

  async createOrder(userId: string, input: CreateOrderInput) {
    // Carrega carrinho
    const cart = await this.cartRepo.findActiveByUserId(userId);
    if (!cart || !cart.items.length) {
      throw AppError.badRequest('Carrinho vazio');
    }

    // Valida endereço
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId, deletedAt: null },
    });
    if (!address) throw AppError.notFound('Endereço não encontrado');

    // Valida estoque e calcula valores
    const orderItems: Array<{
      variantId: string;
      productId: string;
      productName: string;
      variantName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }> = [];

    for (const item of cart.items) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: item.variantId, deletedAt: null, isActive: true },
        include: { product: true },
      });

      if (!variant || !variant.isActive) {
        throw AppError.badRequest(`Variante "${item.variant.name}" indisponível`);
      }

      if (variant.stockQty < item.quantity) {
        throw AppError.badRequest(
          `Estoque insuficiente para "${variant.name}". Disponível: ${variant.stockQty}`,
        );
      }

      const unitPrice = Number(variant.price ?? variant.product.salePrice ?? variant.product.basePrice);

      orderItems.push({
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice,
        total: unitPrice * item.quantity,
      });
    }

    const subtotal = orderItems.reduce((sum, i) => sum + i.total, 0);
    const shippingCost = 0; // TODO: calcular frete
    const total = subtotal + shippingCost;

    // Cria pedido em transação
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          status: OrderStatus.PENDING,
          subtotal,
          shippingCost,
          total,
          notes: input.notes,
          items: {
            create: orderItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              productName: i.productName,
              variantName: i.variantName,
              sku: i.sku,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          },
          payment: {
            create: {
              method: input.paymentMethod,
              status: PaymentStatus.PENDING,
              amount: total,
              currency: 'BRL',
            },
          },
          shipment: {
            create: {
              addressId: input.addressId,
              status: 'PENDING',
              shippingCost,
            },
          },
        },
        include: {
          items: true,
          payment: true,
          shipment: true,
        },
      });

      // Decrementa estoque
      for (const item of orderItems) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { decrement: item.quantity } },
        });

        await tx.stockLog.create({
          data: {
            variantId: item.variantId,
            previousQty: (
              await tx.productVariant.findUnique({ where: { id: item.variantId } })
            )!.stockQty + item.quantity,
            newQty:
              (await tx.productVariant.findUnique({ where: { id: item.variantId } }))!
                .stockQty,
            changeQty: -item.quantity,
            reason: 'Pedido criado',
            reference: newOrder.id,
          },
        });
      }

      // Desativa carrinho
      await tx.cart.update({
        where: { id: cart.id },
        data: { isActive: false },
      });

      return newOrder;
    });

    await this.auditRepo.create({
      actorId: userId,
      userId,
      action: 'CREATE',
      resource: 'Order',
      resourceId: order.id,
      newData: { orderNumber: order.orderNumber, total, paymentMethod: input.paymentMethod },
    });

    logPayment('ORDER_CREATED', order.id, {
      userId,
      total,
      method: input.paymentMethod,
    });

    return order;
  }

  async getMyOrders(userId: string, query: OrderQueryInput) {
    const pagination = parsePagination(query.page, query.limit);
    const { orders, total } = await this.orderRepo.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      filters: {
        userId,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    });
    return buildPaginatedResult(orders, total, pagination);
  }

  async getOrderById(orderId: string, userId: string, isAdmin = false) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');

    if (!isAdmin && order.userId !== userId) {
      throw AppError.forbidden('Acesso negado');
    }

    return order;
  }

  async updateStatus(orderId: string, input: UpdateOrderStatusInput, adminId: string) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');

    // Valida transição de status
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
    };

    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw AppError.badRequest(
        `Transição de status inválida: ${order.status} → ${input.status}`,
      );
    }

    const updated = await this.orderRepo.updateStatus(
      orderId,
      input.status,
      input.cancelReason,
    );

    // Devolver estoque se cancelado
    if (input.status === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
    }

    await this.auditRepo.create({
      actorId: adminId,
      userId: order.userId,
      action: 'ORDER_STATUS_CHANGE',
      resource: 'Order',
      resourceId: orderId,
      oldData: { status: order.status },
      newData: { status: input.status },
    });

    logAdmin('ORDER_STATUS_CHANGED', adminId, {
      orderId,
      from: order.status,
      to: input.status,
    });

    return updated;
  }

  // Admin: listar todos os pedidos
  async listAllOrders(query: OrderQueryInput) {
    const pagination = parsePagination(query.page, query.limit);
    const { orders, total } = await this.orderRepo.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      filters: {
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    });
    return buildPaginatedResult(orders, total, pagination);
  }
}