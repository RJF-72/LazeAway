// Writes dist-electron/package.json so Electron treats the compiled main and
// preload (CommonJS output from tsc) as CommonJS, even though the root
// package.json declares "type": "module" for the Vite renderer.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(root, '..', 'dist-electron')
mkdirSync(outDir, { recursive: true })
writeFileSync(
  resolve(outDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
)
console.log('Wrote dist-electron/package.json (type: commonjs)')
