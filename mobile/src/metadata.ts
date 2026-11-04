import { getConfig } from './config';
import { boundedJson, httpsUrl } from './security';
export type Metadata = { id: string; title: string; artist: string; artwork?: string; kind: 'track' | 'artist' | 'album' };
export async function searchMetadata(query: string, kind: Metadata['kind'], signal: AbortSignal): Promise<Metadata[]> {
  const { url, token } = await getConfig();
  if (!url) return [];
  const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), 10000);
  const abort = () => timeout.abort(); signal.addEventListener('abort', abort);
  try {
    if (signal.aborted) timeout.abort();
    const response = await fetch(`${url}/search?q=${encodeURIComponent(query)}&kind=${kind}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: timeout.signal });
    if (!response.ok) throw new Error(response.status === 503 ? 'Online search needs a metadata API key on your server.' : `Online search failed (${response.status}). Your local library is still available.`);
    const result = await boundedJson(response, 1024 * 1024);
    if (!Array.isArray(result.results)) throw new Error('The metadata server returned an invalid response.');
    return result.results.slice(0, 20).filter((item: Metadata) => item && typeof item.id === 'string' && item.id.length <= 200 &&
      typeof item.title === 'string' && item.title.length <= 500 && typeof item.artist === 'string' && item.artist.length <= 500 &&
      ['track', 'artist', 'album'].includes(item.kind)).map((item: Metadata) => ({ id: item.id, title: item.title, artist: item.artist, kind: item.kind, artwork: httpsUrl(item.artwork) }));
  } catch (e) {
    if (timeout.signal.aborted && !signal.aborted) throw new Error('Online search timed out. Try again.');
    throw e;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
