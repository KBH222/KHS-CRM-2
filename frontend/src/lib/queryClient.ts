/**
 * React Query Client Configuration
 * 
 * Sets up the query client with optimized defaults for the CRM application.
 */

import { QueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

// Default error handler
const queryErrorHandler = (error: unknown) => {
  const message = error instanceof Error 
    ? error.message 
    : 'An error occurred while fetching data';
  
  // Only show error toast for non-404 errors
  if (error instanceof Error && !error.message.includes('404')) {
    toast.error(message);
  }
};

// Create query client with custom defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long before data is considered stale
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Cache time: how long to keep data in cache after component unmounts
      cacheTime: 10 * 60 * 1000, // 10 minutes
      
      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus
      refetchOnWindowFocus: false,
      
      // Refetch on network reconnect
      refetchOnReconnect: 'always',
      
      // Error handler
      onError: queryErrorHandler,
    },
    mutations: {
      // Error handler for mutations
      onError: queryErrorHandler,
      
      // Retry configuration for mutations
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Prefetch helpers
export const prefetchCustomers = async () => {
  await queryClient.prefetchQuery({
    queryKey: ['customers', 'list'],
    queryFn: async () => {
      const { customersApi } = await import('../services/api');
      const response = await customersApi.getAll();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const prefetchCustomerDetails = async (customerId: string) => {
  await queryClient.prefetchQuery({
    queryKey: ['customers', 'detail', customerId],
    queryFn: async () => {
      const { customersApi } = await import('../services/api');
      const response = await customersApi.getById(customerId);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Cache management utilities
export const invalidateCustomerQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['customers'] });
};

export const invalidateJobQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['jobs'] });
};

export const clearAllCaches = () => {
  queryClient.clear();
};