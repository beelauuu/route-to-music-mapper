-- Database schema for Route to Music Mapper

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'spotify' or 'strava'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255),
  start_date TIMESTAMP NOT NULL,
  elapsed_time INTEGER NOT NULL, -- in seconds
  distance FLOAT, -- in meters
  polyline TEXT NOT NULL, -- encoded polyline
  coordinates JSONB, -- decoded coordinates array
  splits_metric JSONB, -- pace data for better accuracy
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_songs (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  spotify_track_id VARCHAR(255) NOT NULL,
  track_name VARCHAR(500),
  artist_name VARCHAR(500),
  album_name VARCHAR(500),
  album_art_url TEXT,
  spotify_url TEXT,
  played_at TIMESTAMP NOT NULL,
  percentage_complete FLOAT NOT NULL, -- 0.0 to 1.0
  latitude FLOAT,
  longitude FLOAT,
  coordinate_index INTEGER, -- index in the polyline array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(activity_id, spotify_track_id, played_at)
);

CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_strava_id ON activities(strava_activity_id);
CREATE INDEX idx_activity_songs_activity_id ON activity_songs(activity_id);
CREATE INDEX idx_auth_tokens_user_provider ON auth_tokens(user_id, provider);
