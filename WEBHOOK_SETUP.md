# Strava Webhook Integration - Setup Guide

This guide walks you through setting up and deploying the Strava webhook integration for automatic song mapping.

## Overview

The webhook integration enables automatic processing of runs as soon as they're uploaded from your watch to Strava. When enabled:

1. User uploads a run from their watch to Strava
2. Strava sends a webhook notification to your application
3. Application fetches run details and Spotify listening history
4. Songs are automatically mapped to GPS coordinates
5. Run is ready to view immediately in the dashboard

## Architecture

### Key Components

1. **Webhook Endpoints**
   - `POST /api/webhooks/strava` - Receives webhook events from Strava
   - `GET /api/webhooks/strava` - Handles subscription verification

2. **Subscription Management**
   - `POST /api/webhooks/subscribe` - Create new webhook subscription
   - `GET /api/webhooks/subscribe` - List active subscriptions
   - `DELETE /api/webhooks/subscribe` - Remove subscription

3. **Job Processing**
   - `POST /api/jobs/process` - Manual job processing trigger
   - `GET /api/jobs/process` - Job queue statistics
   - `GET /api/cron/process-jobs` - Automated cron endpoint

4. **Background Processing**
   - Job queue system with retry logic
   - Automatic Spotify token refresh
   - Exponential backoff for failed jobs

### Token Management for Webhooks

**Challenge**: Webhooks are server-initiated events without user interaction. How do we maintain valid Spotify access tokens?

**Solution**:
- Spotify refresh tokens are stored in the database and don't expire (unless revoked)
- When a webhook triggers, the system automatically:
  1. Fetches the user's refresh token from the database
  2. Checks if the access token is expired (5-minute buffer)
  3. Refreshes the token if needed using the refresh token
  4. Makes Spotify API calls with the valid access token
- All of this happens in the background without user interaction

## Prerequisites

### 1. Database Setup

Apply the webhook integration migration:

```bash
# Backup your database first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migration
psql $DATABASE_URL -f migrations/002_webhook_integration.sql

# Verify tables were created
psql $DATABASE_URL -c "\dt webhook_*"
psql $DATABASE_URL -c "\dt processing_jobs"
```

Expected tables:
- `webhook_subscriptions`
- `webhook_events`
- `processing_jobs`

### 2. Environment Variables

Add to your `.env` file:

```bash
# Strava API credentials (existing)
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret

# Spotify API credentials (existing)
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Database connection (existing)
DATABASE_URL=postgresql://user:password@host:port/database

# Cron secret for protecting automated endpoints (new)
CRON_SECRET=generate_a_random_secret_here
```

Generate a secure cron secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Public URL Requirement

Strava webhooks require a publicly accessible HTTPS URL. Options:

**Development:**
- Use [ngrok](https://ngrok.com/) for local testing
- Use [localtunnel](https://localtunnel.github.io/www/)

**Production:**
- Deploy to Vercel, Railway, Heroku, or any cloud provider
- Ensure HTTPS is enabled (required by Strava)

## Local Development Setup

### Step 1: Start ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Start your dev server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Note the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### Step 2: Create Webhook Subscription

**Option A: Using the Dashboard UI**
1. Navigate to `http://localhost:3000/dashboard`
2. Find the "Webhook Settings" section
3. Click "Enable Automatic Processing"
4. The callback URL will automatically use your current domain

**Option B: Using curl**
```bash
curl -X POST http://localhost:3000/api/webhooks/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://YOUR-NGROK-URL.ngrok.io/api/webhooks/strava"
  }'
```

### Step 3: Verify Subscription

Check Strava sent the verification challenge:

```bash
# View ngrok request logs
ngrok http 3000 --log=stdout

# Or check your database
psql $DATABASE_URL -c "SELECT * FROM webhook_subscriptions;"
```

### Step 4: Test with Mock Event

```bash
# Get your Strava athlete ID
# (You can find it in the users table or from Strava profile URL)

# Send a test webhook event
curl -X POST http://localhost:3000/api/test/webhook-event \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": 123456789,
    "athleteId": YOUR_STRAVA_ATHLETE_ID
  }'
```

### Step 5: Process the Job

Jobs are processed automatically by cron, but you can trigger manually:

```bash
# Process pending jobs
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Check job status
curl http://localhost:3000/api/jobs/process
```

### Step 6: Verify Results

```bash
# Check webhook events
psql $DATABASE_URL -c "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 5;"

# Check processing jobs
psql $DATABASE_URL -c "SELECT id, status, error_message FROM processing_jobs ORDER BY created_at DESC LIMIT 5;"

# Check if activity was stored
psql $DATABASE_URL -c "SELECT id, strava_activity_id, name FROM activities ORDER BY created_at DESC LIMIT 1;"
```

## Production Deployment

### Step 1: Deploy Application

**Vercel** (Recommended):
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# DATABASE_URL, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, CRON_SECRET
```

**Other platforms:**
- Railway: Connect GitHub repo, configure environment variables
- Heroku: `git push heroku main` + configure env vars
- Docker: Build and deploy container

### Step 2: Set Up Automated Job Processing

**Option A: Vercel Cron**

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-jobs",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

This runs every 2 minutes.

**Option B: External Cron Service**

Use [cron-job.org](https://cron-job.org/) or similar:
- URL: `https://your-domain.com/api/cron/process-jobs`
- Method: GET
- Schedule: Every 2-5 minutes
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

**Option C: GitHub Actions**

Create `.github/workflows/process-jobs.yml`:
```yaml
name: Process Webhook Jobs
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger job processing
        run: |
          curl -X GET https://your-domain.com/api/cron/process-jobs \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Step 3: Create Production Webhook Subscription

```bash
# Using production URL
curl -X POST https://your-domain.com/api/webhooks/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://your-domain.com/api/webhooks/strava"
  }'
```

Or use the dashboard UI at `https://your-domain.com/dashboard`.

### Step 4: Update Strava Application Settings

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Add production domain to "Authorization Callback Domain"
3. Ensure webhook callback URL is whitelisted

## Monitoring & Maintenance

### Check System Health

```bash
# View job queue statistics
curl https://your-domain.com/api/jobs/process

# Check recent webhook events
psql $DATABASE_URL -c "
  SELECT
    object_type,
    aspect_type,
    processed,
    created_at
  FROM webhook_events
  ORDER BY created_at DESC
  LIMIT 10;
"

# Check failed jobs
psql $DATABASE_URL -c "
  SELECT
    id,
    job_type,
    status,
    error_message,
    attempts
  FROM processing_jobs
  WHERE status = 'failed'
  ORDER BY created_at DESC;
"
```

### Database Maintenance

```sql
-- Clean up old completed jobs (older than 30 days)
DELETE FROM processing_jobs
WHERE status = 'completed'
  AND completed_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

-- Clean up old webhook events (older than 90 days)
DELETE FROM webhook_events
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
```

Or use the API:
```bash
curl -X POST https://your-domain.com/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{"cleanup": true}'
```

### Handling Token Expiration

If a user revokes Spotify access:
1. Jobs will fail with authentication error
2. Job will be marked as 'failed' after max retries
3. User needs to re-authenticate with Spotify
4. Old jobs can be retried after re-authentication

### Monitoring Recommendations

Set up alerts for:
- High number of failed jobs
- Webhook endpoint errors (5xx responses)
- Token refresh failures
- Job processing delays (jobs stuck in 'pending' > 10 minutes)

## Troubleshooting

### Webhook Not Receiving Events

**Check 1: Verify subscription is active**
```bash
curl https://your-domain.com/api/webhooks/subscribe
```

**Check 2: Check Strava's webhook logs**
- Visit [Strava API Settings](https://www.strava.com/settings/api)
- Look for delivery errors

**Check 3: Verify callback URL is accessible**
```bash
curl https://your-domain.com/api/webhooks/strava\?hub.mode=subscribe\&hub.challenge=test123\&hub.verify_token=YOUR_TOKEN
```
Should return: `{"hub.challenge": "test123"}`

### Jobs Stuck in Pending

**Solution 1: Check cron is running**
```bash
# Manually trigger processing
curl -X POST https://your-domain.com/api/jobs/process \
  -H "Content-Type: application/json"
```

**Solution 2: Check for errors**
```sql
SELECT id, status, error_message, scheduled_for
FROM processing_jobs
WHERE status IN ('pending', 'retry')
ORDER BY scheduled_for DESC;
```

### Spotify Token Refresh Failures

**Symptoms**:
- Jobs fail with "No Spotify token" error
- 401 authentication errors from Spotify

**Solution**:
1. User needs to re-authenticate with Spotify
2. Go to home page and click "Connect with Spotify"
3. Retry failed jobs:
   ```sql
   UPDATE processing_jobs
   SET status = 'pending', attempts = 0
   WHERE status = 'failed' AND user_id = USER_ID;
   ```

### Memory Issues with Large Job Queues

**Solution**: Process jobs in smaller batches
```bash
# Process only 5 jobs at a time
curl -X POST https://your-domain.com/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

## Security Considerations

### Webhook Endpoint Security

The webhook endpoint currently:
- ✅ Logs all events to database
- ✅ Validates required fields
- ✅ Returns 200 quickly to prevent Strava retries
- ⚠️ Does NOT verify HMAC signature (optional enhancement)

**To add HMAC verification** (recommended for production):

Uncomment the signature verification in `/api/webhooks/strava/route.ts`:
```typescript
// Verify webhook signature
const signature = request.headers.get('x-hub-signature');
if (signature && !verifyWebhookSignature(JSON.stringify(body), signature)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
}
```

### Cron Endpoint Security

The cron endpoint is protected by:
1. `CRON_SECRET` environment variable
2. Authorization header check

Always use HTTPS in production to prevent secret leakage.

### Database Access

- Use read-only credentials for monitoring queries
- Limit job cleanup to prevent accidental data loss
- Regular backups before maintenance

## Performance Optimization

### Database Indexes

The migration creates indexes on:
- `webhook_events(object_id, owner_id, processed)`
- `processing_jobs(status, scheduled_for, priority)`

Monitor slow queries:
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM processing_jobs
WHERE status = 'pending'
ORDER BY priority DESC, scheduled_for ASC
LIMIT 10;
```

### Job Processing Optimization

- Adjust cron frequency based on load (1-5 minutes)
- Process jobs in batches (limit parameter)
- Clean up old jobs regularly
- Consider separate worker process for high-volume deployments

## Migration from Manual Processing

If you have existing users:

1. **Enable webhooks gradually**
   - Start with test users
   - Monitor for issues
   - Roll out to all users

2. **Inform users**
   - Runs will be processed automatically
   - Manual "Map Music" button still works
   - Old runs can still be manually processed

3. **Data consistency**
   - Webhook processing uses same logic as manual processing
   - Song IDs remain stable (no duplicates)
   - Both methods can be used simultaneously

## Rollback Procedure

If you need to disable webhooks:

```bash
# Get subscription ID
curl https://your-domain.com/api/webhooks/subscribe

# Delete subscription
curl -X DELETE "https://your-domain.com/api/webhooks/subscribe?id=SUBSCRIPTION_ID"

# Stop cron job
# (Remove vercel.json cron configuration or disable external cron)

# Database remains intact - manual processing still works
```

## Support & Resources

- [Strava Webhook Events API](https://developers.strava.com/docs/webhooks/)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [Test Plan](tests/webhook-integration-test.md)
- [Migration Details](migrations/002_webhook_integration.sql)

## Next Steps

1. ✅ Apply database migration
2. ✅ Set up environment variables
3. ✅ Test in development with ngrok
4. ✅ Deploy to production
5. ✅ Configure cron job
6. ✅ Create webhook subscription
7. ✅ Test with real run upload
8. ✅ Set up monitoring
9. ✅ Document for users

Your runs will now be automatically processed and ready to view as soon as they're uploaded from your watch!
