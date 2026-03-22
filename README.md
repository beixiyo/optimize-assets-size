# optimize-assets-size

栅格图体积优化工具：压缩 / 转 WebP / 自动重写 import 路径。

直接写回源文件以减小 Git 体积（与 Vite 构建期 imagetools 等无关）。

[English](./README.en.md) | **中文**

## 安装

```bash
pnpm add optimize-assets-size sharp -D
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
| `--to-webp` | 非 webp 文件转为 .webp 并删除原文件 | `false` |
| `--rewrite-imports` | 自动替换源码中的 alias 路径 | `false` |
| `--max-width=N` | 限制最大宽度（>= 16） | 不限制 |

### 示例

```bash
# 预览压缩效果
npx optimize-assets-size --dirs=src/assets --dry-run

# 转 WebP + 自动重写 import（从 tsconfig 读取 alias）
npx optimize-assets-size --dirs=src/assets,public \
  --tsconfig=tsconfig.app.json \
  --to-webp --rewrite-imports

# 手动指定 alias 映射（优先级高于 tsconfig）
npx optimize-assets-size --dirs=src/assets \
  --alias "@/=src,hooks=../hooks/src" \
  --to-webp --rewrite-imports

# 限制最大宽度为 1920px
npx optimize-assets-size --dirs=src/assets --max-width=1920
```

### Alias 解析优先级

1. `--alias` kv 映射 — **最高优先级**，直接覆盖
2. `--tsconfig` 读取 `compilerOptions.paths` — 未指定时自动查找 `tsconfig.json` → `tsconfig.app.json`

## API 用法

```ts
import {
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

// 压缩单个文件（同格式）
const buf = fs.readFileSync('photo.jpg')
const optimized = await optimizeSameFormat(buf, '.jpg', 1920)

// 转 WebP
const webp = await encodeWebp(buf, 1920)

// 计算 import 路径替换对
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
