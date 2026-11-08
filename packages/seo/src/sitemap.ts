export const SITEMAP_CHUNK_SIZE = 50_000

/**
 * Splits URLs into sitemap chunks (PRD FR-B4: chunks of 50k URLs).
 */
export function chunkUrls(urls: string[], chunkSize: number = SITEMAP_CHUNK_SIZE): string[][] {
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than zero')
  }

  const chunks: string[][] = []
  for (let index = 0; index < urls.length; index += chunkSize) {
    chunks.push(urls.slice(index, index + chunkSize))
  }
  return chunks
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

/**
 * Builds a minimal, valid urlset document for a chunk of URLs.
 */
export function buildSitemapXml(urls: string[]): string {
  const entries = urls.map(url => `<url><loc>${escapeXml(url)}</loc></url>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
}
