/**
 * Cache Management Strategies for React Query
 * 
 * Provides different caching strategies for various data types.
 */

import { QueryClient } from '@tanstack/react-query';
import { customerKeys, jobKeys } from '../hooks';

// Cache time constants (in milliseconds)
export const CACHE_TIMES = {
  // User-specific data
  CUSTOMER_LIST: 5 * 60 * 1000,        // 5 minutes
  CUSTOMER_DETAIL: 10 * 60 * 1000,     // 10 minutes
  JOB_LIST: 5 * 60 * 1000,             // 5 minutes
  JOB_DETAIL: 10 * 60 * 1000,          // 10 minutes
  
  // Reference data (changes rarely)
  SETTINGS: 30 * 60 * 1000,            // 30 minutes
  USER_PROFILE: 15 * 60 * 1000,        // 15 minutes
  
  // Real-time data
  NOTIFICATIONS: 1 * 60 * 1000,        // 1 minute
  SYNC_STATUS: 30 * 1000,              // 30 seconds
} as const;

// Stale time constants
export const STALE_TIMES = {
  CUSTOMER_LIST: 2 * 60 * 1000,        // 2 minutes
  CUSTOMER_DETAIL: 5 * 60 * 1000,      // 5 minutes
  JOB_LIST: 2 * 60 * 1000,             // 2 minutes
  JOB_DETAIL: 5 * 60 * 1000,           // 5 minutes
  SETTINGS: 15 * 60 * 1000,            // 15 minutes
  USER_PROFILE: 10 * 60 * 1000,        // 10 minutes
  NOTIFICATIONS: 30 * 1000,             // 30 seconds
  SYNC_STATUS: 10 * 1000,              // 10 seconds
} as const;

// Cache invalidation strategies
export class CacheManager {
  constructor(private queryClient: QueryClient) {}

  // Invalidate all customer-related queries
  invalidateAllCustomers() {
    this.queryClient.invalidateQueries({ queryKey: customerKeys.all });
  }

  // Invalidate specific customer
  invalidateCustomer(customerId: string) {
    // Invalidate detail query
    this.queryClient.invalidateQueries({ 
      queryKey: customerKeys.detail(customerId) 
    });
    
    // Invalidate list queries to ensure consistency
    this.queryClient.invalidateQueries({ 
      queryKey: customerKeys.lists() 
    });
  }

  // Invalidate all job-related queries
  invalidateAllJobs() {
    this.queryClient.invalidateQueries({ queryKey: jobKeys.all });
  }

  // Invalidate jobs for specific customer
  invalidateCustomerJobs(customerId: string) {
    this.queryClient.invalidateQueries({ 
      queryKey: jobKeys.customerJobs(customerId) 
    });
  }

  // Smart invalidation after customer update
  afterCustomerUpdate(customerId: string, updatedData: any) {
    // Update the specific customer in cache
    this.queryClient.setQueryData(
      customerKeys.detail(customerId),
      updatedData
    );
    
    // Invalidate lists to ensure consistency
    this.queryClient.invalidateQueries({ 
      queryKey: customerKeys.lists(),
      exact: false 
    });
  }

  // Smart invalidation after job update
  afterJobUpdate(jobId: string, customerId: string, updatedData: any) {
    // Update the specific job in cache
    this.queryClient.setQueryData(
      jobKeys.detail(jobId),
      updatedData
    );
    
    // Invalidate customer's job list
    this.queryClient.invalidateQueries({ 
      queryKey: jobKeys.customerJobs(customerId) 
    });
    
    // Invalidate all jobs list
    this.queryClient.invalidateQueries({ 
      queryKey: jobKeys.lists() 
    });
  }

  // Prefetch related data
  async prefetchRelatedData(customerId: string) {
    // Prefetch customer details
    await this.queryClient.prefetchQuery({
      queryKey: customerKeys.detail(customerId),
      staleTime: STALE_TIMES.CUSTOMER_DETAIL,
    });
    
    // Prefetch customer's jobs
    await this.queryClient.prefetchQuery({
      queryKey: jobKeys.customerJobs(customerId),
      staleTime: STALE_TIMES.JOB_LIST,
    });
  }

  // Garbage collection - remove old cached data
  collectGarbage() {
    const queries = this.queryClient.getQueryCache().getAll();
    const now = Date.now();
    
    queries.forEach(query => {
      const lastUpdated = query.state.dataUpdatedAt;
      const cacheTime = query.meta?.cacheTime || CACHE_TIMES.CUSTOMER_LIST;
      
      // Remove queries that haven't been accessed in 2x cache time
      if (now - lastUpdated > cacheTime * 2) {
        this.queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  }

  // Clear all caches
  clearAll() {
    this.queryClient.clear();
  }

  // Clear specific data type caches
  clearCustomerCaches() {
    this.queryClient.removeQueries({ queryKey: customerKeys.all });
  }

  clearJobCaches() {
    this.queryClient.removeQueries({ queryKey: jobKeys.all });
  }
}

// Background sync manager
export class BackgroundSyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private queryClient: QueryClient,
    private syncIntervalMs: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  start() {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      this.syncInBackground();
    }, this.syncIntervalMs);
    
    // Also sync when coming back online
    window.addEventListener('online', this.handleOnline);
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    window.removeEventListener('online', this.handleOnline);
  }

  private syncInBackground = async () => {
    // Only sync if online
    if (!navigator.onLine) return;
    
    // Refetch active queries
    const queries = this.queryClient.getQueryCache().getAll();
    const activeQueries = queries.filter(q => q.getObserversCount() > 0);
    
    for (const query of activeQueries) {
      // Only refetch if data is stale
      if (query.isStale()) {
        await query.fetch();
      }
    }
  };

  private handleOnline = () => {
    // Invalidate all queries when coming back online
    this.queryClient.invalidateQueries();
  };
}

// Optimistic update helpers
export const createOptimisticUpdate = <T>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updater: (old: T) => T
) => {
  const previousData = queryClient.getQueryData<T>(queryKey);
  
  if (previousData) {
    queryClient.setQueryData<T>(queryKey, updater);
  }
  
  return { previousData };
};

export const rollbackOptimisticUpdate = <T>(
  queryClient: QueryClient,
  queryKey: unknown[],
  context: { previousData?: T }
) => {
  if (context.previousData) {
    queryClient.setQueryData(queryKey, context.previousData);
  }
};