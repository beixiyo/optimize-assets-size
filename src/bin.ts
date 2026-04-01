#!/usr/bin/env node
/**
 * 栅格图体积优化：直接写回源文件以减小 Git 体积（与 Vite 构建期 imagetools 等无关）
 *
 * 用法：
 *   bun scripts/optimize-assets-size/index.ts --dirs=src/assets,public [options]
 *
 * 参数：
 *   --dirs=a,b              必填，逗号分隔多个根目录（相对 cwd）
 *   --alias @/=src           可选，kv 映射覆盖 alias（优先级最高）
 *   --tsconfig=path          可选，指定 tsconfig 路径以读取 paths；未指定时自动查找
 *   --dry-run               预览模式
 *   --force                 强制覆盖
 *   --rewrite-imports       替换源码中的 alias 路径
 *   --max-width=N           限制最大宽度
 *   --formats=a,b           参与优选的额外格式（webp/png/jpg/jpeg/avif）；未传默认 webp,png；--formats= 空为仅同格式
 *
 * 格式：同格式重压缩与 --formats 给定格式一起做候选、取最小体积；改扩展名时写新文件并删原文件。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from './args'
import { chooseBestRasterEncoding } from './optimizer'
import { applyImportRewrites, computeAliasRewrites } from './rewriter'
import { formatKb, logger, relForLog } from './utils'
import { collectRasterFiles } from './walker'

async function assertDirsExist(dirs: string[]): Promise<void> {
  for (const d of dirs) {
    try {
      const st = await fs.stat(d)
      if (!st.isDirectory()) {
        logger.error(`不是目录: ${d}`)
        process.exit(1)
      }
    }
    catch {
      logger.error(`目录不存在或不可读: ${relForLog(d)}`)
      process.exit(1)
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const config = parseArgs(argv)
  const { dirs, dryRun, force, rewriteImports, maxWidth, formatAllowlist, aliasPaths } = config

  await assertDirsExist(dirs)

  if (maxWidth)
    logger.info(`--max-width=${maxWidth}`)
  logger.info(
    formatAllowlist.length === 0
      ? '--formats 为空：仅同格式重压缩'
      : `格式优选候选（额外）: ${formatAllowlist.join(', ')}；均会与同格式重压缩比较`,
  )
  logger.info(`cwd ${process.cwd()}`)
  logger.info(`dirs → ${dirs.map(d => relForLog(d)).join(', ')}`)
  if (rewriteImports && aliasPaths.size > 0) {
    const aliasStr = [...aliasPaths.entries()]
      .map(([k, v]) => `${k} → ${relForLog(v)}`)
      .join(', ')
    logger.info(`alias: ${aliasStr}`)
  }
  logger.newLine()

  const files = await collectRasterFiles(dirs)
  const allAliasRewrites: { from: string, to: string }[] = []
  const relativeAssetMoves: { oldPath: string, newPath: string }[] = []

  let changed = 0
  let skipped = 0

  for (const filePath of files) {
    const buf = await fs.readFile(filePath)
    const ext = path.extname(filePath)
    const lo = ext.toLowerCase()
    const rel = relForLog(filePath)

    let picked: { buffer: Buffer, outExt: string } | null
    try {
      picked = await chooseBestRasterEncoding(buf, ext, maxWidth, {
        formatAllowlist,
      })
    }
    catch (e: any) {
      logger.warn(`[skip] ${rel} — ${e.message}`)
      continue
    }
    if (!picked?.buffer?.length)
      continue

    const before = buf.length
    const after = picked.buffer.length
    const outLo = picked.outExt.toLowerCase()
    const sameFile = outLo === lo

    if (after >= before && !force) {
      skipped++
      logger.warn(
        `${rel.padEnd(56)} 跳过（最优仍 ≥ 原文件；加 --force 写入） ${formatKb(before)} → ${formatKb(after)}`,
      )
      continue
    }

    if (sameFile) {
      changed++
      const pct = before === 0
        ? 0
        : Math.round((1 - after / before) * 100)
      const smaller = after < before
      logger.success(
        `${rel.padEnd(56)} ${smaller ? `-${pct}%` : 'force'}  ${formatKb(before)} → ${formatKb(after)}`,
      )
      if (!dryRun)
        await fs.writeFile(filePath, picked.buffer)
      continue
    }

    const dir = path.dirname(filePath)
    const baseName = path.basename(filePath, ext)
    const targetPath = path.join(dir, `${baseName}${picked.outExt}`)
    if (targetPath === filePath)
      continue

    let existsTarget = false
    try {
      await fs.access(targetPath)
      existsTarget = true
    }
    catch {
      existsTarget = false
    }
    if (existsTarget && !force) {
      skipped++
      logger.warn(`${rel.padEnd(56)} 跳过（已存在 ${path.basename(targetPath)}，加 --force 覆盖）`)
      continue
    }

    changed++
    const pct = before === 0
      ? 0
      : Math.round((1 - after / before) * 100)
    const smaller = after < before
    logger.success(
      `${rel.padEnd(56)} → ${path.basename(targetPath).padEnd(12)} ${smaller ? `-${pct}%` : 'force'}  ${formatKb(before)} → ${formatKb(after)}`,
    )

    if (!dryRun) {
      await fs.writeFile(targetPath, picked.buffer)
      await fs.unlink(filePath)
    }

    if (rewriteImports) {
      const rewrites = computeAliasRewrites(filePath, targetPath, aliasPaths)
      allAliasRewrites.push(...rewrites)
      relativeAssetMoves.push({ oldPath: filePath, newPath: targetPath })
    }
  }

  logger.newLine()
  if (dryRun && changed > 0)
    logger.info(`[dry-run] 本会处理 ${changed} 个资源；跳过 ${skipped} 个`)
  else if (changed > 0)
    logger.success(`已处理 ${changed} 个资源；跳过 ${skipped} 个`)
  else
    logger.info(`无资源被更新；跳过 ${skipped} 个`)

  if (rewriteImports && (allAliasRewrites.length > 0 || relativeAssetMoves.length > 0)) {
    logger.newLine()
    await applyImportRewrites(allAliasRewrites, dryRun, dirs, relativeAssetMoves)
  }
  else if (rewriteImports && allAliasRewrites.length === 0 && relativeAssetMoves.length === 0) {
    logger.info('无可重写的资源路径，跳过路径替换')
  }
}

main().catch((e) => {
  logger.error('执行失败', e)
  process.exit(1)
})
