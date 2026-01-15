# Fix for Duplicate Song Issue

## Problem Summary

Every time an activity was processed, all songs for that activity were:
1. **Deleted** from the database
2. **Re-inserted** with new auto-incremented primary key IDs

This caused two main issues:
- Song IDs changed on every run (same song, different ID)
- Potential for duplicate songs if operations were interrupted
- Inefficient database operations

## Root Cause

### Database Schema Issue
The `activity_songs` table had no unique constraint to prevent duplicate entries. The schema allowed the same song (same `spotify_track_id`, `played_at`, and `activity_id`) to be inserted multiple times.

### Code Issue
In `src/app/api/process-run/route.ts` (lines 174-177), when processing an existing activity:

```typescript
// Old problematic code
await query('DELETE FROM activity_songs WHERE activity_id = $1', [
  activityDbId,
]);
```

This deleted ALL songs for the activity, then lines 202-226 re-inserted them with new IDs.

## Solution Implemented

### 1. Database Migration
**File**: `migrations/001_add_unique_constraint_to_activity_songs.sql`

Added a unique constraint on `(activity_id, spotify_track_id, played_at)`:
```sql
ALTER TABLE activity_songs
ADD CONSTRAINT unique_activity_song_play
UNIQUE (activity_id, spotify_track_id, played_at);
```

This ensures:
- The same song played at the same time in the same activity can only exist once
- A song can be played multiple times in one activity (at different times)
- Database integrity is maintained

### 2. Updated Schema
**File**: `schema.sql` (line 53)

Added the unique constraint to the base schema for new installations:
```sql
CREATE TABLE IF NOT EXISTS activity_songs (
  ...
  UNIQUE(activity_id, spotify_track_id, played_at)
);
```

### 3. Code Changes - UPSERT Approach
**File**: `src/app/api/process-run/route.ts`

#### Removed the DELETE operation (line 174-175):
```typescript
// Old: await query('DELETE FROM activity_songs WHERE activity_id = $1', [activityDbId]);
// New: Comment explaining we use UPSERT instead
```

#### Changed INSERT to UPSERT (lines 205-235):
```typescript
await query(
  `INSERT INTO activity_songs
   (activity_id, spotify_track_id, ...)
   VALUES ($1, $2, ...)
   ON CONFLICT (activity_id, spotify_track_id, played_at)
   DO UPDATE SET
     track_name = EXCLUDED.track_name,
     artist_name = EXCLUDED.artist_name,
     ...`,
  [...]
);
```

**How UPSERT works**:
1. Tries to INSERT the song record
2. If a conflict occurs (same activity + track + played_at), UPDATE the existing record instead
3. The primary key ID is preserved across runs

## Benefits of This Fix

1. **Stable IDs**: Song IDs remain constant across multiple runs
2. **No Duplicates**: Unique constraint prevents duplicate entries
3. **Efficiency**: Only updates changed data instead of delete + insert
4. **Data Integrity**: Database constraints enforce correctness
5. **Idempotent Operations**: Running the same activity multiple times produces the same result

## How to Apply the Fix

### Step 1: Backup Your Database
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Apply the Migration
```bash
psql $DATABASE_URL -f migrations/001_add_unique_constraint_to_activity_songs.sql
```

### Step 3: Verify the Fix
```bash
./migrations/verify_fix.sh
```

Or manually check:
```bash
psql $DATABASE_URL -c "\d activity_songs"
```

Look for: `unique_activity_song_play` constraint

## Testing the Fix

### Test Plan

1. **Choose a test activity** from your Strava account

2. **First run** - Process the activity:
   ```bash
   # Through the app UI or API
   POST /api/process-run
   { "activityId": "YOUR_ACTIVITY_ID" }
   ```

3. **Record the song IDs**:
   ```sql
   SELECT id, spotify_track_id, track_name, played_at
   FROM activity_songs
   WHERE activity_id = YOUR_ACTIVITY_DB_ID
   ORDER BY played_at;
   ```
   Save the output.

4. **Second run** - Process the same activity again:
   ```bash
   POST /api/process-run
   { "activityId": "YOUR_ACTIVITY_ID" }
   ```

5. **Verify IDs are unchanged**:
   ```sql
   SELECT id, spotify_track_id, track_name, played_at
   FROM activity_songs
   WHERE activity_id = YOUR_ACTIVITY_DB_ID
   ORDER BY played_at;
   ```
   Compare with the first output. The `id` column should have the same values.

6. **Check for duplicates**:
   ```sql
   SELECT activity_id, spotify_track_id, played_at, COUNT(*) as count
   FROM activity_songs
   GROUP BY activity_id, spotify_track_id, played_at
   HAVING COUNT(*) > 1;
   ```
   Should return 0 rows (no duplicates).

### Expected Results

✅ **PASS**: Song IDs remain the same across multiple runs
✅ **PASS**: No duplicate songs in the database
✅ **PASS**: Song data is updated if Spotify metadata changed

❌ **FAIL**: If IDs change or duplicates appear, the migration may not have been applied correctly

## Edge Cases Handled

1. **Song played multiple times**: The unique constraint allows the same song (`spotify_track_id`) to appear multiple times in the same activity if played at different times (`played_at` is different).

2. **Activity re-processed with different songs**: If Spotify data changes between runs (e.g., user deleted listening history), old songs remain in the database. This is intentional to preserve historical data.

3. **Interrupted operations**: If the process crashes mid-execution, partial inserts are fine because UPSERT is idempotent.

4. **Concurrent requests**: The unique constraint at the database level prevents race conditions.

## Performance Impact

The UPSERT approach is actually MORE efficient than DELETE + INSERT:
- DELETE requires scanning for matching rows
- INSERT with new IDs requires index updates
- UPSERT only updates if the row exists, or inserts if new
- The unique index makes conflict detection very fast (O(log n))

## Files Changed

1. ✅ `schema.sql` - Added unique constraint to base schema
2. ✅ `migrations/001_add_unique_constraint_to_activity_songs.sql` - Migration script
3. ✅ `migrations/README.md` - Migration documentation
4. ✅ `migrations/verify_fix.sh` - Verification script
5. ✅ `src/app/api/process-run/route.ts` - Updated to use UPSERT
6. ✅ `FIX_DUPLICATE_SONGS.md` - This document

## Rollback Plan

If you need to revert this change:

```sql
-- Remove the constraint
ALTER TABLE activity_songs DROP CONSTRAINT IF EXISTS unique_activity_song_play;

-- Remove the index
DROP INDEX IF EXISTS idx_activity_songs_unique_play;
```

Then restore the old code:
```bash
git revert <commit-hash>
```

**Note**: You cannot restore duplicate records that were removed during migration.

## Questions?

If you encounter any issues:
1. Check that the migration was applied: `\d activity_songs` in psql
2. Run the verification script: `./migrations/verify_fix.sh`
3. Check logs for SQL errors during processing
4. Verify the code changes are deployed

## Summary

**Before**: Songs deleted and re-created with new IDs on every run
**After**: Songs inserted once with stable IDs, updated only if data changes

This fix ensures data consistency, improves performance, and prevents duplicate song entries.
