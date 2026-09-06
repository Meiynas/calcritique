import { useEffect, useMemo, useState } from 'react'
import { APP_VERSION, checkForUpdate, isDesktop, type UpdateStatus } from './updater'
import { activePair, defaultState, loadState, otherSide, saveState, type AppState, type SideKey } from './model'
import { dict } from './i18n'
import { computeMove, speedInfo } from './lib/engine'
import { label } from './lib/names'
import TeamColumn from './components/TeamColumn'
import FieldPanel from './components/FieldPanel'
import Results from './components/Results'
import SpeedBar from './components/SpeedBar'
import FxLayer from './components/FxLayer'

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
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

  const { attacker, defender } = activePair(state)
  const results = useMemo(
    () => attacker.moves.map((m) => computeMove(m, attacker, defender, state.field, state.options, state.attackerSide)),
    [attacker, defender, state.field, state.options, state.attackerSide],
  )
  const speed = useMemo(() => speedInfo(attacker, defender, state.field, state.attackerSide), [attacker, defender, state.field, state.attackerSide])

  function swapDirection() {
    setState((s) => ({ ...s, attackerSide: otherSide(s.attackerSide) }))
  }

  function reset() {
    if (confirm(t.resetConfirm)) setState({ ...defaultState(), lang: state.lang })
  }

  const attackerName = label('species', attacker.species, state.lang)
  const defenderName = label('species', defender.species, state.lang)

  const column = (side: SideKey) => (
    <TeamColumn
      side={side}
      team={state.teams[side]}
      selected={state.selected[side]}
      onSelect={(i) => setState((s) => ({ ...s, selected: { ...s.selected, [side]: i } }))}
      onChangeTeam={(team) => setState((s) => ({ ...s, teams: { ...s.teams, [side]: team } }))}
      sideState={state.field[side]}
      onChangeSide={(ss) => setState((s) => ({ ...s, field: { ...s.field, [side]: ss } }))}
      isAttacker={state.attackerSide === side}
      lang={state.lang}
    />
  )

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

          {/* Colonne centrale : sens de l'attaque, vitesse, résultats, conditions globales */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={swapDirection}
              title={t.attackDirection}
              className="flex items-center justify-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
            >
              <span className={state.attackerSide === 'left' ? 'font-semibold text-accent' : 'text-muted'}>{t.team1}</span>
              <span className="text-lg">{state.attackerSide === 'left' ? '⟶' : '⟵'}</span>
              <span className={state.attackerSide === 'right' ? 'font-semibold text-accent' : 'text-muted'}>{t.team2}</span>
              <span className="ml-2 text-xs text-muted">({state.attackerSide === 'left' ? t.attacksLeftToRight : t.attacksRightToLeft})</span>
            </button>

            {speed ? (
              <SpeedBar info={speed} lang={state.lang} trickRoom={state.field.trickRoom} attackerName={attackerName} defenderName={defenderName} />
            ) : (
              <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">{t.noPair}</div>
            )}

            <Results results={results} attacker={attacker} defender={defender} lang={state.lang} />

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
