// Infobulles au survol : attaque (nom, type, puissance, précision, description) et Pokémon (icône, stats de base, talents, Vitesse max).
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

/** Enveloppe qui affiche `tip` au survol. L'infobulle est rendue à la racine de la page (portal) en position fixe :
    elle passe au-dessus de tout et n'hérite ni de la transparence ni du découpage (overflow) de son parent. */
export function Hover({ tip, children, className }: { tip: ReactNode; children: ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null)
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const below = r.top < 260
    setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 300)), y: below ? r.bottom + 4 : r.top - 4, below })
  }
  return (
    <span
      className={'relative ' + (className ?? '')}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        <span
          className="pointer-events-none fixed z-[1000] w-72 rounded-lg border border-border bg-surface p-2.5 text-left text-xs font-normal normal-case tracking-normal text-text shadow-2xl"
          style={{ left: pos.x, top: pos.y, transform: pos.below ? undefined : 'translateY(-100%)', opacity: 1 }}
        >
          {tip}
        </span>,
        document.body,
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
  const stats: [string, number][] = [[t.statShort.hp, bs.hp], [t.statShort.atk, bs.atk], [t.statShort.def, bs.def], [t.statShort.spa, bs.spa], [t.statShort.spd, bs.spd], [t.statShort.spe, bs.spe]]
  return (
    <span className="flex gap-2">
      {sprite && <img src={sprite} alt="" className="h-14 w-14 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <b className="text-sm">{label('species', species, lang)}</b>
          {info.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} small />)}
        </span>
        <span className="grid grid-cols-6 gap-0.5 text-center tabular-nums">
          {stats.map(([n, v]) => <span key={n} className="whitespace-nowrap rounded bg-surface-2 px-0.5 py-0.5"><span className="block text-[9px] text-muted">{n}</span><b>{v}</b></span>)}
        </span>
        <span className="text-muted">{t.abilities} : <span className="text-text">{abilities.map((a) => label('abilities', a, lang)).join(', ') || '·'}</span></span>
        <span className="text-muted">{t.speedRange} : <b className="text-text">{minSpe}</b> – <b className="text-text">{maxSpe}</b> <span className="text-[10px]">({t.scarfShort} {Math.floor(maxSpe * 1.5)})</span></span>
      </span>
    </span>
  )
}
