// Import / export au format texte de Pokémon Showdown ("pokepaste"), le format que les joueurs s'échangent.
// Export : noms anglais (standard), niveau 50, "EVs" = SP x 8 (le calc Showdown Champions les lit ainsi).
// Import : noms anglais OU français, tolérance aux accents ; lignes "EVs:" (converties en SP = EV / 8) ou "SPs:" (directes).
import type { PokemonState, StatKey } from '../model'
import { defaultPokemon, normalizePokemon, STAT_KEYS } from '../model'
import { NAMES, normalize, type NameKind } from './names'
import { speciesInfo } from './engine'

const STAT_LABELS: Record<StatKey, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }
const STAT_ALIASES: Record<string, StatKey> = {
  hp: 'hp', pv: 'hp',
  atk: 'atk', attack: 'atk', atq: 'atk', attaque: 'atk',
  def: 'def', defense: 'def', defence: 'def',
  spa: 'spa', spatk: 'spa', spattack: 'spa', atqspe: 'spa', attaquespeciale: 'spa', spc: 'spa',
  spd: 'spd', spdef: 'spd', spdefense: 'spd', defspe: 'spd', defensespeciale: 'spd',
  spe: 'spe', speed: 'spe', vit: 'spe', vitesse: 'spe',
}

/** Retrouve la clé du moteur à partir d'un nom anglais ou français (insensible aux accents et à la casse). */
export function resolveName(kind: NameKind, text: string): string | null {
  const n = normalize(text)
  if (!n) return null
  const table = NAMES[kind]
  if (table[text]) return text
  for (const [key, e] of Object.entries(table)) {
    if (normalize(e.en) === n || normalize(e.fr) === n || normalize(key) === n) return key
  }
  return null
}

export function exportPokemon(p: PokemonState): string {
  if (!p.species) return ''
  const lines: string[] = []
  lines.push(`${p.species}${p.item ? ` @ ${p.item}` : ''}`)
  if (p.ability) lines.push(`Ability: ${p.ability}`)
  lines.push('Level: 50')
  if (p.teraType) lines.push(`Tera Type: ${p.teraType}`)
  const evs = STAT_KEYS.filter((k) => p.sp[k] > 0).map((k) => `${Math.min(252, p.sp[k] * 8)} ${STAT_LABELS[k]}`)
  if (evs.length) lines.push(`EVs: ${evs.join(' / ')}`)
  lines.push(`${p.nature} Nature`)
  for (const m of p.moves) if (m) lines.push(`- ${m}`)
  return lines.join('\n')
}

export function exportTeam(team: PokemonState[]): string {
  return team.filter((p) => p.species).map(exportPokemon).join('\n\n')
}

export interface ImportResult {
  team: PokemonState[]
  /** Avertissements lisibles : noms non reconnus, etc. */
  warnings: string[]
}

/** Lit un ou plusieurs Pokémon au format Showdown. */
export function parseTeam(text: string): ImportResult {
  const warnings: string[] = []
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  const team: PokemonState[] = []
  for (const block of blocks) {
    const p = parseBlock(block, warnings)
    if (p) team.push(p)
    if (team.length >= 6) break
  }
  return { team, warnings }
}

function parseBlock(block: string, warnings: string[]): PokemonState | null {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  // Ligne 1 : "Surnom (Espèce) (M) @ Objet" ou "Espèce @ Objet" ou "Espèce"
  let head = lines[0]
  let item = ''
  const at = head.indexOf(' @ ')
  if (at >= 0) { item = head.slice(at + 3).trim(); head = head.slice(0, at).trim() }
  head = head.replace(/\s*\((M|F)\)\s*$/i, '')
  let speciesText = head
  const paren = head.match(/^(.*)\(([^()]+)\)\s*$/)
  if (paren) speciesText = paren[2].trim()
  const species = resolveSpecies(speciesText)
  if (!species) { warnings.push(`Pokémon inconnu : ${speciesText}`); return null }
  const p = defaultPokemon(species)
  if (item) {
    const key = resolveName('items', item)
    if (key) p.item = key
    else warnings.push(`Objet inconnu : ${item}`)
  }
  for (const line of lines.slice(1)) {
    if (line.startsWith('- ') || line.startsWith('– ')) {
      const mv = line.slice(2).trim().replace(/\s*\[.*\]$/, '')
      const key = resolveName('moves', mv)
      if (key) { const free = p.moves.indexOf(''); if (free >= 0) p.moves[free] = key }
      else warnings.push(`Attaque inconnue : ${mv}`)
      continue
    }
    const m = line.match(/^([A-Za-zÀ-ÿ ]+?)\s*:\s*(.+)$/)
    if (m) {
      const k = normalize(m[1])
      const v = m[2].trim()
      if (k === 'ability' || k === 'talent') {
        const key = resolveName('abilities', v)
        if (key) p.ability = key
        else warnings.push(`Talent inconnu : ${v}`)
      } else if (k === 'teratype' || k === 'tera' || k === 'typetera' || k === 'teracristal') {
        const key = resolveName('types', v)
        if (key) p.teraType = key
      } else if (k === 'evs' || k === 'sps' || k === 'sp' || k === 'ev' || k === 'pointsdestat' || k === 'statpoints') {
        const perSp = k === 'evs' || k === 'ev' ? 8 : 1
        for (const part of v.split('/')) {
          const pm = part.trim().match(/^(\d+)\s+(.+)$/)
          if (!pm) continue
          const stat = STAT_ALIASES[normalize(pm[2])]
          if (!stat) continue
          p.sp[stat] = Math.max(0, Math.min(32, Math.round(Number(pm[1]) / perSp)))
        }
      }
      // Level, IVs, Shiny, Happiness : ignorés (niveau 50 et IV 31 imposés en Champions)
      continue
    }
    const nat = line.match(/^(.+?)\s+Nature$/i) ?? line.match(/^Nature\s*:?\s*(.+)$/i)
    if (nat) {
      const key = resolveName('natures', nat[1].trim())
      if (key) p.nature = key
      else warnings.push(`Nature inconnue : ${nat[1]}`)
    }
  }
  return normalizePokemon(p)
}

function resolveSpecies(text: string): string | null {
  const direct = resolveName('species', text)
  if (direct && speciesInfo(direct)) return direct
  // Formes écrites autrement : "Ninetales-Alola" / "Alolan Ninetales" / "Charizard-Mega-X"
  const n = normalize(text)
  for (const key of Object.keys(NAMES.species)) {
    if (normalize(key) === n) return key
  }
  const alolan = text.match(/^(Alolan|Galarian|Hisuian|Paldean)\s+(.+)$/i)
  if (alolan) {
    const suffix = { alolan: 'Alola', galarian: 'Galar', hisuian: 'Hisui', paldean: 'Paldea' }[alolan[1].toLowerCase()]
    const key = resolveName('species', `${alolan[2]}-${suffix}`)
    if (key) return key
  }
  return null
}

// ---------- Bibliothèque entière en texte (copier / coller, comme la sauvegarde du teambuilder Showdown) ----------
// Chaque set ou équipe est précédé d'une ligne "=== [set] Nom ===" ou "=== [team] Nom ===".
// À l'import, une sauvegarde Showdown ("=== [gen9vgc] Dossier/Nom ===") est aussi acceptée : un bloc de plusieurs Pokémon
// devient une équipe, un bloc d'un seul Pokémon devient un set. Sans ligne "===" : même règle (un pokepaste = une équipe).

export interface TextSection { kind: 'set' | 'team'; name: string; team: PokemonState[] }

export function exportLibraryText(sets: { name: string; pokemon: PokemonState }[], teams: { name: string; team: PokemonState[] }[]): string {
  const parts: string[] = []
  for (const tm of teams) parts.push(`=== [team] ${tm.name.trim() || 'Team'} ===\n\n${exportTeam(tm.team)}`)
  for (const s of sets) parts.push(`=== [set] ${s.name.trim() || s.pokemon.species} ===\n\n${exportPokemon(s.pokemon)}`)
  return parts.join('\n\n\n')
}

const HEADER = /^===\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*===\s*$/

export function parseLibraryText(text: string): { sections: TextSection[]; warnings: string[] } {
  const warnings: string[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  const raw: { tag: string; name: string; body: string[] }[] = []
  let cur: { tag: string; name: string; body: string[] } | null = null
  for (const line of lines) {
    const h = line.match(HEADER)
    if (h) { cur = { tag: (h[1] ?? '').toLowerCase(), name: h[2].trim(), body: [] }; raw.push(cur); continue }
    if (!cur) { cur = { tag: '', name: '', body: [] }; raw.push(cur) }
    cur.body.push(line)
  }
  const sections: TextSection[] = []
  for (const r of raw) {
    const parsed = parseTeam(r.body.join('\n'))
    warnings.push(...parsed.warnings)
    if (parsed.team.length === 0) continue
    const headerless = r.tag === '' && r.name === ''
    if (headerless) {
      // Sans en-tête : un seul Pokémon = un set, plusieurs = une équipe (un pokepaste est une équipe)
      sections.push(parsed.team.length === 1 ? { kind: 'set', name: '', team: parsed.team } : { kind: 'team', name: '', team: parsed.team })
      continue
    }
    const name = r.name.includes('/') ? r.name.slice(r.name.lastIndexOf('/') + 1).trim() : r.name
    const kind: 'set' | 'team' = r.tag === 'set' ? 'set' : r.tag === 'team' ? 'team' : parsed.team.length > 1 ? 'team' : 'set'
    sections.push({ kind, name, team: parsed.team })
  }
  return { sections, warnings }
}
