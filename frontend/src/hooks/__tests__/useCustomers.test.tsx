/**
 * Tests for useCustomers hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../useCustomers';
import { customersApi } from '../../services/api';
import { customerStorage } from '../../services/localStorageService';
import type { ReactNode } from 'react';

// Mock dependencies
jest.mock('../../services/api');
jest.mock('../../services/localStorageService');
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Test data
const mockCustomers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '(555) 123-4567',
    address: '123 Main St, City, ST 12345',
    customerType: 'current' as const,
    reference: 'Website',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '(555) 987-6543',
    address: '456 Oak Ave, Town, ST 67890',
    customerType: 'lead' as const,
    reference: 'Referral',
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02',
  },
];

// Create wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useCustomers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (customersApi.getAll as jest.Mock).mockResolvedValue({ data: mockCustomers });
    (customerStorage.getCustomers as jest.Mock).mockReturnValue([]);
    (customerStorage.setCustomers as jest.Mock).mockImplementation(() => {});
  });

  it('should fetch customers successfully', async () => {
    const { result } = renderHook(() => useCustomers(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCustomers);
    expect(customersApi.getAll).toHaveBeenCalledTimes(1);
    expect(customerStorage.setCustomers).toHaveBeenCalledWith(mockCustomers);
  });

  it('should filter customers by type', async () => {
    const { result } = renderHook(
      () => useCustomers({ customerType: 'current', searchTerm: '', sortBy: 'name', sortOrder: 'asc' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].customerType).toBe('current');
  });

  it('should search customers by term', async () => {
    const { result } = renderHook(
      () => useCustomers({ customerType: 'all', searchTerm: 'jane', sortBy: 'name', sortOrder: 'asc' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe('Jane Smith');
  });

  it('should fall back to local storage on API error', async () => {
    (customersApi.getAll as jest.Mock).mockRejectedValue(new Error('Network error'));
    (customerStorage.getCustomers as jest.Mock).mockReturnValue(mockCustomers);

    const { result } = renderHook(() => useCustomers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCustomers);
    expect(customerStorage.getCustomers).toHaveBeenCalled();
  });
});

describe('useCreateCustomer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create customer successfully', async () => {
    const newCustomer = {
      name: 'New Customer',
      email: 'new@example.com',
      phone: '(555) 000-0000',
      address: '789 New St, City, ST 11111',
      customerType: 'lead' as const,
      reference: 'Website',
    };

    const createdCustomer = { ...newCustomer, id: '3', createdAt: '2024-01-03', updatedAt: '2024-01-03' };
    (customersApi.create as jest.Mock).mockResolvedValue({ data: createdCustomer });

    const { result } = renderHook(() => useCreateCustomer(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(newCustomer);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(customersApi.create).toHaveBeenCalledWith(newCustomer);
    expect(toast.success).toHaveBeenCalledWith('Customer created successfully');
  });

  it('should handle creation error', async () => {
    const error = new Error('Creation failed');
    (customersApi.create as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCreateCustomer(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync({} as any)).rejects.toThrow();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to create customer');
  });
});

describe('useUpdateCustomer', () => {
  it('should update customer successfully', async () => {
    const updateData = {
      id: '1',
      name: 'John Doe Updated',
      email: 'john.updated@example.com',
    };

    const updatedCustomer = { ...mockCustomers[0], ...updateData };
    (customersApi.update as jest.Mock).mockResolvedValue({ data: updatedCustomer });

    const { result } = renderHook(() => useUpdateCustomer(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(updateData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(customersApi.update).toHaveBeenCalledWith('1', { name: 'John Doe Updated', email: 'john.updated@example.com' });
    expect(toast.success).toHaveBeenCalledWith('Customer updated successfully');
  });
});

describe('useDeleteCustomer', () => {
  it('should delete customer successfully', async () => {
    (customersApi.delete as jest.Mock).mockResolvedValue({});

    const { result } = renderHook(() => useDeleteCustomer(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync('1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(customersApi.delete).toHaveBeenCalledWith('1');
    expect(toast.success).toHaveBeenCalledWith('Customer deleted successfully');
  });
});