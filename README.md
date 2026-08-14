# Cortex

[![GitHub License](https://img.shields.io/github/license/ominatsune/cortex)](https://github.com/ominatsune/cortex/blob/master/LICENSE)
[![Status](https://img.shields.io/badge/status-early%20access-orange)](https://github.com/ominatsune/cortex)
[![GitHub Stars](https://img.shields.io/github/stars/ominatsune/cortex?style=flat)](https://github.com/ominatsune/cortex/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/ominatsune/cortex)](https://github.com/ominatsune/cortex/issues)
[![Last Commit](https://img.shields.io/github/last-commit/ominatsune/cortex)](https://github.com/ominatsune/cortex/commits/master)

<div align="center">
  <img src="assets/cortex-logo-source.png" alt="Cortex" width="500">
<p>

An open-source cross-platform note-taking and personal knowledge management app for macOS, Linux, and Windows.

Cortex provides Markdown notes, attachments, tags, contacts, diary entries, a built-in calendar, and PDF export — with data stored in a local vault.

> [!WARNING]
> **Cortex is currently in early access.**
>
> The application is actively being developed and may contain bugs, incomplete features, or breaking changes. **Use Cortex at your own risk and keep regular backups of your vault and important data.**

## Features

- **Three-panel layout** — Browser / app zones / tag legend on the left, notes in the center, and calendar / tags / links on the right
- **Markdown notes** — Create and edit Markdown notes with a full formatting toolbar
- **Folders** — Organize notes in nested folder structures
- **Attachments** — Attach files to notes or folders
- **Tags** — Use `#tags` in notes or YAML frontmatter
- **Diary** — Daily journal entries organized by year
- **Contacts** — Manage contacts with email, phone, company, and notes
- **Calendar** — Built-in calendar with events
- **PDF export** — Export notes as PDF documents
- **Local-first** — Your data is stored as files in your vault directory
- **Cloud vaults** — Use vaults stored locally or in supported cloud storage

## Architecture

```text
cortex/
├── packages/core/     Shared types, API interface, tag/markdown utilities
├── electron/          Desktop main process (Node.js file I/O)
└── src/               Desktop React UI (Electron renderer)
```

## Requirements

- Node.js 18+
- npm

## Getting Started

### Development

Clone the repository and install the dependencies:

```bash
git clone https://github.com/ominatsune/cortex.git
cd cortex
npm install
```

Start Cortex in development mode:

```bash
npm run dev
```

On first launch, Cortex will ask you to **select or create a vault**.

Vaults can be stored locally or in supported cloud storage such as:

- iCloud
- Google Drive
- OneDrive
- Dropbox

The active vault path is displayed in the bottom-left of the sidebar.

## Building

Build Cortex for production:

```bash
npm run build
```

### Packaging

| Command | Description |
|---|---|
| `npm run package:mac` | Build macOS `.dmg` |
| `npm run package:win` | Build Windows `.exe` installer |
| `npm run package:linux` | Build Linux AppImage and `.deb` |

## Data Storage

Cortex uses a **vault-based storage system**.

Your vault is simply a directory containing your notes and associated files:

```text
{your-vault-name}/
├── notes/
├── diary/
├── contacts/
└── ...
```

Because Cortex is local-first, your data remains accessible as regular files outside of the application.

## Roadmap

Cortex is under active development. Features and priorities may change as the project evolves.

Future improvements may include:

- Improved search
- Backlinks and wiki links
- Enhanced tag management
- Additional calendar functionality
- Improved cloud-storage support
- Performance improvements
- UI/UX improvements
- Additional export options

## Contributing

Cortex is open source and contributions are welcome.

Bug reports, feature requests, suggestions, and pull requests are appreciated.

If you encounter a problem, please [open an issue](https://github.com/ominatsune/cortex/issues).

## License

Cortex is licensed under the [MIT License](LICENSE).

---

> **⚠️ Early Access**
>
> Cortex is still under active development. **Use at your own risk and keep backups of important data.**
