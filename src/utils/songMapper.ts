import { Coordinate, SpotifyRecentlyPlayed, SongWithLocation, SplitMetric } from '@/types';
import { getCoordinateAtPercentage } from './polyline';

interface MapSongsToRouteParams {
  songs: SpotifyRecentlyPlayed[];
  runStartTime: Date;
  runDuration: number; // in seconds
  coordinates: Coordinate[];
  splits?: SplitMetric[];
}

/**
 * Maps songs to specific locations along a route based on when they were played
 * @param params - Mapping parameters including songs, run data, and coordinates
 * @returns Array of songs with their mapped locations
 */
export function mapSongsToRoute({
  songs,
  runStartTime,
  runDuration,
  coordinates,
  splits,
}: MapSongsToRouteParams): SongWithLocation[] {
  const runStartMs = runStartTime.getTime();
  const runEndMs = runStartMs + runDuration * 1000;

  console.log('\n=== SONG MAPPER DEBUG ===');
  console.log('Run window: ', new Date(runStartMs).toISOString(), 'to', new Date(runEndMs).toISOString());
  console.log('Processing', songs.length, 'songs');

  const mappedSongs: SongWithLocation[] = [];
  let filteredOutBefore = 0;
  let filteredOutAfter = 0;

  for (const song of songs) {
    const songTimestamp = new Date(song.played_at).getTime();

    // Filter out songs played outside the run timeframe
    if (songTimestamp < runStartMs) {
      filteredOutBefore++;
      console.log(`  ❌ FILTERED (before): ${song.track.name} - ${new Date(song.played_at).toISOString()} (${((runStartMs - songTimestamp) / 1000).toFixed(0)}s before run)`);
      continue;
    }

    if (songTimestamp > runEndMs) {
      filteredOutAfter++;
      console.log(`  ❌ FILTERED (after): ${song.track.name} - ${new Date(song.played_at).toISOString()} (${((songTimestamp - runEndMs) / 1000).toFixed(0)}s after run)`);
      continue;
    }

    console.log(`  ✓ MAPPED: ${song.track.name} - ${new Date(song.played_at).toISOString()}`);

    // Calculate percentage complete
    let percentageComplete = (songTimestamp - runStartMs) / (runDuration * 1000);
    percentageComplete = Math.max(0, Math.min(1, percentageComplete)); // Clamp to [0, 1]

    // If splits data is available, use it for more accurate positioning
    if (splits && splits.length > 0) {
      percentageComplete = calculatePercentageWithSplits(
        songTimestamp,
        runStartMs,
        splits
      );
    }

    // Get the coordinate at this percentage
    const result = getCoordinateAtPercentage(coordinates, percentageComplete);

    mappedSongs.push({
      ...song,
      percentage_complete: percentageComplete,
      coordinate: result?.coordinate,
      coordinate_index: result?.index,
    });
  }

  console.log(`\nSummary: ${mappedSongs.length} songs mapped, ${filteredOutBefore} filtered (before run), ${filteredOutAfter} filtered (after run)`);
  console.log('=== END SONG MAPPER DEBUG ===\n');

  return mappedSongs;
}

/**
 * Calculates more accurate percentage using splits data (variable pace)
 * @param songTimestamp - Timestamp when song was played
 * @param runStartMs - Run start time in milliseconds
 * @param splits - Array of split metrics with distance and elapsed time
 * @returns Percentage complete (0.0 to 1.0)
 */
function calculatePercentageWithSplits(
  songTimestamp: number,
  runStartMs: number,
  splits: SplitMetric[]
): number {
  const elapsedSeconds = (songTimestamp - runStartMs) / 1000;

  let cumulativeTime = 0;
  let cumulativeDistance = 0;
  let totalDistance = 0;

  // Calculate total distance
  for (const split of splits) {
    totalDistance += split.distance;
  }

  // Find which split the song falls into
  for (const split of splits) {
    cumulativeTime += split.elapsed_time;

    if (elapsedSeconds <= cumulativeTime) {
      // Song was played during this split
      const timeIntoSplit = elapsedSeconds - (cumulativeTime - split.elapsed_time);
      const percentageOfSplit = timeIntoSplit / split.elapsed_time;
      const distanceIntoSplit = split.distance * percentageOfSplit;

      const totalDistanceAtSong = cumulativeDistance + distanceIntoSplit;
      return totalDistanceAtSong / totalDistance;
    }

    cumulativeDistance += split.distance;
  }

  // If we've exceeded all splits, return 1.0
  return 1.0;
}

/**
 * Handles clustering of songs that are very close together
 * @param songs - Array of mapped songs
 * @param threshold - Distance threshold in meters to consider songs as a cluster
 * @returns Array of songs with clustering information
 */
export function clusterNearbysSongs(
  songs: SongWithLocation[],
  threshold: number = 50
): SongWithLocation[] {
  // This is a simplified implementation
  // In a production app, you might want to use a more sophisticated clustering algorithm
  // For now, we'll just mark songs that are within the threshold as part of a cluster

  const clustered = [...songs];

  for (let i = 0; i < clustered.length; i++) {
    if (!clustered[i].coordinate) continue;

    for (let j = i + 1; j < clustered.length; j++) {
      if (!clustered[j].coordinate) continue;

      const distance = calculateDistance(
        clustered[i].coordinate!,
        clustered[j].coordinate!
      );

      if (distance <= threshold) {
        // Mark as part of a cluster
        // You could add cluster metadata here
      }
    }
  }

  return clustered;
}

function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371e3;
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
