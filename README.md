# Route to Music Mapper

A web application that visualizes which songs you listened to during your Strava runs by mapping each song to a specific location along your route.

![Route to Music Mapper](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-cyan)

## Features

- **OAuth Authentication**: Secure authentication with both Spotify and Strava APIs
- **Interactive Maps**: Visualize your run routes with Mapbox GL JS showing exactly where each song played
- **Song Markers**: Click markers to see album art, track info, and direct Spotify links
- **Accurate Mapping**: Uses pace data from Strava splits for precise song-to-location interpolation
- **Database Storage**: Stores processed run data for quick access to past visualizations
- **Edge Case Handling**: Filters songs outside run timeframe, handles missing GPS data gracefully
- **Responsive Design**: Beautiful UI built with Tailwind CSS that works on all devices

## Tech Stack

- **Frontend**: React, Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL
- **APIs**: Spotify Web API, Strava API v3
- **Mapping**: Mapbox GL JS
- **Database**: PostgreSQL with pg client

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- PostgreSQL database (local or cloud-hosted)
- Spotify Developer Account
- Strava API Account
- Mapbox Account (for mapping)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd route-to-music-mapper
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Create a PostgreSQL database and run the schema:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE route_music_mapper;

# Connect to the database
\c route_music_mapper

# Run the schema
\i schema.sql
```

Alternatively, you can run:

```bash
psql -U postgres -d route_music_mapper -f schema.sql
```

### 4. API Configuration

#### Spotify API

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://localhost:3000/api/auth/spotify/callback`
4. Note your Client ID and Client Secret

#### Strava API

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new app
3. Set Authorization Callback Domain to: `localhost`
4. Note your Client ID and Client Secret

#### Mapbox

1. Sign up at [Mapbox](https://www.mapbox.com/)
2. Get your access token from your account dashboard

### 5. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32

# Spotify OAuth
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret

# Strava OAuth
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/route_music_mapper

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect Accounts**: Click "Connect Spotify" and "Connect Strava" on the landing page
2. **View Runs**: Navigate to the dashboard to see your recent running activities
3. **Map Music**: Click "Map Music" on any run to process it
4. **Explore**: View your route with song markers, click markers to see song details
5. **Share**: Copy the link to share your visualization with friends

## How It Works

### Song-to-Location Mapping Algorithm

1. **Fetch Data**: Retrieves Strava activity (start time, duration, polyline) and Spotify recently played tracks
2. **Calculate Percentage**: For each song, calculates `percentageComplete = (songTimestamp - runStartTime) / runDuration`
3. **Map to Coordinates**: Uses the percentage to find the corresponding point in the decoded polyline array
4. **Enhanced Accuracy**: Optionally uses splits data (pace information) for variable-pace runs
5. **Store Results**: Saves mapped data to PostgreSQL for quick future access

### Example

If a run started at 9:00 AM and lasted 30 minutes:
- Song played at 9:15 AM → 50% through run → Maps to coordinate at 50% of route distance
- Uses actual pace data if available for more accurate positioning

## Edge Cases Handled

- **Songs Outside Timeframe**: Filters out songs played before/after the run
- **No Songs During Run**: Shows friendly message instead of empty map
- **Missing GPS Data**: Detects and warns users about activities without polyline data
- **Multiple Songs at Same Location**: Visual clustering in markers (can be enhanced)
- **Token Expiration**: Automatic token refresh for both Spotify and Strava

## Project Structure

```
route-to-music-mapper/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   │   ├── auth/         # OAuth callbacks
│   │   │   ├── activities/   # Strava activities
│   │   │   ├── songs/        # Spotify tracks
│   │   │   └── runs/         # Processed runs
│   │   ├── dashboard/        # Dashboard page
│   │   ├── run/[runId]/      # Individual run visualization
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Landing page
│   │   └── globals.css       # Global styles
│   ├── components/            # React components
│   │   └── RunMap.tsx        # Map visualization component
│   ├── lib/                   # Library code
│   │   ├── db.ts             # Database connection
│   │   ├── spotify.ts        # Spotify API client
│   │   ├── strava.ts         # Strava API client
│   │   └── tokenManager.ts   # Token refresh logic
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   └── utils/                 # Utility functions
│       ├── polyline.ts       # Polyline encoding/decoding
│       └── songMapper.ts     # Song-to-location mapping
├── schema.sql                 # Database schema
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## API Routes

- `GET /api/auth/spotify` - Initiates Spotify OAuth
- `GET /api/auth/spotify/callback` - Spotify OAuth callback
- `GET /api/auth/strava` - Initiates Strava OAuth
- `GET /api/auth/strava/callback` - Strava OAuth callback
- `GET /api/activities` - Fetches user's Strava activities
- `GET /api/activities/[activityId]` - Fetches specific activity
- `GET /api/songs/recently-played` - Fetches Spotify recently played
- `POST /api/process-run` - Processes a run and maps songs
- `GET /api/runs/[runId]` - Retrieves processed run data

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Update redirect URIs in Spotify/Strava to use your production URL
5. Deploy

### Database

For production, use a hosted PostgreSQL service:
- [Vercel Postgres](https://vercel.com/storage/postgres)
- [Supabase](https://supabase.com/)
- [Neon](https://neon.tech/)
- [Railway](https://railway.app/)

## Optional Enhancements

The following features can be added:

- **Stats Panel**: Show insights like average tempo vs pace correlation
- **Timeline View**: Display pace graph alongside song timeline
- **Social Sharing**: Generate shareable images for social media
- **Strava Webhooks**: Auto-process new runs as they're uploaded
- **Public Profiles**: Allow athletes to share their profile page
- **Playlist Export**: Create Spotify playlists from run songs
- **Multiple Activities**: Compare songs across different runs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Strava API](https://developers.strava.com/)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ for runners who love music
