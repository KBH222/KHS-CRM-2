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

  console.log('\nPlease log in manually in the browser window.');
  console.log('Once logged in, press Enter to continue...');
  
  // Wait for user to press Enter
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Execute the fetch command in the browser context
  console.log('\nTesting cleanup endpoint...');
  const result = await page.evaluate(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { error: 'No auth token found in localStorage. Please ensure you are logged in.' };
      }

      console.log('Token found, making request...');
      const response = await fetch('/api/admin/cleanup-phantom-customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const status = response.status;
      const statusText = response.statusText;
      let data;
      
      try {
        data = await response.json();
      } catch (e) {
        data = { error: 'Failed to parse response as JSON', responseText: await response.text() };
      }
      
      return {
        status,
        statusText,
        data,
        success: response.ok
      };
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack,
        success: false
      };
    }
  });

  console.log('\n=== Cleanup Endpoint Test Results ===');
  if (result.status) {
    console.log('Status:', result.status, result.statusText);
  }
  console.log('Success:', result.success);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (!result.success && result.error) {
    console.error('Error:', result.error);
    if (result.stack) {
      console.error('Stack:', result.stack);
    }
  }

  // Also test the endpoint directly in console for comparison
  console.log('\n=== Running direct console test ===');
  await page.evaluate(() => {
    fetch('/api/admin/cleanup-phantom-customers', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(r => {
      console.log('Direct test - Status:', r.status, r.statusText);
      return r.json();
    })
    .then(data => {
      console.log('Direct test - Response:', data);
    })
    .catch(err => console.error('Direct test - Error:', err));
  });

  // Keep browser open for manual inspection
  console.log('\nTest complete. Browser will remain open for inspection.');
  console.log('You can also manually test in the DevTools console.');
  console.log('Press Ctrl+C to exit.');
})();