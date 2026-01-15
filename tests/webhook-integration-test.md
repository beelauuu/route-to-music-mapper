# Webhook Integration Test Plan

This document outlines the comprehensive testing strategy for the Strava webhook integration.

## Prerequisites

1. Database with migrations applied
2. Strava API credentials configured
3. Spotify API credentials configured
4. User authenticated with both Strava and Spotify
5. Public URL for webhook callback (ngrok for local testing)

## Test Environment Setup

### Local Development with ngrok

```bash
# Install ngrok if not already installed
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Start your development server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Note the HTTPS URL provided by ngrok (e.g., https://abc123.ngrok.io)
```

## Test Suite

### 1. Database Migration Test

**Purpose**: Verify database schema is correctly created

```sql
-- Connect to your database and run:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('webhook_subscriptions', 'webhook_events', 'processing_jobs');

-- Expected: All 3 tables should exist

-- Verify strava_athlete_id column in users table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'strava_athlete_id';

-- Expected: Column should exist with type 'bigint'
```

### 2. Token Manager Test

**Purpose**: Verify token refresh works for background processing

**Steps**:
1. Create a test script to verify token refresh

```bash
# Create test endpoint
curl -X POST http://localhost:3000/api/test/token-refresh \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
```

**Expected Result**:
- Tokens should be refreshed if expired
- No errors should occur
- New access tokens should be returned

### 3. Webhook Subscription Creation Test

**Purpose**: Verify webhook subscription can be created

**Steps**:

```bash
# Test subscription creation
curl -X POST http://localhost:3000/api/webhooks/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://YOUR-NGROK-URL.ngrok.io/api/webhooks/strava"
  }'
```

**Expected Result**:
```json
{
  "success": true,
  "subscription": {
    "id": 123456,
    "callback_url": "https://YOUR-NGROK-URL.ngrok.io/api/webhooks/strava",
    "created_at": "2024-01-15T12:00:00Z"
  },
  "message": "Webhook subscription created successfully"
}
```

**Verification**:
- Check database for subscription record
- Verify Strava sent a verification challenge (check ngrok logs)

### 4. Webhook Verification Challenge Test

**Purpose**: Verify webhook endpoint handles Strava's verification challenge

**Strava sends this request during subscription**:
```
GET /api/webhooks/strava?hub.mode=subscribe&hub.challenge=15f7d1a91c1f40f8a748fd134752feb3&hub.verify_token=YOUR_VERIFY_TOKEN
```

**Expected Response**:
```json
{
  "hub.challenge": "15f7d1a91c1f40f8a748fd134752feb3"
}
```

**Manual Test**:
```bash
# Simulate Strava verification
curl "http://localhost:3000/api/webhooks/strava?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=VERIFY_TOKEN_FROM_DB"
```

### 5. Webhook Event Handling Test

**Purpose**: Verify webhook processes activity creation events

**Simulate Strava Webhook Event**:

```bash
curl -X POST http://localhost:3000/api/webhooks/strava \
  -H "Content-Type: application/json" \
  -d '{
    "object_type": "activity",
    "object_id": 123456789,
    "aspect_type": "create",
    "owner_id": YOUR_STRAVA_ATHLETE_ID,
    "subscription_id": YOUR_SUBSCRIPTION_ID,
    "event_time": 1516126040
  }'
```

**Expected Result**:
```json
{
  "success": true
}
```

**Verification**:
1. Check `webhook_events` table for logged event
2. Check `processing_jobs` table for created job
3. Verify job status is 'pending'

```sql
-- Verify event was logged
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 1;

-- Verify job was created
SELECT * FROM processing_jobs ORDER BY created_at DESC LIMIT 1;
```

### 6. Background Job Processing Test

**Purpose**: Verify jobs are processed correctly

**Steps**:

```bash
# Manually trigger job processor
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

**Expected Result**:
```json
{
  "success": true,
  "processed": 1,
  "message": "Processed 1 jobs"
}
```

**Verification**:
1. Check job status changed to 'completed'
2. Check `activities` table for new activity
3. Check `activity_songs` table for mapped songs

```sql
-- Verify job completed
SELECT id, status, error_message, result_data
FROM processing_jobs
WHERE status = 'completed'
ORDER BY completed_at DESC LIMIT 1;

-- Verify activity was stored
SELECT id, strava_activity_id, name, start_date
FROM activities
ORDER BY created_at DESC LIMIT 1;

-- Verify songs were mapped
SELECT COUNT(*) as song_count
FROM activity_songs
WHERE activity_id = (SELECT id FROM activities ORDER BY created_at DESC LIMIT 1);
```

### 7. Token Refresh in Background Context Test

**Purpose**: Verify Spotify tokens refresh automatically during webhook processing

**Steps**:
1. Manually expire tokens in database:

```sql
-- Expire Spotify token for user 1
UPDATE auth_tokens
SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
WHERE user_id = 1 AND provider = 'spotify';
```

2. Trigger webhook event (see Test 5)
3. Trigger job processing (see Test 6)

**Expected Result**:
- Job should complete successfully
- Spotify token should be automatically refreshed
- No authentication errors

**Verification**:
```sql
-- Check token was refreshed
SELECT expires_at, updated_at
FROM auth_tokens
WHERE user_id = 1 AND provider = 'spotify';
-- expires_at should be in the future
-- updated_at should be recent
```

### 8. Job Retry Logic Test

**Purpose**: Verify failed jobs are retried with exponential backoff

**Steps**:
1. Create a job that will fail (e.g., invalid activity ID)

```sql
INSERT INTO processing_jobs
  (job_type, user_id, activity_id, status, scheduled_for)
VALUES
  ('process_activity', 1, 999999999, 'pending', CURRENT_TIMESTAMP);
```

2. Process the job:

```bash
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json"
```

**Expected Result**:
- Job should fail
- Status should change to 'retry'
- `attempts` should increment
- `scheduled_for` should be set to future time
- Error message should be logged

**Verification**:
```sql
SELECT id, status, attempts, error_message, scheduled_for
FROM processing_jobs
WHERE activity_id = 999999999;
```

### 9. Webhook Subscription Deletion Test

**Purpose**: Verify webhook subscription can be deleted

**Steps**:

```bash
# Get subscription ID first
curl http://localhost:3000/api/webhooks/subscribe

# Delete subscription (replace 123456 with actual ID)
curl -X DELETE "http://localhost:3000/api/webhooks/subscribe?id=123456"
```

**Expected Result**:
```json
{
  "success": true,
  "message": "Webhook subscription deleted successfully"
}
```

**Verification**:
- Check database subscription status is 'inactive'
- Verify Strava API shows no active subscriptions

### 10. Cron Endpoint Test

**Purpose**: Verify cron endpoint processes jobs on schedule

**Steps**:

```bash
# Test without auth (should fail if CRON_SECRET is set)
curl http://localhost:3000/api/cron/process-jobs

# Test with auth
curl http://localhost:3000/api/cron/process-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Result**:
```json
{
  "success": true,
  "processed": 1,
  "duration": 1234,
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### 11. End-to-End Integration Test

**Purpose**: Full workflow test from run upload to song mapping

**Steps**:

1. **Setup**: Enable webhook subscription via dashboard UI
2. **Upload Run**: Upload a real run to Strava (or use Strava API to create test activity)
3. **Wait**: Webhook should trigger automatically
4. **Verify Event**: Check `webhook_events` table
5. **Verify Job**: Check `processing_jobs` table
6. **Process**: Either wait for cron or manually trigger job processing
7. **Check Results**: View the run in the dashboard - songs should be mapped

**Expected Result**:
- Run appears in dashboard
- All songs during run time are mapped to GPS coordinates
- Map visualization shows songs at correct locations

### 12. UI Integration Test

**Purpose**: Verify dashboard webhook settings UI works correctly

**Steps**:

1. Navigate to `/dashboard`
2. Webhook settings section should be visible
3. Click "Enable Automatic Processing"
4. Verify subscription is created
5. Refresh page - should show "Active" status
6. Click "Delete" button
7. Verify subscription is removed

**Expected Result**:
- UI updates reflect backend state
- No errors in console
- User-friendly error messages for failures

## Load Testing

### Concurrent Webhook Events

**Purpose**: Verify system handles multiple simultaneous webhook events

```bash
# Send 10 concurrent webhook events
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/webhooks/strava \
    -H "Content-Type: application/json" \
    -d "{
      \"object_type\": \"activity\",
      \"object_id\": $((123456789 + i)),
      \"aspect_type\": \"create\",
      \"owner_id\": YOUR_ATHLETE_ID,
      \"subscription_id\": YOUR_SUBSCRIPTION_ID,
      \"event_time\": $(date +%s)
    }" &
done
wait
```

**Expected Result**:
- All events logged successfully
- All jobs created
- No race conditions or deadlocks

## Monitoring & Logging Tests

### Check Logs

```bash
# Monitor application logs during testing
tail -f logs/application.log

# Or check console output during `npm run dev`
```

**Look for**:
- Webhook event received logs
- Job processing logs
- Token refresh logs
- Error messages

### Database Monitoring

```sql
-- Monitor job queue in real-time
SELECT status, COUNT(*) as count
FROM processing_jobs
GROUP BY status;

-- Check recent webhook events
SELECT object_type, aspect_type, processed, created_at
FROM webhook_events
ORDER BY created_at DESC LIMIT 20;

-- Check job processing times
SELECT
  id,
  job_type,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM processing_jobs
WHERE status = 'completed'
ORDER BY completed_at DESC LIMIT 10;
```

## Cleanup After Testing

```sql
-- Clean up test data
DELETE FROM processing_jobs WHERE activity_id > 900000000;
DELETE FROM webhook_events WHERE object_id > 900000000;
DELETE FROM activities WHERE strava_activity_id > 900000000;
```

## Common Issues & Troubleshooting

### Issue: Webhook verification fails
- **Solution**: Verify `verify_token` in database matches the one sent to Strava
- **Check**: Database `webhook_subscriptions` table

### Issue: Jobs stay in pending status
- **Solution**: Manually trigger job processor or check cron setup
- **Command**: `curl -X POST http://localhost:3000/api/jobs/process`

### Issue: Token refresh fails
- **Solution**: Check refresh tokens are valid and not revoked
- **Verify**: Re-authenticate with Spotify/Strava

### Issue: Songs not mapped correctly
- **Solution**: Check Spotify history matches run timeframe
- **Debug**: Add logging to `songMapper.ts`

## Success Criteria

All tests pass when:

1. ✅ Database migrations apply successfully
2. ✅ Webhook subscription can be created and deleted
3. ✅ Verification challenge is handled correctly
4. ✅ Webhook events are logged and jobs created
5. ✅ Jobs process successfully with automatic token refresh
6. ✅ Failed jobs retry with exponential backoff
7. ✅ Cron endpoint processes jobs on schedule
8. ✅ Dashboard UI reflects webhook status correctly
9. ✅ End-to-end flow: run upload → webhook → processing → viewing works
10. ✅ System handles concurrent events without errors

## Next Steps After Testing

1. Deploy to production environment
2. Configure production webhook URL with Strava
3. Set up monitoring alerts for failed jobs
4. Configure automated cron job (Vercel Cron or similar)
5. Document for end users
