// Bibliothèque : sets et équipes enregistrés par l'utilisateur, avec export / import en fichier JSON.
import { useMemo, useRef, useState } from 'react'
import type { Lang, PokemonState, SideKey } from '../model'
import { STAT_KEYS } from '../model'
import { dict } from '../i18n'
import { label, normalize } from '../lib/names'
import { cleanSet, downloadText, exportLibraryJSON, fixLibrary, mergeLibrary, newId, type Library, type SavedSet, type SavedTeam } from '../lib/library'
import Modal from './Modal'
import TypeBadge from './TypeBadge'
import { SPRITES } from './Tooltips'
import { moveInfo } from '../lib/engine'
import { exportPokemon, exportTeam, parseTeam } from '../lib/showdown'

interface Props {
  library: Library
  onChange: (lib: Library) => void
  teams: Record<SideKey, PokemonState[]>
  onLoadSet: (side: SideKey, p: PokemonState) => void
  onLoadTeam: (side: SideKey, team: PokemonState[]) => void
  lang: Lang
  onClose: () => void
  initialTab?: 'sets' | 'teams' | 'showdown'
}

export default function LibraryModal({ library, onChange, teams, onLoadSet, onLoadTeam, lang, onClose, initialTab }: Props) {
  const t = dict(lang)
  const [tab, setTab] = useState<'sets' | 'teams' | 'showdown'>(initialTab ?? 'sets')
  const [sdText, setSdText] = useState('')
  const [sdWarnings, setSdWarnings] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const sets = useMemo(() => {
    const nq = normalize(q)
    return library.sets
      .filter((s) => !nq || normalize(s.name).includes(nq) || normalize(label('species', s.pokemon.species, lang)).includes(nq) || normalize(s.pokemon.species).includes(nq))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [library.sets, q, lang])

  const flash = (m: string) => { setMessage(m); window.setTimeout(() => setMessage(''), 2500) }

  function saveTeam(side: SideKey) {
    const team = teams[side].map(cleanSet)
    const first = team.find((p) => p.species)
    if (!first) return
    const name = `${t.team1.replace('1', side === 'left' ? '1' : '2')} · ${new Date().toLocaleDateString()}`
    onChange({ ...library, teams: [{ id: newId(), name, team, createdAt: Date.now() }, ...library.teams] })
    flash(t.libSaved)
  }
  function removeSet(id: string) { onChange({ ...library, sets: library.sets.filter((s) => s.id !== id) }) }
  function removeTeam(id: string) { onChange({ ...library, teams: library.teams.filter((s) => s.id !== id) }) }
  function duplicateSet(s: SavedSet) { onChange({ ...library, sets: [{ ...s, id: newId(), name: s.name + ' (2)', createdAt: Date.now() }, ...library.sets] }) }
  function rename(id: string, name: string) {
    onChange({ ...library, sets: library.sets.map((s) => (s.id === id ? { ...s, name } : s)), teams: library.teams.map((s) => (s.id === id ? { ...s, name } : s)) })
    setRenaming(null)
  }
  function doExport() {
    downloadText(`calcritique-bibliotheque-${new Date().toISOString().slice(0, 10)}.json`, exportLibraryJSON(library))
  }
  async function copyExport() {
    try { await navigator.clipboard.writeText(exportLibraryJSON(library)); flash(t.libCopied) } catch { flash(t.libCopyFailed) }
  }
  function doImport(file: File) {
    file.text().then((txt) => {
      try {
        const imported = fixLibrary(JSON.parse(txt))
        onChange(mergeLibrary(library, imported))
        flash(t.libImported(imported.sets.length, imported.teams.length))
      } catch {
        flash(t.libImportFailed)
      }
    })
  }

  return (
    <Modal title={t.library} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
        <div className="flex overflow-hidden rounded border border-border">
          {(['sets', 'teams', 'showdown'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={'px-3 py-1 font-semibold ' + (tab === k ? 'bg-accent text-white' : 'text-muted hover:text-text')}>
              {k === 'sets' ? `${t.libSets} (${library.sets.length})` : k === 'teams' ? `${t.libTeams} (${library.teams.length})` : t.libShowdown}
            </button>
          ))}
        </div>
        {tab === 'sets' && <input className="input !w-56" placeholder={t.libSearch} value={q} onChange={(e) => setQ(e.target.value)} />}
        {tab === 'teams' && (
          <>
            <button type="button" onClick={() => saveTeam('left')} className="rounded border border-accent/60 bg-accent/10 px-2 py-1 hover:bg-accent/20">💾 {t.libSaveTeam(1)}</button>
            <button type="button" onClick={() => saveTeam('right')} className="rounded border border-sky-400/60 bg-sky-400/10 px-2 py-1 hover:bg-sky-400/20">💾 {t.libSaveTeam(2)}</button>
          </>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {message && <span className="text-emerald-300">{message}</span>}
          <button type="button" onClick={doExport} className="rounded border border-border px-2 py-1 hover:text-text">⬇ {t.libExport}</button>
          <button type="button" onClick={copyExport} className="rounded border border-border px-2 py-1 hover:text-text">📋 {t.libCopy}</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded border border-border px-2 py-1 hover:text-text">⬆ {t.libImport}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
        </span>
      </div>
      <p className="px-4 pt-2 text-[11px] text-muted">{tab === 'teams' ? t.libTeamsHint : tab === 'showdown' ? t.sdHint : t.libHint}</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === 'sets' && (
          sets.length === 0 ? <p className="text-sm text-muted">{t.libEmptySets}</p> : (
            <div className="flex flex-col gap-2">
              {sets.map((s) => (
                <SetCard
                  key={s.id}
                  set={s}
                  lang={lang}
                  renaming={renaming?.id === s.id ? renaming.name : null}
                  onRenameStart={() => setRenaming({ id: s.id, name: s.name })}
                  onRenameChange={(name) => setRenaming({ id: s.id, name })}
                  onRenameDone={() => renaming && rename(s.id, renaming.name)}
                  onLoad={(side) => { onLoadSet(side, s.pokemon); flash(t.libLoaded) }}
                  onDuplicate={() => duplicateSet(s)}
                  onRemove={() => removeSet(s.id)}
                />
              ))}
            </div>
          )
        )}
        {tab === 'showdown' && (
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSdText(exportTeam(teams.left))} className="rounded border border-accent/60 bg-accent/10 px-2 py-1 hover:bg-accent/20">{t.sdExport(1)}</button>
              <button type="button" onClick={() => setSdText(exportTeam(teams.right))} className="rounded border border-sky-400/60 bg-sky-400/10 px-2 py-1 hover:bg-sky-400/20">{t.sdExport(2)}</button>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(sdText); flash(t.libCopied) } catch { flash(t.libCopyFailed) } }} className="rounded border border-border px-2 py-1 hover:text-text">📋 {t.libCopy}</button>
            </div>
            <textarea className="input min-h-64 font-mono text-[11px]" value={sdText} onChange={(e) => setSdText(e.target.value)} placeholder={t.sdPlaceholder} spellCheck={false} />
            <div className="flex flex-wrap items-center gap-2">
              {(['left', 'right'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => {
                    const r = parseTeam(sdText)
                    setSdWarnings(r.warnings)
                    if (r.team.length === 0) { flash(t.sdNothing); return }
                    if (r.team.length === 1) onLoadSet(side, r.team[0]) // un seul Pokémon : dans l'emplacement sélectionné
                    else {
                      const full = [...r.team]
                      while (full.length < 6) full.push(teams[side][full.length] ?? cleanSet({ ...r.team[0], species: '' }))
                      onLoadTeam(side, full.slice(0, 6))
                    }
                    flash(t.sdImported(r.team.length))
                  }}
                  className={'rounded border px-2 py-1 ' + (side === 'left' ? 'border-accent/60 bg-accent/10 hover:bg-accent/20' : 'border-sky-400/60 bg-sky-400/10 hover:bg-sky-400/20')}
                >
                  ⬆ {t.sdImport(side === 'left' ? 1 : 2)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const r = parseTeam(sdText)
                  setSdWarnings(r.warnings)
                  if (r.team.length === 0) { flash(t.sdNothing); return }
                  const sets = r.team.map((p) => ({ id: newId(), name: `${label('species', p.species, lang)}${p.item ? ' ' + label('items', p.item, lang) : ''}`, pokemon: cleanSet(p), createdAt: Date.now() }))
                  onChange({ ...library, sets: [...sets, ...library.sets] })
                  flash(t.sdSavedSets(sets.length))
                }}
                className="rounded border border-border px-2 py-1 hover:text-text"
              >
                💾 {t.sdToLibrary}
              </button>
            </div>
            {sdWarnings.length > 0 && <ul className="list-disc pl-5 text-orange-300">{sdWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
        )}
        {tab === 'teams' && (
          library.teams.length === 0 ? <p className="text-sm text-muted">{t.libEmptyTeams}</p> : (
            <div className="flex flex-col gap-2">
              {library.teams.map((tm) => (
                <TeamCard
                  key={tm.id}
                  team={tm}
                  lang={lang}
                  renaming={renaming?.id === tm.id ? renaming.name : null}
                  onRenameStart={() => setRenaming({ id: tm.id, name: tm.name })}
                  onRenameChange={(name) => setRenaming({ id: tm.id, name })}
                  onRenameDone={() => renaming && rename(tm.id, renaming.name)}
                  onLoad={(side) => { onLoadTeam(side, tm.team); flash(t.libLoaded) }}
                  onRemove={() => removeTeam(tm.id)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </Modal>
  )
}

function spLine(p: PokemonState, lang: Lang): string {
  const t = dict(lang)
  return STAT_KEYS.filter((k) => p.sp[k] > 0).map((k) => `${p.sp[k]} ${t.statNames[k]}`).join(' / ') || '0 SP'
}

function RenameBox({ name, renaming, onStart, onChange, onDone }: { name: string; renaming: string | null; onStart: () => void; onChange: (v: string) => void; onDone: () => void }) {
  if (renaming !== null) {
    return (
      <input
        autoFocus
        className="input !w-56 !py-0.5 text-sm"
        value={renaming}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onDone() }}
        onBlur={onDone}
      />
    )
  }
  return <button type="button" onClick={onStart} title="✎" className="truncate text-left text-sm font-semibold hover:underline">{name || '·'}</button>
}

function SetCard({ set, lang, renaming, onRenameStart, onRenameChange, onRenameDone, onLoad, onDuplicate, onRemove }: {
  set: SavedSet; lang: Lang; renaming: string | null; onRenameStart: () => void; onRenameChange: (v: string) => void; onRenameDone: () => void
  onLoad: (side: SideKey) => void; onDuplicate: () => void; onRemove: () => void
}) {
  const t = dict(lang)
  const p = set.pokemon
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface-2 p-2">
      {SPRITES[p.species] && <img src={SPRITES[p.species]} alt="" className="h-12 w-12 shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <RenameBox name={set.name} renaming={renaming} onStart={onRenameStart} onChange={onRenameChange} onDone={onRenameDone} />
          <span className="text-xs text-muted">{label('species', p.species, lang)}</span>
          {p.teraType && <TypeBadge type={p.teraType} lang={lang} small tera />}
        </div>
        <div className="text-[11px] text-muted">
          {p.item ? label('items', p.item, lang) : t.none} · {label('abilities', p.ability, lang) || '·'} · {label('natures', p.nature, lang)} · {spLine(p, lang)}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {p.moves.filter(Boolean).map((m) => {
            const info = moveInfo(m)
            return <span key={m} className="flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[11px]">{info && <TypeBadge type={info.type} lang={lang} small />}{label('moves', m, lang)}</span>
          })}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 text-[11px]">
        <button type="button" onClick={() => onLoad('left')} className="rounded border border-accent/60 bg-accent/10 px-2 py-0.5 hover:bg-accent/20">→ {t.team1}</button>
        <button type="button" onClick={() => onLoad('right')} className="rounded border border-sky-400/60 bg-sky-400/10 px-2 py-0.5 hover:bg-sky-400/20">→ {t.team2}</button>
        <span className="flex gap-1">
          <button type="button" onClick={onDuplicate} title={t.libDuplicate} className="flex-1 rounded border border-border px-1 py-0.5 text-muted hover:text-text">⧉</button>
          <button type="button" onClick={() => { navigator.clipboard.writeText(exportPokemon(p)).catch(() => undefined) }} title={t.sdCopySet} className="flex-1 rounded border border-border px-1 py-0.5 text-muted hover:text-text">📋</button>
          <button type="button" onClick={onRenameStart} title={t.libRename} className="flex-1 rounded border border-border px-1 py-0.5 text-muted hover:text-text">✎</button>
          <button type="button" onClick={onRemove} title={t.libDelete} className="flex-1 rounded border border-border px-1 py-0.5 text-muted hover:border-accent hover:text-accent">🗑</button>
        </span>
      </div>
    </div>
  )
}

function TeamCard({ team, lang, renaming, onRenameStart, onRenameChange, onRenameDone, onLoad, onRemove }: {
  team: SavedTeam; lang: Lang; renaming: string | null; onRenameStart: () => void; onRenameChange: (v: string) => void; onRenameDone: () => void
  onLoad: (side: SideKey) => void; onRemove: () => void
}) {
  const t = dict(lang)
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface-2 p-2">
      <div className="min-w-0 flex-1">
        <RenameBox name={team.name} renaming={renaming} onStart={onRenameStart} onChange={onRenameChange} onDone={onRenameDone} />
        <div className="mt-1 flex flex-wrap gap-2">
          {team.team.filter((p) => p.species).map((p, i) => (
            <span key={i} className="flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[11px]">
              {SPRITES[p.species] && <img src={SPRITES[p.species]} alt="" className="inline-block h-6 w-6 object-contain align-middle" style={{ imageRendering: 'pixelated' }} />}
              {label('species', p.species, lang)}
              <span className="text-muted">{p.item ? label('items', p.item, lang) : ''}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 text-[11px]">
        <button type="button" onClick={() => onLoad('left')} className="rounded border border-accent/60 bg-accent/10 px-2 py-0.5 hover:bg-accent/20">→ {t.team1}</button>
        <button type="button" onClick={() => onLoad('right')} className="rounded border border-sky-400/60 bg-sky-400/10 px-2 py-0.5 hover:bg-sky-400/20">→ {t.team2}</button>
        <span className="flex gap-1">
          <button type="button" onClick={onRenameStart} title={t.libRename} className="flex-1 rounded border border-border px-1 py-0.5 text-muted hover:text-text">✎</button>
          <button type="button" onClick={onRemove} title={t.libDelete} className="flex-1 rounded border border-border px-1 py-0.5 text-muted hover:border-accent hover:text-accent">🗑</button>
        </span>
      </div>
    </div>
  )
}
