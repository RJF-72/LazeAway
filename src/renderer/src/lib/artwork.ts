// Unified model for whatever job the operator has loaded: a built-in
// template, an imported SVG (vector), or an imported picture (raster).
// Parsing lives here so App and the import UI share one code path.

import type { TemplateGeometry } from '@shared/templateGeometry'
import { parseSvg, type SvgImportResult } from './svgImport'
import { loadImageFile, loadImageDataUrl, type LoadedImage } from './imageImport'

export interface VectorArtwork {
  kind: 'vector'
  name: string
  /** Natural-size geometry (mm, centered) before user sizing. */
  geometry: TemplateGeometry
}

export interface ImageArtwork {
  kind: 'image'
  name: string
  /** Data URL for the bed preview and library storage. */
  dataUrl: string
  /** Downscaled luminance bitmap, 0 black .. 255 white. */
  gray: Uint8ClampedArray
  wPx: number
  hPx: number
}

export type LoadedArtwork = VectorArtwork | ImageArtwork

export type ArtworkLoadResult =
  | { ok: true; artwork: LoadedArtwork; warnings: string[]; downscaled: boolean }
  | { ok: false; error: string }

const SVG_EXT = /\.svg$/i

/** Load artwork from a picked file (SVG or raster image). */
export async function loadArtworkFromFile(file: File): Promise<ArtworkLoadResult> {
  if (SVG_EXT.test(file.name) || file.type === 'image/svg+xml') {
    const text = await file.text()
    return applySvg(file.name, text)
  }
  try {
    const img: LoadedImage = await loadImageFile(file)
    return {
      ok: true,
      artwork: {
        kind: 'image',
        name: file.name,
        dataUrl: img.dataUrl,
        gray: img.gray,
        wPx: img.wPx,
        hPx: img.hPx,
      },
      warnings: img.downscaled
        ? [`Image downscaled to ${img.wPx}×${img.hPx}px for engraving.`]
        : [],
      downscaled: img.downscaled,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Load artwork from an entry in the saved library. */
export async function loadArtworkFromLibrary(
  name: string,
  kind: 'vector' | 'image',
  ext: string,
  bytesBase64: string,
): Promise<ArtworkLoadResult> {
  if (kind === 'vector') {
    const text = atob(bytesBase64)
    // atob returns latin1; SVGs are UTF-8 — re-decode properly.
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0))
    const svgText = new TextDecoder('utf-8').decode(bytes)
    return applySvg(name, svgText)
  }
  const mime = mimeForExt(ext)
  try {
    const img = await loadImageDataUrl(`data:${mime};base64,${bytesBase64}`)
    return {
      ok: true,
      artwork: {
        kind: 'image',
        name,
        dataUrl: img.dataUrl,
        gray: img.gray,
        wPx: img.wPx,
        hPx: img.hPx,
      },
      warnings: [],
      downscaled: img.downscaled,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function applySvg(name: string, text: string): ArtworkLoadResult {
  const res: SvgImportResult | { ok: false; error: string } = parseSvg(text)
  if (!res.ok) return { ok: false, error: res.error }
  return {
    ok: true,
    artwork: { kind: 'vector', name, geometry: res.geometry },
    warnings: res.warnings,
    downscaled: false,
  }
}

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'bmp':
      return 'image/bmp'
    default:
      return 'image/png'
  }
}

/** PNG data URL bytes → base64 (no prefix) for library storage. */
export function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(',')
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
}
