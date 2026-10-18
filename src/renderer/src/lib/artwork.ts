// Unified model for whatever job the operator has loaded: a built-in
// template, an imported SVG (vector), or an imported picture (raster).
// Parsing lives here so App and the import UI share one code path.

import type { TemplateGeometry } from '@shared/templateGeometry'
import { parseSvg, type SvgImportResult } from './svgImport'
import {
  loadImageFile,
  loadImageDataUrl,
  loadImageFromSrc,
  buildOutlineVariant,
  clampOutlineThickness,
  OUTLINE_DEFAULT_PX,
  type LoadedImage,
} from './imageImport'

export interface VectorArtwork {
  kind: 'vector'
  name: string
  /** Natural-size geometry (mm, centered) before user sizing. */
  geometry: TemplateGeometry
}

export interface ImageArtwork {
  kind: 'image'
  name: string
  /** ACTIVE data URL for the bed preview (grayscale or outline variant). */
  dataUrl: string
  /** ACTIVE luminance bitmap for G-code (0 black .. 255 white). */
  gray: Uint8ClampedArray
  wPx: number
  hPx: number
  /** Grayscale original — the Outline-off variant. */
  baseGray: Uint8ClampedArray
  baseDataUrl: string
  /** Edge-outline (line art) variant — the Outline-on variant. */
  outlineGray: Uint8ClampedArray
  outlineDataUrl: string
  /** Line weight in pixels (1..5) used to build the outline variant. */
  outlineThickness: number
  /** True when the outline variant is the active one. */
  outline: boolean
  /** True for built-in picture templates (already outlines by nature). */
  builtIn?: boolean
}

export type LoadedArtwork = VectorArtwork | ImageArtwork

/**
 * Return the artwork with the Outline mode applied (or un-applied). For
 * images this swaps the active bitmap + preview between the grayscale
 * original and the edge-outline variant, so what the bed shows is exactly
 * what the G-code burns. Vectors pass through unchanged.
 */
export function setArtworkOutline(artwork: LoadedArtwork, outline: boolean): LoadedArtwork {
  if (artwork.kind !== 'image' || artwork.outline === outline) return artwork
  return {
    ...artwork,
    outline,
    gray: outline ? artwork.outlineGray : artwork.baseGray,
    dataUrl: outline ? artwork.outlineDataUrl : artwork.baseDataUrl,
  }
}

/**
 * Re-render the outline (line art) variant at a new line weight (1..5 px).
 * The bed preview and the G-code both read the ACTIVE bitmap, so they follow
 * the new weight together. Vectors and built-in pictures pass through.
 */
export function setImageOutlineThickness(
  artwork: LoadedArtwork,
  thickness: number,
): LoadedArtwork {
  if (artwork.kind !== 'image' || artwork.builtIn) return artwork
  const px = clampOutlineThickness(thickness)
  if (artwork.outlineThickness === px) return artwork
  const { outlineGray, outlineDataUrl } = buildOutlineVariant(
    artwork.baseGray,
    artwork.wPx,
    artwork.hPx,
    px,
  )
  return {
    ...artwork,
    outlineGray,
    outlineDataUrl,
    outlineThickness: px,
    gray: artwork.outline ? outlineGray : artwork.baseGray,
    dataUrl: artwork.outline ? outlineDataUrl : artwork.baseDataUrl,
  }
}

function imageArtworkFromLoaded(name: string, img: LoadedImage): ImageArtwork {
  return {
    kind: 'image',
    name,
    dataUrl: img.dataUrl,
    gray: img.gray,
    wPx: img.wPx,
    hPx: img.hPx,
    baseGray: img.gray,
    baseDataUrl: img.dataUrl,
    outlineGray: img.outlineGray,
    outlineDataUrl: img.outlineDataUrl,
    outlineThickness: img.outlineThickness ?? OUTLINE_DEFAULT_PX,
    outline: false,
  }
}

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
      artwork: imageArtworkFromLoaded(file.name, img),
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
      artwork: imageArtworkFromLoaded(name, img),
      warnings: [],
      downscaled: img.downscaled,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Load a built-in picture template. Built-ins are already outline line
 * art, so both variants point at the same decoded bitmap — the Outline
 * toggle is a no-op for them (and disabled in the UI).
 */
export async function loadArtworkFromSrc(
  name: string,
  src: string,
): Promise<ArtworkLoadResult> {
  try {
    const img = await loadImageFromSrc(src)
    const artwork: ImageArtwork = {
      kind: 'image',
      name,
      dataUrl: img.dataUrl,
      gray: img.gray,
      wPx: img.wPx,
      hPx: img.hPx,
      baseGray: img.gray,
      baseDataUrl: img.dataUrl,
      outlineGray: img.gray,
      outlineDataUrl: img.dataUrl,
      outlineThickness: OUTLINE_DEFAULT_PX,
      outline: false,
      builtIn: true,
    }
    return { ok: true, artwork, warnings: [], downscaled: img.downscaled }
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
