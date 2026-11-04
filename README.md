# VibeCut

A dark-themed music player and manual mashup editor built with Expo, React Native and TypeScript. Listen to free independent music, organize your library, watch YouTube videos through the official player, and create mixes from your own authorized audio files.

**Status: working prototype.** Browser playback and automated tests have been verified. Native Android/iOS builds, physical-device behavior and production deployment still need validation. This is not a Spotify catalog mirror or a full professional audio workstation.

## At a glance

| Feature | Current behavior |
| --- | --- |
| Discovery | Free, public, non-gated Audius tracks; no account or API key required |
| Player | Play/pause, seek, queue, shuffle/repeat, favorites and playlists |
| Local music | Import supported files, listen offline and retain originals |
| Studio | Four lanes, trim/move/split, gain/mute/fades, manual tempo grid, undo/redo |
| Export | Stereo 44.1 kHz, 16-bit WAV from authorized local audio |
| YouTube | Visible official embedded player for a pasted video link |
| Optional metadata | Private authenticated Last.fm proxy; credentials stay server-side |
| Storage | Local metadata and app-private files; IndexedDB for browser audio |

## Important cautions

- **Music rights:** use files you own or have permission to edit. Audius streaming permission does not imply remix/download rights. Online tracks and YouTube videos are excluded from the mixer.
- **YouTube limits:** videos can be blocked by their uploader, region or account requirements. No automatic matching, extracted audio, ad removal, hidden playback or YouTube downloads are provided.
- **Your data:** browser storage is tied to the site origin. Clearing browser data, switching domains or uninstalling can remove the library. There is no cloud sync or backup/restore; keep your original audio and exported mixes.
- **Secrets:** never commit API credentials or signing keys. Every `EXPO_PUBLIC_` value is public. Keep the optional server private and configure HTTPS, a strong token, allowed hosts and origins.
- **Security status:** runtime dependency scans are clean as of the documented audit, but 13 development-tool alerts remain with an upstream advisory-range discrepancy. Read [SECURITY.md](SECURITY.md) and [the audit](SECURITY_AUDIT.md) before deployment.
- **Mobile readiness:** background playback, interruptions, performance, memory use and native security behavior require physical-device tests. JavaScript exports are not installable APK/IPA builds.

## Quick start — browser

Requires Node.js 22 or newer and npm. The Netlify configuration uses Node 24.

```sh
git clone https://github.com/SHREYASJHA148/VibeCut.git
cd VibeCut/mobile
npm ci
npm run web
```

The default preview binds to localhost. Audius discovery and link-based YouTube playback work without the optional metadata server. Third-party services still require an internet connection and may be unavailable or change their access rules.

## Deploy the web version on Netlify

The root [netlify.toml](netlify.toml) configures this project as a static web app:

| Setting | Value |
| --- | --- |
| Base directory | `mobile` |
| Build command | `npx expo export --platform web --output-dir dist` |
| Publish directory | `dist` relative to `mobile` |
| Node version | `24` |

Connect this GitHub repository to Netlify and use the checked-in configuration. To produce the same export locally, run the build command from `mobile`. Deploy the resulting `mobile/dist` contents, not the source folder.

Netlify hosts the **web version only**. It does not build/install the mobile apps or run this project's Python server. Deploy the optional metadata server separately, then set its HTTPS URL and token in Settings. `EXPO_PUBLIC_API_URL` may hold its public base URL; API secrets must never be included in the web build. Netlify's static web export is supported by the configuration; an actual Netlify deployment has not been verified.

The configured referrer policy preserves the origin required by YouTube embeds. Avoid replacing it with `no-referrer` or setting a permissions/content policy that blocks required player resources without testing playback.

## Repository layout

```text
mobile/                 Expo application, browser preview and tests
server/                 Optional private Last.fm metadata proxy
tools/security_scan.py  Local redacted credential-pattern scan
netlify.toml            Static web build configuration
SECURITY.md             Reporting guidance and deployment precautions
SECURITY_AUDIT.md       Audit findings, fixes and limitations
VALIDATION.md           Test evidence and remaining device checks
PROGRESS.md             Development status
VibeCut_*.md            Original product/technical planning documents
```

The original planning documents describe broader future functionality. This README describes what is implemented today; historical extraction proposals are not part of the current app.

## Free full-length music

Home automatically shows trending free Audius tracks. Search → Tracks finds more playable music by title, artist or genre. No backend, API key or login is needed for this catalog. Tap a song to stream, use the heart to save it, and manage its queue/playlists in the existing player and Library.

Only public, available, API-streamable, non-gated tracks are shown. Streams use Audius's canonical endpoint rather than persisting temporary signed URLs. Artist names, artwork and a source link are included. Loading errors have retry controls, and results are paged. Playback availability still depends on Audius and its artist-hosted servers. Catalog tracks require internet; saved links are not offline downloads.

Streaming permission does not imply remix permission. Audius tracks are excluded from the mashup picker and rejected by the mixing engine. Use authorized imported files for editing/export. No Spotify integration or paid/gated access bypass is included.

Provider documentation: [Audius API](https://docs.audius.co/api/), [artist streaming and license controls](https://help.audius.co/product/editing-your-release).

### YouTube Music fallback

Search → Tracks offers **Search YouTube Music** after Audius finishes searching, including when it finds no tracks or its service fails. This opens the same query in the YouTube Music app or website. It is also available with results when the exact song/version is missing. VibeCut pauses playback and releases its lock-screen session before opening the link.

The search button is an external handoff. To play a selected video inside VibeCut, use **Search → Play a YouTube link**, paste its YouTube/YouTube Music/share link, and tap **Load YouTube video**. The official visible YouTube player has its own play/pause and fullscreen controls. No API key is required for link playback. Automatic YouTube catalog search/matching is not implemented.

Closing the modal or leaving the app unmounts the embedded player. Audius/local playback is paused before opening it. The video stays visible above the scrolling form, with at least a 200px viewport and original controls. Native WebView embeds identify the installed app using its configured package/bundle ID as the HTTPS base URL, as described in YouTube's requirements. Uploader restrictions, removed/private videos and player identity/network failures are surfaced.

YouTube results do not enter VibeCut's queue, offline library or mashup editor. Availability and account requirements are handled by YouTube. This does not extract or download audio, remove ads or implement hidden/background YouTube playback. The new native WebView dependency requires rebuilding the mobile development app. Actual native-device playback remains unverified.

## Run on Android or iOS

From the cloned repository root:

Requires Node 22+, npm and an Android development environment (JDK 17 and Android SDK). iOS builds require macOS and Xcode.

```powershell
cd mobile
npm ci
npm run android
```

After installing the development build, use `npm start`. This app uses a native mixing library and **requires a development build; Expo Go is insufficient**. An internal APK can also be built with `npx eas-cli build --platform android --profile preview` after configuring your own Expo account. No cloud build has been submitted.

For a browser preview: `npm run web`. Browser audio uses Web Audio; files persist in IndexedDB. The browser preview is a testing aid; the primary product is the mobile app.

## Use

1. Import audio from Library. Files are copied to private app storage; originals are kept. Common supported formats are WAV, MP3, AAC and M4A, depending on the device. Imports are limited to 40 MB and five minutes per file, twelve files per batch. Titles are derived from filenames (`Artist - Title`); edit them through track options. Embedded tags/artwork are not parsed yet.
2. Play tracks, save favorites, arrange the queue and create/edit playlists. Library data and playback position are stored locally. The player restores paused after restarting.
3. Open Studio, create a project and add up to four source tracks. Drag clip bodies to move and pink handles to trim. Use precise time fields for accessible editing. Up to sixteen clips share four lanes and a five-minute timeline.
4. Set volume, mute, fades and project tempo; enable beat snapping, zoom, split at the playhead and undo/redo edits. Detected BPM is an estimate. Changing project tempo changes the grid, not audio speed. Projects save automatically.
5. Preview the mix and export a stereo, 44.1 kHz, 16-bit WAV through the share sheet. Preview and offline rendering share the same scheduling and envelope code. Fixed headroom of `1 / clip count` avoids clipping. There is no normalization or limiter. Studio preview pauses in the background; region loops have a small restart gap.

The main player configures background playback and lock-screen controls through Expo Audio. Device behavior (interruptions, headset unplug, remote controls and app lifecycle) still needs physical-device validation. Lock-screen seeking is implemented; remote queue skipping is not implemented.

## Optional online metadata

Local playback, editing and export require no backend or API key. Online search uses an authenticated Last.fm proxy; catalog entries are metadata only and have no streaming playback source.

From the repository root, using PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r server\requirements.txt
$env:VIBECUT_TOKEN = python -c "import secrets; print(secrets.token_urlsafe(32))"
$env:LASTFM_API_KEY = 'your-own-lastfm-api-key'
.\.venv\Scripts\python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

Serve it privately over HTTPS (for example with Tailscale Serve). Set `VIBECUT_ALLOWED_HOSTS` to your actual private server hostname (comma-separated if necessary), and `VIBECUT_WEB_ORIGIN` to your browser app's exact origin. Defaults permit localhost. Enter the HTTPS address and access token in app Settings. Native tokens use device-only, unlocked SecureStore accessibility; the browser preview keeps its token only in memory. Environment templates are provided in `server/.env.example` and `mobile/.env.example`; the server reads environment variables, not `.env` files automatically. The server rejects missing, short and example tokens. The Last.fm API key stays on the server. Search has debounce, cancellation, timeout/error states and a bounded fifteen-minute server cache.

The private metadata proxy disables API documentation routes, checks Host, rejects redirects to the upstream provider, bounds response size and total request time, adds no-store/security headers, and limits authentication requests (60/minute per client) and uncached upstream searches (30/minute per server process, four concurrent). Multi-worker/public deployment needs corresponding reverse-proxy limits. Development preview scripts bind to localhost; use `--lan` explicitly only on a trusted network when testing a phone.

## Validation

From the repository root:

```powershell
cd mobile
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx playwright install chromium
npx playwright test
npx expo export --platform android --output-dir dist-android
cd ..
python -m unittest server.test_main -v
```

Tests cover clip bounds, trim/seek scheduling, beat snapping, splits, fades, PCM WAV encoding, waveform/BPM analysis, metadata authentication/caching/errors and an end-to-end import/player/library/editor/export flow. The export test compares the actual WAV samples against expected source offsets, delays, fades and gain. Synthetic test tones are generated in tests; no demo songs are presented as a real catalog.

## Outstanding device gates and scope

- A successful JavaScript bundle is not a native APK build. This machine has no Android SDK/adb or attached phone. Native build/run, cold-start time, 60 fps, memory on long four-track projects, lock-screen behavior and measured three-minute drift remain unverified.
- No metadata API credentials were supplied; live Last.fm requests remain unverified. Automated tests mock provider responses and exercise success/failure.
- No extraction, offline catalog downloads, source matching, gapless/crossfade, stems, pitch/tempo matching, key detection, backup/restore or embedded tag/artwork parsing is implemented. Free online playback uses Audius.
- Project/library metadata uses AsyncStorage rather than SQLite/Drizzle for this small local-first implementation. Audio uses app-private files. No cloud sync or analytics.
- Removing a track used by a project is blocked until its clips are removed. Deleting playlists/projects is immediate; removing imported audio requires confirmation.


## Licensing and attribution

Music, artwork, YouTube content and third-party packages retain their respective owners' rights and terms. Source availability does not grant rights to redistribute media. [The Expo scaffold license](mobile/LICENSE) is retained with the scaffold. A separate project-wide source license has not been selected; do not assume it grants additional rights to all project code.

Provider references: [Audius API](https://docs.audius.co/api/), [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [Expo web publishing](https://docs.expo.dev/guides/publishing-websites/).
