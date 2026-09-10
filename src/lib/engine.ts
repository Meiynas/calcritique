// Moteur de Calcritique : construit les objets du moteur @smogon/calc à partir de l'état
// de l'écran, lance le calcul, puis ajoute ce que Showdown ne fait pas :
// le VRAI taux de KO (précision x rolls x critiques) sur 1 à N attaques.

import { calculate, Field, Move, Pokemon, toID } from "@smogon/calc"
import type { FieldState, PokemonState, SideState, SideKey, CalcOptions, StatKey } from '../model'
import { LEVEL, SP_MAX_STAT } from './champions'
import { gen } from './gen'
import extraJson from '../data/extra.json'

export { gen }

interface Extra {
  moves: Record<string, { acc: number | null; prio: number }>
  species: Record<string, { abilities: string[]; id: number }>
}
export const EXTRA = extraJson as Extra

/** Espèces proposées à l'utilisateur : celles connues du moteur ET de PokéAPI (pas de fakemons). */
export const SPECIES_KEYS: string[] = Object.keys(EXTRA.species).filter((k) => gen.species.get(toID(k)))

export function speciesInfo(name: string) {
  return gen.species.get(toID(name))
}

/** Talent imposé par une Méga-Évolution (une Méga a toujours un seul talent), sinon null. */
export function megaAbility(species: string): string | null {
  if (!species.includes('-Mega')) return null
  const info = gen.species.get(toID(species))
  return (info?.abilities as Record<string, string> | undefined)?.['0'] ?? null
}

/** Talent réellement actif : celui de la Méga si le Pokémon est méga-évolué. */
export function effectiveAbility(p: PokemonState): string {
  return megaAbility(p.species) ?? p.ability
}

export function moveInfo(name: string) {
  return gen.moves.get(toID(name))
}

export function natureInfo(name: string) {
  return gen.natures.get(toID(name))
}

export const TYPE_NAMES: string[] = Array.from(gen.types).map((t) => t.name).filter((t) => t !== '???' && t !== 'Stellar')

// ---------- Construction des objets du moteur ----------

/** Vrai si l'objet existe dans Pokémon Champions (liste du moteur). */
export function isChampionsItem(item: string | undefined): boolean {
  return !!item && !!gen.items.get(toID(item))
}

export function buildPokemon(p: PokemonState): Pokemon {
  const evs: Partial<Record<StatKey, number>> = {}
  // Mode Champions : le moteur prend directement les SP (0 à 32) à la place des EV
  for (const k of Object.keys(p.sp) as StatKey[]) evs[k] = Math.max(0, Math.min(SP_MAX_STAT, Math.round(p.sp[k] || 0)))
  const base = new Pokemon(gen, p.species, {
    level: LEVEL,
    nature: p.nature || 'Serious',
    evs,
    // Objet ou talent absent de Champions (vieux set, import Showdown) : ignoré par le moteur, qui planterait sinon
    item: (isChampionsItem(p.item) ? p.item : undefined) as never,
    ability: ((effectiveAbility(p) && gen.abilities.get(toID(effectiveAbility(p))) ? effectiveAbility(p) : undefined)) as never,
    teraType: ((p.teraActive !== false && p.teraType) || undefined) as never,
    boosts: p.boosts,
    status: p.status,
  })
  const maxHP = base.rawStats.hp
  const cur = Math.max(1, Math.min(maxHP, Math.round((maxHP * p.curHPPercent) / 100)))
  base.originalCurHP = cur
  return base
}

function buildSide(s: SideState) {
  return {
    isReflect: s.reflect,
    isLightScreen: s.lightScreen,
    isAuroraVeil: s.auroraVeil,
    isSR: s.stealthRock,
    spikes: s.spikes,
    isTailwind: s.tailwind,
    isHelpingHand: s.helpingHand,
    isFriendGuard: s.friendGuard,
  }
}

/** Construit le terrain du moteur ; attackerSide dit quelle équipe attaque. */
export function buildField(f: FieldState, attackerSide: SideKey = 'left', gameType: 'Singles' | 'Doubles' = 'Doubles'): Field {
  const atk = f[attackerSide]
  const def = f[attackerSide === 'left' ? 'right' : 'left']
  return new Field({
    gameType,
    weather: (f.weather || undefined) as never,
    terrain: (f.terrain || undefined) as never,
    isGravity: f.gravity,
    isMagicRoom: f.magicRoom,
    isWonderRoom: f.wonderRoom,
    attackerSide: buildSide(atk),
    defenderSide: buildSide(def),
  })
}

// ---------- Précision ----------

export interface AccuracyDetail {
  base: number | null // null = ne rate jamais
  effective: number // 0 à 100
  notes: string[] // ce qui a modifié la précision (clés de traduction)
}

export function effectiveAccuracy(
  moveName: string,
  attacker: Pokemon,
  defender: Pokemon,
  field: Field,
  accStage = 0,
  evaStage = 0,
): AccuracyDetail {
  const info = EXTRA.moves[moveName]
  const base = info ? info.acc : 100
  const notes: string[] = []
  if (base === null) return { base, effective: 100, notes }
  if (attacker.hasAbility('No Guard') || defender.hasAbility('No Guard')) {
    notes.push('acc.noGuard')
    return { base, effective: 100, notes }
  }
  if (['Thunder', 'Hurricane'].includes(moveName)) {
    if (field.hasWeather('Rain', 'Heavy Rain')) return { base, effective: 100, notes: ['acc.rain'] }
    if (field.hasWeather('Sun', 'Harsh Sunshine')) return { base, effective: 50, notes: ['acc.sun'] }
  }
  if (moveName === 'Blizzard' && field.hasWeather('Snow', 'Hail')) return { base, effective: 100, notes: ['acc.snow'] }
  if (moveName === 'Toxic' && attacker.hasType('Poison')) return { base, effective: 100, notes: [] }

  let acc = base
  const move = gen.moves.get(toID(moveName))
  if (attacker.hasAbility('Compound Eyes')) { acc *= 1.3; notes.push('acc.compoundEyes') }
  if (attacker.hasAbility('Victory Star')) { acc *= 1.1; notes.push('acc.victoryStar') }
  if (attacker.hasAbility('Hustle') && move?.category === 'Physical') { acc *= 0.8; notes.push('acc.hustle') }
  if (attacker.hasItem('Wide Lens')) { acc *= 1.1; notes.push('acc.wideLens') }
  if (attacker.hasItem('Zoom Lens') && attacker.stats.spe < defender.stats.spe) { acc *= 1.2; notes.push('acc.zoomLens') }
  if (field.isGravity) { acc *= 5 / 3; notes.push('acc.gravity') }
  if (defender.hasItem('Bright Powder', 'Lax Incense')) { acc *= 0.9; notes.push('acc.brightPowder') }
  if (defender.hasAbility('Sand Veil') && field.hasWeather('Sand')) { acc *= 0.8; notes.push('acc.sandVeil') }
  if (defender.hasAbility('Snow Cloak') && field.hasWeather('Snow', 'Hail')) { acc *= 0.8; notes.push('acc.snowCloak') }
  const evasion = attacker.hasAbility('Keen Eye', 'Mind\'s Eye', 'Illuminate') ? Math.min(0, evaStage) : evaStage
  const stage = Math.max(-6, Math.min(6, accStage - evasion))
  if (stage !== 0) {
    acc *= stage > 0 ? (3 + stage) / 3 : 3 / (3 - stage)
    notes.push('acc.stages')
  }
  return { base, effective: Math.min(100, Math.round(acc * 10) / 10), notes }
}

// ---------- Distributions de dégâts ----------

/** Distribution : dégâts -> probabilité. */
export type Dist = Map<number, number>

function uniform(rolls: number[]): Dist {
  const d: Dist = new Map()
  const p = 1 / rolls.length
  for (const r of rolls) d.set(r, (d.get(r) ?? 0) + p)
  return d
}

function convolve(a: Dist, b: Dist): Dist {
  const out: Dist = new Map()
  for (const [x, px] of a) for (const [y, py] of b) out.set(x + y, (out.get(x + y) ?? 0) + px * py)
  return out
}

function mix(a: Dist, pa: number, b: Dist, pb: number): Dist {
  const out: Dist = new Map()
  for (const [x, p] of a) out.set(x, (out.get(x) ?? 0) + p * pa)
  for (const [x, p] of b) out.set(x, (out.get(x) ?? 0) + p * pb)
  return out
}

function damageDist(damage: number | number[] | number[][]): Dist {
  if (typeof damage === 'number') return uniform([damage])
  if (damage.length === 0) return uniform([0])
  if (typeof damage[0] === 'number') return uniform(damage as number[])
  let d: Dist = uniform([0])
  for (const hit of damage as number[][]) d = convolve(d, uniform(hit))
  return d
}

function probAtLeast(d: Dist, threshold: number): number {
  let p = 0
  for (const [x, px] of d) if (x >= threshold) p += px
  return Math.min(1, p)
}

// ---------- Résultat par attaque ----------

export interface MoveResult {
  move: string
  /** Bloquée par Abri (aucun dégât) */
  blockedByProtect: boolean
  /** Passe à travers Abri grâce à... (clé de traduction) */
  protectBypass?: 'feint' | 'unseenFist'
  category: 'Physical' | 'Special' | 'Status'
  type: string
  basePower: number
  /** Nombre de coups (attaques multi-coups), 1 sinon */
  hits: number
  spread: boolean
  min: number
  max: number
  minPct: number
  maxPct: number
  maxHP: number
  curHP: number
  accuracy: AccuracyDetail
  critChance: number
  /** Taux de KO "à la Showdown" (rolls seulement, sans précision ni critique) pour 1..N attaques */
  koRollsOnly: number[]
  /** Vrai taux de KO (précision x rolls x critiques) pour 1..N attaques */
  koTrue: number[]
  desc: string
  rolls: number[]
  /** Dégâts min / max en cas de coup critique */
  critMin: number
  critMax: number
  /** Multiplicateur de type (0, 0.25, 0.5, 1, 2, 4) ; 0 aussi si l'attaque ne fait rien (immunité de talent) */
  effectiveness: number
}

export function critChanceFor(moveName: string, attacker: Pokemon, extraStage = 0): number {
  const move = gen.moves.get(toID(moveName))
  if (move?.willCrit) return 1
  if (attacker.hasAbility('Merciless')) return 1 // approximation : cible empoisonnée
  let stage = 0
  if (['Slash', 'Night Slash', 'Shadow Claw', 'Stone Edge', 'Cross Chop', 'Leaf Blade', 'Psycho Cut', 'Attack Order', 'Spacial Rend', 'Aeroblast', 'Air Cutter', 'Blaze Kick', 'Crabhammer', 'Cross Poison', 'Drill Run', 'Karate Chop', 'Poison Tail', 'Razor Leaf', 'Razor Wind', 'Sky Attack', 'Snipe Shot', 'Esper Wing', 'Triple Arrows', 'Ivy Cudgel', 'Aqua Cutter', 'Dire Claw'].includes(moveName)) stage += 1
  if (attacker.hasAbility('Super Luck')) stage += 1
  if (attacker.hasItem('Scope Lens', 'Razor Claw')) stage += 1
  stage += extraStage
  return [1 / 24, 1 / 8, 1 / 2, 1][Math.min(3, stage)]
}

/** Nombre de coups d'une attaque multi-coups pour le calcul : Dé Pipé garantit au moins 4 coups (2-5 coups et Bombe Pop),
    Multi-Coups en fait toujours 5 (déjà géré par le moteur). undefined = valeur par défaut du moteur (3 pour 2-5 coups). */
export function multiHitCount(moveName: string, attackerState: PokemonState): number | undefined {
  const info = gen.moves.get(toID(moveName))
  if (!info || !info.multihit) return undefined
  const range = Array.isArray(info.multihit) ? info.multihit : [info.multihit, info.multihit]
  if (attackerState.item === 'Loaded Dice' && effectiveAbility(attackerState) !== 'Skill Link' && range[1] >= 5) return moveName === 'Population Bomb' ? 4 : 4
  return undefined
}

/** Fourchette de dégâts rapide (un seul calcul, sans critique ni distribution) : pour les analyses en boucle. */
export function damageRange(
  moveName: string,
  attackerState: PokemonState,
  defenderState: PokemonState,
  fieldState: FieldState,
  attackerSide: SideKey = 'left',
  battle: { gameType?: 'Singles' | 'Doubles'; targetCount?: number } = {},
): { min: number; max: number; maxHP: number; curHP: number; accuracy: number | null } | null {
  const info = moveName ? gen.moves.get(toID(moveName)) : undefined
  if (!info || info.category === 'Status' || !attackerState.species || !defenderState.species) return null
  if (!gen.species.get(toID(attackerState.species)) || !gen.species.get(toID(defenderState.species))) return null
  const attacker = buildPokemon(attackerState)
  const defender = buildPokemon(defenderState)
  const gameType = battle.gameType ?? 'Doubles'
  const field = buildField(fieldState, attackerSide, gameType)
  const isSpreadMove = info.target === 'allAdjacentFoes' || info.target === 'allAdjacent'
  const singleTarget = gameType === 'Doubles' && isSpreadMove && (battle.targetCount ?? 2) <= 1
  const hits = multiHitCount(moveName, attackerState)
  const move = new Move(gen, moveName, { ability: attacker.ability, item: attacker.item, species: attacker.name, isCrit: false, ...(hits ? { hits } : {}), ...(singleTarget ? { overrides: { target: 'normal' as const } } : {}) })
  try {
    const r = calculate(gen, attacker, defender, move, field)
    const [min, max] = r.range()
    const acc = effectiveAccuracy(moveName, attacker, defender, field, attackerState.accStage ?? 0, defenderState.evaStage ?? 0)
    return { min, max, maxHP: defender.maxHP(), curHP: defender.curHP(), accuracy: acc.base === null ? null : acc.effective }
  } catch {
    return null
  }
}

export function computeMove(
  moveName: string,
  attackerState: PokemonState,
  defenderState: PokemonState,
  fieldState: FieldState,
  options: CalcOptions,
  attackerSide: SideKey = 'left',
  battle: { gameType?: 'Singles' | 'Doubles'; targetCount?: number; actChance?: number } = {},
): MoveResult | null {
  if (!moveName || !gen.moves.get(toID(moveName)) || !attackerState.species || !defenderState.species) return null
  if (!gen.species.get(toID(attackerState.species)) || !gen.species.get(toID(defenderState.species))) return null
  const attacker = buildPokemon(attackerState)
  const defender = buildPokemon(defenderState)
  const gameType = battle.gameType ?? 'Doubles'
  const field = buildField(fieldState, attackerSide, gameType)
  const info = gen.moves.get(toID(moveName))!
  // Attaque à cibles multiples mais une seule cible réelle : pas de x0,75 (les murs restent à 2/3 en Doubles)
  const isSpreadMove = info.target === 'allAdjacentFoes' || info.target === 'allAdjacent'
  const singleTarget = gameType === 'Doubles' && isSpreadMove && (battle.targetCount ?? 2) <= 1

  const hits = multiHitCount(moveName, attackerState)
  const run = (isCrit: boolean) => {
    const move = new Move(gen, moveName, {
      ability: attacker.ability, item: attacker.item, species: attacker.name, isCrit, ...(hits ? { hits } : {}),
      ...(singleTarget ? { overrides: { target: 'normal' as const } } : {}),
    })
    return calculate(gen, attacker.clone(), defender.clone(), move, field.clone())
  }

  // Abri : bloque tout sauf les attaques qui le percent (Ruse...) ou Poing Invisible / Transperceuse sur une attaque de contact
  let blockedByProtect = false
  let protectBypass: MoveResult['protectBypass']
  if (isProtecting(defenderState) && info.category !== 'Status') {
    if (info.breaksProtect) protectBypass = 'feint'
    else if (attacker.hasAbility('Unseen Fist', 'Piercing Drill') && info.flags?.contact) protectBypass = 'unseenFist'
    else blockedByProtect = true
  }

  const normal = run(false)
  const maxHP = defender.maxHP()
  const curHP = defender.curHP()
  const [min, max] = normal.range()

  const critChance = options.critMode === 'never' ? 0 : options.critMode === 'always' ? 1 : critChanceFor(moveName, attacker, attackerState.critStage ?? 0)
  const distNormal = damageDist(normal.damage)
  let distOne = distNormal
  if (critChance > 0) {
    const crit = run(true)
    distOne = critChance >= 1 ? damageDist(crit.damage) : mix(distNormal, 1 - critChance, damageDist(crit.damage), critChance)
  }

  const acc = effectiveAccuracy(moveName, attacker, defender, field, attackerState.accStage ?? 0, defenderState.evaStage ?? 0)
  // Chance que l'attaque parte ET touche : (chance d'agir : apeuré, paralysie totale, sommeil, gel) x précision
  const hitP = (options.useAccuracy ? acc.effective / 100 : 1) * (battle.actChance ?? 1)
  const distOneWithMiss: Dist = hitP >= 1 ? distOne : mix(uniform([0]), 1 - hitP, distOne, hitP)

  const koRollsOnly: number[] = []
  const koTrue: number[] = []
  let accRolls: Dist = uniform([0])
  let accTrue: Dist = uniform([0])
  for (let n = 1; n <= options.maxTurns; n++) {
    accRolls = convolve(accRolls, distNormal)
    accTrue = convolve(accTrue, distOneWithMiss)
    koRollsOnly.push(probAtLeast(accRolls, curHP))
    koTrue.push(probAtLeast(accTrue, curHP))
  }

  const rolls = typeof normal.damage === 'number' ? [normal.damage] : Array.isArray(normal.damage[0]) ? [] : (normal.damage as number[])

  let desc = ''
  try {
    desc = normal.fullDesc('%', false)
  } catch {
    desc = normal.desc()
  }

  const displayCrit = options.critMode === 'always' ? run(true) : null
  const [dmin, dmax] = displayCrit ? displayCrit.range() : [min, max]
  const critRun = run(true)
  const [critMin, critMax] = critRun.range()
  const effectiveness = typeEffectiveness(normal.move.type, defender, max)

  if (blockedByProtect) {
    return {
      move: moveName, blockedByProtect, protectBypass,
      category: (info.category ?? 'Status') as MoveResult['category'], type: normal.move.type, basePower: normal.rawDesc.moveBP ?? normal.move.bp, hits: normal.move.hits ?? 1,
      spread: false, min: 0, max: 0, minPct: 0, maxPct: 0, maxHP, curHP, accuracy: acc, critChance,
      koRollsOnly: koRollsOnly.map(() => 0), koTrue: koTrue.map(() => 0), desc: '', rolls: [], critMin: 0, critMax: 0, effectiveness,
    }
  }

  return {
    move: moveName,
    blockedByProtect,
    protectBypass,
    category: (info.category ?? 'Status') as MoveResult['category'],
    type: normal.move.type,
    hits: normal.move.hits ?? 1,
    basePower: normal.rawDesc.moveBP ?? normal.move.bp, // puissance réelle (Balayage, Noeud Herbe, Tacle Lourd... dépendent de la cible)
    spread: gameType === 'Doubles' && isSpreadMove && !singleTarget,
    min: dmin,
    max: dmax,
    minPct: Math.floor((dmin / maxHP) * 1000) / 10,
    maxPct: Math.floor((dmax / maxHP) * 1000) / 10,
    maxHP,
    curHP,
    accuracy: acc,
    critChance,
    koRollsOnly,
    koTrue,
    desc,
    rolls,
    critMin,
    critMax,
    effectiveness,
  }
}

/** Multiplicateur de type d'une attaque sur un défenseur (Téra pris en compte) ; 0 si les dégâts sont nuls. */
export function typeEffectiveness(moveType: string, defender: Pokemon, maxDamage: number): number {
  if (maxDamage <= 0) return 0
  const atkType = gen.types.get(toID(moveType))
  if (!atkType) return 1
  const defTypes: string[] = defender.teraType ? [defender.teraType] : (defender.types as string[])
  let mult = 1
  for (const ty of defTypes) mult *= atkType.effectiveness[ty as never] ?? 1
  return mult
}

// ---------- Vitesse ----------

export interface SpeedInfo {
  attacker: number
  defender: number
  /** Qui agit en premier : -1 le défenseur, 0 égalité, 1 l'attaquant (priorité puis vitesse, Distorsion prise en compte) */
  winner: -1 | 0 | 1
  /** Verdict sur la vitesse seule */
  speedWinner: -1 | 0 | 1
  ratio: number // vitesse attaquant / vitesse défenseur
  attackerPriority: number
  defenderPriority: number
  attackerMove: string
  defenderMove: string
}

const BOOST: Record<number, number> = { [-6]: 2 / 8, [-5]: 2 / 7, [-4]: 2 / 6, [-3]: 2 / 5, [-2]: 2 / 4, [-1]: 2 / 3, 0: 1, 1: 1.5, 2: 2, 3: 2.5, 4: 3, 5: 3.5, 6: 4 }

export function effectiveSpeed(p: Pokemon, state: PokemonState, side: SideState, field: FieldState): number {
  let spe = p.rawStats.spe
  spe = Math.floor(spe * BOOST[state.boosts.spe ?? 0])
  if (p.hasItem('Choice Scarf')) spe = Math.floor(spe * 1.5)
  if (p.hasItem('Iron Ball')) spe = Math.floor(spe * 0.5)
  if (p.hasAbility('Swift Swim') && (field.weather === 'Rain')) spe *= 2
  if (p.hasAbility('Chlorophyll') && field.weather === 'Sun') spe *= 2
  if (p.hasAbility('Sand Rush') && field.weather === 'Sand') spe *= 2
  if (p.hasAbility('Slush Rush') && field.weather === 'Snow') spe *= 2
  if (p.hasAbility('Surge Surfer') && field.terrain === 'Electric') spe *= 2
  if (p.hasAbility('Quick Feet') && state.status) spe = Math.floor(spe * 1.5)
  else if (state.status === 'par') spe = Math.floor(spe * 0.5)
  if (side.tailwind) spe *= 2
  return spe
}

/** Attaques qui protègent (Abri et ses variantes). */
export const PROTECT_MOVES = ['Protect', 'Detect', 'Spiky Shield', 'Baneful Bunker', 'Burning Bulwark', "King's Shield", 'Obstruct', 'Silk Trap', 'Max Guard']

/** Le Pokémon protège-t-il ce tour ? (case Abri cochée, ou attaque mise en avant = Abri) */
export function isProtecting(p: PokemonState): boolean {
  return !!p.protect || PROTECT_MOVES.includes(p.moves[p.activeMove ?? 0] ?? '')
}

/** Priorité d'une attaque pour ce Pokémon (Farceur, Ailes Bourrasque, Triage...). */
export function movePriority(p: PokemonState, moveName: string, curHPFull = true): number {
  if (!moveName) return 0
  const info = gen.moves.get(toID(moveName))
  if (!info) return 0
  let prio = EXTRA.moves[moveName]?.prio ?? info.priority ?? 0
  const mon = buildPokemon(p)
  if (mon.hasAbility('Prankster') && info.category === 'Status') prio += 1
  if (mon.hasAbility('Gale Wings') && info.type === 'Flying' && curHPFull) prio += 1
  if (mon.hasAbility('Triage') && info.drain) prio += 3
  if (moveName === 'Grassy Glide') prio += 0 // géré par le terrain ci-dessous
  return prio
}

export function speedInfo(a: PokemonState, d: PokemonState, f: FieldState, attackerSide: SideKey = 'left'): SpeedInfo | null {
  if (!a.species || !d.species || !gen.species.get(toID(a.species)) || !gen.species.get(toID(d.species))) return null
  const pa = buildPokemon(a)
  const pd = buildPokemon(d)
  const sa = effectiveSpeed(pa, a, f[attackerSide], f)
  const sd = effectiveSpeed(pd, d, f[attackerSide === 'left' ? 'right' : 'left'], f)
  let winner: -1 | 0 | 1 = sa === sd ? 0 : sa > sd ? 1 : -1
  if (f.trickRoom && winner !== 0) winner = winner === 1 ? -1 : 1
  const am = a.moves[a.activeMove ?? 0] ?? ''
  const dm = d.moves[d.activeMove ?? 0] ?? ''
  let pa1 = movePriority(a, am, a.curHPPercent >= 100)
  let pd1 = movePriority(d, dm, d.curHPPercent >= 100)
  if (f.terrain === 'Grassy') { if (am === 'Grassy Glide') pa1 += 1; if (dm === 'Grassy Glide') pd1 += 1 }
  const byPriority: -1 | 0 | 1 = pa1 === pd1 ? 0 : pa1 > pd1 ? 1 : -1
  const finalWinner = byPriority !== 0 ? byPriority : winner
  return { attacker: sa, defender: sd, winner: finalWinner, speedWinner: winner, ratio: sd === 0 ? 99 : sa / sd, attackerPriority: pa1, defenderPriority: pd1, attackerMove: am, defenderMove: dm }
}

export function finalStats(p: PokemonState): Record<StatKey, number> {
  if (!p.species || !gen.species.get(toID(p.species))) return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const mon = buildPokemon(p)
  return { ...mon.rawStats }
}
