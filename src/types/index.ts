export type Theme = 'dark' | 'light'

export interface FolderData {
  id: string
  name: string
  expanded: boolean
  files: PdfFile[]
}

export interface PdfFile {
  id: string
  name: string
  path: string
}

export interface LibraryData {
  folders: FolderData[]
  theme: Theme
}

export interface ElectronAPI {
  getLibrary: () => Promise<LibraryData>
  saveLibrary: (data: LibraryData) => Promise<boolean>
  selectPdf: () => Promise<string | null>
  readPdf: (filePath: string) => Promise<Uint8Array | null>
  getPdfWorker: () => Promise<string | null>
  resolveWasmPath: (filename: string) => Promise<string>
  readBinaryFile: (filePath: string) => Promise<Uint8Array | null>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
