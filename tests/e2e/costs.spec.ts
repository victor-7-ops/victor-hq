import { test, expect } from './fixtures';

test.describe('Costs page', () => {
  test('loads and renders cost sections', async ({ page }) => {
    const response = await page.goto('/costs');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByRole('heading', { name: 'Costs & Optimization' })).toBeVisible();

    // Page should settle without an error boundary taking over
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  });
});
