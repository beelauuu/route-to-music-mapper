import { NextRequest, NextResponse } from 'next/server';
import { getRecentlyPlayed } from '@/lib/spotify';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Spotify' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const after = searchParams.get('after')
      ? parseInt(searchParams.get('after')!)
      : undefined;
    const before = searchParams.get('before')
      ? parseInt(searchParams.get('before')!)
      : undefined;

    const recentlyPlayed = await getRecentlyPlayed(
      accessToken,
      limit,
      after,
      before
    );

    return NextResponse.json(recentlyPlayed);
  } catch (error: any) {
    console.error('Error fetching recently played tracks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recently played tracks' },
      { status: 500 }
    );
  }
}
