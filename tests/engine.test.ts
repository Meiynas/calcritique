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
  const { simulateTurn } = await import('../src/lib/turn')
  const { canReceiveStatus, statusChance, FULL_PARALYSIS, THAW_CHANCE } = await import('../src/lib/status')
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
  assert.ok(!canReceiveStatus('par', 'Thunder Wave', defaultPokemon('Garchomp'), field))
  assert.ok(!canReceiveStatus('par', 'Stun Spore', defaultPokemon('Rillaboom'), field))
  assert.ok(canReceiveStatus('par', 'Glare', defaultPokemon('Garchomp'), field))
  // Taux Champions
  assert.equal(FULL_PARALYSIS, 0.125)
  assert.equal(THAW_CHANCE, 0.25)
  // Plaquage : 30 % de paralysie, doublé par Sérénité, bloqué par Cape Cachée
  const bs = defaultPokemon('Snorlax', { moves: ['Body Slam', '', '', ''] })
  assert.equal(statusChance('Body Slam', bs, defaultPokemon('Garchomp'), field)!.chance, 0.3)
  assert.equal(statusChance('Body Slam', { ...bs, ability: 'Serene Grace' }, defaultPokemon('Garchomp'), field)!.chance, 0.6)
  assert.equal(statusChance('Body Slam', bs, defaultPokemon('Garchomp', { item: 'Covert Cloak' }), field), null)
  assert.equal(statusChance('Body Slam', bs, defaultPokemon('Raichu'), field), null)
  // Dans le meilleur scénario, Plaquage paralyse un adversaire plus lent et le fait passer après
  st.teams.left[0] = defaultPokemon('Snorlax', { nature: 'Adamant', sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 10 }, moves: ['Body Slam', '', '', ''], target: 1 })
  st.teams.right[1] = defaultPokemon('Toxapex', { nature: 'Bold', sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 0, spe: 0 }, moves: ['Protect', '', '', ''] })
  st.teams.right[1].moves[0] = 'Toxic'
  st.teams.left[1] = defaultPokemon('Garchomp', { moves: ['Protect', '', '', ''] })
  const r3 = simulateTurn(st)
  const bsBest = r3.scenarios.best.actions.find((a) => a.action.move === 'Body Slam')!
  assert.equal(bsBest.hits[0].inflicted, 'par')
  assert.equal(r3.scenarios.best.actions.find((a) => a.action.move === 'Toxic')!.skipped, 'par') // paralysie totale dans le meilleur cas
  const bsAvg = r3.scenarios.average.actions.find((a) => a.action.move === 'Body Slam')!
  assert.equal(bsAvg.hits[0].inflicted, undefined) // 30 % : pas retenu dans le scénario moyen
})

test('tour : Bluff fait tressaillir la cible (elle n\'agit pas), un Pokémon gelé n\'agit pas sauf avec Boutefeu', async () => {
  const { simulateTurn } = await import('../src/lib/turn')
  const { defaultState } = await import('../src/model')
  const st = defaultState()
  st.mode = '2v2'
  st.teams.left[0] = defaultPokemon('Incineroar', { moves: ['Fake Out', '', '', ''], target: 0 })
  st.teams.left[1] = defaultPokemon('Garchomp', { moves: ['Protect', '', '', ''] })
  st.teams.right[0] = defaultPokemon('Toxapex', { sp: { hp: 32, atk: 0, def: 32, spa: 0, spd: 0, spe: 0 }, moves: ['Kowtow Cleave', '', '', ''] })
  st.teams.right[1] = defaultPokemon('Arcanine', { status: 'frz', moves: ['Flare Blitz', '', '', ''] })
  st.active = { left: [0, 1], right: [0, 1] }
  const r = simulateTurn(st)
  for (const k of ['best', 'average', 'worst'] as const) {
    const king = r.scenarios[k].actions.find((a) => a.action.move === 'Kowtow Cleave')!
    assert.equal(king.skipped, 'flinch', k)
    const arc = r.scenarios[k].actions.find((a) => a.action.move === 'Flare Blitz')!
    assert.equal(arc.skipped, null, k) // Boutefeu dégèle son lanceur
  }
  st.teams.right[1].moves[0] = 'Extreme Speed'
  const r2 = simulateTurn(st)
  assert.equal(r2.scenarios.average.actions.find((a) => a.action.move === 'Extreme Speed')!.skipped, 'frz')
  assert.equal(r2.scenarios.best.actions.find((a) => a.action.move === 'Extreme Speed')!.skipped, 'frz')
  assert.equal(r2.scenarios.worst.actions.find((a) => a.action.move === 'Extreme Speed')!.skipped, null)
})

test('tour : arrivée sur le terrain (Piège de Roc + Intimidation), contrecoup de Boutefeu, fin de tour (brûlure, sable, Restes), Baie Sitrus', async () => {
  const { simulateTurn } = await import('../src/lib/turn')
  const { defaultState, SWITCH_IN } = await import('../src/model')
  const st = defaultState()
  st.mode = '2v2'
  st.field.weather = 'Sand'
  st.field.left.stealthRock = true
  st.teams.left[0] = defaultPokemon('Incineroar', { ability: 'Intimidate', activeMove: SWITCH_IN, item: 'Sitrus Berry' })
  st.teams.left[1] = defaultPokemon('Arcanine', { nature: 'Adamant', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 }, status: 'brn', moves: ['Flare Blitz', '', '', ''], target: 0 })
  st.teams.right[0] = defaultPokemon('Garchomp', { item: 'Leftovers', moves: ['Protect', '', '', ''] })
  st.teams.right[1] = defaultPokemon('Kingambit', { ability: 'Defiant', moves: ['Protect', '', '', ''] })
  st.active = { left: [0, 1], right: [0, 1] }
  const r = simulateTurn(st)
  const avg = r.scenarios.average
  const entry = avg.actions.find((a) => a.action.switchIn)!
  assert.equal(entry.position, 1) // avant toutes les attaques
  assert.equal(entry.effect, 'switchIn')
  assert.ok(entry.notes!.some((n) => n.key === 'rocks' && n.value! > 0)) // Piège de Roc sur un type Feu
  assert.ok(entry.notes!.some((n) => n.key === 'intimidate' && n.target?.index === 0))
  assert.ok(entry.notes!.some((n) => n.key === 'intimidateDefiant' && n.target?.index === 1))
  // Boutefeu bloqué par Abri : pas de contrecoup ; sans Abri, contrecoup d'un tiers
  const fb = avg.actions.find((a) => a.action.move === 'Flare Blitz')!
  assert.ok(!fb.self || !fb.self.some((c) => c.reason === 'recoil'))
  st.teams.right[0].moves[0] = 'Earthquake'
  const r2 = simulateTurn(st)
  const fb2 = r2.scenarios.average.actions.find((a) => a.action.move === 'Flare Blitz')!
  const recoil = fb2.self!.find((c) => c.reason === 'recoil')!
  assert.equal(recoil.delta, -Math.floor(fb2.hits[0].damage / 3))
  // Fin de tour : Arcanin brûlé et touché par le sable, Carchacrok immunisé au sable et soigné par les Restes
  const eot = r2.scenarios.average.endOfTurn
  assert.ok(eot.some((e) => e.slot.side === 'left' && e.slot.index === 1 && e.reason === 'burn' && e.delta < 0))
  assert.ok(eot.some((e) => e.slot.side === 'left' && e.slot.index === 1 && e.reason === 'sand' && e.delta < 0))
  assert.ok(eot.some((e) => e.slot.side === 'right' && e.slot.index === 0 && e.reason === 'leftovers' && e.delta > 0))
  assert.ok(!eot.some((e) => e.slot.side === 'right' && e.slot.index === 0 && e.reason === 'sand'))
  // Baie Sitrus de Félinferno : Séisme le fait passer sous 50 % dans le pire scénario -> soin
  const worst = r2.scenarios.worst
  const eq = worst.actions.find((a) => a.action.move === 'Earthquake')!
  const onInc = eq.hits.find((h) => h.target.side === 'left' && h.target.index === 0)
  if (onInc && !onInc.ko && onInc.hpAfter <= onInc.maxHP / 2) assert.ok(onInc.sitrus! > 0)
})

test('Showdown : import FR / EN avec EV -> SP, formes régionales, export relisible', async () => {
  const { parseTeam, exportTeam } = await import('../src/lib/showdown')
  const r = parseTeam(`Scalpereur @ Baie Pomroz\nTalent: Acharné\nTera Type: Dark\nEVs: 252 HP / 252 Atk / 4 SpD\nAdamant Nature\n- Coup Bas\n- Génusection\n\nAlolan Ninetales @ Light Clay\nAbility: Snow Warning\nSPs: 32 HP / 32 Spe\nTimid Nature\n- Blizzard`)
  assert.equal(r.warnings.length, 0)
  assert.equal(r.team[0].species, 'Kingambit')
  assert.equal(r.team[0].item, 'Chople Berry')
  assert.equal(r.team[0].ability, 'Defiant')
  assert.deepEqual(r.team[0].sp, { hp: 32, atk: 32, def: 0, spa: 0, spd: 1, spe: 0 })
  assert.deepEqual(r.team[0].moves, ['Sucker Punch', 'Kowtow Cleave', '', ''])
  assert.equal(r.team[1].species, 'Ninetales-Alola')
  assert.equal(r.team[1].sp.spe, 32)
  const again = parseTeam(exportTeam(r.team))
  assert.equal(again.warnings.length, 0)
  assert.deepEqual(again.team.map((p) => p.species), ['Kingambit', 'Ninetales-Alola'])
  assert.deepEqual(again.team[0].sp, r.team[0].sp)
})

test('Méga : le talent de la Méga est imposé (Méga-Roucarnage = Annule Garde, précision 100 %)', async () => {
  const { mostPlayedSet } = await import('../src/lib/usage')
  const { normalizePokemon } = await import('../src/model')
  const mega = normalizePokemon(defaultPokemon('Pidgeot-Mega', { ability: 'Keen Eye', moves: ['Hurricane', '', '', ''] }))
  assert.equal(mega.ability, 'No Guard')
  const r = computeMove('Hurricane', mega, defaultPokemon('Garchomp'), field, opts)!
  assert.equal(r.accuracy.effective, 100)
  const auto = mostPlayedSet('Pidgeot')
  if (auto.species === 'Pidgeot-Mega') assert.equal(auto.ability, 'No Guard')
})

test('tour : Provoc bloque une attaque de statut jouée après, Farceur échoue sur un type Ténèbres, confusion = se blesse dans le pire cas', async () => {
  const { simulateTurn } = await import('../src/lib/turn')
  const { defaultState } = await import('../src/model')
  const st = defaultState()
  st.mode = '2v2'
  st.teams.left[0] = defaultPokemon('Whimsicott', { ability: 'Prankster', nature: 'Timid', sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 }, moves: ['Taunt', '', '', ''], target: 0 })
  st.teams.left[1] = defaultPokemon('Garchomp', { confused: true, moves: ['Earthquake', '', '', ''] })
  st.teams.right[0] = defaultPokemon('Toxapex', { moves: ['Toxic', '', '', ''] })
  st.teams.right[1] = defaultPokemon('Kingambit', { moves: ['Swords Dance', '', '', ''] })
  st.active = { left: [0, 1], right: [0, 1] }
  const r = simulateTurn(st)
  const avg = r.scenarios.average
  assert.equal(avg.actions.find((a) => a.action.move === 'Taunt')!.effect, 'taunt')
  assert.equal(avg.actions.find((a) => a.action.move === 'Toxic')!.skipped, 'taunt')
  // Confusion : dans le pire scénario (pour nous), Carchacrok se blesse ; dans le moyen il agit
  assert.equal(r.scenarios.worst.actions.find((a) => a.action.move === 'Earthquake')!.skipped, 'confusion')
  assert.ok((r.scenarios.worst.actions.find((a) => a.action.move === 'Earthquake')!.selfHit ?? 0) > 0)
  assert.equal(avg.actions.find((a) => a.action.move === 'Earthquake')!.skipped, null)
  // Farceur contre Ténèbres : Provoc sur Scalpereur échoue
  st.teams.left[0].target = 1
  const r2 = simulateTurn(st)
  assert.equal(r2.scenarios.average.actions.find((a) => a.action.move === 'Taunt')!.skipped, 'prankster')
})

test('Clone : encaisse une attaque simple, une attaque multi-coups le casse et continue ; Dé Pipé = 4 coups ; Grand Nettoyage retire les Clones', async () => {
  const { simulateTurn } = await import('../src/lib/turn')
  const { defaultState } = await import('../src/model')
  const st = defaultState()
  st.mode = '2v2'
  st.teams.left[0] = defaultPokemon('Cloyster', { nature: 'Adamant', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, item: 'Loaded Dice', ability: 'Shell Armor', moves: ['Icicle Spear', '', '', ''], target: 0 })
  st.teams.left[1] = defaultPokemon('Kingambit', { nature: 'Adamant', sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 }, moves: ['Kowtow Cleave', '', '', ''], target: 1 })
  st.teams.right[0] = defaultPokemon('Garchomp', { substitute: true, moves: ['Protect', '', '', ''] })
  st.teams.right[1] = defaultPokemon('Toxapex', { substitute: true, moves: ['Protect', '', '', ''] })
  st.teams.right[0].moves[0] = 'Swords Dance'
  st.teams.right[1].moves[0] = 'Toxic'
  st.active = { left: [0, 1], right: [0, 1] }
  const r = computeMove('Icicle Spear', st.teams.left[0], st.teams.right[0], field, opts)!
  assert.equal(r.hits, 4) // Dé Pipé
  const avg = simulateTurn(st).scenarios.average
  const rb = avg.actions.find((a) => a.action.move === 'Icicle Spear')!
  assert.ok(rb.hits[0].subBroken) // 4 coups : le Clone (25 %) casse et les coups restants touchent
  assert.ok(rb.hits[0].damage > 0)
  const kc = avg.actions.find((a) => a.action.move === 'Kowtow Cleave')!
  assert.ok(kc.hits[0].subDamage! > 0)
  assert.equal(kc.hits[0].damage, 0) // un seul coup : le Clone prend tout
  // Grand Nettoyage retire les Clones avant les frappes
  st.teams.left[0] = defaultPokemon('Maushold', { nature: 'Jolly', sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 }, moves: ['Tidy Up', '', '', ''] })
  const avg2 = simulateTurn(st).scenarios.average
  assert.equal(avg2.actions.find((a) => a.action.move === 'Tidy Up')!.effect, 'tidyUp')
  const kc2 = avg2.actions.find((a) => a.action.move === 'Kowtow Cleave')!
  assert.equal(kc2.hits[0].subDamage, undefined)
  assert.ok(kc2.hits[0].damage > 0)
})

test('tour : Peau Dure et Casque Brut blessent le lanceur au contact (par coup pour les multi-coups), pas avec Séisme ni Patins Protecteurs', async () => {
  const { simulateTurn } = await import('../src/lib/turn')
  const { defaultState } = await import('../src/model')
  const st = defaultState()
  st.mode = '1v1'
  st.teams.left[0] = defaultPokemon('Kingambit', { moves: ['Kowtow Cleave', '', '', ''], target: 0 })
  st.teams.right[0] = defaultPokemon('Garchomp', { ability: 'Rough Skin', item: 'Rocky Helmet', moves: ['Protect', '', '', ''] })
  st.active = { left: [0], right: [0] }
  const r = simulateTurn(st)
  // Abri : aucun contact, donc rien
  const kc = r.scenarios.average.actions.find((a) => a.action.move === 'Kowtow Cleave')!
  assert.ok(!kc.self || !kc.self.some((c) => c.reason === 'roughSkin' || c.reason === 'rockyHelmet'))
  st.teams.right[0].moves[0] = 'Earthquake'
  const r2 = simulateTurn(st)
  const kc2 = r2.scenarios.average.actions.find((a) => a.action.move === 'Kowtow Cleave')!
  const maxHP = kc2.hits[0] ? r2.scenarios.average.actions.find((a) => a.action.move === 'Earthquake')!.hits[0].maxHP : 0
  const rs = kc2.self!.find((c) => c.reason === 'roughSkin')!
  const rh = kc2.self!.find((c) => c.reason === 'rockyHelmet')!
  assert.equal(rs.delta, -Math.floor(maxHP / 8))
  assert.equal(rh.delta, -Math.floor(maxHP / 6))
  // Séisme (pas de contact) sur Carchacrok : rien
  const eq = r2.scenarios.average.actions.find((a) => a.action.move === 'Earthquake')!
  assert.ok(!eq.self || !eq.self.some((c) => c.reason === 'roughSkin'))
  // Patins Protecteurs : plus de dégâts de contact
  st.teams.left[0].item = 'Protective Pads'
  const r3 = simulateTurn(st)
  const kc3 = r3.scenarios.average.actions.find((a) => a.action.move === 'Kowtow Cleave')!
  assert.ok(!kc3.self || !kc3.self.some((c) => c.reason === 'roughSkin'))
  // Multi-coups de contact : Dé Pipé + Bombe Pop = 4 coups, donc 4 fois 1/8
  st.teams.left[0] = defaultPokemon('Maushold', { item: 'Loaded Dice', moves: ['Population Bomb', '', '', ''], target: 0 })
  st.teams.right[0].item = '' // sans Casque Brut, sinon 4 x (1/8 + 1/6) met Maushold KO
  const r4 = simulateTurn(st)
  const pb = r4.scenarios.average.actions.find((a) => a.action.move === 'Population Bomb')!
  const rs4 = pb.self!.find((c) => c.reason === 'roughSkin')!
  const mausHP = r4.scenarios.average.actions.find((a) => a.action.move === 'Earthquake')!.hits[0].maxHP
  assert.equal(rs4.delta, -Math.floor(mausHP / 8) * 4)
})
