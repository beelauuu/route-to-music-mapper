import { NextRequest, NextResponse } from 'next/server';
import { getStravaAuthUrl } from '@/lib/strava';

export async function GET(request: NextRequest) {
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/strava/callback`;
  const authUrl = getStravaAuthUrl(redirectUri);

  return NextResponse.redirect(authUrl);
}
