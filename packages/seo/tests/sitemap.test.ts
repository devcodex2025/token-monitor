import { describe, expect, it, vi } from 'vitest'
import { buildSitemapXml, chunkUrls } from '../src/sitemap'

describe('sitemap chunking (FR-B4)', () => {
  it('returns no chunks for an empty list', () => {
    expect(chunkUrls([])).toEqual([])
  })

  it('keeps a small list in one chunk', () => {
    expect(chunkUrls(['a', 'b'])).toEqual([['a', 'b']])
  })

  it('splits exactly at 50k', () => {
    const urls = Array.from({ length: 50_000 }, (_, index) => `u${index}`)
    const chunks = chunkUrls(urls)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(50_000)
  })

  it('splits 50k+1 into two chunks', () => {
    const urls = Array.from({ length: 50_001 }, (_, index) => `u${index}`)
    const chunks = chunkUrls(urls)
    expect(chunks.map(chunk => chunk.length)).toEqual([50_000, 1])
  })

  it('rejects a non-positive chunk size', () => {
    expect(() => chunkUrls(['a'], 0)).toThrow()
  })

  it('builds a valid urlset and escapes XML', () => {
    const xml = buildSitemapXml(['https://tmr.watch/t/abc?x=1&y=2'])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<loc>https://tmr.watch/t/abc?x=1&amp;y=2</loc>')
    expect(xml.endsWith('</urlset>')).toBe(true)
  })
})
