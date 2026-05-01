import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

const DATA_PATH = path.join(app.getPath('userData'), 'library.json')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false,
    show: false,
    icon: path.join(__dirname, '../assets/Claude_Icon_6.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers
ipcMain.handle('get-library', async () => {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const data = fs.readFileSync(DATA_PATH, 'utf-8')
      return JSON.parse(data)
    }
    return { folders: [], theme: 'dark' }
  } catch {
    return { folders: [], theme: 'dark' }
  }
})

ipcMain.handle('save-library', async (_, data: unknown) => {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('select-pdf', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('read-pdf', async (_, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return new Uint8Array(buffer)
  } catch {
    return null
  }
})

ipcMain.handle('get-pdf-worker', async () => {
  try {
    const workerPath = path.join(__dirname, '../dist/pdf.worker.mjs')
    return fs.readFileSync(workerPath, 'utf-8')
  } catch {
    return null
  }
})

ipcMain.handle('minimize-window', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.minimize()
})

ipcMain.handle('maximize-window', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
})

ipcMain.handle('close-window', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.close()
})
