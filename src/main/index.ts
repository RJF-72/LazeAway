// Electron main process entry point.
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { SerialManager, BAUD_RATE } from './serial'

// Auto-updater intentionally disabled (offline-only app).
const isDev = !!process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
const serial = new SerialManager()

// Icon is present at build/<icon> in dev; packaged builds embed it in the exe.
const iconPath = join(__dirname, '../../build/icon.ico')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#121212',
    title: 'Artilume S1 Desktop Controller - Texas Guitar Edition',
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // serialport runs in main/preload, not the renderer
      spellcheck: false,
      devTools: isDev, // DevTools disabled in production
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // No menu bar in production for a clean workshop UI.
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false)
  }

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!)
    // DevTools only when explicitly enabled in dev.
    if (process.env.OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    void serial.disconnect()
  })
}

// ---- IPC wiring ----
function registerIpc() {
  ipcMain.handle('ports:list', () => serial.listPorts())
  ipcMain.handle('serial:connect', (_e, path: string, baud?: number) =>
    serial.connect(path, baud ?? BAUD_RATE),
  )
  ipcMain.handle('serial:disconnect', () => serial.disconnect())
  ipcMain.handle('serial:isConnected', () => serial.isConnected())
  ipcMain.handle('serial:send', (_e, line: string) => serial.send(line))
  ipcMain.handle('serial:sendLines', (_e, lines: string[], gap?: number) =>
    serial.sendLines(lines, gap ?? 30),
  )
  ipcMain.handle('serial:sendRealtime', (_e, char: string) => serial.sendRealtime(char))
  ipcMain.handle('stream:start', (_e, lines: string[]) => serial.streamStart(lines))
  ipcMain.handle('stream:pause', () => serial.streamPause())
  ipcMain.handle('stream:resume', () => serial.streamResume())
  ipcMain.handle('stream:stop', () => serial.streamStop())
}

function subscribeEvents() {
  // Push serial events to the renderer whenever a window exists.
  serial.onLine((entry) => mainWindow?.webContents.send('evt:line', entry))
  serial.onStatus((status) => mainWindow?.webContents.send('evt:status', status))
  serial.onState((state) => mainWindow?.webContents.send('evt:state', state))
  serial.onProgress((progress) => mainWindow?.webContents.send('evt:progress', progress))
}

app.whenReady().then(() => {
  registerIpc()
  subscribeEvents()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  void serial.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void serial.disconnect()
})
