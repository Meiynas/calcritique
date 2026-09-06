// Fenêtre de choix de Pokémon : suggestions de coéquipiers (stats d'usage), puis tout le pool légal,
// avec filtres par type, stats de base minimales et attaques requises (groupes "A OU B").
import { useMemo, useState } from 'react'
import type { Lang, StatKey } from '../model'
import { STAT_KEYS } from '../model'
import { dict } from '../i18n'
import { label, normalize } from '../lib/names'
import { EXTRA, megaAbility, speciesInfo, TYPE_NAMES } from '../lib/engine'
import { canLearn, LEGAL_SPECIES, teammateScores, USAGE } from '../lib/usage'
import Modal from './Modal'
import TypeBadge from './TypeBadge'
import { Hover, PokemonTip, SPRITES } from './Tooltips'
import SearchSelect from './SearchSelect'

interface Props {
  team: string[] // espèces déjà dans l'équipe (pour les suggestions)
  lang: Lang
  onPick: (species: string) => void
  onClose: () => void
}

/** Talents possibles d'une espèce (PokéAPI), ou le talent imposé pour une Méga */
function speciesAbilities(species: string): string[] {
  const mega = megaAbility(species)
  if (mega) return [mega]
  return EXTRA.species[species]?.abilities ?? []
}

export default function PokemonPicker({ team, lang, onPick, onClose }: Props) {
  const t = dict(lang)
  const [query, setQuery] = useState('')
  const [type1, setType1] = useState('')
  const [type2, setType2] = useState('')
  const [minStats, setMinStats] = useState<Partial<Record<StatKey, number>>>({})
  const [moveGroups, setMoveGroups] = useState<string[][]>([])
  const [draft, setDraft] = useState('')
  // Talents requis : plusieurs groupes "ET", chaque groupe = un talent OU un autre
  const [abilityGroups, setAbilityGroups] = useState<string[][]>([])
  const [abilityDraft, setAbilityDraft] = useState('')

  const suggestions = useMemo(() => teammateScores(team.filter(Boolean)), [team])
  const teamSet = new Set(team.filter(Boolean))
  const q = normalize(query)

  const matches = (species: string) => {
    const info = speciesInfo(species)
    if (!info) return false
    if (teamSet.has(species)) return false
    if (q && !normalize(label('species', species, 'fr')).includes(q) && !normalize(label('species', species, 'en')).includes(q)) return false
    const types = info.types as string[]
    if (type1 && !types.includes(type1)) return false
    if (type2 && !types.includes(type2)) return false
    for (const k of STAT_KEYS) {
      const min = minStats[k]
      if (min && info.baseStats[k] < min) return false
    }
    for (const group of moveGroups) {
      if (group.length && !group.some((m) => canLearn(species, m))) return false
    }
    const abilities = speciesAbilities(species)
    for (const group of abilityGroups) {
      if (group.length && !group.some((a) => abilities.includes(a))) return false
    }
    return true
  }

  const suggested = suggestions.filter((s) => matches(s.species)).slice(0, 10)
  const suggestedSet = new Set(suggested.map((s) => s.species))
  const restAll = LEGAL_SPECIES.filter((s) => !suggestedSet.has(s) && matches(s)).sort((a, b) => label('species', a, lang).localeCompare(label('species', b, lang)))
  const rest = restAll.filter((s) => !s.includes('-Mega'))
  const megas = restAll.filter((s) => s.includes('-Mega'))

  function addToGroup(gi: number, move: string) {
    if (!move) return
    setMoveGroups((gs) => gs.map((g, i) => (i === gi && !g.includes(move) ? [...g, move] : g)))
  }
  function removeFromGroup(gi: number, move: string) {
    setMoveGroups((gs) => gs.map((g, i) => (i === gi ? g.filter((m) => m !== move) : g)).filter((g) => g.length > 0))
  }
  function addAbility(gi: number, ability: string) {
    if (!ability) return
    setAbilityGroups((gs) => gs.map((g, i) => (i === gi && !g.includes(ability) ? [...g, ability] : g)))
  }
  function removeAbility(gi: number, ability: string) {
    setAbilityGroups((gs) => gs.map((g, i) => (i === gi ? g.filter((a) => a !== ability) : g)).filter((g) => g.length > 0))
  }

  return (
    <Modal title={t.pickPokemon} onClose={onClose} wide>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input autoFocus className="input !w-56" placeholder={t.searchPokemon} value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input !w-auto" value={type1} onChange={(e) => setType1(e.target.value)}>
            <option value="">{t.type} 1</option>
            {TYPE_NAMES.map((ty) => <option key={ty} value={ty}>{label('types', ty, lang)}</option>)}
          </select>
          <select className="input !w-auto" value={type2} onChange={(e) => setType2(e.target.value)}>
            <option value="">{t.type} 2</option>
            {TYPE_NAMES.map((ty) => <option key={ty} value={ty}>{label('types', ty, lang)}</option>)}
          </select>
          <span className="text-xs text-muted">{t.minBaseStats} :</span>
          {STAT_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-1 text-xs text-muted">
              {t.statNames[k]}
              <input
                type="number" min={0} max={255} placeholder="·"
                value={minStats[k] ?? ''}
                onChange={(e) => setMinStats((m) => ({ ...m, [k]: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-12 rounded border border-border bg-surface-2 px-1 py-0.5 text-center text-text"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t.requiredMoves} :</span>
          {moveGroups.map((g, gi) => (
            <span key={gi} className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs">
              {g.map((m, mi) => (
                <span key={m} className="flex items-center gap-1">
                  {mi > 0 && <span className="font-semibold text-accent">{t.or}</span>}
                  <span>{label('moves', m, lang)}</span>
                  <button type="button" onClick={() => removeFromGroup(gi, m)} className="text-muted hover:text-text">×</button>
                </span>
              ))}
              <SearchSelect kind="moves" value="" onChange={(m) => addToGroup(gi, m)} lang={lang} placeholder={t.or + '…'} className="w-28" />
            </span>
          ))}
          <div className="flex items-center gap-1">
            <SearchSelect kind="moves" value={draft} onChange={(m) => { if (m) { setMoveGroups((gs) => [...gs, [m]]); setDraft('') } }} lang={lang} placeholder={t.addRequiredMove} className="w-44" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t.requiredAbilities} :</span>
          {abilityGroups.map((g, gi) => (
            <span key={gi} className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs">
              {g.map((a, ai) => (
                <span key={a} className="flex items-center gap-1">
                  {ai > 0 && <span className="font-semibold text-accent">{t.or}</span>}
                  <span>{label('abilities', a, lang)}</span>
                  <button type="button" onClick={() => removeAbility(gi, a)} className="text-muted hover:text-text">×</button>
                </span>
              ))}
              <SearchSelect kind="abilities" value="" onChange={(a) => addAbility(gi, a)} lang={lang} placeholder={t.or + '…'} className="w-28" />
            </span>
          ))}
          <div className="flex items-center gap-1">
            <SearchSelect kind="abilities" value={abilityDraft} onChange={(a) => { if (a) { setAbilityGroups((gs) => [...gs, [a]]); setAbilityDraft('') } }} lang={lang} placeholder={t.addRequiredAbility} className="w-44" />
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {suggested.length > 0 && (
          <>
            <Title>{t.suggestedTeammates}</Title>
            {suggested.map((s) => (
              <Row key={s.species} species={s.species} lang={lang} onPick={onPick} note={`${t.affinity} ${s.score} · ${s.from.map((f) => label('species', f, lang)).join(', ')}`} />
            ))}
          </>
        )}
        <Title>{t.allPokemon} ({rest.length})</Title>
        {rest.map((s) => <Row key={s} species={s} lang={lang} onPick={onPick} />)}
        {megas.length > 0 && <Title>{t.megaSection} ({megas.length})</Title>}
        {megas.map((s) => <Row key={s} species={s} lang={lang} onPick={onPick} />)}
        {rest.length === 0 && megas.length === 0 && suggested.length === 0 && <p className="px-2 py-4 text-sm text-muted">∅</p>}
        <p className="px-2 py-3 text-[10px] text-muted">{t.usageSource} : {USAGE.source}, {USAGE.season}, {USAGE.date}</p>
      </div>
    </Modal>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="sticky top-0 z-10 bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</div>
}

function Row({ species, lang, onPick, note }: { species: string; lang: Lang; onPick: (s: string) => void; note?: string }) {
  const info = speciesInfo(species)!
  const bs = info.baseStats
  return (
    <button type="button" onClick={() => onPick(species)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface-2">
      <Hover tip={<PokemonTip species={species} lang={lang} />} className="flex w-40 shrink-0 items-center gap-1 truncate font-medium">
        {SPRITES[species] && <img src={SPRITES[species]} alt="" className="inline-block h-8 w-8 shrink-0 object-contain align-middle" style={{ imageRendering: 'pixelated' }} />}
        {label('species', species, lang)}
      </Hover>
      <span className="flex w-28 shrink-0 gap-0.5">{info.types.map((ty) => <TypeBadge key={ty} type={ty} lang={lang} small />)}</span>
      <span className="w-52 shrink-0 text-[11px] tabular-nums text-muted">{bs.hp}/{bs.atk}/{bs.def}/{bs.spa}/{bs.spd}/{bs.spe}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-emerald-300">{note ?? ''}</span>
    </button>
  )
}
