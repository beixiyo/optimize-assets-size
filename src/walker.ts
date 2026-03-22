import fs from 'node:fs/promises'
import path from 'node:path'

const SKIP_DIR = new Set(['node_modules', 'dist', '.git', '.nx', 'coverage'])
const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'])

export async function* walkRasterFiles(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name))
        continue
      yield* walkRasterFiles(full)
    }
    else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase()
      if (RASTER_EXT.has(ext))
        yield full
    }
  }
}

export async function* walkCodeFiles(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name))
        continue
      yield* walkCodeFiles(full)
    }
    else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase()
      if (CODE_EXT.has(ext))
        yield full
    }
  }
}

export async function collectRasterFiles(roots: string[]): Promise<string[]> {
  const list: string[] = []
  for (const root of roots) {
    for await (const p of walkRasterFiles(root))
      list.push(p)
  }
  return list
}
