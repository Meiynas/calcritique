// Speed tiers : où se situe la Vitesse du Pokémon sélectionné par rapport à une liste de référence choisie par l'utilisateur.
// Chaque Pokémon de référence peut apparaître en plusieurs variantes (0 SP, 32 SP, nature +, Mouchoir Choix, Vent Arrière, paralysie).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Lang, PokemonState, SideKey } from '../model'
import { dict } from '../i18n'
import { label } from '../lib/names'
import { buildPokemon, effectiveSpeed, speciesInfo } from '../lib/engine'
import { statAt50 } from '../lib/champions'
import { LEGAL_SPECIES, usageRank } from '../lib/usage'
import Modal from './Modal'
import SearchSelect from './SearchSelect'
import TypeBadge from './TypeBadge'
import { SPRITES } from './Tooltips'

export type VariantKey = 'min' | 'neutral0' | 'neutral32' | 'max' | 'scarf' | 'tailwind' | 'par'
export interface SpeedTiersConfig {
  species: string[]
  variants: Record<VariantKey, boolean>
}
const KEY = 'calcritique.speedtiers.v1'
const ALL_VARIANTS: VariantKey[] = ['min', 'neutral0', 'neutral32', 'max', 'scarf', 'tailwind', 'par']

export function defaultSpeedTiers(): SpeedTiersConfig {
  const species = [...LEGAL_SPECIES].sort((a, b) => usageRank(b) - usageRank(a)).slice(0, 30)
  return { species, variants: { min: false, neutral0: true, neutral32: false, max: true, scarf: false, tailwind: false, par: false } }
}
export function loadSpeedTiers(): SpeedTiersConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSpeedTiers()
    const p = JSON.parse(raw) as Partial<SpeedTiersConfig>
    const d = defaultSpeedTiers()
    return { species: Array.isArray(p.species) ? p.species.filter((s) => typeof s === 'string' && speciesInfo(s)) : d.species, variants: { ...d.variants, ...(p.variants ?? {}) } }
  } catch {
    return defaultSpeedTiers()
  }
}
export function saveSpeedTiers(c: SpeedTiersConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* stockage indisponible */ }
}

/** Vitesse d'une variante de référence au niveau 50 */
function variantSpeed(base: number, v: VariantKey): number {
  switch (v) {
    case 'min': return statAt50(base, 0, 'spe', 0.9)
    case 'neutral0': return statAt50(base, 0, 'spe', 1)
    case 'neutral32': return statAt50(base, 32, 'spe', 1)
    case 'max': return statAt50(base, 32, 'spe', 1.1)
    case 'scarf': return Math.floor(statAt50(base, 32, 'spe', 1.1) * 1.5)
    case 'tailwind': return statAt50(base, 32, 'spe', 1.1) * 2
    case 'par': return Math.floor(statAt50(base, 32, 'spe', 1.1) * 0.5)
  }
}

interface Props {
  state: AppState
  lang: Lang
  onClose: () => void
}

export default function SpeedTiersModal({ state, lang, onClose }: Props) {
  const t = dict(lang)
  const [config, setConfig] = useState<SpeedTiersConfig>(() => loadSpeedTiers())
  const [side, setSide] = useState<SideKey>('left')
  const [manage, setManage] = useState(false)
  const update = (c: SpeedTiersConfig) => { setConfig(c); saveSpeedTiers(c) }

  const me: PokemonState = state.teams[side][state.selected[side]]
  const mySpeed = me.species ? effectiveSpeed(buildPokemon(me), me, state.field[side], state.field) : 0
  const myInfo = me.species ? speciesInfo(me.species) : undefined
  const natureMod: 0.9 | 1 | 1.1 = (() => {
    const n = me.nature
    const plus = ['Timid', 'Hasty', 'Jolly', 'Naive'].includes(n)
    const minus = ['Brave', 'Relaxed', 'Quiet', 'Sassy'].includes(n)
    return plus ? 1.1 : minus ? 0.9 : 1
  })()
  // Facteur des modificateurs actuels (objet, talent, Vent Arrière, boosts, statut) par rapport à la stat brute
  const rawSpe = myInfo ? statAt50(myInfo.baseStats.spe, me.sp.spe, 'spe', natureMod) : 0
  const factor = rawSpe > 0 ? mySpeed / rawSpe : 1

  const rows = useMemo(() => {
    const out: { species: string; variant: VariantKey; speed: number }[] = []
    for (const sp of config.species) {
      const info = speciesInfo(sp)
      if (!info) continue
      for (const v of ALL_VARIANTS) if (config.variants[v]) out.push({ species: sp, variant: v, speed: variantSpeed(info.baseStats.spe, v) })
    }
    return out.sort((a, b) => b.speed - a.speed || a.species.localeCompare(b.species))
  }, [config])

  /** SP de Vitesse nécessaires (avec la nature actuelle et les modificateurs actuels) pour dépasser une vitesse cible */
  function spToBeat(target: number): number | null {
    if (!myInfo) return null
    for (let sp = 0; sp <= 32; sp++) {
      if (Math.floor(statAt50(myInfo.baseStats.spe, sp, 'spe', natureMod) * factor) > target) return sp
    }
    return null
  }

  const faster = rows.filter((r) => r.speed > mySpeed).length
  const slower = rows.filter((r) => r.speed < mySpeed).length
  const ties = rows.filter((r) => r.speed === mySpeed).length
  const inserted = rows.findIndex((r) => r.speed <= mySpeed)

  return (
    <Modal title={t.speedTiers} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
        <div className="flex overflow-hidden rounded border border-border">
          {(['left', 'right'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSide(s)} className={'px-3 py-1 font-semibold ' + (side === s ? (s === 'left' ? 'bg-accent text-white' : 'bg-sky-500 text-white') : 'text-muted hover:text-text')}>
              {s === 'left' ? t.team1 : t.team2} · {label('species', state.teams[s][state.selected[s]].species, lang) || '·'}
            </button>
          ))}
        </div>
        {me.species && (
          <span className="flex items-center gap-2">
            <b className="text-base tabular-nums">{mySpeed}</b>
            <span className="text-muted">{t.speedTiersMine(faster, ties, slower)}</span>
          </span>
        )}
        <button type="button" onClick={() => setManage((v) => !v)} className={'ml-auto rounded border px-2 py-1 ' + (manage ? 'border-accent bg-accent/20' : 'border-border hover:text-text')}>⚙ {t.speedTiersManage}</button>
      </div>

      {manage && (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-2/50 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-muted">{t.speedTiersVariants} :</span>
            {ALL_VARIANTS.map((v) => (
              <label key={v} className="flex items-center gap-1">
                <input type="checkbox" checked={config.variants[v]} onChange={(e) => update({ ...config, variants: { ...config.variants, [v]: e.target.checked } })} />
                {t.speedVariant[v]}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">{t.speedTiersAdd} :</span>
            <SearchSelect kind="species" value="" onChange={(v) => { if (v && !config.species.includes(v)) update({ ...config, species: [...config.species, v] }) }} lang={lang} placeholder={t.searchPokemon} keys={LEGAL_SPECIES} className="w-64" />
            <button type="button" onClick={() => update(defaultSpeedTiers())} className="rounded border border-border px-2 py-1 text-muted hover:text-text">{t.speedTiersReset}</button>
            <button type="button" onClick={() => update({ ...config, species: [] })} className="rounded border border-border px-2 py-1 text-muted hover:text-text">{t.speedTiersClear}</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {config.species.map((sp) => (
              <span key={sp} className="flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5">
                {SPRITES[sp] && <img src={SPRITES[sp]} alt="" className="inline-block h-5 w-5 object-contain" style={{ imageRendering: 'pixelated' }} />}
                {label('species', sp, lang)}
                <button type="button" onClick={() => update({ ...config, species: config.species.filter((x) => x !== sp) })} className="text-muted hover:text-accent">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {!me.species && <p className="text-sm text-muted">{t.speedTiersNoMon}</p>}
        {rows.length === 0 && <p className="text-sm text-muted">{t.speedTiersEmpty}</p>}
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r, i) => {
              const cmp = r.speed > mySpeed ? 'faster' : r.speed < mySpeed ? 'slower' : 'tie'
              const need = cmp === 'faster' ? spToBeat(r.speed) : null
              const info = speciesInfo(r.species)!
              const rowEl = (
                <tr key={`${r.species}-${r.variant}`} className={'border-t border-border/50 ' + (cmp === 'tie' ? 'bg-amber-500/10' : '')}>
                  <td className="w-12 py-1 pr-2 text-right font-semibold tabular-nums">{r.speed}</td>
                  <td className="py-1">
                    <span className="flex items-center gap-1.5">
                      {SPRITES[r.species] && <img src={SPRITES[r.species]} alt="" className="inline-block h-6 w-6 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className="font-medium">{label('species', r.species, lang)}</span>
                      {info.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} small />)}
                      <span className="text-muted">{t.speedVariant[r.variant]}</span>
                    </span>
                  </td>
                  <td className={'py-1 text-right ' + (cmp === 'faster' ? 'text-orange-300' : cmp === 'slower' ? 'text-emerald-300' : 'text-amber-300')}>
                    {me.species ? (cmp === 'faster' ? (need === null ? <span className="text-muted">{t.speedCantBeat}</span> : t.speedNeedSP(need, me.sp.spe)) : cmp === 'slower' ? t.speedSlowerThanYou : t.speedTieRow) : ''}
                  </td>
                </tr>
              )
              if (me.species && i === inserted) {
                return [<MeRow key="me" me={me} speed={mySpeed} lang={lang} side={side} />, rowEl]
              }
              return rowEl
            })}
            {me.species && inserted === -1 && <MeRow me={me} speed={mySpeed} lang={lang} side={side} />}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function MeRow({ me, speed, lang, side }: { me: PokemonState; speed: number; lang: Lang; side: SideKey }) {
  const t = dict(lang)
  const ref = useRef<HTMLTableRowElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'center' }) }, [me.species, side])
  return (
    <tr ref={ref} className={'border-y-2 ' + (side === 'left' ? 'border-accent bg-accent/15' : 'border-sky-400 bg-sky-400/15')}>
      <td className="w-12 py-1.5 pr-2 text-right text-sm font-bold tabular-nums">{speed}</td>
      <td className="py-1.5" colSpan={2}>
        <span className="flex items-center gap-1.5">
          {SPRITES[me.species] && <img src={SPRITES[me.species]} alt="" className="inline-block h-6 w-6 object-contain" style={{ imageRendering: 'pixelated' }} />}
          <b>{label('species', me.species, lang)}</b>
          <span className="text-muted">{t.speedTiersYou} · {me.sp.spe} SP · {label('natures', me.nature, lang)}{me.item ? ` · ${label('items', me.item, lang)}` : ''}{me.status === 'par' ? ` · ${t.statusNames.par}` : ''}</span>
        </span>
      </td>
    </tr>
  )
}
