import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

let workerInitPromise: Promise<void> | null = null

async function initPdfWorker() {
  if (workerInitPromise) return workerInitPromise

  workerInitPromise = (async () => {
    const isDev = window.location.protocol === 'http:' || window.location.protocol === 'https:'

    if (isDev) {
      GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
      return
    }

    try {
      const workerCode = await window.electronAPI.getPdfWorker()
      if (!workerCode) {
        console.error('[PDFViewer] getPdfWorker returned null')
        return
      }
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
    } catch (err) {
      console.error('[PDFViewer] Failed to load worker via IPC:', err)
    }
  })()

  return workerInitPromise
}

interface PageSize {
  width: number
  height: number
}

interface PDFViewerProps {
  filePath: string
  zoom: number
  navigateTo: number | null
  onPageChange: (page: number) => void
  onTotalPagesChange: (total: number) => void
  onNavigationComplete: () => void
}

export function PDFViewer({
  filePath,
  zoom,
  navigateTo,
  onPageChange,
  onTotalPagesChange,
  onNavigationComplete,
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const canvasElementsRef = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderedZoomRef = useRef<Map<number, number>>(new Map())
  const visiblePagesRef = useRef<Set<number>>(new Set())
  const renderObserverRef = useRef<IntersectionObserver | null>(null)
  const scrollAnchorRef = useRef<{ page: number; ratio: number }>({ page: 1, ratio: 0 })
  const lastReportedPageRef = useRef(1)
  const prevZoomRef = useRef(zoom)
  const onPageChangeRef = useRef(onPageChange)
  onPageChangeRef.current = onPageChange

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
        return getDocument({ data }).promise.then(async doc => {
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
    const pdfDoc = pdfRef.current
    if (!pdfDoc) return

    const currentZoom = zoomRef.current
    if (renderedZoomRef.current.get(pageNum) === currentZoom) return

    const canvas = canvasElementsRef.current.get(pageNum)
    if (!canvas) return

    const size = pageSizesRef.current[pageNum - 1]
    if (!size) return

    const scale = currentZoom / 100
    const width = size.width * scale
    const height = size.height * scale
    const dpr = window.devicePixelRatio || 1

    const pixelWidth = Math.max(1, Math.floor(width * dpr))
    const pixelHeight = Math.max(1, Math.floor(height * dpr))

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      canvas.style.width = `${Math.floor(width)}px`
      canvas.style.height = `${Math.floor(height)}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    try {
      const pdfPage = await pdfDoc.getPage(pageNum)

      if (zoomRef.current !== currentZoom) {
        pdfPage.cleanup()
        return
      }

      const viewport = pdfPage.getViewport({ scale })
      await pdfPage.render({
        canvasContext: ctx,
        canvas,
        viewport,
      }).promise

      renderedZoomRef.current.set(pageNum, currentZoom)
      pdfPage.cleanup()
    } catch (err) {
      console.error(`[PDFViewer] Failed to render page ${pageNum}:`, err)
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
            }}
          >
            <canvas
              ref={canvasRefCallbacks[i]}
              className="pdf-page-canvas"
              style={{
                display: 'block',
                cursor: 'default',
                willChange: 'transform',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
