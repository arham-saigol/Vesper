import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { PDFViewer } from './components/PDFViewer'
import { Toolbar } from './components/Toolbar'
import { EmptyState } from './components/EmptyState'
import type { FolderData, PdfFile, Theme, LibraryData, Highlight, Annotation, HighlightColor } from './types'

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function getFileNameFromPath(filePath: string) {
  return filePath.replace(/\\/g, '/').split('/').pop() || 'Untitled'
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [folders, setFolders] = useState<FolderData[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentFile, setCurrentFile] = useState<PdfFile | null>(null)
  const [zoom, setZoom] = useState(100)
  const [page, setPage] = useState(1)
  const [navigateTo, setNavigateTo] = useState<number | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [highlightMode, setHighlightMode] = useState(false)
  const [annotationMode, setAnnotationMode] = useState(false)
  const [eraserMode, setEraserMode] = useState(false)
  const [activeColor, setActiveColor] = useState<HighlightColor>('yellow')

  // Load library on mount
  useEffect(() => {
    window.electronAPI.getLibrary().then((data: LibraryData) => {
      setFolders(data.folders || [])
      setTheme(data.theme || 'dark')
      setLoaded(true)
    }).catch(() => {
      setLoaded(true)
    })
  }, [])

  // Persist library
  useEffect(() => {
    if (!loaded) return
    window.electronAPI.saveLibrary({ folders, theme })
  }, [folders, theme, loaded])

  // Apply theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  const addFolder = useCallback((name: string) => {
    const newFolder: FolderData = {
      id: generateId(),
      name: name.trim() || 'New Folder',
      expanded: true,
      files: [],
    }
    setFolders(prev => [...prev, newFolder])
  }, [])

  const toggleFolder = useCallback((folderId: string) => {
    setFolders(prev =>
      prev.map(f => (f.id === folderId ? { ...f, expanded: !f.expanded } : f))
    )
  }, [])

  const addFileToFolder = useCallback(async (folderId: string) => {
    const filePath = await window.electronAPI.selectPdf()
    if (!filePath) return
    const name = getFileNameFromPath(filePath)
    const newFile: PdfFile = { id: generateId(), name, path: filePath }
    setFolders(prev =>
      prev.map(f =>
        f.id === folderId ? { ...f, files: [...f.files, newFile] } : f
      )
    )
  }, [])

  const openFile = useCallback((file: PdfFile) => {
    setCurrentFile(file)
    setPage(1)
    setNavigateTo(null)
    setZoom(100)
    setHighlightMode(false)
    setAnnotationMode(false)
    setEraserMode(false)
  }, [])

  const toggleHighlightMode = useCallback(() => {
    setHighlightMode(prev => {
      const next = !prev
      if (next) setAnnotationMode(false)
      return next
    })
  }, [])

  const toggleAnnotationMode = useCallback(() => {
    setAnnotationMode(prev => {
      const next = !prev
      if (next) {
        setHighlightMode(false)
        setEraserMode(false)
      }
      return next
    })
  }, [])

  const toggleEraserMode = useCallback(() => {
    setEraserMode(prev => {
      const next = !prev
      if (next) {
        setHighlightMode(false)
        setAnnotationMode(false)
      }
      return next
    })
  }, [])

  const addHighlights = useCallback((highlights: Highlight[]) => {
    if (!currentFile) return
    setFolders(prev =>
      prev.map(folder => ({
        ...folder,
        files: folder.files.map(f =>
          f.id === currentFile.id
            ? { ...f, highlights: [...(f.highlights || []), ...highlights] }
            : f
        ),
      }))
    )
    setCurrentFile(prev =>
      prev ? { ...prev, highlights: [...(prev.highlights || []), ...highlights] } : prev
    )
  }, [currentFile])

  const deleteHighlight = useCallback((id: string) => {
    if (!currentFile) return
    setFolders(prev =>
      prev.map(folder => ({
        ...folder,
        files: folder.files.map(f =>
          f.id === currentFile.id
            ? { ...f, highlights: (f.highlights || []).filter(h => h.id !== id) }
            : f
        ),
      }))
    )
    setCurrentFile(prev =>
      prev ? { ...prev, highlights: (prev.highlights || []).filter(h => h.id !== id) } : prev
    )
  }, [currentFile])

  const addAnnotations = useCallback((annotations: Annotation[]) => {
    if (!currentFile) return
    setFolders(prev =>
      prev.map(folder => ({
        ...folder,
        files: folder.files.map(f =>
          f.id === currentFile.id
            ? { ...f, annotations: [...(f.annotations || []), ...annotations] }
            : f
        ),
      }))
    )
    setCurrentFile(prev =>
      prev ? { ...prev, annotations: [...(prev.annotations || []), ...annotations] } : prev
    )
  }, [currentFile])

  const deleteAnnotation = useCallback((id: string) => {
    if (!currentFile) return
    setFolders(prev =>
      prev.map(folder => ({
        ...folder,
        files: folder.files.map(f =>
          f.id === currentFile.id
            ? { ...f, annotations: (f.annotations || []).filter(a => a.id !== id) }
            : f
        ),
      }))
    )
    setCurrentFile(prev =>
      prev ? { ...prev, annotations: (prev.annotations || []).filter(a => a.id !== id) } : prev
    )
  }, [currentFile])

  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 300))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 25, 25))
  }, [])

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages || 1))
    setPage(clamped)
    setNavigateTo(clamped)
  }, [totalPages])

  const handleNavigationComplete = useCallback(() => {
    setNavigateTo(null)
  }, [])

  if (!loaded) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        Loading…
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      <Sidebar
        open={sidebarOpen}
        folders={folders}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onAddFolder={addFolder}
        onToggleFolder={toggleFolder}
        onAddFile={addFileToFolder}
        onOpenFile={openFile}
        activeFileId={currentFile?.id || null}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {currentFile ? (
          <>
            <Toolbar
              zoom={zoom}
              page={page}
              totalPages={totalPages}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onGoToPage={goToPage}
              highlightMode={highlightMode}
              annotationMode={annotationMode}
              eraserMode={eraserMode}
              highlightColor={activeColor}
              onToggleHighlightMode={toggleHighlightMode}
              onToggleAnnotationMode={toggleAnnotationMode}
              onToggleEraserMode={toggleEraserMode}
              onChangeColor={setActiveColor}
            />
            <PDFViewer
              filePath={currentFile.path}
              zoom={zoom}
              navigateTo={navigateTo}
              onPageChange={setPage}
              onTotalPagesChange={setTotalPages}
              onNavigationComplete={handleNavigationComplete}
              highlights={currentFile.highlights || []}
              annotations={currentFile.annotations || []}
              highlightMode={highlightMode}
              annotationMode={annotationMode}
              eraserMode={eraserMode}
              activeColor={activeColor}
              onAddHighlights={addHighlights}
              onDeleteHighlight={deleteHighlight}
              onAddAnnotations={addAnnotations}
              onDeleteAnnotation={deleteAnnotation}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
