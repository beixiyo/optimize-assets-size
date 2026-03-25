# optimize-assets-size

Raster image size optimization tool: auto-pick smallest JPEG/PNG/WebP/AVIF encoding, auto-rewrite import paths.

Writes back to source files directly to reduce Git repository size (unrelated to Vite build-time imagetools).

**English** | [中文](./README.md)

## Install

```bash
pnpm add @jl-org/optimize-assets-size sharp -D
```

## CLI Usage

```bash
npx optimize-assets-size --dirs=src/assets,public [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dirs=a,b` | **Required**, comma-separated root directories (relative to cwd) | - |
| `--tsconfig=path` | Specify tsconfig path to read paths | Auto-detect `tsconfig.json` / `tsconfig.app.json` |
| `--alias kv` | KV mapping to override alias (highest priority), e.g. `@/=src,hooks=lib` | - |
| `--dry-run` | Preview mode, no files written | `false` |
| `--force` | Force overwrite (even if compressed size is larger) | `false` |
| `--rewrite-imports` | Auto-replace alias paths in source code | `false` |
| `--max-width=N` | Max width constraint (>= 16) | No limit |
| `--formats=a,b` | Extra output formats to try (with same-format recompress): `webp` / `png` / `jpg` / `jpeg` / `avif` | `webp,png` |
| `--formats=` | Empty: no cross-format encodes, **only** same-format recompression | - |

### Examples

```bash
# Preview compression results
npx optimize-assets-size --dirs=src --dry-run

# Auto-pick encoding + rewrite imports (reads alias from tsconfig when extension changes)
npx optimize-assets-size --dirs=src,public \
  --tsconfig=tsconfig.app.json \
  --rewrite-imports

# Manual alias mapping (overrides tsconfig)
npx optimize-assets-size --dirs=src \
  --alias "@/=src,hooks=../hooks/src" \
  --rewrite-imports

# Limit max width to 1920px
npx optimize-assets-size --dirs=src --max-width=1920

# Only consider webp / avif vs same-format
npx optimize-assets-size --dirs=src --formats=webp,avif

# Same-format only, no conversion
npx optimize-assets-size --dirs=src --formats=
```

### Alias Resolution Priority

1. `--alias` KV mapping — **Highest priority**, directly overrides
2. `--tsconfig` reads `compilerOptions.paths` — auto-detects `tsconfig.json` → `tsconfig.app.json` when not specified

## API Usage

```ts
import {
  chooseBestRasterEncoding,
  collectRasterFiles,
  computeAliasRewrites,
  encodeWebp,
  optimizeSameFormat,
  resolveAliasPaths,
  stripJsonComments,
} from 'optimize-assets-size'
import fs from 'node:fs'

// Parse tsconfig to get alias mappings
const aliasPaths = resolveAliasPaths(null, 'tsconfig.app.json')

// Collect all raster image files
const files = await collectRasterFiles(['src/assets'])

const buf = fs.readFileSync('photo.jpg')

// Same-format compress
const optimized = await optimizeSameFormat(buf, '.jpg', 1920)

// Default compares same-format with webp + png; [] means same-format only
const best = await chooseBestRasterEncoding(buf, '.jpg', 1920)
const bestAvif = await chooseBestRasterEncoding(buf, '.jpg', 1920, {
  formatAllowlist: ['webp', 'avif'],
})
const sameOnly = await chooseBestRasterEncoding(buf, '.jpg', 1920, {
  formatAllowlist: [],
})

// WebP only (programmatic API)
const webp = await encodeWebp(buf, 1920)

// Import path rewrites (use best.outExt for the target path)
const rewrites = computeAliasRewrites(
  '/project/src/assets/logo.png',
  '/project/src/assets/logo.webp',
  aliasPaths,
)
```

## Compression Settings

| Format | Parameters |
|--------|------------|
| JPEG | quality: 82, mozjpeg: true |
| PNG | compressionLevel: 9, quality: 85, effort: 10 |
| WebP | quality: 82, effort: 4 |
| AVIF | quality: 70, effort: 4 |

## License

MIT
