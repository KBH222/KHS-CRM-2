// Utility to completely clear localStorage and start fresh
export function clearAllLocalStorage() {
  console.log('[Clear Storage] Starting complete localStorage cleanup...');
  
  // Get all keys before clearing
  const keys = Object.keys(localStorage);
  console.log(`[Clear Storage] Found ${keys.length} keys in localStorage:`, keys);
  
  // Clear everything
  localStorage.clear();
  
  console.log('[Clear Storage] All localStorage data has been cleared');
  
  // Optionally, preserve critical settings that should survive a clear
  // For example, device ID or user preferences
  // localStorage.setItem('khs-crm-device-id', deviceId);
}

// Function to clear only KHS-CRM related data
export function clearKHSLocalStorage() {
  console.log('[Clear Storage] Clearing KHS-CRM localStorage data...');
  
  const keysToRemove = Object.keys(localStorage).filter(key => 
    key.includes('khs') || 
    key.includes('customer') || 
    key.includes('job') || 
    key.includes('worker') ||
    key.includes('sync')
  );
  
  console.log(`[Clear Storage] Removing ${keysToRemove.length} KHS-related keys:`, keysToRemove);
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('[Clear Storage] KHS localStorage cleanup complete');
}

// Debug function to show what's in localStorage
// Debug function to check IndexedDB contents
export async function debugIndexedDB() {
  console.log('[Debug IndexedDB] Checking IndexedDB contents...');
  
  try {
    const { openDB } = await import('idb');
    const db = await openDB('khs-crm-offline', 3);
    
    // Check customers
    if (db.objectStoreNames.contains('customers')) {
      const customers = await db.getAll('customers');
      console.log(`[Debug IndexedDB] Customers: ${customers.length}`);
      if (customers.length > 0) {
        console.log('[Debug IndexedDB] Sample customer:', customers[0]);
      }
    }
    
    // Check jobs
    if (db.objectStoreNames.contains('jobs')) {
      const jobs = await db.getAll('jobs');
      console.log(`[Debug IndexedDB] Jobs: ${jobs.length}`);
      if (jobs.length > 0) {
        console.log('[Debug IndexedDB] Sample job:', jobs[0]);
      }
    }
    
    db.close();
  } catch (error) {
    console.error('[Debug IndexedDB] Error:', error);
  }
}

export function debugLocalStorage() {
  console.log('[Debug Storage] Current localStorage contents:');
  
  Object.keys(localStorage).forEach(key => {
    const value = localStorage.getItem(key);
    let parsed;
    
    try {
      parsed = JSON.parse(value || '');
      if (Array.isArray(parsed)) {
        console.log(`  ${key}: Array(${parsed.length})`);
      } else if (typeof parsed === 'object') {
        console.log(`  ${key}: Object`, Object.keys(parsed));
      } else {
        console.log(`  ${key}:`, parsed);
      }
    } catch (e) {
      // Not JSON, show as string
      console.log(`  ${key}: "${value?.substring(0, 50)}..."`);
    }
  });
  
  // Calculate total size
  let totalSize = 0;
  Object.keys(localStorage).forEach(key => {
    totalSize += (localStorage.getItem(key) || '').length;
  });
  
  console.log(`[Debug Storage] Total localStorage size: ${(totalSize / 1024).toFixed(2)} KB`);
}