import { NextRequest, NextResponse } from 'next/server';
import { exchangeStravaCode } from '@/lib/strava';
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
    const tokenData = await exchangeStravaCode(code);

    // Strava returns athlete info in the token response
    const athlete = tokenData.athlete;
    const athleteEmail = `strava_${athlete.id}@strava.local`; // Strava doesn't provide email
    const athleteName = `${athlete.firstname} ${athlete.lastname}`.trim();

    // Create or get user in database
    let userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [athleteEmail]
    );

    let userId: number;

    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await query(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
        [athleteEmail, athleteName]
      );
      userId = newUserResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    // Store tokens in database
    const expiresAt = new Date(tokenData.expires_at * 1000); // Strava provides expires_at as unix timestamp
    await query(
      `INSERT INTO auth_tokens (user_id, provider, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, provider)
       DO UPDATE SET access_token = $3, refresh_token = $4,
                     expires_at = $5, updated_at = CURRENT_TIMESTAMP`,
      [userId, 'strava', tokenData.access_token, tokenData.refresh_token, expiresAt]
    );

    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard`);

    // Store user_id and tokens in cookies
    response.cookies.set('user_id', userId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    response.cookies.set('strava_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
    });

    response.cookies.set('strava_refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return response;
  } catch (error) {
    console.error('Error exchanging Strava code:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/?error=strava_auth_failed`
    );
  }
}
