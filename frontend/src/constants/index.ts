/**
 * Application-wide constants
 */

// Customer types
export const CUSTOMER_TYPES = {
  LEAD: 'lead',
  CURRENT: 'current'
} as const;

// Job statuses
export const JOB_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed'
} as const;

// API endpoints
export const API_ENDPOINTS = {
  CUSTOMERS: '/api/customers',
  JOBS: '/api/jobs',
  AUTH: '/api/auth'
} as const;

// UI Constants
export const UI = {
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  IMAGE_COMPRESSION: {
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1080,
    QUALITY: 0.7
  }
} as const;

// Job titles
export const JOB_TITLES = [
  'Kitchen',
  'Bathroom',
  'Flooring',
  'Various Repairs'
] as const;

// File types
export const FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
} as const;