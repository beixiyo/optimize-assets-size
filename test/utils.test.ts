import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { formatKb, relForLog, resolveFromCwd } from '../src/utils'

describe('resolveFromCwd', () => {
  it('空字符串返回空', () => {
    expect(resolveFromCwd('')).toBe('')
    expect(resolveFromCwd('  ')).toBe('')
  })

  it('绝对路径原样返回（normalize）', () => {
    const result = resolveFromCwd('/foo/bar/../baz')
    expect(result).toBe(path.normalize('/foo/baz'))
  })

  it('相对路径基于 cwd 解析', () => {
    const result = resolveFromCwd('src/assets')
    expect(result).toBe(path.resolve(process.cwd(), 'src/assets'))
  })

  it('前后空格会被 trim', () => {
    const result = resolveFromCwd('  src/assets  ')
    expect(result).toBe(path.resolve(process.cwd(), 'src/assets'))
  })
})

describe('relForLog', () => {
  it('cwd 内的路径返回相对路径', () => {
    const abs = path.resolve(process.cwd(), 'src/foo.png')
    expect(relForLog(abs)).toBe('src/foo.png')
  })

  it('cwd 外的路径返回绝对路径', () => {
    const abs = '/some/other/path/file.png'
    expect(relForLog(abs)).toBe(abs)
  })
})

describe('formatKb', () => {
  it('正确格式化字节为 kB', () => {
    expect(formatKb(1024)).toBe('1.00 kB')
    expect(formatKb(2048)).toBe('2.00 kB')
    expect(formatKb(512)).toBe('0.50 kB')
  })

  it('保留两位小数', () => {
    expect(formatKb(1000)).toBe('0.98 kB')
    expect(formatKb(0)).toBe('0.00 kB')
  })
})
