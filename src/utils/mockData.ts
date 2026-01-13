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

const MOCK_SONGS_POOL = [
  {
    id: 'mock1',
    name: 'Eye of the Tiger',
    artist: 'Survivor',
    album: 'Eye of the Tiger',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4e5',
    duration: 246000,
  },
  {
    id: 'mock2',
    name: "Don't Stop Me Now",
    artist: 'Queen',
    album: 'Jazz',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4e6',
    duration: 210000,
  },
  {
    id: 'mock3',
    name: 'Stronger',
    artist: 'Kanye West',
    album: 'Graduation',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4e7',
    duration: 312000,
  },
  {
    id: 'mock4',
    name: 'Lose Yourself',
    artist: 'Eminem',
    album: '8 Mile Soundtrack',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4e8',
    duration: 326000,
  },
  {
    id: 'mock5',
    name: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    album: 'Uptown Special',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4e9',
    duration: 269000,
  },
  {
    id: 'mock6',
    name: 'Run the World (Girls)',
    artist: 'Beyoncé',
    album: '4',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4f0',
    duration: 236000,
  },
  {
    id: 'mock7',
    name: 'Till I Collapse',
    artist: 'Eminem ft. Nate Dogg',
    album: 'The Eminem Show',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4f1',
    duration: 297000,
  },
  {
    id: 'mock8',
    name: 'Thunderstruck',
    artist: 'AC/DC',
    album: 'The Razors Edge',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4f2',
    duration: 292000,
  },
  {
    id: 'mock9',
    name: 'Pump It',
    artist: 'The Black Eyed Peas',
    album: 'Monkey Business',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4f3',
    duration: 213000,
  },
  {
    id: 'mock10',
    name: 'Born to Run',
    artist: 'Bruce Springsteen',
    album: 'Born to Run',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4f4',
    duration: 270000,
  },
  {
    id: 'mock11',
    name: 'Remember the Name',
    artist: 'Fort Minor',
    album: 'The Rising Tied',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4f5',
    duration: 219000,
  },
  {
    id: 'mock12',
    name: "Can't Hold Us",
    artist: 'Macklemore & Ryan Lewis',
    album: 'The Heist',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273a6f3d8b8c6c3e4a1b2c3d4f6',
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
