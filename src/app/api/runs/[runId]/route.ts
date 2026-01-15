import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActivityWithSongs } from '@/lib/db/activities';

/**
 * GET /api/runs/[runId]
 * Retrieves a single activity with all its associated songs from the database
 *
 * This endpoint fetches saved song-to-GPS mappings for route visualization.
 * It performs a single optimized database query using a LEFT JOIN to retrieve
 * both the activity details and all songs in one operation.
 *
 * @returns ActivityWithSongs object containing:
 *   - Activity metadata (name, distance, time, GPS coordinates)
 *   - Array of songs with their GPS locations and play times
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const startTime = Date.now();

  try {
    // Validate runId parameter
    const runId = parseInt(params.runId);
    if (isNaN(runId) || runId <= 0) {
      console.error('[GET /api/runs/[runId]] Invalid runId:', params.runId);
      return NextResponse.json(
        { error: 'Invalid run ID' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const cookieStore = cookies();
    const userIdCookie = cookieStore.get('user_id')?.value;

    if (!userIdCookie) {
      console.error('[GET /api/runs/[runId]] No user_id cookie found');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = parseInt(userIdCookie);
    console.log(`[GET /api/runs/${runId}] Fetching run for user ${userId}`);

    // Fetch activity with songs using optimized helper function
    const activityWithSongs = await getActivityWithSongs(runId, userId);

    if (!activityWithSongs) {
      console.log(`[GET /api/runs/${runId}] Run not found or access denied for user ${userId}`);
      return NextResponse.json(
        { error: 'Run not found or access denied' },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[GET /api/runs/${runId}] Successfully fetched run with ${activityWithSongs.songs.length} songs (${duration}ms)`
    );

    return NextResponse.json(activityWithSongs);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/runs/${params.runId}] Error after ${duration}ms:`, error);
    console.error('Error stack:', error.stack);

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch run',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
