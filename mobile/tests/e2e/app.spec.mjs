import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { encodeWav } from '../../src/wav.ts';

const tone = hz => {
  const audio = Float32Array.from({ length: 44100 * 8 }, (_, i) => .4 * Math.sin(2 * Math.PI * hz * i / 44100));
  return Buffer.from(encodeWav([audio, audio], 44100));
};
test.beforeEach(async ({ page }) => {
  await page.route('https://api.audius.co/v1/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { data: [] } }));
});
test('import, playback, playlists, persistence, timeline editing and sample-accurate WAV export', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByText('Find your next feeling.')).toBeVisible();
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import audio files' }).click();
  await (await chooser).setFiles([{ name: 'Test Artist - Blue.wav', mimeType: 'audio/wav', buffer: tone(440) }, { name: 'Test Artist - Pink.wav', mimeType: 'audio/wav', buffer: tone(660) }]);
  await expect(page.getByText('2 files imported.')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Play Blue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open player' }).click();
  await expect(page.getByText('Your queue')).toBeVisible();
  await page.getByRole('button', { name: 'Next track', exact: true }).last().click();
  await expect(page.getByText('Pink', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Pause audio' }).click();
  await page.getByRole('button', { name: 'Close player' }).click();
  await page.getByRole('button', { name: 'Create playlist' }).click();
  await page.getByLabel('New playlist name').fill('Night drive');
  await page.getByRole('button', { name: 'Create playlist', exact: true }).last().click();
  await page.getByText('All tracks', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Options for Blue' }).click();
  await page.getByRole('button', { name: 'Night drive', exact: true }).click();
  await page.getByRole('button', { name: 'Close track options' }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await expect(page.getByText('Night drive', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Blue', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search music').fill('Blue');
  await expect(page.getByRole('button', { name: 'Play Blue', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Pink', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Create a mashup' }).click();
  await page.getByLabel('Project name').fill('Blue hour');
  await page.getByRole('button', { name: 'Add audio', exact: true }).click();
  await page.getByText('Blue', { exact: true }).last().click();
  const field = async (label, value) => { const input = page.getByLabel(label, { exact: true }); await input.fill(value); await input.blur(); };
  await field('Source in', '0.5'); await field('Source out', '4'); await field('Fade in', '0.5');
  await page.getByRole('button', { name: 'Add audio', exact: true }).click();
  await page.getByText('Pink', { exact: true }).last().click();
  await field('Position', '1'); await field('Source in', '0.2'); await field('Source out', '3');
  await page.getByRole('button', { name: 'Toggle clip mute' }).click();
  await page.getByRole('button', { name: 'Toggle clip mute' }).click();
  const volume = page.getByLabel('Clip volume', { exact: true });
  await volume.scrollIntoViewIfNeeded(); const box = await volume.boundingBox();
  await volume.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByText('50%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play mix', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause mix' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause mix' }).click();
  await page.screenshot({ path: 'test-results/editor.png' });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export WAV' }).click();
  const download = await downloadPromise;
  const wav = await readFile(await download.path());
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wav.readUInt32LE(24)).toBe(44100);
  const seconds = wav.readUInt32LE(40) / (44100 * 4);
  expect(Math.abs(seconds - 3.8)).toBeLessThan(.001);
  // Verify actual rendered audio against the expected trim, delay, fade and gain.
  for (const at of [.123, .7, 1.123, 2.321, 3.7]) {
    const frame = Math.round(at * 44100), t = frame / 44100;
    let expected = t < 3.5 ? .2 * Math.sin(2 * Math.PI * 440 * (t + .5)) * Math.min(1, t / .5) : 0;
    if (t >= 1 && t < 3.8) expected += .1 * Math.sin(2 * Math.PI * 660 * (t - 1 + .2));
    expect(Math.abs(wav.readInt16LE(44 + frame * 4) / 32768 - expected)).toBeLessThan(.001);
  }
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.reload(); await page.getByRole('tab', { name: 'Studio', exact: true }).click();
  await expect(page.getByText('Blue hour', { exact: true })).toBeVisible();
  await page.getByText('Blue hour', { exact: true }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Blue hour');
  expect(errors).toEqual([]);
});

test('online catalog success and failures keep local search usable', async ({ page }) => {
  await page.route('http://localhost:8000/**', async route => {
    const url = new URL(route.request().url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/health') return route.fulfill({ headers, json: { ok: true, metadata: true } });
    if (url.searchParams.get('q') === 'failure') return route.fulfill({ status: 503, headers, json: { detail: 'No key' } });
    return route.fulfill({ headers, json: { results: [{ id: 'catalog', kind: url.searchParams.get('kind'), title: 'Catalog result', artist: 'Artist' }] } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('Metadata server URL').fill('http://localhost:8000');
  await page.getByLabel('Server access token').fill('test-token');
  await page.getByRole('button', { name: 'Save and test connection' }).click();
  await expect(page.getByText('Connected. Online metadata search is ready.')).toBeVisible();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search music').fill('catalog');
  await expect(page.getByText('Catalog result', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Catalog result' })).toHaveCount(0);
  await page.getByText('Artists', { exact: true }).click();
  await expect(page.getByText('Catalog result', { exact: true })).toBeVisible();
  await page.getByText('Albums', { exact: true }).click();
  await expect(page.getByText('Catalog result', { exact: true })).toBeVisible();
  await page.getByLabel('Search music').fill('failure');
  await expect(page.getByText('Online search needs a metadata API key on your server.')).toBeVisible();
  await expect(page.getByText('No imported tracks match this search.')).toBeVisible();
});

test('unsupported audio fails visibly without leaving a broken library entry', async ({ page }) => {
  await page.goto('/'); await page.getByRole('tab', { name: 'Library', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import audio files' }).click();
  await (await chooser).setFiles({ name: 'broken.wav', mimeType: 'audio/wav', buffer: Buffer.from('not an audio file') });
  await expect(page.getByText(/0 files imported/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play broken' })).toHaveCount(0);
});
