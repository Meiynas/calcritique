// Règles propres à Pokémon Champions.
// Niveau 50, IV parfaits, Points de Stat (SP) : 66 au total, 32 max par stat,
// 1 SP = +1 point dans la stat finale au niveau 50.

import type { StatKey } from '../model'

export const LEVEL = 50
export const IV = 31
export const SP_MAX_TOTAL = 66
export const SP_MAX_STAT = 32

/** Un SP vaut exactement 8 EV au niveau 50 avec des IV à 31 (floor((2B + 31 + EV/4) / 2) + 5). */
export function spToEvs(sp: number): number {
  return Math.max(0, Math.min(SP_MAX_STAT, Math.round(sp))) * 8
}

export function spTotal(sp: Record<StatKey, number>): number {
  return Object.values(sp).reduce((a, b) => a + b, 0)
}

/** Stat finale au niveau 50 (hors nature pour les PV). */
export function statAt50(base: number, sp: number, stat: StatKey, natureMod: 0.9 | 1 | 1.1): number {
  const inner = Math.floor(((2 * base + IV + 2 * sp) * LEVEL) / 100)
  if (stat === 'hp') return base === 1 ? 1 : inner + LEVEL + 10
  return Math.floor((inner + 5) * natureMod)
}
