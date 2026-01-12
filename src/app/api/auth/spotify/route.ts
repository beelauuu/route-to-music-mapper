import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/spotify/callback`;
  const authUrl = getSpotifyAuthUrl(redirectUri);

  return NextResponse.redirect(authUrl);
}
