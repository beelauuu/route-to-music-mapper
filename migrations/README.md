# Database Migrations

This directory contains database migration scripts to update the schema.

## Migration 001: Fix Duplicate Song Issues

**Problem**: Songs were being deleted and re-inserted with new primary key IDs every time an activity was processed, causing:
- New IDs for the same songs on every run
- Potential for duplicate songs if deletion failed
- Inefficient database operations

**Solution**:
1. Added a unique constraint on `(activity_id, spotify_track_id, played_at)` to prevent duplicates
2. Changed the code to use UPSERT (INSERT ... ON CONFLICT DO UPDATE) instead of DELETE + INSERT
3. This preserves primary key IDs across multiple runs

### How to Apply This Migration

1. **Backup your database first** (always a good practice):
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply the migration**:
   ```bash
   psql $DATABASE_URL -f migrations/001_add_unique_constraint_to_activity_songs.sql
   ```

3. **Verify the migration**:
   ```bash
   psql $DATABASE_URL -c "\d activity_songs"
   ```

   You should see a unique constraint named `unique_activity_song_play` on the columns `(activity_id, spotify_track_id, played_at)`.

### What This Migration Does

1. **Removes existing duplicates**: Before adding the constraint, it removes any duplicate records that may already exist in the database, keeping only the oldest record (MIN(id)) for each unique combination.

2. **Adds unique constraint**: Ensures that the same song (same `spotify_track_id`) played at the same time (`played_at`) for the same activity (`activity_id`) cannot be inserted twice.

3. **Creates an index**: Improves the performance of upsert operations.

### Testing the Fix

To verify the fix works correctly:

1. **Process an activity** through the app
2. **Record the song IDs**:
   ```bash
   psql $DATABASE_URL -c "SELECT id, track_name FROM activity_songs WHERE activity_id = YOUR_ACTIVITY_ID ORDER BY id;"
   ```
3. **Process the same activity again**
4. **Check the song IDs again** - they should be the same as before (not new IDs)
5. **Verify no duplicates**:
   ```bash
   psql $DATABASE_URL -c "
     SELECT activity_id, spotify_track_id, played_at, COUNT(*) as count
     FROM activity_songs
     GROUP BY activity_id, spotify_track_id, played_at
     HAVING COUNT(*) > 1;
   "
   ```
   This should return 0 rows.

### Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove the constraint
ALTER TABLE activity_songs DROP CONSTRAINT IF EXISTS unique_activity_song_play;

-- Remove the index
DROP INDEX IF EXISTS idx_activity_songs_unique_play;
```

**Note**: Rolling back will not restore any duplicate records that were removed during migration.
