import { test, expect } from './fixtures';

test.describe('Agent Orchestrator', () => {
  test('shows the offline banner with cached data and a retry button when stale', async ({ page }) => {
    await page.route('**/api/agent-orchestrator', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [],
          sessions: [],
          owners: {},
          _meta: { stale: true, cachedAt: new Date().toISOString() },
        }),
      }),
    );

    await page.goto('/agent-orchestrator');

    const banner = page.getByRole('status').filter({ hasText: 'Agent Orchestrator not running' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
