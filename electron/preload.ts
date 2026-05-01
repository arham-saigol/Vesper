import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getLibrary: () => ipcRenderer.invoke('get-library'),
  saveLibrary: (data: unknown) => ipcRenderer.invoke('save-library', data),
  selectPdf: () => ipcRenderer.invoke('select-pdf'),
  readPdf: (filePath: string) => ipcRenderer.invoke('read-pdf', filePath),
  getPdfWorker: () => ipcRenderer.invoke('get-pdf-worker'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
})
