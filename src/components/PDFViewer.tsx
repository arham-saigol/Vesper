import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { getDocument, GlobalWorkerOptions, AnnotationMode, TextLayer } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Highlight, Annotation, HighlightColor } from '../types'

let workerInitPromise: Promise<void> | null = null

// Polyfill for Math.sumPrecise which pdfjs-dist v5.7 requires but which is not
// available in all Chromium builds (e.g. Electron 41 / Chromium 146).
const MATH_SUM_PRECISE_POLYFILL = `
if (typeof Math.sumPrecise === 'undefined') {
  Math.sumPrecise = function sumPrecise(iterable) {
    const values = [];
    for (const x of iterable) values.push(+x);
    let sum = 0;
    let c = 0;
    for (let i = 0; i < values.length; i++) {
      const x = values[i];
      const t = sum + x;
      if (Math.abs(sum) >= Math.abs(x)) {
        c += (sum - t) + x;
      } else {
        c += (x - t) + sum;
      }
      sum = t;
    }
    return sum + c;
  };
}
`;

// Detect development mode by checking window.location.protocol:
// Vite dev server serves the app over http: or https:, while a packaged
// Electron build loads the renderer via the file: protocol.
const IS_DEV = window.location.protocol === 'http:' || window.location.protocol === 'https:'

function getPageFromPoint(
  x: number,
  y: number,
  pageElements: Map<number, HTMLDivElement>,
): { pageNum: number; el: HTMLDivElement; rect: DOMRect } | null {
  for (const [pageNum, el] of pageElements) {
    const rect = el.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { pageNum, el, rect }
    }
  }
  return null
}

async function initPdfWorker() {
  if (workerInitPromise) return workerInitPromise

  workerInitPromise = (async () => {
    try {
      let workerCode: string | null = null

      if (IS_DEV) {
        const res = await fetch('/pdf.worker.mjs')
        workerCode = await res.text()
      } else {
        workerCode = await window.electronAPI.getPdfWorker()
        if (!workerCode) {
          console.error('[PDFViewer] getPdfWorker returned null')
          return
        }
      }

      const blob = new Blob([MATH_SUM_PRECISE_POLYFILL + workerCode], {
        type: 'application/javascript',
      })
      GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
    } catch (err) {
      console.error('[PDFViewer] Failed to load worker:', err)
    }
  })()

  return workerInitPromise
}

/**
 * Custom BinaryDataFactory for production Electron.
 *
 * pdfjs-dist v5.7+ requires WASM decoders (openjpeg, jbig2, qcms) for images.
 * In a packaged Electron app the renderer runs from a file:// origin and blob
 * workers cannot reliably resolve relative URLs or fetch file:// URLs.
 * This factory forwards every binary-data request to the main process via IPC,
 * which can read the files from inside the asar bundle using Node fs.
 */
class ElectronBinaryDataFactory {
  constructor(_opts: { cMapUrl?: string | null; standardFontDataUrl?: string | null; wasmUrl?: string | null }) {
    // _opts reserved for future binary-data resolution logic
  }

  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    let filePath: string
    switch (kind) {
      case 'wasmUrl':
        filePath = await window.electronAPI.resolveWasmPath(filename)
        break
      case 'cMapUrl':
        filePath = await window.electronAPI.resolveCMapPath(filename)
        break
      case 'standardFontDataUrl':
        filePath = await window.electronAPI.resolveStandardFontPath(filename)
        break
      default:
        throw new Error(`Unsupported binary data kind: ${kind}`)
    }
    const buffer = await window.electronAPI.readBinaryFile(filePath)
    if (!buffer) {
      throw new Error(`Failed to read ${kind} file: ${filename} at ${filePath}`)
    }
    return buffer
  }
}

interface PageSize {
  width: number
  height: number
}

const HIGHLIGHT_COLOR_MAP: Record<HighlightColor, string> = {
  yellow: '#fde047',
  green: '#86efac',
  blue: '#93c5fd',
  pink: '#f9a8d4',
}

interface PDFViewerProps {
  filePath: string
  zoom: number
  navigateTo: number | null
  onPageChange: (page: number) => void
  onTotalPagesChange: (total: number) => void
  onNavigationComplete: () => void
  highlights: Highlight[]
  annotations: Annotation[]
  highlightMode: boolean
  annotationMode: boolean
  eraserMode: boolean
  activeColor: HighlightColor
  onAddHighlights: (highlights: Highlight[]) => void
  onDeleteHighlight: (id: string) => void
  onAddAnnotations: (annotations: Annotation[]) => void
  onDeleteAnnotation: (id: string) => void
}

export function PDFViewer({
  filePath,
  zoom,
  navigateTo,
  onPageChange,
  onTotalPagesChange,
  onNavigationComplete,
  highlights,
  annotations,
  highlightMode,
  annotationMode,
  eraserMode,
  activeColor,
  onAddHighlights,
  onDeleteHighlight,
  onAddAnnotations,
  onDeleteAnnotation,
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const canvasElementsRef = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const textLayerElementsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const renderedZoomRef = useRef<Map<number, number>>(new Map())
  const renderingRef = useRef<Map<number, boolean>>(new Map())
  const rerenderRequestedRef = useRef<Map<number, boolean>>(new Map())
  const visiblePagesRef = useRef<Set<number>>(new Set())
  const renderObserverRef = useRef<IntersectionObserver | null>(null)
  const scrollAnchorRef = useRef<{ page: number; ratio: number }>({ page: 1, ratio: 0 })
  const lastReportedPageRef = useRef(1)
  const prevZoomRef = useRef(zoom)
  const onPageChangeRef = useRef(onPageChange)
  onPageChangeRef.current = onPageChange

  // Drawing state refs
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ page: number; x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)
  const currentAnnotationRef = useRef<{ page: number; points: { x: number; y: number }[] } | null>(null)
  const liveHighlightRafRef = useRef<number | null>(null)
  const liveAnnotationRafRef = useRef<number | null>(null)

  const [liveHighlight, setLiveHighlight] = useState<{ page: number; rect: { x: number; y: number; w: number; h: number } } | null>(null)
  const [liveAnnotation, setLiveAnnotation] = useState<{ page: number; path: string } | null>(null)

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pageSizes, setPageSizes] = useState<PageSize[]>([])

  // Keep refs in sync for closures that out-live renders
  const pdfRef = useRef(pdf)
  pdfRef.current = pdf
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const pageSizesRef = useRef(pageSizes)
  pageSizesRef.current = pageSizes
  const highlightModeRef = useRef(highlightMode)
  highlightModeRef.current = highlightMode
  const annotationModeRef = useRef(annotationMode)
  annotationModeRef.current = annotationMode
  const eraserModeRef = useRef(eraserMode)
  eraserModeRef.current = eraserMode
  const activeColorRef = useRef(activeColor)
  activeColorRef.current = activeColor
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations
  const onAddHighlightsRef = useRef(onAddHighlights)
  onAddHighlightsRef.current = onAddHighlights
  const onAddAnnotationsRef = useRef(onAddAnnotations)
  onAddAnnotationsRef.current = onAddAnnotations

  // ─── Load PDF and pre-fetch page sizes ───
  useEffect(() => {
    let cancelled = false
    setError(null)
    setPdf(null)
    setNumPages(0)
    setPageSizes([])
    onTotalPagesChange(0)
    renderedZoomRef.current.clear()
    visiblePagesRef.current.clear()
    pageElementsRef.current.clear()
    canvasElementsRef.current.clear()
    textLayerElementsRef.current.clear()
    scrollAnchorRef.current = { page: 1, ratio: 0 }
    lastReportedPageRef.current = 1

    initPdfWorker()
      .then(() => {
        if (cancelled) return
        return window.electronAPI.readPdf(filePath)
      })
      .then(data => {
        if (cancelled) return
        if (!data) {
          setError('Failed to read PDF file')
          return
        }
        const docOpts = IS_DEV
          ? { data, wasmUrl: new URL('/wasm/', window.location.href).href, isEvalSupported: false }
          : { data, BinaryDataFactory: ElectronBinaryDataFactory, isEvalSupported: false }
        return getDocument(docOpts).promise.then(async doc => {
          if (cancelled) {
            doc.destroy()
            return
          }
          setPdf(doc)
          setNumPages(doc.numPages)
          onTotalPagesChange(doc.numPages)

          // Fetch page sizes in parallel so the scrollbar is instantly correct
          const sizePromises: Promise<PageSize>[] = []
          for (let i = 1; i <= doc.numPages; i++) {
            sizePromises.push(
              doc.getPage(i).then(p => {
                const vp = p.getViewport({ scale: 1 })
                p.cleanup()
                return { width: vp.width, height: vp.height }
              })
            )
          }

          try {
            const sizes = await Promise.all(sizePromises)
            if (!cancelled) {
              setPageSizes(sizes)
            }
          } catch (err) {
            console.error('[PDFViewer] Failed to load page sizes:', err)
          }
        })
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load PDF')
        }
      })

    return () => {
      cancelled = true
      setPdf(prev => {
        if (prev) prev.destroy()
        return null
      })
    }
  }, [filePath, onTotalPagesChange])

  // ─── Render a single page onto its canvas ───
  const renderPage = useCallback(async (pageNum: number) => {
    if (renderingRef.current.get(pageNum)) {
      rerenderRequestedRef.current.set(pageNum, true)
      return
    }
    renderingRef.current.set(pageNum, true)

    const pdfDoc = pdfRef.current
    if (!pdfDoc) {
      renderingRef.current.delete(pageNum)
      return
    }

    const currentZoom = zoomRef.current
    if (renderedZoomRef.current.get(pageNum) === currentZoom) {
      renderingRef.current.delete(pageNum)
      return
    }

    const canvas = canvasElementsRef.current.get(pageNum)
    if (!canvas) {
      renderingRef.current.delete(pageNum)
      return
    }

    const size = pageSizesRef.current[pageNum - 1]
    if (!size) {
      renderingRef.current.delete(pageNum)
      return
    }

    const dpr = window.devicePixelRatio || 1
    const logicalScale = currentZoom / 100
    const renderScale = logicalScale * dpr

    try {
      const pdfPage = await pdfDoc.getPage(pageNum)

      if (zoomRef.current !== currentZoom || pdfRef.current !== pdfDoc) {
        pdfPage.cleanup()
        rerenderRequestedRef.current.set(pageNum, true)
        renderingRef.current.delete(pageNum)
        return
      }

      const viewport = pdfPage.getViewport({ scale: renderScale })

      const pixelWidth = Math.max(1, Math.floor(viewport.width))
      const pixelHeight = Math.max(1, Math.floor(viewport.height))

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        renderingRef.current.delete(pageNum)
        pdfPage.cleanup()
        return
      }

      await pdfPage.render({
        canvasContext: ctx,
        canvas,
        viewport,
        annotationMode: AnnotationMode.ENABLE,
      }).promise

      // Render text layer for selectable text
      if (zoomRef.current !== currentZoom || pdfRef.current !== pdfDoc) {
        pdfPage.cleanup()
        rerenderRequestedRef.current.set(pageNum, true)
        renderingRef.current.delete(pageNum)
        return
      }

      const textLayerDiv = textLayerElementsRef.current.get(pageNum)
      if (textLayerDiv) {
        textLayerDiv.innerHTML = ''
        const textViewport = pdfPage.getViewport({ scale: logicalScale })
        const textLayer = new TextLayer({
          textContentSource: pdfPage.streamTextContent(),
          container: textLayerDiv,
          viewport: textViewport,
        })
        await textLayer.render()
      }

      pdfPage.cleanup()
    } catch (err) {
      console.error(`[PDFViewer] Failed to render page ${pageNum}:`, err)
    } finally {
      renderingRef.current.delete(pageNum)
      const needsRerender =
        rerenderRequestedRef.current.get(pageNum) ||
        zoomRef.current !== currentZoom ||
        pdfRef.current !== pdfDoc
      if (needsRerender) {
        rerenderRequestedRef.current.delete(pageNum)
        queueMicrotask(() => renderPage(pageNum))
      } else {
        renderedZoomRef.current.set(pageNum, currentZoom)
      }
    }
  }, [])

  // ─── Stable ref callbacks (same reference across renders) ───
  const pageRefCallbacks = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => {
      const pageNum = i + 1
      return (el: HTMLDivElement | null) => {
        if (el) {
          pageElementsRef.current.set(pageNum, el)
          renderObserverRef.current?.observe(el)
        } else {
          pageElementsRef.current.delete(pageNum)
        }
      }
    })
  }, [numPages])

  const canvasRefCallbacks = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => {
      const pageNum = i + 1
      return (el: HTMLCanvasElement | null) => {
        if (el) {
          canvasElementsRef.current.set(pageNum, el)
          // If this page is already known to be visible and hasn't been
          // rendered yet, draw it immediately now that the canvas exists.
          if (visiblePagesRef.current.has(pageNum) && !renderedZoomRef.current.has(pageNum)) {
            renderPage(pageNum)
          }
        } else {
          canvasElementsRef.current.delete(pageNum)
        }
      }
    })
  }, [numPages, renderPage])

  const textLayerRefCallbacks = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => {
      const pageNum = i + 1
      return (el: HTMLDivElement | null) => {
        if (el) {
          textLayerElementsRef.current.set(pageNum, el)
          if (visiblePagesRef.current.has(pageNum) && !renderedZoomRef.current.has(pageNum)) {
            renderPage(pageNum)
          }
        } else {
          textLayerElementsRef.current.delete(pageNum)
        }
      }
    })
  }, [numPages, renderPage])

  // ─── IntersectionObserver for lazy rendering ───
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return

    const container = containerRef.current

    const renderObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt((entry.target as HTMLDivElement).dataset.pageNum!, 10)
        const wasVisible = visiblePagesRef.current.has(pageNum)
        const isVisible = entry.isIntersecting

        if (isVisible && !wasVisible) {
          visiblePagesRef.current.add(pageNum)
          renderPage(pageNum)
        } else if (!isVisible && wasVisible) {
          visiblePagesRef.current.delete(pageNum)
        }
      })
    }, {
      root: container,
      rootMargin: '400px 0px',
      threshold: 0,
    })

    renderObserverRef.current = renderObserver

    pageElementsRef.current.forEach(el => {
      renderObserver.observe(el)
    })

    return () => {
      renderObserver.disconnect()
      renderObserverRef.current = null
    }
  }, [numPages, renderPage])

  // ─── Scroll listener for page tracking ───
  useEffect(() => {
    const container = containerRef.current
    if (!container || numPages === 0) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false

        const viewportCenter = container.scrollTop + container.clientHeight / 2

        let currentPage = 1
        let bestDistance = Infinity
        let anchorPage = 1
        let anchorRatio = 0

        pageElementsRef.current.forEach((el, pageNum) => {
          const elTop = el.offsetTop
          const elHeight = el.offsetHeight
          const elCenter = elTop + elHeight / 2
          const distance = Math.abs(elCenter - viewportCenter)

          if (distance < bestDistance) {
            bestDistance = distance
            currentPage = pageNum
          }

          if (viewportCenter >= elTop && viewportCenter < elTop + elHeight) {
            anchorPage = pageNum
            anchorRatio = elHeight > 0 ? (viewportCenter - elTop) / elHeight : 0
          }
        })

        scrollAnchorRef.current = { page: anchorPage, ratio: anchorRatio }

        if (currentPage !== lastReportedPageRef.current) {
          lastReportedPageRef.current = currentPage
          onPageChangeRef.current(currentPage)
        }
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [numPages])

  // ─── Re-render visible pages when zoom changes ───
  useEffect(() => {
    if (numPages === 0) return

    const zoomChanged = prevZoomRef.current !== zoom
    prevZoomRef.current = zoom

    renderedZoomRef.current.clear()
    visiblePagesRef.current.forEach(pageNum => {
      renderPage(pageNum)
    })

    if (zoomChanged && scrollAnchorRef.current) {
      const { page, ratio } = scrollAnchorRef.current
      const el = pageElementsRef.current.get(page)
      const container = containerRef.current
      if (el && container) {
        const viewportCenter = el.offsetTop + ratio * el.offsetHeight
        container.scrollTop = viewportCenter - container.clientHeight / 2
      }
    }
  }, [zoom, numPages, renderPage])

  // ─── Safety-net: catch pages that became visible before sizes were ready ───
  useEffect(() => {
    if (numPages === 0 || pageSizes.length === 0) return
    const timer = setTimeout(() => {
      visiblePagesRef.current.forEach(pageNum => {
        if (!renderedZoomRef.current.has(pageNum)) {
          renderPage(pageNum)
        }
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [pageSizes, numPages, renderPage])

  // ─── Explicit page navigation ───
  useEffect(() => {
    if (navigateTo == null || numPages === 0) return
    const pageNum = Math.max(1, Math.min(navigateTo, numPages))
    const el = pageElementsRef.current.get(pageNum)
    const container = containerRef.current
    if (!el || !container) return

    container.scrollTop = el.offsetTop

    // Update anchor and reported page so zoom and toolbar stay in sync
    const ratio = el.offsetHeight > 0
      ? Math.min(1, (container.clientHeight / 2) / el.offsetHeight)
      : 0
    scrollAnchorRef.current = { page: pageNum, ratio }
    if (lastReportedPageRef.current !== pageNum) {
      lastReportedPageRef.current = pageNum
      onPageChangeRef.current(pageNum)
    }

    onNavigationComplete()
  }, [navigateTo, numPages, onNavigationComplete])

  // ─── Raw rectangular highlight & freehand annotation capture ───
  useEffect(() => {
    if (!highlightMode && !annotationMode) {
      setLiveHighlight(null)
      setLiveAnnotation(null)
      return
    }

    const toPercent = (val: number, max: number) => (val / max) * 100

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const hit = getPageFromPoint(e.clientX, e.clientY, pageElementsRef.current)
      if (!hit) return
      const x = toPercent(e.clientX - hit.rect.left, hit.rect.width)
      const y = toPercent(e.clientY - hit.rect.top, hit.rect.height)

      if (highlightModeRef.current) {
        dragStartRef.current = { page: hit.pageNum, x, y }
        isDraggingRef.current = true
      } else if (annotationModeRef.current) {
        currentAnnotationRef.current = { page: hit.pageNum, points: [{ x, y }] }
        isDrawingRef.current = true
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (isDraggingRef.current && dragStartRef.current) {
        if (liveHighlightRafRef.current) return
        liveHighlightRafRef.current = requestAnimationFrame(() => {
          liveHighlightRafRef.current = null
          const hit = getPageFromPoint(e.clientX, e.clientY, pageElementsRef.current)
          const start = dragStartRef.current
          if (!hit || !start || hit.pageNum !== start.page) return
          const x = toPercent(e.clientX - hit.rect.left, hit.rect.width)
          const y = toPercent(e.clientY - hit.rect.top, hit.rect.height)
          setLiveHighlight({
            page: hit.pageNum,
            rect: {
              x: Math.min(start.x, x),
              y: Math.min(start.y, y),
              w: Math.abs(x - start.x),
              h: Math.abs(y - start.y),
            },
          })
        })
      } else if (isDrawingRef.current && currentAnnotationRef.current) {
        if (liveAnnotationRafRef.current) return
        liveAnnotationRafRef.current = requestAnimationFrame(() => {
          liveAnnotationRafRef.current = null
          const hit = getPageFromPoint(e.clientX, e.clientY, pageElementsRef.current)
          const ann = currentAnnotationRef.current
          if (!hit || !ann || hit.pageNum !== ann.page) return
          const x = toPercent(e.clientX - hit.rect.left, hit.rect.width)
          const y = toPercent(e.clientY - hit.rect.top, hit.rect.height)
          ann.points.push({ x, y })
          const path = ann.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
          setLiveAnnotation({ page: ann.page, path })
        })
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        const start = dragStartRef.current
        dragStartRef.current = null
        setLiveHighlight(null)
        if (!start) return

        const hit = getPageFromPoint(e.clientX, e.clientY, pageElementsRef.current)
        if (!hit || hit.pageNum !== start.page) return
        const x = toPercent(e.clientX - hit.rect.left, hit.rect.width)
        const y = toPercent(e.clientY - hit.rect.top, hit.rect.height)
        const w = Math.abs(x - start.x)
        const h = Math.abs(y - start.y)
        if (w < 0.5 || h < 0.5) return

        onAddHighlightsRef.current([{
          id: Math.random().toString(36).slice(2, 9),
          page: start.page,
          color: activeColorRef.current,
          rects: [{
            x: Math.min(start.x, x),
            y: Math.min(start.y, y),
            w,
            h,
          }],
        }])
      } else if (isDrawingRef.current) {
        isDrawingRef.current = false
        const ann = currentAnnotationRef.current
        currentAnnotationRef.current = null
        setLiveAnnotation(null)
        if (!ann || ann.points.length < 2) return

        const path = ann.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
        onAddAnnotationsRef.current([{
          id: Math.random().toString(36).slice(2, 9),
          page: ann.page,
          color: activeColorRef.current,
          path,
        }])
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      if (liveHighlightRafRef.current) cancelAnimationFrame(liveHighlightRafRef.current)
      if (liveAnnotationRafRef.current) cancelAnimationFrame(liveAnnotationRafRef.current)
    }
  }, [highlightMode, annotationMode])

  const modeActive = highlightMode || annotationMode
  const cursorStyle = modeActive ? 'crosshair' : 'default'

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--destructive)',
          fontSize: 14,
        }}
      >
        {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        background: 'var(--bg-primary)',
        position: 'relative',
      }}
    >
      {Array.from({ length: numPages }, (_, i) => {
        const pageNum = i + 1
        const size = pageSizes[i]
        const scale = zoom / 100
        const width = size ? size.width * scale : 0
        const height = size ? size.height * scale : 0
        const pageHighlights = highlights.filter(h => h.page === pageNum)
        const pageAnnotations = annotations.filter(a => a.page === pageNum)

        return (
          <div
            key={pageNum}
            ref={pageRefCallbacks[i]}
            data-page-num={pageNum}
            style={{
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
              borderRadius: 4,
              overflow: 'hidden',
              flexShrink: 0,
              width: Math.floor(width) || 'auto',
              height: Math.floor(height) || 'auto',
              minWidth: Math.floor(width) || 200,
              minHeight: Math.floor(height) || 280,
              background: 'var(--bg-primary)',
              position: 'relative',
            }}
          >
            <canvas
              ref={canvasRefCallbacks[i]}
              className="pdf-page-canvas"
              style={{
                display: 'block',
                cursor: cursorStyle,
                willChange: 'transform',
              }}
            />
            <div
              ref={textLayerRefCallbacks[i]}
              className="pdf-text-layer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
                cursor: cursorStyle,
                userSelect: modeActive ? 'none' : 'auto',
              }}
            />
            {/* Highlight layer */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              {pageHighlights.map(h =>
                h.rects.map((rect, idx) => (
                  <div
                    key={`${h.id}-${idx}`}
                    onContextMenu={e => {
                      e.preventDefault()
                      onDeleteHighlight(h.id)
                    }}
                    onClick={eraserMode ? e => { e.stopPropagation(); onDeleteHighlight(h.id) } : undefined}
                    style={{
                      position: 'absolute',
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.w}%`,
                      height: `${rect.h}%`,
                      backgroundColor: HIGHLIGHT_COLOR_MAP[h.color],
                      opacity: 0.35,
                      mixBlendMode: 'multiply',
                      pointerEvents: highlightMode ? 'none' : 'auto',
                      cursor: highlightMode ? 'inherit' : 'pointer',
                    }}
                    title={h.text || 'Highlight'}
                  />
                ))
              )}
              {liveHighlight?.page === pageNum && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${liveHighlight.rect.x}%`,
                    top: `${liveHighlight.rect.y}%`,
                    width: `${liveHighlight.rect.w}%`,
                    height: `${liveHighlight.rect.h}%`,
                    backgroundColor: HIGHLIGHT_COLOR_MAP[activeColor],
                    opacity: 0.25,
                    mixBlendMode: 'multiply',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
            {/* Annotation layer */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 4,
                pointerEvents: 'none',
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {pageAnnotations.map(ann => (
                <path
                  key={ann.id}
                  d={ann.path}
                  stroke={HIGHLIGHT_COLOR_MAP[ann.color]}
                  strokeWidth={0.25}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    pointerEvents: annotationMode ? 'none' : (eraserMode ? 'all' : 'stroke'),
                    cursor: annotationMode ? 'inherit' : 'pointer',
                  }}
                  onContextMenu={e => {
                    e.preventDefault()
                    onDeleteAnnotation(ann.id)
                  }}
                  onClick={eraserMode ? e => { e.stopPropagation(); onDeleteAnnotation(ann.id) } : undefined}
                />
              ))}
              {liveAnnotation?.page === pageNum && (
                <path
                  d={liveAnnotation.path}
                  stroke={HIGHLIGHT_COLOR_MAP[activeColor]}
                  strokeWidth={0.25}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )}
            </svg>
          </div>
        )
      })}
    </div>
  )
}
