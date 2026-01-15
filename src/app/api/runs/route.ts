import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserActivities, getUserActivityCount } from '@/lib/db/activities';

/**
 * GET /api/runs
 * Lists all activities for the authenticated user with pagination
 *
 * Query Parameters:
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 20, max: 100)
 *
 * @returns Array of activity summaries with song counts and pagination info
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get authenticated user
    const cookieStore = cookies();
    const userIdCookie = cookieStore.get('user_id')?.value;

    if (!userIdCookie) {
      console.error('[GET /api/runs] No user_id cookie found');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = parseInt(userIdCookie);
    console.log(`[GET /api/runs] Fetching runs for user ${userId}`);

    // Parse query parameters for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Fetch runs with song counts and total count in parallel
    const [runs, totalCount] = await Promise.all([
      getUserActivities(userId, limit, offset),
      getUserActivityCount(userId),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const duration = Date.now() - startTime;
    console.log(
      `[GET /api/runs] Fetched ${runs.length} runs for user ${userId} (page ${page}/${totalPages}, ${duration}ms)`
    );

    return NextResponse.json({
      runs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[GET /api/runs] Error after ${duration}ms:`, error);
    console.error('Error stack:', error.stack);

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch runs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
