const cron = require('node-cron');
const notifier = require('node-notifier');
const winston = require('winston');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const execAsync = promisify(exec);

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'backup-service.log' }),
    new winston.transports.Console()
  ]
});

// Configuration
const config = {
  schedule: process.env.BACKUP_SCHEDULE || '0 */6 * * *', // Every 6 hours
  databaseUrl: process.env.DATABASE_URL,
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, 'backups'),
  maxBackups: parseInt(process.env.MAX_BACKUPS || '30'),
  notificationsEnabled: process.env.NOTIFICATIONS_ENABLED !== 'false'
};

// Parse database URL
function parseDatabaseUrl(url) {
  if (!url) {
    throw new Error('DATABASE_URL not configured');
  }
  
  const dbUrl = new URL(url);
  return {
    host: dbUrl.hostname,
    port: dbUrl.port || 5432,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1)
  };
}

// Test database connection
async function testConnection() {
  const dbConfig = parseDatabaseUrl(config.databaseUrl);
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (error) {
    await client.end();
    throw error;
  }
}

// Send desktop notification
function sendNotification(title, message, isError = false) {
  if (!config.notificationsEnabled) return;
  
  notifier.notify({
    title: title,
    message: message,
    icon: path.join(__dirname, isError ? 'error.png' : 'success.png'),
    sound: isError,
    wait: false
  });
}

// Create backup
async function createBackup() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `khs-backup-${timestamp}.sql`;
  const filepath = path.join(config.backupDir, filename);
  
  try {
    logger.info('Starting backup process...');
    
    // Ensure backup directory exists
    if (!fs.existsSync(config.backupDir)) {
      fs.mkdirSync(config.backupDir, { recursive: true });
      logger.info(`Created backup directory: ${config.backupDir}`);
    }
    
    // Test database connection
    logger.info('Testing database connection...');
    await testConnection();
    logger.info('Database connection successful');
    
    // Parse database config
    const dbConfig = parseDatabaseUrl(config.databaseUrl);
    
    // Build pg_dump command
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${filepath}" --no-owner --no-privileges --verbose`;
    
    logger.info(`Running backup command...`);
    
    // Execute pg_dump
    const { stdout, stderr } = await execAsync(command, { env });
    
    // Log pg_dump output
    if (stderr) {
      logger.info(`pg_dump output: ${stderr}`);
    }
    
    // Check if backup was created
    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file was not created');
    }
    
    // Get file size
    const stats = fs.statSync(filepath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    // Check if backup has content
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    logger.info(`Backup completed successfully: ${filename} (${fileSizeMB} MB) in ${duration}s`);
    sendNotification(
      'KHS CRM Backup Success',
      `Backup completed: ${filename}\nSize: ${fileSizeMB} MB\nDuration: ${duration}s`
    );
    
    // Clean old backups
    await cleanOldBackups();
    
    return { success: true, filename, size: fileSizeMB, duration };
    
  } catch (error) {
    const errorMsg = `Backup failed: ${error.message}`;
    logger.error(errorMsg);
    logger.error(error.stack);
    
    sendNotification(
      'KHS CRM Backup Failed',
      errorMsg,
      true
    );
    
    // Clean up failed backup file if it exists
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    
    return { success: false, error: error.message };
  }
}

// Clean old backups
async function cleanOldBackups() {
  try {
    const files = fs.readdirSync(config.backupDir)
      .filter(f => f.startsWith('khs-backup-') && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(config.backupDir, f),
        time: fs.statSync(path.join(config.backupDir, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);
    
    // Keep only the most recent backups
    if (files.length > config.maxBackups) {
      const toDelete = files.slice(config.maxBackups);
      
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        logger.info(`Deleted old backup: ${file.name}`);
      }
      
      logger.info(`Cleaned ${toDelete.length} old backups, keeping ${config.maxBackups} most recent`);
    }
  } catch (error) {
    logger.error(`Failed to clean old backups: ${error.message}`);
  }
}

// Check if pg_dump is available
async function checkPgDump() {
  try {
    await execAsync('pg_dump --version');
    return true;
  } catch (error) {
    return false;
  }
}

// Main function
async function main() {
  logger.info('===========================================');
  logger.info('KHS CRM Backup Service Starting...');
  logger.info(`Schedule: ${config.schedule}`);
  logger.info(`Backup directory: ${config.backupDir}`);
  logger.info(`Max backups to keep: ${config.maxBackups}`);
  logger.info(`Notifications: ${config.notificationsEnabled ? 'enabled' : 'disabled'}`);
  logger.info('===========================================');
  
  // Check if pg_dump is available
  const hasPgDump = await checkPgDump();
  if (!hasPgDump) {
    const error = 'pg_dump not found! Please install PostgreSQL client tools.';
    logger.error(error);
    sendNotification('KHS CRM Backup Service', error, true);
    process.exit(1);
  }
  
  // Run once immediately if --once flag is passed
  if (process.argv.includes('--once')) {
    logger.info('Running single backup (--once flag detected)');
    await createBackup();
    process.exit(0);
  }
  
  // Run initial backup on startup
  logger.info('Running initial backup on startup...');
  await createBackup();
  
  // Schedule backups
  const task = cron.schedule(config.schedule, async () => {
    logger.info('Scheduled backup triggered');
    await createBackup();
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    task.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    task.stop();
    process.exit(0);
  });
  
  logger.info('Backup service is running. Press Ctrl+C to stop.');
  
  // Send startup notification
  sendNotification(
    'KHS CRM Backup Service',
    'Backup service started successfully.\nBackups will run every 6 hours.'
  );
}

// Start the service
main().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});