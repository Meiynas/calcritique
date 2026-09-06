// Modèle de données de Calcritique : ce que l'utilisateur règle à l'écran.
// Tout est sérialisable (sauvegarde locale, liens partageables plus tard).

export type Lang = 'fr' | 'en'

export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']

export type StatusKey = '' | 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz'

export type SideKey = 'left' | 'right'
export const TEAM_SIZE = 6

export interface PokemonState {
  species: string // nom anglais du moteur, ex "Kingambit" ; '' = emplacement vide
  nature: string // ex "Adamant"
  sp: Record<StatKey, number> // Points de Stat, 0 à 32 chacun, 66 max au total
  item: string
  ability: string
  teraType: string // '' = pas de Téracristal actif
  moves: string[] // 4 noms d'attaques (anglais), '' si vide
  boosts: Record<StatKey, number> // -6 à +6 (hp ignoré)
  status: StatusKey
  curHPPercent: number // 1 à 100
  accStage: number // stade de précision, -6 à +6
  evaStage: number // stade d'esquive, -6 à +6
  critStage: number // bonus de coup critique (0 à 3), ex : Focus Energy = +2
  protect: boolean // utilise Abri ce tour (pour Ruse, Poing Invisible...)
  activeMove: number // attaque mise en avant dans les résultats (0 à 3)
  /** Cible de l'attaque mise en avant (2v2) : emplacement dans l'équipe adverse, ou allié ('ally'). null = cible par défaut */
  target: number | 'ally' | null
}

/** Effets propres à un côté du terrain (une équipe). */
export interface SideState {
  reflect: boolean
  lightScreen: boolean
  auroraVeil: boolean
  tailwind: boolean
  helpingHand: boolean
  friendGuard: boolean
  // Pièges posés SUR ce côté (subis par cette équipe)
  stealthRock: boolean
  spikes: number // 0 à 3
  toxicSpikes: number // 0 à 2
  stickyWeb: boolean
}

export interface FieldState {
  weather: '' | 'Sun' | 'Rain' | 'Sand' | 'Snow'
  terrain: '' | 'Electric' | 'Grassy' | 'Psychic' | 'Misty'
  gravity: boolean
  trickRoom: boolean
  magicRoom: boolean
  wonderRoom: boolean
  left: SideState
  right: SideState
}

export interface CalcOptions {
  critMode: 'chance' | 'never' | 'always' // "chance" = on intègre le 1/24 (ou 1/8) dans le taux de KO
  useAccuracy: boolean // vrai taux de KO (précision incluse)
  maxTurns: number // jusqu'à combien de coups on regarde (1 à 4)
}

export type BattleMode = '1v1' | '2v2'

export interface AppState {
  lang: Lang
  mode: BattleMode
  teams: Record<SideKey, PokemonState[]>
  selected: Record<SideKey, number> // index du Pokémon en cours d'édition dans chaque équipe
  active: Record<SideKey, number[]> // Pokémon sur le terrain (1 en 1v1, 2 en 2v2), dans l'ordre d'entrée
  field: FieldState
  options: CalcOptions
}

export function activeCount(mode: BattleMode): number {
  return mode === '2v2' ? 2 : 1
}

export const zeroStats = (): Record<StatKey, number> => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })

export function defaultPokemon(species: string, overrides: Partial<PokemonState> = {}): PokemonState {
  return {
    species,
    nature: 'Serious',
    sp: zeroStats(),
    item: '',
    ability: '',
    teraType: '',
    moves: ['', '', '', ''],
    boosts: zeroStats(),
    status: '',
    curHPPercent: 100,
    accStage: 0,
    evaStage: 0,
    critStage: 0,
    protect: false,
    activeMove: 0,
    target: null,
    ...overrides,
  }
}

export const emptyPokemon = (): PokemonState => defaultPokemon('')

export const defaultSide = (): SideState => ({
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  tailwind: false,
  helpingHand: false,
  friendGuard: false,
  stealthRock: false,
  spikes: 0,
  toxicSpikes: 0,
  stickyWeb: false,
})

export const defaultField = (): FieldState => ({
  weather: '',
  terrain: '',
  gravity: false,
  trickRoom: false,
  magicRoom: false,
  wonderRoom: false,
  left: defaultSide(),
  right: defaultSide(),
})

/** Équipes de départ (pool Champions) ; les sets sont remplis à partir des statistiques d'usage. */
export const STARTER_SPECIES: Record<SideKey, string[]> = {
  left: ['Kingambit', 'Sneasler', 'Incineroar'],
  right: ['Garchomp', 'Whimsicott', 'Sinistcha'],
}

export type SetBuilder = (species: string) => PokemonState

function starterTeams(build: SetBuilder): Record<SideKey, PokemonState[]> {
  const make = (names: string[]) => {
    const team = names.map((n) => build(n))
    while (team.length < TEAM_SIZE) team.push(emptyPokemon())
    return team
  }
  return { left: make(STARTER_SPECIES.left), right: make(STARTER_SPECIES.right) }
}

export function defaultState(build: SetBuilder = (sp) => defaultPokemon(sp)): AppState {
  return {
    lang: 'fr',
    mode: '2v2',
    teams: starterTeams(build),
    selected: { left: 0, right: 0 },
    active: { left: [0, 1], right: [0, 1] },
    field: defaultField(),
    options: { critMode: 'chance', useAccuracy: true, maxTurns: 4 },
  }
}

export function otherSide(s: SideKey): SideKey {
  return s === 'left' ? 'right' : 'left'
}

/** Met un Pokémon sur le terrain : remplace le plus ancien si le terrain est plein. */
export function putActive(active: number[], index: number, max: number): number[] {
  if (active.includes(index)) return active
  const next = [...active, index]
  while (next.length > max) next.shift()
  return next
}

/** Place un Pokémon à la position A (0) ou B (1) du terrain ; échange s'il occupait l'autre position. */
export function setActiveSlot(active: number[], pos: number, index: number, max: number): number[] {
  const next = active.slice(0, max)
  const other = next.indexOf(index)
  if (other === pos) return next
  const prev = next[pos]
  next[pos] = index
  if (other >= 0) next[other] = prev
  return next.filter((n) => n !== undefined)
}

const STORAGE_KEY = 'calcritique.state.v4'

function fixTeam(team: unknown): PokemonState[] {
  const arr = Array.isArray(team) ? (team as Partial<PokemonState>[]) : []
  const out: PokemonState[] = []
  for (let i = 0; i < TEAM_SIZE; i++) out.push({ ...emptyPokemon(), ...(arr[i] ?? {}) })
  return out
}

export function loadState(build?: SetBuilder): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState(build)
    const parsed = JSON.parse(raw) as Partial<AppState>
    const base = defaultState()
    const teams = { left: fixTeam(parsed.teams?.left), right: fixTeam(parsed.teams?.right) }
    const sel = (n: unknown) => (typeof n === 'number' && n >= 0 && n < TEAM_SIZE ? n : 0)
    return {
      lang: parsed.lang === 'en' ? 'en' : 'fr',
      teams,
      mode: parsed.mode === '1v1' ? '1v1' : '2v2',
      selected: { left: sel(parsed.selected?.left), right: sel(parsed.selected?.right) },
      active: {
        left: Array.isArray(parsed.active?.left) ? parsed.active!.left.filter((n) => typeof n === 'number' && n >= 0 && n < TEAM_SIZE).slice(-2) : [0],
        right: Array.isArray(parsed.active?.right) ? parsed.active!.right.filter((n) => typeof n === 'number' && n >= 0 && n < TEAM_SIZE).slice(-2) : [0],
      },
      field: {
        ...base.field,
        ...parsed.field,
        left: { ...base.field.left, ...parsed.field?.left },
        right: { ...base.field.right, ...parsed.field?.right },
      },
      options: { ...base.options, ...parsed.options },
    }
  } catch {
    return defaultState(build)
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // stockage indisponible : on continue sans sauvegarde
  }
}
