/**
 * Global Error Handler for React Query
 * 
 * Provides centralized error handling with different strategies based on error type.
 */

import { toast } from 'react-toastify';
import { QueryClient } from '@tanstack/react-query';

// Error types
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Error handler function
export const handleQueryError = (error: unknown, queryClient?: QueryClient) => {
  console.error('Query error:', error);

  // Network errors
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    toast.error('Network connection lost. Please check your internet connection.', {
      toastId: 'network-error',
      autoClose: false,
    });
    return;
  }

  // Authentication errors
  if (error instanceof AuthenticationError || 
      (error instanceof Error && error.message.includes('401'))) {
    toast.error('Your session has expired. Please login again.', {
      toastId: 'auth-error',
    });
    
    // Clear auth state and redirect to login
    if (queryClient) {
      queryClient.clear();
    }
    
    // Redirect to login (adjust based on your routing)
    window.location.href = '/login';
    return;
  }

  // Validation errors
  if (error instanceof ValidationError) {
    toast.error(error.message || 'Please check your input and try again.', {
      toastId: 'validation-error',
    });
    return;
  }

  // API errors with custom messages
  if (error instanceof Error && 'response' in error) {
    const apiError = error as any;
    const message = apiError.response?.data?.message || 
                   apiError.response?.data?.error ||
                   'An error occurred. Please try again.';
    
    // Don't show toast for 404 errors
    if (apiError.response?.status === 404) {
      console.log('Resource not found');
      return;
    }

    toast.error(message, {
      toastId: `api-error-${apiError.response?.status}`,
    });
    return;
  }

  // Generic errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  toast.error(message, {
    toastId: 'generic-error',
  });
};

// Retry logic based on error type
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  // Don't retry authentication errors
  if (error instanceof AuthenticationError || 
      (error instanceof Error && error.message.includes('401'))) {
    return false;
  }

  // Don't retry validation errors
  if (error instanceof ValidationError ||
      (error instanceof Error && error.message.includes('400'))) {
    return false;
  }

  // Don't retry not found errors
  if (error instanceof Error && error.message.includes('404')) {
    return false;
  }

  // Retry network errors up to 3 times
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return failureCount < 3;
  }

  // Retry server errors up to 2 times
  if (error instanceof Error && error.message.includes('5')) {
    return failureCount < 2;
  }

  // Default: retry up to 1 time
  return failureCount < 1;
};

// Optimistic update rollback handler
export const handleOptimisticUpdateError = <T>(
  error: unknown,
  context: { previousData?: T } | undefined,
  rollback: (data: T) => void
) => {
  console.error('Optimistic update failed:', error);
  
  // Rollback to previous data
  if (context?.previousData) {
    rollback(context.previousData);
  }

  // Show user-friendly error message
  if (error instanceof NetworkError) {
    toast.error('Changes could not be saved. They will be synced when connection is restored.', {
      toastId: 'optimistic-update-error',
    });
  } else {
    handleQueryError(error);
  }
};

// Background refetch error handler (silent)
export const handleBackgroundError = (error: unknown) => {
  // Log error but don't show toast for background refetches
  console.warn('Background refetch error:', error);
  
  // Only show toast for critical errors
  if (error instanceof AuthenticationError) {
    handleQueryError(error);
  }
};