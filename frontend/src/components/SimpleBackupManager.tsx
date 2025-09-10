import { useState, useEffect } from 'react';
import { simpleBackupService } from '../services/simpleBackup.service';
import { clearAllLocalStorage, debugLocalStorage, debugIndexedDB } from '../utils/clearLocalStorage';

export const SimpleBackupManager = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = () => {
    const allBackups = simpleBackupService.getBackups();
    setBackups(allBackups);
  };

  const handleCreateBackup = async () => {
    setIsLoading(true);
    try {
      await simpleBackupService.createBackup();
      loadBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    setShowConfirmDialog(null);
    await simpleBackupService.restoreBackup(backupId);
    // Page will reload automatically
  };

  const handleDelete = (backupId: string) => {
    simpleBackupService.deleteBackup(backupId);
    loadBackups();
  };

  const handleClearLocalStorage = () => {
    if (window.confirm('This will clear ALL localStorage data and reload the page. Are you sure?')) {
      clearAllLocalStorage();
      window.location.reload();
    }
  };

  const handleDebugStorage = async () => {
    debugLocalStorage();
    await debugIndexedDB();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const storageInfo = simpleBackupService.getStorageInfo();

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          Simple Backup & Restore
        </h2>
        <p style={{ color: '#6B7280', marginBottom: '16px' }}>
          Create backups of your current data and restore them when needed.
        </p>
        
        {/* Debug buttons */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#FEF3C7',
          borderRadius: '8px',
          border: '1px solid #FCD34D'
        }}>
          <p style={{ fontSize: '14px', color: '#92400E', marginBottom: '8px' }}>
            Debug Tools (Use with caution)
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDebugStorage}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Show Storage Info
            </button>
            <button
              onClick={handleClearLocalStorage}
              style={{
                padding: '6px 12px',
                backgroundColor: '#DC2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Clear All Storage
            </button>
          </div>
        </div>

        {/* Storage info and Create button */}
        <div style={{
          backgroundColor: '#F3F4F6',
          padding: '12px',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <span style={{ fontSize: '14px', color: '#4B5563' }}>
            {backups.length} backups ({storageInfo.totalSizeMB} MB)
          </span>
          <button
            onClick={handleCreateBackup}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.5 : 1
            }}
          >
            {isLoading ? 'Creating...' : 'Create Backup'}
          </button>
        </div>
      </div>

      {/* Backups list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {backups.map((backup) => (
          <div
            key={backup.id}
            style={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>
                    {formatDate(backup.timestamp)}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6B7280' }}>
                  <span>👥 {backup.data.customers.length} customers</span>
                  <span>📋 {backup.data.jobs.length} jobs</span>
                  <span>👷 {backup.data.workers.length} workers</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowConfirmDialog(backup.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#10B981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(backup.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#EF4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {backups.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6B7280'
          }}>
            No backups yet. Click "Create Backup" to get started.
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirmDialog && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>
              Confirm Restore
            </h3>
            <p style={{ color: '#4B5563', marginBottom: '20px' }}>
              This will replace all current data with the backup. The page will reload after restore. Continue?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmDialog(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#E5E7EB',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(showConfirmDialog)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};