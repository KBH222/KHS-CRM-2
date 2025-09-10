// Removed customersApi import - reading directly from IndexedDB

interface SimpleBackup {
  id: string;
  timestamp: string;
  data: {
    customers: any[];
    jobs: any[];
    workers: any[];
  };
}

class SimpleBackupService {
  private readonly BACKUP_KEY = 'khs-crm-simple-backups';
  private readonly MAX_BACKUPS = 5;

  // Create a backup of exactly what the UI shows
  async createBackup(description: string = 'Manual backup'): Promise<string> {
    try {
      console.log('[SimpleBackup] Creating backup...');
      
      // Get data directly from IndexedDB to avoid API overwriting
      const { offlineDb } = await import('./db.service');
      const customers = await offlineDb.getCustomers();
      console.log('[SimpleBackup] Customers from IndexedDB:', customers.length, customers);
      
      // Get jobs directly from IndexedDB to avoid localStorage issues
      const allJobs = await offlineDb.getJobs();
      
      // Filter jobs to only include those for active customers
      const customerIds = new Set(customers.map(c => c.id));
      const jobs = allJobs.filter(job => customerIds.has(job.customerId));
      
      console.log('[SimpleBackup] Jobs from IndexedDB:', allJobs.length, 'total,', jobs.length, 'for active customers');
      
      const workers = JSON.parse(localStorage.getItem('khs-crm-workers') || '[]');
      console.log('[SimpleBackup] Workers from localStorage:', workers.length, workers);
      
      // Create backup object
      const backup: SimpleBackup = {
        id: `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        data: {
          customers,
          jobs,
          workers
        }
      };
      
      // Get existing backups
      const existingBackups = this.getBackups();
      
      // Add new backup to the beginning
      existingBackups.unshift(backup);
      
      // Keep only the most recent backups
      while (existingBackups.length > this.MAX_BACKUPS) {
        existingBackups.pop();
      }
      
      // Save to localStorage
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(existingBackups));
      
      console.log(`[SimpleBackup] Backup created: ${backup.id}`);
      console.log(`[SimpleBackup] Backed up: ${customers.length} customers, ${jobs.length} jobs, ${workers.length} workers`);
      
      return backup.id;
    } catch (error) {
      console.error('[SimpleBackup] Failed to create backup:', error);
      throw error;
    }
  }

  // Get all backups
  getBackups(): SimpleBackup[] {
    try {
      const stored = localStorage.getItem(this.BACKUP_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[SimpleBackup] Failed to get backups:', error);
      return [];
    }
  }

  // Restore from a backup
  async restoreBackup(backupId: string): Promise<boolean> {
    try {
      console.log(`[SimpleBackup] Restoring backup: ${backupId}`);
      
      // Find the backup
      const backups = this.getBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        console.error('[SimpleBackup] Backup not found');
        return false;
      }
      
      console.log('[SimpleBackup] Found backup with data:', {
        customers: backup.data.customers.length,
        jobs: backup.data.jobs.length,
        workers: backup.data.workers.length
      });
      
      // Store the backup data to be restored
      localStorage.setItem('khs-crm-pending-restore', JSON.stringify(backup.data));
      console.log('[SimpleBackup] Stored pending restore data');
      
      // Clear React Query cache before reloading
      try {
        const queryClient = (window as any).__REACT_QUERY_CLIENT__;
        if (queryClient) {
          queryClient.clear();
          console.log('[SimpleBackup] Cleared React Query cache');
        }
      } catch (e) {
        console.log('[SimpleBackup] Could not clear React Query cache');
      }
      
      // Reload the page - the init logic will handle the restore
      console.log('[SimpleBackup] Reloading page...');
      window.location.reload();
      
      return true;
    } catch (error) {
      console.error('[SimpleBackup] Failed to restore backup:', error);
      return false;
    }
  }

  // Check if there's a pending restore and apply it
  async checkPendingRestore(): Promise<boolean> {
    try {
      const pendingRestore = localStorage.getItem('khs-crm-pending-restore');
      if (!pendingRestore) {
        return false;
      }
      
      console.log('[SimpleBackup] Found pending restore data');
      
      const data = JSON.parse(pendingRestore);
      console.log('[SimpleBackup] Pending restore contains:', {
        customers: data.customers?.length || 0,
        jobs: data.jobs?.length || 0,
        workers: data.workers?.length || 0
      });
      
      // Clear the pending restore flag first
      localStorage.removeItem('khs-crm-pending-restore');
      
      // Import the db service to restore data
      const { offlineDb } = await import('./db.service');
      
      // Clear existing data
      console.log('[SimpleBackup] Clearing existing data...');
      await offlineDb.clearAllData();
      
      // Restore customers
      if (data.customers && data.customers.length > 0) {
        console.log('[SimpleBackup] Restoring', data.customers.length, 'customers');
        await offlineDb.bulkSaveCustomers(data.customers);
        console.log('[SimpleBackup] Customers restored');
      }
      
      // Restore jobs
      if (data.jobs && data.jobs.length > 0) {
        console.log('[SimpleBackup] Restoring', data.jobs.length, 'jobs');
        await offlineDb.bulkSaveJobs(data.jobs);
        console.log('[SimpleBackup] Jobs restored');
      }
      
      // Restore workers
      if (data.workers && data.workers.length > 0) {
        console.log('[SimpleBackup] Restoring', data.workers.length, 'workers');
        localStorage.setItem('khs-crm-workers', JSON.stringify(data.workers));
        console.log('[SimpleBackup] Workers restored');
      }
      
      // Also clear any stale localStorage data that might interfere
      localStorage.removeItem('khs-crm-jobs'); // Remove stale jobs cache
      localStorage.removeItem('khs-crm-customers'); // Remove stale customers cache
      
      // Verify data was actually saved
      const verifyCustomers = await offlineDb.getCustomers();
      const verifyJobs = await offlineDb.getJobs();
      console.log('[SimpleBackup] Verification - Customers in DB:', verifyCustomers.length);
      console.log('[SimpleBackup] Verification - Jobs in DB:', verifyJobs.length);
      
      // Set a flag to skip API sync on next load
      localStorage.setItem('khs-crm-skip-sync-once', 'true');
      
      console.log('[SimpleBackup] Restore complete, data verified in IndexedDB');
      return true;
    } catch (error) {
      console.error('[SimpleBackup] Failed to apply pending restore:', error);
      localStorage.removeItem('khs-crm-pending-restore');
      return false;
    }
  }

  // Delete a backup
  deleteBackup(backupId: string): boolean {
    try {
      const backups = this.getBackups();
      const filteredBackups = backups.filter(b => b.id !== backupId);
      
      if (filteredBackups.length === backups.length) {
        return false; // Backup not found
      }
      
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(filteredBackups));
      console.log(`[SimpleBackup] Deleted backup: ${backupId}`);
      return true;
    } catch (error) {
      console.error('[SimpleBackup] Failed to delete backup:', error);
      return false;
    }
  }

  // Get storage info
  getStorageInfo() {
    const backups = this.getBackups();
    const totalSize = JSON.stringify(backups).length;
    
    return {
      count: backups.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
    };
  }
}

// Export singleton instance
export const simpleBackupService = new SimpleBackupService();