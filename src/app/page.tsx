'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-6xl font-bold text-white mb-4">
              Route to Music Mapper
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Visualize which songs you listened to during your Strava runs
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-spotify-green rounded-full"></div>
                <span>Spotify</span>
              </div>
              <span>+</span>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-strava-orange rounded-full"></div>
                <span>Strava</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500 rounded-lg text-center">
              <p className="text-red-300">
                Authentication error: {error.replace(/_/g, ' ')}
              </p>
            </div>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="text-3xl mb-3">🗺️</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Interactive Maps
              </h3>
              <p className="text-gray-300 text-sm">
                See your run route with markers showing exactly where each song
                played
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="text-3xl mb-3">🎵</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Song Details
              </h3>
              <p className="text-gray-300 text-sm">
                Click any marker to see album art, track info, and a direct link
                to Spotify
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Accurate Mapping
              </h3>
              <p className="text-gray-300 text-sm">
                Uses your run's pace data for precise song-to-location mapping
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              Get Started
            </h2>
            <p className="text-gray-300 text-center mb-6">
              Connect both Spotify and Strava to start mapping your runs
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/api/auth/spotify"
                className="flex items-center justify-center gap-3 bg-spotify-green hover:bg-spotify-green/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Connect Spotify
              </Link>

              <Link
                href="/api/auth/strava"
                className="flex items-center justify-center gap-3 bg-strava-orange hover:bg-strava-orange/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Connect Strava
              </Link>
            </div>

            <p className="text-sm text-gray-400 text-center mt-6">
              Already connected?{' '}
              <Link href="/dashboard" className="text-spotify-green hover:underline">
                Go to Dashboard
              </Link>
            </p>
          </div>

          {/* How it Works */}
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-6">How it Works</h2>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-gray-300">
                <div className="text-3xl font-bold text-spotify-green mb-2">1</div>
                <p className="text-sm">Connect Spotify & Strava</p>
              </div>
              <div className="text-gray-300">
                <div className="text-3xl font-bold text-spotify-green mb-2">2</div>
                <p className="text-sm">Select a recent run</p>
              </div>
              <div className="text-gray-300">
                <div className="text-3xl font-bold text-spotify-green mb-2">3</div>
                <p className="text-sm">We map your songs to GPS coordinates</p>
              </div>
              <div className="text-gray-300">
                <div className="text-3xl font-bold text-spotify-green mb-2">4</div>
                <p className="text-sm">Explore your musical journey</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
