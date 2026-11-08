export interface IndexNowOptions {
  host: string
  key: string
  urls: string[]
  keyLocation?: string
  fetchImpl?: typeof fetch
}

export interface IndexNowResult {
  ok: boolean
  status: number
  skipped: boolean
}

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * Pings IndexNow for newly discovered mint URLs (PRD FR-B4).
 * No-op when there is nothing to submit; the live call is made by the SEO cron, not CI.
 */
export async function pingIndexNow(options: IndexNowOptions): Promise<IndexNowResult> {
  if (options.urls.length === 0) {
    return { ok: true, status: 0, skipped: true }
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const body: Record<string, unknown> = {
    host: options.host,
    key: options.key,
    urlList: options.urls,
  }
  if (options.keyLocation)
    body.keyLocation = options.keyLocation

  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

  return { ok: response.ok, status: response.status, skipped: false }
}
