import { openDB, DBSchema, IDBPDatabase } from 'idb';
// Inline type definitions
interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
  customerType?: 'CURRENT' | 'LEADS';
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Job {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledDate?: string;
  completedDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  assignments?: Array<{ userId: string }>;
  createdAt: string;
  updatedAt: string;
}

interface Material {
  id: string;
  jobId?: string;
  name: string;
  description?: string;
  unit: string;
  cost: number;
  supplier?: string;
  isArchived?: boolean;
  isDeleted?: boolean;
  purchased?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SyncOperation {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'customer' | 'job' | 'material' | 'user';
  entityId?: string;
  payload: any;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'worker';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Inline constants
const CACHE_CONFIG = {
  MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  MAX_ENTRIES: 1000,
  CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
  MEMORY_LIMIT: 50 * 1024 * 1024 // 50MB
};

interface KhsDB extends DBSchema {
  customers: {
    key: string;
    value: Customer & { _version: number; _lastModified: number; _synced: boolean };
    indexes: {
      'by-name': string;
      'by-phone': string;
      'by-archived': number;
      'by-modified': number;
      'by-synced': number;
    };
  };
  jobs: {
    key: string;
    value: Job & { _version: number; _lastModified: number; _synced: boolean };
    indexes: {
      'by-status': string;
      'by-customer': string;
      'by-created': Date;
      'by-modified': number;
      'by-synced': number;
    };
  };
  materials: {
    key: string;
    value: Material & { _version: number; _lastModified: number; _synced: boolean };
    indexes: {
      'by-job': string;
      'by-purchased': number;
      'by-modified': number;
      'by-synced': number;
    };
  };
  users: {
    key: string;
    value: User & { _version: number; _lastModified: number; _synced: boolean };
    indexes: {
      'by-role': string;
      'by-active': number;
      'by-modified': number;
    };
  };
  auth: {
    key: string;
    value: {
      id: string;
      encryptedCredentials: string;
      biometricEnabled: boolean;
      lastLoginAt: number;
      rememberMe: boolean;
      _version: number;
    };
  };
  syncQueue: {
    key: string;
    value: SyncOperation & {
      _priority: number;
      _attempts: number;
      _lastAttempt?: number;
      _status: 'pending' | 'processing' | 'failed' | 'completed';
    };
    indexes: {
      'by-timestamp': Date;
      'by-priority': number;
      'by-status': string;
      'by-entity': string;
    };
  };
  metadata: {
    key: string;
    value: any;
  };
  cache: {
    key: string;
    value: {
      data: any;
      expiresAt: number;
      compressed: boolean;
    };
    indexes: {
      'by-expires': number;
    };
  };
}

interface DatabaseMigration {
  version: number;
  upgrade: (db: IDBPDatabase<KhsDB>, transaction: IDBTransaction) => Promise<void>;
}

class OfflineDatabase {
  private db: IDBPDatabase<KhsDB> | null = null;
  private readonly DB_NAME = 'khs-crm-offline';
  private readonly DB_VERSION = 3; // Increased for enhanced schema
  private readonly migrations: DatabaseMigration[] = [];

  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    this.db = await openDB<KhsDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade: (db, oldVersion, newVersion, transaction) => {
        this.performMigrations(db, oldVersion, newVersion, transaction);
      },
    });

    // Clean up expired cache entries
    await this.cleanupExpiredCache();
  }

  private performMigrations(
    db: IDBPDatabase<KhsDB>,
    oldVersion: number,
    newVersion: number,
    transaction: IDBTransaction
  ): void {
    // Version 1: Initial schema
    if (oldVersion < 1) {
      this.createInitialSchema(db);
    }

    // Version 2: Add versioning and sync tracking
    if (oldVersion < 2) {
      this.addVersioningSupport(db, transaction);
    }

    // Version 3: Add enhanced offline features
    if (oldVersion < 3) {
      this.addEnhancedOfflineFeatures(db, transaction);
    }
  }

  private createInitialSchema(db: IDBPDatabase<KhsDB>): void {
    // Customers store
    if (!db.objectStoreNames.contains('customers')) {
      const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
      customerStore.createIndex('by-name', 'name');
      customerStore.createIndex('by-phone', 'phone');
      customerStore.createIndex('by-archived', 'isArchived');
    }

    // Jobs store
    if (!db.objectStoreNames.contains('jobs')) {
      const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
      jobStore.createIndex('by-status', 'status');
      jobStore.createIndex('by-customer', 'customerId');
      jobStore.createIndex('by-created', 'createdAt');
    }

    // Materials store
    if (!db.objectStoreNames.contains('materials')) {
      const materialStore = db.createObjectStore('materials', { keyPath: 'id' });
      materialStore.createIndex('by-job', 'jobId');
      materialStore.createIndex('by-purchased', 'purchased');
    }

    // Sync queue store
    if (!db.objectStoreNames.contains('syncQueue')) {
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-timestamp', 'timestamp');
    }

    // Metadata store
    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata', { keyPath: 'key' });
    }
  }

  private addVersioningSupport(db: IDBPDatabase<KhsDB>, transaction: IDBTransaction): void {
    // Add versioning indexes to existing stores
    ['customers', 'jobs', 'materials'].forEach(storeName => {
      if (db.objectStoreNames.contains(storeName)) {
        const store = transaction.objectStore(storeName);
        if (!store.indexNames.contains('by-modified')) {
          store.createIndex('by-modified', '_lastModified');
        }
        if (!store.indexNames.contains('by-synced')) {
          store.createIndex('by-synced', '_synced');
        }
      }
    });

    // Add priority and status indexes to sync queue
    if (db.objectStoreNames.contains('syncQueue')) {
      const syncStore = transaction.objectStore('syncQueue');
      if (!syncStore.indexNames.contains('by-priority')) {
        syncStore.createIndex('by-priority', '_priority');
      }
      if (!syncStore.indexNames.contains('by-status')) {
        syncStore.createIndex('by-status', '_status');
      }
      if (!syncStore.indexNames.contains('by-entity')) {
        syncStore.createIndex('by-entity', 'entityType');
      }
    }
  }

  private addEnhancedOfflineFeatures(db: IDBPDatabase<KhsDB>, transaction: IDBTransaction): void {
    // Users store
    if (!db.objectStoreNames.contains('users')) {
      const userStore = db.createObjectStore('users', { keyPath: 'id' });
      userStore.createIndex('by-role', 'role');
      userStore.createIndex('by-active', 'isActive');
      userStore.createIndex('by-modified', '_lastModified');
    }

    // Auth store for offline authentication
    if (!db.objectStoreNames.contains('auth')) {
      db.createObjectStore('auth', { keyPath: 'id' });
    }

    // Cache store for API responses
    if (!db.objectStoreNames.contains('cache')) {
      const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
      cacheStore.createIndex('by-expires', 'expiresAt');
    }
  }

  private async ensureDb(): Promise<IDBPDatabase<KhsDB>> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  // Enhanced helper methods
  private addVersioning<T>(entity: T): T & { _version: number; _lastModified: number; _synced: boolean } {
    return {
      ...entity,
      _version: 1,
      _lastModified: Date.now(),
      _synced: false,
    };
  }

  private updateVersioning<T extends { _version: number }>(entity: T): T {
    return {
      ...entity,
      _version: entity._version + 1,
      _lastModified: Date.now(),
      _synced: false,
    };
  }

  private async compressData(data: any): Promise<string> {
    // Simple JSON compression using built-in compression if available
    const jsonString = JSON.stringify(data);
    if ('CompressionStream' in window) {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(new TextEncoder().encode(jsonString));
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }
      
      const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      return btoa(String.fromCharCode(...compressed));
    }
    return jsonString;
  }

  private async decompressData(compressedData: string): Promise<any> {
    if ('DecompressionStream' in window && compressedData.length > 0 && compressedData[0] !== '{') {
      try {
        const compressed = new Uint8Array(atob(compressedData).split('').map(char => char.charCodeAt(0)));
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(compressed);
        writer.close();
        
        const chunks: Uint8Array[] = [];
        let result = await reader.read();
        while (!result.done) {
          chunks.push(result.value);
          result = await reader.read();
        }
        
        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        const jsonString = new TextDecoder().decode(decompressed);
        return JSON.parse(jsonString);
      } catch (error) {
        console.warn('Failed to decompress data, falling back to raw data:', error);
      }
    }
    return JSON.parse(compressedData);
  }

  private async cleanupExpiredCache(): Promise<void> {
    const db = await this.ensureDb();
    const now = Date.now();
    const expiredEntries = await db.getAllFromIndex('cache', 'by-expires', IDBKeyRange.upperBound(now));
    
    const tx = db.transaction('cache', 'readwrite');
    await Promise.all(expiredEntries.map(entry => tx.store.delete(entry.key)));
    await tx.done;
  }

  // Customer operations with versioning
  async getCustomers(filters?: { search?: string; isArchived?: boolean }): Promise<Customer[]> {
    const db = await this.ensureDb();
    let customers = await db.getAll('customers');

    if (filters?.isArchived !== undefined) {
      customers = customers.filter(c => c.isArchived === filters.isArchived);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      customers = customers.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.phone?.toLowerCase().includes(searchLower) ||
        c.address.toLowerCase().includes(searchLower),
      );
    }

    return customers.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const db = await this.ensureDb();
    return db.get('customers', id);
  }

  async saveCustomer(customer: Customer): Promise<void> {
    const db = await this.ensureDb();
    const existing = await db.get('customers', customer.id);
    const versionedCustomer = existing 
      ? this.updateVersioning({ ...customer, _version: existing._version, _lastModified: existing._lastModified, _synced: existing._synced })
      : this.addVersioning(customer);
    
    await db.put('customers', versionedCustomer);
  }

  async deleteCustomer(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.delete('customers', id);
  }

  // Job operations
  async getJobs(filters?: { 
    status?: string | string[]; 
    customerId?: string; 
    assignedUserId?: string;
  }): Promise<Job[]> {
    const db = await this.ensureDb();
    let jobs = await db.getAll('jobs');

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      jobs = jobs.filter(j => statuses.includes(j.status));
    }

    if (filters?.customerId) {
      jobs = jobs.filter(j => j.customerId === filters.customerId);
    }

    if (filters?.assignedUserId) {
      jobs = jobs.filter(j => 
        j.assignments?.some(a => a.userId === filters.assignedUserId),
      );
    }

    return jobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async getJob(id: string): Promise<Job | undefined> {
    const db = await this.ensureDb();
    return db.get('jobs', id);
  }

  async saveJob(job: Job): Promise<void> {
    const db = await this.ensureDb();
    const existing = await db.get('jobs', job.id);
    const versionedJob = existing 
      ? this.updateVersioning({ ...job, _version: existing._version, _lastModified: existing._lastModified, _synced: existing._synced })
      : this.addVersioning(job);
    
    await db.put('jobs', versionedJob);
  }

  async deleteJob(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.delete('jobs', id);
  }

  // Material operations
  async getMaterials(jobId: string): Promise<Material[]> {
    const db = await this.ensureDb();
    const materials = await db.getAllFromIndex('materials', 'by-job', jobId);
    return materials
      .filter(m => !m.isDeleted)
      .sort((a, b) => {
        if (a.purchased !== b.purchased) {
          return a.purchased ? 1 : -1; // Unpurchased first
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }

  async saveMaterial(material: Material): Promise<void> {
    const db = await this.ensureDb();
    const existing = await db.get('materials', material.id);
    const versionedMaterial = existing 
      ? this.updateVersioning({ ...material, _version: existing._version, _lastModified: existing._lastModified, _synced: existing._synced })
      : this.addVersioning(material);
    
    await db.put('materials', versionedMaterial);
  }

  async saveMaterials(materials: Material[]): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('materials', 'readwrite');
    
    const versionedMaterials = await Promise.all(
      materials.map(async m => {
        const existing = await tx.store.get(m.id);
        return existing 
          ? this.updateVersioning({ ...m, _version: existing._version, _lastModified: existing._lastModified, _synced: existing._synced })
          : this.addVersioning(m);
      })
    );
    
    await Promise.all(versionedMaterials.map(m => tx.store.put(m)));
    await tx.done;
  }

  // Enhanced sync queue operations
  async addToSyncQueue(
    operation: Omit<SyncOperation, 'id'>, 
    priority: number = 5
  ): Promise<string> {
    const db = await this.ensureDb();
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const enhancedOperation = {
      ...operation,
      id,
      _priority: priority,
      _attempts: 0,
      _status: 'pending' as const,
    };
    await db.add('syncQueue', enhancedOperation);
    return id;
  }

  async updateSyncOperationStatus(
    id: string,
    status: 'pending' | 'processing' | 'failed' | 'completed',
    error?: string
  ): Promise<void> {
    const db = await this.ensureDb();
    const operation = await db.get('syncQueue', id);
    if (operation) {
      operation._status = status;
      operation._lastAttempt = Date.now();
      if (status === 'failed') {
        operation._attempts += 1;
      }
      await db.put('syncQueue', operation);
    }
  }

  async getFailedSyncOperations(): Promise<SyncOperation[]> {
    const db = await this.ensureDb();
    return db.getAllFromIndex('syncQueue', 'by-status', 'failed');
  }

  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    const db = await this.ensureDb();
    const pending = await db.getAllFromIndex('syncQueue', 'by-status', 'pending');
    return pending.sort((a, b) => (b as any)._priority - (a as any)._priority);
  }

  async getSyncQueue(): Promise<SyncOperation[]> {
    const db = await this.ensureDb();
    return db.getAllFromIndex('syncQueue', 'by-timestamp');
  }

  async getSyncQueueByPriority(): Promise<SyncOperation[]> {
    const db = await this.ensureDb();
    const operations = await db.getAll('syncQueue');
    return operations
      .filter(op => (op as any)._status === 'pending')
      .sort((a, b) => (b as any)._priority - (a as any)._priority);
  }

  async removeSyncOperation(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.delete('syncQueue', id);
  }

  async clearSyncQueue(): Promise<void> {
    const db = await this.ensureDb();
    await db.clear('syncQueue');
  }

  // Metadata operations
  async getLastSyncTime(): Promise<Date | null> {
    const db = await this.ensureDb();
    const metadata = await db.get('metadata', 'lastSync');
    return metadata?.value ? new Date(metadata.value) : null;
  }

  async setLastSyncTime(time: Date): Promise<void> {
    const db = await this.ensureDb();
    await db.put('metadata', { key: 'lastSync', value: time.toISOString() });
  }

  // Bulk operations for initial sync with versioning
  async bulkSaveCustomers(customers: Customer[], fromServer = false): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('customers', 'readwrite');
    
    const versionedCustomers = customers.map(c => ({
      ...this.addVersioning(c),
      _synced: fromServer,
    }));
    
    await Promise.all(versionedCustomers.map(c => tx.store.put(c)));
    await tx.done;
  }

  async bulkSaveJobs(jobs: Job[], fromServer = false): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('jobs', 'readwrite');
    
    const versionedJobs = jobs.map(j => ({
      ...this.addVersioning(j),
      _synced: fromServer,
    }));
    
    await Promise.all(versionedJobs.map(j => tx.store.put(j)));
    await tx.done;
  }

  async bulkSaveMaterials(materials: Material[], fromServer = false): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('materials', 'readwrite');
    
    const versionedMaterials = materials.map(m => ({
      ...this.addVersioning(m),
      _synced: fromServer,
    }));
    
    await Promise.all(versionedMaterials.map(m => tx.store.put(m)));
    await tx.done;
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    const db = await this.ensureDb();
    await Promise.all([
      db.clear('customers'),
      db.clear('jobs'),
      db.clear('materials'),
      db.clear('syncQueue'),
      db.clear('metadata'),
    ]);
  }

  // Enhanced database management
  async getDatabaseSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  }

  async getDatabaseStats(): Promise<{
    size: number;
    customers: number;
    jobs: number;
    materials: number;
    pendingSync: number;
    unsynced: number;
    lastSync?: Date;
  }> {
    const db = await this.ensureDb();
    
    const [customers, jobs, materials, syncQueue] = await Promise.all([
      db.count('customers'),
      db.count('jobs'),
      db.count('materials'),
      db.count('syncQueue'),
    ]);
    
    const unsynced = await this.getUnsyncedCount();
    const lastSync = await this.getLastSyncTime();
    const size = await this.getDatabaseSize();
    
    return {
      size,
      customers,
      jobs,
      materials,
      pendingSync: syncQueue,
      unsynced,
      lastSync: lastSync || undefined,
    };
  }

  async getUnsyncedCount(): Promise<number> {
    const db = await this.ensureDb();
    const [unsyncedCustomers, unsyncedJobs, unsyncedMaterials] = await Promise.all([
      db.countFromIndex('customers', 'by-synced', 0),
      db.countFromIndex('jobs', 'by-synced', 0),
      db.countFromIndex('materials', 'by-synced', 0),
    ]);
    
    return unsyncedCustomers + unsyncedJobs + unsyncedMaterials;
  }

  async getUnsyncedEntities(): Promise<{
    customers: Customer[];
    jobs: Job[];
    materials: Material[];
  }> {
    const db = await this.ensureDb();
    
    const [customers, jobs, materials] = await Promise.all([
      db.getAllFromIndex('customers', 'by-synced', 0),
      db.getAllFromIndex('jobs', 'by-synced', 0),
      db.getAllFromIndex('materials', 'by-synced', 0),
    ]);
    
    return { customers, jobs, materials };
  }

  async markAsSynced(entityType: 'customer' | 'job' | 'material', id: string): Promise<void> {
    const db = await this.ensureDb();
    const storeMap = {
      customer: 'customers',
      job: 'jobs',
      material: 'materials',
    };
    
    const storeName = storeMap[entityType] as keyof KhsDB;
    const entity = await db.get(storeName, id);
    if (entity) {
      (entity as any)._synced = true;
      await db.put(storeName, entity);
    }
  }

  // Cache operations
  async getCachedData(key: string): Promise<any | null> {
    const db = await this.ensureDb();
    const cached = await db.get('cache', key);
    
    if (!cached || cached.expiresAt < Date.now()) {
      if (cached) {
        await db.delete('cache', key);
      }
      return null;
    }
    
    return cached.compressed 
      ? await this.decompressData(cached.data)
      : cached.data;
  }

  async setCachedData(
    key: string, 
    data: any, 
    ttlMs: number = CACHE_CONFIG.MAX_AGE,
    compress = false
  ): Promise<void> {
    const db = await this.ensureDb();
    const processedData = compress ? await this.compressData(data) : data;
    
    await db.put('cache', {
      key,
      data: processedData,
      expiresAt: Date.now() + ttlMs,
      compressed: compress,
    });
  }

  async clearCache(): Promise<void> {
    const db = await this.ensureDb();
    await db.clear('cache');
  }

  // User operations
  async saveUser(user: User): Promise<void> {
    const db = await this.ensureDb();
    const existing = await db.get('users', user.id);
    const versionedUser = existing 
      ? this.updateVersioning({ ...user, _version: existing._version, _lastModified: existing._lastModified, _synced: existing._synced })
      : this.addVersioning(user);
    
    await db.put('users', versionedUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    const db = await this.ensureDb();
    return db.get('users', id);
  }

  async getUsers(): Promise<User[]> {
    const db = await this.ensureDb();
    return db.getAll('users');
  }

  // Sync tracking methods
  async getUnsyncedCustomers(): Promise<Customer[]> {
    const db = await this.ensureDb();
    const allCustomers = await db.getAll('customers');
    return allCustomers.filter(c => !c._synced);
  }

  async getUnsyncedJobs(): Promise<Job[]> {
    const db = await this.ensureDb();
    const allJobs = await db.getAll('jobs');
    return allJobs.filter(j => !j._synced);
  }

  // Bulk save methods for backup restore
  async bulkSaveCustomers(customers: Customer[]): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('customers', 'readwrite');
    await Promise.all(customers.map(customer => tx.store.put({
      ...customer,
      _version: 1,
      _lastModified: Date.now(),
      _synced: true
    })));
    await tx.done;
  }

  async bulkSaveJobs(jobs: Job[]): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('jobs', 'readwrite');
    await Promise.all(jobs.map(job => tx.store.put({
      ...job,
      _version: 1,
      _lastModified: Date.now(),
      _synced: true
    })));
    await tx.done;
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    const db = await this.ensureDb();
    
    // Clear customers
    const customerTx = db.transaction('customers', 'readwrite');
    await customerTx.store.clear();
    await customerTx.done;
    
    // Clear jobs
    const jobTx = db.transaction('jobs', 'readwrite');
    await jobTx.store.clear();
    await jobTx.done;
    
    // Clear materials
    const materialTx = db.transaction('materials', 'readwrite');
    await materialTx.store.clear();
    await materialTx.done;
    
    // Clear sync queue
    const syncTx = db.transaction('syncQueue', 'readwrite');
    await syncTx.store.clear();
    await syncTx.done;
  }

}

export const offlineDb = new OfflineDatabase();

// Auto-initialize on first import
offlineDb.initialize().catch(error => {
  console.error('Failed to initialize offline database:', error);
});