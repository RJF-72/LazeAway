import { useCallback, useEffect, useRef, useState } from 'react'
import { useLaser } from '../hooks/useLaser'
import { Btn, Panel } from './ui'
import type { ArtworkEntry } from '@shared/types'
import type { LoadedArtwork } from '../lib/artwork'
import {
  loadArtworkFromFile,
  loadArtworkFromLibrary,
  loadArtworkFromSrc,
  dataUrlToBase64,
} from '../lib/artwork'
import { BUILT_IN_PICTURES, type BuiltInPicture } from '../lib/builtInPictures'

export interface ArtworkPanelProps {
  active: LoadedArtwork | null
  /** Called with freshly parsed artwork (or null to clear). */
  onArtwork: (artwork: LoadedArtwork | null) => void
}

const ACCEPT = '.svg,.png,.jpg,.jpeg,.webp,.bmp,.gif'

export function ArtworkPanel({ active, onArtwork }: ArtworkPanelProps) {
  const { pushLog } = useLaser()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [library, setLibrary] = useState<ArtworkEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshLibrary = useCallback(async () => {
    try {
      setLibrary(await window.laser.artworkList())
    } catch {
      // Library is optional — ignore load failures.
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  const report = (warnings: string[]) => {
    for (const w of warnings) pushLog(w, 'error')
  }

  const saveToLibrary = async (
    name: string,
    kind: 'vector' | 'image',
    ext: string,
    bytesBase64: string,
  ) => {
    try {
      await window.laser.artworkSave({ name, kind, ext, bytesBase64 })
      await refreshLibrary()
    } catch (err) {
      pushLog(`Artwork not saved: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const res = await loadArtworkFromFile(file)
      if (!res.ok) {
        setError(res.error)
        pushLog(`Import failed: ${res.error}`, 'error')
      } else {
        onArtwork(res.artwork)
        report(res.warnings)
        pushLog(
          `Loaded "${file.name}" (${res.artwork.kind === 'vector' ? 'vector' : 'image'})`,
          'info',
        )
        // Auto-save to the local library (original bytes).
        const isSvg = res.artwork.kind === 'vector'
        const ext = isSvg ? 'svg' : (file.name.split('.').pop() ?? 'png')
        if (isSvg) {
          const bytes = new Uint8Array(await file.arrayBuffer())
          let bin = ''
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
          await saveToLibrary(file.name, 'vector', ext, btoa(bin))
        } else if (res.artwork.kind === 'image') {
          await saveToLibrary(file.name, 'image', ext, dataUrlToBase64(res.artwork.dataUrl))
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      pushLog(`Import failed: ${msg}`, 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onLoadBuiltIn = async (picture: BuiltInPicture) => {
    setBusy(true)
    setError(null)
    try {
      const res = await loadArtworkFromSrc(picture.name, picture.url)
      if (!res.ok) {
        setError(res.error)
        pushLog(`Load failed: ${res.error}`, 'error')
      } else {
        onArtwork(res.artwork)
        report(res.warnings)
        pushLog(`Loaded "${picture.name}" (Texas picture • outline)`, 'info')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      pushLog(`Load failed: ${msg}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onLoadEntry = async (entry: ArtworkEntry) => {
    setBusy(true)
    setError(null)
    try {
      const file = await window.laser.artworkLoad(entry.id)
      if (!file) {
        setError('Saved artwork file is missing from disk.')
        return
      }
      const res = await loadArtworkFromLibrary(file.name, file.kind, file.ext, file.bytesBase64)
      if (!res.ok) {
        setError(res.error)
        pushLog(`Load failed: ${res.error}`, 'error')
      } else {
        onArtwork(res.artwork)
        report(res.warnings)
        pushLog(`Loaded "${entry.name}" from library`, 'info')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      pushLog(`Load failed: ${msg}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onDeleteEntry = async (entry: ArtworkEntry) => {
    try {
      await window.laser.artworkDelete(entry.id)
      await refreshLibrary()
      if (active?.name === entry.name) onArtwork(null)
      pushLog(`Deleted "${entry.name}" from library`, 'info')
    } catch (err) {
      pushLog(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  return (
    <Panel title="Your Artwork">
      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void onPickFile(e.target.files?.[0])}
        />
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="gantry"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            title="Import an SVG (vector cut/engrave)"
          >
            Import SVG…
          </Btn>
          <Btn
            variant="gantry"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            title="Import a photo from your computer (PNG/JPG) — shown colorless, Outline toggle in Cut Control"
          >
            Import Photo…
          </Btn>
        </div>

        {error && (
          <div className="rounded border border-[#ef4444] bg-[#ef4444]/10 px-2 py-1.5 text-[11px] text-[#ef4444]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className="panel-title">Texas pictures — outlines</span>
          <span className="text-[10px] text-[#6b7280] font-mono">
            {BUILT_IN_PICTURES.length}
          </span>
        </div>
        <p className="text-[11px] text-[#6b7280] leading-relaxed">
          Built-in colorless outlines — what you see is what the laser burns.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BUILT_IN_PICTURES.map((picture) => (
            <button
              key={picture.id}
              type="button"
              disabled={busy}
              onClick={() => void onLoadBuiltIn(picture)}
              title={`${picture.name} — ${picture.detail}. Click to load for engraving.`}
              className="flex flex-col items-center gap-1 rounded-md bg-[#161616] border border-[#3a3a3a] px-1 py-2 hover:border-[#ff6b35] disabled:opacity-50"
            >
              <img
                src={picture.url}
                alt={`${picture.name} outline`}
                className="w-full aspect-square object-contain rounded bg-white"
              />
              <span className="text-[10px] text-[#f5f5f5] font-semibold leading-tight text-center">
                {picture.name}
              </span>
              <span className="text-[9px] text-[#6b7280] leading-tight text-center">
                {picture.detail}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="panel-title">Saved library</span>
          <span className="text-[10px] text-[#6b7280] font-mono">{library.length}</span>
        </div>

        {library.length === 0 ? (
          <p className="text-[11px] text-[#6b7280] leading-relaxed">
            Nothing saved yet. Imported SVGs and pictures are saved here automatically so
            they're ready next session.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-[190px] overflow-y-auto pr-1">
            {library.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-md bg-[#161616] border border-[#3a3a3a] px-2 py-1.5"
              >
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${
                    entry.kind === 'vector'
                      ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/40'
                      : 'bg-[#ff6b35]/20 text-[#ff8c5c] border border-[#ff6b35]/40'
                  }`}
                >
                  {entry.kind === 'vector' ? 'SVG' : 'IMG'}
                </span>
                <span
                  className="flex-1 truncate text-[11px] text-[#f5f5f5]"
                  title={entry.name}
                >
                  {entry.name}
                </span>
                <Btn
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void onLoadEntry(entry)}
                >
                  Use
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void onDeleteEntry(entry)}
                  title="Delete from library"
                >
                  ✕
                </Btn>
              </li>
            ))}
          </ul>
        )}

        {active && (
          <div className="flex items-center justify-between rounded-lg bg-[#161616] border border-[#3a3a3a] px-3 py-2 text-[11px]">
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-[#6b7280] font-semibold">
                Active artwork
              </div>
              <div className="truncate text-[#f5f5f5] font-semibold">{active.name}</div>
            </div>
            <Btn size="sm" variant="ghost" onClick={() => onArtwork(null)}>
              Clear
            </Btn>
          </div>
        )}
      </div>
    </Panel>
  )
}
