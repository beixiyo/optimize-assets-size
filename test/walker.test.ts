import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { collectRasterFiles, walkCodeFiles, walkRasterFiles } from '../src/walker'

const TMP_DIR = path.join(import.meta.dir, '.tmp-walker-test')

beforeAll(async () => {
  await fs.mkdir(path.join(TMP_DIR, 'sub'), { recursive: true })
  await fs.mkdir(path.join(TMP_DIR, 'node_modules'), { recursive: true })
  await fs.writeFile(path.join(TMP_DIR, 'a.png'), '')
  await fs.writeFile(path.join(TMP_DIR, 'b.jpg'), '')
  await fs.writeFile(path.join(TMP_DIR, 'c.ts'), '')
  await fs.writeFile(path.join(TMP_DIR, 'd.tsx'), '')
  await fs.writeFile(path.join(TMP_DIR, 'e.txt'), '')
  await fs.writeFile(path.join(TMP_DIR, 'sub/f.webp'), '')
  await fs.writeFile(path.join(TMP_DIR, 'sub/g.vue'), '')
  await fs.writeFile(path.join(TMP_DIR, 'node_modules/skip.png'), '')
})

afterAll(async () => {
  await fs.rm(TMP_DIR, { recursive: true, force: true })
})

describe('walkRasterFiles', () => {
  it('只返回栅格图文件', async () => {
    const files: string[] = []
    for await (const f of walkRasterFiles(TMP_DIR))
      files.push(path.basename(f))
    expect(files).toContain('a.png')
    expect(files).toContain('b.jpg')
    expect(files).toContain('f.webp')
    expect(files).not.toContain('c.ts')
    expect(files).not.toContain('e.txt')
  })

  it('跳过 node_modules', async () => {
    const files: string[] = []
    for await (const f of walkRasterFiles(TMP_DIR))
      files.push(path.basename(f))
    expect(files).not.toContain('skip.png')
  })

  it('不存在的目录不报错', async () => {
    const files: string[] = []
    for await (const f of walkRasterFiles('/nonexistent/path'))
      files.push(f)
    expect(files).toHaveLength(0)
  })
})

describe('walkCodeFiles', () => {
  it('只返回代码文件', async () => {
    const files: string[] = []
    for await (const f of walkCodeFiles(TMP_DIR))
      files.push(path.basename(f))
    expect(files).toContain('c.ts')
    expect(files).toContain('d.tsx')
    expect(files).toContain('g.vue')
    expect(files).not.toContain('a.png')
    expect(files).not.toContain('e.txt')
  })
})

describe('collectRasterFiles', () => {
  it('从多个根目录收集', async () => {
    const files = await collectRasterFiles([TMP_DIR])
    const names = files.map(f => path.basename(f))
    expect(names).toContain('a.png')
    expect(names).toContain('b.jpg')
    expect(names).toContain('f.webp')
  })

  it('空根目录返回空', async () => {
    const files = await collectRasterFiles([])
    expect(files).toHaveLength(0)
  })
})
