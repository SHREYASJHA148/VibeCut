import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { encodeWav } from '../../src/wav.ts';

const track = { id: 'free1', title: 'Clear skies', user: { name: 'Test artist' }, duration: 63,
  is_streamable: true, is_stream_gated: false, is_available: true, permalink: '/artist/clear-skies' };
const samples = Float32Array.from({ length: 8000 * 63 }, (_, i) => .1 * Math.sin(2 * Math.PI * 440 * i / 8000));
const audio = Buffer.from(encodeWav([samples], 8000));
async function observeAudio(page) {
  await page.addInitScript(() => {
    const OriginalAudio = window.Audio; window.__testAudio = [];
    window.Audio = function (...args) { const audio = new OriginalAudio(...args); window.__testAudio.push(audio); return audio; };
    window.Audio.prototype = OriginalAudio.prototype;
  });
}
test('free full tracks play immediately, queue, save, persist and stay out of the editor', async ({ page }) => {
  await observeAudio(page);
  await page.route('https://api.audius.co/v1/**', route => {
    const headers = { 'access-control-allow-origin': '*' };
    if (route.request().url().includes('/stream')) return route.fulfill({ headers, contentType: 'audio/wav', body: audio });
    return route.fulfill({ headers, json: { data: [track, { ...track, id: 'free2', title: 'Blue sea' }, { ...track, id: 'paid', title: 'Paid song', is_stream_gated: true }] } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Stream Clear skies' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stream Paid song' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stream Clear skies' }).click();
  await expect.poll(() => page.evaluate(() => window.__testAudio.some(a => !a.paused && a.currentTime > .25 && a.duration > 60))).toBe(true);
  await page.getByRole('button', { name: 'Open player' }).click();
  await expect(page.getByText('Music via Audius · View artist and track ↗')).toBeVisible();
  await page.getByRole('button', { name: 'Next track', exact: true }).last().click();
  await expect(page.getByText('Blue sea', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Pause audio' }).click();
  await page.getByRole('button', { name: 'Close player' }).click();
  await page.getByRole('button', { name: 'Save Clear skies', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await page.getByText('Saved', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play Clear skies' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Blue sea' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search music').fill('ambient');
  await expect(page.getByRole('button', { name: 'Stream Blue sea' })).toBeVisible();
  await page.getByRole('tab', { name: 'Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Create a mashup' }).click();
  await page.getByRole('button', { name: 'Add audio', exact: true }).click();
  await expect(page.getByText('Import audio for the studio')).toBeVisible();
  await expect(page.getByText('Clear skies', { exact: true }).last()).not.toBeVisible();
});

test('catalog failure is visible and retry recovers', async ({ page }) => {
  let fail = true;
  await page.route('https://api.audius.co/v1/**', route => fail
    ? route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, json: {} })
    : route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { data: [track] } }));
  await page.goto('/'); await expect(page.getByText('Music could not be loaded. Please try again.')).toBeVisible();
  fail = false; await page.getByRole('button', { name: 'Retry music' }).click();
  await expect(page.getByRole('button', { name: 'Stream Clear skies' })).toBeVisible();
});

test('missing music opens an encoded YouTube Music search and pauses VibeCut', async ({ page }) => {
  await observeAudio(page);
  await page.route('https://api.audius.co/v1/**', route => {
    const url = route.request().url(), headers = { 'access-control-allow-origin': '*' };
    if (url.includes('/stream')) return route.fulfill({ headers, contentType: 'audio/wav', body: audio });
    return route.fulfill({ headers, json: { data: url.includes('/search?') ? [] : [track] } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Search YouTube Music' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stream Clear skies' }).click();
  await expect.poll(() => page.evaluate(() => window.__testAudio.some(a => !a.paused && a.currentTime > .2))).toBe(true);
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  const query = 'Arijit Singh & Shreya #live हिंदी';
  await page.getByLabel('Search music').fill(query);
  await expect(page.getByText('No matching tracks on Audius')).toBeVisible();
  // Capture the outgoing app link without relying on YouTube availability in CI.
  await page.evaluate(() => { window.open = url => { window.__outgoingMusic = String(url); return window; }; });
  await page.getByRole('button', { name: 'Search YouTube Music' }).click();
  const destination = await page.evaluate(() => window.__outgoingMusic);
  expect(new URL(destination).origin).toBe('https://music.youtube.com');
  expect(new URL(destination).pathname).toBe('/search');
  expect(new URL(destination).searchParams.get('q')).toBe(query);
  await expect.poll(() => page.evaluate(() => window.__testAudio.every(a => a.paused))).toBe(true);
  await expect(page.getByText('Opens YouTube Music · Playback happens there')).toBeVisible();
});

test('YouTube Music fallback also appears when the catalog is unavailable', async ({ page }) => {
  await page.route('https://api.audius.co/v1/**', route => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, json: {} }));
  await page.goto('/'); await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search music').fill('a missing song');
  await expect(page.getByRole('button', { name: 'Search YouTube Music' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry music' })).toBeVisible();
});
