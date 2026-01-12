import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Activity, ActivitySong, ActivityWithSongs } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const runId = parseInt(params.runId);

    // Fetch activity
    const activityResult = await query<Activity>(
      'SELECT * FROM activities WHERE id = $1',
      [runId]
    );

    if (activityResult.rows.length === 0) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const activity = activityResult.rows[0];

    // Parse JSON fields
    if (typeof activity.coordinates === 'string') {
      activity.coordinates = JSON.parse(activity.coordinates);
    }
    if (typeof activity.splits_metric === 'string') {
      activity.splits_metric = JSON.parse(activity.splits_metric);
    }

    // Fetch songs
    const songsResult = await query<ActivitySong>(
      `SELECT * FROM activity_songs
       WHERE activity_id = $1
       ORDER BY played_at ASC`,
      [runId]
    );

    const activityWithSongs: ActivityWithSongs = {
      ...activity,
      songs: songsResult.rows,
    };

    return NextResponse.json(activityWithSongs);
  } catch (error: any) {
    console.error('Error fetching run:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch run' },
      { status: 500 }
    );
  }
}
