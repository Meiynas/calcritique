// Tests de sécurité du moteur : lancer avec `npm test`.
// Vérifie les règles Champions (SP), la précision et le vrai taux de KO sur des cas connus.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMove, finalStats, speedInfo } from '../src/lib/engine'
import { defaultPokemon, defaultField } from '../src/model'
import { statAt50 } from '../src/lib/champions'

const field = defaultField()
const opts = { critMode: 'never' as const, useAccuracy: true, maxTurns: 2 }

test('SP : 32 SP Adamant donnent 205 Atq à Kingambit (comme 252 EV)', () => {
  const s = finalStats(defaultPokemon('Kingambit', { nature: 'Adamant', sp: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } }))
  assert.equal(s.atk, 205)
  assert.equal(s.hp, 177)
  assert.equal(s.spe, 102)
})

test('SP : chaque SP ajoute exactement 1 point de stat', () => {
  for (let sp = 0; sp <= 32; sp++) {
    const s = finalStats(defaultPokemon('Rillaboom', { sp: { hp: sp, atk: sp, def: 0, spa: 0, spd: 0, spe: 0 } }))
    assert.equal(s.hp, 175 + sp)
    assert.equal(s.atk, 145 + sp)
    assert.equal(s.hp, statAt50(100, sp, 'hp', 1))
  }
})

test('précision : Exploforce à 70 % réduit le taux de KO', () => {
  const atk = defaultPokemon('Gengar', { nature: 'Timid', sp: { hp: 0, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }, item: 'Life Orb', ability: 'Cursed Body', moves: ['Focus Blast', '', '', ''] })
  const def = defaultPokemon('Kingambit', { sp: { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ability: 'Defiant' })
  const r = computeMove('Focus Blast', atk, def, field, opts)!
  assert.equal(r.accuracy.effective, 70)
  assert.equal(r.koRollsOnly[0], 1) // OHKO garanti sur les rolls
  assert.ok(Math.abs(r.koTrue[0] - 0.7) < 1e-9) // mais 70 % en vrai
  assert.ok(Math.abs(r.koTrue[1] - 0.91) < 1e-9) // 1 - 0.3² sur deux essais
})

test('précision : Œil Composé et Gravité montent la précision, plafond 100', () => {
  const atk = defaultPokemon('Vikavolt', { ability: 'Compound Eyes', moves: ['Thunder', '', '', ''] })
  const def = defaultPokemon('Rillaboom')
  const r = computeMove('Thunder', atk, def, field, opts)!
  assert.equal(r.accuracy.effective, 91)
  const r2 = computeMove('Thunder', atk, def, { ...field, gravity: true }, opts)!
  assert.equal(r2.accuracy.effective, 100)
  const r3 = computeMove('Thunder', atk, def, { ...field, weather: 'Rain' }, opts)!
  assert.equal(r3.accuracy.effective, 100)
})

test('critique : mode "toujours" fait plus de dégâts que "jamais"', () => {
  const atk = defaultPokemon('Kingambit', { nature: 'Adamant', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 }, moves: ['Kowtow Cleave', '', '', ''] })
  const def = defaultPokemon('Rillaboom', { sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 0, spe: 0 } })
  const never = computeMove('Kowtow Cleave', atk, def, field, { ...opts, critMode: 'never' })!
  const always = computeMove('Kowtow Cleave', atk, def, field, { ...opts, critMode: 'always' })!
  const chance = computeMove('Kowtow Cleave', atk, def, { ...field }, { ...opts, critMode: 'chance' })!
  assert.ok(always.min > never.max)
  assert.ok(chance.koTrue[0] >= never.koTrue[0] && chance.koTrue[0] <= always.koTrue[0])
})

test('vitesse : Vent Arrière et Distorsion inversent le verdict', () => {
  const a = defaultPokemon('Kingambit', { sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } })
  const d = defaultPokemon('Rillaboom', { sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } })
  assert.equal(speedInfo(a, d, field).winner, -1)
  assert.equal(speedInfo(a, d, { ...field, attackerSide: { ...field.attackerSide, tailwind: true } }).winner, 1)
  assert.equal(speedInfo(a, d, { ...field, trickRoom: true }).winner, 1)
})

test('doubles : une attaque à cibles multiples fait x0,75', () => {
  const atk = defaultPokemon('Landorus-Therian', { nature: 'Adamant', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 }, ability: 'Intimidate' })
  const def = defaultPokemon('Rillaboom')
  const spread = computeMove('Earthquake', atk, def, field, opts)!
  const single = computeMove('Stomping Tantrum', atk, def, field, opts)!
  assert.ok(spread.spread)
  assert.ok(!single.spread)
  // Séisme 100 BP x0,75 = 75 BP effectifs, Colère Sourde 75 BP : dégâts proches
  assert.ok(Math.abs(spread.max - single.max) <= 2)
})
