import { customersApi } from './api/customers.api';
import { jobsApi } from './api/jobs.api';

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
      
      // Get data exactly as the UI sees it
      const customers = await customersApi.getAll();
      const allJobs = await jobsApi.getAll();
      const workers = JSON.parse(localStorage.getItem('khs-crm-workers') || '[]');
      
      // Create backup object
      const backup: SimpleBackup = {
        id: `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        data: {
          customers,
          jobs: allJobs,
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
      console.log(`[SimpleBackup] Backed up: ${customers.length} customers, ${allJobs.length} jobs, ${workers.length} workers`);
      
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
      
      // Clear current data and replace with backup
      // This is a simple approach - just reload the page after setting data
      
      // Store the backup data to be restored
      localStorage.setItem('khs-crm-pending-restore', JSON.stringify(backup.data));
      
      // Reload the page - the init logic will handle the restore
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
      
      console.log('[SimpleBackup] Applying pending restore...');
      
      const data = JSON.parse(pendingRestore);
      
      // Clear the pending restore flag
      localStorage.removeItem('khs-crm-pending-restore');
      
      // Apply the restore by saving to the appropriate storage
      // For now, just log what would be restored
      console.log('[SimpleBackup] Would restore:', data);
      
      // TODO: Implement actual restore logic based on your storage system
      
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