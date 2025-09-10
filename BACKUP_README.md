# Database Backup Script

This script creates automated backups of your PostgreSQL database.

## Prerequisites

1. **PostgreSQL client tools** must be installed:
   - **Mac**: `brew install postgresql`
   - **Windows**: Download from [PostgreSQL downloads](https://www.postgresql.org/download/windows/)
   - **Docker alternative**: `docker run -it --rm postgres pg_dump ...`

2. **Node.js** and **npm** installed

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   
   **Option A**: Using DATABASE_URL (Railway format)
   ```bash
   DATABASE_URL=postgresql://user:password@host:port/database
   ```
   
   **Option B**: Using individual variables
   ```bash
   PGHOST=your-host.railway.app
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=your-password
   PGDATABASE=railway
   ```

## Usage

Run the backup script:
```bash
npm run backup
```

Or directly:
```bash
node backup-database.js
```

## Features

- ✅ Tests database connection before backup
- 📁 Creates timestamped backup files
- 🗑️ Automatically cleans backups older than 7 days
- 🔄 Shows progress during backup
- 🖥️ Works on Windows, Mac, and Linux
- ⚡ Error handling and validation

## Output

Backups are saved to the `backups/` directory with names like:
```
backup-2024-12-09T10-30-45.sql
```

## Scheduling

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily/weekly)
4. Set action: `npm run backup`
5. Set working directory to project root

### Mac/Linux (cron)
Add to crontab (`crontab -e`):
```bash
# Daily at 2 AM
0 2 * * * cd /path/to/khs-crm && npm run backup
```

### Railway (scheduled jobs)
Use Railway's cron jobs feature to run backups automatically.

## Restore from Backup

To restore a backup:
```bash
psql -h host -p port -U user -d database < backups/backup-2024-12-09T10-30-45.sql
```

## Troubleshooting

- **pg_dump not found**: Install PostgreSQL client tools
- **Connection refused**: Check your database credentials and network
- **Permission denied**: Ensure database user has backup permissions