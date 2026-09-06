// Entrée sur le terrain ("switch") : applique les pièges du côté du Pokémon,
// remet les boosts à zéro, et Toile Gluante baisse la Vitesse.
import { Generations, toID } from '@smogon/calc'
import type { FieldState, PokemonState, SideState } from '../model'
import { zeroStats } from '../model'
import { finalStats, speciesInfo } from './engine'

const gen = Generations.get(9)

export interface SwitchResult {
  pokemon: PokemonState
  side: SideState
  /** Ce qui s'est passé (clés de traduction + valeur éventuelle) */
  notes: { key: string; value?: number }[]
}

function types(p: PokemonState): string[] {
  const info = speciesInfo(p.species)
  if (!info) return []
  return p.teraType ? [p.teraType] : (info.types as string[])
}

export function isGrounded(p: PokemonState, field: FieldState): boolean {
  if (field.gravity || p.item === 'Iron Ball') return true
  if (types(p).includes('Flying')) return false
  if (p.ability === 'Levitate') return false
  if (p.item === 'Air Balloon') return false
  return true
}

function rockEffectiveness(p: PokemonState): number {
  const rock = gen.types.get(toID('Rock'))
  if (!rock) return 1
  let mult = 1
  for (const t of types(p)) mult *= rock.effectiveness[t as never] ?? 1
  return mult
}

export function switchIn(p: PokemonState, side: SideState, field: FieldState): SwitchResult {
  const notes: SwitchResult['notes'] = []
  const maxHP = finalStats(p).hp
  let hp = Math.round((maxHP * p.curHPPercent) / 100)
  const boots = p.item === 'Heavy-Duty Boots'
  const magicGuard = p.ability === 'Magic Guard'
  const grounded = isGrounded(p, field)
  let status = p.status
  let newSide = side
  let speBoost = 0

  if (!boots) {
    if (side.stealthRock && !magicGuard) {
      const dmg = Math.floor((maxHP * rockEffectiveness(p)) / 8)
      hp -= dmg
      notes.push({ key: 'switch.rocks', value: dmg })
    }
    if (side.spikes > 0 && grounded && !magicGuard) {
      const frac = [0, 1 / 8, 1 / 6, 1 / 4][side.spikes]
      const dmg = Math.floor(maxHP * frac)
      hp -= dmg
      notes.push({ key: 'switch.spikes', value: dmg })
    }
    if (side.toxicSpikes > 0 && grounded) {
      const tys = types(p)
      if (tys.includes('Poison')) {
        newSide = { ...newSide, toxicSpikes: 0 }
        notes.push({ key: 'switch.absorbToxic' })
      } else if (!tys.includes('Steel') && !status && p.ability !== 'Immunity') {
        status = side.toxicSpikes >= 2 ? 'tox' : 'psn'
        notes.push({ key: status === 'tox' ? 'switch.badlyPoisoned' : 'switch.poisoned' })
      }
    }
    if (side.stickyWeb && grounded) {
      if (['Clear Body', 'White Smoke', 'Full Metal Body', 'Mirror Armor'].includes(p.ability)) notes.push({ key: 'switch.webBlocked' })
      else { speBoost = p.ability === 'Contrary' ? 1 : -1; notes.push({ key: 'switch.web' }) }
    }
  } else {
    notes.push({ key: 'switch.boots' })
  }

  const pct = Math.max(0, Math.min(100, Math.round((hp / maxHP) * 100)))
  if (pct <= 0) notes.push({ key: 'switch.fainted' })

  return {
    pokemon: {
      ...p,
      curHPPercent: Math.max(1, pct),
      status,
      boosts: { ...zeroStats(), spe: speBoost },
      accStage: 0,
      evaStage: 0,
      critStage: 0,
      protect: false,
    },
    side: newSide,
    notes,
  }
}
