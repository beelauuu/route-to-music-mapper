import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActivity } from '@/lib/strava';
import { getRecentlyPlayed } from '@/lib/spotify';
import { decodePolyline } from '@/utils/polyline';
import { mapSongsToRoute } from '@/utils/songMapper';
import { query } from '@/lib/db';
import { ProcessedRunData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const stravaAccessToken = cookieStore.get('strava_access_token')?.value;
    const spotifyAccessToken = cookieStore.get('spotify_access_token')?.value;

    if (!stravaAccessToken || !spotifyAccessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with both Strava and Spotify' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { activityId, userId } = body;

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

    // Calculate the time window for Spotify query
    // Fetch songs a bit before and after the run to ensure we don't miss any
    const beforeTimestamp = runStartTime.getTime() - 30 * 60 * 1000; // 30 min before
    const afterTimestamp = runStartTime.getTime();

    // Fetch recently played songs from Spotify
    const spotifyData = await getRecentlyPlayed(
      spotifyAccessToken,
      50,
      undefined,
      Math.floor(afterTimestamp / 1000)
    );

    // Map songs to route
    const mappedSongs = mapSongsToRoute({
      songs: spotifyData.items,
      runStartTime,
      runDuration,
      coordinates,
      splits: stravaActivity.splits_metric,
    });

    // Store in database
    // First, check if activity already exists
    const existingActivity = await query(
      'SELECT id FROM activities WHERE strava_activity_id = $1',
      [stravaActivity.id]
    );

    let activityDbId: number;

    if (existingActivity.rows.length > 0) {
      activityDbId = existingActivity.rows[0].id;

      // Update existing activity
      await query(
        `UPDATE activities
         SET name = $1, start_date = $2, elapsed_time = $3, distance = $4,
             polyline = $5, coordinates = $6, splits_metric = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [
          stravaActivity.name,
          stravaActivity.start_date,
          stravaActivity.elapsed_time,
          stravaActivity.distance,
          polyline,
          JSON.stringify(coordinates),
          JSON.stringify(stravaActivity.splits_metric),
          activityDbId,
        ]
      );

      // Delete existing songs
      await query('DELETE FROM activity_songs WHERE activity_id = $1', [
        activityDbId,
      ]);
    } else {
      // Insert new activity
      const result = await query(
        `INSERT INTO activities
         (user_id, strava_activity_id, name, start_date, elapsed_time, distance, polyline, coordinates, splits_metric)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          userId || 1, // Default to user 1 for now
          stravaActivity.id,
          stravaActivity.name,
          stravaActivity.start_date,
          stravaActivity.elapsed_time,
          stravaActivity.distance,
          polyline,
          JSON.stringify(coordinates),
          JSON.stringify(stravaActivity.splits_metric),
        ]
      );

      activityDbId = result.rows[0].id;
    }

    // Insert songs
    for (const song of mappedSongs) {
      const albumArtUrl = song.track.album.images[0]?.url || '';
      const artistName = song.track.artists.map((a) => a.name).join(', ');

      await query(
        `INSERT INTO activity_songs
         (activity_id, spotify_track_id, track_name, artist_name, album_name,
          album_art_url, spotify_url, played_at, percentage_complete, latitude, longitude, coordinate_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          activityDbId,
          song.track.id,
          song.track.name,
          artistName,
          song.track.album.name,
          albumArtUrl,
          song.track.external_urls.spotify,
          song.played_at,
          song.percentage_complete,
          song.coordinate?.lat,
          song.coordinate?.lng,
          song.coordinate_index,
        ]
      );
    }

    const processedData: ProcessedRunData = {
      activity: {
        id: activityDbId,
        user_id: userId || 1,
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
        total_songs: spotifyData.items.length,
        songs_during_run: mappedSongs.length,
      },
    };

    return NextResponse.json(processedData);
  } catch (error: any) {
    console.error('Error processing run:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process run' },
      { status: 500 }
    );
  }
}
