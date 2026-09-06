// Matrice équipe contre équipe : pour chaque attaquant (lignes) et chaque cible (colonnes), la meilleure attaque du kit
// avec son taux de OHKO (vrai taux : précision et critique compris) et de 2HKO. Deux sens : équipe 1 attaque, équipe 2 attaque.
import { useMemo, useState } from 'react'
import type { AppState, Lang, PokemonState, SideKey } from '../model'
import { dict } from '../i18n'
import { label } from '../lib/names'
import { computeMove, damageRange, moveInfo, speciesInfo, type MoveResult } from '../lib/engine'
import { learnset } from '../lib/usage'
import Modal from './Modal'
import TypeBadge from './TypeBadge'
import { SPRITES } from './Tooltips'

interface Props { state: AppState; lang: Lang; onClose: () => void }

/** Attaques sur 2 tours (charge ou semi-invulnérabilité) et attaques à recharge : écartées si l'option est cochée */
const TWO_TURN_MOVES = new Set([
  'Fly', 'Dig', 'Dive', 'Bounce', 'Phantom Force', 'Shadow Force', 'Sky Attack', 'Solar Beam', 'Solar Blade', 'Skull Bash', 'Razor Wind',
  'Freeze Shock', 'Ice Burn', 'Geomancy', 'Meteor Beam', 'Electro Shot', 'Sky Drop', 'Hyper Beam', 'Giga Impact', 'Blast Burn', 'Hydro Cannon',
  'Frenzy Plant', 'Rock Wrecker', 'Roar of Time', 'Prismatic Laser', 'Eternabeam',
])

interface Cell { move: string; ohko: number; twohko: number; maxPct: number; minPct: number; r: MoveResult; inKit: boolean }

function bestCell(atk: PokemonState, def: PokemonState, state: AppState, side: SideKey, includeAll: boolean, noTwoTurn: boolean): Cell | null {
  const battle = { gameType: state.mode === '1v1' ? ('Singles' as const) : ('Doubles' as const), targetCount: 1 }
  const kit = atk.moves.filter(Boolean)
  let candidates = kit
  if (includeAll) {
    // Tout le learnset : présélection rapide (fourchette de dégâts) des 6 attaques qui frappent le plus fort, puis calcul complet
    const ranked = learnset(atk.species)
      .filter((m) => { const i = moveInfo(m); return i && i.category !== 'Status' && i.basePower > 0 && !(noTwoTurn && TWO_TURN_MOVES.has(m)) })
      .map((m) => ({ m, r: damageRange(m, atk, def, state.field, side, battle) }))
      .filter((x) => x.r && x.r.max > 0)
      .sort((a, b) => b.r!.min - a.r!.min || b.r!.max - a.r!.max)
      .slice(0, 6)
      .map((x) => x.m)
    candidates = [...new Set([...kit, ...ranked])]
  }
  let best: Cell | null = null
  for (const m of candidates) {
    const info = moveInfo(m)
    if (!info || info.category === 'Status') continue
    const r = computeMove(m, atk, def, state.field, { ...state.options, critMode: 'chance', maxTurns: 2 }, side, battle)
    if (!r || r.max <= 0) continue
    const cell: Cell = { move: m, ohko: r.koTrue[0] ?? 0, twohko: r.koTrue[1] ?? 0, maxPct: r.maxPct, minPct: r.minPct, r, inKit: kit.includes(m) }
    if (!best || cell.ohko > best.ohko || (cell.ohko === best.ohko && (cell.twohko > best.twohko || (cell.twohko === best.twohko && cell.maxPct > best.maxPct)))) best = cell
  }
  return best
}

function cellClass(c: Cell | null): string {
  if (!c) return 'bg-surface-2 text-muted'
  if (c.ohko >= 0.9995) return 'bg-red-500/45 text-red-50 font-bold'
  if (c.ohko >= 0.5) return 'bg-red-500/25 text-red-100'
  if (c.ohko > 0) return 'bg-orange-500/20 text-orange-100'
  if (c.twohko >= 0.9995) return 'bg-amber-500/25 text-amber-100'
  if (c.twohko > 0) return 'bg-amber-500/10 text-amber-100'
  return 'bg-emerald-500/15 text-emerald-100'
}
const pct = (p: number) => (p >= 0.9995 ? '100' : p <= 0 ? '0' : (Math.round(p * 1000) / 10).toFixed(1).replace(/\.0$/, ''))

export default function MatrixModal({ state, lang, onClose }: Props) {
  const t = dict(lang)
  const [dir, setDir] = useState<SideKey>('left')
  const [includeAll, setIncludeAll] = useState(false)
  const [noTwoTurn, setNoTwoTurn] = useState(true)
  const attackers = state.teams[dir].map((p, i) => ({ p, i })).filter(({ p }) => p.species && speciesInfo(p.species))
  const foe: SideKey = dir === 'left' ? 'right' : 'left'
  const defenders = state.teams[foe].map((p, i) => ({ p, i })).filter(({ p }) => p.species && speciesInfo(p.species))
  const grid = useMemo(() => attackers.map(({ p: a }) => defenders.map(({ p: d }) => bestCell(a, d, state, dir, includeAll, noTwoTurn))), [attackers, defenders, state, dir, includeAll, noTwoTurn])

  return (
    <Modal title={t.matrix} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
        <div className="flex overflow-hidden rounded border border-border">
          {(['left', 'right'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setDir(s)} className={'px-3 py-1 font-semibold ' + (dir === s ? (s === 'left' ? 'bg-accent text-white' : 'bg-sky-500 text-white') : 'text-muted hover:text-text')}>{s === 'left' ? t.matrixDir(t.team1) : t.matrixDir(t.team2)}</button>
          ))}
        </div>
        <label className="flex items-center gap-1" title={t.matrixAllHint}>
          <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />
          {t.matrixAll}
        </label>
        {includeAll && (
          <label className="flex items-center gap-1" title={t.matrixNoTwoTurnHint}>
            <input type="checkbox" checked={noTwoTurn} onChange={(e) => setNoTwoTurn(e.target.checked)} />
            {t.matrixNoTwoTurn}
          </label>
        )}
        <span className="basis-full text-muted">{t.matrixHint}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {(attackers.length === 0 || defenders.length === 0) && <p className="text-sm text-muted">{t.typeChartEmpty}</p>}
        {attackers.length > 0 && defenders.length > 0 && (
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-28 text-left text-[10px] font-medium text-muted">{t.matrixCorner}</th>
                {defenders.map(({ p, i }) => (
                  <th key={i} className="py-1 text-center font-medium">
                    <span className="flex flex-col items-center gap-0.5">
                      {SPRITES[p.species] && <img src={SPRITES[p.species]} alt="" className="h-8 w-8 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className={'text-[10px] ' + (foe === 'left' ? 'text-accent' : 'text-sky-400')}>{label('species', p.species, lang)}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attackers.map(({ p, i }, ai) => (
                <tr key={i}>
                  <td className="py-1 pr-1">
                    <span className="flex items-center gap-1">
                      {SPRITES[p.species] && <img src={SPRITES[p.species]} alt="" className="h-7 w-7 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className={'truncate text-[11px] font-semibold ' + (dir === 'left' ? 'text-accent' : 'text-sky-400')}>{label('species', p.species, lang)}</span>
                    </span>
                  </td>
                  {grid[ai].map((c, di) => {
                    const info = c ? moveInfo(c.move) : undefined
                    return (
                      <td key={di} className={'rounded px-1.5 py-1 text-center align-top ' + cellClass(c)} title={c ? `${label('moves', c.move, lang)} : ${Math.floor(c.minPct * 10) / 10} à ${Math.floor(c.maxPct * 10) / 10} % · OHKO ${pct(c.ohko)} % · 2HKO ${pct(c.twohko)} %` : ''}>
                        {c ? (
                          <span className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-bold tabular-nums">{pct(c.ohko)} %</span>
                            <span className="text-[10px] opacity-80">2HKO {pct(c.twohko)} %</span>
                            <span className="flex items-center gap-1 text-[10px]">{info && <TypeBadge type={info.type} lang={lang} small />}<span className={'truncate ' + (c.inKit ? '' : 'italic underline decoration-dotted')} title={c.inKit ? '' : t.adviceNotInKit}>{label('moves', c.move, lang)}{c.inKit ? '' : ' *'}</span></span>
                            <span className="text-[10px] opacity-70">{Math.floor(c.minPct)}–{Math.floor(c.maxPct)} %</span>
                          </span>
                        ) : '·'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
