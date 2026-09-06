// Incrémente le numéro de version (x.y.Z -> x.y.Z+1) dans package.json, src-tauri/Cargo.toml et src-tauri/Cargo.lock.
// Affiche la nouvelle version. Usage : node scripts/bump-version.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const [a, b, c] = pkg.version.split('.').map(Number)
const next = `${a}.${b}.${c + 1}`
pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const toml = new URL('../src-tauri/Cargo.toml', import.meta.url)
writeFileSync(toml, readFileSync(toml, 'utf8').replace(/^version = ".*"$/m, `version = "${next}"`))
try {
  const lock = new URL('../src-tauri/Cargo.lock', import.meta.url)
  const txt = readFileSync(lock, 'utf8').replace(/(name = "calcritique"\nversion = ")[^"]+(")/, `$1${next}$2`)
  writeFileSync(lock, txt)
} catch { /* pas de Cargo.lock */ }
console.log(next)
