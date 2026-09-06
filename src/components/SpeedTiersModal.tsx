// Speed tiers : où se situe la Vitesse du Pokémon sélectionné par rapport à TOUS les Pokémon du pool Champions.
// Chaque Pokémon apparaît en plusieurs variantes (0 SP, 32 SP, 32 SP nature +, set automatique), avec fusion des variantes sans intérêt.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Lang, PokemonState, SideKey } from '../model'
import { dict } from '../i18n'
import { label, normalize } from '../lib/names'
import { buildPokemon, effectiveSpeed, finalStats, speciesInfo } from '../lib/engine'
import { statAt50 } from '../lib/champions'
import { LEGAL_SPECIES, mostPlayedSet } from '../lib/usage'
import Modal from './Modal'
import TypeBadge from './TypeBadge'
import { SPRITES } from './Tooltips'

export type VariantKey = 'neutral0' | 'neutral32' | 'max' | 'mostPlayed' | 'team'
export interface SpeedTiersConfig {
  variants: Record<Exclude<VariantKey, 'team'>, boolean>
  /** Mouchoir Choix donné à tous les Pokémon comparés (x1,5) */
  scarfAll: boolean
}
const KEY = 'calcritique.speedtiers.v3'
const CONFIG_VARIANTS: Exclude<VariantKey, 'team'>[] = ['neutral0', 'neutral32', 'max', 'mostPlayed']

export function defaultSpeedTiers(): SpeedTiersConfig {
  return { variants: { neutral0: true, neutral32: true, max: true, mostPlayed: true }, scarfAll: false }
}
export function loadSpeedTiers(): SpeedTiersConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSpeedTiers()
    const p = JSON.parse(raw) as Partial<SpeedTiersConfig>
    const d = defaultSpeedTiers()
    return { variants: { ...d.variants, ...(p.variants ?? {}) }, scarfAll: !!p.scarfAll }
  } catch {
    return defaultSpeedTiers()
  }
}
export function saveSpeedTiers(c: SpeedTiersConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* stockage indisponible */ }
}

interface Row { species: string; variant: VariantKey; speed: number; detail: string; merged: number; scarfed?: boolean; team?: SideKey; index?: number }
const isMega = (species: string) => species.includes('-Mega')

/** Vitesse d'une variante de référence au niveau 50 (sans Mouchoir) et son libellé de détail */
function variantRow(species: string, v: VariantKey, lang: Lang): { speed: number; detail: string } | null {
  const info = speciesInfo(species)
  if (!info) return null
  const base = info.baseStats.spe
  switch (v) {
    case 'neutral0': return { speed: statAt50(base, 0, 'spe', 1), detail: '' }
    case 'neutral32': return { speed: statAt50(base, 32, 'spe', 1), detail: '' }
    case 'max': return { speed: statAt50(base, 32, 'spe', 1.1), detail: '' }
    case 'team': return null
    case 'mostPlayed': {
      const set = mostPlayedSet(species)
      const stats = finalStats(set)
      const scarf = set.item === 'Choice Scarf'
      return { speed: scarf ? Math.floor(stats.spe * 1.5) : stats.spe, detail: `${label('natures', set.nature, lang)} ${set.sp.spe} SP${set.item ? ' · ' + label('items', set.item, lang) : ''}` }
    }
  }
}

interface Props {
  state: AppState
  lang: Lang
  initialSide?: SideKey
  onClose: () => void
  /** Modifier un Pokémon d'une équipe depuis la fenêtre (SP de Vitesse, stade de Vitesse) */
  onUpdate: (side: SideKey, index: number, patch: Partial<PokemonState>) => void
}

const STAGES = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6]

/** Réglages rapides : SP de Vitesse (0 à 32) et stade de Vitesse (−6 à +6) d'un Pokémon */
function SpeedControls({ p, onChange, lang }: { p: PokemonState; onChange: (patch: Partial<PokemonState>) => void; lang: Lang }) {
  const t = dict(lang)
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-muted" onClick={(e) => e.stopPropagation()}>
      <span>SP</span>
      <input
        type="number" min={0} max={32} value={p.sp.spe}
        onChange={(e) => onChange({ sp: { ...p.sp, spe: Math.max(0, Math.min(32, Number(e.target.value) || 0)) } })}
        className="w-11 rounded border border-border bg-surface px-1 py-0.5 text-right text-xs text-text"
      />
      <span title={t.boost}>{t.boostShort}</span>
      <select value={p.boosts.spe} onChange={(e) => onChange({ boosts: { ...p.boosts, spe: Number(e.target.value) } })} className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-text">
        {STAGES.map((n) => <option key={n} value={n}>{n > 0 ? '+' + n : n}</option>)}
      </select>
    </span>
  )
}

export default function SpeedTiersModal({ state, lang, initialSide, onClose, onUpdate }: Props) {
  const t = dict(lang)
  const [config, setConfig] = useState<SpeedTiersConfig>(() => loadSpeedTiers())
  const [side, setSide] = useState<SideKey>(initialSide ?? 'left')
  const [manage, setManage] = useState(false)
  const [q, setQ] = useState('')
  const [teamsOnly, setTeamsOnly] = useState(false)
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

  /** SP de Vitesse nécessaires (avec la nature actuelle et les modificateurs actuels) pour dépasser une vitesse cible */
  function spToBeat(target: number): number | null {
    if (!myInfo) return null
    for (let sp = 0; sp <= 32; sp++) {
      if (Math.floor(statAt50(myInfo.baseStats.spe, sp, 'spe', natureMod) * factor) > target) return sp
    }
    return null
  }

  const rows = useMemo(() => {
    const all: Row[] = []
    for (const sp of LEGAL_SPECIES) {
      for (const v of CONFIG_VARIANTS) {
        if (!config.variants[v]) continue
        const r = variantRow(sp, v, lang)
        if (!r) continue
        // Mouchoir pour tous : pas pour les Méga (elles tiennent leur pierre), ni en double sur un set qui l'a déjà
        const scarfed = config.scarfAll && !isMega(sp) && !(v === 'mostPlayed' && mostPlayedSet(sp).item === 'Choice Scarf')
        const speed = scarfed ? Math.floor(r.speed * 1.5) : r.speed
        // Ses propres variantes restent utiles (0 SP contre 32 SP...), sauf celle qui a exactement sa Vitesse
        if (sp === me.species && speed === mySpeed) continue
        all.push({ species: sp, variant: v, speed, detail: r.detail, merged: 0, scarfed })
      }
    }
    // Les Pokémon des deux équipes avec leur set réel (rouge = équipe 1, bleu = équipe 2)
    for (const sd of ['left', 'right'] as SideKey[]) {
      state.teams[sd].forEach((p, i) => {
        if (!p.species || !speciesInfo(p.species)) return
        if (sd === side && i === state.selected[sd]) return
        const speed = effectiveSpeed(buildPokemon(p), p, state.field[sd], state.field)
        const detail = `${label('natures', p.nature, lang)} ${p.sp.spe} SP${p.item ? ' · ' + label('items', p.item, lang) : ''}${p.status === 'par' ? ' · ' + t.statusNames.par : ''}`
        all.push({ species: p.species, variant: 'team', speed, detail, merged: 0, team: sd, index: i })
      })
    }
    // Fusion : les variantes d'un même Pokémon toutes hors de portée sont regroupées sur la plus rapide
    const out: Row[] = []
    const bySpecies = new Map<string, Row[]>()
    for (const r of all) bySpecies.set(r.species, [...(bySpecies.get(r.species) ?? []), r])
    // Même règle pour les variantes plus lentes que moi : regroupées sur la plus rapide d'entre elles (la plus proche)
    const mergeGroup = (group: Row[]) => {
      if (group.length > 1) {
        const top = group.reduce((a, b) => (b.speed > a.speed ? b : a))
        out.push({ ...top, merged: group.length - 1 })
      } else out.push(...group)
    }
    for (const list0 of bySpecies.values()) {
      const teamRows = list0.filter((r) => r.variant === 'team')
      out.push(...teamRows) // jamais fusionnées
      const list = list0.filter((r) => r.variant !== 'team')
      const unreachable = list.filter((r) => r.speed > mySpeed && spToBeat(r.speed) === null)
      const slower = list.filter((r) => r.speed < mySpeed)
      const rest = list.filter((r) => !unreachable.includes(r) && !slower.includes(r))
      mergeGroup(unreachable)
      mergeGroup(slower)
      out.push(...rest)
    }
    // Doublons exacts (même Pokémon, même vitesse) : on garde une ligne
    const seen = new Set<string>()
    return out
      .filter((r) => { if (r.variant === 'team') return true; const k = `${r.species}:${r.speed}`; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => b.speed - a.speed || a.species.localeCompare(b.species))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, lang, mySpeed, myInfo, natureMod, factor, state, side, t])

  const nq = normalize(q)
  const teamSpecies = new Set([...state.teams.left, ...state.teams.right].map((p) => p.species).filter(Boolean))
  // "Les 2 équipes seulement" : uniquement les sets actuels des Pokémon en équipe (pas de variantes)
  const shown = rows
    .filter((r) => !teamsOnly || (r.variant === 'team' && teamSpecies.has(r.species)))
    .filter((r) => !nq || normalize(label('species', r.species, lang)).includes(nq) || normalize(r.species).includes(nq))
  const faster = rows.filter((r) => r.speed > mySpeed).length
  const slower = rows.filter((r) => r.speed < mySpeed).length
  const ties = rows.filter((r) => r.speed === mySpeed).length
  const inserted = shown.findIndex((r) => r.speed <= mySpeed)

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
        <input className="input !w-44 !py-0.5" placeholder={t.speedTiersSearch} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={teamsOnly} onChange={(e) => setTeamsOnly(e.target.checked)} />
          {t.speedTeamsOnly}
        </label>
        <label className="ml-auto flex items-center gap-1" title={t.speedScarfAllHint}>
          <input type="checkbox" checked={config.scarfAll} onChange={(e) => update({ ...config, scarfAll: e.target.checked })} />
          {t.speedScarfAll}
        </label>
        <button type="button" onClick={() => setManage((v) => !v)} className={'rounded border px-2 py-1 ' + (manage ? 'border-accent bg-accent/20' : 'border-border hover:text-text')}>⚙ {t.speedTiersManage}</button>
      </div>

      {manage && (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-2/50 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-muted">{t.speedTiersVariants} :</span>
            {CONFIG_VARIANTS.map((v) => (
              <label key={v} className="flex items-center gap-1">
                <input type="checkbox" checked={config.variants[v]} onChange={(e) => update({ ...config, variants: { ...config.variants, [v]: e.target.checked } })} />
                {t.speedVariant[v]}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {!me.species && <p className="text-sm text-muted">{t.speedTiersNoMon}</p>}
        {rows.length === 0 && <p className="text-sm text-muted">{t.speedTiersEmpty}</p>}
        <table className="w-full text-xs">
          <tbody>
            {shown.map((r, i) => {
              const cmp = r.speed > mySpeed ? 'faster' : r.speed < mySpeed ? 'slower' : 'tie'
              const need = cmp === 'faster' ? spToBeat(r.speed) : null
              const info = speciesInfo(r.species)!
              const inTeam: SideKey | null = r.team ?? (state.teams.left.some((p) => p.species === r.species) ? 'left' : state.teams.right.some((p) => p.species === r.species) ? 'right' : null)
              const teamCls = r.team ? (r.team === 'left' ? 'bg-accent/15 border-l-4 border-l-accent' : 'bg-sky-400/15 border-l-4 border-l-sky-400') : inTeam ? (inTeam === 'left' ? 'border-l-4 border-l-accent/40' : 'border-l-4 border-l-sky-400/40') : 'border-l-4 border-l-transparent'
              const rowEl = (
                <tr key={`${r.species}-${r.variant}-${r.speed}-${r.team ?? ''}`} className={'border-t border-border/50 ' + (cmp === 'tie' ? 'bg-amber-500/10 ' : '') + teamCls}>
                  <td className="w-12 py-1 pr-2 text-right font-semibold tabular-nums">{r.speed}</td>
                  <td className="py-1">
                    <span className="flex items-center gap-1.5">
                      {SPRITES[r.species] && <img src={SPRITES[r.species]} alt="" className="inline-block h-6 w-6 object-contain" style={{ imageRendering: 'pixelated' }} />}
                      <span className="font-medium">{label('species', r.species, lang)}</span>
                      {info.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} small />)}
                      {r.team && <span className={'rounded px-1 text-[10px] font-bold text-white ' + (r.team === 'left' ? 'bg-accent' : 'bg-sky-500')}>{r.team === 'left' ? t.team1 : t.team2}</span>}
                      <span className="text-muted">{t.speedVariant[r.variant]}{r.detail ? ` (${r.detail})` : ''}{r.scarfed ? ` · ${t.scarfShort.replace(':', '')}` : ''}</span>
                      {r.team && r.index !== undefined && <SpeedControls p={state.teams[r.team][r.index]} onChange={(patch) => onUpdate(r.team!, r.index!, patch)} lang={lang} />}
                      {r.merged > 0 && <span className="rounded bg-surface-2 px-1 text-[10px] text-muted" title={t.speedMergedHint}>+{r.merged}</span>}
                    </span>
                  </td>
                  <td className={'py-1 text-right ' + (cmp === 'faster' ? 'text-orange-300' : cmp === 'slower' ? 'text-emerald-300' : 'text-amber-300')}>
                    {me.species ? (cmp === 'faster' ? (need === null ? <span className="text-muted">{t.speedCantBeat}</span> : t.speedNeedSP(need, me.sp.spe)) : cmp === 'slower' ? t.speedSlowerThanYou : t.speedTieRow) : ''}
                  </td>
                </tr>
              )
              if (me.species && i === inserted) {
                return [<MeRow key="me" me={me} speed={mySpeed} lang={lang} side={side} onChange={(patch) => onUpdate(side, state.selected[side], patch)} />, rowEl]
              }
              return rowEl
            })}
            {me.species && inserted === -1 && <MeRow me={me} speed={mySpeed} lang={lang} side={side} onChange={(patch) => onUpdate(side, state.selected[side], patch)} />}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function MeRow({ me, speed, lang, side, onChange }: { me: PokemonState; speed: number; lang: Lang; side: SideKey; onChange: (patch: Partial<PokemonState>) => void }) {
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
          <span className="text-muted">{t.speedTiersYou} · {label('natures', me.nature, lang)}{me.item ? ` · ${label('items', me.item, lang)}` : ''}{me.status === 'par' ? ` · ${t.statusNames.par}` : ''}</span>
          <SpeedControls p={me} onChange={onChange} lang={lang} />
        </span>
      </td>
    </tr>
  )
}
