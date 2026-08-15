# Cortex — project memory

Electron + React + TypeScript note-taking app: Notes, Diary, Contacts, Calendar, Tags, all stored as plain markdown files in a user-chosen vault folder. This file is a handoff of everything done in the 2026-08-15 session, for picking the project back up.

## Git workflow (already set up — follow it)

- **`development`** is the working branch. Do all work there, commit and push freely.
- **`master`** is protected: no direct pushes, no force-push, no deletion, requires a PR to merge (bypass list is empty — applies to everyone, including automation).
- Flow: commit to `development` → open a PR `development` → `master` → merge. Use the GitHub MCP tools (`create_pull_request` / `merge_pull_request`) for this.
- **This sandbox cannot delete git branches or tags** — `git push origin --delete <ref>` gets a 403 from GitHub's policy layer. That's expected, not a bug to fix. If a branch/tag ever needs deleting, ask the user to do it from their own machine (a normal user push isn't restricted the way this session's is).

## Release automation

- `npm run release -- <patch|minor|major>` (script: `scripts/bump-version.mjs`) bumps `package.json`'s version and commits it. Run this on a branch **before** merging to master.
- `.github/workflows/release.yml`: on push to `master`, tags `vX.Y.Z` if the version changed, then explicitly dispatches `build.yml` via `workflow_dispatch`.
- `.github/workflows/build.yml`: builds Win/Mac/Linux installers; creates a GitHub Release (with installers attached) when the ref is a tag.
- **Important gotcha (already fixed, but good to remember)**: a tag pushed *by a workflow* using the default `GITHUB_TOKEN` does **not** trigger other workflows — GitHub's anti-recursion safeguard. That's why `release.yml` explicitly dispatches `build.yml` instead of relying on the tag push to cascade. A tag pushed by an actual human account triggers normally.
- Current state: **v0.1.0 is live** with all 4 installers built and attached (dmg, exe, AppImage, deb). Verified via `mcp__github__get_latest_release`.
- Minor known gap: the `v0.1.0` build was built from a commit one behind `development`'s tip — it's missing the `Icon\r`-hiding fix specifically (cosmetic: a stray `Icon?` file may still show in that particular build's vault folders on macOS). Not worth fixing retroactively; next release will include it.

## Feature work done this session

### Contacts — `@mention` tagging
`@Name` mentions of a real contact are colored, clickable, and navigable in both edit and read mode, with a Back button to return to the originating note. No closing delimiter (unlike `[[wiki links]]`), so matching is done against the live contact list (longest name wins) — plain `@word` that isn't a contact stays unstyled.
- `src/codemirror/live-preview.ts` — decoration + click handling in the editor
- `src/utils/contact-mentions.ts` — matching logic (shared between editor and preview)
- `src/components/MarkdownPreview.tsx` — read-mode rendering

### Vault structure & self-healing
- New/reopened vaults get `.settings/vault.cortex` (marker file: vault name + creation date, custom DSL format) and `.settings/folder-icon.png`, both written once and never overwritten.
- **Every app launch** now re-runs `ensureVaultFolders()` (via `initVault()` in `electron/vault-manager.ts`), so any minimum folder, the marker, or the icon that got deleted externally is silently reinstated.
- macOS only: the vault folder gets the app icon **badged onto the standard folder shape** (like Obsidian), not a full icon replacement — composites `NSImage` "NSFolder" + the app icon via an `osascript -l JavaScript` (JXA) script in `applyMacFolderIcon()`. The companion `Icon\r` file (macOS's standard mechanism for custom folder icons) is explicitly hidden via `chflags hidden` afterward.
- **⚠️ Never visually verified** — this sandbox has no macOS. The JXA compositing code follows the standard pattern but hasn't been confirmed to actually look right in Finder. **Ask the user how it looks** before assuming it's done.
- Bug fixed: `FileBrowser.tsx`'s `activeFolder` state didn't reset on zone switch, so "New Note" could target a stale folder from a previously-viewed zone (e.g. after browsing Diary, then switching to Notes with nothing selected) and error out.

### Calendar
- Events can link **contacts, notes, and diary entries** — click an event to open `EventDetailModal.tsx`, which shows each as removable chips with an add-picker. Clicking a linked item saves the current note and navigates there.
- `CalendarEvent` type extended with `contactIds?`, `notePaths?`, `diaryDates?` (packages/core/src/types.ts), stored as comma-separated frontmatter in `electron/calendar-store.ts`.
- Selecting a diary-less date now shows an "Add diary entry" button instead of doing nothing.

### Notes / Diary wikilinks
- `[[YYYY-MM-DD]]` always resolves/creates a **real diary entry** (via `openDiaryEntry`) instead of falling through to a plain note in `notes/`. Handled in `CenterPanel.tsx`'s `handleWikiLinkNavigate`/`handleWikiLinkEnsure`.
- Wikilink autocomplete (`src/utils/wiki-links.ts`) sorts diary-dated matches to the top, newest first.

### Tags — several real bugs found and fixed
1. **Contact tags never appeared in the global tag index.** Root cause: `parseLegacyFrontmatterTags`'s regex used `\s*` (matches newlines) instead of `[ \t]*`, so an empty `tags: ` frontmatter line let the regex bleed into the *next* line (`created: <timestamp>`) and capture it as if it were the tag value — surfacing as a bogus `#created: 2026-...` tag. Fixed in `packages/core/src/tags.ts`. Also hardened `buildFrontmatter` (`electron/markdown-files.ts`) to never write empty-array fields at all.
2. **Diary entries were invisible to the tag index AND to wikilink autocomplete AND to the Links panel.** Root cause: `listMarkdownFiles` (electron/storage.ts) is shared by three different callers with different needs, and its hidden-path filter computed paths relative to the vault root even when the walk was scoped to a hidden-but-intentional folder like `diary/` — so every file inside `diary/` was always flagged "hidden" and filtered out, no matter who called it. Fixed by checking hidden-ness relative to the actual walk root, and giving `listMarkdownFiles` an explicit `{ skipHiddenPaths }` option (`indexAllTags` opts out since it must scan everything; `listFiles('notes'/'diary')` keep the default). **If you touch `listMarkdownFiles` again, remember it has 3 call sites with different requirements — check all of them.**
3. **Tag legend showed stale tags after removal.** Applying tag changes went through the debounced save path, which never refreshed the tag index. `handleApplyTags`/`handleApplyContactTags` in `CenterPanel.tsx` now flush the save immediately and call `onRefresh()` right after.
4. **Links panel ("Links from/to this file") didn't work for diary entries at all** — only fetched `listFiles('notes')`. Fixed to also fetch diary files (`src/components/LinksPanel.tsx`).
5. Contact tags now use the same chip-based `TagsPopup` editor as notes/diary (was a raw comma-separated text input).
6. Tag search/filtering **moved from the right panel to the left panel** (near the file browser) per user's explicit choice — the old `TagLegend` component already had an unused `sidebar` variant, suggesting this was half-planned. Now also correctly filters the Contacts list (previously had zero effect there).

### Misc
- `About Cortex` menu now reads `app.getVersion()` instead of a hardcoded string — stays correct automatically through the release pipeline.

## Testing approach used (worth repeating)

This sandbox is headless Linux with no way to visually test Electron normally. The approach that worked well: drive the **actual built app** with Playwright under `xvfb-run`, not just unit/type checks.

```bash
npm run build   # tsc && vite build, produces dist/ + dist-electron/
xvfb-run -a node your-test-script.mjs
```

Script pattern: `playwright-core`'s `_electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['--no-sandbox', '.'] })`, then bypass native dialogs by calling `window.cortex.*` IPC APIs directly via `page.evaluate(...)` (e.g. `window.cortex.vault.createNew(path, name)` instead of the native folder picker). Screenshot liberally to verify visually, not just via `page.evaluate` return values. This caught several real bugs (the tag/diary issues above) that type-checking alone would never have found — **keep testing this way, don't settle for "it type-checks."**

## Quick file map

| Area | Key files |
|---|---|
| Vault lifecycle, self-healing, macOS folder icon | `electron/vault-manager.ts` |
| Notes/diary file ops, tag indexing | `electron/storage.ts` |
| Calendar event storage | `electron/calendar-store.ts` |
| Contact storage | `electron/contacts-store.ts` |
| Tag parsing (frontmatter + inline + block) | `packages/core/src/tags.ts` |
| Shared types | `packages/core/src/types.ts` |
| Note/diary/contact editing, wikilink + tag handlers | `src/components/CenterPanel.tsx` |
| Calendar UI + event linking modal | `src/components/CalendarPanel.tsx`, `src/components/EventDetailModal.tsx` |
| File tree (Notes/Diary zones) | `src/components/FileBrowser.tsx` |
| Left sidebar (zones, file browser, tag legend) | `src/components/LeftPanel.tsx` |
| Right sidebar (Calendar, Links tabs) | `src/components/RightPanel.tsx` |
| Backlinks / outgoing links | `src/components/LinksPanel.tsx` |
| Editor decorations (wikilinks, @mentions) | `src/codemirror/live-preview.ts` |
| Wikilink resolution + diary sorting | `src/utils/wiki-links.ts` |
| @mention matching | `src/utils/contact-mentions.ts` |
| Version bump script | `scripts/bump-version.mjs` |
| Release pipeline | `.github/workflows/release.yml`, `.github/workflows/build.yml` |

## Open items for next session

1. **Ask the user how the macOS folder icon looks** in Finder — first real chance to verify it since this sandbox can't render it.
2. If they want the cosmetic `v0.1.0` gap (missing `Icon\r` hide) fixed, it'll happen automatically on the next version bump — no action needed unless they ask sooner.
3. No other known bugs open as of end of session.
