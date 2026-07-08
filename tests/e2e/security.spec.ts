import { test, expect } from './fixtures';

test.describe('Security / System Pulse page', () => {
  test('renders Token Analytics, Cost Control, and System Health sections', async ({ page }) => {
    await page.goto('/security');

    await expect(page.getByRole('heading', { name: /token analytics/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /cost control/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /system health/i })).toBeVisible();
  });
});
