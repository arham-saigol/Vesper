export type Theme = 'dark' | 'light'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export interface HighlightRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Highlight {
  id: string
  page: number
  color: HighlightColor
  rects: HighlightRect[]
  text?: string
}

export interface Annotation {
  id: string
  page: number
  color: HighlightColor
  path: string
}

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
  highlights?: Highlight[]
  annotations?: Annotation[]
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
  resolveCMapPath: (filename: string) => Promise<string>
  resolveStandardFontPath: (filename: string) => Promise<string>
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
