import { chromium, expect, test } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve(process.cwd(), '.output/chrome-mv3');

test('popup loads with the Winnow header', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = worker.url().split('/')[2];
    if (!extensionId) throw new Error('Could not determine the extension ID');

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('h1')).toHaveText('Winnow');
    await expect(page.locator('.brand__tag')).toHaveText('Keep the signal');
  } finally {
    await context.close();
  }
});
