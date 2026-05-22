import { z } from 'zod';

export const createProductSchema = z.object({
  categoryId: z.string().uuid('ID de categoria inválido'),
  name: z.string().min(2).max(200).trim(),
  description: z.string().max(10000).optional(),
  brand: z.string().max(100).trim().optional(),
  sku: z.string().min(1).max(50).trim(),
  basePrice: z.number().positive('Preço deve ser positivo').multipleOf(0.01),
  salePrice: z.number().positive().multipleOf(0.01).optional(),
  isFeatured: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  metaTitle: z.string().max(70).optional(),
  metaDesc: z.string().max(160).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createVariantSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  sku: z.string().min(1).max(50).trim(),
  price: z.number().positive().multipleOf(0.01).optional(),
  switchType: z.string().max(50).optional(),
  layout: z.enum(['Full', 'TKL', '75%', '65%', '60%', '40%', 'Custom']).optional(),
  color: z.string().max(50).optional(),
  backlight: z.enum(['RGB', 'Single', 'None']).optional(),
  connectivity: z.enum(['Wired', 'Wireless', 'Bluetooth', 'Wired+Wireless']).optional(),
  weight: z.number().positive().optional(),
  stockQty: z.number().int().min(0).default(0),
});

export const updateVariantSchema = createVariantSchema.partial();

export const productQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  switchType: z.string().optional(),
  layout: z.string().optional(),
  brand: z.string().optional(),
  isFeatured: z.string().optional(),
  sortBy: z.enum(['name', 'price', 'createdAt', 'salePrice']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;