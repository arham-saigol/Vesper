import { useState, useEffect, useRef, type ReactNode } from 'react'

interface ToolbarProps {
  zoom: number
  page: number
  totalPages: number
  onZoomIn: () => void
  onZoomOut: () => void
  onGoToPage: (page: number) => void
}

export function Toolbar({ zoom, page, totalPages, onZoomIn, onZoomOut, onGoToPage }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const commitInProgressRef = useRef(false)
  const [inputValue, setInputValue] = useState(String(page))

  // Sync input with external page changes (e.g. scrolling), but not while focused
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setInputValue(String(page))
    }
  }, [page])

  const commitPage = () => {
    const val = parseInt(inputValue, 10)
    if (!isNaN(val)) {
      onGoToPage(val)
    } else {
      setInputValue(String(page))
    }
  }

  return (
    <div
      className="drag-region"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '8px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        height: 44,
      }}
    >
      {/* Spacer for symmetry when window controls are on the right */}
      <div style={{ width: 72, flexShrink: 0 }} />

      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          onClick={onZoomOut}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
          title="Zoom out"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <span
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            minWidth: 40,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {zoom}%
        </span>

        <button
          onClick={onZoomIn}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
          title="Zoom in"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <div
          style={{
            width: 1,
            height: 16,
            background: 'var(--border-strong)',
            margin: '0 6px',
          }}
        />

        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={() => {
            if (commitInProgressRef.current) return
            commitPage()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitInProgressRef.current = true
              commitPage()
              ;(e.target as HTMLInputElement).blur()
              commitInProgressRef.current = false
            }
          }}
          style={{
            width: 44,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            padding: '3px 6px',
            color: 'var(--text-primary)',
            fontSize: 12,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          / {totalPages || '-'}
        </span>
      </div>

      {/* Window controls */}
      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          width: 72,
          flexShrink: 0,
          justifyContent: 'flex-end',
        }}
      >
        <WindowButton onClick={() => window.electronAPI.minimizeWindow()} title="Minimize">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </WindowButton>
        <WindowButton onClick={() => window.electronAPI.maximizeWindow()} title="Maximize / Restore">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="1" />
          </svg>
        </WindowButton>
        <WindowButton onClick={() => window.electronAPI.closeWindow()} title="Close">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </WindowButton>
      </div>
    </div>
  )
}

function WindowButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        padding: '6px 8px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 80ms, color 80ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
      }}
    >
      {children}
    </button>
  )
}
