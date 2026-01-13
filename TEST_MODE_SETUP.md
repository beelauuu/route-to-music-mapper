# Quick Test Mode Setup

Test the Route to Music Mapper without setting up a database! This mode uses mock Spotify data with your real Strava runs.

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

### 3. Add Only Strava Credentials

You only need Strava API credentials for test mode. Edit `.env`:

```env
# Strava OAuth (REQUIRED)
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret

# These can be dummy values for test mode
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=test-secret-key-123
SPOTIFY_CLIENT_ID=dummy
SPOTIFY_CLIENT_SECRET=dummy
DATABASE_URL=postgresql://dummy
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

### 4. Get Strava API Credentials

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new app with these settings:
   - **Application Name**: Route to Music Mapper Test
   - **Category**: Visualizer
   - **Website**: `http://localhost:3000`
   - **Authorization Callback Domain**: `localhost`
3. Copy your **Client ID** and **Client Secret** to `.env`

### 5. Get Mapbox Token (Optional but Recommended)

1. Sign up at [Mapbox](https://www.mapbox.com/)
2. Copy your default public access token
3. Add to `.env` as `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

*Note: Without Mapbox token, the map won't display. You can still test the song mapping logic.*

### 6. Run the App

```bash
npm run dev
```

### 7. Test It Out

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **"🧪 Try Test Mode"** button
3. Click **"Connect Strava"**
4. Authorize with your Strava account
5. You'll see your real Strava runs
6. Click **"🧪 Test Map"** on any run
7. See your run mapped with mock songs!

## ✨ What Test Mode Does

### Real Data
- ✅ Your actual Strava runs
- ✅ Real GPS polyline data
- ✅ Real distance, duration, and pace information

### Mock Data
- 🎵 Generated playlist of ~12 popular workout songs
- 🎵 Songs distributed across your run duration
- 🎵 Timestamps calculated to match when songs would play

### No Database Required
- 💾 All data stored in browser localStorage
- 💾 No PostgreSQL setup needed
- 💾 No Spotify OAuth needed

## 📱 What You'll See

1. **Test Dashboard**: List of your Strava runs with a "🧪 Test Map" button
2. **Interactive Map**: Your run route with song markers
3. **Song Markers**: Click to see album art, track info, and Spotify links
4. **Playlist Panel**: All songs that "played" during your run

## 🎯 Testing the Core Algorithm

Test mode validates:
- ✅ Polyline decoding (Strava format → lat/lng coordinates)
- ✅ Song-to-location mapping algorithm
- ✅ Percentage calculation: `(songTime - runStart) / runDuration`
- ✅ Coordinate interpolation along the route
- ✅ Map visualization with markers
- ✅ UI/UX flow

## 🔄 Switching to Production Mode

When you're ready to use real Spotify data:

1. Set up PostgreSQL database (see main README.md)
2. Add real Spotify API credentials to `.env`
3. Run database migrations: `psql -d route_music_mapper -f schema.sql`
4. Use the regular dashboard at `/dashboard` instead of `/test`

## 🐛 Troubleshooting

### 404 Errors in Console / Map Not Loading
This is the most common issue! If you see 404 errors in the browser console, it's likely because:

**Solution:**
1. Sign up at [mapbox.com](https://www.mapbox.com) (free tier is fine)
2. Copy your default public access token from the dashboard
3. Add to `.env`: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-token-here`
4. **Restart the dev server** (important!)
5. Refresh the page

Without a Mapbox token, you'll see a gray box with error message instead of the map. The song mapping still works, you just won't see the visual display.

### "Not authenticated with Strava"
- Make sure you've added valid Strava credentials to `.env`
- Restart the dev server after updating `.env`
- Try the Connect Strava button again

### "No activities found"
- Make sure your Strava account has running activities
- Check that you authorized the app with "read" permissions

### Songs not appearing
- This is normal - test mode generates mock songs automatically
- Check that the run has a duration > 0

### Map shows error even with token
- Double-check your token starts with `pk.` (public token)
- Make sure the variable name is exactly `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- Verify no extra spaces or quotes in the `.env` file
- Restart the dev server after any `.env` changes

## 📊 Sample Test Run

Example output for a 30-minute run:
- **Distance**: 5.2 km
- **Duration**: 30:15
- **Mock Songs Generated**: 8 songs
- **Songs Mapped**: 8 markers on the route
- **Percentage Distribution**: Songs at 0%, 12%, 25%, 37%, 50%, 62%, 75%, 87% through the run

## 💡 Tips

- Use a run with GPS data (outdoor runs work best)
- Longer runs will show more songs mapped along the route
- Click on song markers to see the full popup with album art
- Try different runs to see how the algorithm handles various distances and durations

## 🎓 Learning from Test Mode

Test mode demonstrates:
1. How polyline encoding works (compressed GPS data)
2. Time-based interpolation for mapping events to locations
3. How pace data can improve accuracy (splits_metric)
4. Edge cases (songs outside run timeframe are filtered)
5. Visual representation of temporal-spatial mapping

---

**Ready to test?** Run `npm run dev` and go to [http://localhost:3000](http://localhost:3000) → Click "🧪 Try Test Mode"
