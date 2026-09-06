// Conditions de combat : météo, terrain, salles, et effets par côté (murs, pièges, Vent Arrière...).
// Chaque condition active est rendue visuellement (couleur, icône) pour ne pas l'oublier.
import type { CalcOptions, FieldState, Lang, SideState } from '../model'
import { dict } from '../i18n'

interface Props {
  value: FieldState
  onChange: (f: FieldState) => void
  options: CalcOptions
  onOptions: (o: CalcOptions) => void
  lang: Lang
}

const WEATHER_STYLE: Record<string, string> = {
  Sun: 'bg-amber-500/20 border-amber-400 text-amber-200',
  Rain: 'bg-sky-500/20 border-sky-400 text-sky-200',
  Sand: 'bg-yellow-700/25 border-yellow-600 text-yellow-200',
  Snow: 'bg-cyan-200/15 border-cyan-200 text-cyan-100',
}
const TERRAIN_STYLE: Record<string, string> = {
  Electric: 'bg-yellow-400/20 border-yellow-300 text-yellow-100',
  Grassy: 'bg-green-500/20 border-green-400 text-green-100',
  Psychic: 'bg-pink-500/20 border-pink-400 text-pink-100',
  Misty: 'bg-fuchsia-300/15 border-fuchsia-300 text-fuchsia-100',
}
const ICON: Record<string, string> = { Sun: '☀️', Rain: '🌧️', Sand: '🌪️', Snow: '❄️', Electric: '⚡', Grassy: '🌿', Psychic: '🔮', Misty: '🌫️' }

export default function FieldPanel({ value, onChange, options, onOptions, lang }: Props) {
  const t = dict(lang)
  const set = <K extends keyof FieldState>(k: K, v: FieldState[K]) => onChange({ ...value, [k]: v })

  return (
    <section className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.field}</h2>

      {/* Météo et terrain : des boutons colorés, l'actif est bien visible */}
      <div className="grid grid-cols-2 gap-3">
        <ChoiceRow
          label={t.weather}
          choices={['', 'Sun', 'Rain', 'Sand', 'Snow'] as const}
          value={value.weather}
          names={t.weatherNames}
          styles={WEATHER_STYLE}
          onPick={(v) => set('weather', v)}
        />
        <ChoiceRow
          label={t.terrain}
          choices={['', 'Electric', 'Grassy', 'Psychic', 'Misty'] as const}
          value={value.terrain}
          names={t.terrainNames}
          styles={TERRAIN_STYLE}
          onPick={(v) => set('terrain', v)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Toggle on={value.trickRoom} onClick={() => set('trickRoom', !value.trickRoom)} icon="🔄" label={t.trickRoom} color="violet" />
        <Toggle on={value.gravity} onClick={() => set('gravity', !value.gravity)} icon="⬇️" label={t.gravity} color="slate" />
        <Toggle on={value.magicRoom} onClick={() => set('magicRoom', !value.magicRoom)} icon="🚫" label={t.magicRoom} color="slate" />
        <Toggle on={value.wonderRoom} onClick={() => set('wonderRoom', !value.wonderRoom)} icon="🔀" label={t.wonderRoom} color="slate" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SideBlock title={t.sideAttacker} value={value.attackerSide} onChange={(s) => set('attackerSide', s)} lang={lang} role="attacker" />
        <SideBlock title={t.sideDefender} value={value.defenderSide} onChange={(s) => set('defenderSide', s)} lang={lang} role="defender" />
      </div>

      {/* Options de calcul */}
      <div className="border-t border-border pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{t.options}</h3>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={options.useAccuracy} onChange={(e) => onOptions({ ...options, useAccuracy: e.target.checked })} className="accent-accent" />
            {t.useAccuracy}
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted">{t.crit}</span>
            <select className="input !w-auto" value={options.critMode} onChange={(e) => onOptions({ ...options, critMode: e.target.value as CalcOptions['critMode'] })}>
              {(['chance', 'never', 'always'] as const).map((c) => <option key={c} value={c}>{t.critNames[c]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted">{t.maxTurns}</span>
            <select className="input !w-auto" value={options.maxTurns} onChange={(e) => onOptions({ ...options, maxTurns: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>
    </section>
  )
}

function ChoiceRow<T extends string>({ label, choices, value, names, styles, onPick }: {
  label: string; choices: readonly T[]; value: T; names: Record<string, string>; styles: Record<string, string>; onPick: (v: T) => void
}) {
  return (
    <div>
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c) => {
          const active = value === c
          const style = c ? styles[c] : 'bg-surface-2 border-border text-muted'
          return (
            <button
              key={c}
              type="button"
              onClick={() => onPick(c)}
              className={'rounded-md border px-2 py-1 text-xs font-medium transition ' + (active ? style + ' ring-1 ring-white/40' : 'border-border bg-surface-2 text-muted hover:text-text')}
            >
              {c ? ICON[c] + ' ' : ''}{names[c]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const TOGGLE_COLORS: Record<string, string> = {
  violet: 'bg-violet-500/25 border-violet-400 text-violet-100',
  slate: 'bg-slate-500/25 border-slate-300 text-slate-100',
  rose: 'bg-rose-500/25 border-rose-400 text-rose-100',
  amber: 'bg-amber-500/25 border-amber-400 text-amber-100',
  cyan: 'bg-cyan-500/25 border-cyan-400 text-cyan-100',
  emerald: 'bg-emerald-500/25 border-emerald-400 text-emerald-100',
  stone: 'bg-stone-500/30 border-stone-300 text-stone-100',
}

export function Toggle({ on, onClick, icon, label, color }: { on: boolean; onClick: () => void; icon: string; label: string; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={'rounded-md border px-2 py-1 text-xs font-medium transition ' + (on ? TOGGLE_COLORS[color] + ' ring-1 ring-white/30' : 'border-border bg-surface-2 text-muted hover:text-text')}
    >
      <span className={on ? '' : 'opacity-40 grayscale'}>{icon}</span> {label}
    </button>
  )
}

function SideBlock({ title, value, onChange, lang, role }: { title: string; value: SideState; onChange: (s: SideState) => void; lang: Lang; role: 'attacker' | 'defender' }) {
  const t = dict(lang)
  const set = <K extends keyof SideState>(k: K, v: SideState[K]) => onChange({ ...value, [k]: v })
  const border = role === 'attacker' ? 'border-accent/40' : 'border-sky-400/40'
  return (
    <div className={'rounded-lg border p-2.5 ' + border}>
      <div className={'text-xs font-semibold mb-2 ' + (role === 'attacker' ? 'text-accent' : 'text-sky-400')}>{title}</div>
      <div className="flex flex-wrap gap-1.5">
        <Toggle on={value.reflect} onClick={() => set('reflect', !value.reflect)} icon="🛡️" label={t.reflect} color="rose" />
        <Toggle on={value.lightScreen} onClick={() => set('lightScreen', !value.lightScreen)} icon="✨" label={t.lightScreen} color="amber" />
        <Toggle on={value.auroraVeil} onClick={() => set('auroraVeil', !value.auroraVeil)} icon="🌈" label={t.auroraVeil} color="cyan" />
        <Toggle on={value.tailwind} onClick={() => set('tailwind', !value.tailwind)} icon="💨" label={t.tailwind} color="cyan" />
        <Toggle on={value.helpingHand} onClick={() => set('helpingHand', !value.helpingHand)} icon="🤝" label={t.helpingHand} color="emerald" />
        <Toggle on={value.friendGuard} onClick={() => set('friendGuard', !value.friendGuard)} icon="🫂" label={t.friendGuard} color="emerald" />
        <Toggle on={value.stealthRock} onClick={() => set('stealthRock', !value.stealthRock)} icon="🪨" label={t.stealthRock} color="stone" />
        <button
          type="button"
          onClick={() => set('spikes', (value.spikes + 1) % 4)}
          className={'rounded-md border px-2 py-1 text-xs font-medium transition ' + (value.spikes ? TOGGLE_COLORS.stone + ' ring-1 ring-white/30' : 'border-border bg-surface-2 text-muted hover:text-text')}
        >
          <span className={value.spikes ? '' : 'opacity-40 grayscale'}>📌</span> {t.spikes}{value.spikes ? ` ×${value.spikes}` : ''}
        </button>
      </div>
    </div>
  )
}
