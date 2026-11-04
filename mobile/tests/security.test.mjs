import test from 'node:test';
import assert from 'node:assert/strict';
import { serverUrl, accessToken, ownedAudio, isAudiusStream, httpsUrl, boundedJson } from '../src/security.ts';
import { validateLibrary, validProject } from '../src/libraryValidation.ts';
import { emptyLibrary } from '../src/model.ts';
import { youtubeNavigation } from '../src/youtube.ts';

test('server URL rejects credential, fragment, insecure and malformed destinations', () => {
  for (const value of ['http://evil.example', 'https://user:password@example.com', 'https://example.com/#token',
    'https://example.com/?forward=evil', 'javascript:alert(1)', 'http://127.0.0.1.evil.example', 'https://'])
    assert.throws(() => serverUrl(value));
  assert.equal(serverUrl(' https://api.example.com/base/ '), 'https://api.example.com/base');
  assert.equal(serverUrl('http://localhost:8000'), 'http://localhost:8000');
  assert.equal(serverUrl(''), '');
  assert.throws(() => accessToken('secret\r\nX-Injected: value'));
  assert.throws(() => accessToken('x'.repeat(4097)));
});
test('only owned files can be deleted; encoded and sibling traversal is rejected', () => {
  const root = 'file:///data/vibecut/audio';
  assert.equal(ownedAudio(`${root}/abc-123.mp3`, root), true);
  for (const value of ['file:///data/vibecut/config.json', `${root}/../config.json`, `${root}/%2e%2e/config.json`,
    `${root}/%2e%2e%2fconfig.json`, `${root}-other/file.wav`, `${root}/sub/file.wav`, 'https://example.com/file.mp3'])
    assert.equal(ownedAudio(value, root), false);
});
test('stream and external URL validation prevents scheme and host confusion', () => {
  assert.equal(isAudiusStream('https://api.audius.co/v1/tracks/abc123/stream?app_name=VibeCut'), true);
  for (const value of ['https://api.audius.co.evil.org/v1/tracks/abc/stream', 'http://api.audius.co/v1/tracks/abc/stream',
    'https://user:pass@api.audius.co/v1/tracks/abc/stream', 'https://api.audius.co/v1/tracks/abc/download']) assert.equal(isAudiusStream(value), false);
  assert.equal(httpsUrl('javascript:alert(1)'), undefined);
  assert.equal(httpsUrl('https://user:pass@example.com/a'), undefined);
});
test('untrusted persisted records fail closed while ordinary libraries stay compatible', () => {
  assert.deepEqual(validateLibrary(structuredClone(emptyLibrary)), { ...emptyLibrary, current: undefined });
  for (const value of [{ ...emptyLibrary, tracks: [null] }, { ...emptyLibrary, queue: ['missing'] },
    { ...emptyLibrary, position: Infinity }, { ...emptyLibrary, projects: [{ clips: new Array(17).fill({}) }] }])
    assert.throws(() => validateLibrary(value));
  const track = { id: 'a', title: 'Song', artist: 'Artist', uri: 'idb:abc-123', duration: 8000, bytes: 100, peaks: [0, .8] };
  const library = { ...emptyLibrary, tracks: [track] };
  assert.equal(validateLibrary(library).tracks.length, 1);
  assert.throws(() => validateLibrary({ ...library, tracks: [{ ...track, uri: 'https://evil.example/song.mp3' }] }));
});
test('invalid render schedules cannot reach the audio engine', () => {
  const track = { id: 'a', duration: 8000 };
  const clip = { id: 'c', trackId: 'a', lane: 0, start: 0, in: 0, out: 4000, volume: 1, muted: false, fadeIn: 0, fadeOut: 0 };
  const project = { id: 'p', name: 'Mix', bpm: 120, updated: 0, clips: [clip] };
  assert.equal(validProject(project, [track]), true);
  for (const changes of [{ volume: Infinity }, { start: -1 }, { lane: 9 }, { out: 10000 }, { fadeIn: 5000 }])
    assert.equal(validProject({ ...project, clips: [{ ...clip, ...changes }] }, [track]), false);
  assert.equal(validProject({ ...project, clips: Array.from({ length: 17 }, (_, i) => ({ ...clip, id: String(i) })) }, [track]), false);
});
test('embedded browser blocks file, intent, script and untrusted top-level navigation', () => {
  const origin = 'https://com.vibecut.app';
  assert.equal(youtubeNavigation('https://www.youtube.com/embed/M7lc1UVf-VE', origin), true);
  assert.equal(youtubeNavigation(`${origin}/`, origin), true);
  for (const value of ['file:///data/private', 'javascript:alert(1)', 'intent://open', 'data:text/html,x',
    'https://www.youtube.com.evil.org', 'http://youtube.com', 'https://evil.example'])
    assert.equal(youtubeNavigation(value, origin), false);
});
test('network responses are bounded even without an honest Content-Length', async () => {
  assert.deepEqual(await boundedJson(new Response('{"name":"हिंदी"}')), { name: 'हिंदी' });
  await assert.rejects(boundedJson(new Response('x'.repeat(100)), 20), /too large/);
  await assert.rejects(boundedJson(new Response('{}', { headers: { 'Content-Length': '99999' } }), 20), /too large/);
  await assert.rejects(boundedJson(new Response('secret contents')), /invalid JSON/);
});
