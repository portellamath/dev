import { Prisma, Order, OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { OrderFilters } from '../types';

export class OrderRepository {
  async findById(id: string) {
    return prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
        payment: true,
        shipment: { include: { address: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
  }

  async findByOrderNumber(orderNumber: string) {
    return prisma.order.findFirst({
      where: { orderNumber, deletedAt: null },
      include: {
        items: true,
        payment: true,
        shipment: { include: { address: true } },
      },
    });
  }

  async create(data: Prisma.OrderCreateInput): Promise<Order> {
    return prisma.order.create({ data });
  }

  async updateStatus(id: string, status: OrderStatus, cancelReason?: string): Promise<Order> {
    return prisma.order.update({
      where: { id },
      data: {
        status,
        ...(cancelReason ? { cancelReason } : {}),
      },
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    filters: OrderFilters;
  }) {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(params.filters.userId ? { userId: params.filters.userId } : {}),
      ...(params.filters.status ? { status: params.filters.status as OrderStatus } : {}),
      ...(params.filters.dateFrom || params.filters.dateTo
        ? {
            createdAt: {
              ...(params.filters.dateFrom ? { gte: new Date(params.filters.dateFrom) } : {}),
              ...(params.filters.dateTo ? { lte: new Date(params.filters.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { variant: { select: { name: true } } } },
          payment: { select: { status: true, method: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  async countByStatus() {
    return prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { deletedAt: null },
    });
  }

  async sumRevenue(dateFrom?: Date, dateTo?: Date): Promise<number> {
    const result = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        deletedAt: null,
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
    });
    return Number(result._sum.total ?? 0);
  }
}