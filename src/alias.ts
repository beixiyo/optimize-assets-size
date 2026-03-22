import type { TsconfigJson } from './types'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { logger } from './utils'

const TSCONFIG_FALLBACKS = ['tsconfig.json', 'tsconfig.app.json']

/**
 * 解析 alias 映射，两种优先级：
 * 1. `--alias @/=src,hooks=../hooks/src` — 直接 kv 映射，最高优先级
 * 2. `--tsconfig tsconfig.app.json` — 从 tsconfig 的 paths 读取；未指定时自动查找 tsconfig.json / tsconfig.app.json
 *
 * 返回 Map<prefix, absolutePath>，如 `@/` → `/abs/path/to/src`
 */
export function resolveAliasPaths(
  aliasRaw: string | null,
  tsconfigRaw: string | null,
): Map<string, string> {
  const result = new Map<string, string>()

  const tsconfigPaths = readTsconfigPaths(tsconfigRaw)
  for (const [prefix, absPath] of tsconfigPaths)
    result.set(prefix, absPath)

  if (aliasRaw) {
    const kvPairs = parseAliasKv(aliasRaw)
    for (const [prefix, absPath] of kvPairs)
      result.set(prefix, absPath)
  }

  return result
}

/**
 * 解析 `@/=src,hooks=../hooks/src` 格式的 kv 映射
 * 值按 cwd 解析为绝对路径
 */
export function parseAliasKv(raw: string): Map<string, string> {
  const result = new Map<string, string>()
  const pairs = raw.split(',').map(s => s.trim()).filter(Boolean)

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx <= 0)
      continue

    const key = pair.slice(0, eqIdx).trim()
    const val = pair.slice(eqIdx + 1).trim()
    if (!key || !val)
      continue

    result.set(key, path.resolve(process.cwd(), val))
  }
  return result
}

/** 查找 tsconfig 文件路径：指定 > tsconfig.json > tsconfig.app.json */
function findTsconfigPath(tsconfigRaw: string | null): string | null {
  if (tsconfigRaw) {
    const abs = path.resolve(process.cwd(), tsconfigRaw)
    if (fs.existsSync(abs))
      return abs
    logger.warn(`指定的 tsconfig 不存在: ${tsconfigRaw}`)
    return null
  }

  for (const name of TSCONFIG_FALLBACKS) {
    const abs = path.resolve(process.cwd(), name)
    if (fs.existsSync(abs))
      return abs
  }
  return null
}

/** 从 tsconfig 读取 paths，递归处理 extends */
function readTsconfigPaths(tsconfigRaw: string | null): Map<string, string> {
  const result = new Map<string, string>()
  const tsconfigPath = findTsconfigPath(tsconfigRaw)
  if (!tsconfigPath)
    return result

  const parsed = parseTsconfigWithExtends(tsconfigPath)
  if (!parsed.compilerOptions?.paths)
    return result

  const baseUrl = parsed.compilerOptions.baseUrl ?? '.'
  const tsconfigDir = path.dirname(tsconfigPath)
  const baseDir = path.resolve(tsconfigDir, baseUrl)

  for (const [alias, targets] of Object.entries(parsed.compilerOptions.paths)) {
    if (targets.length === 0)
      continue

    // `@/*` → prefix `@/`，`hooks` → prefix `hooks`
    const prefix = alias.replace(/\/?\*$/, '')
    /** 取第一个 target：`./src/*` → `./src` */
    const target = targets[0].replace(/\/?\*$/, '')
    const absPath = path.resolve(baseDir, target)

    result.set(prefix, absPath)
  }

  logger.info(`从 ${path.relative(process.cwd(), tsconfigPath)} 读取到 ${result.size} 个 alias`)
  return result
}

/**
 * 剥离 JSONC 注释（不破坏字符串内的 `//` `/*`）
 * 逐字符扫描，跟踪是否在字符串内
 */
export function stripJsonComments(src: string): string {
  let out = ''
  let i = 0
  const len = src.length

  while (i < len) {
    const ch = src[i]

    /** 字符串：跳过整段，保留内容 */
    if (ch === '"') {
      let j = i + 1
      while (j < len) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === '"') { j++; break }
        j++
      }
      out += src.slice(i, j)
      i = j
      continue
    }

    /** 单行注释 */
    if (ch === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i++
      continue
    }

    /** 块注释 */
    if (ch === '/' && src[i + 1] === '*') {
      i += 2
      while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }

    out += ch
    i++
  }

  return out
}

/** 解析 tsconfig，递归合并 extends */
function parseTsconfigWithExtends(filePath: string): TsconfigJson {
  const content = fs.readFileSync(filePath, 'utf8')
  const cleaned = stripJsonComments(content).replace(/,(\s*[}\]])/g, '$1')
  const config: TsconfigJson = JSON.parse(cleaned)

  if (!config.extends)
    return config

  const extendsPath = path.resolve(path.dirname(filePath), config.extends)
  if (!fs.existsSync(extendsPath))
    return config

  const parent = parseTsconfigWithExtends(extendsPath)
  return {
    ...parent,
    ...config,
    compilerOptions: {
      ...parent.compilerOptions,
      ...config.compilerOptions,
      paths: {
        ...parent.compilerOptions?.paths,
        ...config.compilerOptions?.paths,
      },
    },
  }
}
