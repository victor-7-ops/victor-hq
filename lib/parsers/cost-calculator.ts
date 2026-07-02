/**
 * Cost Calculator
 * ===============
 * Converts token usage to USD costs based on model pricing.
 * Tracks daily accumulations in SQLite.
 */

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  // Anthropic
  'claude-opus-4-6': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-4.5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  // OpenAI
  'gpt-5.2': { input: 5, output: 15, cacheRead: 2.5, cacheWrite: 5 },
  'gpt-5.3-codex': { input: 5, output: 15, cacheRead: 2.5, cacheWrite: 5 },
  'gpt-4o': { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
  // Google
  'gemini-2.0-flash': { input: 0.075, output: 0.3, cacheRead: 0.02, cacheWrite: 0.075 },
  'gemini-2.5-flash': { input: 0.075, output: 0.3, cacheRead: 0.02, cacheWrite: 0.075 },
  'gemini-2.0-pro': { input: 1.25, output: 5, cacheRead: 0.3, cacheWrite: 1.25 },
  'gemini-3.1-pro': { input: 1.25, output: 5, cacheRead: 0.3, cacheWrite: 1.25 },
  'gemini-3-flash': { input: 0.075, output: 0.3, cacheRead: 0.02, cacheWrite: 0.075 },
  // MiniMax
  'minimax-m2.5': { input: 0.05, output: 0.1, cacheRead: 0.01, cacheWrite: 0.02 },
  // GLM (ZAI) - estimated pricing based on similar models
  'glm-5': { input: 0.1, output: 0.2, cacheRead: 0.02, cacheWrite: 0.05 },
  'glm-4.7-flashx': { input: 0.05, output: 0.1, cacheRead: 0.01, cacheWrite: 0.02 },
  'glm-4.5-air': { input: 0.03, output: 0.06, cacheRead: 0.005, cacheWrite: 0.01 },
  // Kimi (Moonshot)
  'kimi-k2.5': { input: 0.5, output: 1.0, cacheRead: 0.1, cacheWrite: 0.25 },
  // DeepSeek
  'deepseek-r1': { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 },
};

export function getModelPricing(model: string) {
  // Normalize model name
  const normalizedModel = model.toLowerCase().replace(/[:/]/g, '-').replace(/^-/, '');

  // Try exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  if (MODEL_PRICING[normalizedModel]) return MODEL_PRICING[normalizedModel];

  // Try partial match
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedModel.includes(normalizedKey) || normalizedKey.includes(normalizedModel)) {
      return pricing;
    }
  }

  // Default to sonnet pricing
  return MODEL_PRICING['claude-sonnet-4.5'];
}

export function calculateTokenCost(
  tokensIn: number,
  tokensOut: number,
  model: string,
  cacheReadTokens: number = 0,
  cacheWriteTokens: number = 0,
): { total: number; compute: number; cacheWrite: number } {
  const pricing = getModelPricing(model);
  const inputCost = (tokensIn * pricing.input) / 1_000_000;
  const outputCost = (tokensOut * pricing.output) / 1_000_000;
  const cacheReadCost = (cacheReadTokens * pricing.cacheRead) / 1_000_000;
  const cacheWriteCost = (cacheWriteTokens * pricing.cacheWrite) / 1_000_000;

  return {
    total: inputCost + outputCost + cacheReadCost + cacheWriteCost,
    compute: inputCost + outputCost + cacheReadCost,
    cacheWrite: cacheWriteCost,
  };
}

export function formatCostBreakdown(costs: { total: number; compute: number; cacheWrite: number }): string {
  const pct = costs.total > 0 ? Math.round((costs.cacheWrite / costs.total) * 100) : 0;
  return `Total: $${costs.total.toFixed(4)} (Compute: $${costs.compute.toFixed(4)}, Cache Write: $${costs.cacheWrite.toFixed(4)} = ${pct}%)`;
}
