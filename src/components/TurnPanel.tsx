// Déroulé du tour : ordre des actions et trois scénarios (meilleur / moyen / pire pour l'équipe 1).
import { useState } from 'react'
import type { AppState, Lang } from '../model'
import { dict } from '../i18n'
import { label } from '../lib/names'
import { slotKey, type Hit, type Scenario, type ScenarioKind, type TurnResult, type Slot } from '../lib/turn'
import TypeBadge from './TypeBadge'
import { moveInfo } from '../lib/engine'

interface Props {
  state: AppState
  turn: TurnResult
  lang: Lang
}

const KINDS: ScenarioKind[] = ['best', 'average', 'worst']

const VIEW_KEY = 'calcritique.turnView'

export default function TurnPanel({ state, turn, lang }: Props) {
  const t = dict(lang)
  const [view, setView] = useState<'likely' | 'all'>(() => { try { return localStorage.getItem(VIEW_KEY) === 'all' ? 'all' : 'likely' } catch { return 'likely' } })
  const shownKinds: ScenarioKind[] = view === 'all' ? KINDS : ['average']
  const pickView = (v: 'likely' | 'all') => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* stockage indisponible */ } }
  const name = (s: Slot) => label('species', state.teams[s.side][s.index].species, lang)
  const sideColor = (s: Slot) => (s.side === 'left' ? 'text-accent' : 'text-sky-400')

  if (turn.order.length === 0) {
    return <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">{t.noPair}</div>
  }
  // Lignes du tableau dans l'ordre réel du scénario moyen (vitesse dynamique)
  const rows = turn.order
    .map((a) => ({ a, pos: (turn.scenarios.average.actions.find((x) => slotKey(x.action.actor) === slotKey(a.actor))?.position ?? 1) - 1 }))
    .sort((x, y) => x.pos - y.pos)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.turnTitle}</h2>
        <div className="flex overflow-hidden rounded border border-border text-[11px]">
          {(['likely', 'all'] as const).map((v) => (
            <button key={v} type="button" onClick={() => pickView(v)} className={'px-2 py-0.5 ' + (view === v ? 'bg-accent text-white' : 'text-muted hover:text-text')}>{v === 'likely' ? t.viewLikely : t.viewAll}</button>
          ))}
        </div>
      </div>
      <p className="px-1 text-[11px] text-muted">{view === 'all' ? t.turnHint : t.likelyHint}</p>
    <section className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">

      {/* Ordre des actions */}
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {turn.order.map((a, i) => {
          const info = a.move ? moveInfo(a.move) : undefined
          return (
            <li key={slotKey(a.actor)} className="flex items-center gap-1.5">
              <span className={'flex items-center gap-1.5 rounded-md border px-2 py-1 ' + (a.actor.side === 'left' ? 'border-accent/50 bg-accent/10' : 'border-sky-400/50 bg-sky-400/10')}>
                <span className="font-bold text-muted">{i + 1}.</span>
                <span className={'font-semibold ' + sideColor(a.actor)}>{name(a.actor)}</span>
                {info && <TypeBadge type={info.type} lang={lang} small />}
                <span>{a.switchIn ? t.switchInAction : a.move ? label('moves', a.move, lang) : '·'}</span>
                {a.targets.length > 0 && !a.isStatus && <span className="text-muted">→ {a.spread ? t.allTargets : name(a.targets[0])}</span>}
                {a.priority !== 0 && !a.switchIn && <span className="text-violet-300">{a.priority > 0 ? '+' + a.priority : a.priority}</span>}
                <span className="tabular-nums text-muted">{a.speed}</span>
              </span>
              {i < turn.order.length - 1 && <span className="text-muted">{a.tieWithNext ? '≈' : '→'}</span>}
            </li>
          )
        })}
      </ol>

      {/* Tableau des scénarios */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="text-[11px] uppercase text-muted">
              <th className="w-24 text-left font-medium py-1">{t.action}</th>
              {shownKinds.map((k) => <th key={k} className="text-left font-medium py-1 px-1.5">{view === 'all' ? t.scenario[k] : t.viewLikely}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, pos: i }) => (
              <tr key={slotKey(a.actor)} className="border-t border-border/60 align-top">
                <td className="py-1.5 pr-1.5">
                  <div className={'font-semibold ' + sideColor(a.actor)}>{i + 1}. {name(a.actor)}</div>
                  <div className="text-muted">{a.switchIn ? t.switchInAction : a.move ? label('moves', a.move, lang) : '·'}{a.spread ? ` · ${t.spreadShort}` : ''}</div>
                </td>
                {shownKinds.map((k) => {
                  const sa = turn.scenarios[k].actions.find((x) => slotKey(x.action.actor) === slotKey(a.actor))!
                  return (
                    <td key={k} className="py-1.5 px-1.5">
                      {sa.position !== i + 1 && <span className="mr-1 rounded bg-violet-500/30 px-1 text-[10px] text-violet-200" title={t.reordered}>{sa.position}{lang === 'fr' ? 'e' : 'th'}</span>}
                      {sa.skipped === 'fainted' && <span className="text-muted italic">{t.skippedFainted}</span>}
                      {sa.skipped && sa.skipped !== 'fainted' && <span className="text-yellow-300 italic">{t.skippedReason[sa.skipped]}{sa.selfHit ? ` (−${sa.selfHit} PV)` : ''}</span>}
                      {!sa.skipped && sa.effect && <span className="text-emerald-300 italic">{t.effects[sa.effect]}</span>}
                      {!sa.skipped && !sa.effect && a.isStatus && <span className="text-muted italic">{t.statusMove}</span>}
                      {!sa.skipped && !a.isStatus && sa.hits.length === 0 && <span className="text-muted italic">{t.noTarget}</span>}
                      {sa.notes && sa.notes.length > 0 && (
                        <div className="text-[11px] text-muted">
                          {sa.notes.map((n, j) => {
                            const v = (t.entryNotes as Record<string, string | ((n: number) => string)>)[n.key]
                            const txt = typeof v === 'function' ? v(n.value ?? 0) : v ?? n.key
                            return <div key={j}>{n.target ? <span className={sideColor(n.target)}>{name(n.target)} : </span> : null}{txt}</div>
                          })}
                        </div>
                      )}
                      {sa.hits.map((h) => <HitLine key={slotKey(h.target)} hit={h} name={name(h.target)} lang={lang} rich={view === 'likely'} />)}
                      {sa.self && sa.self.length > 0 && (
                        <div className="flex flex-wrap gap-x-2 text-[11px]">
                          {sa.self.map((c, j) => <span key={j} className={c.delta > 0 ? 'text-emerald-300' : 'text-orange-300'}>{name(a.actor)} {c.delta > 0 ? '+' : ''}{c.delta} PV ({t.selfReason[c.reason]})</span>)}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {shownKinds.some((k) => turn.scenarios[k].endOfTurn.length > 0) && (
              <tr className="border-t border-border/60 align-top">
                <td className="py-1.5 pr-1.5 font-semibold text-muted">{t.endOfTurnEffects}</td>
                {shownKinds.map((k) => (
                  <td key={k} className="py-1.5 px-1.5 text-[11px]">
                    {turn.scenarios[k].endOfTurn.map((e, j) => (
                      <div key={j} className="flex gap-1">
                        <span className={sideColor(e.slot)}>{name(e.slot)}</span>
                        <span className={e.delta > 0 ? 'text-emerald-300' : 'text-orange-300'}>{e.delta > 0 ? '+' : ''}{e.delta} PV</span>
                        <span className="text-muted">({t.endReason[e.reason]})</span>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            )}
            <tr className="border-t border-border">
              <td className="py-2 pr-2 font-semibold uppercase text-[11px] text-muted">{t.endOfTurn}</td>
              {shownKinds.map((k) => <td key={k} className="py-2 px-2"><EndState scenario={turn.scenarios[k]} state={state} lang={lang} /></td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    </div>
  )
}

function HitLine({ hit, name, lang, rich }: { hit: Hit; name: string; lang: Lang; rich?: boolean }) {
  const t = dict(lang)
  const pct = Math.round((hit.damage / hit.maxHP) * 1000) / 10
  const afterPct = Math.round((hit.hpAfter / hit.maxHP) * 100)
  const p1 = (v: number) => Math.round(v * 1000) / 10
  const d = hit.detail
  const c = hit.chances
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 leading-5">
      <span className="text-muted">→ {name}</span>
      {hit.redirected && <span className="text-violet-300">↪ {t.redirected}</span>}
      {hit.blocked && <span className="text-emerald-300">🛡 {hit.blockedBy === 'wideGuard' ? t.effects.wideGuard : hit.blockedBy === 'quickGuard' ? t.effects.quickGuard : t.blockedByProtect}</span>}
      {!hit.blocked && hit.missed && <span className="text-orange-300">{t.missed}</span>}
      {!hit.blocked && !hit.missed && hit.subDamage && <span className="text-slate-300">🪆 {t.subHit(hit.subDamage)}{hit.subBroken ? ` · ${t.subBroken}` : ''}</span>}
      {!hit.blocked && !hit.missed && (
        <>
          <span className={'font-semibold tabular-nums ' + (hit.ko ? 'text-accent' : '')}>−{pct}%</span>
          {hit.crit && <span className="text-amber-300">{t.critShort}</span>}
          {hit.helpingHand && <span className="text-amber-200">🤝</span>}
          {hit.inflicted && <span className="text-yellow-300">{hit.inflicted === 'par' ? '⚡' : hit.inflicted === 'slp' ? '💤' : '🔥'} {t.statusNames[hit.inflicted]}</span>}
          {hit.flinched && <span className="text-yellow-300">💫 {t.flinchedHit}</span>}
          {hit.thawed && <span className="text-sky-300">🔥 {t.thawedHit}</span>}
          {hit.confused && <span className="text-yellow-300">💫 {t.confusedHit}</span>}
          {hit.sitrus && <span className="text-emerald-300">🍐 +{hit.sitrus}</span>}
          {rich && d && d.maxPct > d.minPct && <span className="tabular-nums text-muted">({Math.floor(d.minPct * 10) / 10} {t.toShort} {Math.floor(d.maxPct * 10) / 10} %)</span>}
          <span className="tabular-nums text-muted">({hit.hpAfter}/{hit.maxHP} · {afterPct}%)</span>
          {hit.ko && <span className="font-bold text-accent">KO</span>}
        </>
      )}
      {rich && c && !hit.blocked && (
        <span className="flex flex-wrap gap-x-1.5 text-[10px]">
          {c.miss > 0 && <span className="text-orange-300">{p1(c.miss)} % {t.missed}</span>}
          {c.crit > 0 && <span className="text-amber-300">{p1(c.crit)} % {t.critShort}</span>}
          {c.flinch > 0 && <span className="text-yellow-300">{p1(c.flinch)} % {t.flinchLabel}</span>}
          {c.status && c.status.chance > 0 && c.status.chance < 1 && <span className="text-violet-300">{p1(c.status.chance)} % {t.inflictLabel[c.status.status]}</span>}
        </span>
      )}
      {hit.detail && !hit.blocked && hit.detail.koTrue[0] > 0 && hit.detail.koTrue[0] < 1 && (
        <span className="text-[10px] text-muted">{t.koChanceShort} {Math.round(hit.detail.koTrue[0] * 100)}%</span>
      )}
    </div>
  )
}

function EndState({ scenario, state, lang }: { scenario: Scenario; state: AppState; lang: Lang }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Object.entries(scenario.hp).map(([key, v]) => {
        const [side, idx] = key.split(':') as ['left' | 'right', string]
        const p = state.teams[side][Number(idx)]
        const pct = Math.round((v.hp / v.maxHP) * 100)
        const color = v.fainted ? 'bg-accent' : pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-amber-400' : 'bg-accent'
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className={'w-16 truncate font-medium ' + (side === 'left' ? 'text-accent' : 'text-sky-400')}>{label('species', p.species, lang)}</span>
            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-white/10"><div className={'h-full ' + color} style={{ width: `${pct}%` }} /></div>
            <span className="tabular-nums text-muted">{v.fainted ? <b className="text-accent">KO</b> : `${pct}%`}</span>
          </div>
        )
      })}
    </div>
  )
}
