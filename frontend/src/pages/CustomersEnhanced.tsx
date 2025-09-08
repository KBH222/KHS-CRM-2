import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi, jobsApi, authApi } from '../services/api';
import { toast } from 'react-toastify';
import { customerStorage } from '../services/localStorageService';
import { ScrollablePageContainer } from '../components/ScrollablePageContainer';
import { compressImage } from '../utils/imageCompression';
import { enhancedSyncService } from '../services/sync.service.enhanced';
import { geocodingService, AddressSuggestion } from '../services/geocoding.service';
import { useDebounce } from '../hooks/useDebounce';
import { profileStorage } from '../utils/localStorage';

const CustomersEnhanced = () => {
  const navigate = useNavigate();
  
  // Add CSS to hide scrollbars on tabs container and style photos scrollbar
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .tabs-container::-webkit-scrollbar {
        display: none;
      }
      .photos-scroll-container::-webkit-scrollbar {
        width: 6px;
      }
      .photos-scroll-container::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }
      .photos-scroll-container::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
      }
      .photos-scroll-container::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      
      /* Task list animations */
      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      /* Checkbox animations */
      input[type="checkbox"] {
        transition: all 0.2s ease;
      }
      
      input[type="checkbox"]:checked {
        transform: scale(1.1);
      }
      
      /* Task item hover states */
      .task-item:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      /* Mobile optimizations */
      @media (max-width: 768px) {
        .bulk-actions-toolbar {
          flex-direction: column;
          gap: 12px;
        }
        
        .bulk-actions-toolbar > div {
          width: 100%;
          justify-content: center;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // State
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load customers from API
  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      console.log('[loadCustomers] Loading with filter:', customerType);
      const data = await customersApi.getAll(customerType);
      console.log('[loadCustomers] Received customers:', data.length);
      console.log('[loadCustomers] First few customers:', data.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        customerType: c.customerType
      })));
      setCustomers(data);
    } catch (err: any) {
      console.error('[loadCustomers] Error:', err);
      const errorMessage = err.message || 'Failed to load customers';
      toast.error('Failed to load customers: ' + errorMessage);
      // Will fall back to localStorage in the API
    } finally {
      setIsLoading(false);
    }
  };

  // Manual sync function
  const handleManualSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    toast.info('Syncing data with server...');
    
    try {
      const result = await enhancedSyncService.performFullSync();
      if (result.success) {
        const message = `Synced successfully! Pulled: ${result.pulled?.customers || 0} customers, ${result.pulled?.jobs || 0} jobs. Pushed: ${result.pushed?.customers || 0} customers, ${result.pushed?.jobs || 0} jobs.`;
        toast.success(message);
        // Reload customers to show updated data
        await loadCustomers();
      } else {
        toast.error('Sync failed: ' + (result.errors?.join(', ') || 'Unknown error'));
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Sync failed. Will retry automatically when online.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-login and load data on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Always try to auto-login to ensure fresh token
        await authApi.autoLogin();
        await loadCustomers();
      } catch (error) {
        // Still try to load customers - might work with cached data
        await loadCustomers();
      }
    };
    init();
  }, []);

  // Auto-sync every 15 minutes and handle cross-tab synchronization
  useEffect(() => {
    // Function to sync data
    const syncData = () => {
      console.log('[syncData] Loading customers from localStorage');
      const savedCustomers = customerStorage.load();
      
      // Update state with latest data from localStorage
      if (savedCustomers) {
        console.log('[syncData] Found customers in localStorage:', savedCustomers.length);
        console.log('[syncData] First customer type:', savedCustomers[0]?.customerType);
        setCustomers(savedCustomers);
      }
      
      // Auto-sync completed
    };

    // Auto-sync every 15 minutes
    const autoSync = async () => {
      
      // Save current data with timestamp
      customerStorage.save(customers);
      localStorage.setItem('khs-crm-last-sync', new Date().toISOString());
      
      // Trigger actual sync with backend
      try {
        await customersApi.sync();
        // Reload data after sync
        await loadCustomers();
      } catch (error) {
        // Sync failed silently
      }
      
      // Trigger storage event for other tabs
      window.dispatchEvent(new Event('storage'));
      
      syncData();
    };

    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'khs-crm-customers' || e.key === 'khs-crm-jobs' || e.key === 'khs-crm-last-sync') {
        // Storage change detected from another tab
        syncData();
      }
    };

    // Set up 15-minute interval (900000 ms)
    const syncInterval = setInterval(autoSync, 900000);
    
    // Sync when coming online
    const handleOnline = () => {
      autoSync();
    };
    
    // Listen for online event
    window.addEventListener('online', handleOnline);
    
    // Listen for storage events from other tabs
    window.addEventListener('storage', handleStorageChange);

    // Sync immediately on mount
    // TEMPORARILY DISABLED to debug customerType issue
    // syncData();

    // Cleanup
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, reference, recent
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [selectedCustomerForJob, setSelectedCustomerForJob] = useState<any>(null);
  const [editingJob, setEditingJob] = useState<any>(null);
  // Load filter preference from localStorage
  const [customerType, setCustomerType] = useState<'CURRENT' | 'LEADS' | null>(() => {
    const saved = localStorage.getItem('khs-crm-customer-filter');
    if (saved === 'CURRENT' || saved === 'LEADS') return saved;
    return null; // null shows all
  });
  
  // Reload customers when customer type changes
  useEffect(() => {
    if (!isLoading) {
      loadCustomers();
    }
    // Save filter preference
    if (customerType !== null) {
      localStorage.setItem('khs-crm-customer-filter', customerType);
    } else {
      localStorage.removeItem('khs-crm-customer-filter');
    }
  }, [customerType]);

  // Sort customers
  // Helper function to get jobs for a customer
  const getCustomerJobs = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.jobs || [];
  };

  const sortedCustomers = [...customers].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'reference':
        // Define reference order: HOD first, then Yelp, then Cust
        const refOrder: Record<string, number> = { 'HOD': 1, 'Yelp': 2, 'Cust': 3 };
        const aOrder = refOrder[a.reference] || 4; // No reference goes last
        const bOrder = refOrder[b.reference] || 4;
        return aOrder - bOrder;
      case 'recent':
        return b.id.localeCompare(a.id); // Newer IDs are larger
      default:
        return 0;
    }
  });

  // Filter customers
  const filteredCustomers = sortedCustomers.filter(customer => {
    // First filter by search term
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.notes && customer.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Then filter by customer type if selected
    const matchesType = !customerType || customer.customerType === customerType;
    
    return matchesSearch && matchesType;
  });



  const handleAddCustomer = async (newCustomer: any) => {
    try {
      setIsLoading(true);
      console.log('[handleAddCustomer] Starting with data:', newCustomer);
      console.log('[handleAddCustomer] Current customers count:', customers.length);
      console.log('[handleAddCustomer] Current filter:', customerType);
      
      // Don't pass any temp ID - let backend generate the ID
      const customerData = { ...newCustomer };
      delete customerData.id; // Remove any temp ID if present
      
      console.log('[handleAddCustomer] Sending to API:', customerData);
      
      const customer = await customersApi.create(customerData);
      
      console.log('[handleAddCustomer] Received from API:', customer);
      console.log('[handleAddCustomer] Customer ID:', customer.id);
      console.log('[handleAddCustomer] Customer Type:', customer.customerType);
      
      // Validate that we got a real ID back
      if (!customer.id || customer.id.includes('temp')) {
        console.error('[handleAddCustomer] WARNING: Got temp ID or no ID!');
        toast.warning('Customer created but may need to refresh for proper ID');
      }
      
      // Use the server response with REAL ID
      const updatedCustomers = [customer, ...customers];
      console.log('[handleAddCustomer] Updating customers list, new count:', updatedCustomers.length);
      setCustomers(updatedCustomers);
      
      toast.success('Customer added successfully');
      setShowModal(false);
      
      // If the new customer doesn't match current filter, switch to show all
      if (customerType && customer.customerType !== customerType) {
        console.log('[handleAddCustomer] Customer type mismatch, switching to show all');
        setCustomerType(null);
        toast.info('Switched to "All Customers" to show the new customer');
      }
      
      // Force a reload to ensure the customer shows up
      console.log('[handleAddCustomer] Forcing reload of customers');
      setTimeout(() => {
        loadCustomers();
      }, 100);
      
      return customer; // Return customer with real ID
    } catch (err: any) {
      console.error('[handleAddCustomer] Error:', err);
      const errorMessage = err.message || 'Failed to add customer';
      toast.error('Failed to add customer: ' + errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCustomer = async (updatedCustomer: any) => {
    console.log('[handleEditCustomer] Received data:', updatedCustomer);
    console.log('[handleEditCustomer] customerType:', updatedCustomer.customerType);
    
    try {
      setIsLoading(true);
      const customer = await customersApi.update(editingCustomer.id, updatedCustomer);
      console.log('[handleEditCustomer] API response:', customer);
      console.log('[handleEditCustomer] Response customerType:', customer.customerType);
      
      setCustomers(customers.map(c => 
        c.id === customer.id ? customer : c
      ));
      toast.success('Customer updated successfully');
      setEditingCustomer(null);
      setShowModal(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update customer';
      toast.error('Failed to update customer: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        setIsLoading(true);
        await customersApi.delete(id);
        setCustomers(customers.filter(c => c.id !== id));
        toast.success('Customer deleted successfully');
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to delete customer';
        toast.error('Failed to delete customer: ' + errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };


  const handleAddJob = (customer: any) => {
    setSelectedCustomerForJob(customer);
    setShowAddJobModal(true);
  };

  const handleSaveJob = async (jobData: any) => {
    try {
      
      // Validate customer ID first
      const customerId = jobData.customerId || selectedCustomerForJob?.id;
      
      // Check for invalid customer ID (temp IDs)
      if (!customerId || customerId.toString().includes('temp')) {
        toast.error('Cannot save job - customer not properly saved. Please refresh and try again.');
        
        // If we have a temp customer, try to sync first
        if (customerId && customerId.includes('temp')) {
          toast.info('Syncing customer data... Please wait and try again.');
          await customersApi.sync();
        }
        return;
      }
      
      
      // Check if we're updating or creating
      if (editingJob && editingJob.id) {
        // Update existing job
        const updateData = {
          title: jobData.title,
          description: jobData.description || '',
          status: jobData.status,
          priority: jobData.priority,
          startDate: jobData.startDate,
          endDate: jobData.endDate,
          completedDate: jobData.completedDate,
          notes: jobData.notes || '',
          customerId: jobData.customerId || editingJob.customerId,
          photos: jobData.photos || [],
          plans: jobData.plans || [],
          tasks: jobData.tasks || [],
          commentsText: jobData.commentsText || ''
        };
        
        
        try {
          const updatedJob = await jobsApi.update(editingJob.id, updateData);
          
          // Update local state
          setCustomers(prevCustomers => {
            return prevCustomers.map(customer => {
              if (customer.id === updatedJob.customerId) {
                const updatedJobs = customer.jobs ? [...customer.jobs] : [];
                const index = updatedJobs.findIndex(j => j.id === updatedJob.id);
                if (index !== -1) {
                  updatedJobs[index] = updatedJob;
                }
                return { ...customer, jobs: updatedJobs };
              }
              return customer;
            });
          });
          
          // Close modal immediately for better UX
          setShowAddJobModal(false);
          setSelectedCustomerForJob(null);
          setEditingJob(null);
          
          // Show success toast after modal closes
          setTimeout(() => {
            toast.success('Job updated successfully', { autoClose: 2000 });
          }, 100);
        } catch (apiError: any) {
          throw apiError;
        }
      } else if (jobData.id) {
        // Legacy path - update using jobData.id
        const updateData = {
          title: jobData.title,
          description: jobData.description || '',
          status: jobData.status,
          priority: jobData.priority,
          startDate: jobData.startDate,
          endDate: jobData.endDate,
          completedDate: jobData.completedDate,
          notes: jobData.notes || '',
          customerId: jobData.customerId,
          photos: jobData.photos || [],
          plans: jobData.plans || [],
          tasks: jobData.tasks || [],
          commentsText: jobData.commentsText || ''
        };
        
        const updatedJob = await jobsApi.update(jobData.id, updateData);
        
        // Update local state - update the customer's jobs array
        setCustomers(prevCustomers => {
          return prevCustomers.map(customer => {
            if (customer.id === updatedJob.customerId) {
              const updatedJobs = customer.jobs ? [...customer.jobs] : [];
              const jobIndex = updatedJobs.findIndex(j => j.id === updatedJob.id);
              if (jobIndex !== -1) {
                updatedJobs[jobIndex] = updatedJob;
              }
              return { ...customer, jobs: updatedJobs };
            }
            return customer;
          });
        });
        
        // Close modal immediately
        setShowAddJobModal(false);
        setSelectedCustomerForJob(null);
        setEditingJob(null);
        
        // Show success toast after modal closes
        setTimeout(() => {
          toast.success('Job updated successfully', { autoClose: 2000 });
        }, 100);
      } else {
        // Create new job
        
        // Ensure we have a valid customer ID (not temp)
        const customerId = jobData.customerId || selectedCustomerForJob?.id;
        if (!customerId) {
          throw new Error('No customer selected for this job');
        }
        
        // Check for temp customer ID
        if (customerId.toString().includes('temp')) {
          throw new Error('Customer not properly saved - please refresh and try again');
        }
        
        const createPayload = {
          title: jobData.title,
          description: jobData.description || '',
          customerId: customerId,
          status: jobData.status || 'QUOTED',
          priority: jobData.priority || 'medium',
          startDate: jobData.startDate,
          endDate: jobData.endDate,
          notes: jobData.notes || '',
          photos: jobData.photos || [],
          plans: jobData.plans || [],
          tasks: jobData.tasks || [],
          commentsText: jobData.commentsText || ''
        };
        const newJob = await jobsApi.create(createPayload);
        
        // Update local state - add the new job to the customer's jobs array
        setCustomers(prevCustomers => {
          return prevCustomers.map(customer => {
            if (customer.id === customerId) {
              const updatedJobs = customer.jobs ? [...customer.jobs, newJob] : [newJob];
              return { ...customer, jobs: updatedJobs };
            }
            return customer;
          });
        });
        
        // Close modal immediately
        setShowAddJobModal(false);
        setSelectedCustomerForJob(null);
        setEditingJob(null);
        
        // Show success toast after modal closes
        setTimeout(() => {
          toast.success('Job created successfully', { autoClose: 2000 });
        }, 100);
      }
    } catch (err: any) {
      
      // Show more specific error message
      let errorMessage = 'Failed to save job';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.details) {
        errorMessage = err.response.data.details;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
      // Still close modal on error
      setShowAddJobModal(false);
      setSelectedCustomerForJob(null);
      setEditingJob(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await jobsApi.delete(jobId);
      // Update local state - remove the job from the customer's jobs array
      setCustomers(prevCustomers => {
        return prevCustomers.map(customer => {
          if (customer.jobs && customer.jobs.some(j => j.id === jobId)) {
            const updatedJobs = customer.jobs.filter(j => j.id !== jobId);
            return { ...customer, jobs: updatedJobs };
          }
          return customer;
        });
      });
      toast.success('Job deleted successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete job';
      toast.error('Failed to delete job: ' + errorMessage);
    }
  };

  // Click handlers for customer actions
  const handleEmailClick = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `mailto:${email}`;
  };

  const handlePhoneClick = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${phone.replace(/\D/g, '')}`;
  };

  const handleAddressClick = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const encodedAddress = encodeURIComponent(address);
    
    // Get user's navigation preference
    const profile = profileStorage.get();
    const navigationApp = profile?.navigationApp || 'google';
    
    let url;
    if (navigationApp === 'apple') {
      // Apple Maps URL scheme
      url = `maps://maps.apple.com/?q=${encodedAddress}`;
    } else if (navigationApp === 'waze') {
      // Waze URL scheme
      url = `waze://?q=${encodedAddress}`;
    } else {
      // Google Maps (default)
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }
    
    window.open(url, '_blank');
  };

  return (
    <>
      <div style={{ 
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '100px' // Extra padding for iOS scrolling
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6B7280',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 style={{ fontSize: '27.6px', fontWeight: 'bold', margin: 0 }}>
                Customers
              </h1>
            </div>
            <button
              onClick={() => {
                setEditingCustomer(null);
                setShowModal(true);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16.1px',
                fontWeight: '500'
              }}
            >
              + Add Customer
            </button>
          </div>

        {/* Customer Type Selector - Radio Buttons */}
        <div style={{ 
          marginBottom: '16px', 
          display: 'flex', 
          gap: '24px',
          padding: '16px',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px',
          border: '1px solid #E5E7EB'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#374151',
            fontWeight: customerType === null ? '600' : '400'
          }}>
            <input
              type="radio"
              name="customerType"
              checked={customerType === null}
              onChange={() => setCustomerType(null)}
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: '#3B82F6'
              }}
            />
            All Customers
          </label>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#374151',
            fontWeight: customerType === 'CURRENT' ? '600' : '400'
          }}>
            <input
              type="radio"
              name="customerType"
              checked={customerType === 'CURRENT'}
              onChange={() => setCustomerType('CURRENT')}
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: '#3B82F6'
              }}
            />
            Current
          </label>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#374151',
            fontWeight: customerType === 'LEADS' ? '600' : '400'
          }}>
            <input
              type="radio"
              name="customerType"
              checked={customerType === 'LEADS'}
              onChange={() => setCustomerType('LEADS')}
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: '#3B82F6'
              }}
            />
            Leads
          </label>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              fontSize: '18.4px'
            }}
          />
        </div>

        {/* Sort Buttons */}
        <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSortBy('name')}
            style={{
              padding: '6px 12px',
              backgroundColor: sortBy === 'name' ? '#3B82F6' : '#E5E7EB',
              color: sortBy === 'name' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16.1px'
            }}
          >
            Name
          </button>
          <button
            onClick={() => setSortBy('reference')}
            style={{
              padding: '6px 12px',
              backgroundColor: sortBy === 'reference' ? '#3B82F6' : '#E5E7EB',
              color: sortBy === 'reference' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16.1px'
            }}
          >
            Reference
          </button>
          <button
            onClick={() => setSortBy('recent')}
            style={{
              padding: '6px 12px',
              backgroundColor: sortBy === 'recent' ? '#3B82F6' : '#E5E7EB',
              color: sortBy === 'recent' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16.1px'
            }}
          >
            Recent
          </button>
        </div>

        {/* Customer Cards */}
        {isLoading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
            color: '#6B7280'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading customers...</p>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6B7280'
          }}>
            {searchTerm ? 'No customers found matching your search.' : 'No customers yet. Add your first customer to get started.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => navigate(`/customers/${customer.id}`)}
                style={{
                  backgroundColor: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  border: '1px solid #E5E7EB'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '18.4px', fontWeight: '600' }}>{customer.name}</h3>
                      {customer.reference && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: customer.reference === 'HOD' ? '#10B981' : 
                                         customer.reference === 'Yelp' ? '#F59E0B' : '#3B82F6',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: '500'
                        }}>
                          {customer.reference}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <button
                        onClick={(e) => handleEmailClick(customer.email, e)}
                        title="Email customer"
                        style={{ 
                          background: 'none',
                          border: '1px solid #3B82F6',
                          color: '#3B82F6',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '13.8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ✉️ Email
                      </button>
                      <button
                        onClick={(e) => handlePhoneClick(customer.phone, e)}
                        title="Call customer"
                        style={{ 
                          background: 'none',
                          border: '1px solid #3B82F6',
                          color: '#3B82F6',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '13.8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        📞 Call
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `sms:${customer.phone.replace(/\D/g, '')}`;
                        }}
                        title="Text customer"
                        style={{ 
                          background: 'none',
                          border: '1px solid #3B82F6',
                          color: '#3B82F6',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '13.8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        💬 Text
                      </button>
                    </div>
                    <button
                      onClick={(e) => handleAddressClick(customer.address, e)}
                      style={{ 
                        background: 'none',
                        border: 'none',
                        color: '#6B7280',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        padding: '4px 0',
                        font: 'inherit',
                        fontSize: '12.65px',
                        display: 'block',
                        lineHeight: '1.3',
                        textAlign: 'left',
                        marginBottom: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#3B82F6';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#6B7280';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.style.color = '#3B82F6';
                      }}
                    >
                      {(() => {
                        // Split address into street and city/state/zip
                        const parts = customer.address.split(', ');
                        if (parts.length >= 3) {
                          const street = parts[0];
                          const cityStateZip = parts.slice(1).join(', ');
                          return (
                            <>
                              <div>{street}</div>
                              <div>{cityStateZip}</div>
                            </>
                          );
                        }
                        // Fallback for addresses that don't match expected format
                        return customer.address;
                      })()}
                    </button>
                    {customer.notes && (
                      <p style={{ 
                        fontSize: '12.65px', 
                        color: '#9CA3AF',
                        fontStyle: 'italic',
                        margin: '0',
                        lineHeight: '1.3',
                        paddingTop: '4px'
                      }}>
                        {customer.notes}
                      </p>
                    )}
                    
                    {/* Jobs List */}
                    {(() => {
                      const customerJobs = getCustomerJobs(customer.id);
                      if (customerJobs.length > 0) {
                        return (
                          <div style={{ 
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #E5E7EB'
                          }}>
                            <p style={{ 
                              fontSize: '13.8px', 
                              fontWeight: '600',
                              color: '#374151',
                              marginBottom: '8px'
                            }}>
                              Jobs ({customerJobs.length}):
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {customerJobs.map((job: any) => (
                                <div
                                  key={job.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomerForJob(customer);
                                      setEditingJob(job);  // Make sure this has the full job object with ID
                                      setShowAddJobModal(true);
                                    }}
                                    style={{
                                      width: '140px',
                                      background: 'none',
                                      border: '1px solid #D1D5DB',
                                      borderRadius: '4px',
                                      padding: '6px 8px',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '12.65px',
                                      color: '#374151',
                                      transition: 'all 0.2s',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                                      e.currentTarget.style.borderColor = '#3B82F6';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.borderColor = '#D1D5DB';
                                    }}
                                  >
                                    <div style={{ 
                                      fontWeight: '500',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>{job.title}</div>
                                    {job.startDate && (
                                      <div style={{ 
                                        color: '#6B7280', 
                                        fontSize: '11.5px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {new Date(job.startDate).toLocaleDateString()}
                                      </div>
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`Are you sure you want to delete the job "${job.title}"?`)) {
                                        handleDeleteJob(job.id);
                                      }
                                    }}
                                    style={{
                                      background: '#DC2626',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '24px',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: 'bold',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#B91C1C';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#DC2626';
                                    }}
                                    title="Delete job"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCustomer(customer);
                        setShowModal(true);
                      }}
                      style={{
                        padding: '4px 12px',
                        fontSize: '13.8px',
                        backgroundColor: '#E5E7EB',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomer(customer.id);
                      }}
                      style={{
                        padding: '4px 12px',
                        fontSize: '13.8px',
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddJob(customer);
                      }}
                      style={{
                        padding: '4px 12px',
                        fontSize: '13.8px',
                        backgroundColor: '#10B981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '16.1px' }}>+</span> Add Job
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Customer Modal */}
    {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => {
            setShowModal(false);
            setEditingCustomer(null);
          }}
          onSave={editingCustomer ? handleEditCustomer : handleAddCustomer}
        />
    )}

    {/* Add Job Modal */}
    {showAddJobModal && selectedCustomerForJob && (
        <AddJobModal
          customer={selectedCustomerForJob}
          existingJob={editingJob}
          onClose={() => {
            setShowAddJobModal(false);
            setSelectedCustomerForJob(null);
            setEditingJob(null);
          }}
          onSave={handleSaveJob}
          onDelete={handleDeleteJob}
          onJobUpdate={(updatedJob) => {
            // Update the editing job with latest data
            setEditingJob(updatedJob);
            // Also update in the customer jobs list
            setCustomers(prevCustomers => {
              return prevCustomers.map(customer => {
                if (customer.id === updatedJob.customerId) {
                  const updatedJobs = customer.jobs ? [...customer.jobs] : [];
                  const jobIndex = updatedJobs.findIndex(j => j.id === updatedJob.id);
                  if (jobIndex !== -1) {
                    // Update existing job
                    updatedJobs[jobIndex] = updatedJob;
                  } else {
                    // Add new job if it doesn't exist (created via photo upload)
                    updatedJobs.push(updatedJob);
                  }
                  return { ...customer, jobs: updatedJobs };
                }
                return customer;
              });
            });
          }}
        />
    )}
    </>
  );
};

// Customer Modal Component
interface CustomerModalProps {
  customer: any;
  onClose: () => void;
  onSave: (customer: any) => void;
}

const CustomerModal = ({ customer, onClose, onSave }: CustomerModalProps) => {
  console.log('[CustomerModal] Initializing with customer:', customer);
  console.log('[CustomerModal] Customer customerType:', customer?.customerType);
  
  const [formData, setFormData] = useState({
    reference: customer?.reference || '',
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    street: '',
    city: '',
    state: '',
    zip: '',
    notes: customer?.notes || '',
    customerType: customer?.customerType || 'CURRENT'
  });
  
  console.log('[CustomerModal] Initial formData customerType:', formData.customerType);

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Debounce the street input for API calls
  const debouncedStreet = useDebounce(formData.street, 500);

  // Parse address if editing
  useEffect(() => {
    if (customer?.address) {
      // Simple address parsing - in a real app, you'd use a proper address parser
      const parts = customer.address.split(', ');
      if (parts.length >= 3) {
        const [street, city, stateZip] = parts;
        const stateZipParts = stateZip.split(' ');
        setFormData(prev => ({
          ...prev,
          street,
          city,
          state: stateZipParts[0] || '',
          zip: stateZipParts[1] || ''
        }));
      }
    }
  }, [customer]);

  // Mock address database for auto-completion - Hawaii/Oahu focused
  const addressDatabase: Record<string, { city: string; state: string; zip: string }> = {
    // Honolulu addresses
    '350 ward ave': { city: 'Honolulu', state: 'HI', zip: '96814' },
    '1717 ala wai blvd': { city: 'Honolulu', state: 'HI', zip: '96815' },
    '1188 bishop st': { city: 'Honolulu', state: 'HI', zip: '96813' },
    '1450 ala moana blvd': { city: 'Honolulu', state: 'HI', zip: '96814' },
    '2005 kalia rd': { city: 'Honolulu', state: 'HI', zip: '96815' },
    // Pearl City addresses
    '850 kamehameha hwy': { city: 'Pearl City', state: 'HI', zip: '96782' },
    '1000 kamehameha hwy': { city: 'Pearl City', state: 'HI', zip: '96782' },
    // Kailua addresses  
    '600 kailua rd': { city: 'Kailua', state: 'HI', zip: '96734' },
    '45 kainehe st': { city: 'Kailua', state: 'HI', zip: '96734' },
    // Kaneohe addresses
    '45-939 kamehameha hwy': { city: 'Kaneohe', state: 'HI', zip: '96744' },
    '46-001 kamehameha hwy': { city: 'Kaneohe', state: 'HI', zip: '96744' },
    // Aiea addresses
    '99-115 aiea heights dr': { city: 'Aiea', state: 'HI', zip: '96701' },
    '98-1005 moanalua rd': { city: 'Aiea', state: 'HI', zip: '96701' },
  };

  // Zip code database for auto-population - Hawaii/Oahu focused
  const zipCodeDatabase: Record<string, { city: string; state: string }> = {
    // Honolulu zip codes
    '96813': { city: 'Honolulu', state: 'HI' },
    '96814': { city: 'Honolulu', state: 'HI' },
    '96815': { city: 'Honolulu', state: 'HI' },
    '96816': { city: 'Honolulu', state: 'HI' },
    '96817': { city: 'Honolulu', state: 'HI' },
    '96818': { city: 'Honolulu', state: 'HI' },
    '96819': { city: 'Honolulu', state: 'HI' },
    '96820': { city: 'Honolulu', state: 'HI' },
    '96821': { city: 'Honolulu', state: 'HI' },
    '96822': { city: 'Honolulu', state: 'HI' },
    '96825': { city: 'Honolulu', state: 'HI' },
    '96826': { city: 'Honolulu', state: 'HI' },
    // Other Oahu cities
    '96701': { city: 'Aiea', state: 'HI' },
    '96706': { city: 'Ewa Beach', state: 'HI' },
    '96707': { city: 'Kapolei', state: 'HI' },
    '96712': { city: 'Haleiwa', state: 'HI' },
    '96717': { city: 'Hauula', state: 'HI' },
    '96730': { city: 'Kaaawa', state: 'HI' },
    '96731': { city: 'Kahuku', state: 'HI' },
    '96734': { city: 'Kailua', state: 'HI' },
    '96744': { city: 'Kaneohe', state: 'HI' },
    '96759': { city: 'Kunia', state: 'HI' },
    '96762': { city: 'Laie', state: 'HI' },
    '96782': { city: 'Pearl City', state: 'HI' },
    '96786': { city: 'Wahiawa', state: 'HI' },
    '96789': { city: 'Mililani', state: 'HI' },
    '96791': { city: 'Waialua', state: 'HI' },
    '96792': { city: 'Waianae', state: 'HI' },
    '96795': { city: 'Waimanalo', state: 'HI' },
    '96797': { city: 'Waipahu', state: 'HI' }
  };

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length === 0) return '';
    if (phoneNumber.length <= 3) return `(${phoneNumber}`;
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    if (formatted.length <= 14) {
      setFormData({ ...formData, phone: formatted });
    }
  };

  // Fetch address suggestions when street input changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedStreet.length < 3) {
        setAddressSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const suggestions = await geocodingService.searchAddresses(debouncedStreet);
        setAddressSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
        setSelectedSuggestionIndex(-1);
      } catch (error) {
        console.error('Error fetching address suggestions:', error);
        // Fall back to local database
        const normalizedStreet = debouncedStreet.toLowerCase().trim();
        const addressInfo = addressDatabase[normalizedStreet];
        if (addressInfo) {
          setFormData(prev => ({
            ...prev,
            city: addressInfo.city,
            state: addressInfo.state,
            zip: addressInfo.zip
          }));
        }
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedStreet]);

  // Handle clicking outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, street: value });
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setFormData({
      ...formData,
      street: suggestion.formatted.street,
      city: suggestion.formatted.city,
      state: suggestion.formatted.state,
      zip: suggestion.formatted.zip
    });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || addressSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < addressSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSelectSuggestion(addressSuggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, zip: value });
    
    if (value.length === 5) {
      const zipInfo = zipCodeDatabase[value];
      if (zipInfo) {
        setFormData(prev => ({
          ...prev,
          zip: value,
          city: zipInfo.city,
          state: zipInfo.state
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[CustomerModal] Form submission - customerType in formData:', formData.customerType);
    
    const address = `${formData.street}, ${formData.city}, ${formData.state} ${formData.zip}`;
    const saveData = {
      id: customer?.id,
      reference: formData.reference,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address,
      notes: formData.notes,
      customerType: formData.customerType
    };
    
    console.log('[CustomerModal] Calling onSave with data:', saveData);
    onSave(saveData);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
            {customer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Reference
            </label>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}>
                <input
                  type="radio"
                  name="reference"
                  value="HOD"
                  checked={formData.reference === 'HOD'}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  style={{
                    marginRight: '8px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                HOD
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}>
                <input
                  type="radio"
                  name="reference"
                  value="Yelp"
                  checked={formData.reference === 'Yelp'}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  style={{
                    marginRight: '8px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                Yelp
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}>
                <input
                  type="radio"
                  name="reference"
                  value="Cust"
                  checked={formData.reference === 'Cust'}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  style={{
                    marginRight: '8px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                Cust Ref
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Customer Type
            </label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}>
                <input
                  type="radio"
                  name="customerType"
                  value="CURRENT"
                  checked={formData.customerType === 'CURRENT'}
                  onChange={(e) => {
                    console.log('[CustomerModal] customerType changed to:', e.target.value);
                    setFormData({ ...formData, customerType: e.target.value });
                  }}
                  style={{
                    marginRight: '8px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                Current
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}>
                <input
                  type="radio"
                  name="customerType"
                  value="LEADS"
                  checked={formData.customerType === 'LEADS'}
                  onChange={(e) => {
                    console.log('[CustomerModal] customerType changed to:', e.target.value);
                    setFormData({ ...formData, customerType: e.target.value });
                  }}
                  style={{
                    marginRight: '8px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                Leads
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '18.4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '18.4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Phone *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={handlePhoneChange}
              required
              placeholder="(555) 123-4567"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '18.4px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Street Address *
            </label>
            <input
              ref={addressInputRef}
              type="text"
              value={formData.street}
              onChange={handleStreetChange}
              onKeyDown={handleKeyDown}
              onFocus={() => formData.street.length >= 3 && setShowSuggestions(true)}
              required
              placeholder="Start typing an address..."
              autoComplete="off"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '18.4px'
              }}
            />
            
            {/* Loading indicator */}
            {isLoadingSuggestions && (
              <div style={{
                position: 'absolute',
                right: '12px',
                top: '38px',
                color: '#6B7280'
              }}>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              </div>
            )}
            
            {/* Address suggestions dropdown */}
            {showSuggestions && addressSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: 'white',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  marginTop: '4px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  zIndex: 10
                }}
              >
                {addressSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      backgroundColor: selectedSuggestionIndex === index ? '#F3F4F6' : 'white',
                      borderBottom: index < addressSuggestions.length - 1 ? '1px solid #E5E7EB' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      {suggestion.formatted.street}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                      {suggestion.formatted.city}, {suggestion.formatted.state} {suggestion.formatted.zip}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                City *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '18.4px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                State *
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                required
                maxLength={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '18.4px',
                  textTransform: 'uppercase'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                ZIP *
              </label>
              <input
                type="text"
                value={formData.zip}
                onChange={handleZipChange}
                required
                maxLength={5}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '18.4px'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '18.4px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '18.4px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {customer ? 'Update Customer' : 'Add Customer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#E5E7EB',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '18.4px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Job Modal Component
interface AddJobModalProps {
  customer: any;
  onClose: () => void;
  onSave: (job: any) => void;
  existingJob?: any;
  onDelete?: (jobId: string) => void;
  onJobUpdate?: (job: any) => void;
}

const AddJobModal = ({ customer, onClose, onSave, existingJob = null, onDelete = null, onJobUpdate = null }: AddJobModalProps) => {
  
  // Set default tab based on whether this is a new job or existing job
  const [activeTab, setActiveTab] = useState(existingJob ? 'lists' : 'description');
  const [currentJobId, setCurrentJobId] = useState(existingJob?.id || null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  
  // Drag-drop states
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingPlans, setIsDraggingPlans] = useState(false);
  
  // Task list states
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [newTaskText, setNewTaskText] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [touchTimer, setTouchTimer] = useState<NodeJS.Timeout | null>(null);
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  
  
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(
    existingJob?.title ? existingJob.title.split(' & ') : []
  );
  const [jobDescriptions, setJobDescriptions] = useState<{[key: string]: string}>(() => {
    // Initialize descriptions for existing job
    if (existingJob?.title && existingJob?.description) {
      const types = existingJob.title.split(' & ');
      const descriptions: {[key: string]: string} = {};
      types.forEach(type => {
        descriptions[type] = existingJob.description;
      });
      return descriptions;
    }
    return {};
  });

  const [jobData, setJobData] = useState({
    id: existingJob?.id || null,
    title: existingJob?.title || '',
    description: existingJob?.description || '',
    status: existingJob?.status || 'QUOTED',
    priority: existingJob?.priority || 'medium',
    startDate: existingJob?.startDate || null,
    endDate: existingJob?.endDate || null,
    completedDate: existingJob?.completedDate || null,
    customerId: existingJob?.customerId || customer?.id,
    photos: existingJob?.photos || [],
    plans: existingJob?.plans || [],
    tasks: existingJob?.tasks || [],
    notes: existingJob?.notes || '',
    comments: existingJob?.comments || [],
    commentsText: existingJob?.commentsText || '',
    lists: existingJob?.lists || ''
  });
  

  // Update job data when existingJob changes (e.g., after save)
  useEffect(() => {
    if (existingJob) {
      setJobData({
        id: existingJob.id,
        title: existingJob.title || '',
        description: existingJob.description || '',
        status: existingJob.status || 'QUOTED',
        priority: existingJob.priority || 'medium',
        startDate: existingJob.startDate || null,
        endDate: existingJob.endDate || null,
        completedDate: existingJob.completedDate || null,
        customerId: existingJob.customerId || customer?.id,
        photos: existingJob.photos || [],
        plans: existingJob.plans || [],
        notes: existingJob.notes || '',
        comments: existingJob.comments || [],
        commentsText: existingJob.commentsText || '',
        lists: existingJob.lists || '',
        tasks: existingJob.tasks || []
      });
      setCurrentJobId(existingJob.id);
    }
  }, [existingJob, customer]);

  const tabs = [
    { id: 'description', label: 'Info', icon: '📋' },
    { id: 'lists', label: 'Tasks', icon: '✅' },
    { id: 'photos', label: 'Photos', icon: '📸' },
    { id: 'plans', label: 'Plans', icon: '📐' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'comments', label: 'Extra $', icon: '💬' }
  ];

  // Drag-drop handlers for Photos
  const handlePhotoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingPhotos(true);
  };
  
  const handlePhotoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDraggingPhotos(false);
    }
  };
  
  const handlePhotoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhotos(false);
    
    const files = Array.from(e.dataTransfer.files);
    
    // Filter for image files only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Please drop image files only');
      return;
    }
    
    // Process files using the same logic as file picker
    await processPhotoFiles(imageFiles);
  };
  
  // Drag-drop handlers for Plans
  const handlePlanDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy'; // Show copy cursor
    setIsDraggingPlans(true);
  };
  
  const handlePlanDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDraggingPlans(false);
    }
  };
  
  const handlePlanDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlans(false);
    
    const files = Array.from(e.dataTransfer.files);
    // Filter for allowed file types
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validFiles = files.filter(file => 
      allowedTypes.includes(file.type) || file.type.startsWith('image/')
    );
    
    if (validFiles.length === 0) {
      toast.error('Please drop PDF, image, or document files only');
      return;
    }
    
    // Process files using the same logic as file picker
    await processPlanFiles(validFiles);
  };
  
  // Common function to process photo files (used by both file picker and drag-drop)
  const processPhotoFiles = async (files: File[]) => {
    // Check if job has a title
    if (!jobData.title && !existingJob) {
      toast.error('Please enter a job title first');
      return;
    }
    
    // Show loading toast
    const loadingToast = toast.info('Compressing photos...', { autoClose: 3000 });
    
    try {
      // First, compress and add all photos to local state
      const newPhotos = [];
      for (const file of files) {
        // Compress image before adding
        const compressedUrl = await compressImage(file, 1920, 1080, 0.7);
        const newPhoto = {
          id: Date.now() + Math.random(),
          url: compressedUrl,
          name: file.name
        };
        newPhotos.push(newPhoto);
      }
      
      // Update local state with new photos
      setJobData(prev => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos]
      }));
      
      toast.dismiss(loadingToast);
      toast.success(`${files.length} photo(s) added`);
      
      // Mark as having unsaved changes
      setUnsavedChanges(true);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to process some photos');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processPhotoFiles(files);
    // Reset file input
    e.target.value = '';
  };
  
  // Common function to process plan files (used by both file picker and drag-drop)
  const processPlanFiles = async (files: File[]) => {
    // Check if job has a title
    if (!jobData.title && !existingJob) {
      toast.error('Please enter a job title first');
      return;
    }
    
    // Show loading toast
    const loadingToast = toast.info('Processing documents...', { autoClose: 3000 });
    
    try {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          // Compress image files
          const compressedUrl = await compressImage(file, 1920, 1080, 0.7);
          setJobData(prev => ({
            ...prev,
            plans: [...prev.plans, {
              id: Date.now() + Math.random(),
              url: compressedUrl,
              name: file.name,
              type: file.type
            }]
          }));
        } else {
          // For non-image files (PDFs, etc), read as-is
          const reader = new FileReader();
          reader.onload = (event) => {
            setJobData(prev => ({
              ...prev,
              plans: [...prev.plans, {
                id: Date.now() + Math.random(),
                url: event.target?.result as string,
                name: file.name,
                type: file.type
              }]
            }));
          };
          reader.readAsDataURL(file);
        }
      }
      
      toast.dismiss(loadingToast);
      toast.success(`${files.length} document(s) added`);
      
      // Mark as having unsaved changes
      setUnsavedChanges(true);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to process some documents');
    }
  };

  const handlePlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processPlanFiles(files);
    // Reset file input
    e.target.value = '';
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (existingJob) {
      onSave({ ...existingJob, ...jobData });
    } else {
      onSave(jobData);
    }
  };


  // Safety check - ensure we have a customer
  if (!customer || !customer.id) {
    toast.error('Error: No customer selected');
    onClose();
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'  // Add for proper iOS positioning
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {existingJob ? 'Edit Job' : 'Add Job'} for {customer.name}
                {unsavedChanges && (
                  <span style={{ 
                    fontSize: '14px', 
                    color: '#EF4444', 
                    fontWeight: 'normal',
                    backgroundColor: '#FEE2E2',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {currentJobId ? 'Unsaved changes' : 'Save job to persist photos'}
                  </span>
                )}
              </h2>
              <div style={{ 
                margin: '4px 0 0 0', 
                color: '#6B7280', 
                fontSize: '16.1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%'
              }}>
                {(() => {
                  // Split address into street and city/state/zip
                  const parts = customer.address.split(', ');
                  if (parts.length >= 3) {
                    // Get the last 2 parts for city/state/zip
                    const stateZip = parts.slice(-2).join(', ');
                    // Everything else is the street address
                    const street = parts.slice(0, -2).join(', ');
                    return (
                      <>
                        <div style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>{street}</div>
                        <div style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>{stateZip}</div>
                      </>
                    );
                  }
                  // Fallback for addresses that don't match expected format
                  return (
                    <div style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{customer.address}</div>
                  );
                })()}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-end' }}>
              {/* Top row: Add and Cancel buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                {/* Dynamic Add button based on active tab */}
                {(activeTab === 'photos' || activeTab === 'plans') && (
                  <>
                    <input
                      type="file"
                      accept={activeTab === 'photos' ? "image/*" : ".pdf,.jpg,.jpeg,.png,.doc,.docx"}
                      multiple
                      onChange={activeTab === 'photos' ? handlePhotoUpload : handlePlanUpload}
                      style={{ display: 'none' }}
                      id="file-upload-header"
                    />
                    <label
                      htmlFor="file-upload-header"
                      style={{
                        display: 'inline-block',
                        padding: '8px 12px',
                        backgroundColor: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Add
                    </label>
                  </>
                )}
                
                {/* Cancel button */}
                <button
                  type="button"
                  onClick={() => {
                    if (unsavedChanges && !window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                      return;
                    }
                    onClose();
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#E5E7EB',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
              
              {/* Bottom row: Save button */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Always use form submit for all tabs to ensure consistent save behavior
                    const event = new Event('submit', { bubbles: true, cancelable: true });
                    const form = document.querySelector('form');
                    if (form) {
                      form.dispatchEvent(event);
                    }
                  } catch (error) {
                    toast.error('Failed to save job');
                  }
                }}
                disabled={!jobData.title}
                style={{
                  padding: '8px 20px',
                  backgroundColor: jobData.title ? '#10B981' : '#9CA3AF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: jobData.title ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: '100%',
                  maxWidth: '120px'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div 
          className="tabs-container"
          style={{
          display: 'flex',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          scrollbarWidth: 'none', // Hide scrollbar Firefox
          msOverflowStyle: 'none', // Hide scrollbar IE/Edge
          minHeight: '48px', // Ensure minimum height
          flexWrap: 'nowrap', // Prevent wrapping
          gap: '4px', // Add gap between tabs
          padding: '0 8px' // Add horizontal padding
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: window.innerWidth <= 640 ? '10px 12px' : '12px 20px',
                border: 'none',
                backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: window.innerWidth <= 640 ? '14.95px' : '16.1px',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? '#3B82F6' : '#6B7280',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: window.innerWidth <= 640 ? '4px' : '8px',
                flexShrink: 0, // Prevent tabs from shrinking
                minWidth: 'fit-content' // Ensure minimum width
              }}
            >
              {window.innerWidth > 640 && <span>{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0  // Critical for iOS flex sizing
        }}>
          <div style={{ 
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '20px'
          }}>
            {/* Job Info Tab */}
            {activeTab === 'description' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Job Type Selection */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Job *
                  </label>
                  <div style={{ 
                    display: 'flex', 
                    gap: '16px',
                    flexWrap: 'wrap',
                    padding: '12px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB'
                  }}>
                    {['Kitchen', 'Bathroom', 'Flooring', 'Various Repairs', 'Other'].map(type => (
                      <label key={type} style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedJobTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedJobTypes([...selectedJobTypes, type]);
                              // Update combined title
                              const newTypes = [...selectedJobTypes, type];
                              setJobData({ ...jobData, title: newTypes.join(' & ') });
                            } else {
                              const newTypes = selectedJobTypes.filter(t => t !== type);
                              setSelectedJobTypes(newTypes);
                              // Remove description for unchecked type
                              const newDescriptions = { ...jobDescriptions };
                              delete newDescriptions[type];
                              setJobDescriptions(newDescriptions);
                              // Update combined title
                              setJobData({ ...jobData, title: newTypes.join(' & ') });
                            }
                          }}
                          style={{
                            marginRight: '8px',
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                            accentColor: '#3B82F6'
                          }}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Scrollable Descriptions Section */}
                <div style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingRight: '8px'
                }}>
                  {selectedJobTypes.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: '#9CA3AF',
                      fontSize: '16px'
                    }}>
                      Please select at least one job type above
                    </div>
                  ) : (
                    selectedJobTypes.map((type, index) => (
                      <div key={type} style={{ 
                        marginBottom: '24px',
                        padding: '16px',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB'
                      }}>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: '8px', 
                          fontWeight: '600',
                          fontSize: '18px',
                          color: '#374151'
                        }}>
                          {type} Description
                        </label>
                        <textarea
                          value={jobDescriptions[type] || ''}
                          onChange={(e) => {
                            const newDescriptions = {
                              ...jobDescriptions,
                              [type]: e.target.value
                            };
                            setJobDescriptions(newDescriptions);
                            // Update combined description
                            const allDescriptions = selectedJobTypes
                              .map(t => newDescriptions[t] || '')
                              .filter(d => d.trim())
                              .join('\n\n---\n\n');
                            setJobData({ ...jobData, description: allDescriptions });
                          }}
                          rows={4}
                          placeholder={`Describe the ${type.toLowerCase()} work to be done...`}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            fontSize: '16px',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tasks Tab (formerly Lists) */}
            {activeTab === 'lists' && (
              <div style={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Task Input at Top */}
                <div style={{
                  backgroundColor: 'white',
                  borderBottom: '1px solid #E5E7EB',
                  padding: '12px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          // Add task directly
                          if (newTaskText.trim()) {
                            const newTask = {
                              id: `task-${Date.now()}`,
                              text: newTaskText.trim(),
                              completed: false,
                              order: jobData.tasks.length
                            };
                            setJobData(prev => ({
                              ...prev,
                              tasks: [...prev.tasks, newTask]
                            }));
                            setNewTaskText('');
                            setUnsavedChanges(true);
                          }
                        }
                      }}
                      placeholder="Add a task..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                    />
                  </div>
                </div>

                {/* Bulk Actions Toolbar - Now below input */}
                {selectedTasks.size > 0 && (
                  <div className="bulk-actions-toolbar" style={{
                    backgroundColor: '#F9FAFB',
                    borderBottom: '1px solid #E5E7EB',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    animation: 'slideDown 0.2s ease-out'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          if (selectedTasks.size === jobData.tasks.length) {
                            // Deselect all
                            setSelectedTasks(new Set());
                          } else {
                            // Select all
                            setSelectedTasks(new Set(jobData.tasks.map(t => t.id)));
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'white',
                          color: '#374151',
                          border: '1px solid #E5E7EB',
                          borderRadius: '4px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedTasks.size === jobData.tasks.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span style={{ fontSize: '13px', color: '#6B7280' }}>
                        {selectedTasks.size} selected
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Unmark all completed tasks (remove strikethrough)
                          const completedCount = jobData.tasks.filter(t => t.completed).length;
                          if (completedCount === 0) {
                            toast.info('No completed tasks to unmark');
                            return;
                          }
                          
                          // Set all tasks' completed status to false
                          const updatedTasks = jobData.tasks.map(task => ({
                            ...task,
                            completed: false
                          }));
                          
                          setJobData(prev => ({
                            ...prev,
                            tasks: updatedTasks
                          }));
                          
                          // Also clear all selections
                          setSelectedTasks(new Set());
                          
                          setUnsavedChanges(true);
                          toast.success(`${completedCount} task${completedCount > 1 ? 's' : ''} unmarked`);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#10B981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const deleteCount = selectedTasks.size;
                          setJobData(prev => ({
                            ...prev,
                            tasks: prev.tasks.filter(t => !selectedTasks.has(t.id))
                          }));
                          setSelectedTasks(new Set());
                          setUnsavedChanges(true);
                          toast.success(`${deleteCount} task${deleteCount > 1 ? 's' : ''} deleted`);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#EF4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* Task List */}
                <div style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  position: 'relative'
                }}>
                  {jobData.tasks.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: '#9CA3AF'
                    }}>
                      No tasks yet. Add your first task above.
                    </div>
                  ) : (
                    jobData.tasks
                      .sort((a, b) => a.order - b.order)
                      .map((task, index) => (
                        <div
                          key={task.id}
                          draggable={!isDraggingTask}
                          onDragStart={(e) => {
                            setDraggedTaskId(task.id);
                            setIsDraggingTask(true);
                            e.dataTransfer.effectAllowed = 'move';
                            // Add ghost image styling
                            const target = e.currentTarget;
                            target.style.opacity = '0.5';
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1';
                            setDraggedTaskId(null);
                            setDragOverTaskId(null);
                            setIsDraggingTask(false);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedTaskId && task.id !== draggedTaskId) {
                              setDragOverTaskId(task.id);
                            }
                          }}
                          onDragLeave={() => {
                            setDragOverTaskId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedTaskId && task.id !== draggedTaskId) {
                              const newTasks = [...jobData.tasks];
                              const draggedIndex = newTasks.findIndex(t => t.id === draggedTaskId);
                              const dropIndex = newTasks.findIndex(t => t.id === task.id);
                              
                              // Reorder tasks
                              const [draggedTask] = newTasks.splice(draggedIndex, 1);
                              newTasks.splice(dropIndex, 0, draggedTask);
                              
                              // Update order property
                              newTasks.forEach((t, i) => t.order = i);
                              
                              setJobData(prev => ({ ...prev, tasks: newTasks }));
                              setUnsavedChanges(true);
                            }
                            setDragOverTaskId(null);
                          }}
                          // Touch events for mobile drag
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            const timer = setTimeout(() => {
                              setDraggedTaskId(task.id);
                              setIsDraggingTask(true);
                              // Haptic feedback on mobile if available
                              if ('vibrate' in navigator) {
                                navigator.vibrate(50);
                              }
                            }, 500); // Long press for 500ms
                            setTouchTimer(timer);
                          }}
                          onTouchEnd={() => {
                            if (touchTimer) {
                              clearTimeout(touchTimer);
                              setTouchTimer(null);
                            }
                            if (isDraggingTask) {
                              setDraggedTaskId(null);
                              setIsDraggingTask(false);
                            }
                          }}
                          onTouchMove={(e) => {
                            if (isDraggingTask && draggedTaskId) {
                              e.preventDefault();
                              const touch = e.touches[0];
                              const element = document.elementFromPoint(touch.clientX, touch.clientY);
                              // Find the task element under the touch point
                              const taskElement = element?.closest('[data-task-id]');
                              if (taskElement) {
                                const taskId = taskElement.getAttribute('data-task-id');
                                if (taskId && taskId !== draggedTaskId) {
                                  setDragOverTaskId(taskId);
                                }
                              }
                            }
                          }}
                          data-task-id={task.id}
                          className="task-item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            backgroundColor: task.completed ? '#F9FAFB' : 'white',
                            borderBottom: '1px solid #E5E7EB',
                            cursor: isDraggingTask && draggedTaskId === task.id ? 'grabbing' : 'move',
                            transition: 'all 0.2s',
                            transform: dragOverTaskId === task.id ? 'translateY(1px)' : 'none',
                            boxShadow: dragOverTaskId === task.id ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                            opacity: draggedTaskId === task.id ? 0.5 : 1,
                            minHeight: '32px'
                          }}
                        >
                          {/* Drag Handle */}
                          <div
                            style={{
                              padding: '2px',
                              cursor: 'grab',
                              color: '#9CA3AF',
                              fontSize: '14px',
                              lineHeight: 1,
                              marginRight: '6px',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#6B7280'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                          >
                            ≡
                          </div>

                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={task.completed || selectedTasks.has(task.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTasks(prev => new Set([...prev, task.id]));
                              } else {
                                setSelectedTasks(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(task.id);
                                  return newSet;
                                });
                              }
                              
                              // Also update task completion status
                              const newTasks = jobData.tasks.map(t =>
                                t.id === task.id ? { ...t, completed: e.target.checked } : t
                              );
                              setJobData(prev => ({ ...prev, tasks: newTasks }));
                              setUnsavedChanges(true);
                            }}
                            style={{
                              width: '16px',
                              height: '16px',
                              marginRight: '8px',
                              cursor: 'pointer',
                              accentColor: '#3B82F6',
                              flexShrink: 0
                            }}
                          />

                          {/* Task Text */}
                          <span style={{
                            fontSize: '14px',
                            lineHeight: '20px',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            color: task.completed ? '#9CA3AF' : '#111827',
                            transition: 'all 0.2s',
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {task.text}
                          </span>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setJobData(prev => ({
                                ...prev,
                                tasks: prev.tasks.filter(t => t.id !== task.id)
                              }));
                              setSelectedTasks(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(task.id);
                                return newSet;
                              });
                              setUnsavedChanges(true);
                            }}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: 'transparent',
                              color: '#9CA3AF',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '18px',
                              lineHeight: '18px',
                              transition: 'all 0.2s',
                              marginLeft: '8px',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#EF4444';
                              e.currentTarget.style.backgroundColor = '#FEE2E2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#9CA3AF';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))
                  )}
                </div>

              </div>
            )}

            {/* Photos Tab */}
            {activeTab === 'photos' && (
              <div>
                {/* Drag-Drop Zone for Photos */}
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingPhotos(true);
                  }}
                  onDragOver={handlePhotoDragOver}
                  onDragLeave={handlePhotoDragLeave}
                  onDrop={handlePhotoDrop}
                  style={{
                    border: `2px dashed ${isDraggingPhotos ? '#3B82F6' : '#D1D5DB'}`,
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: isDraggingPhotos ? '#EFF6FF' : '#F9FAFB',
                    marginBottom: '16px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    flexShrink: 0  // Prevent drag zone from shrinking
                  }}
                  onClick={() => document.getElementById('photo-upload-inline')?.click()}
                >
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📸</div>
                  <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                    {isDraggingPhotos ? 'Drop photos here' : 'Drag and drop photos here'}
                  </p>
                  <p style={{ fontSize: '14px', color: '#6B7280' }}>
                    or click to browse
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                    id="photo-upload-inline"
                  />
                </div>
                
                {/* Photos Grid */}
                <div 
                  className="photos-scroll-container"
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    paddingRight: '8px',
                    marginTop: '8px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    padding: '8px'
                  }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '12px'
                  }}>
                    {jobData.photos.map(photo => (
                      <div key={photo.id} style={{
                        position: 'relative',
                        paddingBottom: '100%',
                        backgroundColor: '#F3F4F6',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                      <img
                        src={photo.url}
                        alt={photo.name}
                        onClick={() => setSelectedPhoto(photo)}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          cursor: 'pointer',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        title="Click to view full size"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setJobData(prev => ({
                            ...prev,
                            photos: prev.photos.filter(p => p.id !== photo.id)
                          }));
                          
                          // Mark as having unsaved changes
                          setUnsavedChanges(true);
                          toast.info('Photo removed - click Save to update');
                        }}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '13.8px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  {/* Empty state for photos */}
                  {jobData.photos.length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      color: '#6B7280',
                      padding: '40px',
                      fontSize: '16.1px',
                      gridColumn: '1 / -1'
                    }}>
                      No photos uploaded yet. Drag and drop or use the button above.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

            {/* Plans Tab */}
            {activeTab === 'plans' && (
              <div>
                {/* Drag-Drop Zone for Plans */}
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingPlans(true);
                  }}
                  onDragOver={handlePlanDragOver}
                  onDragLeave={handlePlanDragLeave}
                  onDrop={handlePlanDrop}
                  style={{
                    border: `2px dashed ${isDraggingPlans ? '#3B82F6' : '#D1D5DB'}`,
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: isDraggingPlans ? '#EFF6FF' : '#F9FAFB',
                    marginBottom: '16px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    flexShrink: 0  // Prevent drag zone from shrinking
                  }}
                  onClick={() => document.getElementById('plan-upload-inline')?.click()}
                >
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📄</div>
                  <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                    {isDraggingPlans ? 'Drop documents here' : 'Drag and drop plans/documents here'}
                  </p>
                  <p style={{ fontSize: '14px', color: '#6B7280' }}>
                    PDF, images, or documents - or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    multiple
                    onChange={handlePlanUpload}
                    style={{ display: 'none' }}
                    id="plan-upload-inline"
                  />
                </div>
                
                {/* Plans List */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingRight: '8px',
                  marginTop: '8px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  padding: '8px'
                }}>
                  {jobData.plans.map(plan => (
                    <div 
                      key={plan.id} 
                      onClick={() => {
                        // For PDFs and other documents, try to open in new tab
                        // For images, use the lightbox
                        if (plan.type && (plan.type.includes('image') || plan.type.includes('jpg') || plan.type.includes('jpeg') || plan.type.includes('png'))) {
                          setSelectedPhoto(plan);
                        } else {
                          // Create a blob URL for better compatibility
                          try {
                            const byteCharacters = atob(plan.url.split(',')[1]);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: plan.type || 'application/octet-stream' });
                            const blobUrl = URL.createObjectURL(blob);
                            window.open(blobUrl, '_blank');
                            // Clean up blob URL after a delay
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                          } catch (error) {
                            // Fallback to direct opening
                            window.open(plan.url, '_blank');
                          }
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '6px',
                        border: '1px solid #E5E7EB',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                      title="Click to open"
                    >
                      <span style={{ fontSize: '27.6px', marginRight: '12px' }}>
                        {plan.type && plan.type.includes('pdf') ? '📄' : '🖼️'}
                      </span>
                      <span style={{ flex: 1, fontSize: '16.1px' }}>{plan.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setJobData(prev => ({
                            ...prev,
                            plans: prev.plans.filter(p => p.id !== plan.id)
                          }));
                        }}
                        style={{
                          backgroundColor: 'transparent',
                          color: '#DC2626',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16.1px'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  {/* Empty state for plans */}
                  {jobData.plans.length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      color: '#6B7280',
                      padding: '40px',
                      fontSize: '16.1px'
                    }}>
                      No documents uploaded yet. Drag and drop or use the button above.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Job Notes
                </label>
                <textarea
                  value={jobData.notes}
                  onChange={(e) => setJobData({ ...jobData, notes: e.target.value })}
                  rows={10}
                  placeholder="Add any notes about this job..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '18.4px',
                    resize: 'vertical'
                  }}
                />
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Extra Costs
                </label>
                <textarea
                  value={jobData.commentsText || ''}
                  onChange={(e) => setJobData({ ...jobData, commentsText: e.target.value })}
                  rows={10}
                  placeholder="Add any additional costs for this job..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '18.4px',
                    resize: 'vertical'
                  }}
                />
              </div>
            )}
          </div>

        </form>
      </div>
      
      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer'
          }}
        >
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.name}
            style={{
              maxWidth: '90%',
              maxHeight: '90vh',
              objectFit: 'contain',
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setSelectedPhoto(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomersEnhanced;