# KHS CRM - Important Commands for Claude

## Backend Commands

### Start Backend Server
```bash
node server.js
```

### Database Commands
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Deploy migrations to production (Railway)
npx prisma migrate deploy

# Check database schema
npx prisma db pull

# Open Prisma Studio
npx prisma studio
```

## Frontend Commands

### Start Development Server
```bash
cd frontend
npm run dev
```

### Build for Production
```bash
cd frontend
npm run build
```

### Run Tests and Verification
```bash
cd frontend
npm run verify         # Quick verification (typecheck + lint + tests)
npm run verify:full    # Full verification including build
npm run typecheck      # TypeScript type checking only
npm run lint           # ESLint only
npm run test:run       # Run tests once
```

## Deployment

### Deploy to Railway
1. Commit all changes
2. Push to master branch
3. Railway will auto-deploy

### Deploy to Vercel
```bash
vercel --prod
```

## Important API Endpoints

### Debug Endpoints (Production)
- `https://khs-crm-4-production.up.railway.app/api/health` - Check if API is running
- `https://khs-crm-4-production.up.railway.app/api/check-schema` - Check if photos/plans columns exist
- `https://khs-crm-4-production.up.railway.app/api/debug/jobs` - List all jobs with photo status
- `https://khs-crm-4-production.up.railway.app/api/debug/job/:jobId` - Check specific job data
- `https://khs-crm-4-production.up.railway.app/api/test-photo-save/:jobId` - Test photo save functionality
- `https://khs-crm-4-production.up.railway.app/api/debug/field-limits` - Check database field size limits
- `https://khs-crm-4-production.up.railway.app/api/debug/express-config` - Check Express configuration and limits
- `POST https://khs-crm-4-production.up.railway.app/api/test-photo-size-limit` - Test photo size limits (requires customerId in body)

## Common Issues and Solutions

### Photos Not Saving
1. Check if migration has been run on Railway: `npx prisma migrate deploy`
2. Verify schema has photos/plans columns: Check `/api/check-schema` endpoint
3. Check for truncation in logs after save
4. Verify database type matches (PostgreSQL not MySQL)

### Build Errors
1. Always run `npm run verify` before committing
2. Check for duplicate function declarations
3. Ensure all imports are correct

### Database Connection Issues
1. Check DATABASE_URL in .env
2. For Railway: URL is automatically injected
3. For local: Use connection string from .env

## Key Files

- `server.js` - Backend Express server
- `prisma/schema.prisma` - Database schema
- `frontend/src/pages/CustomersEnhanced.tsx` - Main customers page
- `frontend/src/services/api/jobs.api.ts` - Jobs API client
- `frontend/src/utils/imageCompression.ts` - Image compression utility

## Environment Variables

### Backend (.env)
```
DATABASE_URL="postgresql://..."
PORT=3000
NODE_ENV=production
```

### Frontend (.env)
```
VITE_API_URL=https://khs-crm-4-production.up.railway.app
```

## Testing Photo Persistence

1. Add photos to a job
2. Check browser console for logging
3. Check Railway logs for backend logging
4. Use debug endpoints to verify database state
5. Refresh page to see if photos persist

## Railway Webhook Troubleshooting

Last checked: 2025-01-09
- Verify webhook in Railway dashboard under Settings > GitHub
- Check deployment triggers are set to master branch
- Ensure GitHub integration is connected
```