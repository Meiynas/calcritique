// Résultats : une carte par attaque, avec dégâts, précision et le vrai taux de KO.
import type { Lang, PokemonState } from '../model'
import { dict } from '../i18n'
import { label } from '../lib/names'
import type { MoveResult } from '../lib/engine'
import TypeBadge from './TypeBadge'

interface Props {
  results: (MoveResult | null)[]
  attacker: PokemonState
  defender: PokemonState
  lang: Lang
  activeMove: number
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

export default function Results({ results, attacker, defender, lang, activeMove }: Props) {
  const t = dict(lang)
  const indexed = results.map((r, i) => ({ r, i })).filter((x): x is { r: MoveResult; i: number } => !!x.r && x.r.category !== 'Status')
  const shown = [...indexed.filter((x) => x.i === activeMove), ...indexed.filter((x) => x.i !== activeMove)]

  return (
    <section className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.results}</h2>
        <span className="text-[11px] text-muted">{t.koExplain}</span>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted">{t.resultsHint}</p>}
      <div className="grid gap-3">
      {shown.map(({ r, i }) => (
        <article key={r.move} className={'rounded-lg border bg-surface-2 p-3 ' + (i === activeMove ? 'border-accent ring-1 ring-accent/50' : 'border-border')}>
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
                <td className="text-xs text-muted pr-2">{t.trueKO}</td>
                {r.koTrue.map((p, i) => <td key={i} className={'text-right font-semibold ' + koColor(p)}>{pct(p)}</td>)}
              </tr>
              <tr className="text-muted">
                <td className="text-xs pr-2">{t.rollsOnlyKO}</td>
                {r.koRollsOnly.map((p, i) => <td key={i} className="text-right">{pct(p)}</td>)}
              </tr>
            </tbody>
          </table>

          {r.rolls.length > 1 && (
            <div className="mt-2 flex h-6 items-end gap-px" title={r.rolls.join(', ')}>
              {r.rolls.map((d, i) => (
                <div key={i} className={'flex-1 rounded-t ' + (d >= r.curHP ? 'bg-emerald-400/70' : 'bg-white/20')} style={{ height: `${Math.max(8, (d / Math.max(...r.rolls)) * 100)}%` }} />
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px] text-muted">
            {describe(attacker, lang, true, r.category)} → {describe(defender, lang, false, r.category)}
          </p>
        </article>
      ))}
      </div>
    </section>
  )
}
