// Déroulé d'un tour : les Pokémon sur le terrain agissent dans l'ordre (priorité, puis Vitesse,
// Distorsion, Vent Arrière), chacun avec son attaque mise en avant et sa cible.
// Mécaniques VGC gérées : Abri / Détection et variantes, Garde Large, Anti-Air, Coup d'Main,
// Par Ici / Poudre Fureur (redirection), Ruse (perce Abri), Vent Arrière posé en cours de tour,
// baisses de Vitesse (Vent Glacé, Toile Élek...) avec ordre recalculé après chaque action (vitesse dynamique).
// Trois scénarios du point de vue de l'équipe 1 (gauche) : meilleur, moyen, pire.
import type { AppState, FieldState, PokemonState, SideKey } from '../model'
import { otherSide } from '../model'
import { buildPokemon, computeMove, effectiveSpeed, moveInfo, movePriority, PROTECT_MOVES, type MoveResult } from './engine'

export interface Slot { side: SideKey; index: number }
export const slotKey = (s: Slot) => `${s.side}:${s.index}`

export const WIDE_GUARD = ['Wide Guard']
export const QUICK_GUARD = ['Quick Guard']
export const HELPING_HAND = ['Helping Hand']
export const REDIRECT_MOVES = ['Follow Me', 'Rage Powder']
export const TAILWIND = ['Tailwind']
/** Attaques qui baissent la Vitesse de la cible à coup sûr (−1) */
export const SPEED_DROP_MOVES = ['Icy Wind', 'Electroweb', 'Bulldoze', 'Rock Tomb', 'Mud Shot', 'Low Sweep', 'Glaciate', 'Pounce', 'Bleakwind Storm', 'Drum Beating']
export const FIRST_TURN_ONLY = ['Fake Out', 'First Impression']
/** Attaques qui paralysent à coup sûr (la Vitesse est divisée par 2 pour la suite du tour) */
export const PARALYSIS_MOVES = ['Thunder Wave', 'Stun Spore', 'Glare', 'Nuzzle']
const POWDER_MOVES = ['Stun Spore']

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
  blockedBy?: 'protect' | 'wideGuard' | 'quickGuard'
  redirected: boolean
  helpingHand: boolean
  /** La cible a été paralysée par cette frappe */
  paralyzed?: boolean
  detail: MoveResult | null
}

export interface ScenarioAction {
  action: Action
  /** Position réelle dans ce scénario (1 = premier) */
  position: number
  skipped: 'fainted' | null
  /** Effet spécial de l'action (clé de traduction) */
  effect?: 'protect' | 'wideGuard' | 'quickGuard' | 'helpingHand' | 'redirect' | 'tailwind' | 'firstTurnOnly' | 'paralyze' | 'paralyzeFail'
  hits: Hit[]
}

export interface Scenario {
  kind: ScenarioKind
  actions: ScenarioAction[]
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

function isSpreadTarget(t: string | undefined): boolean {
  return t === 'allAdjacentFoes' || t === 'allAdjacent'
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
  if (t === 'self' || t === 'allySide' || t === 'allyTeam' || t === 'all' || t === 'foeSide' || t === 'allies') return { targets: [], spread: false }
  const p = state.teams[actor.side][actor.index]
  if (t === 'adjacentAlly' || t === 'adjacentAllyOrSelf') return { targets: allies.slice(0, 1), spread: false }
  if (p.target === 'ally') return { targets: allies.slice(0, 1), spread: false }
  if (typeof p.target === 'number') {
    const found = foes.find((f) => f.index === p.target)
    if (found) return { targets: [found], spread: false }
  }
  return { targets: foes.slice(0, 1), spread: false }
}

function baseActions(state: AppState): Action[] {
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
        actor: slot, pokemon: p, move, targets, spread,
        isStatus: !info || info.category === 'Status' || !info.category,
        priority,
        speed: effectiveSpeed(buildPokemon(p), p, state.field[side], state.field),
        tieWithNext: false,
      })
    }
  }
  return actions
}

function sortActions(actions: Action[], trickRoom: boolean, speedOf: (a: Action) => number): Action[] {
  const sorted = [...actions].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    const sa = speedOf(a), sb = speedOf(b)
    if (sa !== sb) return trickRoom ? sa - sb : sb - sa
    return a.actor.side === 'left' ? -1 : 1
  })
  for (let i = 0; i < sorted.length - 1; i++) {
    sorted[i].tieWithNext = sorted[i].priority === sorted[i + 1].priority && speedOf(sorted[i]) === speedOf(sorted[i + 1])
  }
  if (sorted.length) sorted[sorted.length - 1].tieWithNext = false
  return sorted
}

/** Ordre "de départ" (avant toute action), pour l'affichage. */
export function turnOrder(state: AppState): Action[] {
  return sortActions(baseActions(state), state.field.trickRoom, (a) => a.speed)
}

/** Dégâts retenus pour une frappe selon le scénario et le camp de l'attaquant (équipe 1 = "nous"). */
function pickDamage(kind: ScenarioKind, ours: boolean, normal: MoveResult, crit: MoveResult | null): { damage: number; missed: boolean; crit: boolean } {
  const canMiss = normal.accuracy.base !== null && normal.accuracy.effective < 100
  const rolls = normal.rolls.length ? normal.rolls : [normal.min]
  const median = rolls[Math.floor(rolls.length / 2)]
  const favorable = kind === 'best' ? ours : kind === 'worst' ? !ours : null
  if (favorable === true) {
    if (crit && normal.critChance > 0) return { damage: crit.max, missed: false, crit: true }
    return { damage: normal.max, missed: false, crit: false }
  }
  if (favorable === false) {
    if (canMiss) return { damage: 0, missed: true, crit: false }
    return { damage: normal.min, missed: false, crit: false }
  }
  if (canMiss && normal.accuracy.effective < 50) return { damage: 0, missed: true, crit: false }
  return { damage: median, missed: false, crit: false }
}

/** La cible peut-elle être paralysée par cette attaque ? (types, talents, terrain, statut déjà présent) */
export function canParalyze(moveName: string, target: PokemonState, field: FieldState): boolean {
  if (target.status) return false
  const mon = buildPokemon(target)
  const types = mon.types as string[]
  if (types.includes('Electric')) return false
  if (moveName === 'Thunder Wave' && types.includes('Ground')) return false
  if (POWDER_MOVES.includes(moveName) && (types.includes('Grass') || target.ability === 'Overcoat' || target.item === 'Safety Goggles')) return false
  if (target.ability === 'Good as Gold' && moveName !== 'Nuzzle') return false
  if (['Limber', 'Comatose', 'Purifying Salt'].includes(target.ability)) return false
  if (field.terrain === 'Misty' && !types.includes('Flying') && target.ability !== 'Levitate' && target.item !== 'Air Balloon') return false
  return true
}

export function simulateTurn(state: AppState): TurnResult {
  const order = turnOrder(state)
  const kinds: ScenarioKind[] = ['best', 'average', 'worst']
  const scenarios = {} as Record<ScenarioKind, Scenario>
  const gameType = state.mode === '1v1' ? ('Singles' as const) : ('Doubles' as const)

  for (const kind of kinds) {
    // État courant du scénario : PV, Pokémon (boosts modifiés), effets de côté posés ce tour
    const hp: Scenario['hp'] = {}
    const mons: Record<string, PokemonState> = {}
    const field: FieldState = { ...state.field, left: { ...state.field.left }, right: { ...state.field.right } }
    const guard: Record<SideKey, { wide: boolean; quick: boolean; redirect: Slot | null }> = {
      left: { wide: false, quick: false, redirect: null },
      right: { wide: false, quick: false, redirect: null },
    }
    const helping: Record<string, boolean> = {} // clé d'emplacement -> Coup d'Main reçu ce tour
    for (const side of ['left', 'right'] as SideKey[]) {
      for (const slot of activeSlots(state, side)) {
        const p = state.teams[side][slot.index]
        const mon = buildPokemon(p)
        hp[slotKey(slot)] = { hp: mon.curHP(), maxHP: mon.maxHP(), fainted: false }
        mons[slotKey(slot)] = p
      }
    }
    const speedOf = (a: Action) => {
      const p = mons[slotKey(a.actor)]
      return effectiveSpeed(buildPokemon(p), p, field[a.actor.side], field)
    }

    let remaining = baseActions(state)
    const done: ScenarioAction[] = []
    let position = 0
    while (remaining.length) {
      remaining = sortActions(remaining, field.trickRoom, speedOf)
      const action = remaining.shift()!
      position++
      const ak = slotKey(action.actor)
      if (hp[ak]?.fainted) { done.push({ action, position, skipped: 'fainted', hits: [] }); continue }
      const side = action.actor.side
      const foe = otherSide(side)
      let effect: ScenarioAction['effect']

      // Effets de soutien
      if (PROTECT_MOVES.includes(action.move)) effect = 'protect'
      if (WIDE_GUARD.includes(action.move)) { guard[side].wide = true; effect = 'wideGuard' }
      if (QUICK_GUARD.includes(action.move)) { guard[side].quick = true; effect = 'quickGuard' }
      if (REDIRECT_MOVES.includes(action.move)) { guard[side].redirect = action.actor; effect = 'redirect' }
      if (TAILWIND.includes(action.move)) { field[side] = { ...field[side], tailwind: true }; effect = 'tailwind' }
      if (HELPING_HAND.includes(action.move)) {
        for (const ally of activeSlots(state, side)) if (ally.index !== action.actor.index) helping[slotKey(ally)] = true
        effect = 'helpingHand'
      }
      if (FIRST_TURN_ONLY.includes(action.move)) effect = 'firstTurnOnly'

      const hits: Hit[] = []
      // Attaque de statut qui paralyse (Cage Éclair, Para-Spore, Regard Médusant)
      if (action.isStatus && PARALYSIS_MOVES.includes(action.move)) {
        const target = action.targets.find((tg) => !hp[slotKey(tg)]?.fainted)
        if (target) {
          const tk = slotKey(target)
          const tp = mons[tk]
          const blocked = target.side !== side && (tp.protect || (action.priority > 0 && guard[target.side].quick))
          if (!blocked && canParalyze(action.move, tp, field)) {
            mons[tk] = { ...tp, status: 'par' }
            effect = 'paralyze'
          } else effect = 'paralyzeFail'
        }
      }
      if (!action.isStatus) {
        const info = moveInfo(action.move)
        // Redirection : attaque mono-cible visant l'ennemi -> Par Ici / Poudre Fureur
        let targets = action.targets
        let redirected = false
        const rd = guard[foe].redirect
        if (rd && !isSpreadTarget(info?.target) && targets.length === 1 && targets[0].side === foe && !hp[slotKey(rd)].fainted && slotKey(targets[0]) !== slotKey(rd)) {
          targets = [rd]
          redirected = true
        }
        const alive = targets.filter((tg) => !hp[slotKey(tg)]?.fainted)
        for (const target of alive) {
          const tk = slotKey(target)
          const cur = hp[tk]
          const defender: PokemonState = { ...mons[tk], curHPPercent: (cur.hp / cur.maxHP) * 100 }
          const attackerState = mons[ak]
          const hh = !!helping[ak]
          const f: FieldState = hh ? { ...field, [side]: { ...field[side], helpingHand: true } } : field
          const battle = { gameType, targetCount: alive.length }
          const normal = computeMove(action.move, attackerState, defender, f, { ...state.options, critMode: 'chance' }, side, battle)
          if (!normal) continue
          const base = { target, hpBefore: cur.hp, maxHP: cur.maxHP, redirected, helpingHand: hh, detail: normal }
          // Garde Large / Anti-Air du côté de la cible
          if (target.side !== side && guard[target.side].wide && isSpreadTarget(info?.target)) {
            hits.push({ ...base, damage: 0, hpAfter: cur.hp, ko: false, missed: false, crit: false, blocked: true, blockedBy: 'wideGuard' })
            continue
          }
          if (target.side !== side && guard[target.side].quick && action.priority > 0) {
            hits.push({ ...base, damage: 0, hpAfter: cur.hp, ko: false, missed: false, crit: false, blocked: true, blockedBy: 'quickGuard' })
            continue
          }
          if (normal.blockedByProtect) {
            hits.push({ ...base, damage: 0, hpAfter: cur.hp, ko: false, missed: false, crit: false, blocked: true, blockedBy: 'protect' })
            continue
          }
          const crit = normal.critChance > 0 ? computeMove(action.move, attackerState, defender, f, { ...state.options, critMode: 'always' }, side, battle) : null
          const pick = pickDamage(kind, side === 'left', normal, crit)
          const dmg = Math.min(cur.hp, pick.damage)
          const after = cur.hp - dmg
          const ko = after <= 0
          let paralyzed = false
          if (!pick.missed && !ko && PARALYSIS_MOVES.includes(action.move) && canParalyze(action.move, mons[tk], field)) {
            mons[tk] = { ...mons[tk], status: 'par' }
            paralyzed = true
          }
          hits.push({ ...base, damage: dmg, hpAfter: Math.max(0, after), ko, missed: pick.missed, crit: pick.crit, blocked: false, paralyzed })
          hp[tk] = { hp: Math.max(0, after), maxHP: cur.maxHP, fainted: ko }
          // Baisse de Vitesse garantie : l'ordre sera recalculé pour les actions suivantes
          if (!pick.missed && !ko && SPEED_DROP_MOVES.includes(action.move)) {
            const tp = mons[tk]
            mons[tk] = { ...tp, boosts: { ...tp.boosts, spe: Math.max(-6, (tp.boosts.spe ?? 0) - 1) } }
          }
        }
      }
      done.push({ action, position, skipped: null, effect, hits })
    }
    scenarios[kind] = { kind, actions: done, hp }
  }
  return { order, scenarios }
}
