# Validation — 4 November 2026

## Security audit update
- See SECURITY_AUDIT.md for the current dependency audit, threat boundaries and fixes; it supersedes the older dependency-audit counts below.
- 22 unit, 8 backend and 11 browser end-to-end tests pass. Typecheck/lint, Expo checks, package signatures and all-platform JavaScript exports pass. Both real Audius and official YouTube playback still work in the browser after hardening.
- Runtime npm advisories: 0. Audited Python runtime advisories: 0. Bandit server findings: 0. Full npm audit retains 13 development-tool alerts with the documented upstream affected-range discrepancy.

## In-app YouTube player
- Fifteen unit tests pass, including URL/ID parsing, malformed/lookalike-host rejection, app identity/native HTML settings and provider-error mapping.
- Two new browser tests pass for invalid links, visible 200px-minimum player layout, control/autoplay configuration, destroy-on-close, blocked-embed errors and retry cleanup. These UI tests mock the YouTube API boundary.
- A separate live browser test loaded the actual official player and played its documented sample video (`M7lc1UVf-VE`). The media element was unpaused, duration 1,343.661 seconds and time 3.690 seconds; no runtime errors were reported. Actual playback required an explicit click within the visible embedded player.
- Typecheck, lint, 20/20 Expo checks and web/Android/iOS bundle exports pass. The native WebView dependency requires a new development build. Native device playback, foreground transitions and HTTP Referer behavior remain unverified.
- Inline YouTube search/automatic matching, hidden/background YouTube audio and download/mixer access are not implemented. Uploader/account/region restrictions remain controlled by YouTube.

## YouTube Music search fallback
- Typecheck, lint and two targeted browser tests pass.
- Verified missing-song and provider-failure states expose the fallback. Verified the outgoing HTTPS search URL preserves spaces, ampersands, hash characters and Hindi text, and active VibeCut audio pauses before opening it.
- The tests capture the outgoing link; they do not claim YouTube Music result availability or playback. Native app-link handling remains a device check.

## Free music catalog update
- Eleven unit tests pass, including four new catalog tests for canonical full-track URLs, artist attribution, gated/restricted track filtering, search encoding/cache, and provider failures.
- Five browser end-to-end tests pass. The new flows cover streaming a 63-second test source, queue switching, favorites and library restoration, catalog search, excluding streams from the editor, and retry recovery. The original local-file editing/export checks still pass.
- Live network test: Audius trending and search return successfully without credentials; a real stream responds with HTTP 206 and audio/mpeg. Browser playback loaded a 156.205-second recording, progressed past one second with readyState 4, and reported no JavaScript runtime errors.
- Typecheck, lint and Android/iOS/web JavaScript bundle exports pass. Physical-device validation remains pending.
- Reproduce the live check with `node tests/live-catalog.mjs` while the preview server is running.

## Passed
- TypeScript check and ESLint.
- Seven core tests: clip bounds, beat snapping, source trims/seek schedule, split continuity, fades, WAV headers/interleaving/clipping, measured waveforms and synthetic 120 BPM analysis.
- Four metadata-server tests: authentication, absent configuration/validation, all three result types and cache, provider errors/timeouts.
- Three browser end-to-end tests:
  - Import two generated stereo tones, play/pause/next, create a playlist, add a track, reload library, search locally, create a project, trim/position/fade/mute/change gain, preview, export and reopen the saved project.
  - Read the actual exported WAV and compare samples against expected trimmed source audio, delayed second clip, fade and half-volume gain. Duration agrees within 1 ms and PCM sample error within 0.001 amplitude.
  - Catalog search success and provider failure (mocked responses), plus rejection of malformed audio without a broken library entry.
- Expo project checks: 20/20.
- Android native project generation and playback-service configuration, without compilation.
- Production JavaScript bundle exports for Android, iOS and web, including the final duration preflight.

## Device checks still required
- Compile/install the native app; run on the owner's phone.
- Import WAV, MP3, M4A, AAC; restart offline and verify file access and playlists.
- Test screen-off/background playback, headset unplug, calls/audio focus, lock-screen seeking, Bluetooth behavior and resuming.
- Verify studio handoff keeps the main player paused and disables its lock-screen session while editing.
- Drag/trim/split/zoom with touch, exercise undo/redo, export/share and listen to the result.
- Record and measure three-minute dual-source drift (<10 ms target).
- Measure startup, four-lane scrolling, maximum-length import/render memory and export time on a mid-range phone.
- Repeat relevant checks on iOS; native iOS builds require macOS.
- Configure a real Last.fm API key and verify live track/artist/album searches through private HTTPS.

## Dependency audit
`npm audit --omit=dev` reports five moderate findings in Expo's build tooling dependency chain (`glob`/`minimatch`); no high/critical findings. npm proposes an incompatible Expo downgrade. Kept the compatible SDK rather than applying that downgrade. The development-inclusive audit reports eighteen moderate findings. Reassess when compatible upstream fixes become available.

These checks do not establish daily-driver reliability, native timing targets or completion of every roadmap milestone.
