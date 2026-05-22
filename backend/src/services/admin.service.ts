import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { UserRepository } from '../repositories/user.repository';
import { OrderRepository } from '../repositories/order.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { AppError } from '../utils/AppError';
import { parsePagination, buildPaginatedResult } from '../utils/pagination';
import { logAdmin } from '../config/logger';

export class AdminService {
  private userRepo = new UserRepository();
  private orderRepo = new OrderRepository();
  private auditRepo = new AuditRepository();

  async getDashboardStats() {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      revenue,
      ordersByStatus,
      recentOrders,
      lowStockVariants,
    ] = await Promise.all([
      this.userRepo.countAll(),
      prisma.product.count({ where: { deletedAt: null, isActive: true } }),
      prisma.order.count({ where: { deletedAt: null } }),
      this.orderRepo.sumRevenue(),
      this.orderRepo.countByStatus(),
      prisma.order.findMany({
        where: { deletedAt: null },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          payment: { select: { status: true } },
        },
      }),
      prisma.productVariant.findMany({
        where: { deletedAt: null, isActive: true, stockQty: { lte: 5 } },
        include: { product: { select: { name: true } } },
        take: 10,
        orderBy: { stockQty: 'asc' },
      }),
    ]);

    return {
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        revenue,
      },
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((s) => [s.status, s._count.status]),
      ),
      recentOrders,
      lowStockVariants,
    };
  }

  async listUsers(params: {
    page?: string;
    limit?: string;
    role?: Role;
    search?: string;
  }) {
    const pagination = parsePagination(params.page, params.limit);
    const { users, total } = await this.userRepo.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      role: params.role,
      search: params.search,
    });
    return buildPaginatedResult(users, total, pagination);
  }

  async updateUserRole(targetUserId: string, role: Role, adminId: string) {
    const user = await this.userRepo.findById(targetUserId);
    if (!user) throw AppError.notFound('Usuário não encontrado');

    if (user.role === Role.SUPER_ADMIN) {
      throw AppError.forbidden('Não é possível alterar role de SUPER_ADMIN');
    }

    const oldRole = user.role;
    const updated = await this.userRepo.updateRole(targetUserId, role);

    await this.auditRepo.create({
      actorId: adminId,
      userId: targetUserId,
      action: 'ROLE_CHANGE',
      resource: 'User',
      resourceId: targetUserId,
      oldData: { role: oldRole },
      newData: { role },
    });

    logAdmin('USER_ROLE_CHANGED', adminId, {
      targetUserId,
      oldRole,
      newRole: role,
    });

    return updated;
  }

  async deactivateUser(targetUserId: string, adminId: string) {
    const user = await this.userRepo.findById(targetUserId);
    if (!user) throw AppError.notFound('Usuário não encontrado');

    if (user.role === Role.SUPER_ADMIN) {
      throw AppError.forbidden('Não é possível desativar SUPER_ADMIN');
    }

    await this.userRepo.update(targetUserId, { isActive: false });

    await this.auditRepo.create({
      actorId: adminId,
      userId: targetUserId,
      action: 'UPDATE',
      resource: 'User',
      resourceId: targetUserId,
      oldData: { isActive: user.isActive },
      newData: { isActive: false },
    });

    logAdmin('USER_DEACTIVATED', adminId, { targetUserId });
  }

  async getAuditLogs(params: {
    page?: string;
    limit?: string;
    userId?: string;
    action?: string;
    resource?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const pagination = parsePagination(params.page, params.limit);
    const { logs, total } = await this.auditRepo.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      userId: params.userId,
      action: params.action as never,
      resource: params.resource,
      dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
      dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
    });
    return buildPaginatedResult(logs, total, pagination);
  }

  async getRevenueReport(dateFrom?: string, dateTo?: string) {
    const revenue = await this.orderRepo.sumRevenue(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );

    const dailyRevenue = await prisma.$queryRaw<
      Array<{ date: string; total: number; count: number }>
    >`
      SELECT 
        DATE(created_at) as date,
        SUM(total) as total,
        COUNT(*) as count
      FROM orders
      WHERE deleted_at IS NULL
        AND status IN ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
        ${dateFrom ? prisma.$queryRaw`AND created_at >= ${new Date(dateFrom)}` : prisma.$queryRaw``}
        ${dateTo ? prisma.$queryRaw`AND created_at <= ${new Date(dateTo)}` : prisma.$queryRaw``}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    return { totalRevenue: revenue, dailyRevenue };
  }
}