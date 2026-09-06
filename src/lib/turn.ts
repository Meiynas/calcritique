// Déroulé d'un tour : les Pokémon sur le terrain agissent dans l'ordre (priorité, puis Vitesse,
// Distorsion, Vent Arrière), chacun avec son attaque mise en avant et sa cible.
// Trois scénarios du point de vue de l'équipe 1 (gauche) : meilleur, moyen, pire.
import type { AppState, FieldState, PokemonState, SideKey } from '../model'
import { otherSide } from '../model'
import { buildPokemon, computeMove, effectiveSpeed, isProtecting, moveInfo, movePriority, type MoveResult } from './engine'

export interface Slot { side: SideKey; index: number }
export const slotKey = (s: Slot) => `${s.side}:${s.index}`

export interface Action {
  actor: Slot
  pokemon: PokemonState
  move: string
  targets: Slot[]
  spread: boolean
  isStatus: boolean
  priority: number
  speed: number
  /** Égalité de vitesse avec l'action suivante (ordre aléatoire dans le jeu) */
  tieWithNext: boolean
}

export type ScenarioKind = 'best' | 'average' | 'worst'

export interface Hit {
  target: Slot
  damage: number
  hpBefore: number
  hpAfter: number
  maxHP: number
  ko: boolean
  missed: boolean
  crit: boolean
  blocked: boolean
  /** Résultat complet (précision, vrai taux de KO) contre la cible avec ses PV du moment */
  detail: MoveResult | null
}

export interface ScenarioAction {
  action: Action
  skipped: 'fainted' | null
  hits: Hit[]
}

export interface Scenario {
  kind: ScenarioKind
  actions: ScenarioAction[]
  /** PV finaux par emplacement */
  hp: Record<string, { hp: number; maxHP: number; fainted: boolean }>
}

export interface TurnResult {
  order: Action[]
  scenarios: Record<ScenarioKind, Scenario>
}

function activeSlots(state: AppState, side: SideKey): Slot[] {
  return state.active[side]
    .filter((i) => state.teams[side][i]?.species)
    .map((index) => ({ side, index }))
}

/** Cibles d'une action selon l'attaque et le réglage de cible du Pokémon. */
export function targetsFor(state: AppState, actor: Slot, moveName: string): { targets: Slot[]; spread: boolean } {
  const info = moveInfo(moveName)
  const foes = activeSlots(state, otherSide(actor.side))
  const allies = activeSlots(state, actor.side).filter((s) => s.index !== actor.index)
  if (!info) return { targets: [], spread: false }
  const t = info.target
  if (t === 'allAdjacentFoes') return { targets: foes, spread: foes.length > 1 }
  if (t === 'allAdjacent') return { targets: [...foes, ...allies], spread: foes.length + allies.length > 1 }
  if (t === 'self' || t === 'allySide' || t === 'allyTeam' || t === 'all' || t === 'foeSide') return { targets: [], spread: false }
  const p = state.teams[actor.side][actor.index]
  if (p.target === 'ally') return { targets: allies.slice(0, 1), spread: false }
  if (typeof p.target === 'number') {
    const found = foes.find((f) => f.index === p.target)
    if (found) return { targets: [found], spread: false }
  }
  return { targets: foes.slice(0, 1), spread: false }
}

function speedOf(state: AppState, slot: Slot): number {
  const p = state.teams[slot.side][slot.index]
  return effectiveSpeed(buildPokemon(p), p, state.field[slot.side], state.field)
}

export function turnOrder(state: AppState): Action[] {
  const actions: Action[] = []
  for (const side of ['left', 'right'] as SideKey[]) {
    for (const slot of activeSlots(state, side)) {
      const p = state.teams[side][slot.index]
      const move = p.moves[p.activeMove ?? 0] ?? ''
      const info = move ? moveInfo(move) : undefined
      let priority = movePriority(p, move, p.curHPPercent >= 100)
      if (state.field.terrain === 'Grassy' && move === 'Grassy Glide') priority += 1
      const { targets, spread } = targetsFor(state, slot, move)
      actions.push({
        actor: slot,
        pokemon: p,
        move,
        targets,
        spread,
        isStatus: !info || info.category === 'Status' || !info.category,
        priority,
        speed: speedOf(state, slot),
        tieWithNext: false,
      })
    }
  }
  const tr = state.field.trickRoom
  actions.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    if (a.speed !== b.speed) return tr ? a.speed - b.speed : b.speed - a.speed
    return a.actor.side === 'left' ? -1 : 1
  })
  for (let i = 0; i < actions.length - 1; i++) {
    actions[i].tieWithNext = actions[i].priority === actions[i + 1].priority && actions[i].speed === actions[i + 1].speed
  }
  return actions
}

/** Dégâts retenus pour une frappe selon le scénario et le camp de l'attaquant (équipe 1 = "nous"). */
function pickDamage(kind: ScenarioKind, ours: boolean, normal: MoveResult, crit: MoveResult | null): { damage: number; missed: boolean; crit: boolean } {
  const canMiss = normal.accuracy.base !== null && normal.accuracy.effective < 100
  const rolls = normal.rolls.length ? normal.rolls : [normal.min]
  const median = rolls[Math.floor(rolls.length / 2)]
  const favorable = kind === 'best' ? ours : kind === 'worst' ? !ours : null
  if (favorable === true) {
    // Le mieux pour ce camp : ça touche, roll max, critique si possible
    if (crit && normal.critChance > 0) return { damage: crit.max, missed: false, crit: true }
    return { damage: normal.max, missed: false, crit: false }
  }
  if (favorable === false) {
    // Le pire pour ce camp : ça rate si ça peut rater, sinon roll min
    if (canMiss) return { damage: 0, missed: true, crit: false }
    return { damage: normal.min, missed: false, crit: false }
  }
  // Moyen : roll médian, pas de critique, ça touche si précision >= 50 %
  if (canMiss && normal.accuracy.effective < 50) return { damage: 0, missed: true, crit: false }
  return { damage: median, missed: false, crit: false }
}

export function simulateTurn(state: AppState): TurnResult {
  const order = turnOrder(state)
  const kinds: ScenarioKind[] = ['best', 'average', 'worst']
  const scenarios = {} as Record<ScenarioKind, Scenario>
  const field: FieldState = state.field

  for (const kind of kinds) {
    // PV courants par emplacement
    const hp: Scenario['hp'] = {}
    const mons: Record<string, PokemonState> = {}
    for (const side of ['left', 'right'] as SideKey[]) {
      for (const slot of activeSlots(state, side)) {
        const p = state.teams[side][slot.index]
        const mon = buildPokemon(p)
        hp[slotKey(slot)] = { hp: mon.curHP(), maxHP: mon.maxHP(), fainted: false }
        mons[slotKey(slot)] = p
      }
    }
    const actions: ScenarioAction[] = []
    for (const action of order) {
      const ak = slotKey(action.actor)
      if (hp[ak]?.fainted) { actions.push({ action, skipped: 'fainted', hits: [] }); continue }
      const hits: Hit[] = []
      if (!action.isStatus) {
        for (const target of action.targets) {
          const tk = slotKey(target)
          const cur = hp[tk]
          if (!cur || cur.fainted) continue
          // Défenseur avec ses PV du moment (pourcentage fractionnaire pour garder la précision)
          const defender: PokemonState = { ...mons[tk], curHPPercent: (cur.hp / cur.maxHP) * 100 }
          const attackerState = mons[ak]
          const normal = computeMove(action.move, attackerState, defender, field, { ...state.options, critMode: 'chance' }, action.actor.side)
          if (!normal) continue
          if (normal.blockedByProtect || isProtecting(defender) && normal.blockedByProtect) {
            hits.push({ target, damage: 0, hpBefore: cur.hp, hpAfter: cur.hp, maxHP: cur.maxHP, ko: false, missed: false, crit: false, blocked: true, detail: normal })
            continue
          }
          const crit = normal.critChance > 0 ? computeMove(action.move, attackerState, defender, field, { ...state.options, critMode: 'always' }, action.actor.side) : null
          const pick = pickDamage(kind, action.actor.side === 'left', normal, crit)
          const dmg = Math.min(cur.hp, pick.damage)
          const after = cur.hp - dmg
          const ko = after <= 0
          hits.push({ target, damage: dmg, hpBefore: cur.hp, hpAfter: Math.max(0, after), maxHP: cur.maxHP, ko, missed: pick.missed, crit: pick.crit, blocked: false, detail: normal })
          hp[tk] = { hp: Math.max(0, after), maxHP: cur.maxHP, fainted: ko }
        }
      }
      actions.push({ action, skipped: null, hits })
    }
    scenarios[kind] = { kind, actions, hp }
  }
  return { order, scenarios }
}
