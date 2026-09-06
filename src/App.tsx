import { useEffect, useMemo, useState } from 'react'
import { APP_VERSION, checkForUpdate, isDesktop, type UpdateStatus } from './updater'
import { activeCount, defaultState, loadState, otherSide, putActive, saveState, type AppState, type BattleMode, type SideKey } from './model'
import { dict } from './i18n'
import { computeMove } from './lib/engine'
import { mostPlayedSet } from './lib/usage'
import { simulateTurn } from './lib/turn'
import { label } from './lib/names'
import TeamColumn from './components/TeamColumn'
import FieldPanel from './components/FieldPanel'
import Results from './components/Results'
import TurnPanel from './components/TurnPanel'
import FxLayer from './components/FxLayer'

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState(mostPlayedSet))
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'idle' })
  const t = dict(state.lang)

  useEffect(() => {
    if (!isDesktop()) return
    checkForUpdate(setUpdate)
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    document.documentElement.lang = state.lang
  }, [state.lang])

  const turn = useMemo(() => simulateTurn(state), [state])

  // Détail par attaque : chaque Pokémon en jeu contre chacune de ses cibles (PV réels)
  const details = useMemo(
    () =>
      turn.order.flatMap((a) =>
        a.targets.map((tg) => {
          const defender = state.teams[tg.side][tg.index]
          return { actor: a.actor, target: tg, attacker: a.pokemon, defender, result: computeMove(a.move, a.pokemon, defender, state.field, state.options, a.actor.side) }
        }),
      ),
    [turn, state],
  )

  function setMode(mode: BattleMode) {
    setState((s) => {
      const n = activeCount(mode)
      return { ...s, mode, active: { left: s.active.left.slice(-n), right: s.active.right.slice(-n) } }
    })
  }

  function reset() {
    if (confirm(t.resetConfirm)) setState({ ...defaultState(mostPlayedSet), lang: state.lang })
  }

  const column = (side: SideKey) => {
    const foe = otherSide(side)
    const foeActives = state.active[foe].filter((i) => state.teams[foe][i]?.species)
    const allyActives = state.active[side].filter((i) => state.teams[side][i]?.species)
    return (
      <TeamColumn
        side={side}
        team={state.teams[side]}
        selected={state.selected[side]}
        active={state.active[side]}
        maxActive={activeCount(state.mode)}
        onSelect={(i) =>
          setState((s) => ({
            ...s,
            selected: { ...s.selected, [side]: i },
            active: { ...s.active, [side]: s.teams[side][i]?.species ? putActive(s.active[side], i, activeCount(s.mode)) : s.active[side] },
          }))
        }
        onChangeTeam={(team) => setState((s) => ({ ...s, teams: { ...s.teams, [side]: team } }))}
        sideState={state.field[side]}
        onChangeSide={(ss) => setState((s) => ({ ...s, field: { ...s.field, [side]: ss } }))}
        field={state.field}
        lang={state.lang}
        targetOptions={
          state.mode === '2v2'
            ? [
                ...foeActives.map((i) => ({ value: i as number | 'ally', label: label('species', state.teams[foe][i].species, state.lang) })),
                ...(allyActives.length > 1 ? [{ value: 'ally' as const, label: t.targetAlly }] : []),
              ]
            : undefined
        }
      />
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <FxLayer field={state.field} />

      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-[1800px] px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
            <h1 className="text-lg font-bold tracking-tight">Calcritique</h1>
            <span className="hidden sm:inline text-xs text-muted">{t.appTagline}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <UpdateBadge status={update} lang={state.lang} />
            <button type="button" onClick={reset} className="rounded border border-border px-2 py-1 hover:text-text">{t.reset}</button>
            <div className="flex overflow-hidden rounded border border-border">
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, lang: l }))}
                  className={'px-2 py-1 font-semibold uppercase ' + (state.lang === l ? 'bg-accent text-white' : 'hover:text-text')}
                >
                  {l}
                </button>
              ))}
            </div>
            <span>v{APP_VERSION}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <div className="mx-auto max-w-[1800px] px-3 py-3 grid gap-3 lg:grid-cols-[minmax(340px,1fr)_minmax(420px,1.4fr)_minmax(340px,1fr)]">
          {column('left')}

          {/* Colonne centrale : format, déroulé du tour, détail par attaque, conditions globales */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm" title={t.modeTitle}>
              <span className="text-xs text-muted">{t.modeTitle}</span>
              <div className="flex overflow-hidden rounded border border-border">
                {(['1v1', '2v2'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={'px-3 py-1 font-semibold ' + (state.mode === m ? 'bg-accent text-white' : 'text-muted hover:text-text')}
                  >
                    {m === '1v1' ? t.mode1v1 : t.mode2v2}
                  </button>
                ))}
              </div>
            </div>

            <TurnPanel state={state} turn={turn} lang={state.lang} />

            {details.filter((d) => d.result && d.result.category !== 'Status').length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">{t.detailsTitle}</h2>
                {details.map((d) =>
                  d.result && d.result.category !== 'Status' ? (
                    <div key={`${d.actor.side}:${d.actor.index}>${d.target.side}:${d.target.index}`}>
                      <div className="px-1 pb-1 text-xs text-muted">
                        <span className={d.actor.side === 'left' ? 'text-accent' : 'text-sky-400'}>{label('species', d.attacker.species, state.lang)}</span> {t.vs}{' '}
                        <span className={d.target.side === 'left' ? 'text-accent' : 'text-sky-400'}>{label('species', d.defender.species, state.lang)}</span>
                      </div>
                      <Results results={[d.result]} attacker={d.attacker} defender={d.defender} lang={state.lang} activeMove={0} compact />
                    </div>
                  ) : null,
                )}
              </section>
            )}

            <FieldPanel value={state.field} onChange={(f) => setState((s) => ({ ...s, field: f }))} options={state.options} onOptions={(o) => setState((s) => ({ ...s, options: o }))} lang={state.lang} />
          </div>

          {column('right')}
        </div>
      </main>

      <footer className="border-t border-border text-[11px] text-muted relative z-10">
        <div className="mx-auto max-w-[1800px] px-4 py-3">{t.footer}</div>
      </footer>
    </div>
  )
}

function UpdateBadge({ status, lang }: { status: UpdateStatus; lang: 'fr' | 'en' }) {
  const t = dict(lang)
  if (!isDesktop()) return null
  switch (status.state) {
    case 'idle':
    case 'checking':
      return <span>{t.updateChecking}</span>
    case 'none':
      return <span className="text-emerald-400">{t.updateNone}</span>
    case 'available':
      return <span className="text-amber-300">{t.updateAvailable(status.version)}</span>
    case 'installing':
      return <span className="text-amber-300">{t.updateInstalling}</span>
    case 'error':
      return <span className="text-accent" title={status.message}>{t.updateError}</span>
  }
}
