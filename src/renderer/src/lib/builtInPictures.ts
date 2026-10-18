// Built-in picture templates: colorless outline (line art) PNGs bundled
// with the app. Generated from the operator's photos with
// scripts/make-outline-pngs.py — black lines on white, no color, so they
// engrave exactly as shown. Imported as Vite assets so they resolve in
// both dev and the packaged (file://) Electron build.

import bluebonnetUrl from '../assets/bluebonnet-outline.png'
import cactusUrl from '../assets/cactus-outline.png'
import texasUrl from '../assets/texas-outline.png'

export interface BuiltInPicture {
  id: string
  name: string
  detail: string
  /** Bundled asset URL (dev + packaged build). */
  url: string
}

export const BUILT_IN_PICTURES: BuiltInPicture[] = [
  {
    id: 'bluebonnet',
    name: 'Bluebonnet',
    detail: 'State flower • outline',
    url: bluebonnetUrl,
  },
  {
    id: 'cactus',
    name: 'Prickly Pear Cactus',
    detail: 'Desert • outline',
    url: cactusUrl,
  },
  {
    id: 'texas',
    name: 'Texas Outline + Star',
    detail: 'Lone Star • outline',
    url: texasUrl,
  },
]
