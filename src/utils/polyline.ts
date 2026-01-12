import polyline from 'polyline';
import { Coordinate } from '@/types';

/**
 * Decodes an encoded polyline string into an array of coordinates
 * @param encoded - Encoded polyline string from Strava
 * @returns Array of {lat, lng} coordinates
 */
export function decodePolyline(encoded: string): Coordinate[] {
  try {
    const decoded = polyline.decode(encoded);
    return decoded.map(([lat, lng]) => ({ lat, lng }));
  } catch (error) {
    console.error('Error decoding polyline:', error);
    return [];
  }
}

/**
 * Encodes an array of coordinates into a polyline string
 * @param coordinates - Array of {lat, lng} coordinates
 * @returns Encoded polyline string
 */
export function encodePolyline(coordinates: Coordinate[]): string {
  try {
    const points: [number, number][] = coordinates.map(coord => [coord.lat, coord.lng]);
    return polyline.encode(points);
  } catch (error) {
    console.error('Error encoding polyline:', error);
    return '';
  }
}

/**
 * Calculates the distance between two coordinates using Haversine formula
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371e3; // Earth's radius in meters
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

/**
 * Gets the coordinate at a specific percentage along the route
 * @param coordinates - Array of route coordinates
 * @param percentage - Percentage complete (0.0 to 1.0)
 * @returns Coordinate at that percentage
 */
export function getCoordinateAtPercentage(
  coordinates: Coordinate[],
  percentage: number
): { coordinate: Coordinate; index: number } | null {
  if (coordinates.length === 0 || percentage < 0 || percentage > 1) {
    return null;
  }

  // Calculate total distance
  let totalDistance = 0;
  const distances: number[] = [0];

  for (let i = 1; i < coordinates.length; i++) {
    const segmentDistance = calculateDistance(coordinates[i - 1], coordinates[i]);
    totalDistance += segmentDistance;
    distances.push(totalDistance);
  }

  // Find the target distance
  const targetDistance = totalDistance * percentage;

  // Find the segment containing the target distance
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDistance) {
      // Return the coordinate at this index
      return {
        coordinate: coordinates[i],
        index: i,
      };
    }
  }

  // If we've gone past the end, return the last coordinate
  return {
    coordinate: coordinates[coordinates.length - 1],
    index: coordinates.length - 1,
  };
}
