import sharp from 'sharp'

const SHARP_OPTS = {
  jpeg: { quality: 82, mozjpeg: true },
  jpg: { quality: 82, mozjpeg: true },
  png: { compressionLevel: 9, quality: 85, effort: 10 },
  webp: { quality: 82, effort: 4 },
  avif: { quality: 70, effort: 4 },
} as const

const FORMAT_TOKEN_MAP: Record<string, '.webp' | '.png' | '.jpg' | '.avif'> = {
  webp: '.webp',
  png: '.png',
  jpg: '.jpg',
  jpeg: '.jpg',
  avif: '.avif',
}

/** CLI / API 未指定 {@link ChooseBestRasterOptions.formatAllowlist} 时的默认额外候选格式 */
export const DEFAULT_FORMAT_ALLOWLIST_EXTENSIONS: readonly string[] = ['.webp', '.png']

/**
 * 将 `webp`、`jpg`、`.png` 等待选格式标记转为带点扩展名并去重（jpeg/jpg 视为同一候选 `.jpg`）。
 * 未知标记静默跳过。
 */
export function normalizeFormatAllowlistTokens(tokens: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tokens) {
    const key = raw.trim().toLowerCase().replace(/^\./, '')
    const ext = FORMAT_TOKEN_MAP[key]
    if (!ext)
      continue
    const dedupe = ext === '.jpg' ? 'jpg' : ext
    if (seen.has(dedupe))
      continue
    seen.add(dedupe)
    out.push(ext)
  }
  return out
}

export type ChooseBestRasterOptions = {
  /**
   * 参与优选的额外输出格式（`webp` / `.webp` 等均可，内部归一化）。
   * 缺省：`webp` + `png`；传 `[]` 表示不做跨格式编码，仅同格式重压缩。
   */
  formatAllowlist?: string[] | null
}

/** jpeg / jpg 归一为同一去重键 */
function extDedupeKey(ext: string): string {
  const l = ext.toLowerCase()
  return l === '.jpeg' ? '.jpg' : l
}

/** 解码并按需缩放，供多路编码复用（每条支路需 clone） */
async function openForEncode(input: Buffer, maxWidth: number | null): Promise<sharp.Sharp> {
  if (!maxWidth)
    return sharp(input)
  const meta = await sharp(input).metadata()
  if (meta.width && meta.width > maxWidth) {
    return sharp(input).resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  return sharp(input)
}

type RasterCandidate = { outExt: string, work: Promise<Buffer> }

function pushEncode(
  outExt: string,
  work: Promise<Buffer>,
  seen: Set<string>,
  out: RasterCandidate[],
) {
  const k = extDedupeKey(outExt)
  if (seen.has(k))
    return
  seen.add(k)
  out.push({ outExt, work })
}

function collectRasterCandidates(
  base: sharp.Sharp,
  sameExt: string,
  allowExtraExts: string[],
): RasterCandidate[] {
  const lo = sameExt.toLowerCase()
  const seen = new Set<string>()
  const out: RasterCandidate[] = []

  if (lo === '.jpg' || lo === '.jpeg') {
    pushEncode(sameExt, base.clone().jpeg(SHARP_OPTS.jpeg).toBuffer(), seen, out)
  }
  else if (lo === '.png') {
    pushEncode(sameExt, base.clone().png(SHARP_OPTS.png).toBuffer(), seen, out)
  }
  else if (lo === '.webp') {
    pushEncode(sameExt, base.clone().webp(SHARP_OPTS.webp).toBuffer(), seen, out)
  }
  else if (lo === '.avif') {
    pushEncode(sameExt, base.clone().avif(SHARP_OPTS.avif).toBuffer(), seen, out)
  }

  for (const targetExt of allowExtraExts) {
    const elo = targetExt.toLowerCase()
    if (elo === '.jpg' || elo === '.jpeg') {
      pushEncode('.jpg', base.clone().jpeg(SHARP_OPTS.jpeg).toBuffer(), seen, out)
    }
    else if (elo === '.png') {
      pushEncode('.png', base.clone().png(SHARP_OPTS.png).toBuffer(), seen, out)
    }
    else if (elo === '.webp') {
      pushEncode('.webp', base.clone().webp(SHARP_OPTS.webp).toBuffer(), seen, out)
    }
    else if (elo === '.avif') {
      pushEncode('.avif', base.clone().avif(SHARP_OPTS.avif).toBuffer(), seen, out)
    }
  }

  return out
}

function resolveExtraFormats(opts?: ChooseBestRasterOptions): string[] {
  const v = opts?.formatAllowlist
  if (v === undefined || v === null)
    return [...DEFAULT_FORMAT_ALLOWLIST_EXTENSIONS]
  return normalizeFormatAllowlistTokens(v)
}

/**
 * 在同格式重压缩与 allowlist 中的目标格式之间取体积最小的一种（固定质量预设）。
 * 任一候选编码失败会被忽略。若无有效候选返回 null。
 */
export async function chooseBestRasterEncoding(
  input: Buffer,
  sameExt: string,
  maxWidth: number | null,
  opts?: ChooseBestRasterOptions,
): Promise<{ buffer: Buffer, outExt: string } | null> {
  const extraExts = resolveExtraFormats(opts)
  const base = await openForEncode(input, maxWidth)
  const candidates = collectRasterCandidates(base, sameExt, extraExts)
  const settled = await Promise.allSettled(
    candidates.map(c => c.work.then(buf => ({ outExt: c.outExt, buf }))),
  )
  const ok: { outExt: string, buffer: Buffer }[] = []
  for (const r of settled) {
    if (r.status !== 'fulfilled')
      continue
    const { outExt, buf } = r.value
    if (buf?.length)
      ok.push({ outExt, buffer: buf })
  }
  if (ok.length === 0)
    return null
  return ok.reduce((a, b) => (a.buffer.length <= b.buffer.length ? a : b))
}

/** 同格式压缩 */
export async function optimizeSameFormat(
  input: Buffer,
  ext: string,
  maxWidth: number | null,
): Promise<Buffer | null> {
  const img = await openForEncode(input, maxWidth)
  const lo = ext.toLowerCase()
  switch (lo) {
    case '.jpg':
    case '.jpeg':
      return img.jpeg(SHARP_OPTS.jpeg).toBuffer()
    case '.png':
      return img.png(SHARP_OPTS.png).toBuffer()
    case '.webp':
      return img.webp(SHARP_OPTS.webp).toBuffer()
    case '.avif':
      return img.avif(SHARP_OPTS.avif).toBuffer()
    default:
      return null
  }
}

/** 编码为 webp */
export async function encodeWebp(
  input: Buffer,
  maxWidth: number | null,
): Promise<Buffer> {
  const base = await openForEncode(input, maxWidth)
  return base.webp(SHARP_OPTS.webp).toBuffer()
}
