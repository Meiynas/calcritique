// Champ de recherche avec liste déroulante, bilingue et tolérant aux accents.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../model'
import { search, searchIndex, type NameKind, type SearchEntry } from '../lib/names'

interface Props {
  kind: NameKind
  value: string
  onChange: (key: string) => void
  lang: Lang
  placeholder?: string
  /** Sous-ensemble de clés autorisées (sinon tout le catalogue) */
  keys?: string[]
  /** Clés mises en avant en tête de liste quand la recherche est vide */
  suggested?: string[]
  allowEmpty?: boolean
  emptyLabel?: string
  className?: string
  renderExtra?: (entry: SearchEntry) => React.ReactNode
}

export default function SearchSelect({ kind, value, onChange, lang, placeholder, keys, suggested, allowEmpty, emptyLabel, className, renderExtra }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const entries = useMemo(() => searchIndex(kind, keys), [kind, keys])
  const suggestedEntries = useMemo(() => (suggested ? searchIndex(kind, suggested) : []), [kind, suggested])

  const results = useMemo(() => {
    if (!query.trim() && suggestedEntries.length) {
      const rest = search(entries, '', lang, 12).filter((e) => !suggested!.includes(e.key))
      return [...suggestedEntries, ...rest].slice(0, 14)
    }
    return search(entries, query, lang, 14)
  }, [entries, suggestedEntries, suggested, query, lang])

  const display = value ? (entries.find((e) => e.key === value) ?? searchIndex(kind, [value])[0]) : undefined
  const shown = display ? (lang === 'fr' ? display.fr : display.en) : ''

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(key: string) {
    onChange(key)
    setQuery('')
    setOpen(false)
    input.current?.blur()
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) pick(results[active].key) }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
  }

  return (
    <div ref={box} className={'relative ' + (className ?? '')}>
      <input
        ref={input}
        className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
        value={open ? query : shown}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0) }}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true) }}
        onKeyDown={onKey}
        spellCheck={false}
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full min-w-56 overflow-auto rounded-md border border-border bg-surface shadow-xl">
          {allowEmpty && (
            <li
              className="cursor-pointer px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2"
              onMouseDown={(e) => { e.preventDefault(); pick('') }}
            >
              {emptyLabel ?? '·'}
            </li>
          )}
          {results.map((e, i) => (
            <li
              key={e.key}
              className={'flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-sm ' + (i === active ? 'bg-surface-2' : 'hover:bg-surface-2')}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(ev) => { ev.preventDefault(); pick(e.key) }}
            >
              <span className="truncate">
                {lang === 'fr' ? e.fr : e.en}
                {e.fr !== e.en && <span className="ml-2 text-xs text-muted">{lang === 'fr' ? e.en : e.fr}</span>}
              </span>
              {renderExtra?.(e)}
            </li>
          ))}
          {results.length === 0 && <li className="px-2.5 py-1.5 text-sm text-muted">∅</li>}
        </ul>
      )}
    </div>
  )
}
