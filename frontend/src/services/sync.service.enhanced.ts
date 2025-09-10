import { apiClient } from './api.service';
import { offlineDb } from './db.service';
import { syncBackupService } from './syncBackup.service';

interface SyncResult {
  success: boolean;
  timestamp: string;
  pulled?: {
    customers: number;
    jobs: number;
    workers: number;
  };
  pushed?: {
    customers: number;
    jobs: number;
    workers: number;
  };
  errors?: string[];
}

class EnhancedSyncService {
  private lastSyncTime: string | null = null;
  private syncing = false;
  private deviceId: string;

  constructor() {
    // Generate or get existing device ID
    this.deviceId = this.getOrCreateDeviceId();
    console.log('[EnhancedSync] Device ID:', this.deviceId);
    
    // Load last sync time from localStorage
    this.lastSyncTime = localStorage.getItem('khs-crm-last-sync-time');
    
    // Set up auto-sync
    this.setupAutoSync();
  }

  // Public method to create manual backup
  async createManualBackup(description?: string): Promise<string | null> {
    try {
      const backupId = await syncBackupService.createPreSyncSnapshot(description || 'Manual backup');
      console.log('[EnhancedSync] Manual backup created:', backupId);
      return backupId;
    } catch (error) {
      console.error('[EnhancedSync] Failed to create manual backup:', error);
      return null;
    }
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('khs-crm-device-id');
    if (!deviceId) {
      // Generate a unique device ID
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('khs-crm-device-id', deviceId);
      console.log('[EnhancedSync] Generated new device ID:', deviceId);
    }
    return deviceId;
  }

  private setupAutoSync() {
    // Sync when coming online
    window.addEventListener('online', () => {
      console.log('[EnhancedSync] Network online, triggering sync');
      this.performFullSync();
    });

    // Auto-sync every 30 seconds when online
    setInterval(() => {
      if (navigator.onLine && !this.syncing) {
        this.performFullSync();
      }
    }, 30000);

    // Initial sync if online
    if (navigator.onLine) {
      setTimeout(() => this.performFullSync(), 2000);
    }
  }

  async performFullSync(): Promise<SyncResult> {
    if (this.syncing) {
      console.log('[EnhancedSync] Sync already in progress');
      return { success: false, timestamp: new Date().toISOString() };
    }

    this.syncing = true;
    const result: SyncResult = {
      success: false,
      timestamp: new Date().toISOString(),
      errors: []
    };

    let backupId: string | null = null;

    try {
      console.log('[EnhancedSync] Starting full sync...');
      
      // Create a backup before syncing
      console.log('[EnhancedSync] Creating pre-sync backup...');
      backupId = await syncBackupService.createPreSyncSnapshot('Auto-sync backup');
      if (backupId) {
        console.log('[EnhancedSync] Backup created:', backupId);
      } else {
        console.warn('[EnhancedSync] Failed to create backup, proceeding with sync anyway');
      }

      // First pull changes from server
      const pullResult = await this.pullFromServer();
      if (pullResult.success) {
        result.pulled = pullResult.pulled;
      } else {
        result.errors?.push('Pull failed: ' + pullResult.error);
      }

      // Then push local changes to server
      const pushResult = await this.pushToServer();
      if (pushResult.success) {
        result.pushed = pushResult.pushed;
      } else {
        result.errors?.push('Push failed: ' + pushResult.error);
      }

      // Update last sync time
      this.lastSyncTime = result.timestamp;
      localStorage.setItem('khs-crm-last-sync-time', this.lastSyncTime);

      result.success = true;
      console.log('[EnhancedSync] Sync completed successfully', result);

    } catch (error) {
      console.error('[EnhancedSync] Sync failed', error);
      result.errors?.push(error instanceof Error ? error.message : 'Unknown error');
      
      // If sync failed and we have a backup, offer to restore
      if (backupId && result.errors && result.errors.length > 0) {
        console.log('[EnhancedSync] Sync failed, backup available for restore:', backupId);
        
        // Store the failed sync backup ID for potential restore
        localStorage.setItem('khs-crm-failed-sync-backup', backupId);
        
        // Dispatch event to notify UI
        window.dispatchEvent(new CustomEvent('sync-failed-with-backup', {
          detail: { backupId, errors: result.errors }
        }));
      }
    } finally {
      this.syncing = false;
    }

    return result;
  }

  private async pullFromServer(): Promise<any> {
    try {
      console.log('[EnhancedSync] Pulling from server, last sync:', this.lastSyncTime);

      const response = await apiClient.post('/api/sync/pull', {
        deviceId: this.deviceId,
        lastSyncTime: this.lastSyncTime
      });

      console.log('[EnhancedSync] Pull request with device ID:', this.deviceId);

      const { customers, jobs, workers, timestamp } = response;

      // Save to IndexedDB
      let customerCount = 0;
      let jobCount = 0;
      let workerCount = 0;

      // Process customers
      if (customers && Array.isArray(customers)) {
        for (const customer of customers) {
          await offlineDb.saveCustomer(customer);
          customerCount++;
        }
      }

      // Process jobs
      if (jobs && Array.isArray(jobs)) {
        for (const job of jobs) {
          await offlineDb.saveJob(job);
          jobCount++;
        }
      }

      // Process workers (save to localStorage since workers don't use IndexedDB)
      if (workers && Array.isArray(workers)) {
        const existingWorkers = JSON.parse(localStorage.getItem('khs-crm-workers') || '[]');
        const workerMap = new Map(existingWorkers.map((w: any) => [w.id, w]));
        
        for (const worker of workers) {
          workerMap.set(worker.id, worker);
          workerCount++;
        }
        
        localStorage.setItem('khs-crm-workers', JSON.stringify(Array.from(workerMap.values())));
      }

      console.log(`[EnhancedSync] Pulled: ${customerCount} customers, ${jobCount} jobs, ${workerCount} workers`);

      return {
        success: true,
        pulled: {
          customers: customerCount,
          jobs: jobCount,
          workers: workerCount
        }
      };
    } catch (error) {
      console.error('[EnhancedSync] Pull failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pull failed'
      };
    }
  }

  private async pushToServer(): Promise<any> {
    try {
      console.log('[EnhancedSync] Pushing to server...');

      // Get all local data that needs syncing
      const customers = await offlineDb.getUnsyncedCustomers();
      const jobs = await offlineDb.getUnsyncedJobs();
      const workers = JSON.parse(localStorage.getItem('khs-crm-workers') || '[]');

      // Filter out any temporary/local-only data and clean up internal fields
      const customersToSync = customers
        .filter((c: any) => c.id && !c.id.startsWith('local_'))
        .map((c: any) => {
          // Remove internal fields that shouldn't be sent to server
          const { _version, _lastModified, _synced, jobs, ...cleanCustomer } = c;
          return cleanCustomer;
        });
      
      const jobsToSync = jobs
        .filter((j: any) => j.id && !j.id.startsWith('local_'))
        .map((j: any) => {
          // Remove internal fields
          const { _version, _lastModified, _synced, ...cleanJob } = j;
          return cleanJob;
        });
      
      const workersToSync = workers.filter((w: any) => w.id && !w.id.startsWith('local_'));

      console.log(`[EnhancedSync] Pushing: ${customersToSync.length} customers, ${jobsToSync.length} jobs, ${workersToSync.length} workers`);

      console.log(`[EnhancedSync] Push request with device ID: ${this.deviceId}, data: ${customersToSync.length} customers, ${jobsToSync.length} jobs, ${workersToSync.length} workers`);

      const response = await apiClient.post('/api/sync/push', {
        deviceId: this.deviceId,
        customers: customersToSync,
        jobs: jobsToSync,
        workers: workersToSync,
        timestamp: new Date().toISOString()
      });

      if (response.success) {
        // Mark all synced items as synced in IndexedDB
        for (const customer of customersToSync) {
          await offlineDb.markAsSynced('customer', customer.id);
        }
        for (const job of jobsToSync) {
          await offlineDb.markAsSynced('job', job.id);
        }
      }

      return {
        success: true,
        pushed: {
          customers: customersToSync.length,
          jobs: jobsToSync.length,
          workers: workersToSync.length
        }
      };
    } catch (error) {
      console.error('[EnhancedSync] Push failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Push failed'
      };
    }
  }

  async forceSyncNow(): Promise<SyncResult> {
    console.log('[EnhancedSync] Force sync requested');
    return this.performFullSync();
  }

  getSyncStatus(): { lastSync: string | null; syncing: boolean } {
    return {
      lastSync: this.lastSyncTime,
      syncing: this.syncing
    };
  }
}

// Export singleton instance
export const enhancedSyncService = new EnhancedSyncService();