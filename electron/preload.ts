import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getLibrary: () => ipcRenderer.invoke('get-library'),
  saveLibrary: (data: unknown) => ipcRenderer.invoke('save-library', data),
  selectPdf: () => ipcRenderer.invoke('select-pdf'),
  readPdf: (filePath: string) => ipcRenderer.invoke('read-pdf', filePath),
  getPdfWorker: () => ipcRenderer.invoke('get-pdf-worker'),
  resolveWasmPath: (filename: string) => ipcRenderer.invoke('resolve-wasm-path', filename),
  readBinaryFile: (filePath: string) => ipcRenderer.invoke('read-binary-file', filePath),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
})
