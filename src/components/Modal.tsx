import { useEffect } from 'react'

export default function Modal({ title, onClose, children, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={'mt-8 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl ' + (wide ? 'max-w-4xl' : 'max-w-2xl')}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
          <button type="button" onClick={onClose} className="rounded border border-border px-2 py-0.5 text-sm text-muted hover:text-text">✕</button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
