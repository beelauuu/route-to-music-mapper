#!/bin/bash

# Verification script for the duplicate songs fix
# This script helps you verify that songs maintain their IDs across multiple runs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "==========================================="
echo "Song Duplicate Fix Verification Script"
echo "==========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    echo "Please set it in your .env file or export it:"
    echo "  export DATABASE_URL='postgresql://user:password@localhost:5432/route_music_mapper'"
    exit 1
fi

echo "Using database: $DATABASE_URL"
echo ""

# Function to run SQL query
run_query() {
    psql "$DATABASE_URL" -t -A -c "$1"
}

# Check if migration has been applied
echo "1. Checking if unique constraint exists..."
constraint_exists=$(run_query "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'unique_activity_song_play';")

if [ "$constraint_exists" -eq "0" ]; then
    echo -e "${YELLOW}⚠ WARNING: Unique constraint not found!${NC}"
    echo "Please apply the migration first:"
    echo "  psql \$DATABASE_URL -f migrations/001_add_unique_constraint_to_activity_songs.sql"
    echo ""
else
    echo -e "${GREEN}✓ Unique constraint is present${NC}"
    echo ""
fi

# Check for existing duplicates
echo "2. Checking for duplicate songs..."
duplicates=$(run_query "
    SELECT COUNT(*)
    FROM (
        SELECT activity_id, spotify_track_id, played_at, COUNT(*) as count
        FROM activity_songs
        GROUP BY activity_id, spotify_track_id, played_at
        HAVING COUNT(*) > 1
    ) dupes;
")

if [ "$duplicates" -eq "0" ]; then
    echo -e "${GREEN}✓ No duplicate songs found${NC}"
else
    echo -e "${RED}✗ Found $duplicates duplicate song entries!${NC}"
    echo "Details:"
    run_query "
        SELECT activity_id, spotify_track_id, track_name, played_at, COUNT(*) as count
        FROM activity_songs
        GROUP BY activity_id, spotify_track_id, track_name, played_at
        HAVING COUNT(*) > 1;
    "
fi
echo ""

# Show statistics
echo "3. Database statistics:"
total_songs=$(run_query "SELECT COUNT(*) FROM activity_songs;")
unique_tracks=$(run_query "SELECT COUNT(DISTINCT spotify_track_id) FROM activity_songs;")
total_activities=$(run_query "SELECT COUNT(*) FROM activities;")

echo "  Total song records: $total_songs"
echo "  Unique Spotify tracks: $unique_tracks"
echo "  Total activities: $total_activities"
echo ""

# Show sample of song IDs for an activity (if any exist)
echo "4. Sample data (most recent activity):"
sample=$(run_query "
    SELECT a.id, a.name, COUNT(s.id) as song_count
    FROM activities a
    LEFT JOIN activity_songs s ON a.id = s.activity_id
    GROUP BY a.id, a.name
    ORDER BY a.created_at DESC
    LIMIT 1;
" | head -1)

if [ -n "$sample" ]; then
    activity_id=$(echo "$sample" | cut -d'|' -f1)
    activity_name=$(echo "$sample" | cut -d'|' -f2)
    song_count=$(echo "$sample" | cut -d'|' -f3)

    echo "  Activity ID: $activity_id"
    echo "  Activity Name: $activity_name"
    echo "  Songs: $song_count"
    echo ""
    echo "  Song IDs for this activity:"
    run_query "
        SELECT id, track_name, artist_name
        FROM activity_songs
        WHERE activity_id = $activity_id
        ORDER BY played_at
        LIMIT 5;
    " | while IFS='|' read -r id name artist; do
        echo "    ID: $id - $name by $artist"
    done
    echo ""
    echo -e "${YELLOW}NOTE: Process this activity again and verify these IDs stay the same${NC}"
else
    echo "  No activities found in database"
fi
echo ""

echo "==========================================="
echo "Verification complete!"
echo "==========================================="
