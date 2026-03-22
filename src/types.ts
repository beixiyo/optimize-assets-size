/** CLI 解析后的完整配置 */
export interface OptimizeConfig {
  dirs: string[]
  dryRun: boolean
  force: boolean
  toWebp: boolean
  rewriteImports: boolean
  maxWidth: number | null
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
