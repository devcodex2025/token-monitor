/**
 * Applies the Vercel project settings needed to build the monorepo web app.
 * Requires VERCEL_TOKEN (never printed). Project/team ids come from .vercel/project.json.
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/vercel-setup.mjs
 *
 * Sets: Root Directory = apps/web, framework = nextjs.
 * The Production Branch must be set in Dashboard -> Settings -> Git (or via the Vercel UI).
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const token = process.env.VERCEL_TOKEN
if (!token) {
  console.error('VERCEL_TOKEN is required')
  process.exit(1)
}

const projectFile = path.resolve('.vercel/project.json')
const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'))

const projectId = process.env.VERCEL_PROJECT_ID ?? project.projectId
const teamId = process.env.VERCEL_TEAM_ID ?? project.orgId
const rootDirectory = process.env.VERCEL_ROOT_DIRECTORY ?? 'apps/web'

const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`, {
  method: 'PATCH',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ rootDirectory, framework: 'nextjs' }),
})

if (!response.ok) {
  console.error(`Vercel API error ${response.status}: ${await response.text()}`)
  process.exit(1)
}

const data = await response.json()
console.log(JSON.stringify({
  ok: true,
  id: data.id,
  name: data.name,
  rootDirectory: data.rootDirectory,
  framework: data.framework,
}, null, 2))

console.log('Next: Dashboard -> Settings -> Git -> Production Branch = feat/platform-v2, then Redeploy.')
