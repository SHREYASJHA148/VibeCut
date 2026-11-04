import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const OriginalAudio = window.Audio; window.__liveAudio = [];
    window.Audio = function (...args) { const audio = new OriginalAudio(...args); window.__liveAudio.push(audio); return audio; };
    window.Audio.prototype = OriginalAudio.prototype;
  });
  await page.goto('http://localhost:8081');
  const stream = page.getByRole('button', { name: /^Stream / }).first();
  await stream.waitFor({ timeout: 45000 });
  const title = await stream.getAttribute('aria-label');
  await stream.click();
  await page.waitForFunction(() => window.__liveAudio.some(a => !a.paused && a.currentTime > 1 && a.duration > 30), { timeout: 45000 });
  const playing = await page.evaluate(() => window.__liveAudio.filter(a => !a.paused).map(a => ({ duration: a.duration, position: a.currentTime, readyState: a.readyState })));
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/live-catalog.png' });
  console.log(JSON.stringify({ title, playing, errors }));
  if (errors.length) throw new Error('Browser reported runtime errors.');
} finally { await browser.close(); }
