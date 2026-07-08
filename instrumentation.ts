export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { validateEnv, formatEnvIssues } = await import('@/lib/env')
  const result = validateEnv()

  for (const line of formatEnvIssues(result)) {
    console.warn(line)
  }

  if (!result.ok) {
    console.error(
      '[env] Startup validation failed. Fix the errors above (see .env.local.example), then restart the server.',
    )
    return
  }

  // Fire-and-forget warm of the openclaw-cli TTL caches (models, sessions)
  // so the first real request (e.g. /api/agents) doesn't pay the CLI's
  // cold-start latency itself.
  import('@/lib/parsers/openclaw-cli')
    .then(({ getOpenClawModels, getOpenClawSessions }) =>
      Promise.all([getOpenClawModels(), getOpenClawSessions()]),
    )
    .catch((err) => {
      console.warn('[instrumentation] cache warm-up failed (non-fatal):', err)
    })
}
