import path from 'node:path'
import { describe, expect, it } from 'bun:test'
import { parseAliasKv, stripJsonComments } from '../src/alias'

describe('parseAliasKv', () => {
  it('解析单个 kv 对', () => {
    const result = parseAliasKv('@/=src')
    expect(result.size).toBe(1)
    expect(result.get('@/')).toBe(path.resolve(process.cwd(), 'src'))
  })

  it('解析多个 kv 对', () => {
    const result = parseAliasKv('@/=src,hooks=../hooks/src,utils=../utils/src')
    expect(result.size).toBe(3)
    expect(result.get('@/')).toBe(path.resolve(process.cwd(), 'src'))
    expect(result.get('hooks')).toBe(path.resolve(process.cwd(), '../hooks/src'))
    expect(result.get('utils')).toBe(path.resolve(process.cwd(), '../utils/src'))
  })

  it('跳过无效格式', () => {
    const result = parseAliasKv('invalid,=nokey,novalue=,@/=src')
    expect(result.size).toBe(1)
    expect(result.get('@/')).toBeDefined()
  })

  it('空字符串返回空 Map', () => {
    expect(parseAliasKv('').size).toBe(0)
  })

  it('处理空格和逗号', () => {
    const result = parseAliasKv('  @/ = src , hooks = lib  ')
    expect(result.size).toBe(2)
  })
})

describe('stripJsonComments', () => {
  it('剥离单行注释', () => {
    const input = `{
  "key": "value" // this is a comment
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"key": "value"')
    expect(result).not.toContain('this is a comment')
  })

  it('剥离块注释', () => {
    const input = `{
  /* block comment */
  "key": "value"
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"key": "value"')
    expect(result).not.toContain('block comment')
  })

  it('不破坏字符串内的 /* */', () => {
    const input = `{
  "@/*": ["./src/*"],
  "hooks": ["../hooks/src"]
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"@/*"')
    expect(result).toContain('"./src/*"')
    expect(result).toContain('"hooks"')
  })

  it('不破坏字符串内的 //', () => {
    const input = `{
  "url": "https://example.com"
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"https://example.com"')
  })

  it('处理复杂的混合场景', () => {
    const input = `{
  "compilerOptions": {
    "module": "ESNext",
    /* Bundler mode */
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"], // alias for src
      "i18n/*": ["../i18n/*"]
    },
    /* Linting */
    "strict": true
  }
}`
    const result = stripJsonComments(input)
    const parsed = JSON.parse(result)
    expect(parsed.compilerOptions.paths['@/*']).toEqual(['./src/*'])
    expect(parsed.compilerOptions.paths['i18n/*']).toEqual(['../i18n/*'])
    expect(parsed.compilerOptions.strict).toBe(true)
  })

  it('处理转义引号', () => {
    const input = `{
  "key": "value with \\"quotes\\"" // comment
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"value with \\"quotes\\""')
    expect(result).not.toContain('comment')
  })
})
