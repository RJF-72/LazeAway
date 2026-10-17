// Offline smoke test: loads the built renderer with the compiled preload and
// reports renderer console errors / load failures, then exits.
const { app, BrowserWindow } = require('electron')
const path = require('path')

const errors = []

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist-electron', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.webContents.on('did-finish-load', () => console.log('DID_FINISH_LOAD'))

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.log('DID_FAIL_LOAD', code, desc, url)
    errors.push(`fail-load ${code} ${desc}`)
  })

  // Electron 38: details object; older: positional args.
  win.webContents.on('console-message', (...args) => {
    const d = args[0]
    if (d && typeof d === 'object' && 'message' in d) {
      console.log('[renderer]', d.level, d.message)
      if (d.level === 'error') errors.push(d.message)
    } else {
      const [, level, message] = args
      console.log('[renderer]', level, message)
      if (level >= 2) errors.push(String(message))
    }
  })

  // Verify preload bridge actually exposed the API.
  win.webContents.once('did-finish-load', async () => {
    try {
      const hasApi = await win.webContents.executeJavaScript(
        'typeof window.laser === "object" && typeof window.laser.listPorts === "function"',
      )
      console.log('HAS_LASER_API', hasApi)
      if (!hasApi) errors.push('window.laser API missing')
      const rootHtml = await win.webContents.executeJavaScript(
        'document.getElementById("root") ? document.getElementById("root").childElementCount : -1',
      )
      console.log('ROOT_CHILDREN', rootHtml)
      if (!rootHtml || rootHtml < 1) errors.push('React root did not render')
    } catch (e) {
      errors.push('executeJavaScript: ' + e.message)
    }
  })

  win
    .loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    .then(() => {
      setTimeout(() => {
        console.log('SMOKE_ERROR_COUNT', errors.length)
        app.exit(errors.length ? 1 : 0)
      }, 6000)
    })
    .catch((e) => {
      console.log('LOAD_ERROR', e.message)
      app.exit(1)
    })
})

setTimeout(() => {
  console.log('SMOKE_TIMEOUT')
  app.exit(2)
}, 25000)
