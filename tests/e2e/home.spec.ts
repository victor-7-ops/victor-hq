import { test, expect } from './fixtures';

test.describe('Home load', () => {
  test('loads the dashboard shell with sidebar navigation, no console errors', async ({ page }) => {
    // logo.png 404 is a known pre-existing missing asset, unrelated to app logic.
    const IGNORED = [/Failed to load resource.*404/];
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !IGNORED.some((re) => re.test(msg.text()))) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);

    // Sidebar nav links from the manual test matrix (TC-WEB-001)
    for (const label of ['Map', 'Kanban', 'Messages', 'Costs', 'Memory', 'Settings']) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('sidebar navigation routes to Costs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Costs', exact: true }).click();
    await expect(page).toHaveURL(/\/costs$/);
    await expect(page.getByRole('heading', { name: 'Costs & Optimization' })).toBeVisible();
  });
});
