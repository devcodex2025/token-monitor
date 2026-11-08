import type { MetadataRoute } from 'next'
import { DEMO_MINTS } from '@/lib/demo-mints'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Programmatic SEO sitemap (FR-B4). Large deployments use generateSitemaps() with
 * @tmr/seo chunkUrls (50k chunks); the demo index lists the handful of indexed mints.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...DEMO_MINTS.map(entry => ({
      url: `${SITE_URL}/t/${entry.mint}`,
      lastModified,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
  ]
}
