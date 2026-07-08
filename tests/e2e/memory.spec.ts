import { test, expect } from './fixtures';

const MOCK_MEMORY_RESPONSE = {
  files: [],
  config: {
    memorySearch: {
      enabled: false,
      provider: null,
      model: null,
      hybrid: {
        enabled: false,
        vectorWeight: 0.5,
        textWeight: 0.5,
        temporalDecay: { enabled: false, halfLifeDays: 30 },
        mmr: { enabled: false, lambda: 0.5 },
      },
      cache: { enabled: false, maxEntries: 0 },
      extraPaths: [],
    },
    memoryFlush: { enabled: false, softThresholdTokens: 0 },
    configFound: true,
  },
  status: {
    indexed: false,
    lastIndexed: null,
    totalEntries: 0,
    vectorAvailable: false,
    embeddingProvider: null,
    raw: '',
  },
  stats: {
    totalFiles: 0,
    totalSizeBytes: 0,
    dailyLogCount: 0,
    evergreenCount: 0,
    oldestDaily: null,
    newestDaily: null,
    dailyTimeline: [],
  },
  health: { score: 100, checks: [], staleDailyLogs: [] },
};

test.describe('Memory page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/memory', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MEMORY_RESPONSE) }),
    );
  });

  test('switches between Overview, Browser, and Guide tabs', async ({ page }) => {
    await page.goto('/memory');
    await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();

    // Tabs render in Overview, Browser, Guide order — index into the fixed
    // .page-tab button list rather than matching by text (some tab bodies,
    // e.g. Guide, contain the word "Overview" in their own content).
    const tabs = page.locator('.page-tabs .page-tab');
    const overviewTab = tabs.nth(0);
    const browserTab = tabs.nth(1);
    const guideTab = tabs.nth(2);

    await browserTab.click();
    await expect(browserTab).toHaveClass(/page-tab-active/);

    await guideTab.click();
    await expect(guideTab).toHaveClass(/page-tab-active/);

    await overviewTab.click();
    await expect(overviewTab).toHaveClass(/page-tab-active/);
  });
});
