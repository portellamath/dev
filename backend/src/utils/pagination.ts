import { PaginationParams, PaginatedResult } from '../types';

export const parsePagination = (
  page?: string | number,
  limit?: string | number,
): PaginationParams => {
  const parsedPage = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
};

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> => {
  const totalPages = Math.ceil(total / params.limit);
  return {
    data,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
};