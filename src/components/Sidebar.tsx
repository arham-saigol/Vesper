import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import type { FolderData, PdfFile, Theme } from '../types'

interface SidebarProps {
  open: boolean
  folders: FolderData[]
  activeFileId: string | null
  theme: Theme
  onToggle: () => void
  onAddFolder: (name: string) => void
  onToggleFolder: (id: string) => void
  onAddFile: (folderId: string) => void
  onOpenFile: (file: PdfFile) => void
  onToggleTheme: () => void
}

export function Sidebar({
  open,
  folders,
  activeFileId,
  theme,
  onToggle,
  onAddFolder,
  onToggleFolder,
  onAddFile,
  onOpenFile,
  onToggleTheme,
}: SidebarProps) {
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingFolder && inputRef.current) {
      inputRef.current.focus()
    }
  }, [addingFolder])

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      onAddFolder(newFolderName.trim())
      setNewFolderName('')
    }
    setAddingFolder(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddFolder()
    if (e.key === 'Escape') {
      setAddingFolder(false)
      setNewFolderName('')
    }
  }

  return (
    <div style={{ position: 'relative', height: '100%', flexShrink: 0 }}>
      {/* Sidebar panel */}
      <div
        style={{
          width: open ? 260 : 0,
          minWidth: open ? 260 : 0,
          height: '100%',
          background: 'var(--bg-surface)',
          borderRight: open ? '1px solid var(--border)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 120ms ease, min-width 120ms ease',
          flexShrink: 0,
        }}
      >
        {open && (
          <>
            {/* Wordmark */}
            <div
              className="drag-region"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '18px 16px 14px',
                flexShrink: 0,
              }}
            >
              <img
                src="./assets/Square44x44Logo.targetsize-24_altform-unplated.png"
                alt="Vesper"
                width={26}
                height={26}
                draggable={false}
                style={{ display: 'block', flexShrink: 0 }}
              />
              <span
                style={{
                  fontFamily: "'VesperSerif', Georgia, 'Times New Roman', serif",
                  fontSize: 18,
                  color: 'var(--text-primary)',
                  letterSpacing: 0.5,
                }}
              >
                Vesper
              </span>
            </div>

            {/* Folders header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Folders
              </span>
              <button
                onClick={() => setAddingFolder(true)}
                title="New folder"
                className="no-drag"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
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
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {/* Inline folder input */}
            {addingFolder && (
              <div style={{ padding: '4px 16px 8px' }}>
                <input
                  ref={inputRef}
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleAddFolder}
                  placeholder="Folder name"
                  className="no-drag"
                  style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            )}

            {/* Folders list */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '0 8px 12px',
              }}
            >
              {folders.map(folder => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  activeFileId={activeFileId}
                  onToggle={() => onToggleFolder(folder.id)}
                  onAddFile={() => onAddFile(folder.id)}
                  onOpenFile={onOpenFile}
                />
              ))}
              {folders.length === 0 && !addingFolder && (
                <div
                  style={{
                    padding: '16px',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  No folders yet
                </div>
              )}
            </div>

            {/* Bottom: theme toggle */}
            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
              <button
                onClick={onToggleTheme}
                className="no-drag"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 4,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
                title="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Toggle button at edge */}
      <button
        onClick={onToggle}
        className="no-drag"
        style={{
          position: 'absolute',
          left: open ? 246 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: 28,
          height: 56,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderLeft: open ? undefined : 'none',
          borderRadius: open ? '0 8px 8px 0' : '0 6px 6px 0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          transition: 'left 120ms ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 120ms ease',
          }}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  )
}

function FolderItem({
  folder,
  activeFileId,
  onToggle,
  onAddFile,
  onOpenFile,
}: {
  folder: FolderData
  activeFileId: string | null
  onToggle: () => void
  onAddFile: () => void
  onOpenFile: (file: PdfFile) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderRadius: 6,
          cursor: 'pointer',
          userSelect: 'none',
          color: 'var(--text-secondary)',
        }}
        onClick={onToggle}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: folder.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 100ms ease',
            flexShrink: 0,
            marginLeft: -2,
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {folder.name}
        </span>
        {hovered && (
          <button
            onClick={e => {
              e.stopPropagation()
              onAddFile()
            }}
            title="Add PDF"
            className="no-drag"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              flexShrink: 0,
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
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {folder.expanded && (
        <div style={{ paddingLeft: 20 }}>
          {folder.files.map(file => (
            <div
              key={file.id}
              onClick={() => onOpenFile(file)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                color: file.id === activeFileId ? 'var(--accent)' : 'var(--text-muted)',
                background: file.id === activeFileId ? 'rgba(217,119,87,0.08)' : 'transparent',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
              onMouseEnter={e => {
                if (file.id !== activeFileId) {
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-hover)'
                }
              }}
              onMouseLeave={e => {
                if (file.id !== activeFileId) {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }
              }}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, opacity: 0.7 }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
            </div>
          ))}
          {folder.files.length === 0 && (
            <div
              style={{
                padding: '6px 8px',
                fontSize: 11,
                color: 'var(--text-muted)',
                opacity: 0.6,
              }}
            >
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  )
}
