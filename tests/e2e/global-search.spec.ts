import { test, expect } from './fixtures';

test.describe('Global search', () => {
  test('opens via the search trigger and filters results by query', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Open search/ }).click();

    const input = page.getByPlaceholder('Search OpenClaw Dashboard...');
    await expect(input).toBeVisible();

    await input.fill('Memory');
    await expect(page.getByText('Memory', { exact: true }).first()).toBeVisible();
  });
});
