// Raster image loading for engraving: decode a file to a downscaled
// grayscale bitmap (0 black .. 255 white) plus a data URL preview.
//
// Long side is capped so both memory and resulting G-code size stay sane —
// a phone photo at full resolution would generate hundreds of thousands of
// scanlines for no visible gain at laser spot size.
//
// Colorless by construction: the preview data URL is re-encoded from the
// grayscale bitmap, never from the original color pixels, so nothing the
// operator sees on the bed can carry color into a job. An edge-outline
// (line art) variant is computed alongside for the Outline toggle.

import { rgbaToGray, toOutlineBitmap } from '@shared/rasterEngrave'

/** Longest side of the processed bitmap, in pixels. */
export const MAX_IMAGE_SIDE = 1600

/** Outline line weight range, in pixels (1 thin .. 5 bold). */
export const OUTLINE_MIN_PX = 1
export const OUTLINE_MAX_PX = 5
export const OUTLINE_DEFAULT_PX = 2

export interface LoadedImage {
  /** PNG data URL of the downscaled GRAYSCALE image (bed preview + library). */
  dataUrl: string
  gray: Uint8ClampedArray
  wPx: number
  hPx: number
  /** True if the source was downscaled to fit MAX_IMAGE_SIDE. */
  downscaled: boolean
  /** Edge-outline (line art) variant of `gray`: black lines on white. */
  outlineGray: Uint8ClampedArray
  /** PNG data URL of the outline variant (bed preview in Outline mode). */
  outlineDataUrl: string
  /** Line weight (px) used to build `outlineGray`. */
  outlineThickness: number
}

/** Clamp a requested outline line weight into the supported 1..5px range. */
export function clampOutlineThickness(px: number): number {
  if (!Number.isFinite(px)) return OUTLINE_DEFAULT_PX
  return Math.max(OUTLINE_MIN_PX, Math.min(OUTLINE_MAX_PX, Math.round(px)))
}

/**
 * Build an outline (line art) variant of a grayscale bitmap at the requested
 * line weight. Kept separate from loading so the Outline thickness control
 * can re-render the preview + G-code without re-decoding the source image.
 */
export function buildOutlineVariant(
  gray: Uint8ClampedArray,
  wPx: number,
  hPx: number,
  thickness: number,
): { outlineGray: Uint8ClampedArray; outlineDataUrl: string } {
  const outlineGray = toOutlineBitmap(gray, wPx, hPx, 45, clampOutlineThickness(thickness))
  return { outlineGray, outlineDataUrl: grayToDataUrl(outlineGray, wPx, hPx) }
}

const ACCEPTED = /^image\/(png|jpe?g|webp|bmp|gif|x-icon|avif)$/i

export function isSupportedImageFile(file: File): boolean {
  return ACCEPTED.test(file.type) || /\.(png|jpe?g|webp|bmp|gif|ico|avif)$/i.test(file.name)
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!isSupportedImageFile(file)) {
    throw new Error(`"${file.name}" is not a supported image type (use PNG, JPG or WebP).`)
  }
  const dataUrl = await readAsDataUrl(file)
  return loadImageDataUrl(dataUrl)
}

export function loadImageDataUrl(dataUrl: string): Promise<LoadedImage> {
  return loadImageFromSrc(dataUrl)
}

/**
 * Decode any image src — a data URL or a bundled relative URL (built-in
 * pictures) — to a grayscale bitmap + colorless previews. `new Image()`
 * handles both, including file:// relative URLs in the packaged app.
 */
export function loadImageFromSrc(src: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const ow = img.naturalWidth
        const oh = img.naturalHeight
        if (ow < 1 || oh < 1) {
          reject(new Error('The image has zero dimensions.'))
          return
        }
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(ow, oh))
        const wPx = Math.max(1, Math.round(ow * scale))
        const hPx = Math.max(1, Math.round(oh * scale))

        const canvas = document.createElement('canvas')
        canvas.width = wPx
        canvas.height = hPx
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas is unavailable — cannot decode the image.'))
          return
        }
        ctx.drawImage(img, 0, 0, wPx, hPx)
        const rgba = ctx.getImageData(0, 0, wPx, hPx).data
        const gray = rgbaToGray(rgba, wPx, hPx)
        // Re-encode previews from the bitmaps, never from the color draw:
        // the bed preview cannot show color the engraver won't burn.
        const dataUrl = grayToDataUrl(gray, wPx, hPx)
        const { outlineGray, outlineDataUrl } = buildOutlineVariant(
          gray,
          wPx,
          hPx,
          OUTLINE_DEFAULT_PX,
        )
        resolve({
          dataUrl,
          gray,
          wPx,
          hPx,
          downscaled: scale < 1,
          outlineGray,
          outlineDataUrl,
          outlineThickness: OUTLINE_DEFAULT_PX,
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = () => reject(new Error('Could not decode the image file.'))
    img.src = src
  })
}

/** Encode a grayscale bitmap as a PNG data URL (R=G=B=gray, opaque). */
export function grayToDataUrl(gray: Uint8ClampedArray, wPx: number, hPx: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = wPx
  canvas.height = hPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable — cannot encode the image.')
  const rgba = new Uint8ClampedArray(wPx * hPx * 4)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    rgba[p] = gray[i]
    rgba[p + 1] = gray[i]
    rgba[p + 2] = gray[i]
    rgba[p + 3] = 255
  }
  ctx.putImageData(new ImageData(rgba, wPx, hPx), 0, 0)
  return canvas.toDataURL('image/png')
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read the file.'))
    }
    reader.onerror = () => reject(new Error('Failed to read the file.'))
    reader.readAsDataURL(file)
  })
}
