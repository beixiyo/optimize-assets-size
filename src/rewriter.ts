import fs from 'node:fs/promises'
import path from 'node:path'
import { logger, relForLog } from './utils'
import { walkCodeFiles } from './walker'

/**
 * 根据 alias 映射，计算文件路径变更对应的 import 替换对
 *
 * @param oldPath 原始文件绝对路径
 * @param newPath 新文件绝对路径
 * @param aliasPaths alias prefix → absolutePath 的映射
 * @returns 替换对数组 { from, to }
 */
export function computeAliasRewrites(
  oldPath: string,
  newPath: string,
  aliasPaths: Map<string, string>,
): { from: string, to: string }[] {
  const rewrites: { from: string, to: string }[] = []

  for (const [prefix, aliasRoot] of aliasPaths) {
    const relOld = path.relative(aliasRoot, oldPath)
    if (!relOld || relOld.startsWith('..') || path.isAbsolute(relOld))
      continue

    const sep = prefix.endsWith('/')
      ? ''
      : '/'
    const from = `${prefix}${sep}${relOld.split(path.sep).join('/')}`

    const relNew = path.relative(aliasRoot, newPath)
    const to = `${prefix}${sep}${relNew.split(path.sep).join('/')}`

    rewrites.push({ from, to })
  }

  return rewrites
}

/**
 * 批量替换源码文件中的 import 路径
 */
export async function applyImportRewrites(
  pairs: { from: string, to: string }[],
  dryRun: boolean,
  codeScanRoots: string[],
): Promise<void> {
  if (pairs.length === 0)
    return

  /** 去重 */
  const seen = new Map<string, string>()
  for (const { from, to } of pairs)
    seen.set(from, to)
  const unique = [...seen.entries()].map(([from, to]) => ({ from, to }))

  let touched = 0
  for (const root of codeScanRoots) {
    for await (const file of walkCodeFiles(root)) {
      let text = await fs.readFile(file, 'utf8')
      const orig = text
      for (const { from, to } of unique)
        text = text.split(from).join(to)
      if (text !== orig) {
        touched++
        if (!dryRun)
          await fs.writeFile(file, text, 'utf8')
        logger.info(`${dryRun
          ? '[dry-run] '
          : ''}rewrite imports: ${relForLog(file)}`)
      }
    }
  }

  logger.success(`${dryRun
    ? '[dry-run] '
    : ''}共更新 ${touched} 个源码文件中的 alias 路径`)
}
