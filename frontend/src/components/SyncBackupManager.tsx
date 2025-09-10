import { useState, useEffect } from 'react';
import { syncBackupService } from '../services/syncBackup.service';

interface BackupMetadata {
  id: string;
  deviceId: string;
  timestamp: string;
  syncType: 'manual' | 'auto' | 'pre-sync';
  description?: string;
  metadata: {
    customerCount: number;
    jobCount: number;
    workerCount: number;
    totalSize: number;
  };
}

export const SyncBackupManager = () => {
  const [snapshots, setSnapshots] = useState<BackupMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ totalSizeMB: '0', count: 0 });
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);
  const [failedSyncBackupId, setFailedSyncBackupId] = useState<string | null>(null);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ removed: number; kept: number } | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{ recovered: number } | null>(null);

  useEffect(() => {
    loadSnapshots();
    
    // Listen for failed sync events
    const handleFailedSync = (event: any) => {
      const { backupId } = event.detail;
      setFailedSyncBackupId(backupId);
    };

    window.addEventListener('sync-failed-with-backup', handleFailedSync);
    
    // Check for failed sync backup on load
    const storedBackupId = localStorage.getItem('khs-crm-failed-sync-backup');
    if (storedBackupId) {
      setFailedSyncBackupId(storedBackupId);
    }

    return () => {
      window.removeEventListener('sync-failed-with-backup', handleFailedSync);
    };
  }, []);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const snaps = await syncBackupService.listSnapshots();
      setSnapshots(snaps);
      
      const info = await syncBackupService.getStorageInfo();
      setStorageInfo(info as any);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    setShowConfirmDialog(null);
    setIsRestoring(true);
    
    try {
      const success = await syncBackupService.restoreSnapshot(snapshotId);
      if (success) {
        // Clear failed sync backup ID if we restored it
        if (snapshotId === failedSyncBackupId) {
          localStorage.removeItem('khs-crm-failed-sync-backup');
          setFailedSyncBackupId(null);
        }
        
        // Reload page to reflect restored data
        window.location.reload();
      } else {
        console.error('Failed to restore snapshot');
      }
    } catch (error) {
      console.error('Restore error:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    try {
      await syncBackupService.deleteSnapshot(snapshotId);
      loadSnapshots();
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  };

  const handleCreateManualBackup = async () => {
    setIsLoading(true);
    try {
      // Debug database contents first
      await syncBackupService.debugDatabaseContents();
      
      const backupId = await syncBackupService.createPreSyncSnapshot('Manual backup');
      if (backupId) {
        loadSnapshots();
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    setShowCleanupDialog(false);
    setIsLoading(true);
    setCleanupResult(null);
    
    try {
      const result = await syncBackupService.cleanupDuplicateCustomers();
      setCleanupResult(result);
      
      // Reload page after cleanup to reflect changes
      if (result.removed > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to cleanup duplicates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAllData = async () => {
    setShowClearDialog(false);
    setIsLoading(true);
    
    try {
      const result = await syncBackupService.clearAllCustomers();
      setCleanupResult({ removed: result.removed, kept: 0 });
      
      // Reload page after clearing
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to clear all data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverJobs = async () => {
    setIsLoading(true);
    setRecoveryResult(null);
    
    try {
      const result = await syncBackupService.recoverOrphanedJobs();
      setRecoveryResult(result);
      
      // Reload page after recovery if jobs were found
      if (result.recovered > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to recover jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const getSyncTypeLabel = (type: string) => {
    switch (type) {
      case 'pre-sync': return '🔄 Pre-sync';
      case 'manual': return '👤 Manual';
      case 'auto': return '🤖 Auto';
      default: return type;
    }
  };

  if (isLoading && snapshots.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6B7280' }}>
          Loading backups...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          Sync Backup Manager
        </h2>
        <p style={{ color: '#6B7280', marginBottom: '16px' }}>
          Manage automatic backups created before each sync. You can restore to any point if something goes wrong.
        </p>
        
        {/* Storage info */}
        <div style={{
          backgroundColor: '#F3F4F6',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '14px', color: '#4B5563' }}>
            Storage: {storageInfo.totalSizeMB} MB ({storageInfo.count} backups)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreateManualBackup}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              Create Manual Backup
            </button>
            <button
              onClick={() => setShowCleanupDialog(true)}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#F59E0B',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              Clean Duplicates
            </button>
            <button
              onClick={() => setShowClearDialog(true)}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#EF4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Recover Jobs button */}
        <div style={{
          marginBottom: '16px'
        }}>
          <button
            onClick={handleRecoverJobs}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              width: '100%'
            }}
          >
            🔧 Recover Missing Jobs
          </button>
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
            If you had jobs that went missing, this will attempt to recover them from local storage.
          </p>
        </div>

        {/* Failed sync alert */}
        {failedSyncBackupId && snapshots.find(s => s.id === failedSyncBackupId) && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#DC2626', marginBottom: '8px' }}>
              ⚠️ Recent Sync Failed
            </h3>
            <p style={{ fontSize: '14px', color: '#7F1D1D', marginBottom: '12px' }}>
              A backup was created before the failed sync. You can restore your data to the state before the sync attempt.
            </p>
            <button
              onClick={() => setShowConfirmDialog(failedSyncBackupId)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#DC2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Restore Pre-Sync Backup
            </button>
          </div>
        )}
      </div>

      {/* Snapshots list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {snapshots.map((snapshot) => (
          <div
            key={snapshot.id}
            style={{
              backgroundColor: snapshot.id === failedSyncBackupId ? '#FEF2F2' : 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '500' }}>
                    {getSyncTypeLabel(snapshot.syncType)}
                  </span>
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>
                    {formatDate(snapshot.timestamp)}
                  </span>
                  {snapshot.id === failedSyncBackupId && (
                    <span style={{
                      backgroundColor: '#DC2626',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      Failed Sync
                    </span>
                  )}
                </div>
                
                {snapshot.description && (
                  <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                    {snapshot.description}
                  </p>
                )}
                
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6B7280' }}>
                  <span>📦 {snapshot.metadata.customerCount} customers</span>
                  <span>📋 {snapshot.metadata.jobCount} jobs</span>
                  <span>👷 {snapshot.metadata.workerCount} workers</span>
                  <span>💾 {formatSize(snapshot.metadata.totalSize)}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowConfirmDialog(snapshot.id)}
                  disabled={isRestoring}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#10B981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: isRestoring ? 'default' : 'pointer',
                    opacity: isRestoring ? 0.5 : 1
                  }}
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(snapshot.id)}
                  disabled={isRestoring}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#EF4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: isRestoring ? 'default' : 'pointer',
                    opacity: isRestoring ? 0.5 : 1
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {snapshots.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6B7280'
          }}>
            No backups available. Backups are created automatically before each sync.
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
              This will replace all current data with the backup. A new backup of your current data will be created first. Continue?
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
                Restore Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restoring overlay */}
      {isRestoring && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #E5E7EB',
              borderTopColor: '#3B82F6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              Restoring Backup...
            </h3>
            <p style={{ color: '#6B7280' }}>
              Please wait while we restore your data.
            </p>
          </div>
        </div>
      )}

      {/* Cleanup dialog */}
      {showCleanupDialog && (
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
              Clean Duplicate Customers
            </h3>
            <p style={{ color: '#4B5563', marginBottom: '20px' }}>
              This will remove duplicate customer entries, keeping only the newest version of each customer. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCleanupDialog(false)}
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
                onClick={handleCleanupDuplicates}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#F59E0B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Clean Duplicates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear all dialog */}
      {showClearDialog && (
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
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: '#DC2626' }}>
              ⚠️ Clear All Customer Data
            </h3>
            <p style={{ color: '#4B5563', marginBottom: '20px' }}>
              This will permanently delete ALL customers and jobs from your local database. This action cannot be undone. Are you sure?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClearDialog(false)}
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
                onClick={handleClearAllData}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery result */}
      {recoveryResult && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: recoveryResult.recovered > 0 ? '#10B981' : '#3B82F6',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1002
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Job Recovery Complete
          </h4>
          <p style={{ fontSize: '14px' }}>
            {recoveryResult.recovered > 0 
              ? `Recovered ${recoveryResult.recovered} jobs. Page will reload...`
              : `No jobs found to recover.`}
          </p>
        </div>
      )}

      {/* Cleanup result */}
      {cleanupResult && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: cleanupResult.removed > 0 ? '#10B981' : '#3B82F6',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1002
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            {cleanupResult.kept === 0 ? 'Clear Complete' : 'Cleanup Complete'}
          </h4>
          <p style={{ fontSize: '14px' }}>
            {cleanupResult.kept === 0 
              ? `Cleared ${cleanupResult.removed} customers. Page will reload...`
              : cleanupResult.removed > 0 
              ? `Removed ${cleanupResult.removed} duplicates, kept ${cleanupResult.kept} customers. Page will reload...`
              : `No duplicates found. ${cleanupResult.kept} customers in database.`}
          </p>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};