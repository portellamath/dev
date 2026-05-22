import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

interface CreateAuditLogParams {
  actorId?: string;
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditRepository {
  async create(params: CreateAuditLogParams) {
    return prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        oldData: params.oldData as Prisma.InputJsonValue,
        newData: params.newData as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    userId?: string;
    actorId?: string;
    action?: AuditAction;
    resource?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.resource ? { resource: params.resource } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            createdAt: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}