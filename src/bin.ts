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
 *   --tsconfig=path          可选，指定 tsconfig 路径读取 paths；未指定时自动查找
 *   --dry-run               预览模式
 *   --force                 强制覆盖
 *   --to-webp               转为 webp
 *   --rewrite-imports       替换源码中的 alias 路径
 *   --max-width=N           限制最大宽度
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from './args'
import { encodeWebp, optimizeSameFormat } from './optimizer'
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
  const { dirs, dryRun, force, toWebp, rewriteImports, maxWidth, aliasPaths } = config

  await assertDirsExist(dirs)

  if (maxWidth)
    logger.info(`--max-width=${maxWidth}`)
  if (toWebp)
    logger.info('--to-webp（非 webp 将输出为 .webp 并删除原文件）')
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
  const allRewrites: { from: string, to: string }[] = []

  let changed = 0
  let skipped = 0

  for (const filePath of files) {
    const buf = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const rel = relForLog(filePath)

    // --to-webp: 非 webp 文件转为 webp
    if (toWebp && ext !== '.webp') {
      const dir = path.dirname(filePath)
      const base = path.basename(filePath, ext)
      const targetPath = path.join(dir, `${base}.webp`)
      if (targetPath === filePath)
        continue

      let existsTarget
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

      let out: Buffer
      try {
        out = await encodeWebp(buf, maxWidth)
      }
      catch (e: any) {
        logger.warn(`[skip] ${rel} — ${e.message}`)
        continue
      }
      if (!out?.length)
        continue

      const before = buf.length
      const after = out.length
      const pct = before === 0
        ? 0
        : Math.round((1 - after / before) * 100)
      const tag = after <= before
        ? `-${Math.abs(pct)}%`
        : `+${Math.abs(pct)}%（仍转 webp）`
      changed++
      logger.success(`${rel.padEnd(56)} → ${path.basename(targetPath).padEnd(12)} ${tag}  ${formatKb(before)} → ${formatKb(after)}`)

      if (!dryRun) {
        await fs.writeFile(targetPath, out)
        await fs.unlink(filePath)
      }

      if (rewriteImports) {
        const rewrites = computeAliasRewrites(filePath, targetPath, aliasPaths)
        allRewrites.push(...rewrites)
      }
      continue
    }

    /** 同格式压缩（--to-webp 时的 webp 文件，或非 --to-webp 模式的所有文件） */
    let out: Buffer | null
    try {
      out = await optimizeSameFormat(buf, ext, maxWidth)
    }
    catch (e: any) {
      logger.warn(`[skip] ${rel} — ${e.message}`)
      continue
    }
    if (!out?.length)
      continue

    const before = buf.length
    const after = out.length
    const smaller = after < before

    if (!smaller && !force) {
      skipped++
      logger.warn(`${rel.padEnd(56)} 跳过（压后更大或相同） ${formatKb(before)} → ${formatKb(after)}`)
      continue
    }
    changed++

    const pct = before === 0
      ? 0
      : Math.round((1 - after / before) * 100)
    logger.success(
      `${rel.padEnd(56)} ${smaller
        ? `-${pct}%`
        : 'force'}  ${formatKb(before)} → ${formatKb(after)}`,
    )
    if (!dryRun)
      await fs.writeFile(filePath, out)
  }

  logger.newLine()
  if (dryRun && changed > 0)
    logger.info(`[dry-run] 本会处理 ${changed} 个资源；跳过 ${skipped} 个`)
  else if (changed > 0)
    logger.success(`已处理 ${changed} 个资源；跳过 ${skipped} 个`)
  else
    logger.info(`无资源被更新；跳过 ${skipped} 个`)

  if (rewriteImports && allRewrites.length > 0) {
    logger.newLine()
    await applyImportRewrites(allRewrites, dryRun, dirs)
  }
  else if (rewriteImports && toWebp && allRewrites.length === 0) {
    logger.info('无匹配 alias 的转 WebP 资源，跳过路径替换')
  }
}

main().catch((e) => {
  logger.error('执行失败', e)
  process.exit(1)
})
