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

// ==================== Webhook Management ====================

export interface StravaWebhookSubscription {
  id: number;
  resource_state: number;
  application_id: number;
  callback_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new webhook subscription
 * Requires application-level credentials (client_id and client_secret)
 */
export async function createWebhookSubscription(
  callbackUrl: string,
  verifyToken: string
): Promise<StravaWebhookSubscription> {
  const response = await axios.post<StravaWebhookSubscription>(
    `${STRAVA_API_BASE}/push_subscriptions`,
    {
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    }
  );

  return response.data;
}

/**
 * List all webhook subscriptions for this application
 */
export async function listWebhookSubscriptions(): Promise<StravaWebhookSubscription[]> {
  const response = await axios.get<StravaWebhookSubscription[]>(
    `${STRAVA_API_BASE}/push_subscriptions`,
    {
      params: {
        client_id: process.env.STRAVA_CLIENT_ID!,
        client_secret: process.env.STRAVA_CLIENT_SECRET!,
      },
    }
  );

  return response.data;
}

/**
 * Delete a webhook subscription
 */
export async function deleteWebhookSubscription(subscriptionId: number): Promise<void> {
  await axios.delete(
    `${STRAVA_API_BASE}/push_subscriptions/${subscriptionId}`,
    {
      params: {
        client_id: process.env.STRAVA_CLIENT_ID!,
        client_secret: process.env.STRAVA_CLIENT_SECRET!,
      },
    }
  );
}

/**
 * Verify webhook event signature
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  // Strava uses HMAC-SHA256 with client_secret
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', process.env.STRAVA_CLIENT_SECRET!);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');

  return calculatedSignature === signature;
}
