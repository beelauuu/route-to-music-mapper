import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test/webhook-event
 * Test endpoint to simulate Strava webhook events
 *
 * IMPORTANT: Only use in development/testing environments
 * Remove or protect this endpoint in production
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoint disabled in production' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { activityId, athleteId, subscriptionId } = body;

    if (!activityId || !athleteId) {
      return NextResponse.json(
        { error: 'activityId and athleteId are required' },
        { status: 400 }
      );
    }

    // Create a mock webhook event
    const webhookEvent = {
      object_type: 'activity',
      object_id: activityId,
      aspect_type: 'create',
      owner_id: athleteId,
      subscription_id: subscriptionId || 12345,
      event_time: Math.floor(Date.now() / 1000),
    };

    // Forward to actual webhook endpoint
    const webhookResponse = await fetch(
      `${request.nextUrl.origin}/api/webhooks/strava`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookEvent),
      }
    );

    const webhookResult = await webhookResponse.json();

    return NextResponse.json({
      success: true,
      event: webhookEvent,
      webhookResponse: webhookResult,
      message: 'Test webhook event sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending test webhook event:', error);
    return NextResponse.json(
      {
        error: 'Failed to send test webhook event',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/webhook-event
 * Get test instructions
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoint disabled in production' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    endpoint: '/api/test/webhook-event',
    method: 'POST',
    description: 'Simulate a Strava webhook event for testing',
    example: {
      activityId: 123456789,
      athleteId: 987654,
      subscriptionId: 12345,
    },
    usage: `
curl -X POST http://localhost:3000/api/test/webhook-event \\
  -H "Content-Type: application/json" \\
  -d '{"activityId": 123456789, "athleteId": 987654}'
    `,
  });
}
