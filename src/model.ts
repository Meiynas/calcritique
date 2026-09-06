// Modèle de données de Calcritique : ce que l'utilisateur règle à l'écran.
// Tout est sérialisable (sauvegarde locale, liens partageables plus tard).

export type Lang = 'fr' | 'en'

export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']

export type StatusKey = '' | 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz'

export interface PokemonState {
  species: string // nom anglais du moteur, ex "Kingambit"
  nature: string // ex "Adamant"
  sp: Record<StatKey, number> // Points de Stat, 0 à 32 chacun, 66 max au total
  item: string
  ability: string
  teraType: string // '' = pas de Téracristal actif
  moves: string[] // 4 noms d'attaques (anglais), '' si vide
  boosts: Record<StatKey, number> // -6 à +6 (hp ignoré)
  status: StatusKey
  curHPPercent: number // 1 à 100
}

export interface SideState {
  reflect: boolean
  lightScreen: boolean
  auroraVeil: boolean
  stealthRock: boolean
  spikes: number // 0 à 3
  tailwind: boolean
  helpingHand: boolean
  friendGuard: boolean
  protected: boolean
}

export interface FieldState {
  weather: '' | 'Sun' | 'Rain' | 'Sand' | 'Snow'
  terrain: '' | 'Electric' | 'Grassy' | 'Psychic' | 'Misty'
  gravity: boolean
  trickRoom: boolean
  magicRoom: boolean
  wonderRoom: boolean
  attackerSide: SideState
  defenderSide: SideState
}

export interface CalcOptions {
  critMode: 'chance' | 'never' | 'always' // "chance" = on intègre le 1/24 (ou 1/8) dans le taux de KO
  useAccuracy: boolean // vrai taux de KO (précision incluse)
  maxTurns: number // jusqu'à combien de coups on regarde (1 à 4)
}

export interface AppState {
  lang: Lang
  attacker: PokemonState
  defender: PokemonState
  field: FieldState
  options: CalcOptions
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
    ...overrides,
  }
}

export const defaultSide = (): SideState => ({
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  stealthRock: false,
  spikes: 0,
  tailwind: false,
  helpingHand: false,
  friendGuard: false,
  protected: false,
})

export const defaultField = (): FieldState => ({
  weather: '',
  terrain: '',
  gravity: false,
  trickRoom: false,
  magicRoom: false,
  wonderRoom: false,
  attackerSide: defaultSide(),
  defenderSide: defaultSide(),
})

export function defaultState(): AppState {
  return {
    lang: 'fr',
    attacker: defaultPokemon('Kingambit', {
      nature: 'Adamant',
      sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
      item: 'Black Glasses',
      ability: 'Supreme Overlord',
      moves: ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'],
    }),
    defender: defaultPokemon('Rillaboom', {
      nature: 'Adamant',
      sp: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 },
      item: 'Assault Vest',
      ability: 'Grassy Surge',
      moves: ['Wood Hammer', 'Grassy Glide', 'Fake Out', 'U-turn'],
    }),
    field: defaultField(),
    options: { critMode: 'chance', useAccuracy: true, maxTurns: 4 },
  }
}

const STORAGE_KEY = 'calcritique.state.v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    const base = defaultState()
    return {
      lang: parsed.lang === 'en' ? 'en' : 'fr',
      attacker: { ...base.attacker, ...parsed.attacker },
      defender: { ...base.defender, ...parsed.defender },
      field: {
        ...base.field,
        ...parsed.field,
        attackerSide: { ...base.field.attackerSide, ...parsed.field?.attackerSide },
        defenderSide: { ...base.field.defenderSide, ...parsed.field?.defenderSide },
      },
      options: { ...base.options, ...parsed.options },
    }
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // stockage indisponible : on continue sans sauvegarde
  }
}
