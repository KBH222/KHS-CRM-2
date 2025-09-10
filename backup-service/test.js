// Quick test script to verify configuration
require('dotenv').config();

console.log('Testing backup service configuration...\n');

// Check environment variables
console.log('✓ DATABASE_URL:', process.env.DATABASE_URL ? 'Configured' : '❌ NOT SET');
console.log('✓ BACKUP_SCHEDULE:', process.env.BACKUP_SCHEDULE || '0 */6 * * * (default)');
console.log('✓ BACKUP_DIR:', process.env.BACKUP_DIR || './backups (default)');
console.log('✓ MAX_BACKUPS:', process.env.MAX_BACKUPS || '30 (default)');
console.log('✓ NOTIFICATIONS_ENABLED:', process.env.NOTIFICATIONS_ENABLED !== 'false' ? 'Yes' : 'No');

// Check pg_dump
const { exec } = require('child_process');
exec('pg_dump --version', (error, stdout) => {
  if (error) {
    console.log('\n❌ pg_dump not found - please install PostgreSQL client tools');
  } else {
    console.log('\n✓ pg_dump found:', stdout.trim());
  }
  
  if (!process.env.DATABASE_URL) {
    console.log('\n⚠️  Please copy .env.example to .env and add your DATABASE_URL');
  } else {
    console.log('\n✅ Configuration looks good! Run "npm start" to begin.');
  }
});