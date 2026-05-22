import { z } from 'zod';

export const addCartItemSchema = z.object({
  variantId: z.string().uuid('ID de variante inválido'),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1').max(99, 'Quantidade máxima é 99'),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;