// Fenêtre de choix d'objet : les plus joués sur ce Pokémon, puis tous les objets.
import { useMemo, useState } from 'react'
import type { Lang } from '../model'
import { dict } from '../i18n'
import { label, NAMES, normalize } from '../lib/names'
import { topItems, usagePercent } from '../lib/usage'
import Modal from './Modal'

interface Props {
  species: string
  lang: Lang
  onPick: (item: string) => void
  onClose: () => void
}

export default function ItemPicker({ species, lang, onPick, onClose }: Props) {
  const t = dict(lang)
  const [query, setQuery] = useState('')
  const top = useMemo(() => topItems(species, 10), [species])
  const q = normalize(query)
  const match = (i: string) => !q || normalize(label('items', i, 'fr')).includes(q) || normalize(label('items', i, 'en')).includes(q)
  const topShown = top.filter(([i]) => match(i))
  const topSet = new Set(top.map(([i]) => i))
  const rest = Object.keys(NAMES.items)
    .filter((i) => !topSet.has(i) && match(i))
    .sort((a, b) => label('items', a, lang).localeCompare(label('items', b, lang)))

  return (
    <Modal title={`${t.pickItem} · ${label('species', species, lang)}`} onClose={onClose}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <input autoFocus className="input !w-64" placeholder={t.searchItem} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" onClick={() => onPick('')} className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-text">{t.none}</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {topShown.length > 0 && <Title>{t.mostPlayed}</Title>}
        {topShown.map(([i, pct]) => <Row key={i} item={i} pct={pct} lang={lang} onPick={onPick} />)}
        <Title>{t.allItems} ({rest.length})</Title>
        {rest.map((i) => <Row key={i} item={i} pct={usagePercent(species, 'items', i)} lang={lang} onPick={onPick} />)}
      </div>
    </Modal>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="sticky top-0 z-10 bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</div>
}

function Row({ item, pct, lang, onPick }: { item: string; pct?: number; lang: Lang; onPick: (i: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(item)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface-2">
      <span className="min-w-0 flex-1 truncate font-medium">
        {label('items', item, lang)}
        {label('items', item, 'en') !== label('items', item, 'fr') && <span className="ml-1 text-xs text-muted">{lang === 'fr' ? label('items', item, 'en') : label('items', item, 'fr')}</span>}
      </span>
      <span className="w-12 text-right text-xs tabular-nums text-emerald-300">{pct !== undefined ? `${pct}%` : ''}</span>
    </button>
  )
}
