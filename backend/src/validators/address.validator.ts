import { z } from 'zod';

export const createAddressSchema = z.object({
  label: z.string().max(50).optional(),
  recipientName: z.string().min(2).max(100).trim(),
  zipCode: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  street: z.string().min(2).max(200).trim(),
  number: z.string().min(1).max(10).trim(),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().min(2).max(100).trim(),
  city: z.string().min(2).max(100).trim(),
  state: z.string().length(2, 'Estado deve ter 2 caracteres').toUpperCase(),
  country: z.string().default('BR'),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;