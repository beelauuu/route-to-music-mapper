import { NextRequest, NextResponse } from 'next/server';
import { processPendingJobs } from '@/lib/jobProcessor';

/**
 * GET /api/cron/process-jobs
 * Cron endpoint for processing pending jobs
 *
 * This endpoint should be called periodically (e.g., every 1-5 minutes) by:
 * - Vercel Cron (vercel.json configuration)
 * - External cron services (cron-job.org, etc.)
 * - GitHub Actions scheduled workflows
 *
 * Security: In production, protect this endpoint with:
 * - Vercel Cron Secret header verification
 * - API key authentication
 * - IP whitelisting
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[CRON] Processing pending jobs...');
    const startTime = Date.now();

    // Process up to 20 jobs per cron run
    const processed = await processPendingJobs(20);

    const duration = Date.now() - startTime;
    console.log(`[CRON] Processed ${processed} jobs in ${duration}ms`);

    return NextResponse.json({
      success: true,
      processed,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Error processing jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to process jobs',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
