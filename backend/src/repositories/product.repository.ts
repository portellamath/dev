import { Prisma, Product } from '@prisma/client';
import { prisma } from '../config/database';
import { ProductFilters } from '../types';

export class ProductRepository {
  async findById(id: string) {
    return prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { deletedAt: null, isActive: true },
          include: { images: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return prisma.product.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { deletedAt: null, isActive: true },
          include: { images: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  async findBySku(sku: string): Promise<Product | null> {
    return prisma.product.findFirst({ where: { sku, deletedAt: null } });
  }

  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return prisma.product.create({ data });
  }

  async update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return prisma.product.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    filters: ProductFilters;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: params.filters.isActive !== undefined ? params.filters.isActive : true,
      ...(params.filters.categoryId ? { categoryId: params.filters.categoryId } : {}),
      ...(params.filters.brand ? { brand: { contains: params.filters.brand } } : {}),
      ...(params.filters.isFeatured !== undefined
        ? { isFeatured: params.filters.isFeatured }
        : {}),
      ...(params.filters.search
        ? {
            OR: [
              { name: { contains: params.filters.search } },
              { description: { contains: params.filters.search } },
              { brand: { contains: params.filters.search } },
              { sku: { contains: params.filters.search } },
            ],
          }
        : {}),
      ...(params.filters.minPrice || params.filters.maxPrice
        ? {
            basePrice: {
              ...(params.filters.minPrice ? { gte: params.filters.minPrice } : {}),
              ...(params.filters.maxPrice ? { lte: params.filters.maxPrice } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      params.sortBy === 'price'
        ? { basePrice: params.sortOrder ?? 'asc' }
        : params.sortBy === 'name'
        ? { name: params.sortOrder ?? 'asc' }
        : { createdAt: params.sortOrder ?? 'desc' };

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          _count: { select: { variants: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  async countAll(): Promise<number> {
    return prisma.product.count({ where: { deletedAt: null } });
  }
}