import { NextRequest, NextResponse } from 'next/server';
import { exchangeSpotifyCode } from '@/lib/spotify';
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

    // For now, store in session/cookie
    // In production, you'd want to associate with a user session
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard`);

    // Store tokens in cookie (temporary - should use session management)
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
