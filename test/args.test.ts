import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { parseArgs } from '../src/args'

describe('parseArgs', () => {
  it('解析 --dirs', () => {
    const config = parseArgs(['--dirs=src/assets,public'])
    expect(config.dirs).toHaveLength(2)
    expect(config.dirs[0]).toBe(path.resolve(process.cwd(), 'src/assets'))
    expect(config.dirs[1]).toBe(path.resolve(process.cwd(), 'public'))
  })

  it('解析布尔开关', () => {
    const config = parseArgs(['--dirs=src', '--dry-run', '--force', '--rewrite-imports'])
    expect(config.dryRun).toBe(true)
    expect(config.force).toBe(true)
    expect(config.rewriteImports).toBe(true)
  })

  it('布尔开关默认为 false', () => {
    const config = parseArgs(['--dirs=src'])
    expect(config.dryRun).toBe(false)
    expect(config.force).toBe(false)
    expect(config.rewriteImports).toBe(false)
  })

  it('未传 --formats 时默认 webp + png', () => {
    const config = parseArgs(['--dirs=src'])
    expect(config.formatAllowlist).toEqual(['.webp', '.png'])
  })

  it('--formats= 空为不改变格式（仅同格式候选）', () => {
    const config = parseArgs(['--dirs=src', '--formats='])
    expect(config.formatAllowlist).toEqual([])
  })

  it('解析 --formats=webp,avif', () => {
    const config = parseArgs(['--dirs=src', '--formats=webp,avif'])
    expect(config.formatAllowlist).toEqual(['.webp', '.avif'])
  })

  it('解析 --formats 空格形式', () => {
    const config = parseArgs(['--dirs=src', '--formats', 'png,jpg'])
    expect(config.formatAllowlist).toEqual(['.png', '.jpg'])
  })

  it('解析 --max-width', () => {
    const config = parseArgs(['--dirs=src', '--max-width=1920'])
    expect(config.maxWidth).toBe(1920)
  })

  it('--max-width 小于 16 时忽略', () => {
    const config = parseArgs(['--dirs=src', '--max-width=10'])
    expect(config.maxWidth).toBeNull()
  })

  it('解析 --alias= 格式', () => {
    const config = parseArgs(['--dirs=src', '--rewrite-imports', '--alias=@/=src'])
    expect(config.aliasPaths.has('@/')).toBe(true)
  })

  it('解析 --alias 空格格式', () => {
    const config = parseArgs(['--dirs=src', '--rewrite-imports', '--alias', '@/=src'])
    expect(config.aliasPaths.has('@/')).toBe(true)
  })

  it('不传 --rewrite-imports 时 aliasPaths 为空', () => {
    const config = parseArgs(['--dirs=src', '--alias=@/=src'])
    expect(config.aliasPaths.size).toBe(0)
  })

  it('剥离花括号', () => {
    const config = parseArgs(['--dirs={src/assets,public}'])
    expect(config.dirs).toHaveLength(2)
  })

  it('缺少 --dirs 时退出', () => {
    const originalExit = process.exit
    let exitCode: number | undefined
    process.exit = ((code: number) => { exitCode = code }) as any
    try {
      parseArgs([])
    }
    catch { /* noop */ }
    finally {
      process.exit = originalExit
    }
    expect(exitCode).toBe(1)
  })
})
