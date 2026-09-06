import type { Lang } from '../model'
import { label } from '../lib/names'

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C', Grass: '#7AC74C', Ice: '#96D9D6',
  Fighting: '#C22E28', Poison: '#A33EA1', Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A',
  Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746', Steel: '#B7B7CE', Fairy: '#D685AD', Stellar: '#8de0c9',
}

export default function TypeBadge({ type, lang, small, tera, fixed }: { type: string; lang: Lang; small?: boolean; tera?: boolean; fixed?: boolean }) {
  const color = TYPE_COLORS[type] ?? '#888'
  return (
    <span
      className={'inline-flex items-center rounded font-semibold uppercase tracking-wide text-white ' + (small ? 'px-1 py-px text-[9px]' : 'px-1.5 py-0.5 text-[10px]') + (fixed ? ' w-16 justify-center' : '') + (tera ? ' ring-2 ring-white/70' : '')}
      style={{ backgroundColor: color, textShadow: '0 1px 1px rgba(0,0,0,.5)' }}
      title={tera ? 'Tera' : undefined}
    >
      {label('types', type, lang)}
    </span>
  )
}
