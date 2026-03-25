/** CLI 解析后的完整配置 */
export interface OptimizeConfig {
  dirs: string[]
  dryRun: boolean
  force: boolean
  rewriteImports: boolean
  maxWidth: number | null
  /**
   * 参与体积优选的额外输出格式（已归一为带点扩展名，如 `.webp`）。
   * 始终会与「同格式重压缩」一起做候选；空数组表示只做同格式、不尝试转其它格式。
   * CLI 未传 `--formats` 时默认 `['.webp', '.png']`。
   */
  formatAllowlist: string[]
  /** 解析后的 alias 映射：prefix → absolutePath */
  aliasPaths: Map<string, string>
}

/** tsconfig.json 中 compilerOptions.paths 的结构 */
export interface TsconfigPaths {
  [alias: string]: string[]
}

export interface TsconfigCompilerOptions {
  baseUrl?: string
  paths?: TsconfigPaths
}

export interface TsconfigJson {
  compilerOptions?: TsconfigCompilerOptions
  extends?: string
}
