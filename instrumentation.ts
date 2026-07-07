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
  }
}
