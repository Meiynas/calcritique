// Résultats : une carte par attaque, avec dégâts, précision et le vrai taux de KO.
import type { FieldState, Lang, PokemonState } from '../model'
import { dict } from '../i18n'
import { cantActChance, statusChance } from '../lib/status'
import { defaultField } from '../model'
import { label } from '../lib/names'
import type { MoveResult } from '../lib/engine'
import TypeBadge from './TypeBadge'

interface Props {
  results: (MoveResult | null)[]
  attacker: PokemonState
  defender: PokemonState
  lang: Lang
  activeMove: number
  compact?: boolean
  field?: FieldState
  /** Chance que le lanceur soit apeuré avant d'agir (attaques adverses jouées avant) */
  preFlinch?: number
}

function pct(p: number): string {
  if (p <= 0) return '0 %'
  if (p >= 0.9995) return '100 %'
  return (Math.round(p * 1000) / 10).toFixed(1).replace(/\.0$/, '') + ' %'
}

function koColor(p: number): string {
  if (p >= 0.9995) return 'text-emerald-300'
  if (p >= 0.5) return 'text-amber-300'
  if (p > 0) return 'text-orange-300'
  return 'text-muted'
}

function describe(p: PokemonState, lang: Lang, offensive: boolean, category: string): string {
  const parts: string[] = []
  const sp = p.sp
  if (offensive) {
    const stat = category === 'Special' ? 'spa' : 'atk'
    parts.push(`${sp[stat]} ${dict(lang).statNames[stat]}`)
  } else {
    parts.push(`${sp.hp} ${dict(lang).statNames.hp}`)
    const stat = category === 'Special' ? 'spd' : 'def'
    parts.push(`${sp[stat]} ${dict(lang).statNames[stat]}`)
  }
  if (p.item) parts.push(label('items', p.item, lang))
  if (p.teraType) parts.push(`Tera ${label('types', p.teraType, lang)}`)
  return `${label('species', p.species, lang)} (${label('natures', p.nature, lang)}, ${parts.join(', ')})`
}

export default function Results({ results, attacker, defender, lang, activeMove, compact, field, preFlinch }: Props) {
  const t = dict(lang)
  const indexed = results.map((r, i) => ({ r, i })).filter((x): x is { r: MoveResult; i: number } => !!x.r && x.r.category !== 'Status')
  const shown = [...indexed.filter((x) => x.i === activeMove), ...indexed.filter((x) => x.i !== activeMove)]

  return (
    <section className={compact ? '' : 'rounded-xl border border-border bg-surface p-4 flex flex-col gap-3'}>
      {!compact && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.results}</h2>
          <span className="text-[11px] text-muted">{t.koExplain}</span>
        </div>
      )}
      {!compact && shown.length === 0 && <p className="text-sm text-muted">{t.resultsHint}</p>}
      <div className="grid gap-3">
      {shown.map(({ r, i }) => (
        <article key={r.move} className={'rounded-lg border bg-surface-2 p-3 ' + (!compact && i === activeMove ? 'border-accent ring-1 ring-accent/50' : 'border-border')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TypeBadge type={r.type} lang={lang} />
              <span className="font-semibold">{label('moves', r.move, lang)}</span>
              <span className="text-xs text-muted">{r.category === 'Physical' ? 'Phys' : 'Spé'} · {r.basePower} BP</span>
              {r.spread && <span className="text-[11px] text-muted italic">{t.spread}</span>}
            </div>
            <div className="text-right">
              {r.blockedByProtect ? (
                <div className="text-base font-bold text-emerald-300">🛡 {t.blockedByProtect}</div>
              ) : (
              <div className="text-lg font-bold tabular-nums">
                {r.minPct}% – {r.maxPct}%
              </div>
              )}
              {r.protectBypass && <div className="text-[11px] text-emerald-300">{r.protectBypass === 'feint' ? t.bypassFeint : t.bypassUnseenFist}</div>}
              <div className="text-xs text-muted tabular-nums">{r.min} – {r.max} / {r.curHP}{r.curHP !== r.maxHP ? ` (${r.maxHP})` : ''}</div>
            </div>
          </div>

          <div className="mt-2 text-sm">
            <span className="text-xs text-muted">{t.accuracy} : </span>
            <span>{r.accuracy.base === null ? t.neverMisses : `${r.accuracy.effective} %`}</span>
            {r.accuracy.notes.length > 0 && (
              <span className="ml-1 text-xs text-muted">({r.accuracy.base} % → {r.accuracy.notes.map((n) => t.acc[n.replace('acc.', '') as keyof typeof t.acc]).join(', ')})</span>
            )}
          </div>
          <table className="mt-2 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] uppercase text-muted">
                <th className="text-left font-medium"> </th>
                {r.koTrue.map((_, i) => <th key={i} className="font-medium text-right">{t.koIn(i + 1)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-xs text-muted pr-2" title={t.trueKOHint}>{t.trueKO}</td>
                {r.koTrue.map((p, i) => <td key={i} className={'text-right font-semibold ' + koColor(p)}>{pct(p)}</td>)}
              </tr>
              <tr className="text-muted">
                <td className="text-xs pr-2" title={t.rollsOnlyHint}>{t.rollsOnlyKO}</td>
                {r.koRollsOnly.map((p, i) => <td key={i} className="text-right">{pct(p)}</td>)}
              </tr>
            </tbody>
          </table>

          {r.max > 0 && <DamageGauge r={r} attacker={attacker} defender={defender} field={field} preFlinch={preFlinch ?? 0} lang={lang} />}
          <p className="mt-2 text-[11px]">
            <span className={effClass(r.effectiveness)}>{effLabel(r.effectiveness, lang)}</span>
            <span className="ml-2 text-muted">{describe(attacker, lang, true, r.category)} → {describe(defender, lang, false, r.category)}</span>
          </p>
        </article>
      ))}
      </div>
    </section>
  )
}

const THRESHOLDS = [25, 33.4, 50, 100]

function effLabel(m: number, lang: Lang): string {
  const t = dict(lang)
  if (m === 0) return t.eff.none
  if (m >= 4) return `${t.eff.super4} (×4)`
  if (m >= 2) return `${t.eff.super2} (×2)`
  if (m <= 0.25) return `${t.eff.weak4} (×0,25)`
  if (m <= 0.5) return `${t.eff.weak2} (×0,5)`
  return t.eff.neutral
}
function effClass(m: number): string {
  if (m === 0) return 'text-muted'
  if (m >= 2) return 'text-emerald-300 font-semibold'
  if (m < 1) return 'text-orange-300'
  return 'text-text'
}

/** Double jauge : (1) dégâts en % des PV max avec bande normale et bande critique, repères 25 / 33,4 / 50 / 100 ;
    (2) chances : raté / touche / critique. */
function DamageGauge({ r, attacker, defender, field, preFlinch, lang }: { r: MoveResult; attacker: PokemonState; defender: PokemonState; field?: FieldState; preFlinch: number; lang: Lang }) {
  const t = dict(lang)
  const pct = (v: number) => Math.min(100, (v / r.maxHP) * 100)
  const nMin = pct(r.min), nMax = pct(r.max), cMin = pct(r.critMin), cMax = pct(r.critMax)
  // Statut de l'attaquant : paralysie totale, sommeil, gel (il n'agit pas)
  // Enchaînement : apeuré avant d'agir -> statut du lanceur -> précision -> effets sur la cible -> critique
  const flinchedP = preFlinch
  const ca = cantActChance(attacker, r.move)
  const cantP = (1 - flinchedP) * ca.chance
  const actP = 1 - flinchedP - cantP
  const hit = actP * (r.accuracy.base === null ? 1 : r.accuracy.effective / 100)
  const critP = hit * r.critChance
  const missP = actP - hit
  const sc = statusChance(r.move, attacker, defender, field ?? defaultField())
  const statusP = sc ? hit * sc.chance : 0
  const normalP = Math.max(0, hit - critP - statusP)
  const p1 = (v: number) => Math.round(v * 1000) / 10
  const curPct = pct(r.curHP)
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span className="w-14 shrink-0">{t.gaugeDamage}</span>
        <div className="relative h-4 flex-1 rounded bg-white/10">
          {/* bande critique (derrière) puis bande normale */}
          <div className="absolute inset-y-0 rounded bg-amber-400/45" style={{ left: `${cMin}%`, width: `${Math.max(0.8, cMax - cMin)}%` }} title={`${t.critShort} ${Math.floor(cMin * 10) / 10}% – ${Math.floor(cMax * 10) / 10}%`} />
          <div className="absolute inset-y-0 rounded bg-white/70" style={{ left: `${nMin}%`, width: `${Math.max(0.8, nMax - nMin)}%` }} title={`${Math.floor(nMin * 10) / 10}% – ${Math.floor(nMax * 10) / 10}%`} />
          {THRESHOLDS.map((th) => (
            <div key={th} className="absolute inset-y-0 border-l border-dashed border-white/40" style={{ left: `${Math.min(99.6, th)}%` }} />
          ))}
          {curPct < 100 && <div className="absolute inset-y-0 border-l-2 border-accent" style={{ left: `${curPct}%` }} title={t.hp} />}
        </div>
      </div>
      <div className="ml-16 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
        {THRESHOLDS.map((th) => {
          const sure = nMin >= th, possible = nMax >= th, critOnly = !possible && cMax >= th
          const cls = sure ? 'text-emerald-300 font-semibold' : possible ? 'text-amber-300' : critOnly ? 'text-amber-200/70' : 'text-muted'
          const mark = sure ? '✓' : possible ? '~' : critOnly ? 'crit' : '✗'
          return <span key={th} className={cls}>{th === 100 ? 'KO' : th === 33.4 ? '33,4 %' : th + ' %'} {mark}</span>
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span className="w-14 shrink-0">{t.gaugeChances}</span>
        <div className="flex h-3 flex-1 overflow-hidden rounded bg-white/10">
          {flinchedP > 0 && <div className="bg-yellow-300/60" style={{ width: `${flinchedP * 100}%` }} title={`${t.preFlinch} ${p1(flinchedP)}%`} />}
          {cantP > 0 && ca.reason && <div className="bg-slate-400/60" style={{ width: `${cantP * 100}%` }} title={`${t.cantAct[ca.reason]} ${p1(cantP)}%`} />}
          {missP > 0 && <div className="bg-orange-400/70" style={{ width: `${missP * 100}%` }} title={`${t.missed} ${p1(missP)}%`} />}
          <div className="bg-emerald-400/70" style={{ width: `${normalP * 100}%` }} title={`${t.hitLabel} ${p1(normalP)}%`} />
          {statusP > 0 && sc && <div className="bg-violet-400/80" style={{ width: `${statusP * 100}%` }} title={`${t.inflictLabel[sc.status]} ${p1(statusP)}%`} />}
          {critP > 0 && <div className="bg-amber-400/80" style={{ width: `${critP * 100}%` }} title={`${t.critShort} ${p1(critP)}%`} />}
        </div>
      </div>
      <div className="ml-16 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
        {flinchedP > 0 && <span className="text-yellow-300">{p1(flinchedP)} % {t.preFlinch}</span>}
        {ca.reason && cantP > 0 && <span className="text-slate-300">{p1(cantP)} % {t.cantAct[ca.reason]}{ca.reason === 'slp' ? ` (${t.wakes} ${p1(1 - ca.chance)} %)` : ca.reason === 'frz' ? ` (${t.thaws} ${p1(1 - ca.chance)} %)` : ''}</span>}
        {missP > 0 && <span className="text-orange-300">{p1(missP)} % {t.missed}</span>}
        <span className="text-emerald-300">{p1(normalP)} % {t.actsNormally}</span>
        {statusP > 0 && sc && <span className="text-violet-300">{p1(statusP)} % {t.inflictLabel[sc.status]}</span>}
        {critP > 0 && <span className="text-amber-300">{p1(critP)} % {t.critShort}</span>}
      </div>
    </div>
  )
}
