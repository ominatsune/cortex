# Cortex ***WORK-IN-PROGRESS***

An open-source cross-platform note-taking app. **Electron** for desktop (macOS, Linux, Windows) and **Expo (React Native)** *planned* in future for mobile (iOS, Android). Markdown notes, attachments, tags, contacts, diary, built-in calendar, and PDF export — all stored locally.

## Architecture

```
cortex/
├── packages/core/     Shared types, API interface, tag/markdown utilities
├── electron/          Desktop main process (Node.js file I/O)
└── src/               Desktop React UI (Electron renderer)
```

## Features

- **Three-panel layout** — Browser / app zones / tag legend (left), notes with read & edit modes (center), calendar / tags / links (right)
- **Markdown notes** — Full toolbar on desktop
- **Folders** — Organize notes in nested folder structures
- **Attachments** — Attach files to notes or folders
- **Tags** — Use `#tags` in notes or YAML frontmatter
- **Diary** — Daily journal entries organized by year
- **Contacts** — Manage contacts with email, phone, company, and notes
- **Calendar** — Built-in calendar with events
- **Local-first** — All data stored as files in a vault directory

## Requirements

- Node.js 18+
- npm

## Getting Started

### Desktop

```bash
npm install
npm run dev
```

On first launch, Cortex asks you to **select or create a vault** — locally or in cloud storage (iCloud, Google Drive, OneDrive, Dropbox). The vault path appears in the bottom-left of the sidebar.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start desktop development server + Electron |
| `npm run build` | Build desktop for production |
| `npm run package:mac` | Build macOS `.dmg` |
| `npm run package:win` | Build Windows `.exe` installer |
| `npm run package:linux` | Build Linux AppImage and `.deb` |

## Data Storage

Vault structure:

```
{your-vault-name}/
```

## License

MIT
