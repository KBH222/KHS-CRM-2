# KHS CRM Refactoring Plan

## Overview
The codebase needs significant refactoring to improve maintainability, readability, and performance. The main issues identified:
- Very large component files (CustomersEnhanced.tsx has 2832 lines)
- Duplicate code patterns
- Mixed concerns (UI, business logic, API calls in same components)
- Inconsistent naming conventions
- Lack of proper TypeScript types

## Phase 1: Code Organization & Structure

### 1.1 Directory Structure Improvements
```
frontend/src/
├── components/
│   ├── common/           # Reusable UI components
│   ├── customers/        # Customer-specific components
│   ├── jobs/            # Job-specific components
│   ├── forms/           # Form components
│   └── modals/          # Modal components
├── hooks/               # Custom React hooks
├── services/
│   ├── api/            # API service layer
│   └── storage/        # Local storage services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── constants/          # App constants
└── pages/              # Page components (containers)
```

### 1.2 Component Extraction from CustomersEnhanced.tsx
- Extract AddJobModal into separate component
- Extract CustomerCard into separate component
- Extract CustomerFilters into separate component
- Extract SearchBar into separate component
- Extract JobList into separate component

## Phase 2: Code Quality Improvements

### 2.1 Remove Duplicate Code
- Consolidate multiple phone input components into one
- Merge duplicate AddCustomerModal implementations
- Create shared form validation utilities

### 2.2 Extract Business Logic
- Move API calls to service layer
- Create custom hooks for data fetching
- Separate state management logic

### 2.3 Constants and Configuration
- Extract magic numbers and strings
- Create configuration files
- Define API endpoints in constants

## Phase 3: TypeScript Improvements

### 3.1 Type Definitions
```typescript
// types/customer.ts
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  reference: string;
  customerType: 'lead' | 'current';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// types/job.ts
export interface Job {
  id: string;
  customerId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  photos: Photo[];
  plans: Document[];
  lists?: string;
  notes?: string;
  comments?: Comment[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Phase 4: Performance Optimizations

### 4.1 API Call Optimization
- Implement proper caching
- Add request debouncing
- Use React Query or SWR for data fetching

### 4.2 Component Optimization
- Implement React.memo for expensive components
- Use useMemo and useCallback appropriately
- Lazy load heavy components

## Phase 5: Error Handling & Validation

### 5.1 Global Error Handling
- Create error boundary components
- Implement consistent error messaging
- Add proper form validation

### 5.2 Loading States
- Create consistent loading components
- Implement skeleton screens
- Add proper error recovery

## Implementation Priority

1. **High Priority** (Week 1)
   - Extract components from CustomersEnhanced.tsx
   - Create proper TypeScript types
   - Fix linting errors

2. **Medium Priority** (Week 2)
   - Consolidate duplicate code
   - Implement service layer
   - Add error handling

3. **Low Priority** (Week 3)
   - Performance optimizations
   - Documentation
   - Test coverage

## Estimated Impact
- Code reduction: ~40% fewer lines
- Performance improvement: ~30% faster load times
- Maintainability: Much easier to understand and modify
- Bug reduction: ~50% fewer bugs due to type safety