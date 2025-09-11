const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    console.log('Browser console:', msg.text());
  });

  // Navigate to the site
  console.log('Navigating to KHS CRM...');
  await page.goto('https://khs-crm-4-production.up.railway.app', {
    waitUntil: 'networkidle'
  });

  // Wait for the page to fully load
  await page.waitForTimeout(2000);

  // Execute the fetch command in the browser context
  console.log('Testing cleanup endpoint...');
  const result = await page.evaluate(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { error: 'No auth token found in localStorage. Please log in first.' };
      }

      const response = await fetch('/api/admin/cleanup-phantom-customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const status = response.status;
      const data = await response.json();
      
      return {
        status,
        data,
        success: true
      };
    } catch (error) {
      return {
        error: error.message,
        success: false
      };
    }
  });

  console.log('\n=== Cleanup Endpoint Test Results ===');
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (!result.success) {
    console.error('Error:', result.error);
  }

  // Keep browser open for manual inspection
  console.log('\nTest complete. Browser will remain open for inspection.');
  console.log('Press Ctrl+C to exit.');
})();