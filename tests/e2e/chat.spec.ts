import { test, expect, MOCK_AGENT } from './fixtures';

const SSE_BODY = [
  `data: ${JSON.stringify({ content: 'Hello ' })}\n\n`,
  `data: ${JSON.stringify({ content: 'from the mocked gateway.' })}\n\n`,
  'data: [DONE]\n\n',
].join('');

test.describe('Chat send (gateway mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/agents', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_AGENT]) }),
    );
    await page.route(`**/api/chat/${MOCK_AGENT.id}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: SSE_BODY,
      }),
    );
    // Conversation sync/fetch endpoints hit on load — keep them inert.
    await page.route('**/api/conversations/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
  });

  test('sends a message and renders the streamed reply', async ({ page }) => {
    await page.goto(`/chat?agent=${MOCK_AGENT.id}`);

    // Desktop and mobile ConversationView both render (one hidden via CSS) — use the visible one.
    const textarea = page.getByPlaceholder(`Message ${MOCK_AGENT.name}...`).first();
    await expect(textarea).toBeVisible();

    const question = `Hello agent ${Date.now()}`;
    await textarea.fill(question);
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText(question).first()).toBeVisible();
    await expect(page.getByText('Hello from the mocked gateway.').first()).toBeVisible();
  });
});
