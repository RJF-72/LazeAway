// Raster image loading for engraving: decode a file to a downscaled
// grayscale bitmap (0 black .. 255 white) plus a data URL preview.
//
// Long side is capped so both memory and resulting G-code size stay sane —
// a phone photo at full resolution would generate hundreds of thousands of
// scanlines for no visible gain at laser spot size.

import { rgbaToGray } from '@shared/rasterEngrave'

/** Longest side of the processed bitmap, in pixels. */
export const MAX_IMAGE_SIDE = 1600

export interface LoadedImage {
  /** PNG data URL of the downscaled image (bed preview + library storage). */
  dataUrl: string
  gray: Uint8ClampedArray
  wPx: number
  hPx: number
  /** True if the source was downscaled to fit MAX_IMAGE_SIDE. */
  downscaled: boolean
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
        // Re-encode at the processing size so previews/storage match the bitmap.
        const outUrl = canvas.toDataURL('image/png')
        resolve({ dataUrl: outUrl, gray, wPx, hPx, downscaled: scale < 1 })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = () => reject(new Error('Could not decode the image file.'))
    img.src = dataUrl
  })
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
