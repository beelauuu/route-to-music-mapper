-- Migration: Strava Webhook Integration
-- Adds tables for webhook subscriptions, event logging, and background job processing

-- Table to track active Strava webhook subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER UNIQUE, -- Strava's subscription ID
  callback_url TEXT NOT NULL,
  verify_token VARCHAR(255) NOT NULL, -- Our secret token for verification
  subscription_status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to log all incoming webhook events from Strava
CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER,
  object_type VARCHAR(50), -- 'activity', 'athlete'
  object_id BIGINT, -- Strava activity ID or athlete ID
  aspect_type VARCHAR(50), -- 'create', 'update', 'delete'
  owner_id BIGINT, -- Strava athlete ID
  event_time TIMESTAMP NOT NULL, -- When Strava sent the event
  raw_payload JSONB, -- Full event data from Strava
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  processing_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to queue and track background processing jobs
CREATE TABLE IF NOT EXISTS processing_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL, -- 'process_activity', 'refresh_tokens', etc.
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  activity_id BIGINT, -- Strava activity ID to process
  webhook_event_id INTEGER REFERENCES webhook_events(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'retry'
  priority INTEGER DEFAULT 0, -- Higher priority jobs processed first
  attempts INTEGER DEFAULT 0, -- Number of processing attempts
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  result_data JSONB, -- Store processing results
  scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When to process
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX idx_webhook_events_object_id ON webhook_events(object_id);
CREATE INDEX idx_webhook_events_owner_id ON webhook_events(owner_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_event_time ON webhook_events(event_time);

CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_activity_id ON processing_jobs(activity_id);
CREATE INDEX idx_processing_jobs_scheduled_for ON processing_jobs(scheduled_for);
CREATE INDEX idx_processing_jobs_priority_status ON processing_jobs(priority DESC, status, scheduled_for);

-- Add strava_athlete_id to users table for webhook event matching
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_strava_athlete_id ON users(strava_athlete_id);

-- Comment on tables
COMMENT ON TABLE webhook_subscriptions IS 'Tracks active Strava webhook subscriptions for the application';
COMMENT ON TABLE webhook_events IS 'Logs all incoming webhook events from Strava for auditing and processing';
COMMENT ON TABLE processing_jobs IS 'Background job queue for asynchronous activity processing triggered by webhooks';
