# VibeCut: Implementation Plan

**Status:** Draft v1
**Companion documents:** `VibeCut_PRD.md`, `VibeCut_TRD.md`

This plan is ordered by dependency and risk, not by schedule. Each phase ends with an **exit gate**; do not start the next phase until the gate passes. Items marked **(verify)** depend on third-party policies that change often.

---

## Guiding Rules

1. **Risk before polish.** Validate the riskiest assumptions (audio source, audio engine, sync) before building UI.
2. **Use it before extending it.** Each milestone should be used as a real replacement for your current player before the next phase starts.
3. **Freeze scope per phase.** New ideas go on a parking-lot list, not into the current phase.
4. **Isolate the fragile parts.** Keep the audio source, the metadata provider, and the mashup audio engine each behind a single module so any of them can be swapped.
5. **Log every playback failure from the start.** The failure logs become the roadmap for hardening.

---

## Phase 0: Kill-Tests (Validate Assumptions)

**Objective:** find out whether the plan's riskiest assumptions are true before investing in UI.

**Steps**

1. **Extraction reliability (S1).** On the machine you intend to host on, resolve and download a fixed list of 100 test tracks with `yt-dlp`. Record success rate and time per track. Re-run the list several times, including after a `yt-dlp` update, to check stability.
2. **Matching accuracy (S2).** Implement the scoring approach from the TRD (section 5) and run it on the same 100 tracks. Hand-label each result as correct or wrong.
3. **Metadata providers (S3).** Create a Spotify developer app and run searches with the client-credentials flow; confirm exactly which endpoints your app can call **(verify terms)**. Prototype equivalent searches against Deezer and MusicBrainz + Cover Art Archive.
4. **Dual-clip sync (S4).** In a bare React Native development build on your actual phone, load two cached audio files and play them aligned. Measure start latency and clip-to-clip drift across a 3-minute playback. Try `react-native-audio-api` first; if it fails, scope a minimal custom native module.
5. **Background playback (S5).** Prove `react-native-track-player` background playback, lock-screen controls, and handling of calls and headphone unplug.
6. **Decide the open questions** listed in the Decision Log below.

**Exit gate**
- Extraction succeeds on at least 90% of the test set from your chosen host.
- Matching is at least 90% correct, or the wrong cases are recoverable through the planned override flow.
- Dual-clip drift is under 10 ms.
- If extraction or the audio-engine test fails, stop and redesign (for example, local-files-first, or a custom native audio module) before continuing.

---

## Phase 1: Foundation

**Objective:** a themed app shell and a reachable backend, with no features yet.

**Steps**

1. Create the repository with `app/`, `server/`, and `shared/` (types) directories.
2. Configure TypeScript, linting, formatting, and CI for typecheck and unit tests.
3. Set up the Expo development build for Android (and iOS if chosen).
4. Implement the theme token file (matte black, electric blue, baby pink) and verify text contrast for each pairing.
5. Build base components: Button, Text, Card, Sheet, MiniPlayer shell, Skeleton loader.
6. Set up tab navigation: Home, Search, Library, Mashups.
7. Create the SQLite schema and migrations (TRD section 7).
8. Create the backend skeleton: FastAPI app, `/health`, configuration, bearer-token auth.
9. Connect the phone to the backend through Tailscale, including over mobile data.
10. Define the `MetadataProvider` and `SourceProvider` interfaces and implement the first `MetadataProvider`.

**Exit gate**
- The app builds, navigates between tabs, and shows themed placeholder screens.
- The phone reaches the backend `/health` endpoint over Tailscale on both Wi-Fi and mobile data.

---

## Phase 2: Player MVP (Milestone M1)

**Objective:** a working music player good enough to replace your current one.

**Steps**

1. Search screen with debounced queries, result lists, and artwork caching.
2. Album and artist detail pages.
3. Backend `/resolve`: matching, candidate fallback, download, and caching.
4. Backend `/audio/{id}` with HTTP Range support.
5. Playback core: play, pause, seek, next, previous.
6. Queue management: play next, add to queue, reorder, shuffle, repeat.
7. Full-screen player and mini-player.
8. Background playback, lock-screen and notification controls, interruption handling (calls, headphone unplug, audio focus).
9. Likes, playlists (create, edit, reorder), and recently played in the local database.
10. Basic error and empty states: no network, source not found, retry.

**Exit gate (M1)**
- You use VibeCut as your normal player in place of your previous app.
- Playback-start success is at least 95% in real use.

---

## Phase 3: Hardening and Polish (Milestone M2)

**Objective:** make the player dependable and complete.

**Steps**

1. Wrong-version flow: show alternate candidates and pin the chosen source permanently.
2. Offline downloads, LRU cache limit, and a storage management screen.
3. Local file import with tag reading, plus backend analysis for imported files.
4. Prefetching of upcoming queue items and an optional crossfade between tracks.
5. Startup and scrolling performance pass.
6. Automated recurring smoke test of the 100-track reference set, with `yt-dlp` auto-update and rollback if results drop below threshold.
7. Backup and restore of library, playlists, and mappings to JSON.
8. Failure-log review: fix the most frequent playback failures first.

**Exit gate (M2)**
- You have fully replaced your previous player with no need to fall back to it.
- Wrong-version rate is under 5% and recoverable in one tap.

---

## Phase 4: Mashup v1 (Milestone M3)

**Objective:** a small but real mashup editor: 2-4 lanes, trim, move, gain, fades, snap-to-beat, preview, export. Build it as vertical slices, each demonstrable on its own.

**Slice 1: Analysis pipeline**
1. Implement backend `/analyze/{track_id}` returning BPM, beat grid, key, and waveform peaks.
2. Store results in the `analysis` table.
3. Display a static waveform for one track in the app.

**Slice 2: Projects and clips**
1. Mashup list screen and project screen.
2. Add a clip from the library to a project.
3. Persist projects and clips in `mashup_projects` and `mashup_clips`.

**Slice 3: Timeline UI**
1. Render lanes and waveform clips from precomputed peaks.
2. Horizontal scroll and pinch zoom.
3. Playhead.
4. Move clips, trim handles, split, delete.
5. Verify 60 fps with 4 lanes and a 5-minute mix on a mid-range device.

**Slice 4: Engine integration**
1. Build the audio-session handoff between the main player and the mashup engine.
2. Send the clip schedule to the native engine; the JS layer never drives timing.
3. Implement play, pause, seek, and loop.
4. Per-clip gain and fade in/out.

**Slice 5: Beat snapping**
1. Snap clip starts and trim edges to the beat grid.
2. Add the x2 / /2 BPM correction.
3. Add tap-tempo and manual beat-offset adjustment.

**Slice 6: Export**
1. Implement backend `/render` using an FFmpeg filtergraph generated from project JSON.
2. Show render progress and download the result.
3. Add the share sheet.
4. Add golden-file tests confirming preview and render timing parity.

**Exit gate (M3)**
- A 3-track, 2-minute mashup can be built and exported in under 10 minutes.
- The exported file matches the in-app preview within the defined tolerance.
- Clip-to-clip drift stays under 10 ms.

---

## Phase 5: Mashup v2 (Milestone M4, Optional)

**Objective:** the features that make mashups sound good.

**Steps**

1. Tempo matching: server-side pre-render of time-stretched clips at a target BPM, cached and referenced by the clip.
2. Key shifting: server-side pitch-shifted copies.
3. Stem separation (e.g., Demucs) as a server job, enabling vocals-over-instrumental workflows.
4. Per-lane mute and solo.
5. Undo and redo.
6. Crossfade presets.
7. Project templates.
8. Tempo map support for songs with tempo changes.

**Exit gate (M4)**
- A mashup combining tracks of different tempos and keys sounds coherent without manual audio-file editing outside the app.

---

## Dependency Map

- Phase 1 depends on Phase 0 decisions (platform, host, metadata provider, audio engine).
- Phase 2 depends on Phase 1 (shell, DB, backend, provider interfaces).
- Phase 3 depends on Phase 2 (a working player and failure logs).
- Phase 4 depends on Phase 3's cache layer and local import, because mashups require downloaded, seekable audio.
- Phase 5 depends on Phase 4's analysis pipeline and export path.

---

## Decision Log (Fill In During Phase 0)

| Decision | Options | Decide After |
|---|---|---|
| Platform priority | Android-first vs. iOS-first | Phase 0 start |
| Backend host | Home mini PC vs. VPS | Extraction test (S1) |
| Primary metadata provider | Spotify vs. Deezer vs. MusicBrainz | Metadata test (S3) |
| Mashup audio engine | `react-native-audio-api` vs. custom native module | Dual-clip sync test (S4) |
| Local library as a first-class source | Yes / No | End of Phase 0 |
| Gapless vs. crossfade | True gapless vs. short crossfade | Phase 2 playback core |

---

## First Actions

1. Choose and prepare the backend host; install `yt-dlp`, FFmpeg, and FastAPI.
2. Write the 100-track reference test list.
3. Run the extraction and matching tests (S1, S2) and record results.
4. Create a bare development build and run the dual-clip sync test (S4) on your actual phone.
5. Review the results against the Phase 0 exit gate before starting Phase 1.
