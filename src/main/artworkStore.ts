// Persistent artwork library: user-imported SVGs and images live in
// <userData>/artwork/ with a manifest.json describing each entry.
// Files are stored as their original bytes; the renderer re-parses on load
// so the store stays a dumb byte vault (no DOM/decoding in main).

import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ArtworkEntry, ArtworkFile } from '../shared/types'

interface Manifest {
  entries: ArtworkEntry[]
}

const MANIFEST = 'manifest.json'

function dir(): string {
  return join(app.getPath('userData'), 'artwork')
}

function isSafeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id)
}

async function readManifest(): Promise<Manifest> {
  try {
    const raw = await readFile(join(dir(), MANIFEST), 'utf8')
    const parsed = JSON.parse(raw) as Manifest
    if (parsed && Array.isArray(parsed.entries)) return parsed
  } catch {
    // Missing/corrupt manifest starts fresh.
  }
  return { entries: [] }
}

async function writeManifest(m: Manifest): Promise<void> {
  await mkdir(dir(), { recursive: true })
  await writeFile(join(dir(), MANIFEST), JSON.stringify(m, null, 2), 'utf8')
}

function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Sanitize a display name: keep the base file name only. */
function safeName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? 'artwork'
  const cleaned = base.replace(/[<>:"|?*]/g, '_').trim()
  return (cleaned || 'artwork').slice(0, 120)
}

export function registerArtworkIpc(): void {
  ipcMain.handle('artwork:list', async (): Promise<ArtworkEntry[]> => {
    const m = await readManifest()
    return [...m.entries].sort((a, b) => b.createdAt - a.createdAt)
  })

  ipcMain.handle('artwork:save', async (_e, file: ArtworkFile): Promise<ArtworkEntry> => {
    if (!file || typeof file.bytesBase64 !== 'string') throw new Error('Invalid artwork payload')
    const kind = file.kind === 'vector' ? 'vector' : 'image'
    const entry: ArtworkEntry = {
      id: newId(),
      name: safeName(file.name),
      kind,
      createdAt: Date.now(),
    }
    const ext = (file.ext || (kind === 'vector' ? 'svg' : 'png'))
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
    await mkdir(dir(), { recursive: true })
    await writeFile(join(dir(), `${entry.id}.${ext}`), Buffer.from(file.bytesBase64, 'base64'))
    const m = await readManifest()
    m.entries.push(entry)
    await writeManifest(m)
    return entry
  })

  ipcMain.handle('artwork:load', async (_e, id: string): Promise<ArtworkFile | null> => {
    if (!isSafeId(String(id))) return null
    const m = await readManifest()
    const entry = m.entries.find((x) => x.id === id)
    if (!entry) return null
    const files = existsSync(dir()) ? await readdir(dir()) : []
    const match = files.find((f) => f.startsWith(`${id}.`) && f !== MANIFEST)
    if (!match) return null
    const bytes = await readFile(join(dir(), match))
    const ext = match.slice(id.length + 1)
    return { name: entry.name, kind: entry.kind, ext, bytesBase64: bytes.toString('base64') }
  })

  ipcMain.handle('artwork:delete', async (_e, id: string): Promise<void> => {
    if (!isSafeId(String(id))) return
    const m = await readManifest()
    const next = m.entries.filter((x) => x.id !== id)
    if (next.length !== m.entries.length) {
      await writeManifest({ entries: next })
    }
    if (existsSync(dir())) {
      const files = await readdir(dir())
      for (const f of files) {
        if (f.startsWith(`${id}.`) && f !== MANIFEST) {
          await unlink(join(dir(), f)).catch(() => undefined)
        }
      }
    }
  })
}
