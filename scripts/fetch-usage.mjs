// Récupère les statistiques d'usage (Doubles) depuis l'API publique de championsbattledata.com
// et écrit src/data/usage.json au format attendu par src/lib/usage.ts.
// Usage : node scripts/fetch-usage.mjs   (Node 20+, aucune dépendance)
import { writeFileSync, readFileSync } from 'node:fs'

const BASE = 'https://championsbattledata.com'
const OUT = new URL('../src/data/usage.json', import.meta.url)
const LIMIT = 10

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Calcritique data refresh (github.com/Meiynas/calcritique)' } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

const index = await getJSON(`${BASE}/api/index`)
const season = index.battleDataFolders?.[0] ?? 'Current'
const date = (index.generatedAt ?? new Date().toISOString()).slice(0, 10)
const list = (index.pokemon ?? []).filter((p) => (p.battleDataCsvs ?? []).some((c) => String(c).includes('Doubles')))
console.error(`${list.length} Pokémon avec des données Doubles (saison ${season}, ${date})`)

const data = {}
let done = 0
for (const p of list) {
  const key = p.showdownId
  const name = p.battleName || p.name
  let rows
  try {
    rows = (await getJSON(`${BASE}/api/battle/Doubles/${encodeURIComponent(name)}`)).rows ?? []
  } catch (e) {
    console.error(`  ! ${name}: ${e.message}`)
    continue
  }
  const pick = (cat) => rows.filter((r) => r.category === cat).sort((a, b) => a.rank - b.rank)
  const pairs = (cat) => pick(cat).slice(0, LIMIT).map((r) => [r.name, Number(r.percentage_value ?? 0)])
  data[key] = {
    name: p.name,
    moves: pairs('move'),
    items: pairs('held_item'),
    abilities: pairs('ability'),
    natures: pairs('stat_alignment'),
    spreads: pick('stat_points').slice(0, LIMIT).map((r) => [r.hp_points, r.attack_points, r.defense_points, r.sp_atk_points, r.sp_def_points, r.speed_points].map((v) => Number(v) || 0).concat([Number(r.percentage_value ?? 0)])),
    teammates: pick('teammate').slice(0, LIMIT).map((r) => r.name),
  }
  done++
  if (done % 25 === 0) console.error(`  ${done}/${list.length}`)
  await new Promise((res) => setTimeout(res, 150)) // on ménage le serveur
}

if (Object.keys(data).length < 100) {
  console.error('Trop peu de Pokémon récupérés, fichier non modifié.')
  process.exit(1)
}
// Ne pas écraser si rien n'a changé (évite les versions inutiles)
let old = null
try { old = JSON.parse(readFileSync(OUT, 'utf8')) } catch { /* pas de fichier */ }
const next = { season, date, source: 'championsbattledata.com', data }
if (old && JSON.stringify(old.data) === JSON.stringify(data) && old.season === season) {
  console.error('Aucun changement dans les données.')
  process.exit(0)
}
writeFileSync(OUT, JSON.stringify(next))
console.error(`écrit src/data/usage.json (${Object.keys(data).length} Pokémon)`)
