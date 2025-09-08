import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workerService } from '../services/worker.service';
import { customersApi, scheduleEventsApi } from '../services/api';
import { toast } from 'react-toastify';

// Timezone utility functions to handle date conversion properly
const formatDateForInput = (date) => {
  if (!date) return '';
  // Create a new date and adjust for local timezone
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const convertLocalDateToUTC = (dateString) => {
  if (!dateString) return '';
  // Parse the date string as local time (not UTC)
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  // Return ISO string which will be in UTC
  return localDate.toISOString();
};

const ScheduleCalendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month, week, day, gantt
  const [showEditMenu, setShowEditMenu] = useState(null);
  const [draggedJob, setDraggedJob] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    startDate: '',
    endDate: '',
    description: '',
    type: 'personal', // 'personal' or 'work'
    customerId: '',
    workers: []
  });
  
  // Load jobs from API
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load jobs from API on mount
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      
      // Load both customers/jobs and schedule events in parallel
      const [customers, scheduleEvents] = await Promise.all([
        customersApi.getAll(),
        scheduleEventsApi.getAll()
      ]);
      
      // Extract and transform jobs for calendar display
      const jobs = [];
      
      // Add customer jobs
      customers.forEach(customer => {
        if (customer.jobs && customer.jobs.length > 0) {
          customer.jobs.forEach(job => {
            // Only include jobs with dates
            if (job.startDate || job.endDate) {
              jobs.push({
                id: job.id,
                customerId: customer.id,
                customerName: customer.name,
                title: job.title,
                startDate: job.startDate ? new Date(job.startDate) : new Date(),
                endDate: job.endDate ? new Date(job.endDate) : job.startDate ? new Date(job.startDate) : new Date(),
                workers: extractWorkersFromJob(job),
                color: getJobColor(job.status),
                price: job.totalCost || 0,
                status: job.status,
                description: job.description,
                priority: job.priority,
                entryType: 'job' // Mark as regular job
              });
            }
          });
        }
      });
      
      // Add schedule events
      scheduleEvents.forEach(event => {
        jobs.push({
          id: event.id,
          customerId: event.customerId,
          customerName: event.customer?.name || '',
          title: event.title,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          workers: event.workers || [],
          color: event.eventType === 'personal' ? '#9333EA' : (event.workers && event.workers[0] ? workerColors[event.workers[0]] : '#3B82F6'),
          description: event.description,
          entryType: event.eventType, // 'personal' or 'work'
          isScheduleEvent: true // Mark as schedule event
        });
      });
      
      setAllJobs(jobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to extract workers from job
  const extractWorkersFromJob = (job) => {
    // If job has assignedWorkers field
    if (job.assignedWorkers && Array.isArray(job.assignedWorkers)) {
      return job.assignedWorkers;
    }
    // If job has tasks with assignees
    if (job.tasks && Array.isArray(job.tasks)) {
      const assignees = job.tasks
        .filter(task => task.assignedTo)
        .map(task => task.assignedTo);
      return [...new Set(assignees)]; // Remove duplicates
    }
    return [];
  };

  // Helper function to get color based on job status
  const getJobColor = (status) => {
    switch (status) {
      case 'COMPLETED': return '#10B981';
      case 'IN_PROGRESS': return '#3B82F6';
      case 'QUOTED': return '#F59E0B';
      case 'APPROVED': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  // Scroll to current date in Gantt view
  useEffect(() => {
    if (view === 'gantt') {
      // Calculate scroll position for current date
      const today = new Date().getDate();
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const scrollPercentage = (today - 1) / daysInMonth;
      
      // Delay to ensure DOM is rendered
      setTimeout(() => {
        const scrollContainer = document.getElementById('gantt-scroll-container');
        if (scrollContainer) {
          const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
          scrollContainer.scrollLeft = maxScroll * scrollPercentage;
        }
      }, 100);
    }
  }, [view, currentDate]);

  // Get workers from service for display
  const [workers, setWorkers] = useState([]);
  const [workerColors, setWorkerColors] = useState({});
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const loadedWorkers = await workerService.getAll();
        setWorkers((loadedWorkers || []).map(w => w.name));
        
        const colors = {};
        (loadedWorkers || []).forEach(w => {
          colors[w.name] = w.color;
        });
        setWorkerColors(colors);
      } catch (error) {
        console.error('Failed to load workers:', error);
        setWorkers([]);
        setWorkerColors({});
      }
    };
    
    loadWorkers();
  }, []);

  // Load customers when modal is opened
  useEffect(() => {
    if (showJobModal) {
      customersApi.getAll().then(customerList => {
        setCustomers(customerList || []);
      }).catch(err => {
        console.error('Failed to load customers:', err);
        setCustomers([]);
      });
    }
  }, [showJobModal]);

  // Calendar helpers

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getJobsForDate = (date) => {
    return (allJobs || []).filter(job => {
      const jobStart = new Date(job.startDate);
      const jobEnd = new Date(job.endDate);
      const checkDate = new Date(date);
      
      // Set all times to midnight for date comparison
      jobStart.setHours(0, 0, 0, 0);
      jobEnd.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      
      return checkDate >= jobStart && checkDate <= jobEnd;
    });
  };


  const handleDateClick = (date) => {
    setSelectedDate(date);
    setNewEvent({
      title: '',
      startDate: formatDateForInput(date),
      endDate: formatDateForInput(date),
      description: '',
      type: 'personal',
      customerId: '',
      workers: []
    });
    setShowJobModal(true);
  };



  const handleEditJob = (job) => {
    // Check if this is a schedule event or a regular job
    if (job.isScheduleEvent) {
      // For now, just show a toast message
      toast.info('Edit functionality for schedule events coming soon');
    } else {
      // Navigate to the job in CustomersEnhanced page
      navigate(`/customers?jobId=${job.id}`);
    }
    setShowEditMenu(null);
  };

  const handleDeleteJob = async (job) => {
    console.log('handleDeleteJob called with:', job);
    
    if (job.isScheduleEvent) {
      // Delete schedule event
      try {
        console.log('Deleting schedule event:', job.id);
        await scheduleEventsApi.delete(job.id);
        toast.success('Event deleted successfully');
        await loadJobs();
      } catch (error) {
        console.error('Delete error:', error);
        toast.error(`Failed to delete event: ${error.message || 'Unknown error'}`);
      }
    } else {
      // Regular job - remove from schedule view
      try {
        // For now, just remove from view since we don't have a separate schedule removal API
        if (job.customerId) {
          toast.info('Job removed from schedule view');
        } else {
          toast.success('Job deleted successfully');
        }
        // For immediate visual feedback, remove from local state
        const filteredJobs = allJobs.filter(j => j.id !== job.id);
        setAllJobs(filteredJobs);
      } catch (error) {
        toast.error('Failed to remove job from schedule');
      }
    }
    setShowEditMenu(null);
  };

  const handleJobClick = (e, job) => {
    e.stopPropagation();
    setShowEditMenu(showEditMenu === job.id ? null : job.id);
  };

  const handleDragStart = (e, job) => {
    e.stopPropagation();
    setDraggedJob(job);
    setShowEditMenu(null);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, date) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedJob) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverDate(date);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDate(null);
  };

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedJob && targetDate) {
      // Calculate the duration of the event
      const startDate = new Date(draggedJob.startDate);
      const endDate = new Date(draggedJob.endDate);
      const duration = endDate.getTime() - startDate.getTime();
      
      // Set new dates based on drop target
      const newStartDate = new Date(targetDate);
      newStartDate.setHours(0, 0, 0, 0);
      const newEndDate = new Date(newStartDate.getTime() + duration);
      
      try {
        if (draggedJob.isScheduleEvent) {
          // Update schedule event
          await scheduleEventsApi.update(draggedJob.id, {
            startDate: convertLocalDateToUTC(formatDateForInput(newStartDate)),
            endDate: convertLocalDateToUTC(formatDateForInput(newEndDate))
          });
          toast.success('Event moved successfully');
        } else {
          // Update regular job
          // For now, show info message since job updates need to be done through customer page
          toast.info('To permanently update job dates, please edit from the Customers page');
          // Temporarily update the view
          const jobIndex = allJobs.findIndex(j => j.id === draggedJob.id);
          if (jobIndex !== -1) {
            const updatedJobs = [...allJobs];
            updatedJobs[jobIndex] = {
              ...updatedJobs[jobIndex],
              startDate: newStartDate,
              endDate: newEndDate
            };
            setAllJobs(updatedJobs);
          }
        }
        
        // Reload the calendar
        await loadJobs();
      } catch (error) {
        console.error('Error updating dates:', error);
        toast.error('Failed to move event');
      }
    }
    
    setDraggedJob(null);
    setDragOverDate(null);
  };

  const handleDragEnd = (e) => {
    e.preventDefault();
    setDraggedJob(null);
    setDragOverDate(null);
  };


  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const getWeekRange = (date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(start)} - ${formatDate(end)}, ${end.getFullYear()}`;
  };

  const getWeekDays = (date) => {
    const days = [];
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '10px' }} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayJobs = getJobsForDate(date) || [];
      const isToday = new Date().toDateString() === date.toDateString();

      days.push(
        <div
          key={day}
          style={{
            border: '1px solid #E5E7EB',
            minHeight: '100px',
            padding: '8px',
            backgroundColor: isToday ? '#FEF3C7' : dragOverDate?.toDateString() === date.toDateString() ? '#DBEAFE' : 'white',
            borderColor: dragOverDate?.toDateString() === date.toDateString() ? '#3B82F6' : '#E5E7EB',
            borderWidth: dragOverDate?.toDateString() === date.toDateString() ? '2px' : '1px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isToday && !dragOverDate) e.currentTarget.style.backgroundColor = '#F9FAFB';
          }}
          onMouseLeave={(e) => {
            if (!isToday && !dragOverDate) e.currentTarget.style.backgroundColor = 'white';
          }}
          onDragOver={(e) => handleDragOver(e, date)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, date)}
          onClick={(e) => {
            // Don't open modal if clicking on an event
            if (e.target === e.currentTarget || e.target.classList.contains('day-number')) {
              handleDateClick(date);
            }
          }}
        >
          <div style={{ 
            fontWeight: '600',
            color: isToday ? '#92400E' : '#374151',
            marginBottom: '4px',
            className: 'day-number'
          }}>
            {day}
          </div>
          <div style={{ fontSize: '13.8px' }}>
            
            {dayJobs.slice(0, 2).map((job, index) => (
              <div key={job.id} style={{ position: 'relative' }}>
                <div
                  draggable
                  onClick={(e) => handleJobClick(e, job)}
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                  style={{
                    backgroundColor: job.color,
                    color: 'white',
                    padding: '2px 4px',
                    marginBottom: '2px',
                    borderRadius: '3px',
                    cursor: 'move',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '12.65px',
                    position: 'relative',
                    opacity: draggedJob?.id === job.id ? 0.5 : 1,
                    transition: 'opacity 0.2s'
                  }}
                  title={`${job.title}${job.customerName ? ' - ' + job.customerName : ''} (Drag to reschedule)${job.parentJobId ? ' - Recurring' : ''}`}
                >
                  {job.parentJobId && <span style={{ marginRight: '4px' }}>🔁</span>}
                  {job.entryType === 'personal' && <span style={{ marginRight: '4px' }}>🏠</span>}
                  {job.entryType === 'work' ? `${job.workers.join(', ')}: ${job.title}` : job.title}
                </div>
                
                {/* Edit Menu */}
                {showEditMenu === job.id && (
                  <>
                    {/* Backdrop */}
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        zIndex: 999
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEditMenu(null);
                      }}
                    />
                    {/* Menu */}
                    <div style={{
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                      zIndex: 1000,
                      minWidth: '200px',
                      maxWidth: '90vw'
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #E5E7EB',
                        fontWeight: '600',
                        fontSize: '16.1px',
                        color: '#374151'
                      }}>
                        {job.title}
                      </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${job.id}`);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13.8px',
                        color: '#374151'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      👁️ View Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditJob(job);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13.8px',
                        color: '#374151'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13.8px',
                        color: '#DC2626'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                  </>
                )}
              </div>
            ))}
            {dayJobs.length > 2 && (
              <div style={{ fontSize: '12.65px', color: '#6B7280', fontStyle: 'italic' }}>
                +{dayJobs.length - 2} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const hours = Array.from({ length: 13 }, (_, i) => i + 6); // 6 AM to 6 PM

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Time column and day headers */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: '60px' }} /> {/* Empty space for time column */}
          {weekDays.map(day => {
            const isToday = new Date().toDateString() === day.toDateString();
            return (
              <div
                key={day.toISOString()}
                style={{
                  flex: 1,
                  padding: '12px',
                  textAlign: 'center',
                  borderLeft: '1px solid #E5E7EB',
                  backgroundColor: isToday ? '#FEF3C7' : '#F9FAFB',
                  fontWeight: '600'
                }}
              >
                <div style={{ fontSize: '13.8px', color: '#6B7280' }}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: '20.7px', color: isToday ? '#92400E' : '#374151' }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time slots */}
        {hours.map(hour => (
          <div key={hour} style={{ display: 'flex', borderTop: '1px solid #E5E7EB' }}>
            <div style={{
              width: '60px',
              padding: '20px 8px',
              fontSize: '13.8px',
              color: '#6B7280',
              textAlign: 'right',
              borderRight: '1px solid #E5E7EB'
            }}>
              {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
            </div>
            {weekDays.map(day => {
              const dayJobs = getJobsForDate(day) || [];
              const isToday = new Date().toDateString() === day.toDateString();
              
              return (
                <div
                  key={`${hour}-${day.toISOString()}`}
                  style={{
                    flex: 1,
                    minHeight: '60px',
                    padding: '4px',
                    borderLeft: '1px solid #E5E7EB',
                    backgroundColor: isToday ? '#FFFBEB' : dragOverDate?.toDateString() === day.toDateString() ? '#DBEAFE' : 'white',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => handleDateClick(day)}
                  onDragOver={(e) => handleDragOver(e, day)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  
                  {dayJobs.map(job => (
                    <div
                      key={job.id}
                      draggable
                      onClick={(e) => handleJobClick(e, job)}
                      onDragStart={(e) => handleDragStart(e, job)}
                      onDragEnd={handleDragEnd}
                      style={{
                        backgroundColor: job.color,
                        color: 'white',
                        padding: '4px',
                        marginBottom: '2px',
                        borderRadius: '4px',
                        fontSize: '12.65px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'move',
                        opacity: draggedJob?.id === job.id ? 0.5 : 1,
                        transition: 'opacity 0.2s'
                      }}
                      title={`${job.title}${job.customerName ? ' - ' + job.customerName : ''} (Drag to reschedule)`}
                    >
                      {job.entryType === 'personal' && <span style={{ marginRight: '4px' }}>🏠</span>}
                      {job.entryType === 'work' ? `${job.workers.join(', ')}: ${job.title}` : job.title}
                    </div>
                  ))}
                  
                  {/* Edit Menu - reuse same logic */}
                  {dayJobs.map(job => showEditMenu === job.id && (
                    <React.Fragment key={`menu-${job.id}`}>
                      {/* Backdrop */}
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          zIndex: 999
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditMenu(null);
                        }}
                      />
                      {/* Menu */}
                      <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                        zIndex: 1000,
                        minWidth: '200px',
                        maxWidth: '90vw'
                      }}>
                        <div style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #E5E7EB',
                          fontWeight: '600',
                          fontSize: '16.1px',
                          color: '#374151'
                        }}>
                          {job.title}
                        </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/jobs/${job.id}`);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13.8px',
                          color: '#374151'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        👁️ View Details
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditJob(job);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13.8px',
                          color: '#374151'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13.8px',
                          color: '#DC2626'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                    </React.Fragment>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderDayView = () => {
    const dayJobs = getJobsForDate(currentDate) || [];
    const hours = Array.from({ length: 13 }, (_, i) => i + 6); // 6 AM to 6 PM
    const isToday = new Date().toDateString() === currentDate.toDateString();

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '600px' // Fixed height for container
      }}>
        {/* Day header */}
        <div style={{
          padding: '16px',
          backgroundColor: isToday ? '#FEF3C7' : '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          textAlign: 'center',
          flexShrink: 0
        }}>
          <h3 style={{ margin: 0, fontSize: '23px', fontWeight: '600', color: isToday ? '#92400E' : '#374151' }}>
            {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </h3>
          <button
            onClick={() => handleDateClick(currentDate)}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13.8px'
            }}
          >
            + Add Job
          </button>
        </div>

        {/* Time slots - scrollable container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {hours.map(hour => (
          <div key={hour} style={{
            display: 'flex',
            borderBottom: '1px solid #E5E7EB',
            minHeight: '80px'
          }}>
            <div style={{
              width: '80px',
              padding: '20px 12px',
              fontSize: '16.1px',
              color: '#6B7280',
              textAlign: 'right',
              borderRight: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB'
            }}>
              {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`}
            </div>
            <div style={{
              flex: 1,
              padding: '8px',
              backgroundColor: isToday ? '#FFFBEB' : 'white',
              position: 'relative'
            }}>
              {dayJobs.map(job => (
                <div key={job.id}>
                  <div
                    draggable
                    onClick={(e) => handleJobClick(e, job)}
                    onDragStart={(e) => handleDragStart(e, job)}
                    onDragEnd={handleDragEnd}
                    style={{
                      backgroundColor: job.color,
                      color: 'white',
                      padding: '8px 12px',
                      marginBottom: '4px',
                      borderRadius: '6px',
                      cursor: 'move',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      opacity: draggedJob?.id === job.id ? 0.5 : 1,
                      transition: 'opacity 0.2s'
                    }}
                    title={`Drag to reschedule ${job.title}`}
                  >
                    <div style={{ fontWeight: '600', fontSize: '16.1px', marginBottom: '4px' }}>
                      {job.entryType === 'personal' && <span style={{ marginRight: '4px' }}>🏠</span>}
                      {job.title}
                    </div>
                    <div style={{ fontSize: '13.8px', opacity: 0.9 }}>
                      {job.entryType === 'work' ? 
                        `${job.customerName} • ${job.workers.join(', ')}` : 
                        'Personal Entry'
                      }
                    </div>
                    {job.description && (
                      <div style={{ fontSize: '12.65px', marginTop: '4px', opacity: 0.8 }}>
                        {job.description}
                      </div>
                    )}
                  </div>
                  
                  {/* Edit Menu */}
                  {showEditMenu === job.id && (
                    <div style={{
                      position: 'absolute',
                      top: '40px',
                      left: '20px',
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      zIndex: 10,
                      minWidth: '120px'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/jobs/${job.id}`);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13.8px',
                          color: '#374151'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        👁️ View Details
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditJob(job);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13.8px',
                          color: '#374151'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '13.8px',
                          color: '#DC2626'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>
    );
  };

  const renderGanttView = () => {
    // Get date range for current month
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    
    // Shared function to determine if a day is past - used by both header and grid
    const isDayPast = (day) => {
      const now = new Date();
      const todayNum = now.getDate();
      const isCurrentMonth = currentDate.getMonth() === now.getMonth() && 
                            currentDate.getFullYear() === now.getFullYear();
      return isCurrentMonth && day <= (todayNum - 2); // 2 or more days ago
    };
    
    // Filter jobs that occur in current month
    const monthJobs = (allJobs || []).filter(job => {
      const jobStart = new Date(job.startDate);
      const jobEnd = new Date(job.endDate);
      return (jobStart <= endOfMonth && jobEnd >= startOfMonth);
    });

    // Group jobs by worker
    const jobsByWorker = {};
    workers.forEach(worker => {
      jobsByWorker[worker] = monthJobs.filter(job => job.workers.includes(worker));
    });

    // Generate array of dates for the month
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(i);
    }


    return (
      <div 
        id="gantt-scroll-container"
        style={{ 
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: '-ms-autohiding-scrollbar',
          scrollbarWidth: 'thin'
        }}
      >
        <div style={{ minWidth: '1000px' }}>
          {/* Header with dates */}
          <div style={{ display: 'flex', borderBottom: '2px solid #E5E7EB' }}>
            <div style={{ 
              width: '120px', 
              padding: '12px',
              backgroundColor: '#F9FAFB',
              fontWeight: '600',
              borderRight: '1px solid #E5E7EB'
            }}>
              Worker
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              {dates.map(day => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isPast = isDayPast(day);
                
                return (
                  <div
                    key={day}
                    style={{
                      flex: 1,
                      minWidth: '30px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontSize: '13.8px',
                      backgroundColor: isPast ? '#E5E7EB' : isWeekend ? '#F9FAFB' : 'white',
                      borderRight: '1px solid #E5E7EB',
                      fontWeight: '400',
                      color: isPast ? '#6B7280' : '#374151',
                      borderTop: 'none'
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Worker rows */}
          {workers.map(worker => (
            <div key={worker} style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{
                width: '120px',
                padding: '16px 12px',
                backgroundColor: '#F9FAFB',
                fontWeight: '500',
                borderRight: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: workerColors[worker],
                  borderRadius: '2px'
                }} />
                {worker}
              </div>
              <div style={{ flex: 1, position: 'relative', height: '50px' }}>
                {/* Date grid lines */}
                <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                  {dates.map(day => {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isPast = isDayPast(day);
                    
                    return (
                      <div
                        key={day}
                        style={{
                          flex: 1,
                          borderRight: '1px solid #E5E7EB',
                          backgroundColor: isPast ? '#E5E7EB' : isWeekend ? '#FAFAFA' : 'transparent'
                        }}
                      />
                    );
                  })}
                </div>
                
                {/* Jobs */}
                {jobsByWorker[worker].map(job => {
                  const jobStart = new Date(job.startDate);
                  const jobEnd = new Date(job.endDate);
                  
                  // Calculate position and width
                  let startDay = jobStart.getDate();
                  let endDay = jobEnd.getDate();
                  
                  // Handle jobs that start before this month
                  if (jobStart < startOfMonth) {
                    startDay = 1;
                  }
                  
                  // Handle jobs that end after this month
                  if (jobEnd > endOfMonth) {
                    endDay = daysInMonth;
                  }
                  
                  const left = ((startDay - 1) / daysInMonth) * 100;
                  const width = ((endDay - startDay + 1) / daysInMonth) * 100;
                  
                  return (
                    <div
                      key={job.id}
                      onClick={(e) => handleJobClick(e, job)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        height: '34px',
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: job.color,
                        borderRadius: '4px',
                        padding: '4px 8px',
                        color: 'white',
                        fontSize: '13.8px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={`${job.title}${job.customerName ? ' - ' + job.customerName : ''}`}
                    >
                      {job.entryType === 'personal' && <span style={{ marginRight: '4px', fontSize: '11px' }}>🏠</span>}
                      {job.title}
                    </div>
                  );
                })}
                
                {/* Edit Menu */}
                {jobsByWorker[worker].map(job => showEditMenu === job.id && (
                  <div key={`menu-${job.id}`} style={{
                    position: 'absolute',
                    top: '50px',
                    left: '50px',
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 10,
                    minWidth: '120px'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${job.id}`);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13.8px',
                        color: '#374151'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      👁️ View Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditJob(job);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13.8px',
                        color: '#374151'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13.8px',
                        color: '#DC2626'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div 
      style={{ 
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '100px' // Extra padding for iOS scrolling
      }}
      onClick={() => setShowEditMenu(null)}
    >
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
            Schedule
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => loadJobs()}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: isLoading ? '#9CA3AF' : '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? 'Syncing...' : '🔄 Sync'}
          </button>
          <button
            onClick={() => handleDateClick(new Date())}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16.1px'
            }}
          >
            + New Event
          </button>
        </div>
        </div>

        {/* View Switcher */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {['month', 'week', 'day', 'gantt'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '10px 20px',
                backgroundColor: view === v ? '#3B82F6' : 'white',
                color: view === v ? 'white' : '#374151',
                border: `1px solid ${view === v ? '#3B82F6' : '#E5E7EB'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18.4px',
                fontWeight: view === v ? '500' : '400',
                textTransform: 'capitalize',
                minHeight: '44px', // iOS minimum touch target
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Calendar Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => {
              if (view === 'month' || view === 'gantt') navigateMonth(-1);
              else if (view === 'week') navigateWeek(-1);
              else if (view === 'day') navigateDay(-1);
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: '#F3F4F6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16.1px'
            }}
          >
            ← Previous
          </button>
          
          <h2 style={{ fontSize: '23px', fontWeight: '600', margin: 0 }}>
            {view === 'month' && getMonthName(currentDate)}
            {view === 'week' && getWeekRange(currentDate)}
            {view === 'day' && currentDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {view === 'gantt' && `${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - Gantt Chart`}
          </h2>
          
          <button
            onClick={() => {
              if (view === 'month' || view === 'gantt') navigateMonth(1);
              else if (view === 'week') navigateWeek(1);
              else if (view === 'day') navigateDay(1);
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: '#F3F4F6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16.1px'
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {view === 'month' && (
          <>
            {/* Weekday Headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              backgroundColor: '#F9FAFB',
              borderBottom: '1px solid #E5E7EB'
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div
                  key={day}
                  style={{
                    padding: '12px',
                    fontWeight: '600',
                    fontSize: '16.1px',
                    textAlign: 'center',
                    color: '#374151'
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)'
            }}>
              {renderCalendarDays()}
            </div>
          </>
        )}

        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
        {view === 'gantt' && renderGanttView()}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ fontSize: '18.4px', fontWeight: '600', marginBottom: '12px' }}>
          Legend
        </h3>
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '16.1px', fontWeight: '500', marginBottom: '8px' }}>Entry Types</h4>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>💼</span>
              <span style={{ fontSize: '16.1px' }}>Work Entry</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏠</span>
              <span style={{ fontSize: '16.1px' }}>Personal Entry</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#9333EA', borderRadius: '4px' }} />
              <span style={{ fontSize: '16.1px' }}>Personal Color</span>
            </div>
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: '16.1px', fontWeight: '500', marginBottom: '8px' }}>Workers</h4>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {workers.map(workerName => (
              <div key={workerName} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: workerColors[workerName], borderRadius: '4px' }} />
                <span style={{ fontSize: '16.1px' }}>{workerName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Event Modal */}
      {showJobModal && (
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
            padding: '24px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ fontSize: '23px', fontWeight: '600', marginBottom: '20px' }}>
              Add Schedule Event
            </h2>
            {/* Version indicator for debugging */}
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '10px' }}>
              v2 - Database Enabled
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              
              try {
                // Create the event data with proper timezone handling
                const eventData = {
                  title: newEvent.title,
                  description: newEvent.description || '',
                  eventType: newEvent.type,
                  startDate: convertLocalDateToUTC(newEvent.startDate),
                  endDate: convertLocalDateToUTC(newEvent.endDate),
                  customerId: newEvent.type === 'work' ? newEvent.customerId : undefined,
                  workers: newEvent.type === 'work' ? newEvent.workers : undefined
                };
                
                // Create the schedule event
                await scheduleEventsApi.create(eventData);
                
                // Show success message
                toast.success(`${newEvent.type === 'work' ? 'Work' : 'Personal'} event created successfully!`);
                
                // Reload the calendar
                await loadJobs();
                
                // Close the modal and reset form
                setShowJobModal(false);
                setSelectedDate(null);
                setNewEvent({
                  title: '',
                  startDate: '',
                  endDate: '',
                  description: '',
                  type: 'personal',
                  customerId: '',
                  workers: []
                });
              } catch (error) {
                console.error('Error creating schedule event:', error);
                // Show more detailed error message
                if (error.response?.data?.error) {
                  toast.error(`Failed to create event: ${error.response.data.error}`);
                } else if (error.message) {
                  toast.error(`Failed to create event: ${error.message}`);
                } else {
                  toast.error('Failed to create event. Please try again.');
                }
              }
            }}>
              {/* Event Type Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '16.1px', fontWeight: '500' }}>
                  Event Type
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, type: 'personal', customerId: '', workers: [] })}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: newEvent.type === 'personal' ? '#9333EA' : 'white',
                      color: newEvent.type === 'personal' ? 'white' : '#374151',
                      border: `2px solid ${newEvent.type === 'personal' ? '#9333EA' : '#E5E7EB'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '16.1px',
                      fontWeight: newEvent.type === 'personal' ? '600' : '400',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🏠</span>
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, type: 'work' })}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: newEvent.type === 'work' ? '#3B82F6' : 'white',
                      color: newEvent.type === 'work' ? 'white' : '#374151',
                      border: `2px solid ${newEvent.type === 'work' ? '#3B82F6' : '#E5E7EB'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '16.1px',
                      fontWeight: newEvent.type === 'work' ? '600' : '400',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>💼</span>
                    Work
                  </button>
                </div>
              </div>

              {/* Event Title */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  {newEvent.type === 'work' ? 'Job Title' : 'Event Title'} *
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder={newEvent.type === 'work' ? "e.g., Kitchen remodel, Deck installation" : "e.g., Doctor appointment, Meeting"}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px'
                  }}
                  required
                />
              </div>

              {/* Customer - Only for work events */}
              {newEvent.type === 'work' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                    Customer *
                  </label>
                  <select
                    value={newEvent.customerId}
                    onChange={(e) => setNewEvent({ ...newEvent, customerId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '16.1px',
                      backgroundColor: 'white'
                    }}
                    required={newEvent.type === 'work'}
                  >
                    <option value="">Select a customer...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Workers - Only for work events */}
              {newEvent.type === 'work' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                    Assign Workers
                  </label>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {workers.map(worker => (
                      <label
                        key={worker}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '6px',
                          backgroundColor: newEvent.workers.includes(worker) ? '#EBF5FF' : 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          value={worker}
                          checked={newEvent.workers.includes(worker)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewEvent({ ...newEvent, workers: [...newEvent.workers, worker] });
                            } else {
                              setNewEvent({ ...newEvent, workers: newEvent.workers.filter(w => w !== worker) });
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: newEvent.workers.includes(worker) ? '500' : '400' }}>
                          {worker}
                        </span>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: workerColors[worker],
                          borderRadius: '3px'
                        }} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Range */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Event Dates
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#6B7280' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        fontSize: '16.1px'
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#6B7280' }}>
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                      min={newEvent.startDate}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        fontSize: '16.1px'
                      }}
                      required
                    />
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                  💡 Tip: Set different end date for multi-day events
                </p>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Add event details..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    resize: 'vertical'
                  }}
                />
              </div>


              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowJobModal(false);
                    setSelectedDate(null);
                    setNewEvent({
                      title: '',
                      startDate: '',
                      endDate: '',
                      description: '',
                      type: 'personal',
                      customerId: '',
                      workers: []
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#E5E7EB',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16.1px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: newEvent.type === 'work' ? '#3B82F6' : '#9333EA',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16.1px'
                  }}
                >
                  Add {newEvent.type === 'work' ? 'Work' : 'Personal'} Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleCalendar;