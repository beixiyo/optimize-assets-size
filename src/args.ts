import type { OptimizeConfig } from './types'
import os from 'node:os'
import path from 'node:path'
import { resolveAliasPaths } from './alias'
import { logger, resolveFromCwd } from './utils'
import { normalizeFormatAllowlistTokens } from './optimizer'

/**
 * 解析 CLI 参数
 *
 * 用法：
 *   --dirs=a,b              必填，逗号分隔多个根目录（相对 cwd）
 *   --alias @/=src           可选，kv 映射覆盖 alias（优先级最高）
 *   --tsconfig=path          可选，指定 tsconfig 路径读取 paths；未指定时自动查找
 *   --dry-run               预览模式
 *   --force                 强制覆盖
 *   --no-cache              禁用本地缓存
 *   --cache-dir=path        自定义缓存目录（默认系统临时目录）
 *   --rewrite-imports       替换源码中的 alias 路径
 *   --max-width=N           限制最大宽度
 *   --formats=a,b           可选，参与优选的额外格式（webp|png|jpg|jpeg|avif）；未传默认 webp,png；`--formats=` 空值为仅同格式
 */
export function parseArgs(argv: string[]): OptimizeConfig {
  const dryRun = argv.includes('--dry-run')
  const force = argv.includes('--force')
  const cache = !argv.includes('--no-cache')
  const rewriteImports = argv.includes('--rewrite-imports')
  let maxWidth: number | null = null
  let dirsRaw = ''
  let aliasRaw: string | null = null
  let cacheDirRaw: string | null = null
  let tsconfigRaw: string | null = null
  /** `undefined` 表示未出现 `--formats`，用默认 webp+png */
  let formatsRaw: string | undefined = undefined

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]

    if (a.startsWith('--max-width=')) {
      const n = Number(a.slice('--max-width='.length))
      if (Number.isFinite(n) && n >= 16)
        maxWidth = n
    }
    else if (a.startsWith('--dirs=')) {
      dirsRaw = a.slice('--dirs='.length)
    }
    else if (a.startsWith('--formats=')) {
      formatsRaw = a.slice('--formats='.length)
    }
    else if (a.startsWith('--cache-dir=')) {
      cacheDirRaw = a.slice('--cache-dir='.length)
    }
    else if (a === '--cache-dir' && argv[i + 1]) {
      cacheDirRaw = argv[++i]
    }
    else if (a === '--formats' && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      formatsRaw = argv[++i]
    }
    else if (a === '--alias' && argv[i + 1]) {
      aliasRaw = argv[++i]
    }
    else if (a.startsWith('--alias=')) {
      aliasRaw = a.slice('--alias='.length)
    }
    else if (a.startsWith('--tsconfig=')) {
      tsconfigRaw = a.slice('--tsconfig='.length)
    }
    else if (a === '--tsconfig' && argv[i + 1]) {
      tsconfigRaw = argv[++i]
    }
  }

  dirsRaw = dirsRaw.trim().replace(/^\{/, '').replace(/\}$/, '').trim()
  const dirsRel = dirsRaw.split(',').map(s => s.trim()).filter(Boolean)
  const dirs = dirsRel.map(rel => resolveFromCwd(rel))

  if (dirs.length === 0) {
    logger.error('请传入 --dirs=dir1,dir2（逗号分隔，相对 cwd）')
    process.exit(1)
  }

  const aliasPaths = rewriteImports
    ? resolveAliasPaths(aliasRaw, tsconfigRaw)
    : new Map()

  const formatTokens = formatsRaw === undefined
    ? ['webp', 'png']
    : formatsRaw.split(',').map(s => s.trim()).filter(Boolean)

  const formatAllowlist = normalizeFormatAllowlistTokens(formatTokens)
  const cacheDir = resolveFromCwd(cacheDirRaw || path.join(os.tmpdir(), 'optimize-assets-size'))

  return { dirs, dryRun, force, cache, cacheDir, rewriteImports, maxWidth, formatAllowlist, aliasPaths }
}
