// Infobulles au survol : attaque (nom, type, puissance, précision, description) et Pokémon (icône, stats de base, talents, Vitesse max).
import { useState, type ReactNode } from 'react'
import type { Lang } from '../model'
import { dict } from '../i18n'
import { label } from '../lib/names'
import { EXTRA, moveInfo, speciesInfo } from '../lib/engine'
import { statAt50 } from '../lib/champions'
import TypeBadge from './TypeBadge'
import movedescJson from '../data/movedesc.json'
import spritesJson from '../data/sprites.json'

const MOVEDESC = movedescJson as Record<string, { fr: string; en: string }>
export const SPRITES = spritesJson as Record<string, string>

/** Enveloppe qui affiche `tip` au survol (au-dessus ou en dessous selon la place). */
export function Hover({ tip, children, className }: { tip: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [below, setBelow] = useState(false)
  // "truncate" (overflow hidden) irait couper l'infobulle : on le garde sur un span intérieur
  const cls = (className ?? '').split(' ').filter(Boolean)
  const truncate = cls.includes('truncate')
  const outer = cls.filter((c) => c !== 'truncate').join(' ')
  return (
    <span
      className={'relative ' + outer}
      onMouseEnter={(e) => { setBelow(e.currentTarget.getBoundingClientRect().top < 240); setOpen(true) }}
      onMouseLeave={() => setOpen(false)}
    >
      {truncate ? <span className="block min-w-0 truncate">{children}</span> : children}
      {open && (
        <span className={'pointer-events-none absolute left-0 z-50 w-72 rounded-lg border border-border bg-surface p-2.5 text-left text-xs font-normal normal-case tracking-normal text-text shadow-xl ' + (below ? 'top-full mt-1' : 'bottom-full mb-1')}>
          {tip}
        </span>
      )}
    </span>
  )
}

export function MoveTip({ move, lang }: { move: string; lang: Lang }) {
  const t = dict(lang)
  const info = moveInfo(move)
  if (!info) return null
  const extra = EXTRA.moves[move]
  const desc = MOVEDESC[move]?.[lang] || MOVEDESC[move]?.en || ''
  const cat = info.category === 'Physical' ? t.catPhysical : info.category === 'Special' ? t.catSpecial : t.catStatus
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <TypeBadge type={info.type} lang={lang} small />
        <b className="text-sm">{label('moves', move, lang)}</b>
        {lang === 'fr' && label('moves', move, 'en') !== label('moves', move, 'fr') && <span className="text-muted">{label('moves', move, 'en')}</span>}
      </span>
      <span className="flex flex-wrap gap-x-3 text-muted">
        <span>{cat}</span>
        <span>{t.power} : <b className="text-text">{info.basePower > 0 ? info.basePower : '·'}</b></span>
        <span>{t.accuracy} : <b className="text-text">{extra?.acc === null ? '∞' : `${extra?.acc ?? 100} %`}</b></span>
        {extra?.prio ? <span>{t.priority} : <b className="text-text">{extra.prio > 0 ? '+' : ''}{extra.prio}</b></span> : null}
      </span>
      {desc && <span className="leading-snug">{desc}</span>}
    </span>
  )
}

export function PokemonTip({ species, lang }: { species: string; lang: Lang }) {
  const t = dict(lang)
  const info = speciesInfo(species)
  if (!info) return null
  const bs = info.baseStats
  const abilities = EXTRA.species[species]?.abilities ?? []
  const maxSpe = statAt50(bs.spe, 32, 'spe', 1.1)
  const minSpe = statAt50(bs.spe, 0, 'spe', 0.9)
  const sprite = SPRITES[species]
  const stats: [string, number][] = [[t.statNames.hp, bs.hp], [t.statNames.atk, bs.atk], [t.statNames.def, bs.def], [t.statNames.spa, bs.spa], [t.statNames.spd, bs.spd], [t.statNames.spe, bs.spe]]
  return (
    <span className="flex gap-2">
      {sprite && <img src={sprite} alt="" className="h-14 w-16 shrink-0 object-contain object-top" style={{ imageRendering: 'pixelated' }} />}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <b className="text-sm">{label('species', species, lang)}</b>
          {info.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} small />)}
        </span>
        <span className="grid grid-cols-6 gap-0.5 text-center tabular-nums">
          {stats.map(([n, v]) => <span key={n} className="rounded bg-surface-2 px-0.5 py-0.5"><span className="block text-[9px] text-muted">{n}</span><b>{v}</b></span>)}
        </span>
        <span className="text-muted">{t.abilities} : <span className="text-text">{abilities.map((a) => label('abilities', a, lang)).join(', ') || '·'}</span></span>
        <span className="text-muted">{t.speedRange} : <b className="text-text">{minSpe}</b> – <b className="text-text">{maxSpe}</b> <span className="text-[10px]">({t.scarfShort} {Math.floor(maxSpe * 1.5)})</span></span>
      </span>
    </span>
  )
}
