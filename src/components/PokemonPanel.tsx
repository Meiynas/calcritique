// Panneau d'un Pokémon : espèce, nature, SP, objet, talent, Téra, attaques, statut, PV, stades, Abri.
import { useMemo, useState } from 'react'
import type { Lang, PokemonState, StatKey, StatusKey } from '../model'
import { STAT_KEYS, SWITCH_IN } from '../model'
import { dict } from '../i18n'
import { label, NAMES } from '../lib/names'
import { EXTRA, TYPE_NAMES, finalStats, moveInfo, natureInfo, speciesInfo } from '../lib/engine'
import { SP_MAX_STAT, SP_MAX_TOTAL, spTotal } from '../lib/champions'
import { canLearn, mostPlayedSet, usagePercent } from '../lib/usage'
import { isProtecting } from '../lib/engine'
import SearchSelect from './SearchSelect'
import TypeBadge from './TypeBadge'
import { Hover, MoveTip } from './Tooltips'
import MovePicker from './MovePicker'
import ItemPicker from './ItemPicker'
import PokemonPicker from './PokemonPicker'

export interface Seeder {
  victims: { index: number; species: string; mine: boolean }[]
  toggle: (victimIndex: number, on: boolean) => void
}

interface Props {
  title: string
  role: 'attacker' | 'defender'
  value: PokemonState
  onChange: (p: PokemonState) => void
  seeder?: Seeder
  onSaveSet?: (p: PokemonState, name: string) => void
  onClear?: () => void
  /** Espèces de la même équipe (pour les suggestions de coéquipiers) */
  teamSpecies?: string[]
  /** Cibles possibles en 2v2 (absent en 1v1) */
  targetOptions?: { value: number | 'ally'; label: string; pos: string }[]
  lang: Lang
}

const NATURE_KEYS = Object.keys(NAMES.natures)
const STATUSES: StatusKey[] = ['', 'brn', 'par', 'psn', 'tox', 'slp', 'frz']
const STAGES = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6]

export default function PokemonPanel({ title, role, value, onChange, onClear, teamSpecies = [], targetOptions, lang, seeder, onSaveSet }: Props) {
  const [saveName, setSaveName] = useState<string | null>(null)
  const t = dict(lang)
  const species = speciesInfo(value.species)
  const stats = useMemo(() => finalStats(value), [value])
  const total = spTotal(value.sp)
  const over = total > SP_MAX_TOTAL
  const nature = natureInfo(value.nature)
  const abilities = EXTRA.species[value.species]?.abilities ?? []
  const [picker, setPicker] = useState<null | { kind: 'move'; slot: number } | { kind: 'item' } | { kind: 'pokemon' }>(null)

  function set<K extends keyof PokemonState>(key: K, v: PokemonState[K]) {
    onChange({ ...value, [key]: v })
  }
  function setSp(stat: StatKey, v: number) {
    const n = Math.max(0, Math.min(SP_MAX_STAT, Math.round(Number.isFinite(v) ? v : 0)))
    onChange({ ...value, sp: { ...value.sp, [stat]: n } })
  }
  /** Choisit la nature à partir d'un + et d'un − sur les stats (même stat des deux côtés = nature neutre). */
  function setNature(stat: StatKey, which: 'plus' | 'minus') {
    const cur = natureInfo(value.nature)
    const neutral = !cur?.plus || cur.plus === cur.minus
    let plus = neutral ? undefined : cur!.plus
    let minus = neutral ? undefined : cur!.minus
    if (which === 'plus') { plus = stat; if (!minus) minus = stat === 'spa' ? 'atk' : 'spa' }
    else { minus = stat; if (!plus) plus = stat === 'atk' ? 'spa' : 'atk' }
    // Même stat des deux côtés = nature neutre (Sérieux), voulue explicitement
    if (plus === minus) { set('nature', 'Serious'); return }
    const found = NATURE_KEYS.find((n) => { const i = natureInfo(n); return i?.plus === plus && i?.minus === minus })
    if (found) set('nature', found)
  }
  function setBoost(stat: StatKey, v: number) {
    onChange({ ...value, boosts: { ...value.boosts, [stat]: v } })
  }
  function setMove(i: number, m: string) {
    const moves = [...value.moves]
    moves[i] = m
    onChange({ ...value, moves, activeMove: m ? i : value.activeMove })
  }
  function pickSpecies(key: string) {
    // Nouveau Pokémon : on part de son set le plus joué
    onChange({ ...mostPlayedSet(key), activeMove: 0 })
  }

  const accent = role === 'attacker' ? 'text-accent' : 'text-sky-400'

  if (!value.species || !species) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-surface/70 p-4 flex flex-col items-center gap-3">
        <h2 className={'text-sm font-semibold uppercase tracking-wide ' + accent}>{title}</h2>
        <button type="button" onClick={() => setPicker({ kind: 'pokemon' })} className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm hover:border-accent">
          + {t.emptySlot}
        </button>
        {picker?.kind === 'pokemon' && <PokemonPicker team={teamSpecies} lang={lang} onPick={(s) => { pickSpecies(s); setPicker(null) }} onClose={() => setPicker(null)} />}
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className={'text-sm font-semibold uppercase tracking-wide ' + accent}>{title}</h2>
        <div className="flex items-center gap-2">
          {onClear && (
            <button type="button" onClick={onClear} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted hover:text-text">{t.clearSlot}</button>
          )}
          <div className="flex gap-1">
            {species.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} />)}
            {value.teraType && value.teraActive && <span className="text-xs text-muted self-center">→</span>}
            {value.teraType && value.teraActive && <TypeBadge type={value.teraType} lang={lang} tera />}
          </div>
        </div>
      </div>

      {/* Espèce */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setPicker({ kind: 'pokemon' })} className="flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-left text-base font-semibold hover:border-accent">
          {label('species', value.species, lang)}
          <span className="ml-2 text-[11px] font-normal text-muted">{t.change}</span>
        </button>
        <button type="button" onClick={() => onChange({ ...mostPlayedSet(value.species), activeMove: 0 })} title={t.applyMostPlayed} className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-muted hover:border-accent hover:text-text">
          ★ {t.applyMostPlayed}
        </button>
        {onSaveSet && (
          <button type="button" onClick={() => setSaveName(`${label('species', value.species, lang)}${value.item ? ' ' + label('items', value.item, lang) : ''}`)} title={t.libSaveSet} className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-muted hover:border-accent hover:text-text">
            💾
          </button>
        )}
      </div>
      {saveName !== null && onSaveSet && (
        <form
          className="flex items-center gap-2 text-xs"
          onSubmit={(e) => { e.preventDefault(); onSaveSet(value, saveName.trim() || label('species', value.species, lang)); setSaveName(null) }}
        >
          <span className="text-muted">{t.libSetName} :</span>
          <input autoFocus className="input !py-1" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
          <button type="submit" className="rounded border border-accent bg-accent/20 px-2 py-1 font-semibold">{t.libSaveSet}</button>
          <button type="button" onClick={() => setSaveName(null)} className="rounded border border-border px-2 py-1 text-muted">✕</button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label={t.nature}>
          <select className="input" value={value.nature} onChange={(e) => set('nature', e.target.value)}>
            {NATURE_KEYS.map((n) => {
              const info = natureInfo(n)
              const eff = info?.plus && info.plus !== info.minus ? ` (+${t.statNames[info.plus as StatKey]} −${t.statNames[info.minus as StatKey]})` : ''
              const pct = usagePercent(value.species, 'natures', n)
              return <option key={n} value={n}>{label('natures', n, lang)}{eff}{pct !== undefined ? ` · ${pct}%` : ''}</option>
            })}
          </select>
        </Field>
        <Field label={t.tera}>
          <div className="flex gap-1">
          <select className="input min-w-0 flex-1" value={value.teraType} onChange={(e) => set('teraType', e.target.value)}>
            <option value="">{t.teraOff}</option>
            {TYPE_NAMES.map((ty) => <option key={ty} value={ty}>{label('types', ty, lang)}</option>)}
          </select>
          {value.teraType && (
            <button
              type="button"
              onClick={() => set('teraActive', !value.teraActive)}
              title={t.teraToggleHint}
              className={'shrink-0 rounded-md border px-2 text-xs font-bold ' + (value.teraActive ? 'border-accent bg-accent/20 text-text' : 'border-border bg-surface-2 text-muted hover:text-text')}
            >
              {value.teraActive ? 'ON' : 'OFF'}
            </button>
          )}
          </div>
        </Field>
        <Field label={t.item}>
          <button type="button" onClick={() => setPicker({ kind: 'item' })} className="input text-left hover:border-accent">
            {value.item ? label('items', value.item, lang) : <span className="text-muted">{t.none}</span>}
            <UsageTag pct={value.item ? usagePercent(value.species, 'items', value.item) : undefined} />
          </button>
        </Field>
        <Field label={t.ability}>
          <SearchSelect kind="abilities" value={value.ability} onChange={(v) => set('ability', v)} lang={lang} placeholder={t.searchAbility} suggested={abilities} allowEmpty emptyLabel={t.none} />
        </Field>
      </div>

      {/* Stats */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t.stats}</span>
          <span className={'text-xs font-semibold ' + (over ? 'text-accent' : 'text-muted')}>
            {t.spBudget} : {total} / {SP_MAX_TOTAL}
          </span>
        </div>
        {over && <div className="mb-1 rounded bg-accent/15 px-2 py-1 text-xs text-accent">{t.spOver}</div>}
        <table className="w-full table-fixed text-sm">
          <colgroup><col className="w-12" /><col className="w-16" /><col className="w-12" /><col className="w-16" /><col className="w-12" /><col className="w-14" /></colgroup>
          <thead className="text-[11px] uppercase text-muted">
            <tr><th className="font-medium" title={t.natureHint}>{t.natureShort}</th><th className="text-left font-medium"> </th><th className="font-medium">Base</th><th className="font-medium">{t.sp}</th><th className="font-medium">=</th><th className="font-medium">{t.boost}</th></tr>
          </thead>
          <tbody>
            {STAT_KEYS.map((k) => {
              const isNeutral = !nature?.plus || nature.plus === nature.minus
              const plus = !isNeutral && nature?.plus === k
              const minus = !isNeutral && nature?.minus === k
              return (
                <tr key={k} className="border-t border-border/60">
                  <td className="text-center">
                    {k !== 'hp' && (
                      <span className="inline-flex overflow-hidden rounded border border-border text-[11px]">
                        <button type="button" title={t.natureHint} onClick={() => setNature(k, 'plus')} className={'w-5 ' + (plus ? 'bg-emerald-500 text-white' : 'text-muted hover:text-text')}>+</button>
                        <button type="button" title={t.natureHint} onClick={() => setNature(k, 'minus')} className={'w-5 ' + (minus ? 'bg-accent text-white' : 'text-muted hover:text-text')}>−</button>
                      </span>
                    )}
                  </td>
                  <td className={'py-1 font-medium ' + (plus ? 'text-emerald-400' : minus ? 'text-accent' : '')}>
                    {t.statNames[k]}
                  </td>
                  <td className="text-center text-muted">{species.baseStats[k]}</td>
                  <td className="text-center">
                    <input
                      type="number" min={0} max={SP_MAX_STAT} value={value.sp[k]}
                      onChange={(e) => setSp(k, e.target.valueAsNumber)}
                      className="w-full rounded border border-border bg-surface-2 px-1 py-0.5 text-center focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="text-center font-semibold tabular-nums">{stats[k]}</td>
                  <td className="text-center">
                    {k !== 'hp' && (
                      <select className="rounded border border-border bg-surface-2 px-1 py-0.5" value={value.boosts[k]} onChange={(e) => setBoost(k, Number(e.target.value))}>
                        {STAGES.map((b) => <option key={b} value={b}>{b > 0 ? '+' + b : b}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* Stades précision / esquive / critique et Abri */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="font-semibold uppercase tracking-wide">{t.stages}</span>
          <label className="flex items-center gap-1">{t.accStage}
            <select className="rounded border border-border bg-surface-2 px-1 py-0.5 text-text" value={value.accStage} onChange={(e) => set('accStage', Number(e.target.value))}>
              {STAGES.map((b) => <option key={b} value={b}>{b > 0 ? '+' + b : b}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">{t.evaStage}
            <select className="rounded border border-border bg-surface-2 px-1 py-0.5 text-text" value={value.evaStage} onChange={(e) => set('evaStage', Number(e.target.value))}>
              {STAGES.map((b) => <option key={b} value={b}>{b > 0 ? '+' + b : b}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">{t.critStage}
            <select className="rounded border border-border bg-surface-2 px-1 py-0.5 text-text" value={value.critStage} onChange={(e) => set('critStage', Number(e.target.value))}>
              {[0, 1, 2, 3].map((b) => <option key={b} value={b}>+{b}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => set('protect', !value.protect)}
            title={t.protectHint}
            aria-pressed={isProtecting(value)}
            className={'ml-auto rounded-md border px-2 py-0.5 text-xs font-medium ' + (isProtecting(value) ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100 ring-1 ring-white/30' : 'border-border bg-surface-2 text-muted hover:text-text')}
          >
            🛡 {t.protect}
          </button>
        </div>
      </div>

      {/* Attaques : clic = mettre en avant, ✎ = changer */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t.moves}</span>
          {targetOptions ? (
            <span className="text-[10px] text-muted">{t.activeMoveHint}</span>          ) : (
            <span className="text-[10px] text-muted">{t.activeMoveHint}</span>
          )}
        </div>
        <div className="mt-1 grid grid-cols-1 gap-1">
          {value.moves.map((m, i) => (
            <MoveSlot
              key={i}
              move={m}
              species={value.species}
              active={value.activeMove === i}
              lang={lang}
              onSelect={() => (m ? set('activeMove', i) : setPicker({ kind: 'move', slot: i }))}
              onEdit={() => setPicker({ kind: 'move', slot: i })}
              onClear={() => setMove(i, '')}
              role={role}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, activeMove: value.activeMove === SWITCH_IN ? 0 : SWITCH_IN })}
          title={t.switchInHint}
          className={'mt-1 flex w-full items-center gap-2 rounded-md border px-2 py-1 text-sm ' + (value.activeMove === SWITCH_IN ? (role === 'attacker' ? 'border-accent bg-accent/10' : 'border-sky-400 bg-sky-400/10') : 'border-dashed border-border bg-surface-2 text-muted hover:border-muted')}
        >
          <span className="inline-flex w-16 justify-center rounded bg-stone-500 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white">Switch</span><span className="font-medium">{t.switchInAction}</span>
        </button>
        {targetOptions && (
          <TargetChips value={value} options={targetOptions} onChange={(tg) => set('target', tg)} lang={lang} />
        )}
      </div>

      <div className="flex items-end gap-3">
        <Field label={t.status}>
          <select className="input" value={value.status} onChange={(e) => set('status', e.target.value as StatusKey)}>
            {STATUSES.map((s) => <option key={s} value={s}>{t.statusNames[s]}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-1 pb-2 text-xs text-muted">
          <input type="checkbox" checked={value.leechSeed} onChange={(e) => set('leechSeed', e.target.checked)} />🌱 {t.leechSeedVictim}
        </label>
      </div>
      <SeederBoxes seeder={seeder} lang={lang} />

      {picker?.kind === 'move' && (
        <MovePicker species={value.species} currentMoves={value.moves} lang={lang} onPick={(m) => { setMove(picker.slot, m); setPicker(null) }} onClose={() => setPicker(null)} />
      )}
      {picker?.kind === 'item' && <ItemPicker species={value.species} lang={lang} onPick={(i) => { set('item', i); setPicker(null) }} onClose={() => setPicker(null)} />}
      {picker?.kind === 'pokemon' && <PokemonPicker team={teamSpecies} lang={lang} onPick={(s) => { pickSpecies(s); setPicker(null) }} onClose={() => setPicker(null)} />}
    </section>
  )
}

/** Vue "attaques seulement" d'un Pokémon sur le terrain (mode 2v2, bouton Stats / Attaques). */
export function MovesOnlyPanel({ pos, value, onChange, targetOptions, role, lang, seeder }: {
  pos: string; value: PokemonState; onChange: (p: PokemonState) => void; targetOptions?: { value: number | 'ally'; label: string; pos: string }[]; role: 'attacker' | 'defender'; lang: Lang; seeder?: Seeder
}) {
  const t = dict(lang)
  const [slot, setSlot] = useState<number | null>(null)
  function setMove(i: number, m: string) {
    const moves = [...value.moves] as PokemonState['moves']
    moves[i] = m
    onChange({ ...value, moves, activeMove: m ? i : value.activeMove })
  }
  if (!value.species) {
    return <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted"><b className="mr-1">{pos}</b>{t.emptyField}</div>
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className={'rounded px-1 text-[10px] font-bold text-white ' + (role === 'attacker' ? 'bg-accent' : 'bg-sky-500')}>{pos}</span>
        <span className="font-semibold">{label('species', value.species, lang)}</span>
        <span className="ml-auto text-[10px] text-muted">{t.activeMoveHint}</span>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {value.moves.map((m, i) => (
          <MoveSlot
            key={i}
            move={m}
            species={value.species}
            active={value.activeMove === i}
            lang={lang}
            onSelect={() => (m ? onChange({ ...value, activeMove: i }) : setSlot(i))}
            onEdit={() => setSlot(i)}
            onClear={() => setMove(i, '')}
            role={role}
          />
        ))}
      </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, activeMove: value.activeMove === SWITCH_IN ? 0 : SWITCH_IN })}
          title={t.switchInHint}
          className={'mt-1 flex w-full items-center gap-2 rounded-md border px-2 py-1 text-sm ' + (value.activeMove === SWITCH_IN ? (role === 'attacker' ? 'border-accent bg-accent/10' : 'border-sky-400 bg-sky-400/10') : 'border-dashed border-border bg-surface-2 text-muted hover:border-muted')}
        >
          <span className="inline-flex w-16 justify-center rounded bg-stone-500 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white">Switch</span><span className="font-medium">{t.switchInAction}</span>
        </button>
      {targetOptions && <TargetChips value={value} options={targetOptions} onChange={(tg) => onChange({ ...value, target: tg })} lang={lang} />}
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
        <span>{t.status} :</span>
        <select className="rounded border border-border bg-surface-2 px-1 py-0.5 text-text" value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as StatusKey })}>
          {STATUSES.map((s) => <option key={s} value={s}>{t.statusNames[s]}</option>)}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={value.leechSeed} onChange={(e) => onChange({ ...value, leechSeed: e.target.checked })} />🌱 {t.leechSeedVictim}</label>
      </div>
      <SeederBoxes seeder={seeder} lang={lang} />
      {slot !== null && (
        <MovePicker species={value.species} currentMoves={value.moves} lang={lang} onPick={(m) => { setMove(slot, m); setSlot(null) }} onClose={() => setSlot(null)} />
      )}
    </div>
  )
}

/** Cases "Poseur des Vampigraines de X" pour les victimes adverses */
function SeederBoxes({ seeder, lang }: { seeder?: Seeder; lang: Lang }) {
  const t = dict(lang)
  if (!seeder || seeder.victims.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      {seeder.victims.map((v) => (
        <label key={v.index} className="flex items-center gap-1">
          <input type="checkbox" checked={v.mine} onChange={(e) => seeder.toggle(v.index, e.target.checked)} />🌱 {t.leechSeeder(label('species', v.species, lang))}
        </label>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span>{label}</span>
      {children}
    </label>
  )
}

function UsageTag({ pct }: { pct?: number }) {
  if (pct === undefined) return null
  return <span className="ml-2 text-[10px] text-emerald-300">{pct}%</span>
}

function MoveSlot({ move, species, active, lang, onSelect, onEdit, onClear, role }: {
  move: string; species: string; active: boolean; lang: Lang; onSelect: () => void; onEdit: () => void; onClear: () => void; role: 'attacker' | 'defender'
}) {
  const t = dict(lang)
  const info = move ? moveInfo(move) : undefined
  const extra = move ? EXTRA.moves[move] : undefined
  const pct = move ? usagePercent(species, 'moves', move) : undefined
  const learnable = !move || canLearn(species, move)
  const ring = active ? (role === 'attacker' ? 'border-accent bg-accent/10' : 'border-sky-400 bg-sky-400/10') : 'border-border bg-surface-2 hover:border-muted'
  return (
    <div className={'flex items-center gap-1 rounded-md border pl-2 pr-1 py-1 text-sm ' + ring}>
      <button type="button" onClick={onSelect} onDoubleClick={onEdit} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {info ? (
          <>
            <TypeBadge type={info.type} lang={lang} small fixed />
            <Hover tip={<MoveTip move={move} lang={lang} />} className="min-w-0 flex-1 truncate font-medium">{label('moves', move, lang)}</Hover>
            {!learnable && <span className="text-[10px] text-accent" title={t.notLearnable}>⚠</span>}
            <span className="text-[11px] tabular-nums text-muted">{info.category === 'Status' ? '·' : info.basePower}{extra?.acc !== null && extra?.acc !== undefined && extra.acc < 100 ? ` · ${extra.acc}%` : ''}</span>
            {pct !== undefined && <span className="w-11 text-right text-[10px] tabular-nums text-emerald-300">{pct}%</span>}
          </>
        ) : (
          <span className="text-muted">+ {t.searchMove}</span>
        )}
      </button>
      {move && (
        <>
          <button type="button" onClick={onEdit} title={t.change} className="rounded px-1 text-xs text-muted hover:bg-surface hover:text-text">✎</button>
          <button type="button" onClick={onClear} title={t.none} className="rounded px-1 text-xs text-muted hover:bg-surface hover:text-text">×</button>
        </>
      )}
    </div>
  )
}

function TargetChips({ value, options, onChange, lang }: { value: PokemonState; options: { value: number | 'ally'; label: string; pos: string }[]; onChange: (tg: number | 'ally' | null) => void; lang: Lang }) {
  const t = dict(lang)
  const move = value.moves[value.activeMove ?? 0]
  const info = move ? moveInfo(move) : undefined
  const spread = info && (info.target === 'allAdjacentFoes' || info.target === 'allAdjacent' || info.target === 'self' || info.target === 'allySide' || info.target === 'all' || info.target === 'foeSide' || info.target === 'allyTeam')
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
      <span className="text-muted">{t.targetLabel} :</span>
      {spread ? (
        <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-muted">{info!.target === 'allAdjacentFoes' || info!.target === 'allAdjacent' ? t.allTargets : t.noTargetNeeded}</span>
      ) : (
        options.map((o) => {
          const on = value.target === o.value || (value.target === null && o === options[0])
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onChange(o.value)}
              className={'rounded border px-1.5 py-0.5 ' + (on ? 'border-accent bg-accent/20 text-text' : 'border-border bg-surface-2 text-muted hover:text-text')}
            >
              {o.pos && <b className="mr-1">{o.pos}</b>}{o.label}
            </button>
          )
        })
      )}
    </div>
  )
}
