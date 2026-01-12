import { NextRequest, NextResponse } from 'next/server';
import { exchangeStravaCode } from '@/lib/strava';

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

    // Store tokens in cookie (temporary - should use session management)
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard`);

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
