import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileStorage } from '../utils/localStorage';
import { UsersManagement } from '../components/UsersManagement';
import { useIsOwner, useUser } from '../stores/auth.store';
import { SyncBackupManager } from '../components/SyncBackupManager';

const Profile = () => {
  const navigate = useNavigate();
  const user = useUser();
  const isOwner = useIsOwner();
  
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
    businessLogoSize: 32, // Logo display size in pixels
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
    
    // App Settings
    navigationApp: 'google', // 'google', 'apple', 'waze'
    
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
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    profileStorage.save(profile);
  }, [profile]);

  const handleSave = () => {
    setEditMode(false);
    profileStorage.save(profile);
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      // Passwords don't match
      return;
    }
    if (passwords.new.length < 8) {
      // Password too short
      return;
    }
    // In real app, validate current password and update
    setShowPasswordModal(false);
    setPasswords({ current: '', new: '', confirm: '' });
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: '👤' },
    { id: 'business', label: 'Business Info', icon: '🏢' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'hours', label: 'Working Hours', icon: '🕐' },
    ...(isOwner ? [{ id: 'users', label: 'Users', icon: '👥' }] : []),
    { id: 'backup', label: 'Backup', icon: '💾' },
    { id: 'sync-backups', label: 'Sync History', icon: '🔄' },
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

  // Backup functionality
  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      setBackupProgress(0);

      const backup: any = {
        version: 1,
        timestamp: new Date().toISOString(),
        appName: 'KHS CRM',
        data: {}
      };

      // Get all localStorage data
      setBackupProgress(10);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('khs-')) {
          backup.data[key] = localStorage.getItem(key);
        }
      }

      // Get IndexedDB data
      setBackupProgress(30);
      const { openDB } = await import('idb');
      const db = await openDB('khs-crm-db', 1);
      
      // Get all object stores
      const storeNames = Array.from(db.objectStoreNames);
      backup.indexedDB = {};

      for (let i = 0; i < storeNames.length; i++) {
        const storeName = storeNames[i];
        setBackupProgress(30 + (i / storeNames.length) * 50);
        
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const allData = await store.getAll();
        backup.indexedDB[storeName] = allData;
        await tx.complete;
      }

      setBackupProgress(80);

      // Create and download file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `khs-crm-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupProgress(100);
      setTimeout(() => {
        setBackupProgress(0);
        setIsBackingUp(false);
      }, 1000);

    } catch (error) {
      console.error('Backup failed:', error);
      // alert('Backup failed. Please try again.');
      setIsBackingUp(false);
      setBackupProgress(0);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('This will replace all your current data. Are you sure you want to continue?')) {
      event.target.value = '';
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreProgress(0);

      const text = await file.text();
      const backup = JSON.parse(text);

      // Validate backup
      if (!backup.version || !backup.data || backup.appName !== 'KHS CRM') {
        throw new Error('Invalid backup file');
      }

      setRestoreProgress(10);

      // Clear existing data
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('khs-')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      setRestoreProgress(20);

      // Restore localStorage data
      for (const [key, value] of Object.entries(backup.data)) {
        localStorage.setItem(key, value as string);
      }

      setRestoreProgress(40);

      // Restore IndexedDB data
      if (backup.indexedDB) {
        const { openDB } = await import('idb');
        const db = await openDB('khs-crm-db', 1);

        const storeNames = Object.keys(backup.indexedDB);
        for (let i = 0; i < storeNames.length; i++) {
          const storeName = storeNames[i];
          setRestoreProgress(40 + (i / storeNames.length) * 40);

          if (db.objectStoreNames.contains(storeName)) {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            
            // Clear existing data
            await store.clear();
            
            // Add restored data
            const data = backup.indexedDB[storeName];
            for (const item of data) {
              await store.add(item);
            }
            
            await tx.complete;
          }
        }
      }

      setRestoreProgress(90);

      // Reload profile from restored data
      const savedProfile = profileStorage.get();
      if (savedProfile) {
        setProfile(savedProfile);
      }

      setRestoreProgress(100);
      setTimeout(() => {
        setRestoreProgress(0);
        setIsRestoring(false);
        // alert('Restore completed successfully! The app will now reload.');
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Restore failed:', error);
      // alert('Restore failed. Please ensure you selected a valid backup file.');
      setIsRestoring(false);
      setRestoreProgress(0);
    }

    event.target.value = '';
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20.7px', fontWeight: '600', margin: 0 }}>
                Business Information
              </h2>
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
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Logo Section */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '16.1px', fontWeight: '500' }}>
                  Business Logo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div 
                    onClick={() => {
                      if (editMode) {
                        document.getElementById('logo-upload')?.click();
                      }
                    }}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      border: '2px dashed #E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F9FAFB',
                      overflow: 'hidden',
                      cursor: editMode ? 'pointer' : 'default',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (editMode) {
                        e.currentTarget.style.borderColor = '#3B82F6';
                        e.currentTarget.style.backgroundColor = '#EFF6FF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                    }}
                  >
                    {profile.businessLogo ? (
                      <img 
                        src={profile.businessLogo} 
                        alt="Business Logo" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ 
                        color: editMode ? '#6B7280' : '#9CA3AF', 
                        fontSize: '14px', 
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {editMode ? (
                          <>
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span>Click to Upload</span>
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span style={{ fontSize: '12px' }}>Edit to upload</span>
                          </>
                        )}
                      </div>
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
                              // File too large
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
                                
                                // Set maximum dimensions (50% smaller = 100px instead of 200px)
                                const maxSize = 100;
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
                                
                                // Convert to base64 with higher quality (0.9 instead of 0.7)
                                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
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
              {/* Logo Size Slider - Always visible */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '16.1px', fontWeight: '500' }}>
                  Logo Display Size
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    value={profile.businessLogoSize || 32}
                    onChange={(e) => setProfile({ ...profile, businessLogoSize: parseInt(e.target.value) })}
                    disabled={!editMode}
                    style={{
                      width: '200px',
                      cursor: editMode ? 'pointer' : 'default'
                    }}
                  />
                  <span style={{ 
                    fontSize: '14px', 
                    color: '#6B7280',
                    minWidth: '45px'
                  }}>
                    {profile.businessLogoSize || 32}px
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                  Adjust how large the logo appears in the header
                </p>
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

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <h2 style={{ fontSize: '20.7px', fontWeight: '600', marginBottom: '20px' }}>
              App Settings
            </h2>
            
            {/* Navigation App Preference */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18.4px', fontWeight: '500', marginBottom: '12px' }}>
                Navigation App
              </h3>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
                Choose which app opens when you tap on customer addresses
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: profile.navigationApp === 'google' ? '#EBF5FF' : '#F9FAFB',
                  border: `2px solid ${profile.navigationApp === 'google' ? '#3B82F6' : '#E5E7EB'}`,
                  borderRadius: '8px',
                  cursor: editMode ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="navigationApp"
                    value="google"
                    checked={profile.navigationApp === 'google'}
                    onChange={(e) => setProfile({ ...profile, navigationApp: e.target.value })}
                    disabled={!editMode}
                    style={{ 
                      marginRight: '12px',
                      cursor: editMode ? 'pointer' : 'default'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🗺️</span>
                      <span style={{ fontSize: '16.1px', fontWeight: '500' }}>Google Maps</span>
                    </div>
                    <p style={{ fontSize: '13.8px', color: '#6B7280', margin: '4px 0 0 28px' }}>
                      Opens in Google Maps app or web browser
                    </p>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: profile.navigationApp === 'apple' ? '#EBF5FF' : '#F9FAFB',
                  border: `2px solid ${profile.navigationApp === 'apple' ? '#3B82F6' : '#E5E7EB'}`,
                  borderRadius: '8px',
                  cursor: editMode ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="navigationApp"
                    value="apple"
                    checked={profile.navigationApp === 'apple'}
                    onChange={(e) => setProfile({ ...profile, navigationApp: e.target.value })}
                    disabled={!editMode}
                    style={{ 
                      marginRight: '12px',
                      cursor: editMode ? 'pointer' : 'default'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🍎</span>
                      <span style={{ fontSize: '16.1px', fontWeight: '500' }}>Apple Maps</span>
                    </div>
                    <p style={{ fontSize: '13.8px', color: '#6B7280', margin: '4px 0 0 28px' }}>
                      Opens in Apple Maps (iPhone/iPad only)
                    </p>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: profile.navigationApp === 'waze' ? '#EBF5FF' : '#F9FAFB',
                  border: `2px solid ${profile.navigationApp === 'waze' ? '#3B82F6' : '#E5E7EB'}`,
                  borderRadius: '8px',
                  cursor: editMode ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="navigationApp"
                    value="waze"
                    checked={profile.navigationApp === 'waze'}
                    onChange={(e) => setProfile({ ...profile, navigationApp: e.target.value })}
                    disabled={!editMode}
                    style={{ 
                      marginRight: '12px',
                      cursor: editMode ? 'pointer' : 'default'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🚗</span>
                      <span style={{ fontSize: '16.1px', fontWeight: '500' }}>Waze</span>
                    </div>
                    <p style={{ fontSize: '13.8px', color: '#6B7280', margin: '4px 0 0 28px' }}>
                      Opens in Waze navigation app
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Test Navigation Button */}
            {!editMode && (
              <div style={{
                padding: '16px',
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                marginTop: '24px'
              }}>
                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
                  Test your navigation app preference:
                </p>
                <button
                  onClick={() => {
                    const testAddress = "1234 Test Street, Honolulu, HI 96814";
                    const encodedAddress = encodeURIComponent(testAddress);
                    
                    let url;
                    if (profile.navigationApp === 'apple') {
                      // Apple Maps URL scheme
                      url = `maps://maps.apple.com/?q=${encodedAddress}`;
                    } else if (profile.navigationApp === 'waze') {
                      // Waze URL scheme
                      url = `waze://?q=${encodedAddress}`;
                    } else {
                      // Google Maps (default)
                      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                    }
                    
                    window.open(url, '_blank');
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Test Navigation App
                </button>
              </div>
            )}
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

        {/* Users Tab (Owner only) */}
        {activeTab === 'users' && isOwner && (
          <UsersManagement currentUserId={user?.id || ''} />
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

        {/* Sync History Tab */}
        {activeTab === 'sync-backups' && (
          <SyncBackupManager />
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div>
            <h2 style={{ fontSize: '20.7px', fontWeight: '600', marginBottom: '20px' }}>
              Backup & Restore
            </h2>
            
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#EBF5FF',
                border: '1px solid #3B82F6',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '16.1px', fontWeight: '500', marginBottom: '8px', color: '#1E40AF' }}>
                  📋 About Backups
                </h3>
                <p style={{ fontSize: '14px', color: '#1E40AF', margin: 0 }}>
                  Backups include all your customers, jobs, photos, and settings. 
                  The backup file can be used to restore your data on any device.
                </p>
              </div>

              {/* Download Backup */}
              <div style={{
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '18.4px', fontWeight: '600', marginBottom: '12px' }}>
                  📥 Download Backup
                </h3>
                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
                  Create a backup file of all your data. This file will be saved to your Downloads folder.
                </p>
                
                <button
                  onClick={handleBackup}
                  disabled={isBackingUp}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: isBackingUp ? '#9CA3AF' : '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isBackingUp ? 'default' : 'pointer',
                    fontSize: '16.1px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isBackingUp ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      💾 Download Backup
                    </>
                  )}
                </button>
                
                {backupProgress > 0 && backupProgress < 100 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#E5E7EB',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${backupProgress}%`,
                        height: '100%',
                        backgroundColor: '#3B82F6',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                      {backupProgress}% complete
                    </p>
                  </div>
                )}
              </div>

              {/* Restore Backup */}
              <div style={{
                backgroundColor: '#FEF3C7',
                borderRadius: '8px',
                padding: '24px'
              }}>
                <h3 style={{ fontSize: '18.4px', fontWeight: '600', marginBottom: '12px', color: '#92400E' }}>
                  📤 Restore Backup
                </h3>
                <p style={{ fontSize: '14px', color: '#92400E', marginBottom: '16px' }}>
                  <strong>Warning:</strong> Restoring will replace all current data with the backup data.
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  style={{ display: 'none' }}
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: isRestoring ? '#9CA3AF' : '#F59E0B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isRestoring ? 'default' : 'pointer',
                    fontSize: '16.1px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isRestoring ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Restoring...
                    </>
                  ) : (
                    <>
                      📂 Select Backup File
                    </>
                  )}
                </button>
                
                {restoreProgress > 0 && restoreProgress < 100 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#FED7AA',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${restoreProgress}%`,
                        height: '100%',
                        backgroundColor: '#F59E0B',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <p style={{ fontSize: '12px', color: '#92400E', marginTop: '4px' }}>
                      {restoreProgress}% complete
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Add CSS animation */}
            <style>
              {`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}
            </style>
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