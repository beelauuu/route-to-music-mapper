import axios from 'axios';
import { SpotifyRecentlyPlayedResponse } from '@/types';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

/**
 * Get Spotify authorization URL
 */
export function getSpotifyAuthUrl(redirectUri: string): string {
  const scopes = [
    'user-read-recently-played',
    'user-read-playback-state',
    'user-read-currently-playing',
  ];

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    show_dialog: 'true',
  });

  return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeSpotifyCode(
  code: string,
  redirectUri: string
): Promise<SpotifyTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await axios.post<SpotifyTokenResponse>(
    `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
    params,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
    }
  );

  return response.data;
}

/**
 * Refresh Spotify access token
 */
export async function refreshSpotifyToken(
  refreshToken: string
): Promise<SpotifyTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await axios.post<SpotifyTokenResponse>(
    `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
    params,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
    }
  );

  return response.data;
}

/**
 * Get recently played tracks from Spotify
 */
export async function getRecentlyPlayed(
  accessToken: string,
  limit: number = 50,
  after?: number,
  before?: number
): Promise<SpotifyRecentlyPlayedResponse> {
  const params: any = { limit };
  if (after) params.after = after;
  if (before) params.before = before;

  const response = await axios.get<SpotifyRecentlyPlayedResponse>(
    `${SPOTIFY_API_BASE}/me/player/recently-played`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    }
  );

  return response.data;
}

/**
 * Get current user's Spotify profile
 */
export async function getCurrentUser(accessToken: string) {
  const response = await axios.get(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
