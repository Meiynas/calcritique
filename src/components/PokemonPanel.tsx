// Panneau d'un Pokémon : espèce, nature, SP, objet, talent, Téra, attaques, statut, PV.
import { useMemo } from 'react'
import type { Lang, PokemonState, StatKey, StatusKey } from '../model'
import { STAT_KEYS } from '../model'
import { dict } from '../i18n'
import { label, NAMES } from '../lib/names'
import { EXTRA, SPECIES_KEYS, TYPE_NAMES, finalStats, moveInfo, natureInfo, speciesInfo } from '../lib/engine'
import { SP_MAX_STAT, SP_MAX_TOTAL, spTotal } from '../lib/champions'
import SearchSelect from './SearchSelect'
import TypeBadge from './TypeBadge'

interface Props {
  title: string
  role: 'attacker' | 'defender'
  value: PokemonState
  onChange: (p: PokemonState) => void
  lang: Lang
}

const NATURE_KEYS = Object.keys(NAMES.natures)
const STATUSES: StatusKey[] = ['', 'brn', 'par', 'psn', 'tox', 'slp', 'frz']

export default function PokemonPanel({ title, role, value, onChange, lang }: Props) {
  const t = dict(lang)
  const species = speciesInfo(value.species)
  const stats = useMemo(() => finalStats(value), [value])
  const total = spTotal(value.sp)
  const over = total > SP_MAX_TOTAL
  const nature = natureInfo(value.nature)
  const abilities = EXTRA.species[value.species]?.abilities ?? []

  function set<K extends keyof PokemonState>(key: K, v: PokemonState[K]) {
    onChange({ ...value, [key]: v })
  }
  function setSp(stat: StatKey, v: number) {
    const n = Math.max(0, Math.min(SP_MAX_STAT, Math.round(Number.isFinite(v) ? v : 0)))
    onChange({ ...value, sp: { ...value.sp, [stat]: n } })
  }
  function setBoost(stat: StatKey, v: number) {
    onChange({ ...value, boosts: { ...value.boosts, [stat]: v } })
  }
  function setMove(i: number, m: string) {
    const moves = [...value.moves]
    moves[i] = m
    onChange({ ...value, moves })
  }
  function changeSpecies(key: string) {
    const abl = EXTRA.species[key]?.abilities ?? []
    onChange({ ...value, species: key, ability: abl.includes(value.ability) ? value.ability : (abl[0] ?? '') })
  }

  const accent = role === 'attacker' ? 'text-accent' : 'text-sky-400'

  return (
    <section className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className={'text-sm font-semibold uppercase tracking-wide ' + accent}>{title}</h2>
        {species && (
          <div className="flex gap-1">
            {species.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} />)}
            {value.teraType && <span className="text-xs text-muted self-center">→</span>}
            {value.teraType && <TypeBadge type={value.teraType} lang={lang} tera />}
          </div>
        )}
      </div>

      <SearchSelect kind="species" value={value.species} onChange={changeSpecies} lang={lang} placeholder={t.searchPokemon} keys={SPECIES_KEYS} />

      <div className="grid grid-cols-2 gap-2">
        <Field label={t.nature}>
          <select className="input" value={value.nature} onChange={(e) => set('nature', e.target.value)}>
            {NATURE_KEYS.map((n) => {
              const info = natureInfo(n)
              const eff = info?.plus && info.plus !== info.minus ? ` (+${t.statNames[info.plus as StatKey]} −${t.statNames[info.minus as StatKey]})` : ''
              return <option key={n} value={n}>{label('natures', n, lang)}{eff}</option>
            })}
          </select>
        </Field>
        <Field label={t.tera}>
          <select className="input" value={value.teraType} onChange={(e) => set('teraType', e.target.value)}>
            <option value="">{t.teraOff}</option>
            {TYPE_NAMES.map((ty) => <option key={ty} value={ty}>{label('types', ty, lang)}</option>)}
          </select>
        </Field>
        <Field label={t.item}>
          <SearchSelect kind="items" value={value.item} onChange={(v) => set('item', v)} lang={lang} placeholder={t.searchItem} allowEmpty emptyLabel={t.none} />
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
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase text-muted">
            <tr><th className="text-left font-medium"> </th><th className="font-medium">Base</th><th className="font-medium">{t.sp}</th><th className="font-medium">=</th><th className="font-medium">{t.boost}</th></tr>
          </thead>
          <tbody>
            {STAT_KEYS.map((k) => {
              const plus = nature?.plus === k && nature.plus !== nature.minus
              const minus = nature?.minus === k && nature.plus !== nature.minus
              return (
                <tr key={k} className="border-t border-border/60">
                  <td className={'py-1 font-medium ' + (plus ? 'text-emerald-400' : minus ? 'text-accent' : '')}>
                    {t.statNames[k]}{plus ? ' +' : minus ? ' −' : ''}
                  </td>
                  <td className="text-center text-muted">{species?.baseStats[k]}</td>
                  <td className="text-center">
                    <input
                      type="number" min={0} max={SP_MAX_STAT} value={value.sp[k]}
                      onChange={(e) => setSp(k, e.target.valueAsNumber)}
                      className="w-14 rounded border border-border bg-surface-2 px-1 py-0.5 text-center focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="text-center font-semibold tabular-nums">{stats[k]}</td>
                  <td className="text-center">
                    {k !== 'hp' && (
                      <select className="rounded border border-border bg-surface-2 px-1 py-0.5" value={value.boosts[k]} onChange={(e) => setBoost(k, Number(e.target.value))}>
                        {[6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6].map((b) => <option key={b} value={b}>{b > 0 ? '+' + b : b}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Attaques */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t.moves}</span>
        <div className="mt-1 grid grid-cols-1 gap-1.5">
          {value.moves.map((m, i) => (
            <SearchSelect key={i} kind="moves" value={m} onChange={(v) => setMove(i, v)} lang={lang} placeholder={t.searchMove} allowEmpty emptyLabel={t.none} renderExtra={(e) => <MoveExtra move={e.key} lang={lang} />} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t.status}>
          <select className="input" value={value.status} onChange={(e) => set('status', e.target.value as StatusKey)}>
            {STATUSES.map((s) => <option key={s} value={s}>{t.statusNames[s]}</option>)}
          </select>
        </Field>
        <Field label={`${t.hp} (${Math.round((stats.hp * value.curHPPercent) / 100)} / ${stats.hp})`}>
          <div className="flex items-center gap-2">
            <input type="range" min={1} max={100} value={value.curHPPercent} onChange={(e) => set('curHPPercent', Number(e.target.value))} className="flex-1 accent-accent" />
            <input type="number" min={1} max={100} value={value.curHPPercent} onChange={(e) => set('curHPPercent', Math.max(1, Math.min(100, e.target.valueAsNumber || 100)))} className="w-16 rounded border border-border bg-surface-2 px-1 py-0.5 text-center" />
            <span className="text-xs text-muted">%</span>
          </div>
        </Field>
      </div>
    </section>
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

function MoveExtra({ move, lang }: { move: string; lang: Lang }) {
  const info = EXTRA.moves[move]
  const m = moveInfo(move)
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
      {m && <TypeBadge type={m.type} lang={lang} small />}
      {m && m.basePower > 0 && <span>{m.basePower}</span>}
      {info && info.acc !== null && info.acc < 100 && <span>{info.acc}%</span>}
    </span>
  )
}
