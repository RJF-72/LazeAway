// Photo tone presets for webcam snapshots. Each material in the library
// carries one of these; applying the material sets the camera exposure the
// operator tuned for that stock. The operator can always override per shot.

export type PhotoTone = 'very light' | 'light' | 'medium' | 'darker' | 'dark'

export const PHOTO_TONES: PhotoTone[] = ['very light', 'light', 'medium', 'darker', 'dark']

/** Snapshot brightness filter % for each tone. */
export const PHOTO_TONE_BRIGHTNESS: Record<PhotoTone, number> = {
  'very light': 165,
  light: 130,
  medium: 100,
  darker: 72,
  dark: 48,
}

export function isPhotoTone(v: unknown): v is PhotoTone {
  return typeof v === 'string' && (PHOTO_TONES as string[]).includes(v)
}
