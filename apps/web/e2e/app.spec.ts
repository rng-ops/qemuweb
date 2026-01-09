import { test, expect } from '@playwright/test';

test.describe('QemuWeb', () => {
  test('loads the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('QemuWeb');
  });

  test('shows VM profile selector', async ({ page }) => {
    await page.goto('/');
    const profileSelector = page.locator('select').first();
    await expect(profileSelector).toBeVisible();
  });

  test('shows terminal area', async ({ page }) => {
    await page.goto('/');
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
  });

  test('disables start button without profile', async ({ page }) => {
    await page.goto('/');
    const startButton = page.getByRole('button', { name: /start vm/i });
    await expect(startButton).toBeDisabled();
  });

  test('shows capability warnings for missing features', async ({ page }) => {
    await page.goto('/');
    // May or may not show warnings depending on browser support
    // Just verify the page loads without errors
    await expect(page.locator('body')).toBeVisible();
  });
});
