import { test, expect, MOCK_AGENT } from './fixtures';

test.describe('Kanban board', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the agents fetch so the board renders deterministically offline.
    await page.route('**/api/agents', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_AGENT]) }),
    );
  });

  test('creates a ticket and sees it appear on the board', async ({ page }) => {
    await page.goto('/kanban');
    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();

    await page.getByRole('button', { name: 'New Ticket' }).click();

    const title = `E2E ticket ${Date.now()}`;
    await page.getByPlaceholder('What needs to be done?').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();

    await expect(page.getByText(title)).toBeVisible();
  });
});
