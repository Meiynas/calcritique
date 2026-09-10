// Construit, à partir du moteur (@smogon/calc, génération 0 = Pokémon Champions) et des données de Pokémon Showdown :
//  - src/data/learnsets.json : pool légal de la régulation en cours (clé = nom du moteur) et attaques apprenables
//  - <travail>/calcnames.json : listes de noms du moteur (espèces, attaques, objets, talents, natures, types)
//  - <travail>/showdown.json  : précision et priorité des attaques (valeurs Champions) et talents possibles par espèce
// Usage : npx tsx scripts/build-showdown-data.mts <dossier showdown> <dossier de travail>
import { createRequire } from 'node:module'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { Generations } = require('@smogon/calc')
const gen = Generations.get(0)

const PS = process.argv[2] ?? '/tmp/calcritique-sources/showdown'
const WORK = process.argv[3] ?? '/tmp/calcritique-sources'
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT_LEARNSETS = join(ROOT, 'src', 'data', 'learnsets.json')

const fail = (msg: string): never => {
  console.error(`::error::build-showdown-data : ${msg}`)
  process.exit(1)
}
const load = async (rel: string, key: string) => {
  const file = join(PS, 'data', rel)
  if (!existsSync(file)) fail(`fichier introuvable : ${file}`)
  return (await import(pathToFileURL(file).href))[key] as Record<string, any>
}
const toID = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

const Pokedex = await load('pokedex.ts', 'Pokedex')
const Moves = await load('moves.ts', 'Moves')
const ChampMoves = await load('mods/champions/moves.ts', 'Moves')
const Learnsets = await load('mods/champions/learnsets.ts', 'Learnsets')
const FormatsData = await load('mods/champions/formats-data.ts', 'FormatsData')

// ---------- Noms du moteur ----------
const calcnames = {
  species: [...gen.species].map((s: any) => s.name).sort(),
  moves: [...gen.moves].map((m: any) => m.name).filter((n: string) => n !== '(No Move)').sort(),
  items: [...gen.items].map((i: any) => i.name).sort(),
  abilities: [...gen.abilities].map((a: any) => a.name).filter((n: string) => n !== '(No Ability)').sort(),
  natures: [...gen.natures].map((n: any) => n.name).sort(),
  types: [...gen.types].map((t: any) => t.name).filter((n: string) => n !== '???').sort(),
}
if (calcnames.species.length < 150) fail(`le moteur ne connaît que ${calcnames.species.length} espèces en mode Champions`)
writeFileSync(join(WORK, 'calcnames.json'), JSON.stringify(calcnames))
const calcMove = new Map<string, string>(calcnames.moves.map((n) => [toID(n), n]))

// ---------- Pool légal ----------
// Règles VGC de Showdown pour Champions ("Flat Rules") : pas de Pokémon fabuleux ni de légendaire restreint,
// et seulement les formes marquées disponibles dans data/mods/champions/formats-data.ts.
const banned = (id: string) => (Pokedex[id]?.tags ?? []).some((t: string) => t === 'Mythical' || t === 'Restricted Legendary')
const legalId = (id: string) => {
  const f = FormatsData[id]
  return !!f && !f.isNonstandard && f.tier !== 'Illegal' && !banned(id)
}
function isLegal(sp: any): boolean {
  if (FormatsData[sp.id]) return legalId(sp.id)
  // Formes sans entrée propre (Palafin-Héros, Morpeko Affamé, Méga-Miaousse femelle...) : on suit l'espèce de base
  const base = sp.baseSpecies ?? Pokedex[sp.id]?.baseSpecies ?? Pokedex[sp.id]?.battleOnly
  return !!base && legalId(toID(base))
}

function learnsetIds(id: string, seen = new Set<string>()): Set<string> {
  const out = new Set<string>()
  if (!id || seen.has(id)) return out
  seen.add(id)
  const d = Pokedex[id]
  const own = Learnsets[id]?.learnset
  if (own) for (const m of Object.keys(own)) out.add(m)
  else if (d) {
    for (const base of [d.changesFrom, d.battleOnly, d.baseSpecies]) {
      if (typeof base === 'string' && toID(base) !== id) {
        for (const m of learnsetIds(toID(base), seen)) out.add(m)
        break
      }
    }
  }
  if (d?.prevo) for (const m of learnsetIds(toID(d.prevo), seen)) out.add(m)
  return out
}

const learnsets: Record<string, string[]> = {}
const tooFew: string[] = []
for (const sp of gen.species as Iterable<any>) {
  if (!isLegal(sp)) continue
  let ids = learnsetIds(sp.id)
  if (ids.size === 0 && sp.baseSpecies) ids = learnsetIds(toID(sp.baseSpecies))
  const moves = [...ids].map((m) => calcMove.get(m)).filter((m): m is string => !!m).sort()
  if (moves.length === 0) { tooFew.push(sp.name); continue }
  learnsets[sp.name] = moves
}
const n = Object.keys(learnsets).length
console.error(`pool légal : ${n} Pokémon (formes comprises)${tooFew.length ? `, écartés faute d'attaques : ${tooFew.join(', ')}` : ''}`)
if (n < 150) fail(`pool légal trop petit (${n}), fichier non modifié`)

// ---------- Précision, priorité, talents ----------
const moves: Record<string, { acc: number | null; prio: number }> = {}
for (const name of calcnames.moves) {
  const id = toID(name)
  const base = Moves[id]
  if (!base) continue
  const patch = ChampMoves[id] ?? {}
  const acc = 'accuracy' in patch ? patch.accuracy : base.accuracy
  const prio = 'priority' in patch ? patch.priority : base.priority
  moves[name] = { acc: acc === true ? null : Number(acc), prio: Number(prio ?? 0) }
}
const abilities: Record<string, string[]> = {}
const calcAbility = new Map<string, string>(calcnames.abilities.map((a) => [toID(a), a]))
for (const sp of gen.species as Iterable<any>) {
  const d = Pokedex[sp.id]
  const list = d?.abilities ? Object.values(d.abilities as Record<string, string>) : Object.values(sp.abilities ?? {})
  const known = [...new Set(list.map((a) => calcAbility.get(toID(a as string))).filter((a): a is string => !!a))]
  if (known.length) abilities[sp.name] = known
}
writeFileSync(join(WORK, 'showdown.json'), JSON.stringify({ moves, abilities }))

// N'écrit le pool que s'il a changé (garde l'ordre des clés stable)
const next = JSON.stringify(Object.fromEntries(Object.entries(learnsets).sort(([a], [b]) => a.localeCompare(b))))
const prev = existsSync(OUT_LEARNSETS) ? readFileSync(OUT_LEARNSETS, 'utf8') : ''
if (prev !== next) {
  writeFileSync(OUT_LEARNSETS, next)
  const old = prev ? Object.keys(JSON.parse(prev)) : []
  const added = Object.keys(learnsets).filter((k) => !old.includes(k))
  const removed = old.filter((k) => !learnsets[k])
  console.error(`écrit src/data/learnsets.json (+${added.length} : ${added.join(', ') || '-'} ; -${removed.length} : ${removed.join(', ') || '-'})`)
} else console.error('learnsets.json inchangé')
