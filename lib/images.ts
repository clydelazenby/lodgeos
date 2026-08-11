/**
 * Making a phone photograph fit on a web page, in the browser, before
 * it is ever uploaded.
 *
 * WHY NOT ON THE SERVER. A photo off a current phone is 12 megapixels
 * and 4–6MB. Twenty of them is a 100MB gallery and a public page that
 * takes half a minute on the church car park's signal — and resizing
 * them server-side means holding a decoded bitmap in a serverless
 * function and shipping an image library to do a job the machine
 * holding the photograph can do instantly, for free, before spending
 * the visitor's data on the original at all.
 *
 * TWO RENDITIONS, because a grid and a lightbox want different things:
 *
 *   display   long edge 1600px — sharp full-screen on a laptop, and a
 *             fraction of the original's weight.
 *   thumb     long edge 480px — what the grid actually shows. Twenty of
 *             these is the difference between a gallery that appears
 *             and one that loads.
 *
 * ASPECT RATIO IS NEVER CHANGED. A lodge photograph is a record of
 * something that happened; cropping it to fit a tidy square is the
 * app deciding what part of the lodge's own history to throw away. The
 * grid crops for DISPLAY with object-fit, which is reversible; this is
 * not.
 */

export type Rendition = {
  blob: Blob
  width: number
  height: number
}

export type PreparedImage = {
  display: Rendition
  thumb: Rendition
  /** The original's dimensions, for the record. */
  width: number
  height: number
}

const DISPLAY_EDGE = 1600
const THUMB_EDGE = 480

/**
 * JPEG for photographs, always — even from a PNG source.
 *
 * A camera photograph saved as PNG is several times larger for no
 * visible gain, because PNG is lossless and a photograph has no flat
 * colour for it to exploit. The one thing PNG offers that JPEG does not
 * is transparency, which a photograph does not have.
 */
const OUTPUT_TYPE = 'image/jpeg'
const DISPLAY_QUALITY = 0.86
const THUMB_QUALITY = 0.78

function scaled(width: number, height: number, longEdge: number) {
  const longest = Math.max(width, height)
  // NEVER UPSCALE. Blowing a small scan up to 1600px adds bytes and no
  // detail, and makes a soft image look worse than it is.
  if (longest <= longEdge) return { width, height }
  const ratio = longEdge / longest
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

async function render(
  source: ImageBitmap,
  longEdge: number,
  quality: number
): Promise<Rendition> {
  const { width, height } = scaled(source.width, source.height, longEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not prepare the image.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUTPUT_TYPE, quality)
  )
  if (!blob) throw new Error('This browser could not prepare the image.')
  return { blob, width, height }
}

/**
 * @throws if the file is not an image the browser can decode — which is
 *         the honest answer for a renamed .jpg that is really a PDF, and
 *         better caught here than as a broken thumbnail on the lodge's
 *         front page.
 */
export async function prepareForGallery(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const [display, thumb] = await Promise.all([
      render(bitmap, DISPLAY_EDGE, DISPLAY_QUALITY),
      render(bitmap, THUMB_EDGE, THUMB_QUALITY),
    ])
    return { display, thumb, width: bitmap.width, height: bitmap.height }
  } finally {
    // Frees the decoded bitmap immediately rather than waiting for the
    // collector. Twenty 12-megapixel decodes held at once is how a
    // phone browser runs out of memory part-way through an upload.
    bitmap.close()
  }
}

export function fileFrom(rendition: Rendition, name: string): File {
  return new File([rendition.blob], name, { type: OUTPUT_TYPE })
}

/** "2.4 MB" — for telling an officer what he just saved. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
