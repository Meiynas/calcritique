// Mise à jour automatique du logiciel (version Tauri uniquement).
// Au lancement, on demande à GitHub Releases s'il existe une version plus récente.
// Si oui, on la télécharge, on l'installe et on relance le logiciel.

export const APP_VERSION: string = __APP_VERSION__

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'none' }
  | { state: 'available'; version: string }
  | { state: 'installing' }
  | { state: 'error'; message: string }

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function checkForUpdate(report: (s: UpdateStatus) => void): Promise<void> {
  report({ state: 'checking' })
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const { relaunch } = await import('@tauri-apps/plugin-process')
    const update = await check()
    if (!update) {
      report({ state: 'none' })
      return
    }
    report({ state: 'available', version: update.version })
    await update.downloadAndInstall()
    report({ state: 'installing' })
    await relaunch()
  } catch (e) {
    report({ state: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
