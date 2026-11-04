import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.audius.co/v1/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { data: [] } }));
  // Mock only the provider boundary; exercise the real modal and player lifecycle.
  await page.addInitScript(() => {
    window.__ytCreated = 0; window.__ytDestroyed = 0; window.__ytOptions = [];
    window.YT = { Player: function (target, options) {
      window.__ytCreated++; window.__ytOptions.push(options);
      const iframe = document.createElement('iframe'); iframe.title = 'YouTube test video';
      iframe.src = 'about:blank'; iframe.style.cssText = 'width:100%;height:100%;border:0';
      target.replaceWith(iframe); setTimeout(() => options.events.onReady(), 0);
      this.destroy = () => { window.__ytDestroyed++; iframe.remove(); };
    } };
  });
});
test('validate links, load an in-app visible player, and destroy it on close', async ({ page }) => {
  await page.goto('/'); await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Play a YouTube link' }).click();
  await page.getByLabel('YouTube video link').fill('https://evil.org/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Load YouTube video' }).click();
  await expect(page.getByText(/Paste a YouTube or YouTube Music video link/)).toBeVisible();
  expect(await page.evaluate(() => window.__ytCreated)).toBe(0);
  await page.getByLabel('YouTube video link').fill('https://music.youtube.com/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Load YouTube video' }).click();
  await expect(page.getByTitle('YouTube test video')).toBeVisible();
  const box = await page.getByTitle('YouTube test video').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(200); expect(box.width).toBeGreaterThanOrEqual(200);
  expect(await page.evaluate(() => window.__ytOptions[0].videoId)).toBe('M7lc1UVf-VE');
  expect(await page.evaluate(() => window.__ytOptions[0].playerVars.controls)).toBe(1);
  expect(await page.evaluate(() => window.__ytOptions[0].playerVars.autoplay)).toBe(0);
  await page.getByRole('button', { name: 'Close YouTube player' }).click();
  await expect(page.getByTitle('YouTube test video')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ytDestroyed)).toBe(1);
});
test('blocked embedding shows a useful error and supports retry', async ({ page }) => {
  await page.goto('/'); await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Play a YouTube link' }).click();
  await page.getByLabel('YouTube video link').fill('https://youtu.be/M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Load YouTube video' }).click();
  await expect(page.getByTitle('YouTube test video')).toBeVisible();
  await page.evaluate(() => window.__ytOptions[0].events.onError({ data: 101 }));
  await expect(page.getByText(/uploader has disabled playback/)).toBeVisible();
  await page.getByRole('button', { name: 'Retry YouTube player' }).click();
  await expect.poll(() => page.evaluate(() => window.__ytCreated)).toBe(2);
  expect(await page.evaluate(() => window.__ytDestroyed)).toBe(1);
});
