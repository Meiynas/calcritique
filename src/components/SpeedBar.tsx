// Une seule barre de vitesse : curseur à gauche = l'attaquant a l'avantage, à droite = désavantage.
import type { Lang } from '../model'
import { dict } from '../i18n'
import type { SpeedInfo } from '../lib/engine'

export default function SpeedBar({ info, lang, trickRoom, attackerName, defenderName }: { info: SpeedInfo; lang: Lang; trickRoom: boolean; attackerName: string; defenderName: string }) {
  const t = dict(lang)
  // Position du curseur : log du ratio, borné à ±60 % de vitesse d'écart pour rester lisible
  const r = Math.log(Math.max(0.01, info.ratio))
  const limit = Math.log(1.6)
  let x = Math.max(-1, Math.min(1, r / limit)) // -1 = lent, +1 = rapide
  if (trickRoom) x = -x
  const pct = 50 - x * 50 // gauche = avantage
  const verdict = info.winner === 0 ? t.speedTie : info.winner === 1 ? `${attackerName} ${t.speedFaster}` : `${attackerName} ${t.speedSlower}`
  const color = info.winner === 0 ? 'bg-amber-400' : info.winner === 1 ? 'bg-emerald-400' : 'bg-accent'

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold uppercase tracking-wide text-muted text-xs">{t.speed}</span>
        <span className={'font-semibold ' + (info.winner === 0 ? 'text-amber-300' : info.winner === 1 ? 'text-emerald-300' : 'text-accent')}>{verdict}</span>
      </div>
      <div className="relative mt-3 h-3 rounded-full bg-gradient-to-r from-emerald-500/40 via-surface-2 to-accent/40">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/30" />
        <div className={'absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ' + color} style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
        <span>{attackerName} : <b className="text-text">{info.attacker}</b></span>
        {trickRoom && <span className="text-violet-300">{t.speedTrickRoom}</span>}
        <span>{defenderName} : <b className="text-text">{info.defender}</b></span>
      </div>
    </div>
  )
}
