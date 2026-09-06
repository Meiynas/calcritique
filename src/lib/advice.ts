// Conseils de répartition de SP et d'attaques, calculés à partir d'une frappe :
//  - côté attaquant : combien de SP en plus dans la stat d'attaque pour garantir 25 / 33,4 / 50 / 100 % au roll le plus bas ;
//  - côté défenseur : combien de SP en plus en Défense / Défense Spéciale (ou en PV) pour passer sous ces seuils au roll le plus haut ;
//  - autres attaques du learnset Champions qui mettent KO au roll le plus bas.
import type { FieldState, PokemonState, SideKey, StatKey } from '../model'
import { SP_MAX_STAT, SP_MAX_TOTAL, spTotal } from './champions'
import { damageRange, moveInfo } from './engine'
import { learnset } from './usage'

export const THRESHOLDS = [25, 33.4, 50, 100] as const

/** Attaques sur 2 tours (charge, semi-invulnérabilité, recharge) et Mitra-Poing : écartées des suggestions. */
export const TWO_TURN_MOVES = new Set([
  'Fly', 'Dig', 'Dive', 'Bounce', 'Phantom Force', 'Shadow Force', 'Sky Attack', 'Solar Beam', 'Solar Blade', 'Skull Bash', 'Razor Wind',
  'Freeze Shock', 'Ice Burn', 'Geomancy', 'Meteor Beam', 'Electro Shot', 'Sky Drop', 'Hyper Beam', 'Giga Impact', 'Blast Burn', 'Hydro Cannon',
  'Frenzy Plant', 'Rock Wrecker', 'Roar of Time', 'Prismatic Laser', 'Eternabeam', 'Focus Punch',
])

/** Ne garde que les lignes utiles : les seuils atteignables avec des SP, plus le plus haut "déjà" et le plus bas "hors de portée". */
export function trimOffensive<T extends { already: boolean; add: number | null }>(list: T[]): T[] {
  const already = list.filter((a) => a.already)
  const reachable = list.filter((a) => !a.already && a.add !== null)
  const out = list.filter((a) => !a.already && a.add === null)
  return [...(already.length ? [already[already.length - 1]] : []), ...reachable, ...(out.length ? [out[0]] : [])]
}
/** Côté défensif : "déjà sous 25 %" implique déjà sous les autres, "hors de portée pour passer sous 100 %" implique les autres. */
export function trimDefensive<T extends { already: boolean; add: number | null; hpAdd: number | null }>(list: T[]): T[] {
  const already = list.filter((a) => a.already)
  const reachable = list.filter((a) => !a.already && (a.add !== null || a.hpAdd !== null))
  const out = list.filter((a) => !a.already && a.add === null && a.hpAdd === null)
  return [...(already.length ? [already[0]] : []), ...reachable, ...(out.length ? [out[out.length - 1]] : [])]
}
export type Threshold = (typeof THRESHOLDS)[number]

export interface SpAdvice {
  threshold: Threshold
  /** SP à ajouter dans la stat (null = impossible même à 32 SP) */
  add: number | null
  stat: StatKey
  /** Dépasse le budget total de 66 SP */
  overBudget: boolean
  /** Déjà atteint sans rien changer */
  already: boolean
}

type Battle = { gameType?: 'Singles' | 'Doubles'; targetCount?: number }

/** Roll minimal en % des PV max pour une valeur de SP donnée dans une stat de l'attaquant */
function minPctWith(move: string, atk: PokemonState, def: PokemonState, field: FieldState, side: SideKey, battle: Battle, stat: StatKey, sp: number): number | null {
  const r = damageRange(move, { ...atk, sp: { ...atk.sp, [stat]: sp } }, def, field, side, battle)
  return r ? (r.min / r.maxHP) * 100 : null
}
function maxPctWith(move: string, atk: PokemonState, def: PokemonState, field: FieldState, side: SideKey, battle: Battle, stat: StatKey, sp: number): number | null {
  const r = damageRange(move, atk, { ...def, sp: { ...def.sp, [stat]: sp } }, field, side, battle)
  return r ? (r.max / r.maxHP) * 100 : null
}

/** Côté attaquant : SP à ajouter dans la stat offensive de l'attaque pour garantir chaque seuil au roll le plus bas. */
export function offensiveAdvice(move: string, atk: PokemonState, def: PokemonState, field: FieldState, side: SideKey, battle: Battle): SpAdvice[] {
  const info = moveInfo(move)
  if (!info || info.category === 'Status') return []
  const stat: StatKey = info.category === 'Special' ? 'spa' : 'atk'
  // Attaques dont les dégâts ne dépendent pas de la stat (Vampigraine, dégâts fixes...) : on le détecte par un test à 32 SP
  const cur = atk.sp[stat]
  const base = minPctWith(move, atk, def, field, side, battle, stat, cur)
  const top = minPctWith(move, atk, def, field, side, battle, stat, SP_MAX_STAT)
  if (base === null || top === null) return []
  const budgetLeft = SP_MAX_TOTAL - spTotal(atk.sp)
  const out: SpAdvice[] = []
  for (const th of THRESHOLDS) {
    if (base >= th) { out.push({ threshold: th, add: 0, stat, overBudget: false, already: true }); continue }
    if (top < th) { out.push({ threshold: th, add: null, stat, overBudget: false, already: false }); continue }
    // Recherche du plus petit SP qui atteint le seuil (dégâts croissants avec la stat : dichotomie)
    let lo = cur + 1, hi = SP_MAX_STAT
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      const v = minPctWith(move, atk, def, field, side, battle, stat, mid)
      if (v !== null && v >= th) hi = mid
      else lo = mid + 1
    }
    out.push({ threshold: th, add: lo - cur, stat, overBudget: lo - cur > budgetLeft, already: false })
  }
  return out
}

/** Côté défenseur : SP à ajouter en Défense / Défense Spéciale (selon l'attaque) pour passer STRICTEMENT sous chaque seuil au roll le plus haut. */
export function defensiveAdvice(move: string, atk: PokemonState, def: PokemonState, field: FieldState, side: SideKey, battle: Battle): (SpAdvice & { hpAdd: number | null })[] {
  const info = moveInfo(move)
  if (!info || info.category === 'Status') return []
  // Attaques qui frappent sur la Défense (Psyko Choc...) : le moteur gère, on choisit juste la stat conseillée
  const stat: StatKey = info.category === 'Special' && !['Psyshock', 'Psystrike', 'Secret Sword'].includes(move) ? 'spd' : 'def'
  const cur = def.sp[stat]
  const base = maxPctWith(move, atk, def, field, side, battle, stat, cur)
  const top = maxPctWith(move, atk, def, field, side, battle, stat, SP_MAX_STAT)
  if (base === null || top === null) return []
  const budgetLeft = SP_MAX_TOTAL - spTotal(def.sp)
  const search = (st: StatKey, from: number, th: number): number | null => {
    const best = maxPctWith(move, atk, def, field, side, battle, st, SP_MAX_STAT)
    if (best === null || best >= th) return null
    let lo = from + 1, hi = SP_MAX_STAT
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      const v = maxPctWith(move, atk, def, field, side, battle, st, mid)
      if (v !== null && v < th) hi = mid
      else lo = mid + 1
    }
    return lo - from
  }
  const out: (SpAdvice & { hpAdd: number | null })[] = []
  for (const th of THRESHOLDS) {
    if (base < th) { out.push({ threshold: th, add: 0, stat, overBudget: false, already: true, hpAdd: 0 }); continue }
    const add = top < th ? search(stat, cur, th) : null
    const hpAdd = search('hp', def.sp.hp, th)
    out.push({ threshold: th, add, stat, overBudget: add !== null && add > budgetLeft, already: false, hpAdd })
  }
  return out
}

/** Autres attaques du learnset Champions qui mettent KO au roll le plus bas (hors kit ou non), triées par précision puis puissance. */
export function guaranteedOHKOMoves(atk: PokemonState, def: PokemonState, field: FieldState, side: SideKey, battle: Battle, exclude: string): { move: string; accuracy: number | null; minPct: number }[] {
  const out: { move: string; accuracy: number | null; minPct: number }[] = []
  for (const m of learnset(atk.species)) {
    if (m === exclude) continue
    const info = moveInfo(m)
    if (!info || info.category === 'Status') continue // puissance variable (Balayage...) = 0 dans les données, on garde
    if (TWO_TURN_MOVES.has(m)) continue
    // Attaques inutilisables telles quelles (charge, contrecoup KO, dégâts fixes...) : on garde, l'utilisateur juge
    const r = damageRange(m, atk, def, field, side, battle)
    if (!r || r.min < r.curHP) continue
    out.push({ move: m, accuracy: r.accuracy, minPct: (r.min / r.maxHP) * 100 })
  }
  return out.sort((a, b) => (b.accuracy ?? 101) - (a.accuracy ?? 101) || b.minPct - a.minPct)
}
