export function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--text-muted)',
      }}
    >
      <img
        src="./assets/Claude_Icon_6.png"
        alt="Vesper"
        width={48}
        height={48}
        draggable={false}
        style={{ opacity: 0.5, display: 'block' }}
      />
      <span style={{ fontSize: 14, fontWeight: 400 }}>No file open</span>
    </div>
  )
}
