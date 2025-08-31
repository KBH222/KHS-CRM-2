/**
 * Central export for all TypeScript type definitions
 */

export * from './customer';
export * from './job';

// Common types used across the application
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}