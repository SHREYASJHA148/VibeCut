export type Track = {
  id: string; title: string; artist: string; uri: string; duration: number;
  peaks: number[]; bpm?: number; artwork?: string; bytes: number;
  source?: 'audius'; sourceUrl?: string;
};
export type Playlist = { id: string; name: string; trackIds: string[] };
export type Clip = {
  id: string; trackId: string; lane: number; start: number; in: number; out: number;
  volume: number; muted: boolean; fadeIn: number; fadeOut: number;
};
export type Project = { id: string; name: string; bpm: number; clips: Clip[]; updated: number };
export type Library = {
  tracks: Track[]; likes: string[]; history: string[]; playlists: Playlist[];
  projects: Project[]; queue: string[]; current?: string; position: number;
};
export const emptyLibrary: Library = { tracks: [], likes: [], history: [], playlists: [], projects: [], queue: [], position: 0 };
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const MAX_MS = 300_000;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const duration = (p: Project) => Math.max(0, ...p.clips.map(c => c.start + c.out - c.in));
export const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
export const snap = (ms: number, bpm: number, enabled: boolean) => enabled ? Math.round(ms / (60000 / bpm)) * (60000 / bpm) : ms;
export function normalizeClip(c: Clip, sourceDuration: number): Clip {
  const sourceIn = Math.round(clamp(c.in, 0, Math.max(0, sourceDuration - 50)));
  const out = Math.round(clamp(c.out, sourceIn + 50, sourceDuration));
  const length = out - sourceIn;
  const fadeIn = Math.round(clamp(c.fadeIn, 0, length));
  return { ...c, in: sourceIn, out, start: Math.round(clamp(c.start, 0, MAX_MS - length)),
    volume: clamp(c.volume, 0, 1), fadeIn, fadeOut: Math.round(clamp(c.fadeOut, 0, length - fadeIn)) };
}
export function splitClip(c: Clip, at: number): [Clip, Clip] | undefined {
  const offset = Math.round(at - c.start);
  if (offset < 50 || offset > c.out - c.in - 50) return;
  return [{ ...c, out: c.in + offset, fadeIn: Math.min(c.fadeIn, offset), fadeOut: 0 },
    { ...c, id: uid(), start: at, in: c.in + offset, fadeIn: 0, fadeOut: Math.min(c.fadeOut, c.out - c.in - offset) }];
}
// Envelope points are shared by real-time preview and offline export.
export function envelope(c: Clip): [number, number][] {
  const length = (c.out - c.in) / 1000;
  const gain = c.muted ? 0 : c.volume;
  const points: [number, number][] = [[0, c.fadeIn ? 0 : gain]];
  if (c.fadeIn) points.push([c.fadeIn / 1000, gain]);
  if (c.fadeOut) points.push([length - c.fadeOut / 1000, gain]);
  points.push([length, c.fadeOut ? 0 : gain]);
  return points;
}
export function gainAt(points: [number, number][], at: number) {
  for (let i = 1; i < points.length; i++) {
    const [t, g] = points[i], [prev, value] = points[i - 1];
    if (at <= t) return t === prev ? g : value + (g - value) * (at - prev) / (t - prev);
  }
  return points.at(-1)![1];
}
export function schedule(p: Project, position: number) {
  return p.clips.filter(c => !c.muted && c.start + c.out - c.in > position).map(c => {
    const elapsed = Math.max(0, position - c.start);
    return { clip: c, when: Math.max(0, c.start - position) / 1000,
      offset: (c.in + elapsed) / 1000, length: (c.out - c.in - elapsed) / 1000, elapsed: elapsed / 1000 };
  });
}
