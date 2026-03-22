import { describe, expect, it } from 'bun:test'
import { computeAliasRewrites } from '../src/rewriter'

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
