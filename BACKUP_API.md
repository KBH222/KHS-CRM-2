# Backup API Documentation

The backup API provides server-side database backup functionality using `pg_dump`. All endpoints require authentication and OWNER role.

## Authentication

All backup endpoints require:
1. Valid JWT token in Authorization header: `Bearer <token>`
2. User must have `OWNER` role

## Endpoints

### 1. Create Backup
**POST** `/api/backup/create`

Creates a new PostgreSQL database backup using pg_dump.

**Response:**
```json
{
  "success": true,
  "filename": "backup-2024-12-09T10-30-45.sql",
  "size": "0.04 MB",
  "timestamp": "2024-12-09T10:30:45.000Z"
}
```

**Notes:**
- Automatically cleans up backups older than 30 days
- Requires pg_dump to be installed on server

### 2. List Backups
**GET** `/api/backup/list`

Returns list of available backup files.

**Response:**
```json
{
  "success": true,
  "backups": [
    {
      "filename": "backup-2024-12-09T10-30-45.sql",
      "size": "0.04 MB",
      "created": "2024-12-09T10:30:45.000Z",
      "modified": "2024-12-09T10:30:45.000Z"
    }
  ],
  "count": 1
}
```

### 3. Download Backup
**GET** `/api/backup/download/:filename`

Downloads a specific backup file.

**Parameters:**
- `filename`: Name of backup file (e.g., `backup-2024-12-09T10-30-45.sql`)

**Response:**
- Binary file download with `Content-Type: application/sql`
- `Content-Disposition: attachment`

### 4. Delete Backup
**DELETE** `/api/backup/:filename`

Deletes a specific backup file.

**Parameters:**
- `filename`: Name of backup file to delete

**Response:**
```json
{
  "success": true,
  "message": "Backup deleted successfully",
  "filename": "backup-2024-12-09T10-30-45.sql"
}
```

## Error Responses

All endpoints may return error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

Common errors:
- `401`: No authorization token or invalid token
- `403`: Access denied (not OWNER role)
- `404`: Backup file not found
- `500`: Server error (check if pg_dump is installed)

## Frontend Integration

Example usage with fetch:

```javascript
// Create backup
const response = await fetch('/api/backup/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// List backups
const response = await fetch('/api/backup/list', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Download backup
window.location.href = `/api/backup/download/${filename}?token=${token}`;
```

## Server Requirements

1. PostgreSQL client tools must be installed (`pg_dump`)
2. Write permissions for `server-backups/` directory
3. Sufficient disk space for backup files

## Security

- All endpoints require authentication
- Only users with OWNER role can access backup features
- Filename validation prevents directory traversal attacks
- Backup files are stored outside of public directories