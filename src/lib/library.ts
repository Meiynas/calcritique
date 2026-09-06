// Bibliothèque de sets et d'équipes de l'utilisateur.
// Stockage : localStorage du navigateur / de l'application (dans le logiciel Windows, c'est le dossier de données
// de l'application : ça survit aux redémarrages et aux mises à jour). Export / import en fichier JSON pour sauvegarder.
import type { PokemonState } from '../model'
import { defaultPokemon } from '../model'

export interface SavedSet {
  id: string
  name: string
  pokemon: PokemonState
  createdAt: number
}
export interface SavedTeam {
  id: string
  name: string
  team: PokemonState[]
  createdAt: number
}
export interface Library {
  sets: SavedSet[]
  teams: SavedTeam[]
}

export const LIBRARY_KEY = 'calcritique.library.v1'

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Nettoie un Pokémon importé (champs manquants, valeurs hors bornes) */
function fixPokemon(p: unknown): PokemonState {
  const src = (p && typeof p === 'object' ? p : {}) as Partial<PokemonState>
  const base = defaultPokemon(typeof src.species === 'string' ? src.species : '')
  const out: PokemonState = { ...base, ...src, species: base.species }
  out.moves = Array.isArray(src.moves) ? [0, 1, 2, 3].map((i) => (typeof src.moves![i] === 'string' ? src.moves![i] : '')) : base.moves
  out.sp = { ...base.sp, ...(src.sp ?? {}) }
  out.boosts = { ...base.boosts, ...(src.boosts ?? {}) }
  // Un set enregistré est "propre" : pas de PV entamés ni de boosts de combat
  out.curHPPercent = 100
  out.status = ''
  out.protect = false
  out.leechSeed = false
  out.leechSeeder = null
  return out
}

export function fixLibrary(raw: unknown): Library {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Library>
  const sets = Array.isArray(r.sets)
    ? r.sets.filter((s) => s && typeof s === 'object').map((s) => ({ id: typeof s.id === 'string' ? s.id : newId(), name: String(s.name ?? ''), pokemon: fixPokemon(s.pokemon), createdAt: Number(s.createdAt) || Date.now() }))
    : []
  const teams = Array.isArray(r.teams)
    ? r.teams.filter((t) => t && typeof t === 'object').map((t) => ({ id: typeof t.id === 'string' ? t.id : newId(), name: String(t.name ?? ''), team: [0, 1, 2, 3, 4, 5].map((i) => fixPokemon(Array.isArray(t.team) ? t.team[i] : undefined)), createdAt: Number(t.createdAt) || Date.now() }))
    : []
  return { sets, teams }
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    return raw ? fixLibrary(JSON.parse(raw)) : { sets: [], teams: [] }
  } catch {
    return { sets: [], teams: [] }
  }
}

export function saveLibrary(lib: Library): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib))
  } catch {
    // stockage indisponible
  }
}

/** Set "propre" à partir d'un Pokémon de l'équipe (PV, statut et boosts remis à zéro) */
export function cleanSet(p: PokemonState): PokemonState {
  return fixPokemon({ ...p, boosts: undefined, accStage: 0, evaStage: 0, critStage: 0, activeMove: 0, target: null })
}

/** Fusionne une bibliothèque importée : les ids déjà présents sont remplacés, les autres ajoutés */
export function mergeLibrary(current: Library, imported: Library): Library {
  const sets = [...current.sets]
  for (const s of imported.sets) {
    const i = sets.findIndex((x) => x.id === s.id)
    if (i >= 0) sets[i] = s
    else sets.push(s)
  }
  const teams = [...current.teams]
  for (const t of imported.teams) {
    const i = teams.findIndex((x) => x.id === t.id)
    if (i >= 0) teams[i] = t
    else teams.push(t)
  }
  return { sets, teams }
}

export function exportLibraryJSON(lib: Library): string {
  return JSON.stringify({ app: 'calcritique', version: 1, exportedAt: new Date().toISOString(), ...lib }, null, 2)
}

/** Déclenche le téléchargement d'un fichier texte */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
