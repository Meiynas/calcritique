// Noms français / anglais et recherche tolérante (accents, majuscules, tirets).

import namesJson from '../data/names.json'
import type { Lang } from '../model'

type Table = Record<string, { fr: string; en: string }>
interface Names {
  species: Table
  moves: Table
  items: Table
  abilities: Table
  natures: Table
  types: Table
}
export const NAMES = namesJson as Names
export type NameKind = keyof Names

export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Nom affiché dans la langue choisie ; repli sur l'anglais. */
export function label(kind: NameKind, key: string, lang: Lang): string {
  if (!key) return ''
  const e = NAMES[kind][key]
  if (!e) return key
  return lang === 'fr' ? e.fr : e.en
}

export interface SearchEntry {
  key: string
  fr: string
  en: string
  nfr: string
  nen: string
}

const indexCache = new Map<NameKind, SearchEntry[]>()

export function searchIndex(kind: NameKind, keys?: string[]): SearchEntry[] {
  if (keys) return keys.map(toEntry(kind))
  let idx = indexCache.get(kind)
  if (!idx) {
    idx = Object.keys(NAMES[kind]).map(toEntry(kind))
    indexCache.set(kind, idx)
  }
  return idx
}

function toEntry(kind: NameKind) {
  return (key: string): SearchEntry => {
    const e = NAMES[kind][key] ?? { fr: key, en: key }
    return { key, fr: e.fr, en: e.en, nfr: normalize(e.fr), nen: normalize(e.en) }
  }
}

/** Recherche : on cherche dans les deux langues à la fois, préfixe d'abord, puis contenu. */
export function search(entries: SearchEntry[], query: string, lang: Lang, limit = 12): SearchEntry[] {
  const q = normalize(query)
  if (!q) return entries.slice(0, limit)
  const starts: SearchEntry[] = []
  const contains: SearchEntry[] = []
  for (const e of entries) {
    const a = lang === 'fr' ? e.nfr : e.nen
    const b = lang === 'fr' ? e.nen : e.nfr
    if (a.startsWith(q) || b.startsWith(q)) starts.push(e)
    else if (a.includes(q) || b.includes(q)) contains.push(e)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit)
}
