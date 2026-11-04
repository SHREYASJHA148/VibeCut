import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('https://api.audius.co/v1/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { data: [] } }));
});
test('tampered local library fails closed without overwriting user data', async ({ page }) => {
  const corrupt = JSON.stringify({ tracks: [null], likes: [], history: [], playlists: [], projects: [], queue: [], position: 0 });
  await page.addInitScript(value => localStorage.setItem('vibecut.library.v1', value), corrupt);
  await page.goto('/');
  await expect(page.getByText(/saved library could not be read/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('vibecut.library.v1'))).toBe(corrupt);
});
test('authenticated connection refuses redirects without sending the token onward', async ({ page }) => {
  let leaked = false, authenticated = false;
  await page.route('https://attacker.example/**', route => { leaked = true; return route.abort(); });
  await page.route('http://localhost:8000/health', route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization', 'access-control-allow-methods': 'GET' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    authenticated = route.request().headers().authorization === 'Bearer test-token-only-for-tests-1234567890';
    return route.fulfill({ status: 302, headers: { ...headers, Location: 'https://attacker.example/collect' } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('Metadata server URL').fill('http://localhost:8000');
  await page.getByLabel('Server access token').fill('test-token-only-for-tests-1234567890');
  await page.getByRole('button', { name: 'Save and test connection' }).click();
  await expect(page.getByRole('button', { name: 'Save and test connection' })).toBeEnabled();
  expect(authenticated).toBe(true);
  expect(leaked).toBe(false);
  await expect(page.getByText('Connected. Online metadata search is ready.')).toHaveCount(0);
});
