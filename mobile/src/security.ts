export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
export async function boundedJson(response: Response, limit = 2 * 1024 * 1024): Promise<any> {
  if (Number(response.headers.get('content-length') ?? 0) > limit) {
    await response.body?.cancel(); throw new Error('The service response is too large.');
  }
  const reader = response.body?.getReader();
  let text: string;
  if (reader) {
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new Error('The service response is too large.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    text = new TextDecoder().decode(bytes);
  } else {
    text = await response.text();
    if (text.length > limit) throw new Error('The service response is too large.');
  }
  try { return JSON.parse(text); } catch { throw new Error('The service returned invalid JSON.'); }
}
export function serverUrl(value: string) {
  const text = value.trim().replace(/\/+$/, '');
  if (!text) return '';
  const url = new URL(text);
  const loopback = ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    !url.hostname || url.username || url.password || url.search || url.hash || text.length > 2048)
    throw new Error('Use an HTTPS server address without credentials, query parameters or fragments (localhost is allowed for development).');
  return url.toString().replace(/\/+$/, '');
}
export function accessToken(value: string) {
  if (value.length > 4096 || /[\r\n\0]/.test(value)) throw new Error('The server access token is invalid.');
  return value.trim();
}
export function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096) return;
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) return url.href; } catch {}
}
export function ownedAudio(uri: string, root: string) {
  try {
    const path = new URL(uri), directory = new URL(root.endsWith('/') ? root : `${root}/`);
    if (path.protocol !== 'file:' || directory.protocol !== 'file:' || path.host !== directory.host || path.search || path.hash) return false;
    const decoded = decodeURIComponent(path.pathname), base = decodeURIComponent(directory.pathname);
    if (!decoded.startsWith(base)) return false;
    return /^[a-z0-9-]+\.[a-z0-9]{1,12}$/i.test(decoded.slice(base.length));
  } catch { return false; }
}
export function isAudiusStream(uri: string) {
  try { const url = new URL(uri); return url.origin === 'https://api.audius.co' && /^\/v1\/tracks\/[a-zA-Z0-9]+\/stream$/.test(url.pathname) && !url.username && !url.password; } catch { return false; }
}
