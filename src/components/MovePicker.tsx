// Fenêtre de choix d'attaque : les plus jouées d'abord, puis tout le learnset, avec filtres.
import { useMemo, useState } from 'react'
import type { Lang } from '../model'
import { dict } from '../i18n'
import { label, normalize } from '../lib/names'
import { EXTRA, moveInfo, TYPE_NAMES } from '../lib/engine'
import { learnset, topMoves, usagePercent } from '../lib/usage'
import Modal from './Modal'
import TypeBadge from './TypeBadge'
import { Hover, MoveTip } from './Tooltips'

type Cat = '' | 'Physical' | 'Special' | 'Status'

interface Props {
  species: string
  currentMoves: string[]
  lang: Lang
  onPick: (move: string) => void
  onClose: () => void
}

export default function MovePicker({ species, currentMoves, lang, onPick, onClose }: Props) {
  const t = dict(lang)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Cat>('')
  const [type, setType] = useState('')
  const [showAll, setShowAll] = useState(false)

  const top = useMemo(() => topMoves(species, currentMoves.filter(Boolean), 10), [species, currentMoves])
  const pool = useMemo(() => {
    const ls = learnset(species)
    const base = showAll || ls.length === 0 ? Object.keys(EXTRA.moves) : ls
    return base.filter((m) => moveInfo(m))
  }, [species, showAll])

  const matches = (m: string) => {
    const info = moveInfo(m)!
    if (cat && (info.category ?? 'Status') !== cat) return false
    if (type && info.type !== type) return false
    if (query) {
      const q = normalize(query)
      if (!normalize(label('moves', m, 'fr')).includes(q) && !normalize(label('moves', m, 'en')).includes(q)) return false
    }
    return true
  }
  const topShown = top.filter(([m]) => matches(m))
  const topSet = new Set(top.map(([m]) => m))
  const catOrder: Record<string, number> = { Physical: 0, Special: 1, Status: 2 }
  const power = (m: string) => {
    const info = moveInfo(m)!
    const acc = EXTRA.moves[m]?.acc
    return info.basePower * ((acc === null || acc === undefined ? 100 : acc) / 100)
  }
  const rest = pool
    .filter((m) => !topSet.has(m) && !currentMoves.includes(m) && matches(m))
    .sort((a, b) => {
      const ia = moveInfo(a)!, ib = moveInfo(b)!
      const ta = label('types', ia.type, lang), tb = label('types', ib.type, lang)
      if (ta !== tb) return ta.localeCompare(tb)
      const ca = catOrder[ia.category ?? 'Status'], cb = catOrder[ib.category ?? 'Status']
      if (ca !== cb) return ca - cb
      if (ca === 2) return label('moves', a, lang).localeCompare(label('moves', b, lang))
      const d = power(b) - power(a)
      return d !== 0 ? d : label('moves', a, lang).localeCompare(label('moves', b, lang))
    })

  return (
    <Modal title={`${t.pickMove} · ${label('species', species, lang)}`} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <input autoFocus className="input !w-56" placeholder={t.searchMove} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex overflow-hidden rounded border border-border text-xs">
          {([['', t.all], ['Physical', t.physical], ['Special', t.special], ['Status', t.statusCat]] as [Cat, string][]).map(([c, name]) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={'px-2 py-1 ' + (cat === c ? 'bg-accent text-white' : 'text-muted hover:text-text')}>{name}</button>
          ))}
        </div>
        <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t.allTypes}</option>
          {TYPE_NAMES.map((ty) => <option key={ty} value={ty}>{label('types', ty, lang)}</option>)}
        </select>
        <label className="ml-auto flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-accent" />
          {t.showAllMoves}
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {topShown.length > 0 && (
          <>
            <SectionTitle>{t.mostPlayed}</SectionTitle>
            {topShown.map(([m, pct]) => <MoveRow key={m} move={m} pct={pct} lang={lang} onPick={onPick} learnable />)}
          </>
        )}
        <SectionTitle>{showAll ? t.allMovesTitle : t.learnableMoves} ({rest.length})</SectionTitle>
        {rest.map((m, i) => {
          const ty = moveInfo(m)!.type
          const prevTy = i > 0 ? moveInfo(rest[i - 1])!.type : null
          return (
            <div key={m}>
              {ty !== prevTy && <div className="mt-1 flex items-center gap-2 px-2 py-0.5"><TypeBadge type={ty} lang={lang} small /><span className="h-px flex-1 bg-border" /></div>}
              <MoveRow move={m} pct={usagePercent(species, 'moves', m)} lang={lang} onPick={onPick} learnable={!showAll || learnset(species).includes(m)} />
            </div>
          )
        })}
        {rest.length === 0 && topShown.length === 0 && <p className="px-2 py-4 text-sm text-muted">∅</p>}
      </div>
    </Modal>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="sticky top-0 z-10 bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</div>
}

export function MoveRow({ move, pct, lang, onPick, learnable, compact }: { move: string; pct?: number; lang: Lang; onPick: (m: string) => void; learnable: boolean; compact?: boolean }) {
  const t = dict(lang)
  const info = moveInfo(move)!
  const extra = EXTRA.moves[move]
  const cat = info.category === 'Physical' ? 'Phys' : info.category === 'Special' ? 'Spé' : 'Stat'
  return (
    <button
      type="button"
      onClick={() => onPick(move)}
      className={'flex w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-surface-2 ' + (compact ? 'py-0.5' : 'py-1') + (learnable ? '' : ' opacity-50')}
    >
      <TypeBadge type={info.type} lang={lang} small fixed />
      <Hover tip={<MoveTip move={move} lang={lang} />} className="min-w-0 flex-1 truncate font-medium">{label('moves', move, lang)}{lang === 'fr' && label('moves', move, 'en') !== label('moves', move, 'fr') && <span className="ml-1 text-xs text-muted">{label('moves', move, 'en')}</span>}</Hover>
      <span className="w-9 text-right text-xs text-muted">{cat}</span>
      <span className="w-8 text-right text-xs tabular-nums">{info.basePower > 0 ? info.basePower : info.category === 'Status' ? '·' : t.varPower}</span>
      <span className="w-10 text-right text-xs tabular-nums text-muted">{extra?.acc === null ? '∞' : `${extra?.acc ?? 100}%`}</span>
      <span className="w-12 text-right text-xs tabular-nums text-emerald-300">{pct !== undefined ? `${pct}%` : ''}</span>
    </button>
  )
}
