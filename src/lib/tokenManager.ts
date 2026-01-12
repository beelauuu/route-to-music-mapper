import { refreshSpotifyToken } from './spotify';
import { refreshStravaToken } from './strava';
import { query } from './db';

interface TokenRefreshResult {
  accessToken: string;
  expiresAt: Date;
}

/**
 * Checks if a token needs refresh and refreshes it if necessary
 * @param userId - User ID
 * @param provider - 'spotify' or 'strava'
 * @returns New access token and expiry
 */
export async function ensureValidToken(
  userId: number,
  provider: 'spotify' | 'strava'
): Promise<TokenRefreshResult | null> {
  try {
    // Get token from database
    const result = await query(
      'SELECT * FROM auth_tokens WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tokenData = result.rows[0];
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    // Check if token is expired or will expire in the next 5 minutes
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
      // Token is still valid
      return {
        accessToken: tokenData.access_token,
        expiresAt,
      };
    }

    // Token needs refresh
    if (!tokenData.refresh_token) {
      throw new Error(`No refresh token available for ${provider}`);
    }

    let newTokenData;

    if (provider === 'spotify') {
      newTokenData = await refreshSpotifyToken(tokenData.refresh_token);
    } else {
      newTokenData = await refreshStravaToken(tokenData.refresh_token);
    }

    // Calculate new expiry
    const newExpiresAt = new Date(now.getTime() + newTokenData.expires_in * 1000);

    // Update in database
    await query(
      `UPDATE auth_tokens
       SET access_token = $1, refresh_token = COALESCE($2, refresh_token),
           expires_at = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4 AND provider = $5`,
      [
        newTokenData.access_token,
        newTokenData.refresh_token,
        newExpiresAt,
        userId,
        provider,
      ]
    );

    return {
      accessToken: newTokenData.access_token,
      expiresAt: newExpiresAt,
    };
  } catch (error) {
    console.error(`Error refreshing ${provider} token:`, error);
    throw error;
  }
}

/**
 * Stores or updates auth tokens in the database
 * @param userId - User ID
 * @param provider - 'spotify' or 'strava'
 * @param accessToken - Access token
 * @param refreshToken - Refresh token (optional)
 * @param expiresIn - Expiry time in seconds
 */
export async function storeAuthTokens(
  userId: number,
  provider: 'spotify' | 'strava',
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await query(
    `INSERT INTO auth_tokens (user_id, provider, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET access_token = $3, refresh_token = COALESCE($4, auth_tokens.refresh_token),
                   expires_at = $5, updated_at = CURRENT_TIMESTAMP`,
    [userId, provider, accessToken, refreshToken, expiresAt]
  );
}

/**
 * Retrieves a valid token for a provider, refreshing if necessary
 * @param userId - User ID
 * @param provider - 'spotify' or 'strava'
 * @returns Access token
 */
export async function getValidToken(
  userId: number,
  provider: 'spotify' | 'strava'
): Promise<string> {
  const result = await ensureValidToken(userId, provider);

  if (!result) {
    throw new Error(`No ${provider} token found for user ${userId}`);
  }

  return result.accessToken;
}
