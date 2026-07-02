import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── Types ───────────────────────────────────────────────────────

export interface Mem0Memory {
  id: string
  memory: string
  created_at: string
  updated_at: string
  categories: string[]
}

interface Mem0Config {
  apiKey: string
  userId: string
  enabled: boolean
}

// ── Config ──────────────────────────────────────────────────────

/**
 * Read the mem0 plugin config from ~/.openclaw/openclaw.json.
 * Returns { apiKey, userId, enabled } or null if not configured.
 */
export function getMem0Config(): Mem0Config | null {
  const home = process.env.HOME || '/tmp'
  const configPath = join(home, '.openclaw', 'openclaw.json')

  if (!existsSync(configPath)) {
    return null
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    const mem0 = config?.plugins?.entries?.['openclaw-mem0']?.config

    if (!mem0?.apiKey || !mem0?.userId) {
      return null
    }

    return {
      apiKey: mem0.apiKey,
      userId: mem0.userId,
      enabled: mem0.mode === 'platform',
    }
  } catch {
    return null
  }
}

// ── API helpers ─────────────────────────────────────────────────

/**
 * Fetch all memories for the configured user from the mem0 platform API.
 * Returns an empty array on error or if mem0 is not configured.
 */
export async function getMem0Memories(): Promise<Mem0Memory[]> {
  const config = getMem0Config()
  if (!config) return []

  try {
    const url = `https://api.mem0.ai/v1/memories/?user_id=${encodeURIComponent(config.userId)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`mem0 API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : (data.results ?? [])
  } catch (err) {
    console.error('Failed to fetch mem0 memories:', err)
    return []
  }
}

/**
 * Search memories by query using the mem0 platform API.
 * Returns matching memories or an empty array on error.
 */
export async function searchMem0(query: string): Promise<Mem0Memory[]> {
  const config = getMem0Config()
  if (!config) return []

  try {
    const response = await fetch('https://api.mem0.ai/v1/memories/search/', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        user_id: config.userId,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`mem0 search error: ${response.status} ${response.statusText}`)
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : (data.results ?? [])
  } catch (err) {
    console.error('Failed to search mem0 memories:', err)
    return []
  }
}
