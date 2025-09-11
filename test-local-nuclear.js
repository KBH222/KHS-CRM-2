// Test nuclear-clear endpoint locally
setTimeout(async () => {
  try {
    const response = await fetch('http://localhost:3000/api/admin/nuclear-clear-customers');
    console.log('Local nuclear-clear endpoint status:', response.status);
    if (response.status === 200 || response.status === 500) {
      console.log('✓ Endpoint exists in root server.js');
    } else {
      console.log('✗ Endpoint not found');
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  process.exit(0);
}, 2000);