import { NextRequest, NextResponse } from 'next/server';
import { processPendingJobs, cleanupOldJobs } from '@/lib/jobProcessor';

/**
 * POST /api/jobs/process
 * Process pending jobs in the queue
 *
 * This endpoint can be called:
 * 1. Manually for testing
 * 2. By a cron job for scheduled processing
 * 3. By webhook handlers after queuing jobs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { limit = 10, cleanup = false } = body;

    console.log(`Processing jobs with limit: ${limit}`);

    const processed = await processPendingJobs(limit);

    let cleanedUp = 0;
    if (cleanup) {
      cleanedUp = await cleanupOldJobs(30);
    }

    return NextResponse.json({
      success: true,
      processed,
      cleanedUp,
      message: `Processed ${processed} jobs${cleanup ? `, cleaned up ${cleanedUp} old jobs` : ''}`,
    });
  } catch (error: any) {
    console.error('Error processing jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to process jobs',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/process
 * Get job queue statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { getPool } = await import('@/lib/db');
    const pool = getPool();

    const stats = await pool.query(
      `SELECT
         status,
         COUNT(*) as count,
         MIN(created_at) as oldest,
         MAX(created_at) as newest
       FROM processing_jobs
       GROUP BY status
       ORDER BY status`
    );

    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM processing_jobs'
    );

    return NextResponse.json({
      total: parseInt(totalResult.rows[0].total),
      by_status: stats.rows,
    });
  } catch (error: any) {
    console.error('Error fetching job stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch job statistics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
