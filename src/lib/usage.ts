// Statistiques d'usage (Champions Battle Data) et learnsets Champions (Pokémon Showdown, régulation en cours).
// Sert aux presets (set le plus joué), aux suggestions (attaques, objets, coéquipiers)
// et au pool légal.

import { toID } from '@smogon/calc'
import usageJson from '../data/usage.json'
import learnsetsJson from '../data/learnsets.json'
import { NAMES } from './names'
import { speciesInfo, moveInfo, megaAbility, EXTRA } from './engine'
import { emptyPokemon, type PokemonState, type StatKey } from '../model'
import { gen } from './gen'

export interface UsageEntry {
  name: string
  moves: [string, number][]
  items: [string, number][]
  abilities: [string, number][]
  natures: [string, number][]
  /** [hp, atk, def, spa, spd, spe, %] */
  spreads: number[][]
  teammates: string[]
}
interface UsageFile {
  season: string
  date: string
  source: string
  data: Record<string, UsageEntry>
}
export const USAGE = usageJson as unknown as UsageFile
export const LEARNSETS = learnsetsJson as Record<string, string[]>

const KEY_ALIASES: Record<string, string> = { aegislash: 'aegislashshield' }

/** Clé d'usage d'une espèce du moteur (les Méga renvoient à leur forme de base). */
export function usageKey(species: string): string {
  const info = speciesInfo(species)
  const base = info?.baseSpecies && species.includes('-Mega') ? info.baseSpecies : species
  let id: string = toID(base)
  for (const [k, v] of Object.entries(KEY_ALIASES)) if (v === id) id = k
  return id
}

export function usageFor(species: string): UsageEntry | undefined {
  if (!species) return undefined
  return USAGE.data[usageKey(species)]
}

// Nom d'affichage des stats -> clé du moteur (ex : "Basculegion Male" -> "basculegion")
const NAME_TO_KEY: Record<string, string> = {}
for (const [k, e] of Object.entries(USAGE.data)) NAME_TO_KEY[e.name] = k
if (USAGE.data.mausholdfour && !USAGE.data.maushold) NAME_TO_KEY['Maushold'] = 'mausholdfour'

// Clé d'usage -> nom d'espèce du moteur
const KEY_TO_SPECIES: Record<string, string> = {}
for (const s of Object.keys(LEARNSETS)) {
  const id = toID(s)
  if (USAGE.data[id]) KEY_TO_SPECIES[id] = s
}
for (const [k, v] of Object.entries(KEY_ALIASES)) if (LEARNSETS[v] || speciesInfo(v)) KEY_TO_SPECIES[k] = speciesInfo(v)?.name ?? v
for (const k of Object.keys(USAGE.data)) {
  if (!KEY_TO_SPECIES[k]) {
    const sp = gen.species.get(toID(k))
    if (sp) KEY_TO_SPECIES[k] = sp.name
  }
}

export function speciesFromUsageName(name: string): string | undefined {
  const k = NAME_TO_KEY[name]
  return k ? KEY_TO_SPECIES[k] : undefined
}

const COSMETIC = /-(Original|Hoenn|Sinnoh|Unova|Kalos|Partner|World|Totem|Gmax|Antique|Masterpiece|Bond|Pokeball)$|Busted/

/** Pool légal Champions : Pokémon avec un learnset Champions (formes cosmétiques exclues), Méga incluses. */
export const LEGAL_SPECIES: string[] = Object.keys(LEARNSETS)
  .filter((s) => speciesInfo(s) && !COSMETIC.test(s))
  .sort((a, b) => a.localeCompare(b))

export function isLegal(species: string): boolean {
  return !!LEARNSETS[species]
}

export function canLearn(species: string, move: string): boolean {
  const ls = LEARNSETS[species]
  if (!ls) {
    const base = speciesInfo(species)?.baseSpecies
    return base ? (LEARNSETS[base]?.includes(move) ?? false) : false
  }
  return ls.includes(move)
}

export function learnset(species: string): string[] {
  const ls = LEARNSETS[species]
  if (ls) return ls
  const base = speciesInfo(species)?.baseSpecies
  return base ? (LEARNSETS[base] ?? []) : []
}

/** Attaques les plus jouées, hors celles déjà choisies. */
export function topMoves(species: string, exclude: string[] = [], limit = 10): [string, number][] {
  const u = usageFor(species)
  if (!u) return []
  return u.moves.filter(([m]) => !exclude.includes(m) && moveInfo(m)).slice(0, limit)
}

export function topItems(species: string, limit = 10): [string, number][] {
  const u = usageFor(species)
  if (!u) return []
  return u.items.filter(([i]) => NAMES.items[i]).slice(0, limit)
}

export function usagePercent(species: string, kind: 'moves' | 'items' | 'abilities' | 'natures', name: string): number | undefined {
  const u = usageFor(species)
  const row = u?.[kind].find(([n]) => n === name)
  return row?.[1]
}

/** Méga que donne cette pierre à cette espèce (Carchacrokite Z + Carchacrok -> Méga-Carchacrok Z), sinon null. */
export function megaFormeFor(species: string, item: string): string | null {
  if (!species || !item || species.includes('-Mega')) return null
  const stone = (gen.items.get(toID(item)) as { megaStone?: Record<string, string> } | undefined)?.megaStone
  const forme = stone?.[species]
  return forme && forme.includes('-Mega') ? forme : null
}

/** Pierre qui donne cette Méga (Méga-Carchacrok Z -> Carchacrokite Z), sinon null. */
export function megaStoneFor(megaSpecies: string): string | null {
  if (!megaSpecies.includes('-Mega')) return null
  for (const it of gen.items as Iterable<{ name: string; megaStone?: Record<string, string> }>) {
    if (it.megaStone && Object.values(it.megaStone).includes(megaSpecies)) return it.name
  }
  return null
}

function isMegaStone(item: string): boolean {
  return !!(gen.items.get(toID(item)) as { megaStone?: unknown } | undefined)?.megaStone
}

/** Talent à donner à la forme normale : le plus joué s'il est possible pour l'espèce, sinon son premier talent. */
function baseAbility(species: string): string {
  const possible = EXTRA.species[species]?.abilities?.length
    ? EXTRA.species[species].abilities
    : Object.values((speciesInfo(species)?.abilities ?? {}) as Record<string, string>)
  const played = usageFor(species)?.abilities.find(([a]) => !possible.length || possible.includes(a))?.[0]
  return played ?? possible[0] ?? ''
}

/**
 * Change l'objet en gardant la forme cohérente :
 * - une Méga qui perd sa pierre (ou en prend une autre) redevient le Pokémon normal ;
 * - un Pokémon normal qui reçoit sa pierre Méga passe en forme Méga.
 */
export function withItem(p: PokemonState, item: string): PokemonState {
  if (p.species.includes('-Mega')) {
    if (item && megaStoneFor(p.species) === item) return { ...p, item }
    const base = speciesInfo(p.species)?.baseSpecies
    const mega = base ? megaFormeFor(base, item) : null
    if (mega) return { ...p, item, species: mega, ability: megaAbility(mega) ?? p.ability }
    if (!base) return { ...p, item }
    return { ...p, item, species: base, ability: baseAbility(base) }
  }
  const mega = megaFormeFor(p.species, item)
  if (mega) return { ...p, item, species: mega, ability: megaAbility(mega) ?? p.ability }
  return { ...p, item }
}

/**
 * Le set le plus joué : nature, spread, objet, talent, 4 attaques. La forme choisie est respectée :
 * une Méga reçoit sa pierre, un Pokémon normal reçoit l'objet le plus joué qui n'est pas une pierre Méga.
 */
export function mostPlayedSet(species: string): PokemonState {
  const u = usageFor(species)
  const base = emptyPokemon()
  const isMega = species.includes('-Mega')
  const stone = isMega ? megaStoneFor(species) ?? '' : ''
  if (!u) return { ...base, species, item: stone, ability: megaAbility(species) ?? baseAbility(species) }
  const nature = u.natures[0]?.[0] ?? 'Serious'
  const sp0 = u.spreads[0]
  const sp: Record<StatKey, number> = sp0
    ? { hp: sp0[0], atk: sp0[1], def: sp0[2], spa: sp0[3], spd: sp0[4], spe: sp0[5] }
    : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const item = isMega ? stone : (u.items.find(([i]) => NAMES.items[i] && !isMegaStone(i))?.[0] ?? '')
  const ability = isMega ? megaAbility(species) ?? '' : baseAbility(species)
  const moves = u.moves.filter(([m]) => moveInfo(m)).slice(0, 4).map(([m]) => m)
  while (moves.length < 4) moves.push('')
  return { ...base, species, nature, sp, item, ability, moves }
}

/** Score de coéquipiers : pour chaque membre de l'équipe, ses 10 partenaires les plus fréquents (rang 1 = 10 points). */
export function teammateScores(team: string[]): { species: string; score: number; from: string[] }[] {
  const scores = new Map<string, { score: number; from: Set<string> }>()
  const present = new Set(team.filter(Boolean).map((s) => usageKey(s)))
  for (const member of team) {
    const u = usageFor(member)
    if (!u) continue
    u.teammates.forEach((name, i) => {
      const sp = speciesFromUsageName(name)
      if (!sp || present.has(usageKey(sp))) return
      const e = scores.get(sp) ?? { score: 0, from: new Set<string>() }
      e.score += 10 - i
      e.from.add(member)
      scores.set(sp, e)
    })
  }
  return [...scores.entries()]
    .map(([species, e]) => ({ species, score: e.score, from: [...e.from] }))
    .sort((a, b) => b.score - a.score)
}

export function usageRank(species: string): number {
  // Approximation du "taux d'usage" global : position dans les listes de partenaires
  let n = 0
  const key = usageKey(species)
  for (const e of Object.values(USAGE.data)) {
    const i = e.teammates.findIndex((t) => NAME_TO_KEY[t] === key)
    if (i >= 0) n += 10 - i
  }
  return n
}

