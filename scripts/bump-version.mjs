#!/usr/bin/env node
// Bumps package.json's version, commits the bump, and leaves it ready to push.
// Usage: npm run release -- <patch|minor|major>
//
// Does NOT create a git tag or push anything — that happens automatically
// once this commit lands on master (see .github/workflows/release.yml).
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const type = process.argv[2]

if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: npm run release -- <patch|minor|major>')
  process.exit(1)
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

const status = execSync('git status --porcelain').toString().trim()
if (status) {
  console.error('Working tree is not clean. Commit or stash your changes first.')
  process.exit(1)
}

run(`npm version ${type} --no-git-tag-version`)

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))

run('git add package.json package-lock.json')
run(`git commit -m "chore(release): v${version}"`)

console.log(`\nBumped to v${version} and committed.`)
console.log('Push this branch and merge it into master — the release workflow')
console.log(`will tag v${version} and build/publish it automatically once it lands.`)
