import { NextRequest, NextResponse } from 'next/server';
import { exchangeSpotifyCode, getCurrentUser } from '@/lib/spotify';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=no_code`
    );
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/spotify/callback`;
    const tokenData = await exchangeSpotifyCode(code, redirectUri);

    // Get Spotify user info
    const spotifyUser = await getCurrentUser(tokenData.access_token);

    // Create or get user in database
    let userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [spotifyUser.email]
    );

    let userId: number;

    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await query(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
        [spotifyUser.email, spotifyUser.display_name]
      );
      userId = newUserResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    // Store tokens in database
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await query(
      `INSERT INTO auth_tokens (user_id, provider, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, provider)
       DO UPDATE SET access_token = $3, refresh_token = COALESCE($4, auth_tokens.refresh_token),
                     expires_at = $5, updated_at = CURRENT_TIMESTAMP`,
      [userId, 'spotify', tokenData.access_token, tokenData.refresh_token, expiresAt]
    );

    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard`);

    // Store user_id and tokens in cookies
    response.cookies.set('user_id', userId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    response.cookies.set('spotify_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
    });

    if (tokenData.refresh_token) {
      response.cookies.set('spotify_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return response;
  } catch (error) {
    console.error('Error exchanging Spotify code:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=spotify_auth_failed`
    );
  }
}
