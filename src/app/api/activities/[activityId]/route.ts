import { NextRequest, NextResponse } from 'next/server';
import { getActivity } from '@/lib/strava';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { activityId: string } }
) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('strava_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Strava' },
        { status: 401 }
      );
    }

    const activityId = parseInt(params.activityId);
    const activity = await getActivity(accessToken, activityId);

    return NextResponse.json({ activity });
  } catch (error: any) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
