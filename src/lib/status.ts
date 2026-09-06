// Statuts et effets secondaires qui empêchent d'agir : paralysie totale, sommeil, gel, flinch (tressaillement).
// Utilisé par la jauge "Chances" du détail par attaque et par le déroulé du tour.
import type { PokemonState } from '../model'
import { buildPokemon, moveInfo } from './engine'

/** Chance de flinch (en %) des attaques qui font tressaillir la cible si elle n'a pas encore agi. */
export const FLINCH_MOVES: Record<string, number> = {
  'Fake Out': 100, 'Upper Hand': 100,
  'Rock Slide': 30, 'Iron Head': 30, 'Air Slash': 30, 'Bite': 30, 'Headbutt': 30, 'Icicle Crash': 30, 'Heart Stamp': 30,
  'Stomp': 30, 'Astonish': 30, 'Sky Attack': 30, 'Snore': 30, 'Rolling Kick': 30, 'Needle Arm': 30, 'Steamroller': 30,
  'Zing Zap': 30, 'Double Iron Bash': 30, 'Triple Arrows': 30, 'Bone Club': 10,
  'Zen Headbutt': 20, 'Dark Pulse': 20, 'Waterfall': 20, 'Dragon Rush': 20, 'Twister': 20, 'Fiery Wrath': 20,
  'Extrasensory': 10, 'Fire Fang': 10, 'Ice Fang': 10, 'Thunder Fang': 10, 'Hyper Fang': 10,
}

/** Attaques qui dégèlent leur lanceur à coup sûr (il agit même gelé). */
export const SELF_THAW_MOVES = ['Flame Wheel', 'Sacred Fire', 'Flare Blitz', 'Fusion Flare', 'Scald', 'Steam Eruption', 'Burn Up', 'Pyro Ball', 'Scorching Sands', 'Matcha Gotcha']
/** Attaques non-Feu qui dégèlent la cible touchée (les attaques de type Feu le font toutes). */
export const THAW_TARGET_MOVES = ['Scald', 'Steam Eruption', 'Matcha Gotcha']

export const FULL_PARALYSIS = 0.25
/** Chance de se réveiller ce tour (sommeil de 1 à 3 tours, compteur inconnu : moyenne 1/3). */
export const WAKE_CHANCE = 1 / 3
export const THAW_CHANCE = 0.2

export type CantActReason = 'par' | 'slp' | 'frz'

/** Probabilité que le Pokémon n'agisse pas à cause de son statut, et la raison. */
export function cantActChance(p: PokemonState, move: string): { chance: number; reason: CantActReason | null } {
  if (p.status === 'par') return { chance: FULL_PARALYSIS, reason: 'par' }
  if (p.status === 'slp') return { chance: 1 - WAKE_CHANCE, reason: 'slp' }
  if (p.status === 'frz') {
    if (SELF_THAW_MOVES.includes(move)) return { chance: 0, reason: 'frz' }
    return { chance: 1 - THAW_CHANCE, reason: 'frz' }
  }
  return { chance: 0, reason: null }
}

/** Chance (0..1) qu'une frappe réussie fasse tressaillir la cible (si elle n'a pas encore agi ce tour). */
export function flinchChance(move: string, attacker: PokemonState, target: PokemonState): number {
  let base = FLINCH_MOVES[move] ?? 0
  if (!base) {
    // Roche Royale / Crâne Rasoir : 10 % sur les attaques offensives sans effet secondaire de flinch
    const info = moveInfo(move)
    if ((attacker.item === "King's Rock" || attacker.item === 'Razor Fang') && info && info.category !== 'Status') base = 10
    if (!base) return 0
  }
  if (attacker.ability === 'Serene Grace') base = Math.min(100, base * 2)
  if (target.ability === 'Inner Focus' || target.ability === 'Shield Dust' || target.item === 'Covert Cloak') return 0
  if (attacker.ability === 'Sheer Force' && base < 100) return 0
  return base / 100
}

/** L'attaque dégèle-t-elle la cible touchée ? */
export function thawsTarget(move: string): boolean {
  const info = moveInfo(move)
  return (info?.type === 'Fire' && info.category !== 'Status') || THAW_TARGET_MOVES.includes(move)
}

/** Types actuels (Téra comprise) du Pokémon, utile pour les immunités. */
export function typesOf(p: PokemonState): string[] {
  return buildPokemon(p).types as string[]
}
