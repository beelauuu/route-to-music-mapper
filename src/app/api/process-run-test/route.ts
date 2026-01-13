import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActivity } from '@/lib/strava';
import { decodePolyline } from '@/utils/polyline';
import { mapSongsToRoute } from '@/utils/songMapper';
import { generateMockSongs } from '@/utils/mockData';
import { ProcessedRunData, SpotifyRecentlyPlayed } from '@/types';

/**
 * Test mode endpoint that doesn't require database
 * Uses mock Spotify data and returns results without storing
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const stravaAccessToken = cookieStore.get('strava_access_token')?.value;

    if (!stravaAccessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Strava' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }

    // Fetch Strava activity
    const stravaActivity = await getActivity(stravaAccessToken, activityId);

    // Check if activity has GPS data
    const polyline =
      stravaActivity.map.polyline || stravaActivity.map.summary_polyline;

    if (!polyline) {
      return NextResponse.json(
        { error: 'Activity does not have GPS data' },
        { status: 400 }
      );
    }

    // Decode polyline
    const coordinates = decodePolyline(polyline);

    if (coordinates.length === 0) {
      return NextResponse.json(
        { error: 'Failed to decode polyline' },
        { status: 500 }
      );
    }

    // Get run start and end times
    const runStartTime = new Date(stravaActivity.start_date);
    const runDuration = stravaActivity.elapsed_time; // in seconds

    // Generate mock Spotify songs for this run
    const mockSpotifySongs = generateMockSongs(runStartTime, runDuration);

    // Convert to SpotifyRecentlyPlayed format
    const spotifyItems: SpotifyRecentlyPlayed[] = mockSpotifySongs.map(
      (song) => ({
        track: song.track,
        played_at: song.played_at,
      })
    );

    // Map songs to route
    const mappedSongs = mapSongsToRoute({
      songs: spotifyItems,
      runStartTime,
      runDuration,
      coordinates,
      splits: stravaActivity.splits_metric,
    });

    const processedData: ProcessedRunData = {
      activity: {
        id: stravaActivity.id,
        user_id: 0, // Test mode - no user
        strava_activity_id: stravaActivity.id,
        name: stravaActivity.name,
        start_date: new Date(stravaActivity.start_date),
        elapsed_time: stravaActivity.elapsed_time,
        distance: stravaActivity.distance,
        polyline,
        coordinates,
        splits_metric: stravaActivity.splits_metric,
        created_at: new Date(),
        updated_at: new Date(),
      },
      songs: mappedSongs,
      stats: {
        total_songs: mockSpotifySongs.length,
        songs_during_run: mappedSongs.length,
      },
    };

    // Store in localStorage on client side instead of database
    return NextResponse.json({
      ...processedData,
      testMode: true,
      message: 'Test mode - data not saved to database'
    });
  } catch (error: any) {
    console.error('Error processing run (test mode):', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process run' },
      { status: 500 }
    );
  }
}
