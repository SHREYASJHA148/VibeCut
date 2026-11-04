import type { Library, Project, Track } from './model';

const text = (v: unknown, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max;
const number = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const list = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
function validTrack(t: unknown): t is Track {
  if (!record(t) || !text(t.id) || !text(t.title, 500) || !text(t.artist, 500) || !text(t.uri, 4096) ||
    !number(t.duration, 1, 86400000) || !number(t.bytes, 0, 41943040) || !list(t.peaks, 10000) ||
    !t.peaks.every((v: unknown) => number(v, 0, 16)) || (t.artwork !== undefined && !text(t.artwork, 4096))) return false;
  if (t.source === 'audius') {
    try { const url = new URL(t.uri); return /^audius:[a-zA-Z0-9]+$/.test(t.id) && url.origin === 'https://api.audius.co' &&
      url.pathname === `/v1/tracks/${t.id.slice(7)}/stream` && !url.username && !url.password; } catch { return false; }
  }
  return t.source === undefined && t.duration <= 300100 && (/^idb:[a-z0-9-]+$/i.test(t.uri) || /^file:\/\//.test(t.uri));
}
export function validProject(p: unknown, tracks: Track[]): p is Project {
  if (!record(p) || !text(p.id) || typeof p.name !== 'string' || p.name.length > 70 || !number(p.bpm, 30, 300) ||
    !number(p.updated, 0, Number.MAX_SAFE_INTEGER) || !list(p.clips, 16)) return false;
  const ids = new Set<string>(), sources = new Set<string>();
  return p.clips.every(c => {
    if (!record(c) || !text(c.id) || ids.has(c.id) || !text(c.trackId)) return false;
    ids.add(c.id); sources.add(c.trackId);
    const track = tracks.find(t => t.id === c.trackId);
    return !!track && !track.source && sources.size <= 4 && number(c.lane, 0, 3) && Number.isInteger(c.lane) &&
      number(c.in, 0, track.duration) && number(c.out, c.in + 1, track.duration) && number(c.start, 0, 300000 - (c.out - c.in)) &&
      number(c.volume, 0, 1) && typeof c.muted === 'boolean' && number(c.fadeIn, 0, c.out - c.in) &&
      number(c.fadeOut, 0, c.out - c.in - c.fadeIn);
  });
}
export function validateLibrary(value: unknown): Library {
  if (!record(value) || !list(value.tracks, 10000) || !value.tracks.every(validTrack)) throw new Error('Invalid tracks');
  const tracks = value.tracks as Track[], ids = new Set(tracks.map(t => t.id));
  if (ids.size !== tracks.length) throw new Error('Duplicate tracks');
  for (const key of ['likes', 'history', 'queue'])
    if (!list(value[key], 10000) || !value[key].every((id: unknown) => typeof id === 'string' && ids.has(id))) throw new Error('Invalid track references');
  if (!list(value.playlists, 500) || !value.playlists.every(p => record(p) && text(p.id) && text(p.name, 70) &&
    list(p.trackIds, 10000) && p.trackIds.every((id: unknown) => typeof id === 'string' && ids.has(id)))) throw new Error('Invalid playlists');
  if (!list(value.projects, 200) || !value.projects.every(p => validProject(p, tracks)) ||
    !number(value.position, 0, 86400000) || (value.current !== undefined && !ids.has(value.current))) throw new Error('Invalid projects or playback');
  return { tracks, likes: value.likes, history: value.history, playlists: value.playlists as Library['playlists'],
    projects: value.projects, queue: value.queue, position: value.position, current: value.current };
}
