/**
 * Customer type definitions for KHS CRM
 */

export type CustomerType = 'lead' | 'current';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  reference: string;
  customerType: CustomerType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerDTO {
  name: string;
  email: string;
  phone: string;
  address: string;
  reference: string;
  customerType: CustomerType;
  notes?: string;
}

export interface UpdateCustomerDTO extends Partial<CreateCustomerDTO> {
  id: string;
}

export interface CustomerFilters {
  customerType: 'all' | CustomerType;
  searchTerm: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}