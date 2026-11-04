# VibeCut: Project Overview & Architecture

Welcome to the official master document for **VibeCut**, a custom, personal-use mobile music streaming and mashup application.

---

## 1. Core Vision & Concept
* **App Name:** VibeCut
* **Target Audience:** Personal use (no commercial release or public licensing requirements).
* **Primary Purpose:** A daily-driver mobile music player that mimics the smoothness of Spotify while introducing a custom, user-driven mashup creation tool.

---

## 2. Visual Design & Aesthetic
VibeCut rejects the standard Spotify green in favor of a sleek, modern, cyberpunk-meets-lo-fi aesthetic:
* **Background:** Deep Matte Black
* **Accents:** Electric Blue
* **Highlights & Details:** Subtle Baby Pink touchpoints

---

## 3. Key Features
1. **Spotify-Style Streaming UI:** Familiar, fluid navigation, search bars, player controls, and library organization.
2. **On-Demand Catalog:** Pulls the latest tracks, album art, and metadata seamlessly.
3. **Manual Mashup Editor:** A dedicated multi-track timeline feature where you can overlay, trim, and sync audio tracks manually to create custom personal mashups, just like building a playlist.

---

## 4. Technical Architecture & Tech Stack
* **Platform:** Cross-Platform Mobile App (React Native)
* **Metadata & Discovery Layer:** Spotify Web API (or Last.fm API) used purely for search queries, artist names, and album artwork.
* **Audio Streaming Pipeline:** Metadata-to-YouTube mapping strategy (using community extraction tools/backend helpers like `yt-dlp` or React Native audio modules) to stream live audio on demand.
* **Mashup Engine:** Client-side multi-track audio waveform and timeline control for manual cutting and playback mixing.

---

## 5. Next Steps
* Initialize the React Native project repository.
* Build out the custom dark-mode theme stylesheet (Matte Black + Electric Blue + Baby Pink).
* Design the home/search screen and prototype the multi-track mashup timeline component.
