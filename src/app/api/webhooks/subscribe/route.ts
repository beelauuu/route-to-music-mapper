import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import {
  createWebhookSubscription,
  listWebhookSubscriptions,
  deleteWebhookSubscription
} from '@/lib/strava';
import crypto from 'crypto';

/**
 * GET /api/webhooks/subscribe
 * List all active webhook subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const pool = getPool();

    // Get subscriptions from Strava
    const stravaSubscriptions = await listWebhookSubscriptions();

    // Get subscription details from our database
    const result = await pool.query(
      'SELECT * FROM webhook_subscriptions ORDER BY created_at DESC'
    );

    return NextResponse.json({
      strava: stravaSubscriptions,
      database: result.rows,
    });
  } catch (error) {
    console.error('Error fetching webhook subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/subscribe
 * Create a new webhook subscription with Strava
 */
export async function POST(request: NextRequest) {
  try {
    const pool = getPool();
    const body = await request.json();
    const { callbackUrl } = body;

    if (!callbackUrl) {
      return NextResponse.json(
        { error: 'callbackUrl is required' },
        { status: 400 }
      );
    }

    // Generate a random verify token for this subscription
    const verifyToken = crypto.randomBytes(32).toString('hex');

    // Check if we already have an active subscription
    const existingSubscriptions = await listWebhookSubscriptions();
    if (existingSubscriptions.length > 0) {
      return NextResponse.json(
        {
          error: 'A webhook subscription already exists. Delete it first before creating a new one.',
          existing: existingSubscriptions,
        },
        { status: 409 }
      );
    }

    // Create subscription with Strava
    const subscription = await createWebhookSubscription(callbackUrl, verifyToken);

    // Store in our database
    await pool.query(
      `INSERT INTO webhook_subscriptions
        (subscription_id, callback_url, verify_token, subscription_status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (subscription_id)
       DO UPDATE SET
         callback_url = $2,
         verify_token = $3,
         subscription_status = $4,
         updated_at = CURRENT_TIMESTAMP`,
      [subscription.id, callbackUrl, verifyToken, 'active']
    );

    return NextResponse.json({
      success: true,
      subscription,
      message: 'Webhook subscription created successfully',
    });
  } catch (error: any) {
    console.error('Error creating webhook subscription:', error);

    // Handle specific Strava API errors
    if (error.response?.data) {
      return NextResponse.json(
        {
          error: 'Failed to create subscription with Strava',
          details: error.response.data,
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create webhook subscription' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/subscribe
 * Delete webhook subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('id');

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Delete from Strava
    await deleteWebhookSubscription(parseInt(subscriptionId, 10));

    // Update status in our database
    await pool.query(
      `UPDATE webhook_subscriptions
       SET subscription_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE subscription_id = $2`,
      ['inactive', parseInt(subscriptionId, 10)]
    );

    return NextResponse.json({
      success: true,
      message: 'Webhook subscription deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting webhook subscription:', error);

    if (error.response?.data) {
      return NextResponse.json(
        {
          error: 'Failed to delete subscription from Strava',
          details: error.response.data,
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete webhook subscription' },
      { status: 500 }
    );
  }
}
