import { useEffect, useMemo, useState } from 'react'
import { APP_VERSION, checkForUpdate, isDesktop, type UpdateStatus } from './updater'
import { defaultState, loadState, saveState, type AppState } from './model'
import { dict } from './i18n'
import { computeMove, speedInfo } from './lib/engine'
import { label } from './lib/names'
import PokemonPanel from './components/PokemonPanel'
import FieldPanel from './components/FieldPanel'
import Results from './components/Results'
import SpeedBar from './components/SpeedBar'

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

  const results = useMemo(
    () => state.attacker.moves.map((m) => computeMove(m, state.attacker, state.defender, state.field, state.options)),
    [state.attacker, state.defender, state.field, state.options],
  )
  const speed = useMemo(() => speedInfo(state.attacker, state.defender, state.field), [state.attacker, state.defender, state.field])

  function swap() {
    setState((s) => ({
      ...s,
      attacker: s.defender,
      defender: s.attacker,
      field: { ...s.field, attackerSide: s.field.defenderSide, defenderSide: s.field.attackerSide },
    }))
  }

  function reset() {
    if (confirm(t.resetConfirm)) setState({ ...defaultState(), lang: state.lang })
  }

  const attackerName = label('species', state.attacker.species, state.lang)
  const defenderName = label('species', state.defender.species, state.lang)

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-[1500px] px-4 py-2.5 flex items-center justify-between gap-4">
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

      <main className="flex-1">
        <div className="mx-auto max-w-[1500px] px-4 py-4 flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <PokemonPanel title={t.attacker} role="attacker" value={state.attacker} onChange={(p) => setState((s) => ({ ...s, attacker: p }))} lang={state.lang} />
            <PokemonPanel title={t.defender} role="defender" value={state.defender} onChange={(p) => setState((s) => ({ ...s, defender: p }))} lang={state.lang} />
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <button type="button" onClick={swap} title={t.swapTitle} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm hover:border-accent">
                  ⇄ {t.swap}
                </button>
              </div>
              <SpeedBar info={speed} lang={state.lang} trickRoom={state.field.trickRoom} attackerName={attackerName} defenderName={defenderName} />
              <FieldPanel value={state.field} onChange={(f) => setState((s) => ({ ...s, field: f }))} options={state.options} onOptions={(o) => setState((s) => ({ ...s, options: o }))} lang={state.lang} />
            </div>
          </div>
          <Results results={results} attacker={state.attacker} defender={state.defender} lang={state.lang} />
        </div>
      </main>

      <footer className="border-t border-border text-[11px] text-muted">
        <div className="mx-auto max-w-[1500px] px-4 py-3">{t.footer}</div>
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
