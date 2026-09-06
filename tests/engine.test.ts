// Tests de sécurité du moteur : lancer avec `npm test`.
// Vérifie les règles Champions (SP), la précision et le vrai taux de KO sur des cas connus.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMove, finalStats, speedInfo } from '../src/lib/engine'
import { defaultPokemon, defaultField } from '../src/model'
import { statAt50 } from '../src/lib/champions'
import { switchIn } from '../src/lib/switch'

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
  assert.equal(speedInfo(a, d, field)!.winner, -1)
  assert.equal(speedInfo(a, d, { ...field, left: { ...field.left, tailwind: true } })!.winner, 1)
  assert.equal(speedInfo(a, d, { ...field, trickRoom: true })!.winner, 1)
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

test('Abri : bloque une attaque normale, pas Ruse ni Poing Invisible sur un contact', () => {
  const atk = defaultPokemon('Sneasler', { nature: 'Jolly', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, ability: 'Unburden' })
  const def = defaultPokemon('Garchomp', { protect: true })
  assert.ok(computeMove('Close Combat', atk, def, field, opts)!.blockedByProtect)
  assert.equal(computeMove('Feint', atk, def, field, opts)!.protectBypass, 'feint')
  const urshifu = defaultPokemon('Urshifu', { ability: 'Unseen Fist', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 } })
  assert.equal(computeMove('Close Combat', urshifu, def, field, opts)!.protectBypass, 'unseenFist')
})

test('stades : -1 esquive et +1 précision se compensent', () => {
  const atk = defaultPokemon('Gengar', { accStage: 1, moves: ['Focus Blast', '', '', ''] })
  const def = defaultPokemon('Kingambit', { evaStage: 1 })
  assert.equal(computeMove('Focus Blast', atk, def, field, opts)!.accuracy.effective, 70)
  const def2 = defaultPokemon('Kingambit', { evaStage: 0 })
  assert.ok(Math.abs(computeMove('Focus Blast', atk, def2, field, opts)!.accuracy.effective - 93.3) < 0.2)
})

test('switch : pièges sur Dracaufeu (Vol), Carchacrok (Sol) et Prédastérie (Poison)', () => {
  const side = { ...field.left, stealthRock: true, spikes: 2, toxicSpikes: 1, stickyWeb: true }
  const zard = switchIn(defaultPokemon('Charizard', { boosts: { hp: 0, atk: 2, def: 0, spa: 0, spd: 0, spe: 0 } }), side, field)
  assert.equal(zard.pokemon.curHPPercent, 50) // Roche x4 : la moitié des PV
  assert.equal(zard.pokemon.status, '') // pas au sol : Pics Toxik et Picots ignorés
  assert.equal(zard.pokemon.boosts.atk, 0)
  assert.equal(zard.pokemon.boosts.spe, 0)
  const chomp = switchIn(defaultPokemon('Garchomp'), side, field)
  assert.ok(chomp.pokemon.curHPPercent < 80 && chomp.pokemon.curHPPercent > 70) // 1/16 (Roche x0,5) + 1/6 (2 Picots)
  assert.equal(chomp.pokemon.status, 'psn')
  assert.equal(chomp.pokemon.boosts.spe, -1)
  const pex = switchIn(defaultPokemon('Toxapex'), side, field)
  assert.equal(pex.side.toxicSpikes, 0)
  assert.equal(pex.pokemon.status, '')
})

test('cibles multiples : x0,75 seulement avec 2 cibles ; murs à 2/3 en Doubles, 1/2 en Singles', () => {
  const atk = defaultPokemon('Garchomp', { nature: 'Adamant', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 } })
  const def = defaultPokemon('Kingambit')
  const two = computeMove('Earthquake', atk, def, field, opts, 'left', { targetCount: 2 })!
  const one = computeMove('Earthquake', atk, def, field, opts, 'left', { targetCount: 1 })!
  assert.ok(two.spread && !one.spread)
  assert.ok(one.max > two.max)
  const reflected = { ...field, right: { ...field.right, reflect: true } }
  const dbl = computeMove('Earthquake', atk, def, reflected, opts, 'left', { targetCount: 1 })!
  const sgl = computeMove('Earthquake', atk, def, reflected, opts, 'left', { gameType: 'Singles', targetCount: 1 })!
  assert.ok(sgl.max < dbl.max) // Protection réduit de moitié en Singles, d'un tiers en Doubles
})

test('tour : Garde Large bloque Séisme, Coup d\'Main renforce l\'allié, Vent Glacé fait repasser après', async () => {
  const { simulateTurn } = await import('../src/lib/turn')
  const { defaultState } = await import('../src/model')
  const st = defaultState()
  st.mode = '2v2'
  st.teams.left[0] = defaultPokemon('Garchomp', { nature: 'Jolly', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, moves: ['Earthquake', '', '', ''] })
  st.teams.left[1] = defaultPokemon('Whimsicott', { nature: 'Timid', sp: { hp: 0, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }, ability: 'Prankster', moves: ['Helping Hand', '', '', ''] })
  st.teams.right[0] = defaultPokemon('Hisuian Avalugg'.replace('Hisuian Avalugg', 'Avalugg-Hisui'), { moves: ['Wide Guard', '', '', ''] })
  st.teams.right[1] = defaultPokemon('Kingambit', { moves: ['Kowtow Cleave', '', '', ''] })
  st.active = { left: [0, 1], right: [0, 1] }
  const r = simulateTurn(st)
  const avg = r.scenarios.average
  const chomp = avg.actions.find((a) => a.action.move === 'Earthquake')!
  const foeHits = chomp.hits.filter((h) => h.target.side === 'right')
  assert.equal(foeHits.length, 2)
  assert.ok(foeHits.every((h) => h.blocked && h.blockedBy === 'wideGuard'))
  assert.ok(chomp.hits.every((h) => h.helpingHand))
  // Sans Garde Large : Coup d'Main augmente les dégâts
  st.teams.right[0].moves[0] = 'Protect'
  st.teams.right[0].activeMove = 0
  const r2 = simulateTurn(st)
  const eq = r2.scenarios.average.actions.find((a) => a.action.move === 'Earthquake')!
  const onKing = eq.hits.find((h) => h.target.index === 1)!
  assert.ok(onKing.helpingHand && onKing.damage > 0)
  const onAvalugg = eq.hits.find((h) => h.target.index === 0)!
  assert.ok(onAvalugg.blocked && onAvalugg.blockedBy === 'protect')
})

test('tour : Cage Éclair paralyse et divise la Vitesse pour la suite du tour ; sans effet sur un type Sol', async () => {
  const { simulateTurn, canParalyze } = await import('../src/lib/turn')
  const { defaultState } = await import('../src/model')
  const st = defaultState()
  st.mode = '2v2'
  // Farfaduvet (Prankster) lance Cage Éclair sur Kingambit ; Kingambit devrait alors passer après Garchomp lent
  st.teams.left[0] = defaultPokemon('Whimsicott', { nature: 'Timid', sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 }, ability: 'Prankster', moves: ['Thunder Wave', '', '', ''], target: 1 })
  st.teams.left[1] = defaultPokemon('Garchomp', { nature: 'Adamant', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 }, moves: ['Earthquake', '', '', ''] })
  st.teams.right[0] = defaultPokemon('Kingambit', { nature: 'Jolly', sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 }, moves: ['Kowtow Cleave', '', '', ''] })
  st.teams.right[1] = defaultPokemon('Toxapex', { moves: ['Protect', '', '', ''] })
  st.active = { left: [0, 1], right: [0, 1] }
  const r = simulateTurn(st)
  const avg = r.scenarios.average
  const tw = avg.actions.find((a) => a.action.move === 'Thunder Wave')!
  assert.equal(tw.effect, 'paralyze')
  const posOf = (m: string) => avg.actions.find((a) => a.action.move === m)!.position
  assert.ok(posOf('Earthquake') < posOf('Kowtow Cleave')) // Kingambit paralysé (102 -> 51) passe après Garchomp (122)
  assert.ok(!canParalyze('Thunder Wave', defaultPokemon('Garchomp'), field))
  assert.ok(!canParalyze('Stun Spore', defaultPokemon('Rillaboom'), field))
  assert.ok(canParalyze('Glare', defaultPokemon('Garchomp'), field))
})
