// Mock Spotify data for testing
// Generates realistic song data for a given run timeframe

export interface MockSong {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string; id: string }>;
    album: {
      name: string;
      images: Array<{ url: string; height: number; width: number }>;
    };
    external_urls: {
      spotify: string;
    };
    duration_ms: number;
  };
  played_at: string;
}

// Helper function to create colorful album art data URIs
const createAlbumArt = (color: string, emoji: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <rect width="300" height="300" fill="${color}"/>
    <text x="150" y="180" font-size="120" text-anchor="middle" fill="white">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const MOCK_SONGS_POOL = [
  {
    id: 'mock1',
    name: 'Eye of the Tiger',
    artist: 'Survivor',
    album: 'Eye of the Tiger',
    albumArt: createAlbumArt('#FF6B35', '🐯'),
    duration: 246000,
  },
  {
    id: 'mock2',
    name: "Don't Stop Me Now",
    artist: 'Queen',
    album: 'Jazz',
    albumArt: createAlbumArt('#FFD23F', '👑'),
    duration: 210000,
  },
  {
    id: 'mock3',
    name: 'Stronger',
    artist: 'Kanye West',
    album: 'Graduation',
    albumArt: createAlbumArt('#8338EC', '💪'),
    duration: 312000,
  },
  {
    id: 'mock4',
    name: 'Lose Yourself',
    artist: 'Eminem',
    album: '8 Mile Soundtrack',
    albumArt: createAlbumArt('#3A86FF', '🎤'),
    duration: 326000,
  },
  {
    id: 'mock5',
    name: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    album: 'Uptown Special',
    albumArt: createAlbumArt('#FB5607', '🕺'),
    duration: 269000,
  },
  {
    id: 'mock6',
    name: 'Run the World (Girls)',
    artist: 'Beyoncé',
    album: '4',
    albumArt: createAlbumArt('#FF006E', '👸'),
    duration: 236000,
  },
  {
    id: 'mock7',
    name: 'Till I Collapse',
    artist: 'Eminem ft. Nate Dogg',
    album: 'The Eminem Show',
    albumArt: createAlbumArt('#06FFA5', '⚡'),
    duration: 297000,
  },
  {
    id: 'mock8',
    name: 'Thunderstruck',
    artist: 'AC/DC',
    album: 'The Razors Edge',
    albumArt: createAlbumArt('#FFBE0B', '⚡'),
    duration: 292000,
  },
  {
    id: 'mock9',
    name: 'Pump It',
    artist: 'The Black Eyed Peas',
    album: 'Monkey Business',
    albumArt: createAlbumArt('#F72585', '🔊'),
    duration: 213000,
  },
  {
    id: 'mock10',
    name: 'Born to Run',
    artist: 'Bruce Springsteen',
    album: 'Born to Run',
    albumArt: createAlbumArt('#4361EE', '🏃'),
    duration: 270000,
  },
  {
    id: 'mock11',
    name: 'Remember the Name',
    artist: 'Fort Minor',
    album: 'The Rising Tied',
    albumArt: createAlbumArt('#7209B7', '🎵'),
    duration: 219000,
  },
  {
    id: 'mock12',
    name: "Can't Hold Us",
    artist: 'Macklemore & Ryan Lewis',
    album: 'The Heist',
    albumArt: createAlbumArt('#06D6A0', '🚀'),
    duration: 258000,
  },
];

/**
 * Generates mock Spotify songs for a given run
 * @param runStartDate - Run start time
 * @param runDurationSeconds - Run duration in seconds
 * @returns Array of mock songs with timestamps during the run
 */
export function generateMockSongs(
  runStartDate: Date,
  runDurationSeconds: number
): MockSong[] {
  const songs: MockSong[] = [];
  const runStartMs = runStartDate.getTime();
  const runEndMs = runStartMs + runDurationSeconds * 1000;

  let currentTimeMs = runStartMs;
  let songIndex = 0;

  // Generate songs throughout the run
  while (currentTimeMs < runEndMs && songIndex < MOCK_SONGS_POOL.length) {
    const mockSong = MOCK_SONGS_POOL[songIndex];

    const song: MockSong = {
      track: {
        id: mockSong.id,
        name: mockSong.name,
        artists: [{ name: mockSong.artist, id: `artist_${mockSong.id}` }],
        album: {
          name: mockSong.album,
          images: [
            {
              url: mockSong.albumArt,
              height: 640,
              width: 640,
            },
            {
              url: mockSong.albumArt,
              height: 300,
              width: 300,
            },
            {
              url: mockSong.albumArt,
              height: 64,
              width: 64,
            },
          ],
        },
        external_urls: {
          spotify: `https://open.spotify.com/track/${mockSong.id}`,
        },
        duration_ms: mockSong.duration,
      },
      played_at: new Date(currentTimeMs).toISOString(),
    };

    songs.push(song);

    // Move to next song time (add song duration)
    currentTimeMs += mockSong.duration;
    songIndex++;
  }

  return songs;
}

/**
 * Checks if test mode is enabled
 */
export function isTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('test_mode') === 'true';
}

/**
 * Enables test mode
 */
export function enableTestMode(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('test_mode', 'true');
  }
}

/**
 * Disables test mode
 */
export function disableTestMode(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('test_mode');
  }
}
