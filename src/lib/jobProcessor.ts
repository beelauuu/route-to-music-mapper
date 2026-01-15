import { getPool, query } from './db';
import { getValidTokens } from './tokenManager';
import { getActivity } from './strava';
import { getRecentlyPlayed } from './spotify';
import { decodePolyline } from '@/utils/polyline';
import { mapSongsToRoute } from '@/utils/songMapper';

/**
 * Process a single job from the queue
 * @param jobId - Job ID to process
 */
export async function processJob(jobId: number): Promise<void> {
  const pool = getPool();

  try {
    // Lock the job for processing
    const lockResult = await pool.query(
      `UPDATE processing_jobs
       SET status = $1, started_at = CURRENT_TIMESTAMP, attempts = attempts + 1
       WHERE id = $2 AND status IN ($3, $4)
       RETURNING *`,
      ['processing', jobId, 'pending', 'retry']
    );

    if (lockResult.rows.length === 0) {
      console.log(`Job ${jobId} already being processed or completed`);
      return;
    }

    const job = lockResult.rows[0];
    console.log(`Processing job ${jobId}:`, job.job_type);

    // Process based on job type
    if (job.job_type === 'process_activity') {
      await processActivityJob(job);
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark job as completed
    await pool.query(
      `UPDATE processing_jobs
       SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ['completed', jobId]
    );

    console.log(`Job ${jobId} completed successfully`);
  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);

    // Get current job state
    const jobResult = await pool.query(
      'SELECT attempts, max_retries FROM processing_jobs WHERE id = $1',
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return;
    }

    const job = jobResult.rows[0];
    const shouldRetry = job.attempts < job.max_retries;

    if (shouldRetry) {
      // Schedule for retry with exponential backoff
      const retryDelayMinutes = Math.pow(2, job.attempts); // 2, 4, 8 minutes
      await pool.query(
        `UPDATE processing_jobs
         SET status = $1, error_message = $2,
             scheduled_for = CURRENT_TIMESTAMP + INTERVAL '${retryDelayMinutes} minutes',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['retry', error.message, jobId]
      );
      console.log(`Job ${jobId} scheduled for retry in ${retryDelayMinutes} minutes`);
    } else {
      // Max retries reached, mark as failed
      await pool.query(
        `UPDATE processing_jobs
         SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['failed', error.message, jobId]
      );
      console.log(`Job ${jobId} failed after ${job.attempts} attempts`);
    }
  }
}

/**
 * Process an activity job - fetch activity and map songs
 */
async function processActivityJob(job: any): Promise<void> {
  const pool = getPool();
  const { user_id, activity_id } = job;

  console.log(`Processing activity ${activity_id} for user ${user_id}`);

  // Get valid tokens for both Spotify and Strava
  const tokens = await getValidTokens(user_id);

  // Fetch activity details from Strava
  const activity = await getActivity(tokens.strava, activity_id);

  // Only process running activities with polyline data
  if (activity.type !== 'Run' && activity.type !== 'VirtualRun') {
    console.log(`Activity ${activity_id} is not a run, skipping`);
    return;
  }

  if (!activity.map?.polyline && !activity.map?.summary_polyline) {
    console.log(`Activity ${activity_id} has no polyline data, skipping`);
    return;
  }

  const polyline = activity.map.polyline || activity.map.summary_polyline;

  // Decode polyline to coordinates
  const coordinates = decodePolyline(polyline);

  if (coordinates.length === 0) {
    throw new Error('Failed to decode polyline');
  }

  // Calculate time window for Spotify songs
  // Fetch songs from 30 minutes before run start to run end
  const startDate = new Date(activity.start_date);
  const beforeStartDate = new Date(startDate.getTime() - 30 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + activity.elapsed_time * 1000);

  // Fetch recently played songs from Spotify
  const songsResponse = await getRecentlyPlayed(
    tokens.spotify,
    50,
    beforeStartDate.getTime()
  );

  console.log(`Found ${songsResponse.items.length} songs played around activity time`);

  // Map songs to route
  const mappedSongs = mapSongsToRoute({
    songs: songsResponse.items,
    runStartTime: startDate,
    runDuration: activity.elapsed_time,
    coordinates,
    splits: activity.splits_metric || [],
  });

  console.log(`Mapped ${mappedSongs.length} songs to route`);

  // Store activity in database
  const activityResult = await pool.query(
    `INSERT INTO activities
      (user_id, strava_activity_id, name, start_date, elapsed_time, distance, polyline, coordinates, splits_metric)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (strava_activity_id)
     DO UPDATE SET
       name = $3,
       start_date = $4,
       elapsed_time = $5,
       distance = $6,
       polyline = $7,
       coordinates = $8,
       splits_metric = $9,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      user_id,
      activity_id,
      activity.name,
      startDate,
      activity.elapsed_time,
      activity.distance,
      polyline,
      JSON.stringify(coordinates),
      JSON.stringify(activity.splits_metric || []),
    ]
  );

  const dbActivityId = activityResult.rows[0].id;

  // Store mapped songs
  for (const song of mappedSongs) {
    const artistNames = song.track.artists.map((a) => a.name).join(', ');
    const albumArt = song.track.album.images[0]?.url || '';

    await pool.query(
      `INSERT INTO activity_songs
        (activity_id, spotify_track_id, track_name, artist_name, album_name,
         album_art_url, spotify_url, played_at, percentage_complete,
         latitude, longitude, coordinate_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (activity_id, spotify_track_id, played_at)
       DO UPDATE SET
         track_name = $3,
         artist_name = $4,
         album_name = $5,
         album_art_url = $6,
         spotify_url = $7,
         percentage_complete = $9,
         latitude = $10,
         longitude = $11,
         coordinate_index = $12`,
      [
        dbActivityId,
        song.track.id,
        song.track.name,
        artistNames,
        song.track.album.name,
        albumArt,
        song.track.external_urls.spotify,
        song.played_at,
        song.percentage_complete,
        song.coordinate?.lat || null,
        song.coordinate?.lng || null,
        song.coordinate_index || null,
      ]
    );
  }

  console.log(`Stored ${mappedSongs.length} songs for activity ${activity_id}`);

  // Store result data in job
  await pool.query(
    `UPDATE processing_jobs
     SET result_data = $1
     WHERE id = $2`,
    [
      JSON.stringify({
        activity_id: dbActivityId,
        songs_mapped: mappedSongs.length,
        coordinates_count: coordinates.length,
      }),
      job.id,
    ]
  );
}

/**
 * Process all pending jobs in the queue
 * Returns number of jobs processed
 */
export async function processPendingJobs(limit: number = 10): Promise<number> {
  const pool = getPool();

  // Get pending jobs ordered by priority and scheduled time
  const result = await pool.query(
    `SELECT id FROM processing_jobs
     WHERE status IN ($1, $2)
       AND scheduled_for <= CURRENT_TIMESTAMP
     ORDER BY priority DESC, scheduled_for ASC
     LIMIT $3`,
    ['pending', 'retry', limit]
  );

  const jobs = result.rows;
  console.log(`Found ${jobs.length} jobs to process`);

  let processed = 0;

  for (const job of jobs) {
    try {
      await processJob(job.id);
      processed++;
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
      // Continue with next job
    }
  }

  return processed;
}

/**
 * Clean up old completed jobs
 * @param daysOld - Delete jobs older than this many days (default: 30)
 */
export async function cleanupOldJobs(daysOld: number = 30): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `DELETE FROM processing_jobs
     WHERE status = $1
       AND completed_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'`,
    ['completed']
  );

  console.log(`Cleaned up ${result.rowCount} old jobs`);
  return result.rowCount || 0;
}
