import { useEffect, useMemo, useState } from 'react'
import { APP_VERSION, checkForUpdate, isDesktop, type UpdateStatus } from './updater'
import { activeCount, defaultState, loadState, otherSide, saveState, setActiveSlot, type AppState, type BattleMode, type PokemonState, type SideKey } from './model'
import { dict } from './i18n'
import { computeMove } from './lib/engine'
import { mostPlayedSet } from './lib/usage'
import { simulateTurn } from './lib/turn'
import { switchIn } from './lib/switch'
import { cleanSet, loadLibrary, newId, saveLibrary, type Library } from './lib/library'
import LibraryModal from './components/LibraryModal'
import SpeedTiersModal from './components/SpeedTiersModal'
import TypeChartModal from './components/TypeChartModal'
import MatrixModal from './components/MatrixModal'
import { flinchChance, cantActChance } from './lib/status'
import { label } from './lib/names'
import TeamColumn from './components/TeamColumn'
import { FieldStrip } from './components/FieldPanel'
import Results from './components/Results'
import TurnPanel from './components/TurnPanel'
import FxLayer from './components/FxLayer'

type Theme = 'dark' | 'light' | 'pastel'
const THEME_KEY = 'calcritique.theme'
const THEME_ICON: Record<Theme, string> = { dark: '☾', light: '☀', pastel: '🌸' }

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

  // Bibliothèque de sets et d'équipes (stockage local + export / import)
  const [library, setLibrary] = useState<Library>(() => loadLibrary())
  const [showLibrary, setShowLibrary] = useState<'sets' | 'teams' | null>(null)
  const saveTeam = (side: SideKey) => {
    const team = state.teams[side].map(cleanSet)
    if (!team.some((p) => p.species)) return
    const name = `${side === 'left' ? t.team1 : t.team2} · ${new Date().toLocaleString()}`
    updateLibrary({ ...library, teams: [{ id: newId(), name, team, createdAt: Date.now() }, ...library.teams] })
    setShowLibrary('teams')
  }
  const [showSpeed, setShowSpeed] = useState<SideKey | null>(null)
  const [showTypes, setShowTypes] = useState(false)
  const [showMatrix, setShowMatrix] = useState(false)
  // Thème : sombre (défaut), clair, pastel. Mémorisé dans le navigateur / l'application.
  const [theme, setTheme] = useState<Theme>(() => { try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'pastel' ? v : 'dark' } catch { return 'dark' } })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* stockage indisponible */ }
  }, [theme])
  const updateLibrary = (lib: Library) => { setLibrary(lib); saveLibrary(lib) }
  const saveSet = (p: PokemonState, name: string) => updateLibrary({ ...library, sets: [{ id: newId(), name, pokemon: cleanSet(p), createdAt: Date.now() }, ...library.sets] })

  // Détail par attaque : chaque Pokémon en jeu contre chacune de ses cibles (PV réels)
  const details = useMemo(
    () =>
      turn.order.flatMap((a) => {
        // Chance d'être apeuré avant d'agir : attaques adverses jouées avant (scénario moyen) qui visent ce Pokémon
        const avg = turn.scenarios.average.actions
        const myPos = avg.find((x) => x.action.actor.side === a.actor.side && x.action.actor.index === a.actor.index)?.position ?? 0
        let notFlinched = 1
        for (const x of avg) {
          const b = x.action
          if (b.actor.side === a.actor.side || b.isStatus || b.switchIn || x.position >= myPos) continue
          if (!b.targets.some((tg) => tg.side === a.actor.side && tg.index === a.actor.index)) continue
          let fc = flinchChance(b.move, b.pokemon, a.pokemon)
          if (b.move === 'Upper Hand' && a.priority <= 0) fc = 0
          if (fc <= 0) continue
          const r = computeMove(b.move, b.pokemon, a.pokemon, state.field, state.options, b.actor.side, { gameType: state.mode === '1v1' ? 'Singles' : 'Doubles', targetCount: b.targets.length })
          const acc = r && r.accuracy.base !== null ? r.accuracy.effective / 100 : 1
          const act = 1 - cantActChance(b.pokemon, b.move).chance
          notFlinched *= 1 - act * acc * fc
        }
        const preFlinch = 1 - notFlinched
        const actChance = (1 - preFlinch) * (1 - cantActChance(a.pokemon, a.move).chance)
        return a.targets.map((tg) => {
          const defender = state.teams[tg.side][tg.index]
          return { actor: a.actor, target: tg, attacker: a.pokemon, defender, preFlinch, targetCount: a.targets.length, result: computeMove(a.move, a.pokemon, defender, state.field, state.options, a.actor.side, { gameType: state.mode === '1v1' ? 'Singles' : 'Doubles', targetCount: a.targets.length, actChance }) }
        })
      }),
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
        onSelect={(i) => setState((s) => ({ ...s, selected: { ...s.selected, [side]: i } }))}
        onSaveSet={saveSet}
        savedSets={library.sets}
        onSpeedTiers={() => setShowSpeed(side)}
        onSaveTeam={() => saveTeam(side)}
        onOpenTeams={() => setShowLibrary('teams')}
        foeTeam={state.teams[foe]}
        onChangeFoeTeam={(team) => setState((s) => ({ ...s, teams: { ...s.teams, [foe]: team } }))}
        onSetActive={(pos, i) =>
          setState((s) => {
            const active = setActiveSlot(s.active[side], pos, i, activeCount(s.mode))
            let teams = s.teams
            let field = s.field
            // Mode pièges : le Pokémon qui entre en A / B subit les pièges d'entrée de son côté
            if (s.hazardMode && !s.active[side].includes(i) && s.teams[side][i]?.species) {
              const r = switchIn(s.teams[side][i], s.field[side], s.field)
              const team = [...s.teams[side]]
              team[i] = r.pokemon
              teams = { ...s.teams, [side]: team }
              field = { ...s.field, [side]: r.side }
            }
            return { ...s, teams, field, selected: { ...s.selected, [side]: i }, active: { ...s.active, [side]: active } }
          })
        }
        onChangeTeam={(team) => setState((s) => ({ ...s, teams: { ...s.teams, [side]: team } }))}
        sideState={state.field[side]}
        onChangeSide={(ss) => setState((s) => ({ ...s, field: { ...s.field, [side]: ss } }))}
        field={state.field}
        lang={state.lang}
        targetOptions={
          state.mode === '2v2'
            ? [
                ...foeActives.map((i, pos) => ({ value: i as number | 'ally', label: label('species', state.teams[foe][i].species, state.lang), pos: pos === 0 ? 'A' : 'B' })),
                ...(allyActives.length > 1 ? [{ value: 'ally' as const, label: t.targetAlly, pos: '' }] : []),
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
            <button type="button" onClick={() => setShowMatrix(true)} className="rounded border border-border px-2 py-1 hover:text-text">⊞ {t.matrixShort}</button>
            <button type="button" onClick={() => setShowTypes(true)} className="rounded border border-border px-2 py-1 hover:text-text">🧬 {t.typeChart}</button>
            <button type="button" onClick={() => setShowSpeed('left')} className="rounded border border-border px-2 py-1 hover:text-text">⚡ {t.speedTiers}</button>
            <button type="button" onClick={() => setShowLibrary('sets')} className="rounded border border-border px-2 py-1 hover:text-text">📚 {t.library}</button>
            <button type="button" onClick={reset} className="rounded border border-border px-2 py-1 hover:text-text">{t.reset}</button>
            <div className="flex overflow-hidden rounded border border-border" title={t.themeTitle}>
              {(['dark', 'light', 'pastel'] as const).map((th) => (
                <button key={th} type="button" onClick={() => setTheme(th)} aria-label={t.themeNames[th]} title={t.themeNames[th]} className={'px-2 py-1 ' + (theme === th ? 'bg-accent text-white' : 'hover:text-text')}>{THEME_ICON[th]}</button>
              ))}
            </div>
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
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-center gap-2" title={t.modeTitle}>
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
                <label className="ml-2 flex items-center gap-1 text-xs text-muted" title={t.hazardModeHint}>
                  <input type="checkbox" checked={state.hazardMode} onChange={(e) => setState((s) => ({ ...s, hazardMode: e.target.checked }))} />
                  {t.hazardMode}
                </label>
              </div>
              <FieldStrip value={state.field} onChange={(f) => setState((s) => ({ ...s, field: f }))} options={state.options} onOptions={(o) => setState((s) => ({ ...s, options: o }))} lang={state.lang} />
            </div>

            <TurnPanel state={state} turn={turn} lang={state.lang} />

            {details.filter((d) => d.result && d.result.category !== 'Status').length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">{t.detailsTitle}</h2>
                <p className="px-1 -mt-2 text-[11px] text-muted">{t.koExplain}</p>
                {details.map((d) =>
                  d.result && d.result.category !== 'Status' ? (
                    <div key={`${d.actor.side}:${d.actor.index}>${d.target.side}:${d.target.index}`}>
                      <div className="px-1 pb-1 text-xs text-muted">
                        <span className={d.actor.side === 'left' ? 'text-accent' : 'text-sky-400'}>{label('species', d.attacker.species, state.lang)}</span> {t.vs}{' '}
                        <span className={d.target.side === 'left' ? 'text-accent' : 'text-sky-400'}>{label('species', d.defender.species, state.lang)}</span>
                      </div>
                      <Results results={[d.result]} attacker={d.attacker} defender={d.defender} field={state.field} preFlinch={d.preFlinch} side={d.actor.side} battle={{ gameType: state.mode === '1v1' ? 'Singles' : 'Doubles', targetCount: d.targetCount }} lang={state.lang} activeMove={0} compact />
                    </div>
                  ) : null,
                )}
              </section>
            )}

          </div>

          {column('right')}
        </div>
      </main>

      {showMatrix && <MatrixModal state={state} lang={state.lang} onClose={() => setShowMatrix(false)} />}
      {showTypes && <TypeChartModal state={state} lang={state.lang} onClose={() => setShowTypes(false)} />}
      {showSpeed && (
        <SpeedTiersModal
          state={state}
          lang={state.lang}
          initialSide={showSpeed}
          onClose={() => setShowSpeed(null)}
          onUpdate={(side, index, patch) => setState((s) => { const team = [...s.teams[side]]; team[index] = { ...team[index], ...patch }; return { ...s, teams: { ...s.teams, [side]: team } } })}
        />
      )}
      {showLibrary && (
        <LibraryModal
          initialTab={showLibrary}
          library={library}
          onChange={updateLibrary}
          teams={state.teams}
          lang={state.lang}
          onClose={() => setShowLibrary(null)}
          onLoadSet={(side, p) => setState((s) => { const team = [...s.teams[side]]; team[s.selected[side]] = { ...p, activeMove: 0 }; return { ...s, teams: { ...s.teams, [side]: team } } })}
          onLoadTeam={(side, team) => setState((s) => ({ ...s, teams: { ...s.teams, [side]: team.map((p) => ({ ...p, activeMove: 0 })) } }))}
        />
      )}

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
