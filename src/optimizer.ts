import sharp from 'sharp'

const SHARP_OPTS = {
  jpeg: { quality: 82, mozjpeg: true },
  jpg: { quality: 82, mozjpeg: true },
  png: { compressionLevel: 9, quality: 85, effort: 10 },
  webp: { quality: 82, effort: 4 },
  avif: { quality: 70, effort: 4 },
} as const

/** 同格式压缩 */
export async function optimizeSameFormat(
  input: Buffer,
  ext: string,
  maxWidth: number | null,
): Promise<Buffer | null> {
  let img = sharp(input)

  if (maxWidth) {
    const meta = await img.metadata()
    if (meta.width && meta.width > maxWidth) {
      img = sharp(input).resize(maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
  }

  switch (ext) {
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
  let img = sharp(input)

  if (maxWidth) {
    const meta = await img.metadata()
    if (meta.width && meta.width > maxWidth) {
      img = sharp(input).resize(maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
  }

  return img.webp(SHARP_OPTS.webp).toBuffer()
}
