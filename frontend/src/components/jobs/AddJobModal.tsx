/**
 * AddJobModal Component
 * 
 * Modal for creating and editing jobs in the CRM system.
 * Features:
 * - Multiple tabs for different job aspects (Tasks, Lists, Photos, Plans, Notes, Comments)
 * - Drag and drop file upload for photos and documents
 * - Image compression for photos
 * - Real-time validation and unsaved changes tracking
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { compressImage } from '../../utils/imageCompression';
import { Job, Photo, Document, CreateJobDTO } from '../../types';

interface AddJobModalProps {
  customer: {
    id: string;
    name: string;
    address: string;
  };
  onClose: () => void;
  onSave: (job: any) => void;
  existingJob?: Job | null;
  onDelete?: (jobId: string) => void;
  onJobUpdate?: (job: Job) => void;
}

interface TabConfig {
  id: string;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'description', label: 'Tasks', icon: '📋' },
  { id: 'lists', label: 'Lists', icon: '📑' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'plans', label: 'Plans', icon: '📐' },
  { id: 'notes', label: 'Notes', icon: '📝' },
  { id: 'comments', label: 'Extra $', icon: '💬' }
];

const JOB_TITLES = [
  'Kitchen',
  'Bathroom', 
  'Flooring',
  'Various Repairs'
];

export const AddJobModal: React.FC<AddJobModalProps> = ({ 
  customer, 
  onClose, 
  onSave, 
  existingJob = null, 
  onDelete = null, 
  onJobUpdate = null 
}) => {
  
  const [activeTab, setActiveTab] = useState('description');
  const [currentJobId, setCurrentJobId] = useState(existingJob?.id || null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | Document | null>(null);
  
  // Drag-drop states
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingPlans, setIsDraggingPlans] = useState(false);
  
  const [jobData, setJobData] = useState({
    id: existingJob?.id || null,
    title: existingJob?.title || '',
    description: existingJob?.description || '',
    status: existingJob?.status || 'pending',
    priority: 'medium',
    startDate: null,
    endDate: null,
    completedDate: null,
    customerId: existingJob?.customerId || customer?.id,
    photos: existingJob?.photos || [],
    plans: existingJob?.plans || [],
    notes: existingJob?.notes || '',
    comments: existingJob?.comments || [],
    commentsText: '',
    lists: existingJob?.lists || ''
  });

  // Update job data when existingJob changes
  useEffect(() => {
    if (existingJob) {
      setJobData({
        id: existingJob.id,
        title: existingJob.title || '',
        description: existingJob.description || '',
        status: existingJob.status || 'pending',
        priority: 'medium',
        startDate: null,
        endDate: null,
        completedDate: null,
        customerId: existingJob.customerId || customer?.id,
        photos: existingJob.photos || [],
        plans: existingJob.plans || [],
        notes: existingJob.notes || '',
        comments: existingJob.comments || [],
        commentsText: '',
        lists: existingJob.lists || ''
      });
      setCurrentJobId(existingJob.id);
    }
  }, [existingJob, customer]);

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
    if (e.currentTarget === e.target) {
      setIsDraggingPhotos(false);
    }
  };
  
  const handlePhotoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhotos(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Please drop image files only');
      return;
    }
    
    await processPhotoFiles(imageFiles);
  };
  
  // Drag-drop handlers for Plans
  const handlePlanDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingPlans(true);
  };
  
  const handlePlanDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDraggingPlans(false);
    }
  };
  
  const handlePlanDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlans(false);
    
    const files = Array.from(e.dataTransfer.files);
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const validFiles = files.filter(file => 
      allowedTypes.includes(file.type) || file.type.startsWith('image/')
    );
    
    if (validFiles.length === 0) {
      toast.error('Please drop PDF, image, or document files only');
      return;
    }
    
    await processPlanFiles(validFiles);
  };
  
  // Process photo files
  const processPhotoFiles = async (files: File[]) => {
    if (!jobData.title && !existingJob) {
      toast.error('Please enter a job title first');
      return;
    }
    
    const loadingToast = toast.info('Compressing photos...', { autoClose: 3000 });
    
    try {
      const newPhotos = [];
      for (const file of files) {
        const compressedUrl = await compressImage(file, 1920, 1080, 0.7);
        const newPhoto = {
          id: String(Date.now() + Math.random()),
          url: compressedUrl,
          name: file.name
        };
        newPhotos.push(newPhoto);
      }
      
      setJobData(prev => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos]
      }));
      
      toast.dismiss(loadingToast);
      toast.success(`${files.length} photo(s) added`);
      setUnsavedChanges(true);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to process some photos');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processPhotoFiles(files);
    e.target.value = '';
  };
  
  // Process plan files
  const processPlanFiles = async (files: File[]) => {
    if (!jobData.title && !existingJob) {
      toast.error('Please enter a job title first');
      return;
    }
    
    const loadingToast = toast.info('Processing documents...', { autoClose: 3000 });
    
    try {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const compressedUrl = await compressImage(file, 1920, 1080, 0.7);
          setJobData(prev => ({
            ...prev,
            plans: [...prev.plans, {
              id: String(Date.now() + Math.random()),
              url: compressedUrl,
              name: file.name,
              type: file.type
            }]
          }));
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            setJobData(prev => ({
              ...prev,
              plans: [...prev.plans, {
                id: String(Date.now() + Math.random()),
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
      setUnsavedChanges(true);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to process some documents');
    }
  };

  const handlePlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processPlanFiles(files);
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

  // Safety check
  if (!customer || !customer.id) {
    toast.error('Error: No customer selected');
    onClose();
    return null;
  }

  // Format address for display
  const formatAddress = () => {
    const parts = customer.address.split(', ');
    if (parts.length >= 3) {
      const stateZip = parts.slice(-2).join(', ');
      const street = parts.slice(0, -2).join(', ');
      return { street, stateZip };
    }
    return { street: customer.address, stateZip: '' };
  };

  const { street, stateZip } = formatAddress();

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
        position: 'relative'
      }}>
        {/* Header */}
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
                <div style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{street}</div>
                {stateZip && (
                  <div style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>{stateZip}</div>
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
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
              
              <button
                type="button"
                onClick={async () => {
                  try {
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

        {/* Tabs */}
        <div 
          className="tabs-container"
          style={{
            display: 'flex',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            minHeight: '48px',
            flexWrap: 'nowrap',
            gap: '4px',
            padding: '0 8px'
          }}>
          {TABS.map((tab) => (
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
                flexShrink: 0,
                minWidth: 'fit-content'
              }}
            >
              {window.innerWidth > 640 && <span>{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0
        }}>
          <div style={{ 
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '20px'
          }}>
            {/* Job Description Tab */}
            {activeTab === 'description' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                    Job Title *
                  </label>
                  <select
                    value={jobData.title}
                    onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '18.4px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="">Select job type...</option>
                    {JOB_TITLES.map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={jobData.description}
                    onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
                    rows={6}
                    placeholder="Describe the work to be done..."
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
              </div>
            )}

            {/* Lists Tab */}
            {activeTab === 'lists' && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Task Lists
                </label>
                <textarea
                  value={jobData.lists}
                  onChange={(e) => setJobData({ ...jobData, lists: e.target.value })}
                  rows={10}
                  placeholder="Add task lists for this job..."
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

            {/* Photos Tab */}
            {activeTab === 'photos' && (
              <div>
                {/* Drag-Drop Zone */}
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
                    flexShrink: 0
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
                {/* Drag-Drop Zone */}
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
                    flexShrink: 0
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
                        if (plan.type && (plan.type.includes('image'))) {
                          setSelectedPhoto(plan);
                        } else {
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
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                          } catch (error) {
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