const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { Client } = require('pg');

// Parse DATABASE_URL or use individual env vars
function getDbConfig() {
  if (process.env.DATABASE_URL) {
    // Parse DATABASE_URL format: postgresql://user:pass@host:port/dbname
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: url.port || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading /
    };
  } else {
    // Use individual env vars
    return {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    };
  }
}

// Test database connection
async function testConnection(config) {
  console.log('🔍 Testing database connection...');
  const client = new Client(config);
  
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ Connected successfully at:', res.rows[0].now);
    await client.end();
    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    await client.end();
    return false;
  }
}

// Create backup using pg_dump
async function createBackup(config) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(__dirname, 'backups');
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('📁 Created backups directory');
  }
  
  console.log('🔄 Starting backup...');
  console.log(`📄 Backup file: ${path.basename(backupFile)}`);
  
  // Build pg_dump command
  // Use PGPASSWORD env var for password (works on both Windows and Mac)
  const env = {
    ...process.env,
    PGPASSWORD: config.password
  };
  
  const command = `pg_dump -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${backupFile}" --verbose --no-owner --no-privileges`;
  
  try {
    console.log('⏳ Running pg_dump...');
    const { stdout, stderr } = await execAsync(command, { env });
    
    // pg_dump outputs to stderr even for non-errors
    if (stderr && !stderr.includes('error')) {
      console.log('📊 pg_dump output:', stderr);
    }
    
    // Check if file was created and has content
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    if (stats.size > 0) {
      console.log(`✅ Backup completed successfully (${fileSizeMB} MB)`);
      return backupFile;
    } else {
      throw new Error('Backup file is empty');
    }
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    // Clean up empty file if it exists
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile);
    }
    throw err;
  }
}

// Clean up old backups (keep only last 7 days)
async function cleanupOldBackups() {
  console.log('\n🧹 Cleaning up old backups...');
  const backupDir = path.join(__dirname, 'backups');
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = Date.now();
  
  try {
    const files = fs.readdirSync(backupDir);
    let deletedCount = 0;
    
    for (const file of files) {
      if (file.startsWith('backup-') && file.endsWith('.sql')) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const fileAgeMs = now - stats.mtimeMs;
        
        if (fileAgeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          console.log(`  🗑️  Deleted old backup: ${file}`);
          deletedCount++;
        }
      }
    }
    
    if (deletedCount === 0) {
      console.log('  ✅ No old backups to clean up');
    } else {
      console.log(`  ✅ Cleaned up ${deletedCount} old backup(s)`);
    }
  } catch (err) {
    console.error('⚠️  Cleanup warning:', err.message);
  }
}

// Check if pg_dump is available
async function checkPgDump() {
  try {
    await execAsync('pg_dump --version');
    return true;
  } catch (err) {
    return false;
  }
}

// Main backup function
async function runBackup() {
  console.log('🚀 PostgreSQL Backup Script');
  console.log('==========================\n');
  
  try {
    // Check if pg_dump is available
    const hasPgDump = await checkPgDump();
    if (!hasPgDump) {
      throw new Error(
        'pg_dump not found! Please install PostgreSQL client tools:\n' +
        '  - Mac: brew install postgresql\n' +
        '  - Windows: Download from https://www.postgresql.org/download/windows/\n' +
        '  - Or use Docker: docker run -it --rm postgres pg_dump ...'
      );
    }
    
    // Get database config
    const config = getDbConfig();
    console.log(`📍 Database: ${config.user}@${config.host}:${config.port}/${config.database}\n`);
    
    // Test connection
    const connected = await testConnection(config);
    if (!connected) {
      throw new Error('Could not connect to database');
    }
    
    // Create backup
    console.log('');
    const backupFile = await createBackup(config);
    
    // Clean up old backups
    await cleanupOldBackups();
    
    console.log('\n✨ Backup process completed successfully!');
  } catch (err) {
    console.error('\n💥 Backup process failed:', err.message);
    process.exit(1);
  }
}

// Run the backup
runBackup();