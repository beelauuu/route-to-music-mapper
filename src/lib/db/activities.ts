import { query } from '@/lib/db';
import { Activity, ActivitySong, ActivityWithSongs } from '@/types';

/**
 * Fetches a single activity with all its associated songs from the database
 * @param activityId - The database ID of the activity
 * @param userId - The ID of the user (for access control)
 * @returns ActivityWithSongs object or null if not found
 */
export async function getActivityWithSongs(
  activityId: number,
  userId: number
): Promise<ActivityWithSongs | null> {
  const result = await query(
    `SELECT
      a.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', s.id,
            'activity_id', s.activity_id,
            'spotify_track_id', s.spotify_track_id,
            'track_name', s.track_name,
            'artist_name', s.artist_name,
            'album_name', s.album_name,
            'album_art_url', s.album_art_url,
            'spotify_url', s.spotify_url,
            'played_at', s.played_at,
            'percentage_complete', s.percentage_complete,
            'latitude', s.latitude,
            'longitude', s.longitude,
            'coordinate_index', s.coordinate_index,
            'created_at', s.created_at
          ) ORDER BY s.played_at ASC
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
      ) as songs
     FROM activities a
     LEFT JOIN activity_songs s ON a.id = s.activity_id
     WHERE a.id = $1 AND a.user_id = $2
     GROUP BY a.id`,
    [activityId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Parse JSON fields
  const activity: Activity = {
    id: row.id,
    user_id: row.user_id,
    strava_activity_id: row.strava_activity_id,
    name: row.name,
    start_date: row.start_date,
    elapsed_time: row.elapsed_time,
    distance: row.distance,
    polyline: row.polyline,
    coordinates: typeof row.coordinates === 'string'
      ? JSON.parse(row.coordinates)
      : row.coordinates,
    splits_metric: typeof row.splits_metric === 'string'
      ? JSON.parse(row.splits_metric)
      : row.splits_metric,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  const songs: ActivitySong[] = typeof row.songs === 'string'
    ? JSON.parse(row.songs)
    : row.songs;

  return {
    ...activity,
    songs: songs || [],
  };
}

/**
 * Fetches songs for a specific activity
 * @param activityId - The database ID of the activity
 * @returns Array of ActivitySong objects
 */
export async function getActivitySongs(
  activityId: number
): Promise<ActivitySong[]> {
  const result = await query<ActivitySong>(
    `SELECT * FROM activity_songs
     WHERE activity_id = $1
     ORDER BY played_at ASC`,
    [activityId]
  );

  return result.rows;
}

/**
 * Fetches all activities for a user with song counts
 * @param userId - The ID of the user
 * @param limit - Maximum number of activities to fetch
 * @param offset - Number of activities to skip (for pagination)
 * @returns Array of activity summaries with song counts
 */
export async function getUserActivities(
  userId: number,
  limit: number = 20,
  offset: number = 0
) {
  const result = await query(
    `SELECT
      a.id,
      a.strava_activity_id,
      a.name,
      a.start_date,
      a.elapsed_time,
      a.distance,
      COUNT(s.id)::int as song_count,
      a.created_at,
      a.updated_at
     FROM activities a
     LEFT JOIN activity_songs s ON a.id = s.activity_id
     WHERE a.user_id = $1
     GROUP BY a.id
     ORDER BY a.start_date DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows;
}

/**
 * Gets the total count of activities for a user
 * @param userId - The ID of the user
 * @returns Total number of activities
 */
export async function getUserActivityCount(userId: number): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM activities WHERE user_id = $1',
    [userId]
  );

  return parseInt(result.rows[0]?.count || '0');
}

/**
 * Checks if an activity exists by Strava activity ID
 * @param stravaActivityId - The Strava activity ID
 * @returns The database activity ID if it exists, null otherwise
 */
export async function findActivityByStravaId(
  stravaActivityId: number
): Promise<number | null> {
  const result = await query<{ id: number }>(
    'SELECT id FROM activities WHERE strava_activity_id = $1',
    [stravaActivityId]
  );

  return result.rows.length > 0 ? result.rows[0].id : null;
}

/**
 * Saves or updates an activity with its songs
 * @param activity - Activity data from Strava
 * @param songs - Mapped songs with GPS coordinates
 * @param userId - The ID of the user
 * @returns The database ID of the activity
 */
export async function saveActivityWithSongs(
  activity: {
    strava_activity_id: number;
    name: string;
    start_date: string;
    elapsed_time: number;
    distance: number;
    polyline: string;
    coordinates: any[];
    splits_metric?: any[];
  },
  songs: Array<{
    track: {
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album: {
        name: string;
        images: Array<{ url: string }>;
      };
      external_urls: { spotify: string };
    };
    played_at: string;
    percentage_complete: number;
    coordinate?: { lat: number; lng: number };
    coordinate_index?: number;
  }>,
  userId: number
): Promise<number> {
  // Check if activity already exists
  const existingId = await findActivityByStravaId(activity.strava_activity_id);

  let activityDbId: number;

  if (existingId) {
    // Update existing activity
    await query(
      `UPDATE activities
       SET name = $1, start_date = $2, elapsed_time = $3, distance = $4,
           polyline = $5, coordinates = $6, splits_metric = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [
        activity.name,
        activity.start_date,
        activity.elapsed_time,
        activity.distance,
        activity.polyline,
        JSON.stringify(activity.coordinates),
        JSON.stringify(activity.splits_metric),
        existingId,
      ]
    );

    // Delete existing songs
    await query('DELETE FROM activity_songs WHERE activity_id = $1', [existingId]);
    activityDbId = existingId;
  } else {
    // Insert new activity
    const result = await query(
      `INSERT INTO activities
       (user_id, strava_activity_id, name, start_date, elapsed_time, distance, polyline, coordinates, splits_metric)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId,
        activity.strava_activity_id,
        activity.name,
        activity.start_date,
        activity.elapsed_time,
        activity.distance,
        activity.polyline,
        JSON.stringify(activity.coordinates),
        JSON.stringify(activity.splits_metric),
      ]
    );

    activityDbId = result.rows[0].id;
  }

  // Insert songs
  for (const song of songs) {
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

  return activityDbId;
}
