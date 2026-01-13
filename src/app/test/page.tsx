'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StravaActivity } from '@/types';
import { formatDistance } from 'date-fns';

export default function TestDashboard() {
  const router = useRouter();
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    // Enable test mode
    localStorage.setItem('test_mode', 'true');
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/activities');

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      setActivities(data.activities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processRun = async (activityId: number) => {
    try {
      setProcessingId(activityId);
      const response = await fetch('/api/process-run-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activityId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process run');
      }

      const data = await response.json();

      // Store in localStorage for test mode
      const testRuns = JSON.parse(localStorage.getItem('test_runs') || '{}');
      testRuns[activityId] = data;
      localStorage.setItem('test_runs', JSON.stringify(testRuns));

      // Redirect to the test run visualization page
      router.push(`/test/run/${activityId}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatDistanceMeters = (meters: number): string => {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  };

  const calculatePace = (distance: number, time: number): string => {
    const km = distance / 1000;
    const minutes = time / 60;
    const paceMinPerKm = minutes / km;
    const paceMin = Math.floor(paceMinPerKm);
    const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
    return `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading activities...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Error: {error}</div>
          <Link href="/" className="text-spotify-green hover:underline">
            Go back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Test Mode Banner */}
        <div className="mb-6 bg-yellow-500/20 border border-yellow-500 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            <div>
              <div className="text-yellow-300 font-semibold">Test Mode Active</div>
              <div className="text-yellow-200 text-sm">
                Using mock Spotify data. No database required. Data stored in browser only.
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-gray-400 hover:text-white mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">
            Test Dashboard - Your Runs
          </h1>
          <p className="text-gray-300">
            Select a run to test music mapping with mock data
          </p>
        </div>

        {/* Activities List */}
        {activities.length === 0 ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
            <p className="text-gray-300 text-lg mb-4">
              No running activities found
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Make sure you've connected your Strava account
            </p>
            <Link
              href="/api/auth/strava"
              className="inline-block bg-strava-orange hover:bg-strava-orange/90 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Connect Strava
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 hover:border-white/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {activity.name}
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-gray-400 text-sm">Distance</div>
                        <div className="text-white font-semibold">
                          {formatDistanceMeters(activity.distance)}
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-400 text-sm">Duration</div>
                        <div className="text-white font-semibold">
                          {formatTime(activity.elapsed_time)}
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-400 text-sm">Pace</div>
                        <div className="text-white font-semibold">
                          {calculatePace(activity.distance, activity.elapsed_time)}
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-400 text-sm">Date</div>
                        <div className="text-white font-semibold">
                          {formatDistance(
                            new Date(activity.start_date),
                            new Date(),
                            { addSuffix: true }
                          )}
                        </div>
                      </div>
                    </div>

                    {!activity.map.summary_polyline &&
                      !activity.map.polyline && (
                        <div className="text-yellow-400 text-sm mb-2">
                          ⚠️ This activity doesn't have GPS data
                        </div>
                      )}
                  </div>

                  <button
                    onClick={() => processRun(activity.id)}
                    disabled={
                      processingId === activity.id ||
                      (!activity.map.summary_polyline && !activity.map.polyline)
                    }
                    className="ml-4 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                  >
                    {processingId === activity.id
                      ? 'Processing...'
                      : '🧪 Test Map'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-2">
            Test Mode Instructions
          </h3>
          <ul className="text-gray-300 text-sm space-y-2">
            <li>✓ Real Strava activities with actual GPS data</li>
            <li>✓ Mock Spotify songs generated for the run duration</li>
            <li>✓ No database setup required</li>
            <li>✓ Data stored in browser localStorage only</li>
            <li>⚠️ Data will be lost when you clear browser storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
