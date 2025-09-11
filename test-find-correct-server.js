async function testServers() {
  const servers = [
    'https://khs-crm-production.up.railway.app',
    'https://khs-crm-2-production.up.railway.app',
    'https://khs-crm-3-production.up.railway.app',
    'https://khs-crm-4-production.up.railway.app',
    'https://crm-backend-production-a74e.up.railway.app'
  ];

  console.log('Testing all known Railway servers...\n');

  for (const server of servers) {
    try {
      console.log(`Testing: ${server}`);
      
      // Test health endpoint
      const healthResponse = await fetch(`${server}/api/health`);
      const healthText = await healthResponse.text();
      console.log(`  Health check: ${healthResponse.status} - ${healthText.substring(0, 50)}...`);
      
      // Test nuclear clear endpoint
      const nuclearResponse = await fetch(`${server}/api/admin/nuclear-clear-customers`);
      const nuclearStatus = nuclearResponse.status;
      console.log(`  Nuclear clear endpoint: ${nuclearStatus}`);
      
      if (nuclearStatus === 405 || nuclearStatus === 200) {
        console.log(`  ✓ This server has the nuclear clear endpoint!\n`);
      } else {
        console.log(`  ✗ Endpoint not found\n`);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}\n`);
    }
  }
}

testServers();