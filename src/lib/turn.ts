// Déroulé d'un tour : les Pokémon sur le terrain agissent dans l'ordre (priorité, puis Vitesse,
// Distorsion, Vent Arrière), chacun avec son attaque mise en avant et sa cible.
// Mécaniques VGC gérées : Abri / Détection et variantes, Garde Large, Anti-Air, Coup d'Main,
// Par Ici / Poudre Fureur (redirection), Ruse (perce Abri), Vent Arrière posé en cours de tour,
// baisses de Vitesse (Vent Glacé, Toile Élek...) avec ordre recalculé après chaque action (vitesse dynamique).
// Trois scénarios du point de vue de l'équipe 1 (gauche) : meilleur, moyen, pire.
import type { AppState, FieldState, PokemonState, SideKey } from '../model'
import { otherSide, SWITCH_IN } from '../model'
import { switchIn as applySwitchIn } from './switch'
import { endOfTurnFor, intimidateEffect, lifeOrbLoss, selfChangesAfterHit, sitrusHeal, TERRAIN_ABILITIES, WEATHER_ABILITIES, type EndEffect, type SelfChange } from './residual'
import { buildPokemon, computeMove, effectiveSpeed, moveInfo, movePriority, PROTECT_MOVES, type MoveResult } from './engine'
import { cantActChance, flinchChance, SELF_THAW_MOVES, statusChance, STATUS_MOVES as STATUS_TABLE, thawsTarget, type InflictedStatus } from './status'

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
  /** "Arrivée sur le terrain" : pièges d'entrée et talents d'entrée au lieu d'une attaque */
  switchIn: boolean
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
  /** Statut infligé à la cible par cette frappe */
  inflicted?: InflictedStatus
  /** La cible tressaille (flinch) : elle n'agira pas ce tour */
  flinched?: boolean
  /** La cible est dégelée par cette frappe */
  thawed?: boolean
  /** Baie Sitrus de la cible consommée après la frappe : PV rendus */
  sitrus?: number
  detail: MoveResult | null
}

export interface ScenarioAction {
  action: Action
  /** Position réelle dans ce scénario (1 = premier) */
  position: number
  skipped: 'fainted' | 'flinch' | 'par' | 'slp' | 'frz' | null
  /** Effet spécial de l'action (clé de traduction) */
  effect?: 'protect' | 'wideGuard' | 'quickGuard' | 'helpingHand' | 'redirect' | 'tailwind' | 'firstTurnOnly' | 'paralyze' | 'sleep' | 'burn' | 'statusFail' | 'switchIn'
  hits: Hit[]
  /** Notes d'entrée sur le terrain (pièges, talents) : clé de traduction + valeur + nom de cible éventuel */
  notes?: { key: string; value?: number; target?: Slot }[]
  /** Variations de PV du lanceur (drain, contrecoup, Orbe Vie, Baie Sitrus) */
  self?: SelfChange[]
}

export interface Scenario {
  kind: ScenarioKind
  actions: ScenarioAction[]
  hp: Record<string, { hp: number; maxHP: number; fainted: boolean }>
  /** Effets de fin de tour appliqués (poison, brûlure, sable, Restes...) */
  endOfTurn: EndEffect[]
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
      const isSwitch = p.activeMove === SWITCH_IN
      const move = isSwitch ? '' : (p.moves[p.activeMove ?? 0] ?? '')
      const info = move ? moveInfo(move) : undefined
      let priority = isSwitch ? 100 : movePriority(p, move, p.curHPPercent >= 100)
      if (state.field.terrain === 'Grassy' && move === 'Grassy Glide') priority += 1
      const { targets, spread } = isSwitch ? { targets: [], spread: false } : targetsFor(state, slot, move)
      actions.push({
        actor: slot, pokemon: p, move, targets, spread,
        isStatus: !info || info.category === 'Status' || !info.category,
        priority,
        speed: effectiveSpeed(buildPokemon(p), p, state.field[side], state.field),
        tieWithNext: false,
        switchIn: isSwitch,
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
    const flinched: Record<string, boolean> = {} // clé d'emplacement -> apeuré ce tour
    const sitrusUsed: Record<string, boolean> = {} // Baie Sitrus consommée
    const trySitrus = (k: string): number => {
      const cur = hp[k]
      if (!cur || cur.fainted) return 0
      const heal = sitrusHeal(mons[k], cur.hp, cur.maxHP, !!sitrusUsed[k])
      if (heal > 0) { sitrusUsed[k] = true; hp[k] = { ...cur, hp: Math.min(cur.maxHP, cur.hp + heal) } }
      return heal
    }
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
      const ours = side === 'left'
      // Arrivée sur le terrain : pièges d'entrée puis talents d'entrée (météo, terrain, Intimidation)
      if (action.switchIn) {
        const notes: NonNullable<ScenarioAction['notes']> = []
        const cur = hp[ak]
        const before = { ...mons[ak], curHPPercent: (cur.hp / cur.maxHP) * 100 }
        const r = applySwitchIn(before, field[side], field)
        field[side] = r.side
        const newHP = Math.max(0, Math.min(cur.hp, Math.round((cur.maxHP * r.pokemon.curHPPercent) / 100)))
        const dead = r.notes.some((n) => n.key === 'switch.fainted')
        hp[ak] = { hp: dead ? 0 : newHP, maxHP: cur.maxHP, fainted: dead }
        mons[ak] = r.pokemon
        for (const n of r.notes) notes.push({ key: n.key.replace('switch.', ''), value: n.value })
        if (!dead) {
          const ab = mons[ak].ability
          if (WEATHER_ABILITIES[ab]) { field.weather = WEATHER_ABILITIES[ab]; notes.push({ key: 'weather' }) }
          if (TERRAIN_ABILITIES[ab]) { field.terrain = TERRAIN_ABILITIES[ab]; notes.push({ key: 'terrain' }) }
          if (ab === 'Intimidate') {
            for (const tg of activeSlots(state, foe)) {
              const tk = slotKey(tg)
              if (hp[tk]?.fainted) continue
              const eff = intimidateEffect(mons[tk])
              const boosts = { ...mons[tk].boosts }
              for (const c of eff.changes) boosts[c.stat] = Math.max(-6, Math.min(6, (boosts[c.stat] ?? 0) + c.delta))
              mons[tk] = { ...mons[tk], boosts }
              notes.push({ key: eff.note, target: tg })
            }
          }
        }
        done.push({ action, position, skipped: dead ? 'fainted' : null, effect: 'switchIn', hits: [], notes })
        continue
      }
      // Tressaillement (flinch) subi plus tôt dans le tour
      if (flinched[ak]) { done.push({ action, position, skipped: 'flinch', hits: [] }); continue }
      // Statut qui empêche d'agir : selon le scénario, l'issue favorable à l'équipe 1 est retenue
      const ca = cantActChance(mons[ak], action.move)
      if (ca.reason) {
        const favorable = kind === 'best' ? ours : kind === 'worst' ? !ours : null
        const skip = ca.chance >= 1 || (ca.chance > 0 && (favorable === false || (favorable === null && ca.chance > 0.5)))
        if (skip) { done.push({ action, position, skipped: ca.reason, hits: [] }); continue }
        // Il agit : réveil / dégel (la paralysie reste)
        if (ca.reason !== 'par') mons[ak] = { ...mons[ak], status: '' }
      }
      if (mons[ak].status === 'frz' && SELF_THAW_MOVES.includes(action.move)) mons[ak] = { ...mons[ak], status: '' }
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
      // Attaque de statut qui inflige un statut (Cage Éclair, Spore, Feu Follet...)
      const favorable = kind === 'best' ? ours : kind === 'worst' ? !ours : null
      const applies = (chance: number) => chance >= 1 || (chance > 0 && (favorable === true || (favorable === null && chance >= 0.5)))
      if (action.isStatus && action.move in STATUS_TABLE) {
        const target = action.targets.find((tg) => !hp[slotKey(tg)]?.fainted)
        if (target) {
          const tk = slotKey(target)
          const tp = mons[tk]
          const blocked = target.side !== side && (tp.protect || (action.priority > 0 && guard[target.side].quick))
          const sc = blocked ? null : statusChance(action.move, mons[ak], tp, field)
          if (sc && applies(sc.chance)) {
            mons[tk] = { ...tp, status: sc.status }
            effect = sc.status === 'par' ? 'paralyze' : sc.status === 'slp' ? 'sleep' : 'burn'
          } else effect = 'statusFail'
        }
      }
      const self: SelfChange[] = []
      const sitrusHeals: { target: Slot; heal: number }[] = []
      let landed = false
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
          let inflicted: InflictedStatus | undefined
          let thawed = false
          let flinch = false
          if (!pick.missed && !ko) {
            if (mons[tk].status === 'frz' && thawsTarget(action.move)) { mons[tk] = { ...mons[tk], status: '' }; thawed = true }
            // Effet secondaire de statut (Plaquage 30 % para, Ébullition 30 % brûlure, Nuzzle 100 %...)
            const sc = statusChance(action.move, attackerState, mons[tk], field)
            if (sc && applies(sc.chance)) { mons[tk] = { ...mons[tk], status: sc.status }; inflicted = sc.status }
            // Flinch : seulement si la cible n'a pas encore agi ce tour
            const pending = remaining.find((r) => slotKey(r.actor) === tk)
            if (pending && target.side !== side) {
              let fc = flinchChance(action.move, attackerState, mons[tk])
              if (action.move === 'Upper Hand' && pending.priority <= 0) fc = 0
              if (fc >= 1 || (fc > 0 && favorable === true)) { flinched[tk] = true; flinch = true }
            }
          }
          hits.push({ ...base, damage: dmg, hpAfter: Math.max(0, after), ko, missed: pick.missed, crit: pick.crit, blocked: false, inflicted, flinched: flinch, thawed })
          hp[tk] = { hp: Math.max(0, after), maxHP: cur.maxHP, fainted: ko }
          if (!ko) { const sh = trySitrus(tk); if (sh > 0) sitrusHeals.push({ target, heal: sh }) }
          if (!pick.missed && dmg > 0) landed = true
          for (const sc2 of selfChangesAfterHit(action.move, attackerState, mons[tk], dmg, hp[ak].maxHP)) self.push(sc2)
          // Baisse de Vitesse garantie : l'ordre sera recalculé pour les actions suivantes
          if (!pick.missed && !ko && SPEED_DROP_MOVES.includes(action.move)) {
            const tp = mons[tk]
            mons[tk] = { ...tp, boosts: { ...tp.boosts, spe: Math.max(-6, (tp.boosts.spe ?? 0) - 1) } }
          }
        }
      }
      // Orbe Vie, puis application des variations de PV du lanceur (drain, contrecoup), puis Baie Sitrus
      if (landed) { const lo = lifeOrbLoss(mons[ak], action.move, hp[ak].maxHP); if (lo) self.push(lo) }
      for (const sc2 of self) {
        const cur = hp[ak]
        const nh = Math.max(0, Math.min(cur.maxHP, cur.hp + sc2.delta))
        hp[ak] = { hp: nh, maxHP: cur.maxHP, fainted: nh <= 0 }
      }
      if (!hp[ak].fainted) { const sh = trySitrus(ak); if (sh > 0) self.push({ reason: 'sitrus', delta: sh }) }
      for (const h of hits) { const sh = sitrusHeals.find((x) => slotKey(x.target) === slotKey(h.target)); if (sh) h.sitrus = sh.heal }
      done.push({ action, position, skipped: null, effect, hits, self: self.length ? self : undefined })
    }
    // Fin de tour : météo, terrain, objets, statuts, Vampigraine (dans l'ordre de Vitesse)
    const endOfTurn: EndEffect[] = []
    const order2 = sortActions(baseActions(state), field.trickRoom, speedOf)
    for (const a of order2) {
      const k = slotKey(a.actor)
      const cur = hp[k]
      if (!cur || cur.fainted) continue
      for (const e of endOfTurnFor(mons[k], cur.hp, cur.maxHP, field)) {
        const c = hp[k]
        const nh = Math.max(0, Math.min(c.maxHP, c.hp + e.delta))
        hp[k] = { hp: nh, maxHP: c.maxHP, fainted: nh <= 0 }
        endOfTurn.push({ slot: a.actor, reason: e.reason, delta: nh - c.hp })
        if (e.reason === 'leechSeed') {
          const foes = activeSlots(state, otherSide(a.actor.side))
          const seeder = mons[k].leechSeeder
          const rcv = foes.find((tg) => tg.index === seeder && !hp[slotKey(tg)]?.fainted) ?? foes.find((tg) => !hp[slotKey(tg)]?.fainted)
          if (rcv) {
            const rk = slotKey(rcv)
            const rc = hp[rk]
            const gain = mons[rk].ability === 'Liquid Ooze' ? 0 : Math.min(rc.maxHP - rc.hp, -e.delta)
            if (gain > 0) { hp[rk] = { ...rc, hp: rc.hp + gain }; endOfTurn.push({ slot: rcv, reason: 'leechSeedHeal', delta: gain }) }
          }
        }
        if (hp[k].fainted) break
      }
      if (!hp[k].fainted) { const sh = trySitrus(k); if (sh > 0) endOfTurn.push({ slot: a.actor, reason: 'sitrus', delta: sh }) }
    }
    scenarios[kind] = { kind, actions: done, hp, endOfTurn }
  }
  return { order, scenarios }
}
