import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createHash } from 'node:crypto'
import type { OptimizeConfig } from './types'

const CACHE_VERSION = 1

export interface FileCacheSnapshot {
  size: number
  mtimeMs: number
}

interface CacheEntry extends FileCacheSnapshot {}

interface CachePayload {
  version: number
  entries: Record<string, CacheEntry>
}

export interface OptimizeCache {
  filePath: string
  get(relativePath: string): FileCacheSnapshot | null
  set(relativePath: string, snapshot: FileCacheSnapshot): void
  delete(relativePath: string): void
  save(): Promise<void>
}

export function getDefaultCacheRoot(): string {
  return path.join(os.tmpdir(), 'optimize-assets-size')
}

export function createFileSnapshot(stat: Pick<FileCacheSnapshot, 'size' | 'mtimeMs'>): FileCacheSnapshot {
  return {
    size: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
  }
}

export function isSnapshotMatch(
  current: FileCacheSnapshot,
  cached: FileCacheSnapshot | null | undefined,
): boolean {
  if (!cached)
    return false
  return current.size === cached.size && current.mtimeMs === cached.mtimeMs
}

export function buildCacheKey(config: Pick<OptimizeConfig, 'dirs' | 'dryRun' | 'force' | 'rewriteImports' | 'maxWidth' | 'formatAllowlist'>): string {
  return stableHash(JSON.stringify({
    dirs: [...config.dirs].sort(),
    dryRun: config.dryRun,
    force: config.force,
    rewriteImports: config.rewriteImports,
    maxWidth: config.maxWidth,
    formatAllowlist: [...config.formatAllowlist],
  }))
}

export async function loadOptimizeCache(
  config: Pick<OptimizeConfig, 'cache' | 'cacheDir' | 'dirs' | 'dryRun' | 'force' | 'rewriteImports' | 'maxWidth' | 'formatAllowlist'>,
): Promise<OptimizeCache | null> {
  if (!config.cache)
    return null

  const projectKey = stableHash(process.cwd())
  const argsKey = buildCacheKey(config)
  const filePath = path.join(config.cacheDir || getDefaultCacheRoot(), `v${CACHE_VERSION}`, projectKey, `${argsKey}.json`)

  let payload: CachePayload = { version: CACHE_VERSION, entries: {} }
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<CachePayload>
    if (parsed.version === CACHE_VERSION && parsed.entries && typeof parsed.entries === 'object')
      payload = { version: CACHE_VERSION, entries: parsed.entries as Record<string, CacheEntry> }
  }
  catch {
    payload = { version: CACHE_VERSION, entries: {} }
  }

  return {
    filePath,
    get(relativePath) {
      return payload.entries[relativePath] || null
    },
    set(relativePath, snapshot) {
      payload.entries[relativePath] = snapshot
    },
    delete(relativePath) {
      delete payload.entries[relativePath]
    },
    async save() {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2))
    },
  }
}

function stableHash(input: string): string {
  return createHash('sha1').update(input).digest('hex')
}
