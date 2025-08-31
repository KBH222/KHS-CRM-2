/**
 * useCustomers Hook
 * 
 * Manages customer data fetching, caching, and CRUD operations.
 * Uses React Query for server state management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { customersApi } from '../services/api';
import { Customer, CreateCustomerDTO, UpdateCustomerDTO, CustomerFilters } from '../types';
import { customerStorage } from '../services/localStorageService';

// Query keys
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: CustomerFilters) => [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

/**
 * Hook for fetching all customers with optional filtering
 */
export function useCustomers(filters?: CustomerFilters) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: customerKeys.list(filters || { customerType: 'all', searchTerm: '', sortBy: 'createdAt', sortOrder: 'desc' }),
    queryFn: async () => {
      try {
        const response = await customersApi.getAll();
        let customers = response.data || [];

        // Apply filters if provided
        if (filters) {
          // Filter by customer type
          if (filters.customerType !== 'all') {
            customers = customers.filter(c => c.customerType === filters.customerType);
          }

          // Filter by search term
          if (filters.searchTerm) {
            const search = filters.searchTerm.toLowerCase();
            customers = customers.filter(c => 
              c.name.toLowerCase().includes(search) ||
              c.email.toLowerCase().includes(search) ||
              c.phone.includes(search) ||
              c.address.toLowerCase().includes(search)
            );
          }

          // Sort customers
          customers.sort((a, b) => {
            const aValue = a[filters.sortBy];
            const bValue = b[filters.sortBy];
            const modifier = filters.sortOrder === 'asc' ? 1 : -1;
            
            if (aValue < bValue) return -1 * modifier;
            if (aValue > bValue) return 1 * modifier;
            return 0;
          });
        }

        // Update local storage
        customerStorage.setCustomers(customers);
        
        return customers;
      } catch (error) {
        // Fallback to local storage if API fails
        const localCustomers = customerStorage.getCustomers();
        if (localCustomers.length > 0) {
          return localCustomers;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching a single customer by ID
 */
export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: customerKeys.detail(customerId),
    queryFn: async () => {
      const response = await customersApi.getById(customerId);
      return response.data;
    },
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for creating a new customer
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerData: CreateCustomerDTO) => {
      const response = await customersApi.create(customerData);
      return response.data;
    },
    onSuccess: (newCustomer) => {
      // Invalidate and refetch customers list
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      
      // Optimistically update the cache
      queryClient.setQueryData<Customer[]>(
        customerKeys.lists(),
        (old = []) => [...old, newCustomer]
      );

      toast.success('Customer created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create customer');
    },
  });
}

/**
 * Hook for updating an existing customer
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCustomerDTO) => {
      const { id, ...updateData } = data;
      const response = await customersApi.update(id, updateData);
      return response.data;
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: customerKeys.detail(data.id) });

      // Snapshot previous value
      const previousCustomer = queryClient.getQueryData(customerKeys.detail(data.id));

      // Optimistically update
      queryClient.setQueryData(customerKeys.detail(data.id), (old: any) => ({
        ...old,
        ...data,
      }));

      return { previousCustomer };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousCustomer) {
        queryClient.setQueryData(
          customerKeys.detail(variables.id),
          context.previousCustomer
        );
      }
      toast.error(error.response?.data?.message || 'Failed to update customer');
    },
    onSuccess: (data, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success('Customer updated successfully');
    },
  });
}

/**
 * Hook for deleting a customer
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      await customersApi.delete(customerId);
      return customerId;
    },
    onMutate: async (customerId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData<Customer[]>(customerKeys.lists());

      // Optimistically remove from list
      queryClient.setQueryData<Customer[]>(
        customerKeys.lists(),
        (old = []) => old.filter(c => c.id !== customerId)
      );

      return { previousCustomers };
    },
    onError: (error: any, customerId, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(customerKeys.lists(), context.previousCustomers);
      }
      toast.error(error.response?.data?.message || 'Failed to delete customer');
    },
    onSuccess: (customerId) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.removeQueries({ queryKey: customerKeys.detail(customerId) });
      
      // Update local storage
      const customers = customerStorage.getCustomers();
      customerStorage.setCustomers(customers.filter(c => c.id !== customerId));
      
      toast.success('Customer deleted successfully');
    },
  });
}

/**
 * Hook for bulk operations on customers
 */
export function useCustomerBulkActions() {
  const queryClient = useQueryClient();

  const bulkDelete = useMutation({
    mutationFn: async (customerIds: string[]) => {
      await Promise.all(customerIds.map(id => customersApi.delete(id)));
      return customerIds;
    },
    onSuccess: (customerIds) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      customerIds.forEach(id => {
        queryClient.removeQueries({ queryKey: customerKeys.detail(id) });
      });
      toast.success(`${customerIds.length} customers deleted successfully`);
    },
    onError: () => {
      toast.error('Failed to delete some customers');
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ customerIds, updates }: { customerIds: string[]; updates: Partial<Customer> }) => {
      await Promise.all(
        customerIds.map(id => customersApi.update(id, updates))
      );
      return { customerIds, updates };
    },
    onSuccess: ({ customerIds }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      customerIds.forEach(id => {
        queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
      });
      toast.success(`${customerIds.length} customers updated successfully`);
    },
    onError: () => {
      toast.error('Failed to update some customers');
    },
  });

  return { bulkDelete, bulkUpdate };
}