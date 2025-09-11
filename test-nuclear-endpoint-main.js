// Test nuclear clear endpoint on the main Railway deployment
const apiUrl = 'https://khs-crm-4-production.up.railway.app';

async function testNuclearClear() {
  console.log(`Testing nuclear clear endpoint at: ${apiUrl}`);
  console.log('-------------------------------------------');
  
  try {
    const response = await fetch(`${apiUrl}/api/admin/nuclear-clear-customers`);
    console.log('Response status:', response.status);
    console.log('Response content-type:', response.headers.get('content-type'));
    
    const text = await response.text();
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = JSON.parse(text);
      console.log('Response JSON:', JSON.stringify(data, null, 2));
    } else {
      console.log('Response is not JSON, first 200 chars:', text.substring(0, 200));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testNuclearClear();