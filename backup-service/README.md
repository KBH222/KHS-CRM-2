# KHS CRM Backup Service

Automated PostgreSQL backup service that runs every 6 hours, saves backups locally, and sends desktop notifications.

## Features

✅ Scheduled backups every 6 hours (configurable)  
✅ Desktop notifications on success/failure  
✅ Automatic cleanup of old backups  
✅ Comprehensive logging  
✅ Can run as background process  
✅ Works on Windows and Mac  

## Prerequisites

1. **Node.js** (v14 or higher)
2. **PostgreSQL client tools** (pg_dump)
   - Mac: `brew install postgresql`
   - Windows: Download from [PostgreSQL website](https://www.postgresql.org/download/windows/)

## Installation

1. Clone or copy the backup-service folder
2. Install dependencies:
   ```bash
   cd backup-service
   npm install
   ```

3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your Railway database URL:
   ```
   DATABASE_URL=postgresql://user:password@host.railway.app:5432/railway
   ```

## Usage

### Quick Start
```bash
npm start
```
This runs the service in the foreground. Press Ctrl+C to stop.

### Test Single Backup
```bash
npm run dev
```
This runs one backup immediately and exits.

### Run as Background Process (PM2)

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the service:
   ```bash
   npm run pm2:start
   ```

3. Other PM2 commands:
   ```bash
   npm run pm2:status   # Check status
   npm run pm2:logs     # View logs
   npm run pm2:stop     # Stop service
   ```

4. Make it start on system boot:
   ```bash
   pm2 startup
   pm2 save
   ```

### Run as Windows Service

For Windows, you can use PM2 with pm2-windows-service:
```bash
npm install -g pm2-windows-service
pm2-service-install
```

## Configuration

Edit `.env` file to customize:

- **DATABASE_URL**: Your Railway PostgreSQL connection string
- **BACKUP_SCHEDULE**: Cron expression (default: "0 */6 * * *" = every 6 hours)
- **BACKUP_DIR**: Where to save backups (default: ./backups)
- **MAX_BACKUPS**: Number of backups to keep (default: 30)
- **NOTIFICATIONS_ENABLED**: Enable/disable desktop notifications

### Cron Schedule Examples
- `"0 */6 * * *"` - Every 6 hours
- `"0 2 * * *"` - Daily at 2 AM
- `"0 0 * * 0"` - Weekly on Sunday
- `"*/15 * * * *"` - Every 15 minutes (testing)

## File Structure

```
backup-service/
├── index.js              # Main service file
├── package.json         # Dependencies
├── .env                 # Your configuration (create from .env.example)
├── .env.example         # Configuration template
├── ecosystem.config.js  # PM2 configuration
├── backup-service.log   # Service logs
└── backups/            # Backup files directory
    ├── khs-backup-2024-12-09T10-30-45.sql
    └── ...
```

## Logs

Logs are written to:
- `backup-service.log` - All service logs
- Console output when running in foreground
- PM2 logs in `logs/` directory when using PM2

## Troubleshooting

### "pg_dump not found"
Install PostgreSQL client tools (see Prerequisites)

### No notifications on Mac
Grant Terminal/Node.js permission in System Preferences > Notifications

### Permission denied
Make sure the backup directory is writable

### Database connection failed
Check your DATABASE_URL in .env file

## Restore from Backup

To restore a backup:
```bash
psql DATABASE_URL < backups/khs-backup-2024-12-09T10-30-45.sql
```

## Security Notes

- Never commit `.env` file to git
- Keep backup files secure
- Consider encrypting backups for sensitive data
- Rotate database credentials regularly