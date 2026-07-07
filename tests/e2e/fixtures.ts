import { test as base, expect } from '@playwright/test';

export const MOCK_AGENT = {
  id: 'agent-main',
  name: 'Orchestrator',
  title: 'Orchestrator',
  reportsTo: null,
  directReports: [],
  soulPath: null,
  soul: null,
  voiceId: null,
  color: '#3b82f6',
  emoji: '🤖',
  avatarUrl: null,
  model: 'claude-sonnet-5',
  tools: [],
  crons: [],
  memoryPath: null,
  description: '',
};

/**
 * Global sidebar/topbar chrome fetches /api/gateway and /api/crons on every
 * route. Both shell out to the openclaw CLI, which isn't installed/configured
 * in CI and takes ~20s per call to time out — mock them everywhere so e2e
 * specs stay fast and deterministic regardless of the local machine's setup.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/gateway', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          port: 18789,
          pid: null,
          uptime: 0,
          version: 'test',
          reachable: false,
          connectLatencyMs: 0,
          runtimeState: '',
        }),
      }),
    );
    await page.route('**/api/crons', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ crons: [], pipelines: [] }),
      }),
    );
    await use(page);
  },
});

export { expect };
