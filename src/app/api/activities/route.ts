import { NextRequest, NextResponse } from 'next/server';
import { getActivities } from '@/lib/strava';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('strava_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Strava' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '30');

    const activities = await getActivities(accessToken, page, perPage);

    // Filter only running activities
    const runningActivities = activities.filter((activity) =>
      activity.type.toLowerCase().includes('run')
    );

    return NextResponse.json({ activities: runningActivities });
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
