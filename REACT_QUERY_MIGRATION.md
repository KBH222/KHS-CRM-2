# React Query Migration Guide

## Setup Instructions

### 1. Install Dependencies
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### 2. Update App.tsx
```tsx
import { QueryProvider } from './providers/QueryProvider';
import { ToastContainer } from 'react-toastify';

function App() {
  return (
    <QueryProvider>
      {/* Your existing app content */}
      <Router>
        {/* Routes */}
      </Router>
      <ToastContainer />
    </QueryProvider>
  );
}
```

## Migration Examples

### Before: Direct API Calls in CustomersEnhanced.tsx
```tsx
// Old approach
const [customers, setCustomers] = useState<any[]>([]);
const [isLoading, setIsLoading] = useState(true);

const loadCustomers = async () => {
  try {
    setIsLoading(true);
    const response = await customersApi.getAll();
    setCustomers(response.data || []);
  } catch (error) {
    console.error('Failed to load customers:', error);
    const localCustomers = customerStorage.getCustomers();
    setCustomers(localCustomers);
  } finally {
    setIsLoading(false);
  }
};

useEffect(() => {
  loadCustomers();
}, []);
```

### After: Using React Query Hooks
```tsx
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks';
import { CustomerFilters } from '../types';

const CustomersEnhanced = () => {
  const [filters, setFilters] = useState<CustomerFilters>({
    customerType: 'all',
    searchTerm: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Fetch customers with automatic caching and refetching
  const { 
    data: customers = [], 
    isLoading, 
    error,
    refetch 
  } = useCustomers(filters);

  // Mutation hooks
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  // Handle add customer
  const handleAddCustomer = async (newCustomer: CreateCustomerDTO) => {
    try {
      await createCustomer.mutateAsync(newCustomer);
      // Success toast is handled in the hook
      setShowModal(false);
    } catch (error) {
      // Error toast is handled in the hook
    }
  };

  // Handle update customer
  const handleEditCustomer = async (updatedCustomer: UpdateCustomerDTO) => {
    try {
      await updateCustomer.mutateAsync(updatedCustomer);
      setShowModal(false);
    } catch (error) {
      // Error handling in hook
    }
  };

  // Handle delete customer
  const handleDeleteCustomer = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      deleteCustomer.mutate(id);
    }
  };

  // Rest of component...
};
```

### Before: Job Management
```tsx
// Old approach in component
const [jobs, setJobs] = useState([]);

const loadJobs = async (customerId) => {
  try {
    const response = await jobsApi.getByCustomerId(customerId);
    setJobs(response.data || []);
  } catch (error) {
    console.error('Failed to load jobs:', error);
  }
};

const handleSaveJob = async (jobData) => {
  try {
    if (jobData.id) {
      const updated = await jobsApi.update(jobData.id, jobData);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
    } else {
      const created = await jobsApi.create(jobData);
      setJobs([...jobs, created]);
    }
    toast.success('Job saved successfully');
  } catch (error) {
    toast.error('Failed to save job');
  }
};
```

### After: Using Job Hooks
```tsx
import { useJobs, useCreateJob, useUpdateJob, useJobPhotos } from '../hooks';

const CustomerJobs = ({ customerId }) => {
  // Fetch jobs for customer
  const { data: jobs = [], isLoading } = useJobs(customerId);
  
  // Mutations
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const { addPhotos, removePhoto } = useJobPhotos(jobId);

  const handleSaveJob = async (jobData: CreateJobDTO | UpdateJobDTO) => {
    if ('id' in jobData) {
      await updateJob.mutateAsync(jobData);
    } else {
      await createJob.mutateAsync(jobData);
    }
    // Success/error handling is in the hooks
  };

  const handleAddPhotos = async (files: File[]) => {
    const photos = await processFiles(files);
    await addPhotos.mutateAsync(photos);
  };

  // Component render...
};
```

## Benefits of React Query

1. **Automatic Caching**: Data is cached and reused across components
2. **Background Refetching**: Keeps data fresh automatically
3. **Optimistic Updates**: UI updates immediately while API calls happen
4. **Error Handling**: Centralized error handling with retry logic
5. **Loading States**: Built-in loading and error states
6. **Deduplication**: Multiple components can request same data without duplicate API calls

## Advanced Features

### Prefetching
```tsx
import { prefetchCustomers, prefetchCustomerDetails } from '../lib/queryClient';

// Prefetch on route change
const handleNavigateToCustomers = async () => {
  await prefetchCustomers();
  navigate('/customers');
};

// Prefetch on hover
const handleMouseEnter = async (customerId: string) => {
  await prefetchCustomerDetails(customerId);
};
```

### Optimistic Updates
```tsx
const updateCustomer = useUpdateCustomer();

// The hook already handles optimistic updates
// UI updates immediately, rolls back on error
```

### Infinite Queries (for pagination)
```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['customers', 'infinite'],
  queryFn: ({ pageParam = 0 }) => customersApi.getPage(pageParam, 20),
  getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
});
```

## Next Steps

1. Replace all direct API calls with React Query hooks
2. Remove local state management for server data
3. Add error boundaries for better error handling
4. Implement loading skeletons using the loading states
5. Add offline support with React Query persistence