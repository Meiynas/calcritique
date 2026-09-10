// Statuts et effets secondaires : paralysie totale, sommeil, gel, flinch (apeuré), et attaques qui infligent un statut.
// Taux propres à Pokémon Champions (source : Serebii, "Status Condition Changes") :
//   paralysie totale 12,5 % (au lieu de 25 %), réveil 33,3 % au 2e tour de sommeil puis 100 % au 3e,
//   dégel 25 % à chaque tentative d'attaque, dégel garanti au 3e tour.
// Utilisé par la jauge "Chances" du détail par attaque et par le déroulé du tour.
import type { FieldState, PokemonState, StatusKey } from '../model'
import { buildPokemon, moveInfo } from './engine'

/** Chance de flinch (en %) des attaques qui apeurent la cible si elle n'a pas encore agi. */
export const FLINCH_MOVES: Record<string, number> = {
  'Fake Out': 100, 'Upper Hand': 100,
  'Rock Slide': 30, 'Iron Head': 30, 'Air Slash': 30, 'Bite': 30, 'Headbutt': 30, 'Icicle Crash': 30, 'Heart Stamp': 30,
  'Stomp': 30, 'Astonish': 30, 'Sky Attack': 30, 'Snore': 30, 'Rolling Kick': 30, 'Needle Arm': 30, 'Steamroller': 30,
  'Zing Zap': 30, 'Double Iron Bash': 30, 'Triple Arrows': 30, 'Bone Club': 10,
  'Zen Headbutt': 20, 'Dark Pulse': 20, 'Waterfall': 20, 'Dragon Rush': 20, 'Twister': 20, 'Fiery Wrath': 20,
  'Extrasensory': 10, 'Fire Fang': 10, 'Ice Fang': 10, 'Thunder Fang': 10, 'Hyper Fang': 10,
}

export type InflictedStatus = Extract<StatusKey, 'par' | 'slp' | 'brn'>

/** Attaques qui infligent un statut à la cible : chance en % (100 = attaque de statut ou effet garanti). */
export const STATUS_MOVES: Record<string, { status: InflictedStatus; chance: number }> = {
  // Paralysie
  'Thunder Wave': { status: 'par', chance: 100 }, 'Stun Spore': { status: 'par', chance: 100 }, 'Glare': { status: 'par', chance: 100 },
  'Nuzzle': { status: 'par', chance: 100 }, 'Zap Cannon': { status: 'par', chance: 100 },
  'Body Slam': { status: 'par', chance: 30 }, 'Thunder': { status: 'par', chance: 30 }, 'Discharge': { status: 'par', chance: 30 },
  'Force Palm': { status: 'par', chance: 30 }, 'Lick': { status: 'par', chance: 30 }, 'Dragon Breath': { status: 'par', chance: 30 },
  'Spark': { status: 'par', chance: 30 }, 'Bounce': { status: 'par', chance: 30 }, 'Freeze Shock': { status: 'par', chance: 30 },
  'Bolt Strike': { status: 'par', chance: 20 },
  'Thunderbolt': { status: 'par', chance: 10 }, 'Thunder Punch': { status: 'par', chance: 10 }, 'Thunder Fang': { status: 'par', chance: 10 },
  'Volt Tackle': { status: 'par', chance: 10 }, 'Thunder Shock': { status: 'par', chance: 10 },
  // Sommeil
  'Spore': { status: 'slp', chance: 100 }, 'Sleep Powder': { status: 'slp', chance: 75 }, 'Lovely Kiss': { status: 'slp', chance: 75 },
  'Hypnosis': { status: 'slp', chance: 60 }, 'Sing': { status: 'slp', chance: 55 }, 'Grass Whistle': { status: 'slp', chance: 55 },
  'Dark Void': { status: 'slp', chance: 50 }, 'Relic Song': { status: 'slp', chance: 10 },
  // Brûlure
  'Will-O-Wisp': { status: 'brn', chance: 85 }, 'Scald': { status: 'brn', chance: 30 }, 'Steam Eruption': { status: 'brn', chance: 30 },
  'Lava Plume': { status: 'brn', chance: 30 }, 'Searing Shot': { status: 'brn', chance: 30 }, 'Fire Fang': { status: 'brn', chance: 10 },
  'Flamethrower': { status: 'brn', chance: 10 }, 'Fire Blast': { status: 'brn', chance: 10 }, 'Flare Blitz': { status: 'brn', chance: 10 },
  'Heat Wave': { status: 'brn', chance: 10 }, 'Fire Punch': { status: 'brn', chance: 10 }, 'Ember': { status: 'brn', chance: 10 },
  'Sacred Fire': { status: 'brn', chance: 50 }, 'Inferno': { status: 'brn', chance: 100 }, 'Blue Flare': { status: 'brn', chance: 20 },
  'Pyro Ball': { status: 'brn', chance: 10 }, 'Matcha Gotcha': { status: 'brn', chance: 20 },
  'Infernal Parade': { status: 'brn', chance: 30 }, 'Blazing Torque': { status: 'brn', chance: 30 }, 'Ice Burn': { status: 'brn', chance: 30 },
}
const POWDER_MOVES = ['Stun Spore', 'Spore', 'Sleep Powder']
/** Attaques de statut (pas de dégâts) : leur précision compte pour la chance d'infliger le statut. */
export const STATUS_MOVE_ACCURACY: Record<string, number> = { 'Thunder Wave': 90, 'Stun Spore': 75, 'Glare': 100, 'Spore': 100, 'Sleep Powder': 75, 'Lovely Kiss': 75, 'Hypnosis': 60, 'Sing': 55, 'Grass Whistle': 55, 'Dark Void': 50, 'Will-O-Wisp': 85 }

/** Attaques qui dégèlent leur lanceur à coup sûr (il agit même gelé). */
export const SELF_THAW_MOVES = ['Flame Wheel', 'Sacred Fire', 'Flare Blitz', 'Fusion Flare', 'Scald', 'Steam Eruption', 'Burn Up', 'Pyro Ball', 'Scorching Sands', 'Matcha Gotcha']
/** Attaques non-Feu qui dégèlent la cible touchée (les attaques de type Feu le font toutes). */
export const THAW_TARGET_MOVES = ['Scald', 'Steam Eruption', 'Matcha Gotcha']

/** Taux Pokémon Champions */
export const FULL_PARALYSIS = 0.125
/** Réveil au 2e tour de sommeil (le 3e tour réveille à coup sûr) ; compteur inconnu : on retient le 2e tour. */
export const WAKE_CHANCE = 1 / 3
export const THAW_CHANCE = 0.25

export type CantActReason = 'par' | 'slp' | 'frz' | 'confusion'
export const CONFUSION_SELF_HIT = 1 / 3
/** Attaques qui rendent confus : chance en % (attaques de statut = leur précision) */
export const CONFUSION_MOVES: Record<string, number> = {
  'Confuse Ray': 100, 'Swagger': 85, 'Flatter': 100, 'Supersonic': 55, 'Sweet Kiss': 75, 'Teeter Dance': 100,
  'Dynamic Punch': 100, 'Hurricane': 30, 'Psybeam': 10, 'Confusion': 10, 'Dizzy Punch': 20, 'Signal Beam': 10, 'Water Pulse': 20, 'Rock Climb': 20, 'Chatter': 100, 'Strange Steam': 20, 'Axe Kick': 30,
}

/** Probabilité que le Pokémon n'agisse pas à cause de son statut, et la raison. */
export function cantActChance(p: PokemonState, move: string): { chance: number; reason: CantActReason | null } {
  let chance = 0
  let reason: CantActReason | null = null
  if (p.status === 'par') { chance = FULL_PARALYSIS; reason = 'par' }
  else if (p.status === 'slp') { chance = 1 - WAKE_CHANCE; reason = 'slp' }
  else if (p.status === 'frz') { chance = SELF_THAW_MOVES.includes(move) ? 0 : 1 - THAW_CHANCE; reason = 'frz' }
  // Confusion : vérifiée après le statut, 1 chance sur 3 de se frapper soi-même
  if (p.confused) {
    const combined = 1 - (1 - chance) * (1 - CONFUSION_SELF_HIT)
    if (!reason || CONFUSION_SELF_HIT * (1 - chance) > chance) reason = 'confusion'
    chance = combined
  }
  return { chance, reason }
}

/** La cible peut-elle être rendue confuse par cette attaque ? */
export function canConfuse(move: string, attacker: PokemonState, target: PokemonState, field: FieldState): boolean {
  if (target.confused) return false
  if (target.ability === 'Own Tempo') return false
  const info = moveInfo(move)
  const isStatusMove = !info || info.category === 'Status'
  const types = typesOf(target)
  const grounded = !types.includes('Flying') && target.ability !== 'Levitate' && target.ability !== 'Eelevate' && target.item !== 'Air Balloon'
  if (field.terrain === 'Misty' && grounded) return false
  if (isStatusMove) {
    if (target.ability === 'Good as Gold') return false
    if (attacker.ability === 'Prankster' && types.includes('Dark')) return false
  } else if (secondaryBlocked(attacker, target, false)) return false
  return true
}

/** Chance (0..1) de rendre la cible confuse (précision pour une attaque de statut, effet secondaire sinon) */
export function confusionChance(move: string, attacker: PokemonState, target: PokemonState, field: FieldState): number {
  const base = CONFUSION_MOVES[move]
  if (!base || !canConfuse(move, attacker, target, field)) return 0
  const info = moveInfo(move)
  const isStatusMove = !info || info.category === 'Status'
  if (isStatusMove) return (attacker.ability === 'No Guard' || target.ability === 'No Guard' ? 100 : base) / 100
  return Math.min(100, attacker.ability === 'Serene Grace' ? base * 2 : base) / 100
}

function secondaryBlocked(attacker: PokemonState, target: PokemonState, guaranteed: boolean): boolean {
  if (guaranteed) return false
  if (target.ability === 'Shield Dust' || target.item === 'Covert Cloak') return true
  if (attacker.ability === 'Sheer Force') return true
  return false
}

/** Chance (0..1) qu'une frappe réussie apeure la cible (si elle n'a pas encore agi ce tour). */
export function flinchChance(move: string, attacker: PokemonState, target: PokemonState): number {
  let base = FLINCH_MOVES[move] ?? 0
  if (!base) {
    // Roche Royale / Crâne Rasoir : 10 % sur les attaques offensives sans effet secondaire de flinch
    const info = moveInfo(move)
    if ((attacker.item === "King's Rock" || attacker.item === 'Razor Fang') && info && info.category !== 'Status') base = 10
    if (!base) return 0
  }
  if (attacker.ability === 'Serene Grace') base = Math.min(100, base * 2)
  if (target.ability === 'Inner Focus') return 0
  if (secondaryBlocked(attacker, target, base >= 100 && FLINCH_MOVES[move] === 100)) return 0
  return base / 100
}

/** La cible peut-elle recevoir ce statut ? (types, talents, terrain, statut déjà présent) */
export function canReceiveStatus(status: InflictedStatus, move: string, target: PokemonState, field: FieldState): boolean {
  if (target.status) return false
  const types = typesOf(target)
  const grounded = !types.includes('Flying') && target.ability !== 'Levitate' && target.ability !== 'Eelevate' && target.item !== 'Air Balloon'
  if (['Comatose', 'Purifying Salt'].includes(target.ability)) return false
  if (field.terrain === 'Misty' && grounded) return false
  if (POWDER_MOVES.includes(move) && (types.includes('Grass') || target.ability === 'Overcoat' || target.item === 'Safety Goggles')) return false
  if (target.ability === 'Leaf Guard' && field.weather === 'Sun') return false
  if (status === 'par') {
    if (types.includes('Electric')) return false
    if (move === 'Thunder Wave' && types.includes('Ground')) return false
    if (target.ability === 'Limber') return false
  }
  if (status === 'slp') {
    if (['Insomnia', 'Vital Spirit', 'Sweet Veil'].includes(target.ability)) return false
    if (field.terrain === 'Electric' && grounded) return false
  }
  if (status === 'brn') {
    if (types.includes('Fire')) return false
    if (['Water Veil', 'Water Bubble', 'Thermal Exchange'].includes(target.ability)) return false
  }
  return true
}

/** Statut que l'attaque peut infliger et sa chance (0..1) sachant qu'elle touche. 0 si impossible. */
export function statusChance(move: string, attacker: PokemonState, target: PokemonState, field: FieldState): { status: InflictedStatus; chance: number } | null {
  const def = STATUS_MOVES[move]
  if (!def || def.chance <= 0) return null
  const info = moveInfo(move)
  const isStatusMove = !info || info.category === 'Status'
  if (isStatusMove && target.ability === 'Good as Gold') return null
  if (!canReceiveStatus(def.status, move, target, field)) return null
  let chance = def.chance
  if (!isStatusMove) {
    if (secondaryBlocked(attacker, target, false)) return null
    if (attacker.ability === 'Serene Grace') chance = Math.min(100, chance * 2)
  } else {
    // Attaque de statut : la "chance" est sa précision
    chance = STATUS_MOVE_ACCURACY[move] ?? 100
    if (attacker.ability === 'No Guard' || target.ability === 'No Guard') chance = 100
    if (attacker.ability === 'Prankster' && typesOf(target).includes('Dark')) return null
  }
  return { status: def.status, chance: chance / 100 }
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
