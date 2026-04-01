import path from 'node:path'
import fs from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  buildCacheKey,
  createFileSnapshot,
  isSnapshotMatch,
  loadOptimizeCache,
} from '../src/cache'

const cleanupDirs = new Set<string>()

afterEach(async () => {
  for (const dir of cleanupDirs)
    await fs.rm(dir, { recursive: true, force: true })
  cleanupDirs.clear()
})

describe('cache helpers', () => {
  it('相同参数生成相同 key，不同参数生成不同 key', () => {
    const base = {
      dirs: ['/project/assets'],
      dryRun: false,
      force: false,
      rewriteImports: false,
      maxWidth: 1920,
      formatAllowlist: ['.webp', '.png'],
    }
    expect(buildCacheKey(base)).toBe(buildCacheKey(base))
    expect(buildCacheKey(base)).not.toBe(buildCacheKey({
      ...base,
      formatAllowlist: ['.webp'],
    }))
  })

  it('基于 size + mtimeMs 判断快照是否命中', () => {
    const a = createFileSnapshot({ size: 10, mtimeMs: 100.9 })
    const b = createFileSnapshot({ size: 10, mtimeMs: 100.1 })
    const c = createFileSnapshot({ size: 11, mtimeMs: 100.1 })
    expect(isSnapshotMatch(a, b)).toBe(true)
    expect(isSnapshotMatch(a, c)).toBe(false)
  })
})

describe('loadOptimizeCache', () => {
  it('可读写缓存文件', async () => {
    const cacheDir = path.join(process.cwd(), '.tmp-test-cache')
    cleanupDirs.add(cacheDir)

    const cache = await loadOptimizeCache({
      cache: true,
      cacheDir,
      dirs: ['/project/assets'],
      dryRun: false,
      force: false,
      rewriteImports: false,
      maxWidth: null,
      formatAllowlist: ['.webp', '.png'],
    })

    expect(cache).not.toBeNull()
    cache!.set('assets/a.png', createFileSnapshot({ size: 12, mtimeMs: 34 }))
    await cache!.save()

    const loaded = await loadOptimizeCache({
      cache: true,
      cacheDir,
      dirs: ['/project/assets'],
      dryRun: false,
      force: false,
      rewriteImports: false,
      maxWidth: null,
      formatAllowlist: ['.webp', '.png'],
    })

    expect(loaded!.get('assets/a.png')).toEqual({
      size: 12,
      mtimeMs: 34,
    })
  })

  it('禁用缓存时返回 null', async () => {
    const cache = await loadOptimizeCache({
      cache: false,
      cacheDir: path.join(process.cwd(), '.tmp-test-cache-disabled'),
      dirs: ['/project/assets'],
      dryRun: false,
      force: false,
      rewriteImports: false,
      maxWidth: null,
      formatAllowlist: ['.webp', '.png'],
    })

    expect(cache).toBeNull()
  })
})
