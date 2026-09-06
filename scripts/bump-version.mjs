// Incrémente le numéro de version (x.y.Z -> x.y.Z+1) dans package.json, src-tauri/Cargo.toml et src-tauri/Cargo.lock.
// Affiche la nouvelle version. Usage : node scripts/bump-version.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const [a, b, c] = pkg.version.split('.').map(Number)
const next = `${a}.${b}.${c + 1}`
pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// package-lock.json : la version du paquet racine apparaît deux fois en tête de fichier
const lockPath = new URL('../package-lock.json', import.meta.url)
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  lock.version = next
  if (lock.packages && lock.packages['']) lock.packages[''].version = next
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
} catch { /* pas de package-lock */ }

const toml = new URL('../src-tauri/Cargo.toml', import.meta.url)
writeFileSync(toml, readFileSync(toml, 'utf8').replace(/^version = ".*"$/m, `version = "${next}"`))
try {
  const lock = new URL('../src-tauri/Cargo.lock', import.meta.url)
  const txt = readFileSync(lock, 'utf8').replace(/(name = "calcritique"\nversion = ")[^"]+(")/, `$1${next}$2`)
  writeFileSync(lock, txt)
} catch { /* pas de Cargo.lock */ }
console.log(next)
