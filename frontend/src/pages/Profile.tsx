import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileStorage } from '../utils/localStorage';

const Profile = () => {
  const navigate = useNavigate();
  
  // Default profile data
  const defaultProfile = {
    // Personal Info
    name: 'Bruce Henderson',
    email: 'bruce@khsconstruction.com',
    phone: '(555) 100-2000',
    role: 'Owner',
    
    // Business Info
    businessName: 'KHS Construction & Remodeling',
    businessAbbreviation: 'KHS',
    businessLogo: '', // Logo URL or base64 data
    businessPhone: '(555) 100-2000',
    businessEmail: 'info@khsconstruction.com',
    businessAddress: '123 Construction Way, Springfield, IL 62701',
    license: 'IL-CONT-123456',
    insurance: 'Policy #INS-789012',
    
    // Preferences
    notifications: {
      email: true,
      sms: true,
      jobUpdates: true,
      materialAlerts: true,
      weeklyReport: false
    },
    
    // Working Hours
    workingHours: {
      monday: { start: '08:00', end: '17:00', enabled: true },
      tuesday: { start: '08:00', end: '17:00', enabled: true },
      wednesday: { start: '08:00', end: '17:00', enabled: true },
      thursday: { start: '08:00', end: '17:00', enabled: true },
      friday: { start: '08:00', end: '17:00', enabled: true },
      saturday: { start: '09:00', end: '14:00', enabled: true },
      sunday: { start: '', end: '', enabled: false }
    }
  };
  
  // Load profile from localStorage or use defaults
  const [profile, setProfile] = useState(() => {
    const savedProfile = profileStorage.get();
    return savedProfile || defaultProfile;
  });

  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    profileStorage.save(profile);
  }, [profile]);

  const handleSave = () => {
    setEditMode(false);
    profileStorage.save(profile);
    alert('Profile updated successfully!');
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert('New passwords do not match!');
      return;
    }
    if (passwords.new.length < 8) {
      alert('Password must be at least 8 characters!');
      return;
    }
    // In real app, validate current password and update
    alert('Password changed successfully!');
    setShowPasswordModal(false);
    setPasswords({ current: '', new: '', confirm: '' });
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: '👤' },
    { id: 'business', label: 'Business Info', icon: '🏢' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'hours', label: 'Working Hours', icon: '🕐' },
    { id: 'security', label: 'Security', icon: '🔒', isLink: true, path: '/security' },
    { id: 'reports', label: 'Reports', icon: '📊', isLink: true, path: '/reports' },
    { id: 'invoices', label: 'Invoices', icon: '💰', isLink: true, path: '/invoices' }
  ];

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
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
            Profile Settings
          </h1>
        </div>
        {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
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
              Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setEditMode(false)}
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
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16.1px'
                }}
              >
                Save Changes
              </button>
            </div>
          )}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          gap: '8px',
          borderBottom: '1px solid #E5E7EB',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.isLink && tab.path ? navigate(tab.path) : setActiveTab(tab.id)}
              style={{
                padding: '12px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '16.1px',
                fontWeight: '500',
                color: activeTab === tab.id ? '#3B82F6' : '#6B7280',
                borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '24px'
      }}>
        {/* Personal Info Tab */}
        {activeTab === 'personal' && (
          <div>
            <h2 style={{ fontSize: '20.7px', fontWeight: '600', marginBottom: '20px' }}>
              Personal Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  disabled={!editMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    backgroundColor: editMode ? 'white' : '#F9FAFB'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  disabled={!editMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    backgroundColor: editMode ? 'white' : '#F9FAFB'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  disabled={!editMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    backgroundColor: editMode ? 'white' : '#F9FAFB'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Role
                </label>
                <input
                  type="text"
                  value={profile.role}
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    backgroundColor: '#F9FAFB'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Business Info Tab */}
        {activeTab === 'business' && (
          <div>
            <h2 style={{ fontSize: '20.7px', fontWeight: '600', marginBottom: '20px' }}>
              Business Information
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Logo Section */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '16.1px', fontWeight: '500' }}>
                  Business Logo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '8px',
                    border: '2px dashed #E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F9FAFB',
                    overflow: 'hidden'
                  }}>
                    {profile.businessLogo ? (
                      <img 
                        src={profile.businessLogo} 
                        alt="Business Logo" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center' }}>
                        No Logo
                      </span>
                    )}
                  </div>
                  {editMode && (
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <input
                        type="file"
                        accept="image/*"
                        id="logo-upload"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Check file size (limit to 2MB)
                            if (file.size > 2 * 1024 * 1024) {
                              alert('Logo file size must be less than 2MB');
                              return;
                            }

                            // Create image to check dimensions
                            const img = new Image();
                            const reader = new FileReader();
                            
                            reader.onloadend = () => {
                              img.onload = () => {
                                // Create canvas to resize image
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                
                                // Set maximum dimensions
                                const maxSize = 200;
                                let width = img.width;
                                let height = img.height;
                                
                                // Calculate new dimensions
                                if (width > height) {
                                  if (width > maxSize) {
                                    height = (height * maxSize) / width;
                                    width = maxSize;
                                  }
                                } else {
                                  if (height > maxSize) {
                                    width = (width * maxSize) / height;
                                    height = maxSize;
                                  }
                                }
                                
                                // Resize image
                                canvas.width = width;
                                canvas.height = height;
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                // Convert to base64 with compression
                                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                                setProfile({ ...profile, businessLogo: compressedDataUrl });
                              };
                              
                              img.src = reader.result as string;
                            };
                            
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="logo-upload"
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#3B82F6',
                          color: 'white',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'inline-block'
                        }}
                      >
                        Upload Logo
                      </label>
                      {profile.businessLogo && (
                        <button
                          onClick={() => setProfile({ ...profile, businessLogo: '' })}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#EF4444',
                            color: 'white',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            border: 'none'
                          }}
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Business Name
                </label>
                <input
                  type="text"
                  value={profile.businessName}
                  onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                  disabled={!editMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    backgroundColor: editMode ? 'white' : '#F9FAFB'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Company Abbreviation
                </label>
                <input
                  type="text"
                  value={profile.businessAbbreviation}
                  onChange={(e) => setProfile({ ...profile, businessAbbreviation: e.target.value })}
                  disabled={!editMode}
                  placeholder="e.g., KHS"
                  maxLength={10}
                  style={{
                    width: '200px',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    backgroundColor: editMode ? 'white' : '#F9FAFB'
                  }}
                />
                <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
                  Short name used throughout the app
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.businessPhone}
                    onChange={(e) => setProfile({ ...profile, businessPhone: e.target.value })}
                    disabled={!editMode}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '16.1px',
                      backgroundColor: editMode ? 'white' : '#F9FAFB'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={profile.businessEmail}
                    onChange={(e) => setProfile({ ...profile, businessEmail: e.target.value })}
                    disabled={!editMode}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '16.1px',
                      backgroundColor: editMode ? 'white' : '#F9FAFB'
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Business Address
                </label>
                <input
                  type="text"
                  value={profile.businessAddress}
                  onChange={(e) => setProfile({ ...profile, businessAddress: e.target.value })}
                  disabled={!editMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px',
                    backgroundColor: editMode ? 'white' : '#F9FAFB'
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                    License Number
                  </label>
                  <input
                    type="text"
                    value={profile.license}
                    onChange={(e) => setProfile({ ...profile, license: e.target.value })}
                    disabled={!editMode}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '16.1px',
                      backgroundColor: editMode ? 'white' : '#F9FAFB'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                    Insurance Policy
                  </label>
                  <input
                    type="text"
                    value={profile.insurance}
                    onChange={(e) => setProfile({ ...profile, insurance: e.target.value })}
                    disabled={!editMode}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '16.1px',
                      backgroundColor: editMode ? 'white' : '#F9FAFB'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div>
            <h2 style={{ fontSize: '20.7px', fontWeight: '600', marginBottom: '20px' }}>
              Notification Preferences
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { key: 'email', label: 'Email Notifications', desc: 'Receive updates via email' },
                { key: 'sms', label: 'SMS Notifications', desc: 'Receive text message alerts' },
                { key: 'jobUpdates', label: 'Job Updates', desc: 'Get notified about job status changes' },
                { key: 'materialAlerts', label: 'Material Alerts', desc: 'Low stock and order reminders' },
                { key: 'weeklyReport', label: 'Weekly Reports', desc: 'Summary of weekly activities' }
              ].map(item => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    cursor: editMode ? 'pointer' : 'default'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '16.1px', fontWeight: '500' }}>{item.label}</div>
                    <div style={{ fontSize: '13.8px', color: '#6B7280' }}>{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.notifications[item.key]}
                    onChange={(e) => setProfile({
                      ...profile,
                      notifications: {
                        ...profile.notifications,
                        [item.key]: e.target.checked
                      }
                    })}
                    disabled={!editMode}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: editMode ? 'pointer' : 'default'
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Working Hours Tab */}
        {activeTab === 'hours' && (
          <div>
            <h2 style={{ fontSize: '20.7px', fontWeight: '600', marginBottom: '20px' }}>
              Working Hours
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {days.map(day => (
                <div
                  key={day}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px',
                    backgroundColor: profile.workingHours[day].enabled ? 'white' : '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px'
                  }}
                >
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16.1px',
                    fontWeight: '500'
                  }}>
                    <input
                      type="checkbox"
                      checked={profile.workingHours[day].enabled}
                      onChange={(e) => setProfile({
                        ...profile,
                        workingHours: {
                          ...profile.workingHours,
                          [day]: {
                            ...profile.workingHours[day],
                            enabled: e.target.checked
                          }
                        }
                      })}
                      disabled={!editMode}
                      style={{ cursor: editMode ? 'pointer' : 'default' }}
                    />
                    {dayLabels[day]}
                  </label>
                  {profile.workingHours[day].enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="time"
                        value={profile.workingHours[day].start}
                        onChange={(e) => setProfile({
                          ...profile,
                          workingHours: {
                            ...profile.workingHours,
                            [day]: {
                              ...profile.workingHours[day],
                              start: e.target.value
                            }
                          }
                        })}
                        disabled={!editMode}
                        style={{
                          padding: '6px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '4px',
                          fontSize: '16.1px'
                        }}
                      />
                      <span style={{ color: '#6B7280' }}>to</span>
                      <input
                        type="time"
                        value={profile.workingHours[day].end}
                        onChange={(e) => setProfile({
                          ...profile,
                          workingHours: {
                            ...profile.workingHours,
                            [day]: {
                              ...profile.workingHours[day],
                              end: e.target.value
                            }
                          }
                        })}
                        disabled={!editMode}
                        style={{
                          padding: '6px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '4px',
                          fontSize: '16.1px'
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div>
            <h2 style={{ fontSize: '20.7px', fontWeight: '600', marginBottom: '20px' }}>
              Security Settings
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => setShowPasswordModal(true)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16.1px',
                  fontWeight: '500',
                  textAlign: 'left'
                }}
              >
                🔑 Change Password
              </button>
              
              <div style={{
                padding: '16px',
                backgroundColor: '#F9FAFB',
                borderRadius: '6px'
              }}>
                <h3 style={{ fontSize: '16.1px', fontWeight: '500', marginBottom: '8px' }}>
                  Last Password Change
                </h3>
                <p style={{ fontSize: '16.1px', color: '#6B7280', margin: 0 }}>
                  45 days ago (October 26, 2024)
                </p>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: '6px'
              }}>
                <h3 style={{ fontSize: '16.1px', fontWeight: '500', marginBottom: '8px', color: '#92400E' }}>
                  Security Tip
                </h3>
                <p style={{ fontSize: '16.1px', color: '#92400E', margin: 0 }}>
                  Enable two-factor authentication for added security (coming soon)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
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
            maxWidth: '400px',
            width: '90%'
          }}>
            <h2 style={{ fontSize: '23px', fontWeight: '600', marginBottom: '20px' }}>
              Change Password
            </h2>
            
            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  required
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '16.1px', fontWeight: '500' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  required
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '16.1px'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswords({ current: '', new: '', confirm: '' });
                  }}
                  style={{
                    flex: 1,
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
                    flex: 1,
                    padding: '8px 16px',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16.1px'
                  }}
                >
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;