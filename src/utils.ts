import path from 'node:path'
import process from 'node:process'
import { NodeLogger } from '@jl-org/log/node'

export const logger = new NodeLogger({ prefix: 'optimize-assets' })

function normalizeDisplayPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

/** 相对路径按 process.cwd() 解析，绝对路径原样返回 */
export function resolveFromCwd(p: string): string {
  const t = p.trim()
  if (!t)
    return ''
  if (path.isAbsolute(t))
    return path.normalize(t)
  return path.resolve(process.cwd(), t)
}

/** 日志用：优先相对 cwd 的短路径 */
export function relForLog(absPath: string): string {
  const fromCwd = normalizeDisplayPath(path.relative(process.cwd(), absPath))
  if (fromCwd && !fromCwd.startsWith('..') && !path.isAbsolute(fromCwd))
    return fromCwd
  return normalizeDisplayPath(absPath)
}

export function formatKb(n: number): string {
  return `${(n / 1024).toFixed(2)} kB`
}
