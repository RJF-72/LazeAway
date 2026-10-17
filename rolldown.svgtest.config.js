// One-off bundle config for the SVG parser smoke test.
// Exposes parseSvg as a global so the Electron harness can call it.
import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/renderer/src/lib/svgImport.ts',
  output: {
    file: '.tmp/svgtest/svgImport.iife.js',
    format: 'iife',
    name: 'SvgTest',
  },
  resolve: {
    alias: {
      '@shared': new URL('./src/shared', import.meta.url).pathname.replace(/^\//, ''),
    },
  },
})
