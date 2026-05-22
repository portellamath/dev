import { Request } from 'express';
import { Role } from '@prisma/client';

// ==========================================
// AUTH TYPES
// ==========================================

export interface JwtAccessPayload {
  sub: string;    // userId
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;    // userId
  tokenId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}

// ==========================================
// PAGINATION
// ==========================================

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ==========================================
// API RESPONSE
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]> | string[];
  code?: string;
}

// ==========================================
// UPLOAD
// ==========================================

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

export interface ProcessedImage {
  url: string;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

// ==========================================
// FILTERS
// ==========================================

export interface ProductFilters {
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  switchType?: string;
  layout?: string;
  brand?: string;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface OrderFilters {
  userId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}