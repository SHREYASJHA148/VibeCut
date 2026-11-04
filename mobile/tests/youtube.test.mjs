import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, youtubeHtml, youtubeError } from '../src/youtube.ts';
const id = 'M7lc1UVf-VE';
test('parse YouTube, Music, share, short, live, embed links and video IDs', () => {
  for (const value of [id, `https://www.youtube.com/watch?v=${id}&list=abc`, `https://music.youtube.com/watch?v=${id}&si=abc`,
    `https://youtu.be/${id}?t=30`, `youtube.com/shorts/${id}`, `https://m.youtube.com/live/${id}`, `https://www.youtube-nocookie.com/embed/${id}`])
    assert.equal(youtubeId(value), id);
});
test('reject lookalike hosts, injected text, playlists and malformed video IDs', () => {
  for (const value of ['', 'a song title', 'https://youtube.com.evil.org/watch?v=M7lc1UVf-VE',
    'https://youtube.com@evil.org/watch?v=M7lc1UVf-VE', 'https://evil.org/M7lc1UVf-VE',
    'https://youtube.com/playlist?list=abc', 'https://youtube.com/watch?v=abc', 'javascript:alert(1)',
    'https://youtube.com/watch?v=%3Cscript%3E', 'https://youtube.com:444/watch?v=M7lc1UVf-VE'])
    assert.equal(youtubeId(value), undefined);
});
test('native player uses official API, visible controls, no autoplay and app identity', () => {
  const html = youtubeHtml(id, 'https://com.vibecut.app');
  assert.ok(html.includes('https://www.youtube.com/iframe_api')); assert.ok(html.includes('controls:1'));
  assert.ok(html.includes('autoplay:0')); assert.ok(html.includes('https://com.vibecut.app'));
  assert.ok(html.includes('strict-origin-when-cross-origin'));
  assert.throws(() => youtubeHtml('</script>', 'https://com.vibecut.app'));
  assert.throws(() => youtubeHtml(id, 'https://foo.com/"bad'));
});
test('show actionable errors for blocked, private and unidentified embeds', () => {
  assert.match(youtubeError(101), /disabled playback/); assert.equal(youtubeError(101), youtubeError(150));
  assert.match(youtubeError(100), /private/); assert.match(youtubeError(153), /identity/);
});
