# Automatic Song Mapping with Strava Webhooks

## What is this?

With webhook integration enabled, your runs are **automatically processed** as soon as you upload them from your watch to Strava. No more clicking "Map Music" for each run - it's all done in the background!

## How it works

### Traditional Flow (Manual)
1. Upload run from watch to Strava ⌚
2. Open Route to Music Mapper 🌐
3. Go to dashboard 📊
4. Find your run and click "Map Music" 🖱️
5. Wait for processing ⏳
6. View your mapped run 🗺️

### New Flow (Automatic with Webhooks)
1. Upload run from watch to Strava ⌚
2. **Automatic background processing happens** ✨
3. Open Route to Music Mapper anytime 🌐
4. **Your run is already ready to view!** 🎉

## Features

### ✨ Automatic Processing
- Runs are processed within minutes of upload
- No manual intervention needed
- Pre-processed and ready when you view them

### 🔄 Smart Token Management
- Your Spotify tokens are automatically refreshed in the background
- No re-authentication needed unless you revoke access
- Seamless integration without user interaction

### 🔁 Reliable with Retries
- Failed processing jobs are automatically retried
- Exponential backoff prevents spam
- Error logging for troubleshooting

### 📊 Queue System
- Multiple runs can be processed concurrently
- Priority-based processing
- Efficient resource usage

## Enabling Automatic Processing

### Method 1: Dashboard UI (Recommended)

1. Log in to your account
2. Navigate to the Dashboard
3. Find the "Webhook Settings" section
4. Click "Enable Automatic Processing"
5. Wait for confirmation
6. That's it! Future runs will be processed automatically

### Method 2: Manual Setup

If you're comfortable with APIs, you can create a subscription manually:

```bash
curl -X POST https://your-domain.com/api/webhooks/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://your-domain.com/api/webhooks/strava"
  }'
```

## What happens when you upload a run?

### Step 1: Run Upload
You finish your run and your watch syncs to Strava automatically.

### Step 2: Webhook Notification
Strava sends a notification to our servers: "New run uploaded!"

### Step 3: Background Processing
Our system:
- Fetches your run details (GPS route, distance, time, etc.)
- Fetches your Spotify listening history around that time
- Maps each song to where you were on your route
- Stores everything in the database

### Step 4: Ready to View
Next time you open the app, your run is already processed and ready to view!

**Timeline**: Usually 1-3 minutes from upload to completion.

## FAQ

### Q: Do I need to do anything after enabling webhooks?
**A:** Nope! Just upload runs from your watch as usual. Everything else is automatic.

### Q: What if I uploaded a run before enabling webhooks?
**A:** No problem! You can still manually process old runs using the "Map Music" button.

### Q: Can I disable automatic processing?
**A:** Yes! In the Webhook Settings section, click "Delete" to remove the subscription. You can always re-enable it later.

### Q: What if my Spotify token expires?
**A:** The system automatically refreshes your Spotify token in the background. You only need to re-authenticate if you manually revoke access to the app.

### Q: How many runs can be processed at once?
**A:** The system uses a queue with priority processing. Multiple runs can be processed concurrently without issues.

### Q: What if processing fails?
**A:** The system automatically retries failed jobs with exponential backoff:
- First retry: after 2 minutes
- Second retry: after 4 minutes
- Third retry: after 8 minutes
- After 3 failed attempts, the job is marked as failed and you can manually retry

### Q: Does this use more resources?
**A:** Minimal impact. The webhook endpoint responds quickly (< 2 seconds) and processing happens in the background asynchronously.

### Q: Is this secure?
**A:** Yes!
- Webhook events are verified and logged
- Your tokens are stored securely in the database
- Token refresh happens server-side without exposing credentials
- HTTPS is required for all webhook communications

### Q: Will manual processing still work?
**A:** Absolutely! The "Map Music" button still works for:
- Old runs uploaded before webhook was enabled
- Runs that failed automatic processing
- Re-processing existing runs with updated data

## Technical Details

### For Developers

**Architecture:**
- Next.js API routes for webhook endpoints
- PostgreSQL database for job queue
- Background job processor with retry logic
- Automatic token refresh using refresh tokens

**Key Components:**
- `POST /api/webhooks/strava` - Webhook event receiver
- `GET /api/webhooks/strava` - Subscription verification
- `POST /api/jobs/process` - Job processor endpoint
- `GET /api/cron/process-jobs` - Automated cron endpoint

**Database Tables:**
- `webhook_subscriptions` - Active webhook subscriptions
- `webhook_events` - Event log for auditing
- `processing_jobs` - Job queue with status tracking

**Token Management:**
- Stored in `auth_tokens` table
- Automatic refresh when expired (5-minute buffer)
- Background refresh doesn't require user interaction
- Leverages Spotify's refresh token mechanism

### Performance

- **Webhook response time**: < 2 seconds (Strava requirement)
- **Processing time**: 10-30 seconds per run (depends on song count)
- **Queue throughput**: 10-20 jobs per minute
- **Storage**: ~1KB per event, ~5KB per job

## Monitoring Your Processing

### Check Subscription Status

In the dashboard Webhook Settings section, you'll see:
- ✓ Active - Webhooks are enabled
- ○ Inactive - Webhooks are not enabled

### Processing Queue

You can view job statistics at:
```
GET /api/jobs/process
```

Returns:
```json
{
  "total": 42,
  "by_status": [
    {"status": "pending", "count": 3},
    {"status": "processing", "count": 1},
    {"status": "completed", "count": 38},
    {"status": "failed", "count": 0}
  ]
}
```

## Troubleshooting

### Run not processed automatically

**Check 1:** Verify webhook is enabled in Webhook Settings

**Check 2:** Check if the run was uploaded recently (processing takes 1-3 minutes)

**Check 3:** Try manual processing with "Map Music" button

**Check 4:** Contact support if persistent issues

### "No songs found" after processing

**Possible reasons:**
- You weren't listening to Spotify during the run
- Spotify wasn't connected to the internet to log playback
- The run was very short (< 1 song duration)

**Solution:** Ensure Spotify is connected and playing during your runs

### Songs mapped to wrong locations

**Possible reasons:**
- Phone time was incorrect
- Spotify history has timestamp issues
- GPS data quality was poor

**Solution:** Re-process the run manually, which may yield better results

## Support

For issues or questions:
1. Check the [Webhook Setup Guide](WEBHOOK_SETUP.md) for technical details
2. Review [Test Plan](tests/webhook-integration-test.md) for common scenarios
3. Open an issue on GitHub with:
   - Description of the problem
   - Activity ID (if applicable)
   - Whether manual processing works
   - Any error messages

## Future Enhancements

Potential improvements for future versions:
- Real-time processing notifications
- Email alerts when processing completes
- Batch processing for multiple runs
- Custom retry policies
- Webhook event filtering (process only certain activity types)
- Integration with other fitness platforms

## Credits

Built with:
- [Strava Webhook Events API](https://developers.strava.com/docs/webhooks/)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- Next.js, PostgreSQL, and TypeScript

Enjoy your automatically mapped runs! 🎵🏃‍♂️🗺️
