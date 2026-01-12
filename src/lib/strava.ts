import axios from 'axios';
import { StravaActivity, StravaAthlete } from '@/types';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_AUTH_BASE = 'https://www.strava.com/oauth';

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: StravaAthlete;
}

/**
 * Get Strava authorization URL
 */
export function getStravaAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'auto',
    scope: 'read,activity:read_all,activity:write',
  });

  return `${STRAVA_AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const response = await axios.post<StravaTokenResponse>(
    `${STRAVA_AUTH_BASE}/token`,
    {
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
    }
  );

  return response.data;
}

/**
 * Refresh Strava access token
 */
export async function refreshStravaToken(
  refreshToken: string
): Promise<StravaTokenResponse> {
  const response = await axios.post<StravaTokenResponse>(
    `${STRAVA_AUTH_BASE}/token`,
    {
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }
  );

  return response.data;
}

/**
 * Get logged-in athlete's activities
 */
export async function getActivities(
  accessToken: string,
  page: number = 1,
  perPage: number = 30
): Promise<StravaActivity[]> {
  const response = await axios.get<StravaActivity[]>(
    `${STRAVA_API_BASE}/athlete/activities`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        page,
        per_page: perPage,
      },
    }
  );

  return response.data;
}

/**
 * Get a specific activity by ID
 */
export async function getActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const response = await axios.get<StravaActivity>(
    `${STRAVA_API_BASE}/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data;
}

/**
 * Update activity description
 */
export async function updateActivity(
  accessToken: string,
  activityId: number,
  description: string
): Promise<StravaActivity> {
  const response = await axios.put<StravaActivity>(
    `${STRAVA_API_BASE}/activities/${activityId}`,
    {
      description,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data;
}

/**
 * Get current athlete
 */
export async function getCurrentAthlete(accessToken: string): Promise<StravaAthlete> {
  const response = await axios.get<StravaAthlete>(`${STRAVA_API_BASE}/athlete`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
