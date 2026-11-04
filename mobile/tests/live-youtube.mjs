import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8081');
  await page.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Play a YouTube link' }).click();
  await page.getByLabel('YouTube video link').fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Load YouTube video' }).click();
  const iframe = page.locator('iframe[src*="youtube.com/embed/"]');
  await iframe.waitFor({ timeout: 45000 });
  const frame = page.frameLocator('iframe[src*="youtube.com/embed/"]');
  try { await frame.locator('.ytp-large-play-button').click({ timeout: 15000 }); } catch {}
  await iframe.click({ position: { x: 180, y: 110 } });
  await page.waitForTimeout(5000);
  const media = await frame.locator('body').evaluate(() => [...document.querySelectorAll('video')].map(v => ({ paused: v.paused, time: v.currentTime, duration: Number.isFinite(v.duration) ? v.duration : null })));
  const messages = await page.getByRole('dialog').innerText();
  const providerMessage = (await frame.locator('body').innerText()).slice(0, 700);
  await page.screenshot({ path: 'test-results/youtube-live.png' });
  console.log(JSON.stringify({ embedVisible: await iframe.isVisible(), media, providerMessage, messages, errors }));
} finally { await browser.close(); }
