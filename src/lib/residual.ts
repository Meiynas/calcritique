// Pertes et gains de PV hors dégâts directs : drain (Vampirisme...), contrecoup (Boutefeu...), Orbe Vie,
// effets de fin de tour (poison, brûlure, tempête de sable, Vampigraine, Restes, Terrain Herbu...),
// Baie Sitrus, et talents d'entrée (Intimidation, Crachin, Sécheresse...).
import type { FieldState, PokemonState, SideKey, StatKey } from '../model'
type Weather = FieldState['weather']
type Terrain = FieldState['terrain']
import { effectiveAbility, moveInfo } from './engine'
import { isGrounded } from './switch'
import { FLINCH_MOVES, STATUS_MOVES, typesOf } from './status'

/** Part des dégâts rendue au lanceur (drain). */
export const DRAIN_MOVES: Record<string, number> = {
  'Giga Drain': 0.5, 'Drain Punch': 0.5, 'Horn Leech': 0.5, 'Leech Life': 0.5, 'Mega Drain': 0.5, 'Absorb': 0.5,
  'Parabolic Charge': 0.5, 'Bitter Blade': 0.5, 'Matcha Gotcha': 0.5, 'Dream Eater': 0.5, 'Bouncy Bubble': 0.5,
  'Draining Kiss': 0.75, 'Oblivion Wing': 0.75,
}
/** Part des dégâts infligés perdue en contrecoup. */
export const RECOIL_MOVES: Record<string, number> = {
  'Flare Blitz': 1 / 3, 'Brave Bird': 1 / 3, 'Double-Edge': 1 / 3, 'Wood Hammer': 1 / 3, 'Volt Tackle': 1 / 3, 'Wave Crash': 1 / 3,
  'Head Charge': 1 / 4, 'Wild Charge': 1 / 4, 'Take Down': 1 / 4, 'Submission': 1 / 4,
  'Head Smash': 1 / 2, 'Light of Ruin': 1 / 2,
}

export type SelfReason = 'drain' | 'recoil' | 'lifeOrb' | 'sitrus' | 'roughSkin' | 'rockyHelmet'
export interface SelfChange { reason: SelfReason; delta: number }

/** Attaque de contact ? (Peau Dure, Épine de Fer, Casque Brut, Poing Invisible...) */
export function isContactMove(move: string, attacker: PokemonState): boolean {
  const info = moveInfo(move)
  if (!info?.flags?.contact) return false
  if (attacker.item === 'Protective Pads' || effectiveAbility(attacker) === 'Long Reach') return false
  return true
}

/** Dégâts rendus au lanceur par la cible touchée au contact : Peau Dure / Épine de Fer (1/8 par coup), Casque Brut (1/6 par coup).
    Pas de dégâts si le lanceur a Garde Magik, des Patins Protecteurs ou Longue Portée, ni si l'attaque n'est pas de contact. */
export function contactDamage(move: string, attacker: PokemonState, target: PokemonState, attackerMaxHP: number, hits: number): SelfChange[] {
  const out: SelfChange[] = []
  if (!isContactMove(move, attacker) || effectiveAbility(attacker) === 'Magic Guard') return out
  const n = Math.max(1, hits)
  const ta = effectiveAbility(target)
  if (ta === 'Rough Skin' || ta === 'Iron Barbs') out.push({ reason: 'roughSkin', delta: -Math.max(1, Math.floor(attackerMaxHP / 8)) * n })
  if (target.item === 'Rocky Helmet') out.push({ reason: 'rockyHelmet', delta: -Math.max(1, Math.floor(attackerMaxHP / 6)) * n })
  return out
}

/** Variation de PV du lanceur après une frappe (drain, contrecoup). Delta positif = soin. */
export function selfChangesAfterHit(move: string, attacker: PokemonState, target: PokemonState, damage: number, maxHP: number): SelfChange[] {
  const out: SelfChange[] = []
  if (damage <= 0) return out
  const drain = DRAIN_MOVES[move]
  if (drain) {
    let heal = Math.max(1, Math.floor(damage * drain))
    if (attacker.item === 'Big Root') heal = Math.floor(heal * 1.3)
    if (target.ability === 'Liquid Ooze') heal = -heal
    out.push({ reason: 'drain', delta: heal })
  }
  const recoil = RECOIL_MOVES[move]
  if (recoil && attacker.ability !== 'Rock Head' && attacker.ability !== 'Magic Guard') {
    out.push({ reason: 'recoil', delta: -Math.max(1, Math.floor(damage * recoil)) })
  }
  void maxHP
  return out
}

/** Perte d'Orbe Vie après une attaque offensive qui a touché (une fois par attaque, pas par cible). */
export function lifeOrbLoss(attacker: PokemonState, move: string, maxHP: number): SelfChange | null {
  if (attacker.item !== 'Life Orb') return null
  if (attacker.ability === 'Magic Guard') return null
  const info = moveInfo(move)
  if (!info || info.category === 'Status') return null
  if (attacker.ability === 'Sheer Force' && (move in STATUS_MOVES || move in FLINCH_MOVES)) return null
  return { reason: 'lifeOrb', delta: -Math.max(1, Math.floor(maxHP / 10)) }
}

/** Baie Sitrus : +25 % des PV max dès que le Pokémon passe à 50 % ou moins. Retourne le soin ou 0. */
export function sitrusHeal(p: PokemonState, hp: number, maxHP: number, consumed: boolean): number {
  if (consumed || p.item !== 'Sitrus Berry' || hp <= 0) return 0
  const threshold = p.ability === 'Gluttony' ? 0.5 : 0.5
  if (hp <= Math.floor(maxHP * threshold)) return Math.floor(maxHP / 4)
  return 0
}

export type EndReason = 'sitrus' | 'sand' | 'hail' | 'grassy' | 'leftovers' | 'blackSludge' | 'burn' | 'poison' | 'toxic' | 'poisonHeal' | 'leechSeed' | 'leechSeedHeal' | 'rainDish' | 'iceBody' | 'drySkin' | 'solarPower'
export interface EndEffect { slot: { side: SideKey; index: number }; reason: EndReason; delta: number }

const SAND_IMMUNE_TYPES = ['Rock', 'Ground', 'Steel']

/** Effets de fin de tour pour un Pokémon (ordre du jeu simplifié : météo, terrain, objets, statuts, Vampigraine). */
export function endOfTurnFor(p: PokemonState, hp: number, maxHP: number, field: FieldState): { reason: EndReason; delta: number }[] {
  const out: { reason: EndReason; delta: number }[] = []
  if (hp <= 0) return out
  const magicGuard = p.ability === 'Magic Guard'
  const tys = typesOf(p)
  const f16 = Math.max(1, Math.floor(maxHP / 16))
  const f8 = Math.max(1, Math.floor(maxHP / 8))
  // Météo
  if (field.weather === 'Sand' && !magicGuard && !tys.some((t) => SAND_IMMUNE_TYPES.includes(t)) && !['Overcoat', 'Sand Force', 'Sand Rush', 'Sand Veil'].includes(p.ability) && p.item !== 'Safety Goggles') {
    out.push({ reason: 'sand', delta: -f16 })
  }
  if (field.weather === 'Rain' && p.ability === 'Rain Dish') out.push({ reason: 'rainDish', delta: f16 })
  if (field.weather === 'Rain' && p.ability === 'Dry Skin') out.push({ reason: 'drySkin', delta: f8 })
  if (field.weather === 'Sun' && p.ability === 'Dry Skin') out.push({ reason: 'drySkin', delta: -f8 })
  if (field.weather === 'Sun' && p.ability === 'Solar Power' && !magicGuard) out.push({ reason: 'solarPower', delta: -f8 })
  if (field.weather === 'Snow' && p.ability === 'Ice Body') out.push({ reason: 'iceBody', delta: f16 })
  // Terrain Herbu
  if (field.terrain === 'Grassy' && isGrounded(p, field)) out.push({ reason: 'grassy', delta: f16 })
  // Objets
  if (p.item === 'Leftovers') out.push({ reason: 'leftovers', delta: f16 })
  if (p.item === 'Black Sludge') out.push({ reason: 'blackSludge', delta: tys.includes('Poison') ? f16 : magicGuard ? 0 : -f8 })
  // Vampigraine
  if (p.leechSeed && !magicGuard) out.push({ reason: 'leechSeed', delta: -f8 })
  // Statuts
  if (p.status === 'brn' && !magicGuard) out.push({ reason: 'burn', delta: -(p.ability === 'Heatproof' ? Math.max(1, Math.floor(maxHP / 32)) : f16) })
  if ((p.status === 'psn' || p.status === 'tox') && p.ability === 'Poison Heal') out.push({ reason: 'poisonHeal', delta: f8 })
  else if (p.status === 'psn' && !magicGuard) out.push({ reason: 'poison', delta: -f8 })
  else if (p.status === 'tox' && !magicGuard) out.push({ reason: 'toxic', delta: -f16 }) // premier tour de poison grave
  return out.filter((e) => e.delta !== 0)
}

/** Talents déclenchés à l'entrée : météo, terrain, Intimidation. */
export const WEATHER_ABILITIES: Record<string, Weather> = { Drizzle: 'Rain', Drought: 'Sun', 'Sand Stream': 'Sand', 'Snow Warning': 'Snow', 'Orichalcum Pulse': 'Sun' }
export const TERRAIN_ABILITIES: Record<string, Terrain> = { 'Electric Surge': 'Electric', 'Grassy Surge': 'Grassy', 'Misty Surge': 'Misty', 'Psychic Surge': 'Psychic', 'Hadron Engine': 'Electric' }

export type EntryNote = { key: string; value?: number; target?: { side: SideKey; index: number } }

/** Effet d'Intimidation sur une cible : liste de variations de stats et une clé de note. */
export function intimidateEffect(target: PokemonState): { changes: { stat: StatKey; delta: number }[]; note: string } {
  const a = target.ability
  if (['Clear Body', 'White Smoke', 'Full Metal Body', 'Inner Focus', 'Own Tempo', 'Oblivious', 'Scrappy', 'Hyper Cutter', 'Mirror Armor'].includes(a) || target.item === 'Clear Amulet') {
    return { changes: [], note: 'intimidateBlocked' }
  }
  if (a === 'Guard Dog') return { changes: [{ stat: 'atk', delta: 1 }], note: 'intimidateGuardDog' }
  if (a === 'Defiant') return { changes: [{ stat: 'atk', delta: 1 }], note: 'intimidateDefiant' } // −1 puis +2
  if (a === 'Competitive') return { changes: [{ stat: 'atk', delta: -1 }, { stat: 'spa', delta: 2 }], note: 'intimidateCompetitive' }
  if (a === 'Contrary') return { changes: [{ stat: 'atk', delta: 1 }], note: 'intimidateContrary' }
  const changes: { stat: StatKey; delta: number }[] = [{ stat: 'atk', delta: -1 }]
  if (a === 'Rattled') changes.push({ stat: 'spe', delta: 1 })
  return { changes, note: 'intimidate' }
}
