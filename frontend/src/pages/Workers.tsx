import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workerService, Worker, workerColors } from '../services/worker.service';
import { ScrollablePageContainer } from '../components/ScrollablePageContainer';

const Workers = () => {
  const navigate = useNavigate();
  
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'hours'>('info');
  const [formData, setFormData] = useState({
    name: '',
    fullName: '',
    phone: '',
    email: '',
    specialty: '',
    status: 'Available' as Worker['status'],
    color: '',
    notes: ''
  });

  // Timesheet state
  const [timesheet, setTimesheet] = useState<{[key: string]: {
    startTime: string;
    endTime: string;
    lunchMinutes: number;
    job: string;
    workType: string;
    totalHours: number;
  }}>({
    Mon: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
    Tue: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
    Wed: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
    Thu: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
    Fri: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
    Sat: { startTime: '', endTime: '', lunchMinutes: 0, job: '', workType: '', totalHours: 0 },
    Sun: { startTime: '', endTime: '', lunchMinutes: 0, job: '', workType: '', totalHours: 0 },
  });
  
  // Track which days have been modified
  const [modifiedDays, setModifiedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await workerService.getAll();
      console.log('=== LOADED WORKERS ===');
      console.log('All workers:', data);
      const tyler = data.find(w => w.name === 'TYL' || w.fullName.includes('Tyler'));
      if (tyler) {
        console.log('Tyler Mitchell data:', tyler);
        console.log('Tyler timesheet:', tyler.timesheet);
        console.log('Tyler Monday:', tyler.timesheet?.Mon);
      }
      setWorkers(data);
    } catch (error) {
      // Will use cached data from localStorage
    }
  };

  const handleAddWorker = async () => {
    setEditingWorker(null);
    setActiveTab('info');
    setModifiedDays(new Set()); // Clear modified days
    const nextColor = await workerService.getNextColor();
    setFormData({
      name: '',
      fullName: '',
      phone: '',
      email: '',
      specialty: '',
      status: 'Available',
      color: nextColor,
      notes: ''
    });
    setShowAddModal(true);
  };

  const handleEditWorker = (worker: Worker) => {
    console.log('=== EDITING WORKER ===');
    console.log('Worker being edited:', worker);
    console.log('Worker timesheet:', worker.timesheet);
    
    setEditingWorker(worker);
    setActiveTab('info');
    setModifiedDays(new Set()); // Clear modified days
    setFormData({
      name: worker.name,
      fullName: worker.fullName,
      phone: worker.phone,
      email: worker.email,
      specialty: worker.specialty,
      status: worker.status,
      color: worker.color,
      notes: worker.notes || ''
    });
    setShowAddModal(true);
  };

  const handleDeleteWorker = async (id: string) => {
    if (confirm('Are you sure you want to delete this worker?')) {
      await workerService.delete(id);
      await loadWorkers();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingWorker) {
        // Send full timesheet but mark which days were modified
        console.log('Modified days:', Array.from(modifiedDays));
        console.log('Current full timesheet:', timesheet);
        
        // Update existing worker - send timesheet if modified
        const updateData: any = { ...formData };
        
        // Always include timesheet if we're on the hours tab and have modifications
        if (activeTab === 'hours' || modifiedDays.size > 0) {
          console.log('=== SAVING TIMESHEET ===');
          console.log('Full timesheet being saved:', timesheet);
          updateData.timesheet = timesheet;
        }
        
        console.log('Update data being sent:', updateData);
        const result = await workerService.update(editingWorker.id, updateData);
        console.log('Update result:', result);
        console.log('Result timesheet:', result?.timesheet);
      } else {
        // Create new worker with full timesheet
        await workerService.create({
          ...formData,
          currentJob: null,
          timesheet
        });
      }
      
      setShowAddModal(false);
      setModifiedDays(new Set()); // Clear modified days
      await loadWorkers();
    } catch (error) {
      alert('Failed to save worker. Please try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate hours between two times
  const calculateHours = (startTime: string, endTime: string, lunchMinutes: number): number => {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    // Handle overnight shifts
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const lunchHours = lunchMinutes / 60;
    
    return Math.max(0, diffHours - lunchHours);
  };

  // Handle timesheet changes
  const handleTimesheetChange = (day: string, field: string, value: string | number) => {
    console.log(`Timesheet change: ${day} - ${field} = ${value}`);
    
    // Only mark as modified if the value actually changed from original
    const originalValue = originalTimesheet?.[day]?.[field];
    const currentValue = timesheet[day]?.[field];
    
    // Check if this is a real change
    if (value !== originalValue && value !== currentValue) {
      console.log(`Marking ${day} as modified (original: ${originalValue}, new: ${value})`);
      setModifiedDays(prev => new Set([...prev, day]));
    }
    
    setTimesheet(prev => {
      // Ensure the day exists in the timesheet
      if (!prev[day]) {
        prev[day] = { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 };
      }
      
      const updated = {
        ...prev,
        [day]: {
          ...prev[day],
          [field]: value
        }
      };
      
      // Recalculate hours if time fields changed
      if (field === 'startTime' || field === 'endTime' || field === 'lunchMinutes') {
        const dayData = updated[day];
        updated[day].totalHours = calculateHours(
          dayData.startTime,
          dayData.endTime,
          dayData.lunchMinutes
        );
      }
      
      return updated;
    });
  };

  // Get total weekly hours
  const getTotalWeeklyHours = (): number => {
    return Object.values(timesheet).reduce((sum, day) => {
      // Ensure day object exists and has totalHours
      if (day && typeof day.totalHours === 'number') {
        return sum + day.totalHours;
      }
      return sum;
    }, 0);
  };

  // Store original timesheet for comparison
  const [originalTimesheet, setOriginalTimesheet] = useState<any>(null);
  
  // Load timesheet data when editing worker
  useEffect(() => {
    console.log('=== LOADING TIMESHEET DATA ===');
    console.log('editingWorker:', editingWorker);
    console.log('editingWorker.timesheet:', editingWorker?.timesheet);
    
    if (editingWorker && editingWorker.timesheet && typeof editingWorker.timesheet === 'object') {
      // Store the original timesheet
      setOriginalTimesheet(editingWorker.timesheet);
      
      // Ensure all required days exist in the timesheet
      const defaultDay = { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 };
      const completeTimesheet = {
        Mon: editingWorker.timesheet.Mon || defaultDay,
        Tue: editingWorker.timesheet.Tue || defaultDay,
        Wed: editingWorker.timesheet.Wed || defaultDay,
        Thu: editingWorker.timesheet.Thu || defaultDay,
        Fri: editingWorker.timesheet.Fri || defaultDay,
        Sat: editingWorker.timesheet.Sat || { ...defaultDay, lunchMinutes: 0 },
        Sun: editingWorker.timesheet.Sun || { ...defaultDay, lunchMinutes: 0 },
      };
      console.log('Complete timesheet being set:', completeTimesheet);
      console.log('Monday data specifically:', completeTimesheet.Mon);
      setTimesheet(completeTimesheet);
    } else {
      console.log('No timesheet data, using defaults');
      // Reset to default timesheet
      setOriginalTimesheet(null);
      setTimesheet({
        Mon: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
        Tue: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
        Wed: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
        Thu: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
        Fri: { startTime: '', endTime: '', lunchMinutes: 30, job: '', workType: '', totalHours: 0 },
        Sat: { startTime: '', endTime: '', lunchMinutes: 0, job: '', workType: '', totalHours: 0 },
        Sun: { startTime: '', endTime: '', lunchMinutes: 0, job: '', workType: '', totalHours: 0 },
      });
    }
  }, [editingWorker]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = workerService.formatPhone(e.target.value);
    setFormData(prev => ({
      ...prev,
      phone: formatted
    }));
  };

  return (
    <ScrollablePageContainer customPaddingBottom={100}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
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
              Workers
            </h1>
          </div>
          
          <button
            onClick={handleAddWorker}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18.4px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Worker
          </button>
          <button
            onClick={() => {
              // Direct localStorage check
              const data = localStorage.getItem('khs-crm-workers');
              if (data) {
                const workers = JSON.parse(data);
                const tyler = workers.find((w: any) => w.name === 'TYL');
                console.log('=== DIRECT LOCALSTORAGE CHECK ===');
                console.log('Tyler data:', tyler);
                console.log('Tyler timesheet:', tyler?.timesheet);
                alert(`Tyler's timesheet: ${JSON.stringify(tyler?.timesheet, null, 2)}`);
              }
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#9333EA',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18.4px',
              fontWeight: '500',
              cursor: 'pointer',
              marginLeft: '10px'
            }}
          >
            🔍 Check Tyler's Data
          </button>
        </div>

        {/* Workers Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {workers.map(worker => (
            <div
              key={worker.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                padding: '20px',
                borderTop: `4px solid ${worker.color}`
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: worker.color,
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20.7px',
                    fontWeight: 'bold'
                  }}>
                    {worker.name}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '20.7px', fontWeight: '600' }}>
                      {worker.fullName}
                    </h2>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      backgroundColor: worker.status === 'Available' ? '#D1FAE5' : 
                                     worker.status === 'On Job' ? '#FEE2E2' : '#F3F4F6',
                      color: worker.status === 'Available' ? '#065F46' : 
                             worker.status === 'On Job' ? '#991B1B' : '#374151',
                      borderRadius: '12px',
                      fontSize: '13.8px',
                      fontWeight: '500'
                    }}>
                      {worker.status}
                    </span>
                  </div>
                  {/* Notes Indicator */}
                  {worker.notes && (
                    <div
                      title="Has notes"
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        borderRadius: '4px',
                        fontSize: '13.8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h2a1 1 0 100 2H6a4 4 0 01-4-4V5a4 4 0 014-4 1 1 0 001-1h2a1 1 0 110 2H7a1 1 0 00-1 1zm5 4a1 1 0 11-2 0 1 1 0 012 0zm3 1a1 1 0 100-2 1 1 0 000 2zm3 1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                      </svg>
                      Notes
                    </div>
                  )}
                  {/* Action Menu */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleEditWorker(worker)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        cursor: 'pointer',
                        color: '#6B7280',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Edit worker"
                    >
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteWorker(worker.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        cursor: 'pointer',
                        color: '#EF4444',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Delete worker"
                    >
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '16.1px', color: '#6B7280', marginBottom: '12px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong>Specialty:</strong> {worker.specialty}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <strong>Phone:</strong>{' '}
                  <a
                    href={`tel:${worker.phone.replace(/\D/g, '')}`}
                    style={{ color: '#3B82F6', textDecoration: 'none' }}
                  >
                    {worker.phone}
                  </a>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <strong>Email:</strong>{' '}
                  <a
                    href={`mailto:${worker.email}`}
                    style={{ color: '#3B82F6', textDecoration: 'none' }}
                  >
                    {worker.email}
                  </a>
                </div>
                {worker.currentJob && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#F3F4F6',
                    borderRadius: '6px'
                  }}>
                    <strong>Current Job:</strong> {worker.currentJob}
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate('/schedule')}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16.1px'
                }}
              >
                View Schedule
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingWorker ? 'Edit Worker' : 'Add New Worker'}
            </h2>

            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              borderBottom: '2px solid #E5E7EB',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'info' ? '2px solid #3B82F6' : '2px solid transparent',
                  color: activeTab === 'info' ? '#3B82F6' : '#6B7280',
                  fontWeight: activeTab === 'info' ? '600' : '400',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'notes' ? '2px solid #3B82F6' : '2px solid transparent',
                  color: activeTab === 'notes' ? '#3B82F6' : '#6B7280',
                  fontWeight: activeTab === 'notes' ? '600' : '400',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                Notes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('hours')}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'hours' ? '2px solid #3B82F6' : '2px solid transparent',
                  color: activeTab === 'hours' ? '#3B82F6' : '#6B7280',
                  fontWeight: activeTab === 'hours' ? '600' : '400',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                Hours
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Tab Content */}
              {activeTab === 'info' && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Initials/Short Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., KBH"
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
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Keith B. Henderson"
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
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="worker@company.com"
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
                  Specialty
                </label>
                <input
                  type="text"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., General Construction, Carpentry"
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
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '18.4px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="Available">Available</option>
                  <option value="On Job">On Job</option>
                  <option value="Off Duty">Off Duty</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Color
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {workerColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: color,
                        border: formData.color === color ? '3px solid #1F2937' : '1px solid #D1D5DB',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      {formData.color === color && (
                        <svg
                          style={{
                            width: '20px',
                            height: '20px',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: 'white'
                          }}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
                </div>
              )}
              {activeTab === 'notes' && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Worker Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleTextareaChange}
                      placeholder="Add any notes about this worker (certifications, availability, special skills, etc.)"
                      style={{
                        width: '100%',
                        minHeight: '300px',
                        padding: '12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '18.4px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ marginTop: '8px', fontSize: '16.1px', color: '#6B7280' }}>
                      Use this space to track important information about the worker.
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'hours' && (
                <div>

                  {/* Weekly Timesheet */}
                  <div style={{ 
                    backgroundColor: '#F9FAFB',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '18.4px', fontWeight: '600' }}>
                      Weekly Timesheet
                    </h4>
                    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                          <tr>
                            <th style={{ 
                              textAlign: 'left', 
                              padding: '8px',
                              borderBottom: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '50px'
                            }}>
                              Day
                            </th>
                            <th style={{ 
                              textAlign: 'center', 
                              padding: '8px',
                              borderBottom: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '80px'
                            }}>
                              Start Time
                            </th>
                            <th style={{ 
                              textAlign: 'center', 
                              padding: '8px',
                              borderBottom: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '80px'
                            }}>
                              End Time
                            </th>
                            <th style={{ 
                              textAlign: 'center', 
                              padding: '8px',
                              borderBottom: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '60px'
                            }}>
                              Lunch (min)
                            </th>
                            <th style={{ 
                              textAlign: 'left', 
                              padding: '8px',
                              borderBottom: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '180px'
                            }}>
                              Job/Customer
                            </th>
                            <th style={{ 
                              textAlign: 'left', 
                              padding: '8px',
                              borderBottom: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '140px'
                            }}>
                              Type of Work
                            </th>
                            <th style={{ 
                              textAlign: 'center', 
                              padding: '8px',
                              borderBottom: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              minWidth: '80px'
                            }}>
                              Total Hours
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                            <tr key={day}>
                              <td style={{ 
                                padding: '8px',
                                borderBottom: '1px solid #E5E7EB',
                                fontSize: '16.1px',
                                color: '#374151'
                              }}>
                                {day}
                              </td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #E5E7EB' }}>
                                <input
                                  type="time"
                                  value={timesheet[day].startTime}
                                  onChange={(e) => handleTimesheetChange(day, 'startTime', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '4px',
                                    fontSize: '16.1px'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #E5E7EB' }}>
                                <input
                                  type="time"
                                  value={timesheet[day].endTime}
                                  onChange={(e) => handleTimesheetChange(day, 'endTime', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '4px',
                                    fontSize: '16.1px'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #E5E7EB' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="120"
                                  step="15"
                                  value={timesheet[day].lunchMinutes}
                                  onChange={(e) => handleTimesheetChange(day, 'lunchMinutes', parseInt(e.target.value) || 0)}
                                  style={{
                                    width: '60px',
                                    padding: '4px 6px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '4px',
                                    fontSize: '16.1px',
                                    textAlign: 'center'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #E5E7EB' }}>
                                <input
                                  type="text"
                                  value={timesheet[day].job}
                                  onChange={(e) => handleTimesheetChange(day, 'job', e.target.value)}
                                  placeholder="Select job..."
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '4px',
                                    fontSize: '16.1px'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #E5E7EB' }}>
                                <select
                                  value={timesheet[day].workType}
                                  onChange={(e) => handleTimesheetChange(day, 'workType', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '4px',
                                    fontSize: '16.1px',
                                    backgroundColor: 'white'
                                  }}
                                >
                                  <option value="">Select type...</option>
                                  <option value="carpentry">Carpentry</option>
                                  <option value="painting">Painting</option>
                                  <option value="drywall">Drywall</option>
                                  <option value="demo">Demo</option>
                                  <option value="flooring">Flooring</option>
                                  <option value="plumbing">Plumbing</option>
                                  <option value="electrical">Electrical</option>
                                  <option value="roofing">Roofing</option>
                                  <option value="other">Other</option>
                                </select>
                              </td>
                              <td style={{ 
                                padding: '8px',
                                borderBottom: '1px solid #E5E7EB',
                                textAlign: 'center',
                                fontSize: '16.1px',
                                fontWeight: '500',
                                color: timesheet[day].totalHours > 0 ? '#059669' : '#6B7280'
                              }}>
                                {timesheet[day].totalHours.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={6} style={{ 
                              padding: '8px',
                              borderTop: '2px solid #E5E7EB',
                              fontSize: '16.1px',
                              fontWeight: '600',
                              color: '#374151',
                              textAlign: 'right'
                            }}>
                              Weekly Total:
                            </td>
                            <td style={{ 
                              padding: '8px',
                              borderTop: '2px solid #E5E7EB',
                              textAlign: 'center',
                              fontSize: '18.4px',
                              fontWeight: '700',
                              color: getTotalWeeklyHours() > 40 ? '#DC2626' : '#059669'
                            }}>
                              {getTotalWeeklyHours().toFixed(1)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
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
                  {editingWorker ? 'Save Changes' : 'Add Worker'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
      )}
    </ScrollablePageContainer>
  );
};

export default Workers;