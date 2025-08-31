/**
 * CustomerFilters Component
 * 
 * Provides filtering and sorting options for customer lists.
 */

import React from 'react';
import { CustomerType } from '../../types';

interface CustomerFiltersProps {
  customerType: CustomerType | 'all';
  onCustomerTypeChange: (type: CustomerType | 'all') => void;
  sortBy: 'name' | 'reference' | 'recent';
  onSortChange: (sort: 'name' | 'reference' | 'recent') => void;
  style?: React.CSSProperties;
}

interface FilterOption {
  value: CustomerType | 'all';
  label: string;
  color: string;
}

interface SortOption {
  value: 'name' | 'reference' | 'recent';
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Customers', color: '#3B82F6' },
  { value: 'current', label: 'Current', color: '#10B981' },
  { value: 'lead', label: 'Leads', color: '#F59E0B' },
];

const SORT_OPTIONS: SortOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'reference', label: 'Reference' },
  { value: 'recent', label: 'Recent' },
];

export const CustomerFilters: React.FC<CustomerFiltersProps> = ({
  customerType,
  onCustomerTypeChange,
  sortBy,
  onSortChange,
  style
}) => {
  return (
    <div style={style}>
      {/* Customer Type Filter */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '32px', 
        marginBottom: '24px',
        flexWrap: 'wrap' 
      }}>
        {FILTER_OPTIONS.map((option) => (
          <label
            key={option.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#374151',
              fontWeight: customerType === option.value ? '600' : '400',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (customerType !== option.value) {
                e.currentTarget.style.color = option.color;
              }
            }}
            onMouseLeave={(e) => {
              if (customerType !== option.value) {
                e.currentTarget.style.color = '#374151';
              }
            }}
          >
            <input
              type="radio"
              name="customerType"
              checked={customerType === option.value}
              onChange={() => onCustomerTypeChange(option.value)}
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: option.color
              }}
            />
            <span>{option.label}</span>
            {customerType === option.value && (
              <span
                style={{
                  marginLeft: '8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: option.color,
                  display: 'inline-block'
                }}
              />
            )}
          </label>
        ))}
      </div>

      {/* Sort Options */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: '#6B7280', marginRight: '8px' }}>
          Sort by:
        </span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onSortChange(option.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: sortBy === option.value ? '#3B82F6' : '#E5E7EB',
              color: sortBy === option.value ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16.1px',
              transition: 'all 0.2s',
              fontWeight: sortBy === option.value ? '500' : '400'
            }}
            onMouseEnter={(e) => {
              if (sortBy !== option.value) {
                e.currentTarget.style.backgroundColor = '#D1D5DB';
              }
            }}
            onMouseLeave={(e) => {
              if (sortBy !== option.value) {
                e.currentTarget.style.backgroundColor = '#E5E7EB';
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};