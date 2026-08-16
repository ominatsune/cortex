# Cortex — project memory

Electron + React + TypeScript note-taking app: Notes, Diary, Contacts, Calendar, Tags, all stored as plain markdown files in a user-chosen vault folder. This file is a handoff of everything done, most recently the 2026-08-16 session, for picking the project back up.

## Working environment

As of 2026-08-16, work happens **locally on the user's Mac** (not the earlier cloud/headless-Linux sandbox). This means: real macOS GUI available for visual verification (Finder, the actual app window); OS-level `screencapture` currently fails here (no Screen Recording permission granted to this terminal) — Playwright's own page-level `.screenshot()` still works fine since it captures via CDP, not the OS display.

**⚠️ Never write to `~/Library/Application Support/cortex/cortex-config.json` (or any app config outside the repo) without reading its current value first and knowing exactly how to restore it.** This file points at the user's real vault. A session reset it to `null` after test cleanup without checking what it had held, which caused the user's next real launch to show "select a vault" — they then picked their vault's *parent* folder by mistake (both looked identical — same name, same custom Finder icon), and the app silently scaffolded a brand-new empty vault into it instead of detecting the mistake (full incident + fix below, "Vault-selection safety guards"). No data was lost (recovered by the user directly in Finder), but it was a scare that was entirely avoidable. When a Playwright test needs to launch the real app, pass `--user-data-dir=<scratch path>` to `electron.launch({ args: [...] })` so it never touches the real config at all — don't rely on remembering to reset a shared config file afterward.

## Git workflow (already set up — follow it)

- **`development`** is the working branch. Do all work there, commit and push freely.
- **`master`** is protected: no direct pushes, no force-push, no deletion, requires a PR to merge (bypass list is empty — applies to everyone, including automation).
- Flow: commit to `development` → open a PR `development` → `master` → merge. Use the GitHub MCP tools (`create_pull_request` / `merge_pull_request`) for this.
- The "this sandbox cannot delete git branches/tags" restriction from earlier cloud sessions was specific to that environment's automation token — doesn't necessarily apply when working locally as the actual user.

## Release automation

- `npm run release -- <patch|minor|major>` (script: `scripts/bump-version.mjs`) bumps `package.json`'s version and commits it. Run this on a branch **before** merging to master.
- `.github/workflows/release.yml`: on push to `master`, tags `vX.Y.Z` if the version changed, then explicitly dispatches `build.yml` via `workflow_dispatch`.
- `.github/workflows/build.yml`: builds Win/Mac/Linux installers; creates a GitHub Release (with installers attached) when the ref is a tag.
- **Important gotcha (already fixed, but good to remember)**: a tag pushed *by a workflow* using the default `GITHUB_TOKEN` does **not** trigger other workflows — GitHub's anti-recursion safeguard. That's why `release.yml` explicitly dispatches `build.yml` instead of relying on the tag push to cascade. A tag pushed by an actual human account triggers normally.
- Current state: **v0.1.0 is live** with all 4 installers built and attached (dmg, exe, AppImage, deb). Verified via `mcp__github__get_latest_release`.
- Minor known gap: the `v0.1.0` build was built from a commit one behind `development`'s tip — it's missing the `Icon\r`-hiding fix specifically (cosmetic: a stray `Icon?` file may still show in that particular build's vault folders on macOS). Not worth fixing retroactively; next release will include it.

## Feature work — 2026-08-16 session

### Vault-wide search (v0.2.0 headline feature)
Search bar (top of left panel, live dropdown) + global Cmd/Ctrl+K palette overlay, both searching notes, diary entries, contacts (incl. notes field), calendar events, and tags in one query. Simple case-insensitive substring matching, no new dependencies.
- `electron/search.ts` — `searchVault(query)`, one full-vault walk via `listMarkdownFiles(base, base, { skipHiddenPaths: false })`, dispatches per file by `parseFileType` (contact/calendar/note/diary), capped at 8 results per type.
- Reused `parseContactFile` (`electron/contacts-store.ts`) and `parseEventFile` (`electron/calendar-store.ts`) — both exported (were private) for reuse, no logic changes.
- IPC: `window.cortex.search.query(term)` — `packages/core/src/api.ts` (`CortexSearchAPI`), wired through `electron/preload.ts` + `electron/main.ts` (`search:query` handler) exactly like the existing `tags:index` pattern.
- `src/hooks/useSearch.ts` — shared debounced (150ms) query hook used by both UI surfaces.
- `src/components/SearchBar.tsx` (mounted in `LeftPanel.tsx`) and `src/components/SearchPalette.tsx` (mounted in `App.tsx`, global `Cmd/Ctrl+K` keydown listener) — near-identical grouped-dropdown components, matching the existing `WikiLinkPopup`/`ContactMentionPopup` duplication convention rather than a shared generic popup.
- **Key simplification**: result navigation didn't need a per-type dispatch table — `App.openNoteAtPath` already auto-detects contact/calendar/diary/note from a vault-relative path and routes correctly. So `handleSearchResultSelect` in `App.tsx` is just: tag results → `onTagSelect`, everything else → the existing `handleSelectPath(path, title, { fromLink: true })`.
- **Bug found and fixed along the way**: `listMarkdownFiles`'s `walk()` (`electron/storage.ts`) unconditionally skipped *any* dot-prefixed directory before the `skipHiddenPaths` option was even checked — so `.calendar/` was never walked during a full-vault scan regardless of the option, meaning **calendar events have never been included in `indexAllTags()` either** (a pre-existing, previously-undiscovered gap, not just a search-feature bug). Fixed by only applying the blanket dot-skip when the entry isn't `.calendar` being scanned with `skipHiddenPaths: false`. `.settings/` remains always excluded (it's app config, not user content).
- **Bug found and fixed after initial ship**: the persistent search bar (`SearchBar.tsx`) became unusable after opening a result — clicking a result cleared the query *and* set `open` to `false`, but since `onMouseDown` on result items calls `preventDefault()` (so the click doesn't blur the input first), the input never actually lost focus — so the only way `open` could become `true` again was via a `focus` event, which never fires on an already-focused element. Clicking the (still-focused, now-empty) bar again did nothing. Fixed by: (1) no longer clearing the query on selection — search stays "live" so you can keep picking different results for the same term, (2) adding `onClick` (fires every click, unlike `onFocus`) alongside `onFocus` to reopen the dropdown, (3) adding an explicit clear (×) button since the query no longer auto-clears. Selecting a *different* result while one is already open now correctly falls through to the existing `handleSelectPath(path, title, { fromLink: true })` history-push behavior — no navigation-logic changes were needed, only the dropdown open/close state was broken. `SearchPalette.tsx` (Cmd/Ctrl+K) was deliberately left as-is — it's a transient "jump and dismiss" overlay, not a persistent session, so clearing on select is correct there.
- **Investigated, not fixed**: an intermittent blank-window crash during `npm run dev` (GPU process + network service crash a couple minutes into a session, after a few `electron/*.ts` saves triggered `vite-plugin-electron`'s normal kill-and-respawn restart cycle). Traced into `node_modules/vite-plugin-electron`'s `startup()` — it already awaits full exit of the old process before spawning a new one, so this isn't an overlapping-restart bug; it looks like inherent Electron/Chromium GPU-process flakiness on this Mac during dev-mode respawns, not an app-logic bug, and doesn't affect production/packaged builds (which never hot-restart). User opted to leave it as a known quirk (workaround: quit and re-run `npm run dev`) rather than experiment with GPU launch flags.

### Multi-line heading/list toggle bug (reported as "major glitch — text disappears in edit mode")
`toggleLinePrefix` in `src/utils/markdown-toggles.ts` — shared by all six heading buttons plus quote/bullet-list/numbered-list/task-list — only ever operated on `doc.lineAt(selection.main.from)`, i.e. **the single line the selection started on**, no matter how many rows were actually selected. Three compounding problems for a multi-row selection: (1) only row 1 was ever touched; (2) the dispatched `selection: { anchor: ... }` was a bare anchor with no `head`, which **collapses the selection to a single cursor** — so after one heading click, "the other selected rows" were simply never part of any subsequent selection again, which is what actually produced the "everything apart from the top row disappears and doesn't come back" symptom (nothing was ever deleted — confirmed via direct disk reads after every step in testing, and the user independently confirmed read-mode always still showed the full text — but the multi-row selection was gone for good after the first click, so nothing else could be affected); (3) switching from one heading level to a *different* one on an already-headed line stripped the heading entirely instead of changing its level, because the check was "does this line have *any* `#` marker" rather than "does it have *this exact* marker.
Rewrote `toggleLinePrefix` to: collect every line spanned by `[selection.from, selection.to]`; apply the *same* prefix to all of them in one dispatch (Notion/Docs-style toggle — only strips if **every** selected line already has exactly that prefix, otherwise applies/converts all of them to it); and map the original `anchor`/`head` through the change set (`state.changes(...).mapPos(...)`) so the selection **survives** the edit, letting you click through H1→H2→...→H6 on the same rows repeatedly, matching what the user asked for. Since quote/ul/ol/task share this exact function, they got the same fix for free — verified all four with a 3-line selection.
Verified extensively via the real built app (not just type-checking): 4-line multi-select through rapid H1→H6 clicks (all lines convert together, selection never collapses), re-clicking the same level (toggles off correctly), single-cursor/no-selection case (still only affects the one line, no regression), and the wrap-style tools (bold/italic/strikethrough) and insert-style tools (hr/table) — untouched code, confirmed still working correctly against whatever's actually selected/positioned.

### Vault-selection safety guards (incident response)
Real incident this session: the user's active vault got reset to unconfigured (see the config-file warning above), and when re-selecting it, they picked the vault's *parent* folder by mistake — the app silently scaffolded a brand-new empty vault into it rather than detecting anything wrong, burying their real vault one level deeper (`{name}/{name}`). No data was lost (user fixed it manually in Finder, verified byte-for-byte against the original), but the app should never have allowed this silently. Two guards added to `electron/vault-manager.ts`:
- `openVaultAt(vaultRoot)`: if `vaultRoot` isn't itself a vault (no `.settings/vault.cortex` marker) but a folder one level down inside it *is* one, throws instead of scaffolding — `"X" isn't a vault itself, but contains one at "Y" — open that folder instead.` Non-recursive by design (a vault nested 2+ levels down wasn't created by this app).
- `createVaultAt(parentPath, vaultName)`: if `parentPath`'s basename matches the chosen vault name (the classic self-nest), throws before creating anything — `Creating "X" here would nest it inside a folder of the same name...`
- Both surface through the existing `onError` error-banner path in `VaultSetup.tsx` — no UI changes needed, the `try/catch` around `window.cortex.vault.*` calls was already there.
- Verified end-to-end (not just type-checked) with a mocked `dialog.showOpenDialog` (see testing section below) against a reproduced `parent/myvault/myvault` shape: guard 1 blocked opening the outer folder with zero stray files created as a side effect, guard 2 blocked the self-nest create, and opening the real nested vault directly still worked normally (no false positives).

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

Drive the **actual built app** with Playwright, not just unit/type checks — this has caught several real bugs (the tag/diary issues, and the `.calendar` walk bug above) that type-checking alone would never have found. **Keep testing this way, don't settle for "it type-checks."**

```bash
npm run build   # tsc && vite build, produces dist/ + dist-electron/
node your-test-script.mjs   # no xvfb-run needed now that this runs locally on macOS
```

Script pattern: `playwright-core`'s `_electron.launch({ executablePath: path.join(repoRoot, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'), args: ['--no-sandbox', \`--user-data-dir=${scratchUserData}\`, repoRoot] })` (macOS path differs from the old Linux `node_modules/electron/dist/electron`), then bypass native dialogs by calling `window.cortex.*` IPC APIs directly via `page.evaluate(...)` (e.g. `window.cortex.vault.createNew(path, name)` instead of the native folder picker). `playwright-core` isn't a project dependency — install it with `npm install --no-save playwright-core` for a test run, then `npm uninstall playwright-core` after (it's dev-only tooling, not worth persisting in package.json). Screenshot liberally via Playwright's own `.screenshot()` (works fine locally, no OS permission needed) to verify visually, not just via `page.evaluate` return values.

**Always pass `--user-data-dir=<scratch path>`** (see the config-file warning up top) — this makes Electron use an isolated `app.getPath('userData')`, so `vault.createNew`/`vault.close`/etc. can never touch the real `cortex-config.json` no matter what the test does or how it exits. Don't rely on "remember to reset the config after" — that's exactly what went wrong once already. To test flows gated behind a native dialog (e.g. `vault.openExisting`) without a picker actually appearing, mock it from the main process before invoking: `await app.evaluate(async ({ dialog }, testPath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [testPath] }) }, pathToSelect)`, then call the normal `window.cortex.vault.openExisting()` from the renderer as usual — it'll hit your mock and proceed through the real code path.

Put test scripts in the repo root temporarily if you need Playwright's `node_modules` resolution (ESM resolves relative to the script's own location, not cwd) — delete them when done.

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
| Vault-wide search backend | `electron/search.ts` |
| Search UI (bar + palette) | `src/components/SearchBar.tsx`, `src/components/SearchPalette.tsx`, `src/hooks/useSearch.ts` |
| Version bump script | `scripts/bump-version.mjs` |
| Release pipeline | `.github/workflows/release.yml`, `.github/workflows/build.yml` |

## Open items for next session

1. Search was smoke-tested end to end locally (note/diary/contact/calendar/tag results, both UI surfaces, keyboard nav, Escape) but only against a throwaway test vault with one item per type — worth trying against the user's real vault once they've used it a bit.
2. Vault-selection guards were verified with a scripted repro of the exact incident shape, not against the user's actual folder layout — low risk since the logic is simple and covered, but worth keeping an eye out.
3. This session's work (search + vault guards) is implemented and tested but **not yet committed** — confirm with the user before committing/pushing/opening the PR to `master`.
4. **Unexplained**: `.gitignore` picked up a `CLAUDE.md` entry this session that nobody (no session, no script) knowingly added — possibly the same unknown actor that deleted `CLAUDE.md` from disk earlier in the session (recovered via `git checkout`, no data lost). Left as-is since it looks like a deliberate, well-formed edit, not corruption — but flagged to the user, and worth another look if anything like it happens again. If the user wants `CLAUDE.md` to stop being tracked in git (which the ignore entry alone doesn't do), that needs an explicit `git rm --cached CLAUDE.md`.
5. macOS folder icon (from the 2026-08-15 session) — still worth getting explicit user confirmation it looks right in Finder if that hasn't happened yet.
6. If they want the cosmetic `v0.1.0` gap (missing `Icon\r` hide) fixed, it'll happen automatically on the next version bump — no action needed unless they ask sooner.
7. No other known bugs open as of end of session.
