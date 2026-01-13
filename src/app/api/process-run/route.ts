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
    const userIdCookie = cookieStore.get('user_id')?.value;

    if (!stravaAccessToken || !spotifyAccessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with both Strava and Spotify' },
        { status: 401 }
      );
    }

    if (!userIdCookie) {
      return NextResponse.json(
        { error: 'User not found. Please re-authenticate.' },
        { status: 401 }
      );
    }

    const userId = parseInt(userIdCookie);

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
    const runEndTime = new Date(runStartTime.getTime() + runDuration * 1000);

    // Debug logging
    console.log('=== RUN DEBUG INFO ===');
    console.log('Activity ID:', stravaActivity.id);
    console.log('Activity Name:', stravaActivity.name);
    console.log('Run Start Time:', runStartTime.toISOString());
    console.log('Run End Time:', runEndTime.toISOString());
    console.log('Run Duration (seconds):', runDuration);
    console.log('Run Duration (minutes):', (runDuration / 60).toFixed(2));

    // Calculate the time window for Spotify query
    // Fetch songs starting from 30 min before the run to catch any that might have started just before
    const afterTimestamp = runStartTime.getTime() - 30 * 60 * 1000; // 30 min before run start

    console.log('Fetching Spotify songs after:', new Date(afterTimestamp).toISOString());
    console.log('Spotify API timestamp (after):', Math.floor(afterTimestamp));

    // Fetch recently played songs from Spotify
    // Note: Using 'after' to get songs played AFTER this timestamp (not 'before')
    let spotifyData;
    try {
      spotifyData = await getRecentlyPlayed(
        spotifyAccessToken,
        50,
        Math.floor(afterTimestamp), // Pass as 'after' parameter
        undefined // Don't use 'before' - just get recent songs
      );
      console.log('✓ Successfully fetched from Spotify API');
    } catch (spotifyError: any) {
      console.error('❌ Spotify API Error:', spotifyError.response?.status, spotifyError.response?.data || spotifyError.message);
      throw new Error(`Failed to fetch Spotify data: ${spotifyError.message}`);
    }

    console.log('Total songs fetched from Spotify:', spotifyData.items.length);

    if (spotifyData.items.length > 0) {
      const firstSong = spotifyData.items[0];
      const lastSong = spotifyData.items[spotifyData.items.length - 1];
      console.log('First song played at:', new Date(firstSong.played_at).toISOString(), '-', firstSong.track.name);
      console.log('Last song played at:', new Date(lastSong.played_at).toISOString(), '-', lastSong.track.name);
    } else {
      console.log('WARNING: No songs returned from Spotify API');
    }

    // Map songs to route
    const mappedSongs = mapSongsToRoute({
      songs: spotifyData.items,
      runStartTime,
      runDuration,
      coordinates,
      splits: stravaActivity.splits_metric,
    });

    console.log('Songs mapped to route:', mappedSongs.length);
    console.log('Songs filtered out:', spotifyData.items.length - mappedSongs.length);

    if (mappedSongs.length === 0 && spotifyData.items.length > 0) {
      console.log('=== NO SONGS MAPPED - DEBUG INFO ===');
      console.log('Run time window:');
      console.log('  Start:', runStartTime.toISOString(), '(' + runStartTime.getTime() + ')');
      console.log('  End:  ', runEndTime.toISOString(), '(' + runEndTime.getTime() + ')');
      console.log('\nAll Spotify songs and their timestamps:');
      spotifyData.items.forEach((song, idx) => {
        const songTime = new Date(song.played_at);
        const songMs = songTime.getTime();
        const isInRange = songMs >= runStartTime.getTime() && songMs <= runEndTime.getTime();
        console.log(`  ${idx + 1}. ${song.track.name}`);
        console.log(`     Played at: ${songTime.toISOString()} (${songMs})`);
        console.log(`     In range: ${isInRange}`);
        console.log(`     Seconds ${isInRange ? 'after' : (songMs < runStartTime.getTime() ? 'before' : 'after')} run ${isInRange ? 'start' : (songMs < runStartTime.getTime() ? 'start' : 'end')}: ${Math.abs((songMs - (isInRange || songMs < runStartTime.getTime() ? runStartTime.getTime() : runEndTime.getTime())) / 1000).toFixed(0)}s`);
      });
    }

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
          userId, // Default to user 1 for now
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
        user_id: userId,
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
