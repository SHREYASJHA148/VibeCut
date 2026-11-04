import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogTrack, fetchCatalog } from '../src/catalog.ts';

const free = { id: 'abc123', title: 'A full song', user: { name: 'Independent artist' }, duration: 210,
  is_streamable: true, is_stream_gated: false, is_available: true, permalink: '/artist/song',
  artwork: { '480x480': 'https://example.org/art.jpg' }, stream: { url: 'https://example.org/expiring-token' } };
test('catalog uses full-track canonical streams with artist attribution', () => {
  const t = catalogTrack(free);
  assert.equal(t.duration, 210000); assert.equal(t.source, 'audius'); assert.equal(t.bytes, 0);
  assert.equal(t.uri, 'https://api.audius.co/v1/tracks/abc123/stream?app_name=VibeCut');
  assert.equal(t.sourceUrl, 'https://audius.co/artist/song');
  assert.deepEqual(t.peaks, []);
});
test('unavailable, gated, restricted and invalid tracks are excluded', () => {
  for (const changes of [{ is_streamable: false }, { is_stream_gated: true }, { is_stream_gated: undefined },
    { is_available: false }, { is_delete: true }, { is_unlisted: true }, { allowed_api_keys: ['another-app'] },
    { access: { stream: false } }, { id: '../file' }, { duration: NaN }, { duration: 0 }, { user: null }])
    assert.equal(catalogTrack({ ...free, ...changes }), undefined);
  assert.equal(catalogTrack(null), undefined);
});
test('catalog search encodes queries, filters results, caches and reports paging', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => { calls++; assert.ok(url.includes('query=lofi%20%26%20jazz')); assert.ok(url.includes('offset=30'));
    return new Response(JSON.stringify({ data: [free, { ...free, is_stream_gated: true }, free] })); });
  const page = await fetchCatalog('lofi & jazz', 30);
  assert.equal(page.tracks.length, 1); assert.equal(page.more, false);
  await fetchCatalog('lofi & jazz', 30); assert.equal(calls, 1);
});
test('catalog surfaces rate limits and malformed responses', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(fetchCatalog('rate-test'), /busy/);
  globalThis.fetch = async () => new Response(JSON.stringify({ data: null }));
  await assert.rejects(fetchCatalog('invalid-test'), /invalid response/);
});
