import React, { useState, useEffect } from 'react';
import { offlineDb } from '../services/db.service';
import { offlineDataService } from '../services/offline-data.service';
import { syncService } from '../services/sync.service';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
// Inline type definitions
interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
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
  createdAt: string;
  updatedAt: string;
}

interface Material {
  id: string;
  name: string;
  description?: string;
  unit: string;
  cost: number;
  supplier?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}
import SyncManagementModal from './SyncManagementModal';
import OfflineDataIndicator from './OfflineDataIndicator';

interface DatabaseStats {
  size: number;
  customers: number;
  jobs: number;
  materials: number;
  pendingSync: number;
  unsynced: number;
  lastSync?: Date;
}

interface DataBreakdown {
  totalItems: number;
  syncedItems: number;
  unsyncedItems: number;
  pendingItems: number;
  recentlyModified: number;
}

interface SelectiveSyncOptions {
  customers: boolean;
  jobs: boolean;
  materials: boolean;
  onlyActive: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

const OfflineDataDashboard: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [recentData, setRecentData] = useState<{
    customers: Customer[];
    jobs: Job[];
    materials: Material[];
  } | null>(null);
  const [unsyncedData, setUnsyncedData] = useState<{
    customers: Customer[];
    jobs: Job[];
    materials: Material[];
  } | null>(null);
  const [cacheStats, setCacheStats] = useState<{
    memoryEntries: number;
    memorySize: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectiveSyncOptions, setSelectiveSyncOptions] = useState<SelectiveSyncOptions>({
    customers: true,
    jobs: true,
    materials: true,
    onlyActive: true,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [
        stats,
        recent,
        unsynced,
        cache,
      ] = await Promise.all([
        offlineDb.getDatabaseStats(),
        offlineDataService.getRecentlyModified(24), // Last 24 hours
        offlineDataService.getUnsyncedItems(),
        Promise.resolve(offlineDataService.getCacheStats()),
      ]);

      setDbStats(stats);
      setRecentData(recent);
      setUnsyncedData(unsynced);
      setCacheStats(cache);
    } catch (error) {
      // Failed to load dashboard data
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear all cached data? This will improve performance but may cause slower loading initially.')) {
      try {
        await offlineDataService.clearAllCaches();
        await loadDashboardData();
      } catch (error) {
        // Failed to clear cache
      }
    }
  };

  const handleSelectiveSync = async () => {
    if (!isOnline) {
      // 'You must be online to perform a sync.');
      return;
    }

    setIsSyncing(true);
    try {
      // This is a simplified selective sync - in a real implementation,
      // you'd want to implement more sophisticated selective sync logic
      const result = await syncService.forceSync();
      
      if (result.success) {
        // `Sync completed successfully! Processed ${result.processed} operations with ${result.conflicts} conflicts.`);
      } else {
        // `Sync completed with errors. ${result.errors.length} operations failed.`);
      }
      
      await loadDashboardData();
    } catch (error) {
      // Selective sync failed
      // 'Selective sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePreloadData = async () => {
    setIsLoading(true);
    try {
      await offlineDataService.preloadCriticalData();
      // 'Critical data has been preloaded for offline use.');
      await loadDashboardData();
    } catch (error) {
      // Failed to preload data
      // 'Failed to preload data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDataBreakdown = (type: 'customers' | 'jobs' | 'materials'): DataBreakdown => {
    if (!dbStats || !unsyncedData || !recentData) {
      return {
        totalItems: 0,
        syncedItems: 0,
        unsyncedItems: 0,
        pendingItems: 0,
        recentlyModified: 0,
      };
    }

    const totalItems = dbStats[type];
    const unsyncedItems = unsyncedData[type].length;
    const recentlyModified = recentData[type].length;
    
    return {
      totalItems,
      syncedItems: totalItems - unsyncedItems,
      unsyncedItems,
      pendingItems: 0, // Would need to calculate from sync queue
      recentlyModified,
    };
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Offline Data Dashboard</h1>
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Sync Management
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {dbStats ? formatBytes(dbStats.size) : '0 B'}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unsynced Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {dbStats?.unsynced || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Sync</p>
              <p className="text-2xl font-bold text-gray-900">
                {dbStats?.pendingSync || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cache Entries</p>
              <p className="text-2xl font-bold text-gray-900">
                {cacheStats?.memoryEntries || 0}
              </p>
              <p className="text-xs text-gray-500">
                {cacheStats ? formatBytes(cacheStats.memorySize) : '0 B'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Data Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {['customers', 'jobs', 'materials'].map(type => {
          const breakdown = getDataBreakdown(type as any);
          const Icon = type === 'customers' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          ) : type === 'jobs' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V8m8 0V6a2 2 0 00-2-2H10a2 2 0 00-2 2v2m8 0v8a2 2 0 01-2 2H10a2 2 0 01-2-2v-8" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          );

          return (
            <div key={type} className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 capitalize">{type}</h3>
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {Icon}
                  </svg>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Items</span>
                  <span className="font-medium">{breakdown.totalItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center">
                    Synced
                    <div className="w-2 h-2 bg-green-400 rounded-full ml-2"></div>
                  </span>
                  <span className="font-medium text-green-600">{breakdown.syncedItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center">
                    Unsynced
                    <div className="w-2 h-2 bg-yellow-400 rounded-full ml-2"></div>
                  </span>
                  <span className="font-medium text-yellow-600">{breakdown.unsyncedItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Recently Modified</span>
                  <span className="font-medium text-blue-600">{breakdown.recentlyModified}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-400 h-2 rounded-full"
                    style={{ 
                      width: breakdown.totalItems > 0 
                        ? `${(breakdown.syncedItems / breakdown.totalItems) * 100}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={handleSelectiveSync}
            disabled={!isOnline || isSyncing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSyncing ? 'Syncing...' : 'Force Sync All'}
          </button>
          
          <button
            onClick={handlePreloadData}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
          >
            Preload Critical Data
          </button>
          
          <button
            onClick={handleClearCache}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
          >
            Clear Cache
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Refresh App
          </button>
        </div>
      </div>

      {/* Last Sync Info */}
      {dbStats?.lastSync && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Last successful sync: {dbStats.lastSync.toLocaleString()}
            </span>
            <OfflineDataIndicator 
              isUnsynced={dbStats.unsynced > 0} 
              lastModified={dbStats.lastSync}
              showText
            />
          </div>
        </div>
      )}

      {/* Sync Management Modal */}
      <SyncManagementModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </div>
  );
};

export default OfflineDataDashboard;