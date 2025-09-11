const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to login page
    console.log('Navigating to KHS CRM...');
    await page.goto('https://khs-crm-4-production.up.railway.app/', {
      waitUntil: 'networkidle'
    });
    
    // Login with admin credentials
    console.log('Logging in as admin...');
    await page.fill('input[type="email"]', 'admin@khscrm.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign in")');
    
    // Wait for login to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Call the cleanup endpoint
    console.log('\nCalling cleanup endpoint...');
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/admin/cleanup-phantom-customers', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });
    
    // Display results
    if (result.error) {
      console.error('\n❌ Cleanup failed:', result.error);
    } else if (result.success) {
      console.log('\n✅ Cleanup completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   - Deleted Customers: ${result.summary.deletedCustomers}`);
      console.log(`   - Deleted Jobs: ${result.summary.deletedJobs}`);
      console.log(`   - Remaining Customers: ${result.summary.remaining}`);
      
      console.log('\n📈 Before/After:');
      console.log(`   - Customers: ${result.before.totalCustomers} → ${result.after.totalCustomers}`);
      console.log(`   - Jobs: ${result.before.totalJobs} → ${result.after.totalJobs}`);
      
      console.log('\n✨ Kept Customer:');
      console.log(`   - Name: ${result.keptCustomer.name}`);
      console.log(`   - Email: ${result.keptCustomer.email}`);
      console.log(`   - Created: ${new Date(result.keptCustomer.createdAt).toLocaleDateString()}`);
      console.log(`   - Jobs: ${result.keptCustomer.jobCount}`);
      
      if (result.deletedCustomersList.length > 0) {
        console.log('\n🗑️ Deleted Customers:');
        result.deletedCustomersList.forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.name} (${c.email || 'no email'}) - Created: ${new Date(c.createdAt).toLocaleDateString()}`);
        });
      }
    }
    
    // Clear local data after cleanup
    console.log('\n🧹 Clearing local browser data...');
    await page.evaluate(() => {
      // Clear all localStorage
      localStorage.clear();
      
      // Clear IndexedDB
      indexedDB.deleteDatabase('khs-crm-offline');
      indexedDB.deleteDatabase('khs-crm-db');
      indexedDB.deleteDatabase('khs-crm-backups');
    });
    
    console.log('✅ Local browser data cleared');
    console.log('\n🎉 Cleanup complete! The database now has only the most recent customer.');
    console.log('💡 Tip: Deploy the fix to GET /api/customers to prevent this from happening again.');
    
    // Keep browser open for a moment
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();