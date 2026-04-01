import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { applyImportRewrites, computeAliasRewrites, computeRelativeRewrite } from '../src/rewriter'

describe('computeAliasRewrites', () => {
  it('生成 @/ 前缀的替换对', () => {
    const aliasPaths = new Map([['@/', '/project/src']])
    const rewrites = computeAliasRewrites(
      '/project/src/assets/logo.png',
      '/project/src/assets/logo.webp',
      aliasPaths,
    )
    expect(rewrites).toHaveLength(1)
    expect(rewrites[0].from).toBe('@/assets/logo.png')
    expect(rewrites[0].to).toBe('@/assets/logo.webp')
  })

  it('处理无尾斜杠的 prefix', () => {
    const aliasPaths = new Map([['@', '/project/src']])
    const rewrites = computeAliasRewrites(
      '/project/src/img/bg.jpg',
      '/project/src/img/bg.webp',
      aliasPaths,
    )
    expect(rewrites).toHaveLength(1)
    expect(rewrites[0].from).toBe('@/img/bg.jpg')
    expect(rewrites[0].to).toBe('@/img/bg.webp')
  })

  it('文件不在 alias 范围内时返回空', () => {
    const aliasPaths = new Map([['@/', '/project/src']])
    const rewrites = computeAliasRewrites(
      '/other/path/logo.png',
      '/other/path/logo.webp',
      aliasPaths,
    )
    expect(rewrites).toHaveLength(0)
  })

  it('多个 alias 都匹配时生成多个替换对', () => {
    const aliasPaths = new Map([
      ['@/', '/project/src'],
      ['assets', '/project/src/assets'],
    ])
    const rewrites = computeAliasRewrites(
      '/project/src/assets/icon.png',
      '/project/src/assets/icon.webp',
      aliasPaths,
    )
    expect(rewrites).toHaveLength(2)
  })

  it('空 aliasPaths 返回空', () => {
    const rewrites = computeAliasRewrites(
      '/project/src/a.png',
      '/project/src/a.webp',
      new Map(),
    )
    expect(rewrites).toHaveLength(0)
  })
})

describe('computeRelativeRewrite', () => {
  it('处理同级相对路径', () => {
    const rewrite = computeRelativeRewrite(
      '/project/test/t.ts',
      '/project/test/2.png',
      '/project/test/2.webp',
    )
    expect(rewrite.from).toBe('./2.png')
    expect(rewrite.to).toBe('./2.webp')
  })

  it('处理跨目录相对路径', () => {
    const rewrite = computeRelativeRewrite(
      '/project/src/pages/home.ts',
      '/project/test/2.png',
      '/project/test/2.webp',
    )
    expect(rewrite.from).toBe('../../test/2.png')
    expect(rewrite.to).toBe('../../test/2.webp')
  })
})

describe('applyImportRewrites', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(dir =>
        fs.rm(dir, { recursive: true, force: true }),
      ),
    )
  })

  it('按源码文件位置重写相对路径 import', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rewriter-'))
    tempDirs.push(root)

    const pagesDir = path.join(root, 'src/pages')
    const testDir = path.join(root, 'test')
    await fs.mkdir(pagesDir, { recursive: true })
    await fs.mkdir(testDir, { recursive: true })

    const pageFile = path.join(pagesDir, 'home.ts')
    await fs.writeFile(pageFile, "import img from '../../test/2.png'\n", 'utf8')

    await applyImportRewrites(
      [],
      false,
      [root],
      [{ oldPath: path.join(testDir, '2.png'), newPath: path.join(testDir, '2.webp') }],
    )

    const updated = await fs.readFile(pageFile, 'utf8')
    expect(updated).toContain('../../test/2.webp')
  })
})
