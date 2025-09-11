import { offlineDb } from '../services/db.service';

interface ClearResult {
  localStorage: {
    keysCleared: string[];
    itemsCleared: number;
  };
  sessionStorage: {
    keysCleared: string[];
    itemsCleared: number;
  };
  indexedDB: {
    cleared: boolean;
    databases: string[];
  };
  serviceWorkers: {
    unregistered: number;
  };
  caches: {
    deleted: string[];
  };
}

export async function nuclearClear(): Promise<ClearResult> {
  console.log('[NUCLEAR CLEAR] Starting complete storage wipe...');
  
  const result: ClearResult = {
    localStorage: { keysCleared: [], itemsCleared: 0 },
    sessionStorage: { keysCleared: [], itemsCleared: 0 },
    indexedDB: { cleared: false, databases: [] },
    serviceWorkers: { unregistered: 0 },
    caches: { deleted: [] }
  };

  // 1. Clear localStorage
  console.log('[NUCLEAR CLEAR] Clearing localStorage...');
  const localStorageKeys = Object.keys(localStorage);
  result.localStorage.keysCleared = localStorageKeys;
  result.localStorage.itemsCleared = localStorageKeys.length;
  
  localStorageKeys.forEach(key => {
    console.log(`[NUCLEAR CLEAR] Removing localStorage key: ${key}`);
    localStorage.removeItem(key);
  });

  // 2. Clear sessionStorage
  console.log('[NUCLEAR CLEAR] Clearing sessionStorage...');
  const sessionStorageKeys = Object.keys(sessionStorage);
  result.sessionStorage.keysCleared = sessionStorageKeys;
  result.sessionStorage.itemsCleared = sessionStorageKeys.length;
  
  sessionStorageKeys.forEach(key => {
    console.log(`[NUCLEAR CLEAR] Removing sessionStorage key: ${key}`);
    sessionStorage.removeItem(key);
  });

  // 3. Clear IndexedDB
  console.log('[NUCLEAR CLEAR] Clearing IndexedDB...');
  try {
    // Clear our app's database
    await offlineDb.clearAllData();
    result.indexedDB.databases.push('khs-crm-offline');
    
    // Also delete the entire database
    if ('indexedDB' in window) {
      await indexedDB.deleteDatabase('khs-crm-offline');
      console.log('[NUCLEAR CLEAR] Deleted IndexedDB: khs-crm-offline');
    }
    
    result.indexedDB.cleared = true;
  } catch (error) {
    console.error('[NUCLEAR CLEAR] Error clearing IndexedDB:', error);
  }

  // 4. Unregister service workers
  console.log('[NUCLEAR CLEAR] Checking for service workers...');
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        result.serviceWorkers.unregistered++;
        console.log('[NUCLEAR CLEAR] Unregistered service worker');
      }
    } catch (error) {
      console.error('[NUCLEAR CLEAR] Error unregistering service workers:', error);
    }
  }

  // 5. Clear caches
  console.log('[NUCLEAR CLEAR] Clearing caches...');
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
        result.caches.deleted.push(name);
        console.log(`[NUCLEAR CLEAR] Deleted cache: ${name}`);
      }
    } catch (error) {
      console.error('[NUCLEAR CLEAR] Error clearing caches:', error);
    }
  }

  // 6. Clear React Query cache if available
  console.log('[NUCLEAR CLEAR] Clearing React Query cache...');
  try {
    const queryClient = (window as any).__REACT_QUERY_CLIENT__;
    if (queryClient) {
      queryClient.clear();
      console.log('[NUCLEAR CLEAR] Cleared React Query cache');
    }
  } catch (error) {
    console.error('[NUCLEAR CLEAR] Error clearing React Query cache:', error);
  }

  console.log('[NUCLEAR CLEAR] Complete! Summary:', result);
  return result;
}

export async function verifyStorageIsEmpty(): Promise<{
  isEmpty: boolean;
  findings: string[];
}> {
  const findings: string[] = [];

  // Check localStorage
  if (localStorage.length > 0) {
    findings.push(`localStorage has ${localStorage.length} items: ${Object.keys(localStorage).join(', ')}`);
  }

  // Check sessionStorage
  if (sessionStorage.length > 0) {
    findings.push(`sessionStorage has ${sessionStorage.length} items: ${Object.keys(sessionStorage).join(', ')}`);
  }

  // Check IndexedDB
  try {
    const databases = await indexedDB.databases?.() || [];
    if (databases.length > 0) {
      findings.push(`IndexedDB has ${databases.length} databases: ${databases.map(db => db.name).join(', ')}`);
    }
  } catch (error) {
    // Some browsers don't support indexedDB.databases()
    console.log('[VERIFY] Cannot list IndexedDB databases');
  }

  // Check service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      findings.push(`${registrations.length} service workers still registered`);
    }
  }

  // Check caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    if (cacheNames.length > 0) {
      findings.push(`${cacheNames.length} caches still exist: ${cacheNames.join(', ')}`);
    }
  }

  return {
    isEmpty: findings.length === 0,
    findings
  };
}