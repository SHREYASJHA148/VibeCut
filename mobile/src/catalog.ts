import type { Track } from './model';
import { boundedJson, httpsUrl } from './security.ts';

const API = 'https://api.audius.co/v1';
type AudiusTrack = {
  id?: string; title?: string; duration?: number; is_streamable?: boolean; is_stream_gated?: boolean;
  is_available?: boolean; is_delete?: boolean; is_unlisted?: boolean; allowed_api_keys?: string[] | null;
  access?: { stream?: boolean }; user?: { name?: string }; artwork?: Record<string, string> | null; permalink?: string;
};
export function catalogTrack(item: AudiusTrack): Track | undefined {
  if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9]+$/.test(item.id) ||
    typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500 || typeof item.user?.name !== 'string' || !item.user.name.trim() || item.user.name.length > 500 ||
    item.is_streamable !== true || item.is_stream_gated !== false || item.is_available === false ||
    item.is_delete || item.is_unlisted || item.allowed_api_keys?.length || item.access?.stream === false ||
    !Number.isFinite(item.duration) || item.duration! <= 0) return;
  const artwork = item.artwork?.['480x480'] ?? item.artwork?.['150x150'];
  return { id: `audius:${item.id}`, title: item.title, artist: item.user.name,
    duration: Math.round(item.duration! * 1000), uri: `${API}/tracks/${item.id}/stream?app_name=VibeCut`,
    artwork: httpsUrl(artwork), peaks: [], bytes: 0, source: 'audius',
    sourceUrl: typeof item.permalink === 'string' && item.permalink.startsWith('/') ? `https://audius.co${item.permalink}` : `https://audius.co/tracks/${item.id}` };
}
type Page = { tracks: Track[]; more: boolean };
const cache = new Map<string, { expires: number; page: Page }>();
export async function fetchCatalog(query = '', offset = 0, signal?: AbortSignal): Promise<Page> {
  const key = `${query.trim().toLowerCase()}:${offset}`, cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.page;
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, 12000);
  try {
    const route = query.trim() ? `tracks/search?query=${encodeURIComponent(query.trim())}` : 'tracks/trending?time=week';
    const response = await fetch(`${API}/${route}&limit=30&offset=${offset}&app_name=VibeCut`, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? 'Audius is busy. Please try again shortly.' : 'Music could not be loaded. Please try again.');
    const body = await boundedJson(response);
    if (!Array.isArray(body.data)) throw new Error('The music service returned an invalid response.');
    const tracks: Track[] = [], seen = new Set<string>();
    for (const item of body.data.slice(0, 30)) { const track = catalogTrack(item); if (track && !seen.has(track.id)) { tracks.push(track); seen.add(track.id); } }
    const page = { tracks, more: body.data.length === 30 };
    cache.set(key, { page, expires: Date.now() + 60000 });
    if (cache.size > 30) cache.delete(cache.keys().next().value!);
    return page;
  } catch (e) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('Music loading timed out. Check your connection and retry.');
    throw e;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
