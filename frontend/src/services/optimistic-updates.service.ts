import { offlineDb } from './db.service';
import { simpleSyncService as syncService } from './sync.service.simple';
import { apiClient } from './api.service';
import { localOnlyService } from './local-only.service';

// Types defined inline
interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string;
  notes: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Job {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  customerId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  photos?: any[];
  plans?: any[];
}

interface Material {
  id: string;
  jobId: string;
  itemName: string;
  quantity: number;
  unit: string;
  purchased: boolean;
  notes: string | null;
  addedById: string;
  purchasedById: string | null;
  purchasedBy: any | null;
  purchasedAt: Date | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type CreateCustomerRequest = Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>;
type UpdateCustomerRequest = Partial<CreateCustomerRequest>;
type CreateJobRequest = Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'createdById'>;
type UpdateJobRequest = Partial<CreateJobRequest>;
type CreateMaterialRequest = Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'purchased' | 'purchasedById' | 'purchasedBy' | 'purchasedAt' | 'isDeleted' | 'addedById'>;
type UpdateMaterialRequest = { id: string } & Partial<Material>;

// API endpoints defined inline
const API_ENDPOINTS = {
  CUSTOMERS: '/api/customers',
  CUSTOMER_BY_ID: (id: string) => `/api/customers/${id}`,
  JOBS: '/api/jobs',
  JOB_BY_ID: (id: string) => `/api/jobs/${id}`,
  JOB_MATERIALS: (jobId: string) => `/api/jobs/${jobId}/materials`,
  MATERIAL_BY_ID: (id: string) => `/api/materials/${id}`,
  MATERIALS_BULK_UPDATE: '/api/materials/bulk-update'
};

/**
 * Service for handling optimistic updates - immediately show changes in UI
 * while queuing them for sync in the background
 */
class OptimisticUpdatesService {
  private pendingUpdates = new Map<string, any>();

  /**
   * Generate a temporary ID for new entities
   */
  private generateTempId(prefix: string): string {
    return `temp_${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Apply optimistic update and queue for sync
   */
  private async applyOptimisticUpdate<T>(
    entityType: 'customer' | 'job' | 'material',
    operation: 'create' | 'update' | 'delete',
    optimisticData: T,
    syncPayload: any,
    entityId?: string
  ): Promise<T> {
    const updateId = `${entityType}_${operation}_${entityId || 'new'}_${Date.now()}`;
    
    // Store pending update
    this.pendingUpdates.set(updateId, {
      entityType,
      operation,
      optimisticData,
      timestamp: new Date(),
    });

    try {
      // Apply optimistic update locally
      switch (entityType) {
        case 'customer':
          if (operation === 'delete' && entityId) {
            await offlineDb.deleteCustomer(entityId);
          } else {
            await offlineDb.saveCustomer(optimisticData as Customer);
          }
          break;
        case 'job':
          if (operation === 'delete' && entityId) {
            await offlineDb.deleteJob(entityId);
          } else {
            await offlineDb.saveJob(optimisticData as Job);
          }
          break;
        case 'material':
          if (operation === 'delete' && entityId) {
            // For materials, we do soft delete
            const material = optimisticData as Material;
            await offlineDb.saveMaterial({ ...material, isDeleted: true });
          } else {
            await offlineDb.saveMaterial(optimisticData as Material);
          }
          break;
      }

      // Queue for sync
      await syncService.queueOperation({
        operation,
        entityType,
        entityId,
        payload: syncPayload,
        timestamp: new Date(),
      });

      // Remove from pending updates
      this.pendingUpdates.delete(updateId);

      return optimisticData;
    } catch (error) {
      // Revert optimistic update on error
      this.pendingUpdates.delete(updateId);
      throw error;
    }
  }

  // Customer operations
  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    // Try server creation first if online to get real ID
    if (navigator.onLine) {
      try {
        console.log('[OptimisticUpdates] Creating customer on server');
        const serverCustomer = await apiClient.post<Customer>('/api/customers', data);
        
        // Save to local DB
        await offlineDb.saveCustomer(serverCustomer);
        
        console.log('[OptimisticUpdates] Customer created with real ID:', serverCustomer.id);
        return serverCustomer;
      } catch (error) {
        console.error('[OptimisticUpdates] Server creation failed, falling back to optimistic:', error);
      }
    }

    // Only use temp ID if offline or server failed
    const tempId = this.generateTempId('customer');
    const now = new Date();

    const optimisticCustomer: Customer = {
      id: tempId,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address,
      notes: data.notes || null,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    // Fallback to optimistic update
    return this.applyOptimisticUpdate('customer', 'create', optimisticCustomer, data);
  }

  async updateCustomer(id: string, data: UpdateCustomerRequest): Promise<Customer> {
    // Get existing customer
    const existingCustomer = await offlineDb.getCustomer(id);
    if (!existingCustomer) {
      throw new Error('Customer not found');
    }

    const optimisticCustomer: Customer = {
      ...existingCustomer,
      ...data,
      updatedAt: new Date(),
    };

    // Always use optimistic updates and sync queue for proper multi-device sync

    // Fallback to optimistic update
    return this.applyOptimisticUpdate('customer', 'update', optimisticCustomer, data, id);
  }

  async deleteCustomer(id: string): Promise<void> {
    // Always use optimistic updates and sync queue for proper multi-device sync

    // Fallback to optimistic update
    await this.applyOptimisticUpdate('customer', 'delete', null, { id }, id);
  }

  // Job operations
  async createJob(data: CreateJobRequest): Promise<Job> {
    const tempId = this.generateTempId('job');
    const now = new Date();

    const optimisticJob: Job = {
      id: tempId,
      title: data.title,
      description: data.description || null,
      status: data.status || 'NOT_STARTED',
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      notes: data.notes || null,
      customerId: data.customerId,
      createdById: 'current-user', // This should be set from auth context
      createdAt: now,
      updatedAt: now,
      photos: data.photos || [],
      plans: data.plans || [],
    };

    if (navigator.onLine) {
      try {
        // Try online creation first
        const serverJob = await apiClient.post<Job>(API_ENDPOINTS.JOBS, data);
        await offlineDb.saveJob(serverJob);
        await offlineDb.markAsSynced('job', serverJob.id);
        return serverJob;
      } catch (error) {
        console.warn('Online job creation failed, falling back to optimistic update:', error);
      }
    }

    // Fallback to optimistic update
    return this.applyOptimisticUpdate('job', 'create', optimisticJob, data);
  }

  async updateJob(id: string, data: UpdateJobRequest): Promise<Job> {
    const existingJob = await offlineDb.getJob(id);
    if (!existingJob) {
      throw new Error('Job not found');
    }

    const optimisticJob: Job = {
      ...existingJob,
      ...data,
      updatedAt: new Date(),
    };

    if (navigator.onLine) {
      try {
        // Try online update first
        const serverJob = await apiClient.put<Job>(
          API_ENDPOINTS.JOB_BY_ID(id), 
          data
        );
        await offlineDb.saveJob(serverJob);
        await offlineDb.markAsSynced('job', id);
        return serverJob;
      } catch (error) {
        console.warn('Online job update failed, falling back to optimistic update:', error);
      }
    }

    // Fallback to optimistic update
    return this.applyOptimisticUpdate('job', 'update', optimisticJob, data, id);
  }

  async deleteJob(id: string): Promise<void> {
    if (navigator.onLine) {
      try {
        // Try online deletion first
        await apiClient.delete(API_ENDPOINTS.JOB_BY_ID(id));
        await offlineDb.deleteJob(id);
        return;
      } catch (error) {
        console.warn('Online job deletion failed, falling back to optimistic update:', error);
      }
    }

    // Fallback to optimistic update
    await this.applyOptimisticUpdate('job', 'delete', null, { id }, id);
  }

  // Material operations
  async createMaterial(data: CreateMaterialRequest): Promise<Material> {
    const tempId = this.generateTempId('material');
    const now = new Date();

    const optimisticMaterial: Material = {
      id: tempId,
      jobId: data.jobId,
      itemName: data.itemName,
      quantity: data.quantity,
      unit: data.unit || 'each',
      purchased: false,
      notes: data.notes || null,
      addedById: 'current-user', // This should be set from auth context
      purchasedById: null,
      purchasedBy: null,
      purchasedAt: null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    if (navigator.onLine) {
      try {
        // Try online creation first
        const serverMaterial = await apiClient.post<Material>(
          API_ENDPOINTS.JOB_MATERIALS(data.jobId), 
          data
        );
        await offlineDb.saveMaterial(serverMaterial);
        await offlineDb.markAsSynced('material', serverMaterial.id);
        return serverMaterial;
      } catch (error) {
        console.warn('Online material creation failed, falling back to optimistic update:', error);
      }
    }

    // Fallback to optimistic update
    return this.applyOptimisticUpdate('material', 'create', optimisticMaterial, data);
  }

  async updateMaterial(data: UpdateMaterialRequest): Promise<Material> {
    const existingMaterials = await offlineDb.getMaterials('');
    const existingMaterial = existingMaterials.find(m => m.id === data.id);
    
    if (!existingMaterial) {
      throw new Error('Material not found');
    }

    const optimisticMaterial: Material = {
      ...existingMaterial,
      ...data,
      updatedAt: new Date(),
    };

    if (navigator.onLine) {
      try {
        // Try online update first
        const serverMaterial = await apiClient.put<Material>(
          API_ENDPOINTS.MATERIAL_BY_ID(data.id), 
          data
        );
        await offlineDb.saveMaterial(serverMaterial);
        await offlineDb.markAsSynced('material', data.id);
        return serverMaterial;
      } catch (error) {
        console.warn('Online material update failed, falling back to optimistic update:', error);
      }
    }

    // Fallback to optimistic update
    return this.applyOptimisticUpdate('material', 'update', optimisticMaterial, data, data.id);
  }

  async deleteMaterial(id: string): Promise<void> {
    if (navigator.onLine) {
      try {
        // Try online deletion first
        await apiClient.delete(API_ENDPOINTS.MATERIAL_BY_ID(id));
        
        // Soft delete locally
        const materials = await offlineDb.getMaterials('');
        const material = materials.find(m => m.id === id);
        if (material) {
          await offlineDb.saveMaterial({ ...material, isDeleted: true });
        }
        return;
      } catch (error) {
        console.warn('Online material deletion failed, falling back to optimistic update:', error);
      }
    }

    // Fallback to optimistic update
    const materials = await offlineDb.getMaterials('');
    const material = materials.find(m => m.id === id);
    if (material) {
      await this.applyOptimisticUpdate('material', 'delete', material, { id }, id);
    }
  }

  // Bulk operations
  async bulkUpdateMaterials(jobId: string, materialIds: string[], purchased: boolean): Promise<Material[]> {
    const materials = await offlineDb.getMaterials(jobId);
    const targetMaterials = materials.filter(m => materialIds.includes(m.id));
    
    if (targetMaterials.length === 0) {
      return [];
    }

    const now = new Date();
    const optimisticMaterials = targetMaterials.map(material => ({
      ...material,
      purchased,
      purchasedAt: purchased ? now : null,
      purchasedById: purchased ? 'current-user' : null,
      updatedAt: now,
    }));

    if (navigator.onLine) {
      try {
        // Try online bulk update first
        const serverMaterials = await apiClient.put<Material[]>(
          API_ENDPOINTS.MATERIALS_BULK_UPDATE,
          { jobId, materialIds, purchased }
        );
        await offlineDb.saveMaterials(serverMaterials);
        
        // Mark all as synced
        for (const material of serverMaterials) {
          await offlineDb.markAsSynced('material', material.id);
        }
        
        return serverMaterials;
      } catch (error) {
        console.warn('Online bulk material update failed, falling back to optimistic update:', error);
      }
    }

    // Fallback to optimistic updates
    await offlineDb.saveMaterials(optimisticMaterials);
    
    // Queue individual sync operations for each material
    for (const material of optimisticMaterials) {
      await syncService.queueOperation({
        operation: 'update',
        entityType: 'material',
        entityId: material.id,
        payload: {
          id: material.id,
          purchased: material.purchased,
          purchasedAt: material.purchasedAt,
          purchasedById: material.purchasedById,
        },
        timestamp: new Date(),
      });
    }

    return optimisticMaterials;
  }

  /**
   * Get pending updates for debugging
   */
  getPendingUpdates(): Map<string, any> {
    return new Map(this.pendingUpdates);
  }

  /**
   * Clear all pending updates (use with caution)
   */
  clearPendingUpdates(): void {
    this.pendingUpdates.clear();
  }

  /**
   * Check if an entity has pending updates
   */
  hasPendingUpdate(entityType: string, entityId: string): boolean {
    for (const [updateId, update] of this.pendingUpdates) {
      if (update.entityType === entityType && updateId.includes(entityId)) {
        return true;
      }
    }
    return false;
  }
}

export const optimisticUpdatesService = new OptimisticUpdatesService();