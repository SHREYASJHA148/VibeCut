# VibeCut: Product Requirements Document (PRD)

**Status:** Draft v1
**Audience:** Single owner/developer (private, personal-use app)
**Platform assumption:** Android-first; iOS supported via development build
**Companion documents:** `VibeCut_TRD.md`, `VibeCut_Implementation_Plan.md`

Items marked **(verify)** depend on third-party policies that change often.

---

## 1. Summary

**VibeCut** is a private, daily-driver mobile music app with a Spotify-like player and a built-in mashup editor. It is built for a single user (the owner) and optionally a handful of trusted friends later. It pairs a familiar streaming experience with a custom multi-track mashup tool that mainstream streaming apps do not offer.

---

## 2. Goals

- **G1:** Replace a mainstream streaming app for everyday listening: search, play, queue, playlists, library, background playback.
- **G2:** Let the user build a simple mashup from 2-4 tracks, preview it, and export it as an audio file.
- **G3:** Deliver a cohesive, distinctive dark UI that feels fast and polished.

## 3. Non-Goals (v1)

- Public release, app-store distribution, multi-user accounts, social features, payments.
- Podcasts, video, lyrics, radio, or algorithmic recommendations.
- Desktop or web clients.
- Studio-grade DAW features (automation curves, MIDI, effect chains).

---

## 4. Persona

**Primary: the owner.** Listens on one phone, wants fast search and reliable playback, and enjoys making edits and mashups for fun, parties, or sharing clips with friends.

---

## 5. User Stories

### Discovery and Playback
- I search for a song, artist, or album and see results with artwork quickly.
- I tap a track and hear audio within about 2 seconds on first resolve, or instantly if it is cached.
- Playback continues with the screen locked, with lock-screen and notification controls, and resumes sensibly after calls or headphone unplug.
- I can manage a queue (play next, add to queue, reorder), shuffle, and repeat.
- If the wrong version plays, I can tap "Wrong version?" and choose another match.

### Library
- I can like tracks, create and edit playlists, and see recently played.
- I can add my own audio files to the library (local import).
- I can download tracks for offline listening and see how much storage is used.

### Mashup
- I can create a mashup project and add clips from my library.
- Each clip appears as a waveform on a lane in a timeline; I can drag to move, drag handles to trim, split, delete, and zoom.
- I can set per-clip volume and fade in/out.
- Snap-to-beat aligns clip starts and edges to the detected beat grid.
- I can play, pause, seek, and loop a region of the mix.
- I can export the mix as an audio file and share it.
- (v2) I can tempo-match and key-shift a clip to another, and split a track into vocals/instrumental stems.

---

## 6. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| F1 | Search tracks, albums, artists via a metadata provider | P0 |
| F2 | Resolve a track to an audio source, cache it, and play it | P0 |
| F3 | Background playback, lock-screen controls, audio focus handling | P0 |
| F4 | Queue, shuffle, repeat, seek, smooth transitions between tracks | P0 |
| F5 | Likes, playlists, recently played, persistent local database | P0 |
| F6 | Wrong-version correction with remembered matches | P1 |
| F7 | Offline downloads with storage management | P1 |
| F8 | Local file import with metadata read from tags | P1 |
| F9 | Mashup project create/read/update/delete and persistence | P0 (mashup) |
| F10 | Timeline: lanes, waveform clips, move/trim/split/delete/zoom | P0 (mashup) |
| F11 | Beat grid, BPM detection, snap-to-beat | P0 (mashup) |
| F12 | Mix preview playback with per-clip gain and fades | P0 (mashup) |
| F13 | Export mix to file (AAC/WAV) and share sheet | P1 (mashup) |
| F14 | Tempo-match and key-shift | P2 |
| F15 | Stem separation (vocals / instrumental) | P2 |
| F16 | Backup and restore of library and projects (JSON) | P2 |

---

## 7. Non-Functional Requirements

- **Performance:** cold start under 2.5 s on a mid-range phone; warm search results under 1 s; timeline scroll and zoom at 60 fps with 4 lanes and a 5-minute mix.
- **Reliability:** playback-start success of at least 95% across a 100-track test set; automatic fallback to an alternate source candidate on failure.
- **Mashup timing:** clip-to-clip drift under 10 ms across a 3-minute preview.
- **Offline:** previously cached tracks and mashup projects work without a network.
- **Privacy:** no analytics or third-party trackers; API secrets and tokens never ship inside the app bundle.
- **Battery:** background playback should not drain more than a typical music app.
- **Accessibility:** touch targets of at least 44 dp; text contrast of at least 4.5:1; respect system font scaling.

---

## 8. Visual Design Requirements

VibeCut rejects the standard Spotify green for a sleek, cyberpunk-meets-lo-fi look.

**Proposed design tokens** (adjust by eye, then verify contrast for each pairing):

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0A0B` | App background (matte black, OLED-friendly) |
| `surface` | `#141417` | Cards, mini-player |
| `elevated` | `#1D1D22` | Sheets, modals |
| `blue` | `#2F6BFF` | Primary fills, progress, active states |
| `blueText` | `#6C97FF` | Small blue text (verify contrast on `bg`) |
| `pink` | `#F7B6CB` | Highlights, likes, playhead, small accents |
| `textPrimary` | `#F2F2F5` | Body text |
| `textMuted` | `#8E8E99` | Secondary text |

**Rules**
- Electric Blue is the dominant accent; Baby Pink is used sparingly (about 10% of accent usage) so it reads as a detail.
- Use blue for fills, rings, progress, and large elements; use the lightened blue or pink for small text.
- Waveforms in blue; playhead and selected-clip outline in pink.
- Album-art-derived tinting is optional and secondary.

---

## 9. Success Criteria

- The owner uses VibeCut as the main player for two consecutive weeks without reverting to another app.
- Playback-start success of 95% or more on the 100-track test set; wrong-version rate under 5%.
- A 3-track, 2-minute mashup can be built and exported in under 10 minutes.

---

## 10. Release Milestones

| Milestone | Scope |
|---|---|
| **M1: Player MVP** | F1-F5 |
| **M2: Polished player** | F6-F8 plus hardening |
| **M3: Mashup v1** | F9-F13 |
| **M4: Mashup v2** | F14-F16 |

---

## 11. Open Product Questions

1. **Android-first or iOS-first?** This affects sideloading: a free Apple developer account's builds expire after 7 days; a paid account lasts a year.
2. **Will friends ever use it?** This changes authentication, quotas, and legal posture.
3. **Is your own music library a real source, or is streaming the only source?** A local library is the most reliable source for mashups.
4. **How important is true gapless playback versus a short crossfade?**

---

## 12. Key Constraints and Risks (Product-Level)

- The streaming audio source relies on community extraction tooling, which can break and which conflicts with the source platform's terms. The app must remain private.
- Third-party metadata APIs can change terms or quotas **(verify)**; metadata should be copied into the local database.
- The mashup editor is a substantial product in its own right; v1 scope is intentionally small (2-4 lanes, trim, move, gain, fades, snap-to-beat, preview, export).

## 13. Legal and Policy Note

"Personal use" reduces practical risk but does not remove the terms accepted when using the Spotify API and YouTube. Keep the app private, keep the audio-source layer replaceable, and prefer your own audio files where possible. This is not legal advice.
