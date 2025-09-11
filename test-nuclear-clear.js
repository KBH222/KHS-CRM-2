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
  await page.goto('https://crm-backend-production-a74e.up.railway.app', {
    waitUntil: 'networkidle'
  });

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Execute the nuclear clear request
  console.log('\nCalling nuclear clear endpoint (no auth required)...');
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/admin/nuclear-clear-customers', {
        method: 'GET'
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
        success: false
      };
    }
  });

  console.log('\n=== Nuclear Clear Results ===');
  if (result.status) {
    console.log('Status:', result.status, result.statusText);
  }
  console.log('Success:', result.success);
  console.log('Response:', JSON.stringify(result.data, null, 2));

  // Keep browser open
  console.log('\nBrowser will remain open. Check Railway logs for detailed console output.');
  console.log('Press Ctrl+C to exit.');
})();