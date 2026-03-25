# optimize-assets-size

栅格图体积优化工具：在 JPEG / PNG / WebP / AVIF 间自动优选最小编码 / 自动重写 import 路径

直接写回源文件以减小 Git 体积（与 Vite 构建期 imagetools 等无关）

[English](./README.en.md) | **中文**

## 安装

```bash
pnpm add @jl-org/optimize-assets-size sharp -D
```

## CLI 用法

```bash
npx optimize-assets-size --dirs=src/assets,public [options]
```

### 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--dirs=a,b` | **必填**，逗号分隔多个根目录（相对 cwd） | - |
| `--tsconfig=path` | 指定 tsconfig 路径读取 paths | 自动查找 `tsconfig.json` / `tsconfig.app.json` |
| `--alias kv` | kv 映射覆盖 alias（优先级最高），如 `@/=src,hooks=lib` | - |
| `--dry-run` | 预览模式，不实际写文件 | `false` |
| `--force` | 强制覆盖（即使压后更大） | `false` |
| `--rewrite-imports` | 自动替换源码中的 alias 路径 | `false` |
| `--max-width=N` | 限制最大宽度（>= 16） | 不限制 |
| `--formats=a,b` | 参与优选的**额外**输出格式：`webp` / `png` / `jpg` / `jpeg` / `avif`（与同格式重压缩一起比体积） | `webp,png` |
| `--formats=` | 空值：不做跨格式编码，**仅**同格式重压缩 | - |

### 示例

```bash
# 预览压缩效果
npx optimize-assets-size --dirs=src --dry-run

# 自动优选编码 + 重写 import（扩展名变化时从 tsconfig 读 alias）
npx optimize-assets-size --dirs=src,public \
  --tsconfig=tsconfig.app.json \
  --rewrite-imports

# 手动指定 alias 映射（优先级高于 tsconfig）
npx optimize-assets-size --dirs=src \
  --alias "@/=src,hooks=../hooks/src" \
  --rewrite-imports

# 限制最大宽度为 1920px
npx optimize-assets-size --dirs=src --max-width=1920

# 只在 webp / avif 中选（并与同格式比较）
npx optimize-assets-size --dirs=src --formats=webp,avif

# 只做同格式压缩，不转其它格式
npx optimize-assets-size --dirs=src --formats=
```

### Alias 解析优先级

1. `--alias` kv 映射 — **最高优先级**，直接覆盖
2. `--tsconfig` 读取 `compilerOptions.paths` — 未指定时自动查找 `tsconfig.json` → `tsconfig.app.json`

## API 用法

```ts
import {
  chooseBestRasterEncoding,
  collectRasterFiles,
  computeAliasRewrites,
  encodeWebp,
  optimizeSameFormat,
  parseArgs,
  resolveAliasPaths,
  stripJsonComments,
} from 'optimize-assets-size'
import fs from 'node:fs'

// 解析 tsconfig 获取 alias 映射
const aliasPaths = resolveAliasPaths(null, 'tsconfig.app.json')

// 收集所有栅格图文件
const files = await collectRasterFiles(['src/assets'])

const buf = fs.readFileSync('photo.jpg')

// 同格式压缩
const optimized = await optimizeSameFormat(buf, '.jpg', 1920)

// 默认与同格式一起比较 webp + png；传 [] 则仅同格式
const best = await chooseBestRasterEncoding(buf, '.jpg', 1920)
const bestAvif = await chooseBestRasterEncoding(buf, '.jpg', 1920, {
  formatAllowlist: ['webp', 'avif'],
})
const sameOnly = await chooseBestRasterEncoding(buf, '.jpg', 1920, {
  formatAllowlist: [],
})

// 仅转 WebP（程序 API）
const webp = await encodeWebp(buf, 1920)

// 计算 import 路径替换对（目标扩展名以 best.outExt 为准）
const rewrites = computeAliasRewrites(
  '/project/src/assets/logo.png',
  '/project/src/assets/logo.webp',
  aliasPaths,
)
```

## 压缩参数

| 格式 | 参数 |
|------|------|
| JPEG | quality: 82, mozjpeg: true |
| PNG | compressionLevel: 9, quality: 85, effort: 10 |
| WebP | quality: 82, effort: 4 |
| AVIF | quality: 70, effort: 4 |

## License

MIT
