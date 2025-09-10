import { openDB, IDBPDatabase } from 'idb';

interface BackupSnapshot {
  id: string;
  deviceId: string;
  timestamp: string;
  syncType: 'manual' | 'auto' | 'pre-sync';
  description?: string;
  data: {
    customers: any[];
    jobs: any[];
    workers: any[];
    materials: any[];
    scheduleEvents: any[];
    settings: any;
  };
  metadata: {
    customerCount: number;
    jobCount: number;
    workerCount: number;
    totalSize: number;
  };
}

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

class SyncBackupService {
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'khs-crm-backups';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'snapshots';
  private readonly MAX_SNAPSHOTS = 3;
  private readonly MAX_AGE_DAYS = 7;
  private deviceId: string;

  constructor() {
    this.deviceId = this.getDeviceId();
    this.initialize();
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('khs-crm-device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('khs-crm-device-id', deviceId);
    }
    return deviceId;
  }

  async initialize() {
    try {
      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create snapshots store
          if (!db.objectStoreNames.contains('snapshots')) {
            const store = db.createObjectStore('snapshots', { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp');
            store.createIndex('deviceId', 'deviceId');
            store.createIndex('syncType', 'syncType');
          }

          // Create metadata store for quick listing
          if (!db.objectStoreNames.contains('metadata')) {
            const metaStore = db.createObjectStore('metadata', { keyPath: 'id' });
            metaStore.createIndex('timestamp', 'timestamp');
          }
        },
      });

      // Clean up old snapshots on initialization
      await this.cleanupOldSnapshots();
      
      console.log('[SyncBackup] Service initialized');
    } catch (error) {
      console.error('[SyncBackup] Failed to initialize:', error);
    }
  }

  // Create a snapshot before sync
  async createPreSyncSnapshot(description?: string): Promise<string | null> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) return null;

    try {
      console.log('[SyncBackup] Creating pre-sync snapshot...');
      
      // Gather all data from IndexedDB (primary storage in this app)
      const data = {
        customers: [],
        jobs: [],
        workers: [],
        materials: [],
        scheduleEvents: [],
        settings: {}
      };

      // Read from IndexedDB which is the primary storage
      try {
        const mainDb = await openDB('khs-crm-offline', 3);
        
        // Collect data from IndexedDB stores
        if (mainDb.objectStoreNames.contains('customers')) {
          const allCustomers = await mainDb.getAll('customers');
          // Only filter out temporary customers that haven't been synced yet
          data.customers = allCustomers.filter(c => {
            // Skip temporary customers (they haven't been synced yet)
            if (c.id && c.id.toString().startsWith('temp_')) return false;
            return true;
          });
          console.log('[SyncBackup] Read all customers from IndexedDB:', allCustomers.length);
          console.log('[SyncBackup] Non-temp customers after filtering:', data.customers.length);
          
          // Log breakdown for debugging
          const temp = allCustomers.filter(c => c.id && c.id.toString().startsWith('temp_')).length;
          console.log('[SyncBackup] Temp customers excluded:', temp);
        }
        if (mainDb.objectStoreNames.contains('jobs')) {
          const allJobs = await mainDb.getAll('jobs');
          // Filter out jobs for archived customers and temp jobs
          data.jobs = allJobs.filter(j => {
            if (j.id && j.id.toString().startsWith('temp_')) return false;
            return true;
          });
          console.log('[SyncBackup] Read jobs from IndexedDB:', allJobs.length, 'Active:', data.jobs.length);
        }
        if (mainDb.objectStoreNames.contains('materials')) {
          data.materials = await mainDb.getAll('materials');
        }
        if (mainDb.objectStoreNames.contains('scheduleEvents')) {
          data.scheduleEvents = await mainDb.getAll('scheduleEvents');
        }
        
        mainDb.close();
      } catch (error) {
        console.error('[SyncBackup] Failed to read from IndexedDB:', error);
      }

      // Workers are stored in localStorage
      const workersData = localStorage.getItem('khs-crm-workers');
      if (workersData) {
        try {
          // Handle both wrapped and unwrapped data formats
          const parsed = JSON.parse(workersData);
          if (Array.isArray(parsed)) {
            data.workers = parsed;
          } else if (parsed.data && Array.isArray(parsed.data)) {
            data.workers = parsed.data;
          } else {
            data.workers = parsed;
          }
          console.log('[SyncBackup] Read workers from localStorage:', data.workers.length);
        } catch (e) {
          console.error('[SyncBackup] Failed to parse workers data:', e);
        }
      }

      // Also backup localStorage data
      const localStorageData: any = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('khs-')) {
          localStorageData[key] = localStorage.getItem(key);
        }
      }
      data.settings = localStorageData;

      // Calculate total size (rough estimate)
      const totalSize = JSON.stringify(data).length;

      // Create snapshot
      const snapshot: BackupSnapshot = {
        id: `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        syncType: 'pre-sync',
        description: description || 'Automatic pre-sync backup',
        data,
        metadata: {
          customerCount: data.customers.length,
          jobCount: data.jobs.length,
          workerCount: data.workers.length,
          totalSize
        }
      };

      // Store snapshot
      const tx = this.db.transaction(['snapshots', 'metadata'], 'readwrite');
      await tx.objectStore('snapshots').add(snapshot);
      
      // Store metadata separately for quick access
      const metadata: BackupMetadata = {
        id: snapshot.id,
        deviceId: snapshot.deviceId,
        timestamp: snapshot.timestamp,
        syncType: snapshot.syncType,
        description: snapshot.description,
        metadata: snapshot.metadata
      };
      await tx.objectStore('metadata').add(metadata);
      await tx.complete;

      console.log(`[SyncBackup] Snapshot created: ${snapshot.id}`);
      console.log(`[SyncBackup] Data size: ${(totalSize / 1024).toFixed(2)} KB`);

      // Clean up old snapshots
      await this.cleanupOldSnapshots();

      return snapshot.id;
    } catch (error) {
      console.error('[SyncBackup] Failed to create snapshot:', error);
      return null;
    }
  }

  // List available snapshots (metadata only)
  async listSnapshots(): Promise<BackupMetadata[]> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) return [];

    try {
      const tx = this.db.transaction('metadata', 'readonly');
      const snapshots = await tx.objectStore('metadata').index('timestamp').getAll();
      
      // Sort by timestamp descending
      snapshots.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      return snapshots;
    } catch (error) {
      console.error('[SyncBackup] Failed to list snapshots:', error);
      return [];
    }
  }

  // Restore from a snapshot
  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) return false;

    try {
      console.log(`[SyncBackup] Restoring snapshot: ${snapshotId}`);
      
      // Get the full snapshot
      const snapshot = await this.db.get('snapshots', snapshotId);
      if (!snapshot) {
        console.error('[SyncBackup] Snapshot not found');
        return false;
      }

      // First, create a backup of current state before restoring
      await this.createPreSyncSnapshot('Pre-restore backup');

      // Restore to IndexedDB (primary storage)
      try {
        const mainDb = await openDB('khs-crm-offline', 3);
        
        // Restore customers
        if (mainDb.objectStoreNames.contains('customers') && snapshot.data.customers.length > 0) {
          const tx = mainDb.transaction(['customers'], 'readwrite');
          await tx.objectStore('customers').clear();
          for (const customer of snapshot.data.customers) {
            await tx.objectStore('customers').add(customer);
          }
          await tx.complete;
          console.log('[SyncBackup] Restored customers to IndexedDB:', snapshot.data.customers.length);
        }

        // Restore jobs
        if (mainDb.objectStoreNames.contains('jobs') && snapshot.data.jobs.length > 0) {
          const tx = mainDb.transaction(['jobs'], 'readwrite');
          await tx.objectStore('jobs').clear();
          for (const job of snapshot.data.jobs) {
            await tx.objectStore('jobs').add(job);
          }
          await tx.complete;
          console.log('[SyncBackup] Restored jobs to IndexedDB:', snapshot.data.jobs.length);
        }

        // Restore materials
        if (mainDb.objectStoreNames.contains('materials') && snapshot.data.materials.length > 0) {
          const tx = mainDb.transaction(['materials'], 'readwrite');
          await tx.objectStore('materials').clear();
          for (const material of snapshot.data.materials) {
            await tx.objectStore('materials').add(material);
          }
          await tx.complete;
        }

        // Restore schedule events
        if (mainDb.objectStoreNames.contains('scheduleEvents') && snapshot.data.scheduleEvents.length > 0) {
          const tx = mainDb.transaction(['scheduleEvents'], 'readwrite');
          await tx.objectStore('scheduleEvents').clear();
          for (const event of snapshot.data.scheduleEvents) {
            await tx.objectStore('scheduleEvents').add(event);
          }
          await tx.complete;
        }

        mainDb.close();
      } catch (error) {
        console.error('[SyncBackup] Error restoring IndexedDB data:', error);
      }

      // Restore workers to localStorage (as they're stored there)
      if (snapshot.data.workers && snapshot.data.workers.length > 0) {
        localStorage.setItem('khs-crm-workers', JSON.stringify(snapshot.data.workers));
        console.log('[SyncBackup] Restored workers to localStorage:', snapshot.data.workers.length);
      }

      // Restore localStorage data
      for (const [key, value] of Object.entries(snapshot.data.settings)) {
        if (key.startsWith('khs-') && value) {
          localStorage.setItem(key, value as string);
        }
      }

      console.log('[SyncBackup] Snapshot restored successfully');
      return true;
    } catch (error) {
      console.error('[SyncBackup] Failed to restore snapshot:', error);
      return false;
    }
  }

  // Delete a specific snapshot
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) return false;

    try {
      const tx = this.db.transaction(['snapshots', 'metadata'], 'readwrite');
      await tx.objectStore('snapshots').delete(snapshotId);
      await tx.objectStore('metadata').delete(snapshotId);
      await tx.complete;
      
      console.log(`[SyncBackup] Deleted snapshot: ${snapshotId}`);
      return true;
    } catch (error) {
      console.error('[SyncBackup] Failed to delete snapshot:', error);
      return false;
    }
  }

  // Clean up old snapshots
  private async cleanupOldSnapshots() {
    if (!this.db) return;

    try {
      const now = Date.now();
      const maxAge = this.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      
      // Get all metadata
      const metadata = await this.listSnapshots();
      
      // Keep only the most recent MAX_SNAPSHOTS per sync type
      const byType: { [key: string]: BackupMetadata[] } = {};
      
      for (const meta of metadata) {
        if (!byType[meta.syncType]) {
          byType[meta.syncType] = [];
        }
        byType[meta.syncType].push(meta);
      }

      const toDelete: string[] = [];

      // For each type, keep only MAX_SNAPSHOTS
      for (const type in byType) {
        const snapshots = byType[type];
        
        // Keep the most recent MAX_SNAPSHOTS
        for (let i = this.MAX_SNAPSHOTS; i < snapshots.length; i++) {
          toDelete.push(snapshots[i].id);
        }

        // Also delete any that are too old
        for (const snapshot of snapshots) {
          const age = now - new Date(snapshot.timestamp).getTime();
          if (age > maxAge) {
            toDelete.push(snapshot.id);
          }
        }
      }

      // Delete old snapshots
      if (toDelete.length > 0) {
        const tx = this.db.transaction(['snapshots', 'metadata'], 'readwrite');
        for (const id of toDelete) {
          await tx.objectStore('snapshots').delete(id);
          await tx.objectStore('metadata').delete(id);
        }
        await tx.complete;
        
        console.log(`[SyncBackup] Cleaned up ${toDelete.length} old snapshots`);
      }
    } catch (error) {
      console.error('[SyncBackup] Failed to cleanup snapshots:', error);
    }
  }

  // Get storage usage
  async getStorageInfo() {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) return { totalSize: 0, count: 0 };

    try {
      const snapshots = await this.listSnapshots();
      let totalSize = 0;
      
      for (const snapshot of snapshots) {
        totalSize += snapshot.metadata.totalSize || 0;
      }

      return {
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        count: snapshots.length
      };
    } catch (error) {
      console.error('[SyncBackup] Failed to get storage info:', error);
      return { totalSize: 0, count: 0 };
    }
  }

  // Debug function to analyze database contents
  async debugDatabaseContents() {
    try {
      console.log('[SyncBackup DEBUG] ========== DATABASE ANALYSIS ==========');
      
      // Check IndexedDB
      const mainDb = await openDB('khs-crm-offline', 3);
      
      if (mainDb.objectStoreNames.contains('customers')) {
        const allCustomers = await mainDb.getAll('customers');
        console.log('[SyncBackup DEBUG] IndexedDB customers:', allCustomers.length);
        
        const temp = allCustomers.filter(c => c.id && c.id.toString().startsWith('temp_'));
        const permanent = allCustomers.filter(c => c.id && !c.id.toString().startsWith('temp_'));
        const current = permanent.filter(c => c.customerType === 'CURRENT');
        const leads = permanent.filter(c => c.customerType === 'LEADS');
        
        console.log('- Permanent customers:', permanent.length);
        console.log('- Temporary customers:', temp.length);
        console.log('- Current customers:', current.length);
        console.log('- Lead customers:', leads.length);
        
        if (allCustomers.length > 0) {
          console.log('[SyncBackup DEBUG] Customer details:');
          allCustomers.forEach(c => {
            console.log(`  ID: ${c.id}, Name: ${c.name}, Type: ${c.customerType || 'CURRENT'}`);
          });
        }
      }
      
      mainDb.close();
      
      // Also check localStorage for any customer data
      console.log('[SyncBackup DEBUG] Checking localStorage...');
      const localStorageKeys = Object.keys(localStorage).filter(key => key.includes('customer'));
      console.log('Customer-related localStorage keys:', localStorageKeys);
      
      localStorageKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            console.log(`  ${key}:`, Array.isArray(parsed) ? `Array(${parsed.length})` : typeof parsed);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`    Sample:`, parsed[0]);
            }
          } catch (e) {
            console.log(`  ${key}: (not JSON)`);
          }
        }
      });
      
      console.log('[SyncBackup DEBUG] ========== END ANALYSIS ==========');
    } catch (error) {
      console.error('[SyncBackup DEBUG] Error analyzing database:', error);
    }
  }

  // Clear all customers from database
  async clearAllCustomers() {
    try {
      console.log('[SyncBackup CLEAR] Starting complete customer cleanup...');
      
      const mainDb = await openDB('khs-crm-offline', 3);
      
      if (!mainDb.objectStoreNames.contains('customers')) {
        console.log('[SyncBackup CLEAR] No customers store found');
        return { removed: 0 };
      }

      // Get count before clearing
      const allCustomers = await mainDb.getAll('customers');
      const count = allCustomers.length;
      
      // Clear all customers
      const tx = mainDb.transaction('customers', 'readwrite');
      await tx.objectStore('customers').clear();
      await tx.done;
      
      console.log(`[SyncBackup CLEAR] Cleared ${count} customers from IndexedDB`);
      
      // Also clear all jobs since they reference customers
      if (mainDb.objectStoreNames.contains('jobs')) {
        const jobTx = mainDb.transaction('jobs', 'readwrite');
        await jobTx.objectStore('jobs').clear();
        await jobTx.done;
        console.log('[SyncBackup CLEAR] Also cleared all jobs');
      }
      
      mainDb.close();
      
      return { removed: count };
    } catch (error) {
      console.error('[SyncBackup CLEAR] Error clearing customers:', error);
      throw error;
    }
  }

  // Cleanup duplicate customers in database
  async cleanupDuplicateCustomers(keepNewest = true) {
    try {
      console.log('[SyncBackup CLEANUP] Starting customer cleanup...');
      
      const mainDb = await openDB('khs-crm-offline', 3);
      
      if (!mainDb.objectStoreNames.contains('customers')) {
        console.log('[SyncBackup CLEANUP] No customers store found');
        return { removed: 0, kept: 0 };
      }

      // Get all customers
      const allCustomers = await mainDb.getAll('customers');
      console.log('[SyncBackup CLEANUP] Found', allCustomers.length, 'total customers');

      // Group customers by name
      const customerGroups = new Map<string, any[]>();
      for (const customer of allCustomers) {
        const name = customer.name.toLowerCase().trim();
        if (!customerGroups.has(name)) {
          customerGroups.set(name, []);
        }
        customerGroups.get(name)!.push(customer);
      }

      // Find duplicates and decide which to keep
      const customersToDelete: string[] = [];
      const customersToKeep: any[] = [];

      for (const [name, customers] of customerGroups) {
        if (customers.length === 1) {
          // No duplicates
          customersToKeep.push(customers[0]);
        } else {
          // Sort by creation date or ID
          customers.sort((a, b) => {
            // Try to sort by createdAt first
            if (a.createdAt && b.createdAt) {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            // Fallback to ID comparison (newer IDs are usually longer/later)
            return b.id.localeCompare(a.id);
          });

          // Keep the newest (first after sort) or oldest (last after sort)
          const keepIndex = keepNewest ? 0 : customers.length - 1;
          customersToKeep.push(customers[keepIndex]);

          // Mark others for deletion
          for (let i = 0; i < customers.length; i++) {
            if (i !== keepIndex) {
              customersToDelete.push(customers[i].id);
            }
          }

          console.log(`[SyncBackup CLEANUP] Found ${customers.length} customers named "${customers[0].name}"`);
          console.log(`  Keeping: ID ${customers[keepIndex].id} (${customers[keepIndex].customerType})`);
          console.log(`  Removing:`, customers.filter((_, i) => i !== keepIndex).map(c => `${c.id} (${c.customerType})`));
        }
      }

      // Delete duplicate customers
      if (customersToDelete.length > 0) {
        const tx = mainDb.transaction('customers', 'readwrite');
        for (const id of customersToDelete) {
          await tx.objectStore('customers').delete(id);
        }
        await tx.done;
        console.log(`[SyncBackup CLEANUP] Deleted ${customersToDelete.length} duplicate customers`);
      }

      // Also clean up jobs for deleted customers
      if (mainDb.objectStoreNames.contains('jobs') && customersToDelete.length > 0) {
        const allJobs = await mainDb.getAll('jobs');
        const jobsToDelete = allJobs.filter(job => customersToDelete.includes(job.customerId));
        
        if (jobsToDelete.length > 0) {
          const tx = mainDb.transaction('jobs', 'readwrite');
          for (const job of jobsToDelete) {
            await tx.objectStore('jobs').delete(job.id);
          }
          await tx.done;
          console.log(`[SyncBackup CLEANUP] Deleted ${jobsToDelete.length} orphaned jobs`);
        }
      }

      mainDb.close();

      console.log(`[SyncBackup CLEANUP] Cleanup complete. Kept ${customersToKeep.length} customers, removed ${customersToDelete.length} duplicates`);

      return {
        removed: customersToDelete.length,
        kept: customersToKeep.length
      };
    } catch (error) {
      console.error('[SyncBackup CLEANUP] Error during cleanup:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const syncBackupService = new SyncBackupService();