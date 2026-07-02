import { z } from 'zod';

export const DSAlertSchema = z.object({
  type: z.enum(['token_drift', 'raw_value', 'coverage_gap', 'shadow_mismatch', 'visual_diff', 'schema_invalid']),
  message: z.string(),
  location: z.string().nullable(),
});

export const DSRunMetricsSchema = z.object({
  fidelity: z.number(),
  tokenReuse: z.number(),
  variantCoverage: z.number(),
  rawValues: z.number(),
  qaPass: z.boolean(),
  iterations: z.number().int(),
  costUSD: z.number(),
  latencyMs: z.number(),
});

export const DSRunReportSchema = z.object({
  run_id: z.string().min(1),
  phase: z.enum(['foundations', 'component', 'qa', 'stress']),
  component: z.string().nullable(),
  batch: z.string().nullable(),
  status: z.enum(['green', 'yellow', 'red']),
  metrics: DSRunMetricsSchema,
  alerts: z.array(DSAlertSchema),
  timestamp: z.string().min(1),
}).strict();

export type ValidatedDSRunReport = z.infer<typeof DSRunReportSchema>;
