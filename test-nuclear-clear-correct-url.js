const apiUrl = 'https://crm-backend-production-a74e.up.railway.app';

// Test the nuclear clear endpoint with the correct API URL
fetch(`${apiUrl}/api/admin/nuclear-clear-customers`)
  .then(response => {
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    return response.text();
  })
  .then(text => {
    console.log('Response text:', text);
    try {
      const data = JSON.parse(text);
      console.log('Response JSON:', data);
    } catch (e) {
      console.log('Response is not JSON');
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });