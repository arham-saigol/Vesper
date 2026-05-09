import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { HighlightColor } from '../types'

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; activeRing: string }[] = [
  { color: 'yellow', bg: '#fde047', activeRing: 'rgba(253, 224, 71, 0.6)' },
  { color: 'green', bg: '#86efac', activeRing: 'rgba(134, 239, 172, 0.6)' },
  { color: 'blue', bg: '#93c5fd', activeRing: 'rgba(147, 197, 253, 0.6)' },
  { color: 'pink', bg: '#f9a8d4', activeRing: 'rgba(249, 168, 212, 0.6)' },
]

interface ToolbarProps {
  zoom: number
  page: number
  totalPages: number
  onZoomIn: () => void
  onZoomOut: () => void
  onGoToPage: (page: number) => void
  highlightMode: boolean
  annotationMode: boolean
  eraserMode: boolean
  highlightColor: HighlightColor
  onToggleHighlightMode: () => void
  onToggleAnnotationMode: () => void
  onToggleEraserMode: () => void
  onChangeColor: (color: HighlightColor) => void
}

export function Toolbar({
  zoom, page, totalPages, onZoomIn, onZoomOut, onGoToPage,
  highlightMode, annotationMode, eraserMode, highlightColor,
  onToggleHighlightMode, onToggleAnnotationMode, onToggleEraserMode, onChangeColor,
}: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const commitInProgressRef = useRef(false)
  const [inputValue, setInputValue] = useState(String(page))

  const colorPickerVisible = highlightMode || annotationMode

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

        <HighlighterButton
          active={highlightMode}
          color={highlightColor}
          onToggle={onToggleHighlightMode}
        />

        <AnnotationButton
          active={annotationMode}
          color={highlightColor}
          onToggle={onToggleAnnotationMode}
        />

        <EraserButton
          active={eraserMode}
          onToggle={onToggleEraserMode}
        />

        {colorPickerVisible && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
            {HIGHLIGHT_COLORS.map(({ color, bg, activeRing }) => (
              <button
                key={color}
                onClick={() => onChangeColor(color)}
                title={`Color ${color}`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: bg,
                  outline: highlightColor === color ? `2px solid ${activeRing}` : 'none',
                  outlineOffset: 2,
                  padding: 0,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        )}

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

function HighlighterButton({
  active,
  color,
  onToggle,
}: {
  active: boolean
  color: HighlightColor
  onToggle: () => void
}) {
  const colorMap: Record<HighlightColor, string> = {
    yellow: '#fde047',
    green: '#86efac',
    blue: '#93c5fd',
    pink: '#f9a8d4',
  }
  return (
    <button
      onClick={onToggle}
      title={active ? 'Exit highlight mode' : 'Enter highlight mode'}
      style={{
        background: active ? 'var(--bg-card-hover)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? colorMap[color] : 'var(--text-muted)',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 16,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 80ms, color 80ms',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 11-6 6v3h9l3-3" />
        <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
      </svg>
    </button>
  )
}

function AnnotationButton({
  active,
  color,
  onToggle,
}: {
  active: boolean
  color: HighlightColor
  onToggle: () => void
}) {
  const colorMap: Record<HighlightColor, string> = {
    yellow: '#fde047',
    green: '#86efac',
    blue: '#93c5fd',
    pink: '#f9a8d4',
  }
  return (
    <button
      onClick={onToggle}
      title={active ? 'Exit annotation mode' : 'Enter annotation mode'}
      style={{
        background: active ? 'var(--bg-card-hover)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? colorMap[color] : 'var(--text-muted)',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 16,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 80ms, color 80ms',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    </button>
  )
}

function EraserButton({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      title={active ? 'Exit eraser mode' : 'Enter eraser mode'}
      style={{
        background: active ? 'var(--bg-card-hover)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--destructive)' : 'var(--text-muted)',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 16,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 80ms, color 80ms',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
        <path d="M22 21H7" />
        <path d="m5 11 9 9" />
      </svg>
    </button>
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
