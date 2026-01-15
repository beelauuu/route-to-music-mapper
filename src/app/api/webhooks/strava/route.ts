import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /api/webhooks/strava
 * Handle Strava webhook subscription verification
 *
 * When creating a subscription, Strava sends a GET request with a challenge
 * We must respond with the challenge in JSON format: { "hub.challenge": "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode !== 'subscribe') {
      return NextResponse.json(
        { error: 'Invalid mode' },
        { status: 400 }
      );
    }

    if (!challenge) {
      return NextResponse.json(
        { error: 'Missing challenge' },
        { status: 400 }
      );
    }

    // Verify the token matches our stored verify_token
    const pool = getPool();
    const result = await pool.query(
      'SELECT verify_token FROM webhook_subscriptions WHERE subscription_status = $1 LIMIT 1',
      ['active']
    );

    if (result.rows.length === 0) {
      console.error('No active webhook subscription found in database');
      // Still accept the challenge to complete subscription creation
    } else if (token !== result.rows[0].verify_token) {
      console.error('Verify token mismatch:', {
        received: token,
        expected: result.rows[0].verify_token,
      });
      return NextResponse.json(
        { error: 'Invalid verify token' },
        { status: 403 }
      );
    }

    // Respond with the challenge
    return NextResponse.json({ 'hub.challenge': challenge });
  } catch (error) {
    console.error('Error handling webhook verification:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/strava
 * Handle Strava webhook event notifications
 *
 * Strava sends events when activities are created, updated, or deleted
 * We need to respond quickly (< 2 seconds) and process async
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const pool = getPool();
    const body = await request.json();

    console.log('Received webhook event:', JSON.stringify(body, null, 2));

    // Strava webhook event structure:
    // {
    //   "object_type": "activity",
    //   "object_id": 123456789,
    //   "aspect_type": "create|update|delete",
    //   "owner_id": 987654,
    //   "subscription_id": 12345,
    //   "event_time": 1516126040
    // }

    const {
      object_type,
      object_id,
      aspect_type,
      owner_id,
      subscription_id,
      event_time,
    } = body;

    // Validate required fields
    if (!object_type || !object_id || !aspect_type || !owner_id) {
      console.error('Missing required fields in webhook event:', body);
      return NextResponse.json(
        { error: 'Invalid event data' },
        { status: 400 }
      );
    }

    // Log the event to our database
    const eventResult = await pool.query(
      `INSERT INTO webhook_events
        (subscription_id, object_type, object_id, aspect_type, owner_id, event_time, raw_payload, processed)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7, false)
       RETURNING id`,
      [
        subscription_id,
        object_type,
        object_id,
        aspect_type,
        owner_id,
        event_time,
        JSON.stringify(body),
      ]
    );

    const webhookEventId = eventResult.rows[0].id;

    // Only process activity creation events
    if (object_type === 'activity' && aspect_type === 'create') {
      // Find the user associated with this Strava athlete
      const userResult = await pool.query(
        'SELECT id FROM users WHERE strava_athlete_id = $1',
        [owner_id]
      );

      if (userResult.rows.length === 0) {
        console.warn(`No user found for Strava athlete ID: ${owner_id}`);
        // Still return success - event is logged
        return NextResponse.json({ success: true });
      }

      const userId = userResult.rows[0].id;

      // Create a background processing job
      await pool.query(
        `INSERT INTO processing_jobs
          (job_type, user_id, activity_id, webhook_event_id, status, priority, scheduled_for)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        ['process_activity', userId, object_id, webhookEventId, 'pending', 10]
      );

      console.log(`Created processing job for activity ${object_id}, user ${userId}`);
    } else if (object_type === 'activity' && aspect_type === 'delete') {
      // Handle activity deletion - remove from our database
      await pool.query(
        'DELETE FROM activities WHERE strava_activity_id = $1',
        [object_id]
      );
      console.log(`Deleted activity ${object_id} from database`);
    }

    // Mark webhook event as processed
    await pool.query(
      'UPDATE webhook_events SET processed = true, processed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [webhookEventId]
    );

    const processingTime = Date.now() - startTime;
    console.log(`Webhook processed in ${processingTime}ms`);

    // Return success quickly (Strava requires < 2 seconds)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);

    const processingTime = Date.now() - startTime;
    console.error(`Webhook failed after ${processingTime}ms`);

    // Still return 200 to prevent Strava from retrying
    // We log the error in our database
    return NextResponse.json({ success: false, error: 'Internal error' });
  }
}
