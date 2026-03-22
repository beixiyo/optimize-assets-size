import { execSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit' })

// ESM
run('bun build src/bin.ts src/index.ts --outdir dist --target node --format esm --packages external')

// CJS
run('bun build src/index.ts --outdir .tmp-cjs --target node --format cjs --packages external')

cpSync('.tmp-cjs/index.js', 'dist/index.cjs')
rmSync('.tmp-cjs', { recursive: true, force: true })
