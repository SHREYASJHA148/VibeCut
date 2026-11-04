# VibeCut: Technical Requirements Document (TRD)

**Status:** Draft v1
**Companion documents:** `VibeCut_PRD.md`, `VibeCut_Implementation_Plan.md`

Items marked **(verify)** depend on third-party policies or APIs that change often; re-check them before committing.

---

## 1. Architecture Overview

```
[ React Native app ]  <-- HTTPS over Tailscale -->  [ VibeCut backend (FastAPI) ]
   UI, player, local DB,                              |- Metadata proxy + cache
   mashup preview                                     |- Source resolver (match + yt-dlp)
                                                      |- Audio cache (files + range serving)
                                                      |- Analysis worker (BPM, beats, peaks)
                                                      |- Render worker (FFmpeg export)
                                                      '- (v2) Stem worker (Demucs)
```

**Principle:** the phone plays and edits; the server resolves, downloads, analyzes, and renders. Anything flaky or heavy lives server-side, where it can be fixed without shipping an app release.

---

## 2. Client Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | React Native + Expo (development build / prebuild), TypeScript | Native modules required; Expo Go is not sufficient |
| Navigation | Expo Router | Tabs: Home, Search, Library, Mashups |
| State | Zustand (UI/player state), TanStack Query (server data) | |
| Local DB | `expo-sqlite` with Drizzle ORM | Library, playlists, mappings, projects |
| Key-value | MMKV | Settings, small caches |
| Main player | `react-native-track-player` | Background playback, lock screen, queue |
| Mashup audio engine | `react-native-audio-api` or a custom native module (AVAudioEngine / Oboe) | Validate in the first-phase spike |
| Timeline rendering | React Native Skia + Gesture Handler + Reanimated | Waveforms drawn from precomputed peaks |
| Theming | Token file + small themed component layer | See PRD section 8 |
| Files and sharing | `expo-sharing`, `expo-file-system`, `expo-document-picker` | |

---

## 3. Backend Stack

- **Runtime:** Python 3.12, FastAPI, Uvicorn, SQLite (Postgres only if it outgrows SQLite).
- **Extraction:** `yt-dlp` (pinned, with an automated update-and-test job), `ytmusicapi` for search and matching, FFmpeg for transcoding.
- **Analysis:** Essentia or librosa for BPM, beat grid, and key; `audiowaveform` or a numpy script for waveform peak data.
- **Rendering:** FFmpeg filtergraph generated from the mashup project JSON.
- **Jobs:** a simple queue (RQ or an asyncio worker); Celery is unnecessary.
- **Hosting:** a home mini PC or spare machine reachable through **Tailscale**. This avoids public exposure and avoids datacenter-IP blocking. A VPS is a fallback, but extraction from datacenter IPs is often blocked **(verify with the extraction spike)**.
- **Authentication:** Tailscale network membership plus a static bearer token. Spotify credentials stay server-side.

---

## 4. Provider Interfaces

All external dependencies are hidden behind two interfaces so each can be replaced independently.

```ts
interface MetadataProvider {
  search(q: string, types: ('track' | 'album' | 'artist')[]): Promise<SearchResults>;
  getAlbum(id: string): Promise<Album>;
  getArtist(id: string): Promise<Artist>;
}

interface SourceProvider {
  // Returns ranked candidates for a metadata track
  findCandidates(track: TrackMeta): Promise<SourceCandidate[]>;
  // Downloads and stores audio, returns a cache entry
  fetch(candidate: SourceCandidate): Promise<CachedAudio>;
}
```

**Implementations**
- `MetadataProvider`: `SpotifyMetadata` (client-credentials flow, search and artwork only, no user login), `DeezerMetadata`, `MusicBrainzMetadata` (with Cover Art Archive), optionally iTunes Search.
- `SourceProvider`: `YouTubeSource`, `LocalFileSource`.

**Notes**
- Spotify has restricted several endpoints for new apps (audio features/analysis, recommendations, previews) and developer-mode quotas are limited **(verify current terms)**. BPM and key must therefore come from the app's own analysis, not from Spotify.
- Everything fetched from a metadata provider is stored in the local database so a provider outage does not empty the library.

---

## 5. Source Matching Algorithm

For a track with title, primary artist, duration, and ISRC (if available):

1. Query YouTube Music for `"artist title"` (songs filter first, then general results).
2. Score each candidate on:
   - normalized title similarity (ignoring bracketed text),
   - artist match,
   - **duration delta** (hard reject above about 3 s unless nothing better exists),
   - bonus for "Topic" / Art Track / official-audio uploads,
   - penalty for live, remix, slowed, sped-up, cover, instrumental, 8D, unless those words appear in the query.
3. Pick the top candidate above a minimum score; otherwise return "unavailable" with the top three alternatives for manual choice.
4. Persist the choice in `source_mappings` and honor user overrides permanently.

---

## 6. Playback Flow

1. The user taps a track. The app checks the local cache; if present, it plays the file.
2. If not, the app calls `POST /resolve` with track metadata. The backend returns a mapping and starts a cache job.
3. The backend downloads audio (Opus/M4A), then serves it at `GET /audio/{id}` with HTTP Range support. Playback begins as soon as bytes are available, while the app writes the file to its cache.
4. On failure, the backend retries with the next candidate; the client shows a non-blocking notice.
5. The next one or two queue items are prefetched. Cached audio uses an LRU cap (default 2 GB, configurable).

**Download-then-serve** is used instead of live proxying because stream URLs are short-lived and tied to the requesting IP.

**Gapless:** true gapless depends on codec and player support. Offer a short crossfade option and measure before promising gapless.

---

## 7. Data Model (Client SQLite)

```
tracks(id, provider_id, title, artist_ids, album_id, duration_ms, isrc, artwork_url, source_type)
artists(id, provider_id, name, artwork_url)
albums(id, provider_id, title, artist_id, year, artwork_url)
playlists(id, name, created_at, updated_at)
playlist_tracks(playlist_id, track_id, position, added_at)
likes(track_id, liked_at)
play_history(id, track_id, played_at, duration_played_ms)
source_mappings(track_id, source_id, source_type, score, user_pinned, updated_at)
cached_audio(track_id, file_path, bytes, codec, last_played_at)
analysis(track_id, bpm, beat_offset_ms, beats_json, key, peaks_path, analyzed_at)
mashup_projects(id, name, bpm, created_at, updated_at)
mashup_clips(id, project_id, track_id, lane, timeline_start_ms,
             source_in_ms, source_out_ms, gain_db, fade_in_ms, fade_out_ms,
             rate, pitch_semitones)
```

---

## 8. Backend API

| Method | Path | Purpose |
|---|---|---|
| GET | `/search?q=` | Proxy and cache metadata search |
| GET | `/album/{id}`, `/artist/{id}` | Detail pages |
| POST | `/resolve` | Match a track to a source and start the download |
| GET | `/audio/{id}` | Cached audio with Range support |
| POST | `/analyze/{track_id}` | BPM, beat grid, and peaks (idempotent) |
| GET | `/analysis/{track_id}` | Fetch an analysis result |
| POST | `/render` | Mashup project JSON in, job ID out |
| GET | `/render/{job_id}` | Job status and result URL |
| POST | `/import` | Upload a local file for analysis |
| GET | `/health` | Reports `yt-dlp` version and last successful extraction |

---

## 9. Mashup Engine Design

- **Model:** a project is a list of clips on lanes. Each clip references a cached file, an in/out range, a timeline start, gain, fades, and (v2) rate and pitch.
- **Time base:** all positions are stored as integer milliseconds (or samples at a fixed rate) and converted once at the audio-engine boundary, to avoid floating-point drift.
- **Preview:** all clips are scheduled against a single audio clock in the native engine. The JS layer sends the schedule; it never drives timing.
- **Beat snapping:** clip starts and trim edges snap to the nearest beat from `beats_json` within a threshold. Auto-detected BPM is sometimes half or double, so provide a one-tap x2 / /2 fix and a manual tap-tempo offset nudge.
- **Tempo matching (v2):** pre-render a time-stretched copy of a clip server-side (Rubber Band or SoundTouch) at the target BPM, cache it, and reference it from the clip. Real-time pitch-preserving stretch on a phone is avoided.
- **Stems (v2):** vocals/instrumental separation (e.g., Demucs) as a server job.
- **Export parity:** preview and render share one set of timing rules. The server builds an FFmpeg graph per clip (`atrim`, `atempo`, `adelay`, `afade`, `volume`) and mixes with `amix`. Golden-file tests render a fixed project and compare waveforms within a tolerance.
- **Export tooling:** the React Native FFmpeg wrapper `ffmpeg-kit` was retired **(verify)**, so export runs server-side.
- **v1 limits:** 4 lanes, 5 minutes total; mono sources are upmixed to stereo.
- **Audio session handoff:** entering the editor pauses the main player; leaving restores it. The mashup engine owns the audio session while the editor is open.

---

## 10. Security, Legal, and Operations

- Never embed Spotify client secrets or tokens in the app; the backend holds them.
- Rate-limit `/resolve` and `/render`; cap concurrent downloads.
- Keep the extraction layer small, replaceable, and documented. Log `yt-dlp` failures with their error class to reveal breakage patterns.
- Pin `yt-dlp`, but run a recurring update-and-smoke-test job with rollback if the test-set success rate drops below the threshold.
- Treat the system as private. Revisit the legal posture before any sharing beyond trusted friends. This is not legal advice.

---

## 11. Testing Strategy

- **Reference test set:** a fixed list of 100 tracks across genres, eras, languages, and edge cases (very short, very long, common titles, remix-heavy). Run it regularly to measure resolve success, match correctness (manually labeled), and time to first audio.
- **Unit tests:** matching scorer, beat-snapping math, time-unit conversion.
- **Audio tests:** drift test (two identical clips offset by a known amount, analyzed via render or loopback recording); latency measurement on the real target phone.
- **Device matrix:** the owner's phone, plus one low-end Android and one iPhone if iOS matters.
- **UI tests:** a manual checklist plus a few end-to-end flows (Maestro or Detox).

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extraction blocked or broken | High | High | Home host, recurring smoke test, second source (local files) |
| Metadata API terms or quotas change | Medium | Medium | Provider interface, local DB copy, Deezer/MusicBrainz fallback |
| Native audio engine misses timing targets | Medium | High | Early spike; fall back to a custom native module |
| Auto beat detection is wrong | High | Medium | x2 / /2 fix, manual offset, tap tempo |
| Scope creep | High | High | Phase gates; mashup v1 scope frozen |
| Timeline performance on mid-range phones | Medium | Medium | Precomputed peaks, Skia, windowed rendering |
| Two products in one causes burnout | Medium | High | Ship and use the player before starting the mashup editor |
