'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Coordinate, ActivitySong } from '@/types';

interface RunMapProps {
  coordinates: Coordinate[];
  songs: ActivitySong[];
  mapboxToken?: string;
}

export default function RunMap({ coordinates, songs, mapboxToken }: RunMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Use provided token or from env
    const token = mapboxToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!token) {
      setError('Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file.');
      return;
    }

    if (!coordinates || coordinates.length === 0) {
      setError('No coordinates provided for the route.');
      return;
    }

    console.log('Initializing map with', coordinates.length, 'coordinates');
    mapboxgl.accessToken = token;

    try {
      // Calculate bounds
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((coord) => {
        bounds.extend([coord.lng, coord.lat]);
      });

      console.log('Map bounds:', bounds);

      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        bounds: bounds,
        fitBoundsOptions: {
          padding: 50,
        },
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Failed to load map. Check your Mapbox token.');
      });

    map.current.on('load', () => {
      console.log('Map loaded successfully!');
      setMapLoaded(true);

      // Add route line
      if (map.current) {
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates.map((coord) => [coord.lng, coord.lat]),
            },
          },
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#FC4C02', // Strava orange
            'line-width': 4,
            'line-opacity': 0.8,
          },
        });

        // Add start marker
        const startCoord = coordinates[0];
        new mapboxgl.Marker({ color: '#1DB954' }) // Spotify green
          .setLngLat([startCoord.lng, startCoord.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              '<div class="p-2"><strong>Start</strong></div>'
            )
          )
          .addTo(map.current);

        // Add end marker
        const endCoord = coordinates[coordinates.length - 1];
        new mapboxgl.Marker({ color: '#FF0000' }) // Red
          .setLngLat([endCoord.lng, endCoord.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              '<div class="p-2"><strong>Finish</strong></div>'
            )
          )
          .addTo(map.current);

        // Add song markers
        songs.forEach((song, index) => {
          if (song.latitude && song.longitude) {
            const popupContent = `
              <div class="p-0 min-w-[250px]">
                ${
                  song.album_art_url
                    ? `<img src="${song.album_art_url}" alt="${song.album_name}" class="w-full h-48 object-cover" />`
                    : ''
                }
                <div class="p-3">
                  <div class="font-semibold text-base mb-1">${song.track_name}</div>
                  <div class="text-sm text-gray-600 mb-2">${song.artist_name}</div>
                  <div class="text-xs text-gray-500 mb-3">${song.album_name}</div>
                  <a
                    href="${song.spotify_url}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 bg-spotify-green text-white px-3 py-1.5 rounded text-sm hover:bg-spotify-green/90 transition-colors"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    Open in Spotify
                  </a>
                </div>
              </div>
            `;

            const popup = new mapboxgl.Popup({
              offset: 25,
              maxWidth: '300px',
            }).setHTML(popupContent);

            // Create custom marker element
            const el = document.createElement('div');
            el.className = 'song-marker';
            el.style.backgroundImage = `url(${song.album_art_url})`;
            el.style.width = '40px';
            el.style.height = '40px';
            el.style.borderRadius = '50%';
            el.style.border = '3px solid #1DB954';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.cursor = 'pointer';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

            // Add number badge
            const badge = document.createElement('div');
            badge.textContent = (index + 1).toString();
            badge.style.position = 'absolute';
            badge.style.top = '-8px';
            badge.style.right = '-8px';
            badge.style.backgroundColor = '#1DB954';
            badge.style.color = 'white';
            badge.style.borderRadius = '50%';
            badge.style.width = '20px';
            badge.style.height = '20px';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.justifyContent = 'center';
            badge.style.fontSize = '11px';
            badge.style.fontWeight = 'bold';
            el.appendChild(badge);

            new mapboxgl.Marker(el)
              .setLngLat([song.longitude, song.latitude])
              .setPopup(popup)
              .addTo(map.current!);
          }
        });
      }
    });

    } catch (err: any) {
      console.error('Error initializing map:', err);
      setError(err.message || 'Failed to initialize map');
    }

    return () => {
      map.current?.remove();
    };
  }, [coordinates, songs, mapboxToken]);

  if (error) {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden shadow-lg bg-gray-800 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-red-400 text-xl mb-4">⚠️ Map Error</div>
        <div className="text-gray-300 text-sm mb-4">{error}</div>
        <div className="text-gray-400 text-xs">
          <p className="mb-2">To fix this:</p>
          <ol className="text-left space-y-1">
            <li>1. Sign up at <a href="https://www.mapbox.com" target="_blank" className="text-blue-400 hover:underline">mapbox.com</a></li>
            <li>2. Copy your access token</li>
            <li>3. Add to .env: NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-token</li>
            <li>4. Restart the dev server</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: '500px' }}
    />
  );
}
