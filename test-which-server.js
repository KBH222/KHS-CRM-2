// Test to see which server.js is being used
const apiUrl = 'https://crm-backend-production-a74e.up.railway.app';

async function testServer() {
  console.log('Testing which server is running...\n');
  
  // Test 1: Check health endpoint response format
  const healthResponse = await fetch(`${apiUrl}/api/health`);
  const healthData = await healthResponse.json();
  console.log('Health endpoint response:', JSON.stringify(healthData, null, 2));
  
  // The main server.js has a more detailed response with frontend info
  // The backend/api/server.js has a simple response
  
  if (healthData.frontend) {
    console.log('\n✓ Main server.js is running (has frontend info)');
  } else if (healthData.database === 'Connected') {
    console.log('\n✗ backend/api/server.js is running (simple format)');
  } else {
    console.log('\n? Unknown server configuration');
  }
  
  // Test 2: Check for nuclear-clear endpoint
  console.log('\nChecking for nuclear-clear endpoint...');
  const nuclearResponse = await fetch(`${apiUrl}/api/admin/nuclear-clear-customers`);
  console.log('Nuclear-clear status:', nuclearResponse.status);
  if (nuclearResponse.status === 404) {
    console.log('Nuclear-clear endpoint NOT FOUND - confirms wrong server is running');
  }
}

testServer().catch(console.error);