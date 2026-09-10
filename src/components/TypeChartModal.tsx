// Table des types : côté défensif (ce que chaque Pokémon de l'équipe subit par type d'attaque, Téra et talents compris)
// et côté offensif (couverture des attaques offensives de l'équipe contre chaque type).
import { useState } from 'react'
import type { AppState, Lang, PokemonState, SideKey } from '../model'
import { dict } from '../i18n'
import { label } from '../lib/names'
import { moveInfo, speciesInfo, TYPE_NAMES } from '../lib/engine'
import { typesOf } from '../lib/status'
import Modal from './Modal'
import TypeBadge, { TYPE_COLORS } from './TypeBadge'
import { SPRITES } from './Tooltips'
import { gen } from '../lib/gen'

/** Multiplicateur d'un type d'attaque sur un Pokémon (types actuels + immunités et réductions de talents) */
export function defensiveMultiplier(atkType: string, p: PokemonState): number {
  const at = gen.types.get(atkType.toLowerCase() as never)
  if (!at) return 1
  let m = 1
  for (const ty of typesOf(p)) m *= (at.effectiveness as Record<string, number>)[ty] ?? 1
  const a = p.ability
  if (atkType === 'Ground' && (a === 'Levitate' || a === 'Eelevate' || a === 'Earth Eater' || p.item === 'Air Balloon')) return 0
  if (atkType === 'Electric' && ['Volt Absorb', 'Lightning Rod', 'Motor Drive'].includes(a)) return 0
  if (atkType === 'Water' && ['Water Absorb', 'Storm Drain', 'Dry Skin'].includes(a)) return 0
  if (atkType === 'Fire' && ['Flash Fire', 'Well-Baked Body'].includes(a)) return 0
  if (atkType === 'Grass' && a === 'Sap Sipper') return 0
  if (atkType === 'Ghost' && a === 'Purifying Salt') m *= 0.5
  if ((atkType === 'Fire' || atkType === 'Ice') && a === 'Thick Fat') m *= 0.5
  if (atkType === 'Fire' && a === 'Heatproof') m *= 0.5
  if (atkType === 'Fire' && a === 'Dry Skin') m *= 1.25
  if (atkType === 'Fire' && a === 'Fluffy') m *= 2
  if (a === 'Wonder Guard' && m <= 1) return 0
  return m
}

function multClass(m: number): string {
  if (m === 0) return 'bg-slate-500/30 text-slate-200'
  if (m >= 4) return 'bg-red-500/40 text-red-100 font-bold'
  if (m > 1) return 'bg-red-500/20 text-red-200'
  if (m <= 0.25) return 'bg-emerald-500/40 text-emerald-100 font-bold'
  if (m < 1) return 'bg-emerald-500/20 text-emerald-200'
  return 'text-muted'
}
const fmt = (m: number) => (m === 0 ? '×0' : m === 0.25 ? '×¼' : m === 0.5 ? '×½' : m === 1 ? '×1' : `×${m}`)

interface Props { state: AppState; lang: Lang; onClose: () => void }

export default function TypeChartModal({ state, lang, onClose }: Props) {
  const t = dict(lang)
  const [side, setSide] = useState<SideKey>('left')
  const [mode, setMode] = useState<'def' | 'off'>('def')
  const team = state.teams[side].filter((p) => p.species && speciesInfo(p.species))

  // Offensif : types des attaques offensives de chaque Pokémon
  const offense = team.map((p) => ({
    p,
    types: [...new Set(p.moves.filter(Boolean).map((m) => moveInfo(m)).filter((i) => i && i.category !== 'Status').map((i) => i!.type as string))],
  }))
  const offMult = (atk: string, defType: string) => ((gen.types.get(atk.toLowerCase() as never)?.effectiveness as Record<string, number> | undefined)?.[defType] ?? 1)

  return (
    <Modal title={t.typeChart} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
        <div className="flex overflow-hidden rounded border border-border">
          {(['left', 'right'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSide(s)} className={'px-3 py-1 font-semibold ' + (side === s ? (s === 'left' ? 'bg-accent text-white' : 'bg-sky-500 text-white') : 'text-muted hover:text-text')}>{s === 'left' ? t.team1 : t.team2}</button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded border border-border">
          {(['def', 'off'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={'px-3 py-1 font-semibold ' + (mode === m ? 'bg-accent text-white' : 'text-muted hover:text-text')}>{m === 'def' ? t.typeChartDef : t.typeChartOff}</button>
          ))}
        </div>
        <span className="text-muted">{mode === 'def' ? t.typeChartDefHint : t.typeChartOffHint}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {team.length === 0 && <p className="text-sm text-muted">{t.typeChartEmpty}</p>}
        {team.length > 0 && mode === 'def' && (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-24 py-1 text-left font-medium text-muted">{t.typeChartAttackType}</th>
                {team.map((p, i) => (
                  <th key={i} className="py-1 text-center font-medium">
                    <span className="flex flex-col items-center gap-0.5">
                      {SPRITES[p.species] && <img src={SPRITES[p.species]} alt="" className="h-8 w-8 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className="text-[10px]">{label('species', p.species, lang)}</span>
                      <span className="flex gap-0.5">{typesOf(p).map((ty) => <TypeBadge key={ty} type={ty} lang={lang} small tera={!!p.teraType && p.teraActive} />)}</span>
                    </span>
                  </th>
                ))}
                <th className="w-10 py-1 text-center text-red-300" title={t.typeChartWeak}>↓</th>
                <th className="w-10 py-1 text-center text-emerald-300" title={t.typeChartResist}>↑</th>
                <th className="w-12 py-1 text-center text-muted" title={t.typeChartBalance}>=</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_NAMES.map((ty) => {
                const ms = team.map((p) => defensiveMultiplier(ty, p))
                const weak = ms.filter((m) => m > 1).length
                const resist = ms.filter((m) => m < 1).length
                const bal = resist - weak
                return (
                  <tr key={ty} className="border-t border-border/50">
                    <td className="py-1"><TypeBadge type={ty} lang={lang} small /></td>
                    {ms.map((m, i) => <td key={i} className={'py-1 text-center tabular-nums ' + multClass(m)}>{fmt(m)}</td>)}
                    <td className={'py-1 text-center font-semibold ' + (weak ? 'text-red-300' : 'text-muted')}>{weak}</td>
                    <td className={'py-1 text-center font-semibold ' + (resist ? 'text-emerald-300' : 'text-muted')}>{resist}</td>
                    <td className={'py-1 text-center font-bold ' + (bal > 0 ? 'bg-emerald-500/20 text-emerald-200' : bal < 0 ? 'bg-red-500/20 text-red-200' : 'text-muted')}>{bal > 0 ? '+' : ''}{bal}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {team.length > 0 && mode === 'off' && (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-24 py-1 text-left font-medium text-muted">{t.typeChartDefType}</th>
                {offense.map(({ p, types }, i) => (
                  <th key={i} className="py-1 text-center font-medium">
                    <span className="flex flex-col items-center gap-0.5">
                      {SPRITES[p.species] && <img src={SPRITES[p.species]} alt="" className="h-8 w-8 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className="text-[10px]">{label('species', p.species, lang)}</span>
                      <span className="flex flex-wrap justify-center gap-0.5">{types.map((ty) => <span key={ty} className="h-2 w-2 rounded-full" title={label('types', ty, lang)} style={{ backgroundColor: TYPE_COLORS[ty] }} />)}</span>
                    </span>
                  </th>
                ))}
                <th className="w-16 py-1 text-center text-muted" title={t.typeChartBest}>{t.typeChartBestShort}</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_NAMES.map((defType) => {
                const per = offense.map(({ types }) => (types.length ? Math.max(...types.map((a) => offMult(a, defType))) : 0))
                const best = per.length ? Math.max(...per) : 0
                return (
                  <tr key={defType} className="border-t border-border/50">
                    <td className="py-1"><TypeBadge type={defType} lang={lang} small /></td>
                    {per.map((m, i) => {
                      const cls = m === 0 ? 'text-muted' : m >= 2 ? 'bg-emerald-500/25 text-emerald-100 font-semibold' : m < 1 ? 'bg-red-500/20 text-red-200' : 'text-muted'
                      return <td key={i} className={'py-1 text-center tabular-nums ' + cls}>{offense[i].types.length ? fmt(m) : '·'}</td>
                    })}
                    <td className={'py-1 text-center font-bold ' + (best >= 2 ? 'bg-emerald-500/25 text-emerald-100' : best < 1 ? 'bg-red-500/25 text-red-200' : 'text-muted')}>{fmt(best)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
