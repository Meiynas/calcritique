// Colonne d'une équipe : pièges au-dessus, effets du côté (murs, Vent Arrière...),
// 6 emplacements de Pokémon, et l'éditeur du Pokémon sélectionné.
import { useState } from 'react'
import type { Lang, PokemonState, SideKey, SideState } from '../model'
import { emptyPokemon } from '../model'
import { mostPlayedSet } from '../lib/usage'
import { finalStats } from '../lib/engine'
import { switchIn } from '../lib/switch'
import type { FieldState } from '../model'
import PokemonPicker from './PokemonPicker'
import { dict } from '../i18n'
import { label } from '../lib/names'
import { speciesInfo } from '../lib/engine'
import PokemonPanel, { MovesOnlyPanel } from './PokemonPanel'
import TypeBadge from './TypeBadge'
import { Toggle } from './FieldPanel'

interface Props {
  side: SideKey
  team: PokemonState[]
  selected: number
  active: number[]
  maxActive: number
  onSelect: (i: number) => void
  onSetActive: (pos: number, i: number) => void
  onChangeTeam: (team: PokemonState[]) => void
  sideState: SideState
  onChangeSide: (s: SideState) => void
  field: FieldState
  lang: Lang
  targetOptions?: { value: number | 'ally'; label: string; pos: string }[]
}

export default function TeamColumn({ side, team, selected, active, maxActive, onSelect, onSetActive, onChangeTeam, sideState, onChangeSide, field, lang, targetOptions }: Props) {
  const t = dict(lang)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [toast, setToast] = useState<{ slot: number; lines: string[] } | null>(null)
  const [view, setView] = useState<'stats' | 'moves'>('stats')
  const movesView = maxActive === 2 && view === 'moves'
  function doSwitch(i: number) {
    const r = switchIn(team[i], sideState, field)
    const next = [...team]
    next[i] = r.pokemon
    onChangeTeam(next)
    if (r.side !== sideState) onChangeSide(r.side)
    const notes = t.switchNotes as Record<string, string | ((n: number) => string)>
    const lines = r.notes.map((n) => { const v = notes[n.key.replace('switch.', '')]; return typeof v === 'function' ? v(n.value ?? 0) : v })
    setToast({ slot: i, lines: lines.length ? lines : [t.switchNotes.nothing] })
    window.setTimeout(() => setToast((cur) => (cur && cur.slot === i ? null : cur)), 4000)
  }
  const setSide = <K extends keyof SideState>(k: K, v: SideState[K]) => onChangeSide({ ...sideState, [k]: v })
  const setMon = (i: number, p: PokemonState) => {
    const next = [...team]
    next[i] = p
    onChangeTeam(next)
  }
  const wallClass = ['side-fx', sideState.reflect && 'side-reflect', sideState.lightScreen && 'side-lightscreen', sideState.auroraVeil && 'side-auroraveil', sideState.helpingHand && 'side-helpinghand', sideState.friendGuard && 'side-friendguard'].filter(Boolean).join(' ')

  return (
    <div className={'flex flex-col gap-3 rounded-2xl p-2 transition-shadow ' + wallClass}>
      {/* Pièges sur ce côté */}
      <HazardStrip value={sideState} onChange={onChangeSide} lang={lang} />

      {/* Bandeau "sur le terrain" : positions A / B */}
      <div className={'grid gap-1.5 px-1 ' + (maxActive === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {Array.from({ length: maxActive }, (_, pos) => {
          const idx = active[pos]
          const mon = idx !== undefined ? team[idx] : undefined
          const filled = !!mon?.species
          return (
            <div key={pos} className={'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ' + (filled ? (side === 'left' ? 'border-accent/60 bg-accent/10' : 'border-sky-400/60 bg-sky-400/10') : 'border-dashed border-border text-muted')}>
              <span className={'rounded px-1 text-[10px] font-bold text-white ' + (side === 'left' ? 'bg-accent' : 'bg-sky-500')}>{maxActive === 2 ? (pos === 0 ? 'A' : 'B') : '●'}</span>
              {filled ? (
                <button type="button" onClick={() => onSelect(idx)} className="min-w-0 flex-1 truncate text-left font-semibold hover:underline">{label('species', mon!.species, lang)}</button>
              ) : (
                <span className="flex-1 truncate">{t.emptyField}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Effets du côté */}
      <div className="flex flex-wrap gap-1.5 px-1">
        <Toggle on={sideState.reflect} onClick={() => setSide('reflect', !sideState.reflect)} icon="🛡️" label={t.reflect} color="rose" />
        <Toggle on={sideState.lightScreen} onClick={() => setSide('lightScreen', !sideState.lightScreen)} icon="✨" label={t.lightScreen} color="amber" />
        <Toggle on={sideState.auroraVeil} onClick={() => setSide('auroraVeil', !sideState.auroraVeil)} icon="🌈" label={t.auroraVeil} color="cyan" />
        <Toggle on={sideState.tailwind} onClick={() => setSide('tailwind', !sideState.tailwind)} icon="💨" label={t.tailwind} color="cyan" />
        <Toggle on={sideState.helpingHand} onClick={() => setSide('helpingHand', !sideState.helpingHand)} icon="🤝" label={t.helpingHand} color="emerald" />
        <Toggle on={sideState.friendGuard} onClick={() => setSide('friendGuard', !sideState.friendGuard)} icon="🫂" label={t.friendGuard} color="emerald" />
      </div>

      {/* Les 6 emplacements */}
      <div className="grid grid-cols-2 gap-1.5">
        {team.map((p, i) => (
          <MonCard
            key={i}
            mon={p}
            active={i === selected}
            onField={active.includes(i)}
            fieldPos={active.indexOf(i)}
            maxActive={maxActive}
            onSetActive={(pos) => onSetActive(pos, i)}
            onClick={() => onSelect(i)}
            onDoubleClick={() => { onSelect(i); setPickSlot(i) }}
            onHP={(pct) => setMon(i, { ...p, curHPPercent: pct })}
            onSwitch={() => doSwitch(i)}
            toast={toast?.slot === i ? toast.lines : null}
            lang={lang}
            side={side}
          />
        ))}
      </div>

      {/* En 2v2 : bascule entre la fiche complète et les attaques des Pokémon A et B */}
      {maxActive === 2 && (
        <div className="flex gap-1 px-1">
          {(['stats', 'moves'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={'flex-1 rounded-md border px-2 py-1 text-xs font-semibold ' + (view === v ? 'border-accent bg-accent/20 text-text' : 'border-border bg-surface-2 text-muted hover:text-text')}
            >
              {v === 'stats' ? t.viewStats : t.viewMoves}
            </button>
          ))}
        </div>
      )}

      {movesView ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((pos) => {
            const idx = active[pos]
            const mon = idx !== undefined ? team[idx] : undefined
            return (
              <MovesOnlyPanel
                key={pos}
                pos={pos === 0 ? 'A' : 'B'}
                value={mon ?? emptyPokemon()}
                onChange={(p) => { if (idx !== undefined) setMon(idx, p) }}
                targetOptions={targetOptions}
                role={side === 'left' ? 'attacker' : 'defender'}
                lang={lang}
              />
            )
          })}
        </div>
      ) : (
        <PokemonPanel
          title={`${side === 'left' ? t.team1 : t.team2} · ${t.slot} ${selected + 1}`}
          role={side === 'left' ? 'attacker' : 'defender'}
          value={team[selected]}
          targetOptions={targetOptions}
          onChange={(p) => setMon(selected, p)}
          onClear={() => setMon(selected, emptyPokemon())}
          teamSpecies={team.map((p) => p.species)}
          lang={lang}
        />
      )}
      {pickSlot !== null && (
        <PokemonPicker
          team={team.map((p) => p.species)}
          lang={lang}
          onPick={(sp) => { setMon(pickSlot, { ...mostPlayedSet(sp), activeMove: 0 }); setPickSlot(null) }}
          onClose={() => setPickSlot(null)}
        />
      )}
    </div>
  )
}

function MonCard({ mon, active, onField, fieldPos, maxActive, onSetActive, onClick, onDoubleClick, onHP, onSwitch, toast, lang, side }: {
  mon: PokemonState; active: boolean; onField: boolean; fieldPos: number; maxActive: number; onSetActive: (pos: number) => void; onClick: () => void; onDoubleClick: () => void; onHP: (pct: number) => void; onSwitch: () => void; toast: string[] | null; lang: Lang; side: SideKey
}) {
  const t = dict(lang)
  const [editing, setEditing] = useState<null | 'hp' | 'pct'>(null)
  const [draft, setDraft] = useState('')
  const sp = speciesInfo(mon.species)
  const activeRing = side === 'left' ? 'border-accent ring-1 ring-accent/60 ' : 'border-sky-400 ring-1 ring-sky-400/60 '
  const ring = (active ? activeRing : 'border-border hover:border-muted ') + (onField ? 'bg-surface' : 'bg-surface/50 opacity-75')
  if (!mon.species || !sp) {
    return (
      <button type="button" onClick={onClick} onDoubleClick={onDoubleClick} className={'rounded-lg border border-dashed bg-surface/60 px-2 py-2 text-left text-xs text-muted ' + ring}>
        + {t.emptySlot}
      </button>
    )
  }
  const maxHP = finalStats(mon).hp
  const cur = Math.round((maxHP * mon.curHPPercent) / 100)
  const hpColor = mon.curHPPercent > 50 ? 'bg-emerald-400' : mon.curHPPercent > 20 ? 'bg-amber-400' : 'bg-accent'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      title={t.dblClickHint}
      className={'cursor-pointer rounded-lg border px-2 py-1.5 text-left ' + ring}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1">
          <span className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            {Array.from({ length: maxActive }, (_, pos) => {
              const here = onField && fieldPos === pos
              const on = side === 'left' ? 'bg-accent text-white border-accent' : 'bg-sky-500 text-white border-sky-500'
              return (
                <button
                  key={pos}
                  type="button"
                  title={t.putOnField + (maxActive === 2 ? ` (${pos === 0 ? 'A' : 'B'})` : '')}
                  onClick={() => onSetActive(pos)}
                  className={'rounded border px-1 text-[9px] font-bold uppercase ' + (here ? on : 'border-border bg-surface-2 text-muted hover:text-text')}
                >
                  {maxActive === 2 ? (pos === 0 ? 'A' : 'B') : '●'}
                </button>
              )
            })}
          </span>
          <span className="truncate text-sm font-semibold">{label('species', mon.species, lang)}</span>
        </span>
        <span className="flex items-center gap-0.5">
          {sp.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} small />)}
          <button
            type="button"
            title={t.switchInTitle}
            onClick={(e) => { e.stopPropagation(); onSwitch() }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="ml-1 rounded border border-border bg-surface-2 px-1.5 text-[11px] text-muted hover:border-accent hover:text-text"
          >
            ⇄
          </button>
        </span>
      </div>
      <div className="truncate text-[11px] text-muted">
        {mon.item ? label('items', mon.item, lang) : t.none}{mon.teraType ? ` · Tera ${label('types', mon.teraType, lang)}` : ''}
      </div>
      <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className={'absolute inset-y-0 left-0 rounded-full ' + hpColor} style={{ width: `${mon.curHPPercent}%` }} />
          <input
            type="range" min={1} max={100} value={mon.curHPPercent}
            onChange={(e) => onHP(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            title={t.hp}
          />
        </div>
        {editing ? (
          <input
            autoFocus
            type="number"
            min={1}
            max={editing === 'hp' ? maxHP : 100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(null)
            }}
            onBlur={commit}
            className="w-16 rounded border border-accent bg-surface-2 px-1 text-right text-[11px] tabular-nums text-text"
          />
        ) : (
          <span className="w-20 text-right text-[10px] tabular-nums text-muted">
            <button type="button" className="hover:text-text hover:underline" title={t.hp} onClick={() => { setDraft(String(cur)); setEditing('hp') }}>{cur}/{maxHP}</button>{' '}
            <button type="button" className="text-white/70 hover:text-text hover:underline" title="%" onClick={() => { setDraft(String(mon.curHPPercent)); setEditing('pct') }}>{mon.curHPPercent}%</button>
          </span>
        )}
      </div>
      {toast && (
        <div className="mt-1 rounded bg-surface-2 px-1.5 py-1 text-[10px] leading-tight text-emerald-200">
          {toast.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )

  function commit() {
    const n = Number(draft)
    if (Number.isFinite(n) && editing) {
      const pct = editing === 'hp' ? Math.round((n / maxHP) * 100) : n
      onHP(Math.max(1, Math.min(100, Math.round(pct))))
    }
    setEditing(null)
  }
}

function HazardStrip({ value, onChange, lang }: { value: SideState; onChange: (s: SideState) => void; lang: Lang }) {
  const t = dict(lang)
  const set = <K extends keyof SideState>(k: K, v: SideState[K]) => onChange({ ...value, [k]: v })
  const any = value.stealthRock || value.spikes > 0 || value.toxicSpikes > 0 || value.stickyWeb
  return (
    <div className={'flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-xs ' + (any ? 'border-stone-400/60 bg-stone-500/15' : 'border-border bg-surface/60')}>
      <span className="text-[10px] uppercase tracking-wide text-muted">{t.hazards}</span>
      <div className="flex gap-1">
        <HazardButton on={value.stealthRock} onClick={() => set('stealthRock', !value.stealthRock)} title={t.stealthRock}>🪨</HazardButton>
        <HazardButton on={value.spikes > 0} onClick={() => set('spikes', (value.spikes + 1) % 4)} title={t.spikes}>
          📌<Count n={value.spikes} max={3} />
        </HazardButton>
        <HazardButton on={value.toxicSpikes > 0} onClick={() => set('toxicSpikes', (value.toxicSpikes + 1) % 3)} title={t.toxicSpikes}>
          ☠️<Count n={value.toxicSpikes} max={2} />
        </HazardButton>
        <HazardButton on={value.stickyWeb} onClick={() => set('stickyWeb', !value.stickyWeb)} title={t.stickyWeb}>🕸️</HazardButton>
      </div>
    </div>
  )
}

function HazardButton({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={'flex items-center gap-0.5 rounded border px-1.5 py-0.5 transition ' + (on ? 'border-stone-300 bg-stone-500/40 text-white' : 'border-border bg-surface-2 opacity-50 grayscale hover:opacity-90')}
    >
      {children}
    </button>
  )
}

function Count({ n, max }: { n: number; max: number }) {
  return (
    <span className="ml-0.5 flex gap-px">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={'inline-block h-1.5 w-1.5 rounded-full ' + (i < n ? 'bg-white' : 'bg-white/25')} />
      ))}
    </span>
  )
}
