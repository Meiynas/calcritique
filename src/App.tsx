import { useEffect, useState } from 'react'
import { APP_VERSION, checkForUpdate, isDesktop, type UpdateStatus } from './updater'

export default function App() {
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    if (!isDesktop()) return
    checkForUpdate(setUpdate)
  }, [])

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-accent" />
            <h1 className="text-xl font-semibold tracking-tight">Calcritique</h1>
            <span className="text-xs text-muted">v{APP_VERSION}</span>
          </div>
          <nav className="text-sm text-muted">Pokémon Champions</nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-xl border border-border bg-surface p-8">
            <h2 className="text-2xl font-semibold mb-2">Le squelette est en place</h2>
            <p className="text-muted max-w-prose">
              Calcritique est un calculateur de dégâts pour Pokémon Champions. Cette première
              version ne calcule encore rien : elle sert à vérifier que le logiciel s'installe,
              se lance et se met à jour tout seul.
            </p>

            <div className="mt-6 rounded-lg border border-border bg-surface-2 p-4 text-sm">
              <UpdateBanner status={update} />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border text-xs text-muted">
        <div className="mx-auto max-w-6xl px-6 py-3">
          Calcritique n'est pas affilié à Nintendo, Game Freak ou The Pokémon Company.
        </div>
      </footer>
    </div>
  )
}

function UpdateBanner({ status }: { status: UpdateStatus }) {
  if (!isDesktop()) return <span>Version site : les mises à jour sont automatiques.</span>
  switch (status.state) {
    case 'idle':
    case 'checking':
      return <span>Recherche d'une mise à jour…</span>
    case 'none':
      return <span>Vous avez la dernière version.</span>
    case 'available':
      return <span>Mise à jour {status.version} disponible, téléchargement en cours…</span>
    case 'installing':
      return <span>Installation de la mise à jour, le logiciel va redémarrer.</span>
    case 'error':
      return <span className="text-accent">Mise à jour impossible : {status.message}</span>
  }
}
