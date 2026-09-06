// Statistiques d'usage (Champions Battle Data) et learnsets Champions (PokéAPI).
// Sert aux presets (set le plus joué), aux suggestions (attaques, objets, coéquipiers)
// et au pool légal.

import { Pokemon, toID } from '@smogon/calc'
import usageJson from '../data/usage.json'
import learnsetsJson from '../data/learnsets.json'
import { NAMES } from './names'
import { speciesInfo, moveInfo, megaAbility } from './engine'
import { emptyPokemon, type PokemonState, type StatKey } from '../model'
import { Generations } from '@smogon/calc'

const gen = Generations.get(9)

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
NAME_TO_KEY['Maushold'] = 'mausholdfour'

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

/** Le set le plus joué : nature, spread, objet, talent, 4 attaques. Passe en forme Méga si la pierre est l'objet numéro 1. */
export function mostPlayedSet(species: string): PokemonState {
  const u = usageFor(species)
  const base = emptyPokemon()
  if (!u) return { ...base, species }
  const nature = u.natures[0]?.[0] ?? 'Serious'
  const sp0 = u.spreads[0]
  const sp: Record<StatKey, number> = sp0
    ? { hp: sp0[0], atk: sp0[1], def: sp0[2], spa: sp0[3], spd: sp0[4], spe: sp0[5] }
    : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const item = u.items.find(([i]) => NAMES.items[i])?.[0] ?? ''
  const ability = u.abilities[0]?.[0] ?? ''
  const moves = u.moves.filter(([m]) => moveInfo(m)).slice(0, 4).map(([m]) => m)
  while (moves.length < 4) moves.push('')
  let finalSpecies = species
  if (item && !species.includes('-Mega')) {
    try {
      const forme = Pokemon.getForme(gen, species, item as never)
      if (forme && forme !== species && forme.includes('-Mega')) finalSpecies = forme
    } catch {
      /* pas de forme spéciale */
    }
  }
  return { ...base, species: finalSpecies, nature, sp, item, ability: megaAbility(finalSpecies) ?? ability, moves }
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

