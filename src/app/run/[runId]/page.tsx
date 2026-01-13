'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ActivityWithSongs } from '@/types';
import { format } from 'date-fns';

// Dynamically import the map component to avoid SSR issues
const RunMap = dynamic(() => import('@/components/RunMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg">
      <div className="text-white">Loading map...</div>
    </div>
  ),
});

export default function RunPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [runData, setRunData] = useState<ActivityWithSongs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRunData();
  }, [runId]);

  const fetchRunData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/runs/${runId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch run data');
      }

      const data = await response.json();
      setRunData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        <div className="text-white text-xl">Loading run data...</div>
      </div>
    );
  }

  if (error || !runData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">
            Error: {error || 'Run not found'}
          </div>
          <Link href="/dashboard" className="text-spotify-green hover:underline">
            Go back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-white mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">{runData.name}</h1>
          <p className="text-gray-300">
            {format(new Date(runData.start_date), 'MMMM d, yyyy h:mm a')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Distance</div>
            <div className="text-white text-2xl font-bold">
              {formatDistanceMeters(runData.distance)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Duration</div>
            <div className="text-white text-2xl font-bold">
              {formatTime(runData.elapsed_time)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Pace</div>
            <div className="text-white text-2xl font-bold">
              {calculatePace(runData.distance, runData.elapsed_time)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Songs Played</div>
            <div className="text-white text-2xl font-bold">
              {runData.songs.length}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 h-[600px] overflow-hidden">
              {runData.coordinates && runData.coordinates.length > 0 ? (
                <RunMap
                  coordinates={runData.coordinates}
                  songs={runData.songs}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">No GPS data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Song List */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">
                Songs Playlist
              </h2>

              {runData.songs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-2">No songs found</p>
                  <p className="text-sm text-gray-500">
                    No songs were played during this run, or they couldn't be
                    matched to the run timeframe.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[540px] overflow-y-auto">
                  {runData.songs.map((song, index) => (
                    <div
                      key={song.id}
                      className="flex gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {song.album_art_url ? (
                          <img
                            src={song.album_art_url}
                            alt={song.album_name}
                            className="w-12 h-12 rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                            🎵
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {index + 1}. {song.track_name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {song.artist_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {Math.round(song.percentage_complete * 100)}% through
                          run
                        </div>
                      </div>

                      <a
                        href={song.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 self-center text-spotify-green hover:text-spotify-green/80 transition-colors"
                        title="Open in Spotify"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share Section */}
        <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            Share Your Musical Journey
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Share this unique visualization with your friends
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
              }}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
