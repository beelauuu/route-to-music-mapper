// Type definitions for Route to Music Mapper

export interface User {
  id: number;
  email?: string;
  name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthToken {
  id: number;
  user_id: number;
  provider: 'spotify' | 'strava';
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface SplitMetric {
  distance: number;
  elapsed_time: number;
  split: number;
  average_speed: number;
  pace_zone?: number;
}

export interface Activity {
  id: number;
  user_id: number;
  strava_activity_id: number;
  name: string;
  start_date: Date;
  elapsed_time: number; // in seconds
  distance: number; // in meters
  polyline: string; // encoded polyline
  coordinates?: Coordinate[];
  splits_metric?: SplitMetric[];
  created_at: Date;
  updated_at: Date;
}

export interface ActivitySong {
  id: number;
  activity_id: number;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_art_url: string;
  spotify_url: string;
  played_at: Date;
  percentage_complete: number; // 0.0 to 1.0
  latitude?: number;
  longitude?: number;
  coordinate_index?: number;
  created_at: Date;
}

export interface ActivityWithSongs extends Activity {
  songs: ActivitySong[];
}

// Strava API Types
export interface StravaActivity {
  id: number;
  name: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number;
  distance: number;
  map: {
    summary_polyline: string;
    polyline?: string;
  };
  splits_metric?: SplitMetric[];
  type: string;
}

export interface StravaAthlete {
  id: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  profile?: string;
}

// Spotify API Types
export interface SpotifyTrack {
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
}

export interface SpotifyRecentlyPlayed {
  track: SpotifyTrack;
  played_at: string; // ISO 8601 timestamp
  context?: {
    type: string;
    uri: string;
  };
}

export interface SpotifyRecentlyPlayedResponse {
  items: SpotifyRecentlyPlayed[];
  next?: string;
  cursors?: {
    after: string;
    before: string;
  };
  limit: number;
  href: string;
}

// Processing Types
export interface SongWithLocation extends SpotifyRecentlyPlayed {
  percentage_complete: number;
  coordinate?: Coordinate;
  coordinate_index?: number;
}

export interface ProcessedRunData {
  activity: Activity;
  songs: SongWithLocation[];
  stats?: {
    total_songs: number;
    songs_during_run: number;
    average_tempo?: number;
    average_pace?: number;
  };
}
