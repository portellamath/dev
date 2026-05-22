import { prisma } from '../config/database';
import { ProductRepository } from '../repositories/product.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { AppError } from '../utils/AppError';
import { generateSlug } from '../utils/slug';
import { parsePagination, buildPaginatedResult } from '../utils/pagination';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../config/redis';
import { logAdmin } from '../config/logger';
import {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  ProductQueryInput,
} from '../validators/product.validator';

const CACHE_TTL = 300; // 5 minutos

export class ProductService {
  private productRepo = new ProductRepository();
  private auditRepo = new AuditRepository();

  async listProducts(query: ProductQueryInput) {
    const pagination = parsePagination(query.page, query.limit);

    const cacheKey = `products:list:${JSON.stringify({ ...query, ...pagination })}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { products, total } = await this.productRepo.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      filters: {
        categoryId: query.categoryId,
        search: query.search,
        minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
        maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
        switchType: query.switchType,
        layout: query.layout,
        brand: query.brand,
        isFeatured: query.isFeatured === 'true' ? true : undefined,
      },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const result = buildPaginatedResult(products, total, pagination);
    await cacheSet(cacheKey, result, CACHE_TTL);
    return result;
  }

  async getProductBySlug(slug: string) {
    const cacheKey = `products:slug:${slug}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const product = await this.productRepo.findBySlug(slug);
    if (!product) throw AppError.notFound('Produto não encontrado');

    await cacheSet(cacheKey, product, CACHE_TTL);
    return product;
  }

  async getProductById(id: string) {
    const product = await this.productRepo.findById(id);
    if (!product) throw AppError.notFound('Produto não encontrado');
    return product;
  }

  async createProduct(input: CreateProductInput, adminId: string) {
    const existing = await this.productRepo.findBySku(input.sku);
    if (existing) throw AppError.conflict('SKU já cadastrado');

    let slug = generateSlug(input.name);

    // Garante slug único
    const slugConflict = await prisma.product.findFirst({ where: { slug } });
    if (slugConflict) {
      slug = `${slug}-${Date.now()}`;
    }

    const product = await this.productRepo.create({
      category: { connect: { id: input.categoryId } },
      name: input.name,
      slug,
      description: input.description,
      brand: input.brand,
      sku: input.sku,
      basePrice: input.basePrice,
      salePrice: input.salePrice,
      isFeatured: input.isFeatured,
      tags: input.tags ? JSON.stringify(input.tags) : undefined,
      metaTitle: input.metaTitle,
      metaDesc: input.metaDesc,
    });

    await this.auditRepo.create({
      actorId: adminId,
      action: 'CREATE',
      resource: 'Product',
      resourceId: product.id,
      newData: { ...input },
    });

    logAdmin('PRODUCT_CREATED', adminId, { productId: product.id, sku: product.sku });
    await cacheDelPattern('products:*');

    return product;
  }

  async updateProduct(id: string, input: UpdateProductInput, adminId: string) {
    const product = await this.productRepo.findById(id);
    if (!product) throw AppError.notFound('Produto não encontrado');

    if (input.sku && input.sku !== product.sku) {
      const existing = await this.productRepo.findBySku(input.sku);
      if (existing) throw AppError.conflict('SKU já cadastrado');
    }

    const updated = await this.productRepo.update(id, {
      ...input,
      tags: input.tags ? JSON.stringify(input.tags) : undefined,
      ...(input.name ? { slug: generateSlug(input.name) } : {}),
    });

    await this.auditRepo.create({
      actorId: adminId,
      action: 'UPDATE',
      resource: 'Product',
      resourceId: id,
      oldData: { ...product },
      newData: { ...input },
    });

    await cacheDelPattern('products:*');
    await cacheDel(`products:slug:${product.slug}`);
    logAdmin('PRODUCT_UPDATED', adminId, { productId: id });

    return updated;
  }

  async deleteProduct(id: string, adminId: string) {
    const product = await this.productRepo.findById(id);
    if (!product) throw AppError.notFound('Produto não encontrado');

    await this.productRepo.softDelete(id);

    await this.auditRepo.create({
      actorId: adminId,
      action: 'DELETE',
      resource: 'Product',
      resourceId: id,
    });

    await cacheDelPattern('products:*');
    logAdmin('PRODUCT_DELETED', adminId, { productId: id });
  }

  // ==========================================
  // VARIANTS
  // ==========================================

  async createVariant(productId: string, input: CreateVariantInput, adminId: string) {
    const product = await this.productRepo.findById(productId);
    if (!product) throw AppError.notFound('Produto não encontrado');

    const existing = await prisma.productVariant.findFirst({
      where: { sku: input.sku, deletedAt: null },
    });
    if (existing) throw AppError.conflict('SKU de variante já cadastrado');

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name: input.name,
        sku: input.sku,
        price: input.price,
        switchType: input.switchType,
        layout: input.layout,
        color: input.color,
        backlight: input.backlight,
        connectivity: input.connectivity,
        weight: input.weight,
        stockQty: input.stockQty,
      },
    });

    await this.auditRepo.create({
      actorId: adminId,
      action: 'CREATE',
      resource: 'ProductVariant',
      resourceId: variant.id,
      newData: { ...input, productId },
    });

    await cacheDelPattern('products:*');
    logAdmin('VARIANT_CREATED', adminId, { variantId: variant.id, productId });

    return variant;
  }

  async updateVariant(variantId: string, input: UpdateVariantInput, adminId: string) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!variant) throw AppError.notFound('Variante não encontrada');

    if (input.sku && input.sku !== variant.sku) {
      const existing = await prisma.productVariant.findFirst({
        where: { sku: input.sku, deletedAt: null },
      });
      if (existing) throw AppError.conflict('SKU já cadastrado');
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: input,
    });

    await this.auditRepo.create({
      actorId: adminId,
      action: 'UPDATE',
      resource: 'ProductVariant',
      resourceId: variantId,
      oldData: { ...variant },
      newData: { ...input },
    });

    await cacheDelPattern('products:*');
    return updated;
  }

  async updateStock(variantId: string, newQty: number, adminId: string, reason?: string) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!variant) throw AppError.notFound('Variante não encontrada');

    const updated = await prisma.$transaction(async (tx) => {
      const updatedVariant = await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQty: newQty },
      });

      await tx.stockLog.create({
        data: {
          variantId,
          previousQty: variant.stockQty,
          newQty,
          changeQty: newQty - variant.stockQty,
          reason,
          reference: adminId,
        },
      });

      return updatedVariant;
    });

    await this.auditRepo.create({
      actorId: adminId,
      action: 'STOCK_UPDATED',
      resource: 'ProductVariant',
      resourceId: variantId,
      oldData: { stockQty: variant.stockQty },
      newData: { stockQty: newQty },
    });

    logAdmin('STOCK_UPDATED', adminId, {
      variantId,
      previousQty: variant.stockQty,
      newQty,
    });

    return updated;
  }
}