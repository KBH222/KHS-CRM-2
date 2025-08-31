/**
 * CustomersEnhanced Component - Refactored with React Query
 * 
 * This is the main customers page with full CRUD operations.
 * Uses React Query for server state management and custom hooks for business logic.
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ErrorBoundary } from 'react-error-boundary';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Custom hooks
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useJobs,
  useCreateJob,
  useUpdateJob,
  useDeleteJob
} from '../hooks';

// Components
import {
  CustomerCard,
  SearchBar,
  CustomerFilters,
  AddCustomerModal
} from '../components/customers';
import { ScrollablePageContainer } from '../components/ScrollablePageContainer';
import { CustomerSkeleton } from '../components/skeletons/CustomerSkeleton';

// Lazy load heavy components
const AddJobModal = lazy(() => import('../components/jobs/AddJobModal').then(m => ({ default: m.AddJobModal })));

// Types
import { Customer, CustomerType, Job } from '../types';

// Constants
import { CUSTOMER_TYPES } from '../constants';

// Memoized components
const MemoizedCustomerCard = React.memo(CustomerCard);

// Error Fallback Component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ error, resetErrorBoundary }) => (
  <div style={{ 
    padding: '40px', 
    textAlign: 'center', 
    backgroundColor: '#FEE2E2', 
    borderRadius: '8px',
    margin: '20px 0'
  }}>
    <h2 style={{ color: '#DC2626', marginBottom: '16px' }}>Something went wrong</h2>
    <p style={{ marginBottom: '16px', color: '#7F1D1D' }}>{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: '8px 16px',
        backgroundColor: '#DC2626',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
      }}
    >
      Try again
    </button>
  </div>
);

const CustomersEnhanced: React.FC = () => {
  const navigate = useNavigate();

  // Local UI state
  const [customerType, setCustomerType] = useState<CustomerType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'reference' | 'recent'>('recent');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [selectedCustomerForJob, setSelectedCustomerForJob] = useState<Customer | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // React Query hooks
  const { 
    data: customers = [], 
    isLoading, 
    error, 
    refetch 
  } = useCustomers({
    customerType: customerType === 'all' ? customerType : customerType as CustomerType,
    searchTerm,
    sortBy: sortBy === 'recent' ? 'createdAt' : sortBy,
    sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
  });

  // Get all jobs for all customers
  const { data: allJobs = [] } = useJobs();

  // Mutations
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();

  // Computed values
  const customerJobs = useMemo(() => {
    const jobsMap = new Map<string, Job[]>();
    allJobs.forEach(job => {
      const customerJobs = jobsMap.get(job.customerId) || [];
      customerJobs.push(job);
      jobsMap.set(job.customerId, customerJobs);
    });
    return jobsMap;
  }, [allJobs]);

  // Event handlers
  const handleAddCustomer = useCallback(async (customerData: any) => {
    try {
      await createCustomer.mutateAsync(customerData);
      setShowModal(false);
      setEditingCustomer(null);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  }, [createCustomer]);

  const handleEditCustomer = useCallback(async (customerData: any) => {
    if (!editingCustomer?.id) return;
    
    try {
      await updateCustomer.mutateAsync({
        id: editingCustomer.id,
        ...customerData
      });
      setShowModal(false);
      setEditingCustomer(null);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  }, [editingCustomer, updateCustomer]);

  const handleDeleteCustomer = useCallback(async (customerId: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      deleteCustomer.mutate(customerId);
    }
  }, [deleteCustomer]);

  const handleAddJob = useCallback((customer: Customer) => {
    setSelectedCustomerForJob(customer);
    setEditingJob(null);
    setShowAddJobModal(true);
  }, []);

  const handleEditJob = useCallback((customer: Customer, job: Job) => {
    setSelectedCustomerForJob(customer);
    setEditingJob(job);
    setShowAddJobModal(true);
  }, []);

  const handleSaveJob = useCallback(async (jobData: any) => {
    try {
      if (jobData.id) {
        await updateJob.mutateAsync(jobData);
      } else {
        await createJob.mutateAsync({
          ...jobData,
          customerId: selectedCustomerForJob?.id
        });
      }
      setShowAddJobModal(false);
      setSelectedCustomerForJob(null);
      setEditingJob(null);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  }, [createJob, updateJob, selectedCustomerForJob]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    const job = allJobs.find(j => j.id === jobId);
    if (job) {
      deleteJob.mutate({ jobId, customerId: job.customerId });
    }
  }, [allJobs, deleteJob]);

  // Row renderer for virtual scrolling
  const CustomerRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const customer = customers[index];
    const jobs = customerJobs.get(customer.id) || [];

    return (
      <div style={style}>
        <div style={{ padding: '8px' }}>
          <MemoizedCustomerCard
            customer={customer}
            jobs={jobs}
            onEditJob={handleEditJob}
            onDeleteJob={handleDeleteJob}
            onAddJob={handleAddJob}
          />
        </div>
      </div>
    );
  }, [customers, customerJobs, handleEditJob, handleDeleteJob, handleAddJob]);

  // Loading state
  if (isLoading && customers.length === 0) {
    return (
      <ScrollablePageContainer>
        <div style={{ padding: '20px' }}>
          <CustomerSkeleton count={5} />
        </div>
      </ScrollablePageContainer>
    );
  }

  // Error state
  if (error && !customers.length) {
    return (
      <ScrollablePageContainer>
        <ErrorFallback 
          error={error as Error} 
          resetErrorBoundary={() => refetch()} 
        />
      </ScrollablePageContainer>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => refetch()}>
      <ScrollablePageContainer>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
            Customers
            {customers.length > 0 && (
              <span style={{ 
                marginLeft: '12px', 
                fontSize: '20px', 
                color: '#6B7280',
                fontWeight: 'normal'
              }}>
                ({customers.length})
              </span>
            )}
          </h1>
          
          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowModal(true);
            }}
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '18px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
          >
            + Add Customer
          </button>
        </div>

        {/* Filters */}
        <CustomerFilters
          customerType={customerType}
          onCustomerTypeChange={setCustomerType}
          sortBy={sortBy}
          onSortChange={setSortBy}
          style={{ marginBottom: '16px' }}
        />

        {/* Search */}
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search customers..."
          style={{ marginBottom: '16px' }}
        />

        {/* Customer List with Virtual Scrolling */}
        {customers.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6B7280'
          }}>
            {searchTerm 
              ? 'No customers found matching your search.' 
              : 'No customers yet. Add your first customer to get started.'}
          </div>
        ) : (
          <div style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  itemCount={customers.length}
                  itemSize={200} // Approximate height of customer card
                  width={width}
                  overscanCount={3}
                >
                  {CustomerRow}
                </List>
              )}
            </AutoSizer>
          </div>
        )}

        {/* Modals */}
        {showModal && (
          <AddCustomerModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setEditingCustomer(null);
            }}
            onAdd={handleAddCustomer}
            onEdit={handleEditCustomer}
            customer={editingCustomer}
          />
        )}

        {showAddJobModal && selectedCustomerForJob && (
          <Suspense fallback={
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 100
            }}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          }>
            <AddJobModal
              customer={selectedCustomerForJob}
              onClose={() => {
                setShowAddJobModal(false);
                setSelectedCustomerForJob(null);
                setEditingJob(null);
              }}
              onSave={handleSaveJob}
              existingJob={editingJob}
            />
          </Suspense>
        )}
      </ScrollablePageContainer>
    </ErrorBoundary>
  );
};

export default CustomersEnhanced;