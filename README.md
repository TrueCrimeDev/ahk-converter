<p align="center">
  <img src="media/converter.png" alt="AHK Converter icon" width="112" />
</p>

<h1 align="center">AHK Converter</h1>

<p align="center">
  <strong>Convert AutoHotkey v1 scripts to v2, inspect dependencies, manage libraries, and get AHK-aware Copilot help inside VS Code.</strong>
</p>

<p align="center">
  <kbd>VS Code 1.84+</kbd> <kbd>AHK v1 → v2</kbd> <kbd>MIT</kbd>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=TrueCrimeAudit.ahk-converter"><img alt="VS Code Marketplace" src="https://img.shields.io/visual-studio-marketplace/v/TrueCrimeAudit.ahk-converter?label=Marketplace&color=007ACC"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=TrueCrimeAudit.ahk-converter"><img alt="Installs" src="https://img.shields.io/visual-studio-marketplace/i/TrueCrimeAudit.ahk-converter?color=2ea043"></a>
</p>

---

## What It Does

AHK Converter started as a focused AutoHotkey v1-to-v2 conversion tool. It now adds the missing VS Code workflow around that conversion: dependency mapping, package discovery, library includes, interpreter-backed diagnostics, and an AHK-focused Copilot Chat participant.

| Convert | Understand | Build |
| --- | --- | --- |
| Convert v1 scripts into v2 output, replace the current file, or review a diff. | Browse symbols, includes, library relationships, and diagnostics from dedicated sidebar views. | Search AHK v2 libraries, insert `#Include` lines, generate metadata, and ask `@ahk` for code help. |

## Highlights

<p align="center">
  <kbd>New Tab</kbd> <kbd>Replace File</kbd> <kbd>Diff Review</kbd> <kbd>Batch</kbd><br>
  <kbd>AHK Sidebar</kbd> <kbd>Code Map</kbd> <kbd>Package Search</kbd> <kbd>Quick #Include</kbd><br>
  <kbd>Console Diagnostics</kbd> <kbd>DllCall Signatures</kbd> <kbd>Function Metadata</kbd> <kbd>Library Attribution</kbd><br>
  <kbd>@ahk /convert</kbd> <kbd>@ahk /fix</kbd> <kbd>@ahk /workspace</kbd> <kbd>@ahk /examples</kbd>
</p>

## Quick Start

1. Install [AutoHotkey v2](https://www.autohotkey.com/).
2. Install the extension from the VS Code Marketplace.
3. Recommended: install **AutoHotkey v2 Language Support** by thqby for syntax highlighting and LSP features.
4. Open a `.ahk` file.
5. Run **AHK: Convert v1 to v2** from the Command Palette, editor context menu, or keyboard shortcut.

## Core Workflows

### Convert AHK v1 to v2

Run one of the conversion commands:

| Command | Use When |
| --- | --- |
| `AHK: Convert to v2 (New Tab)` | You want to inspect converted output without touching the source file. |
| `AHK: Convert to v2 (Replace File)` | You are ready to update the current file. |
| `AHK: Convert to v2 (Show Diff)` | You want side-by-side review before accepting changes. |
| `AHK: Convert to v2 (Batch)` | You are converting multiple scripts at once. |

Default shortcuts:

- `Ctrl+Shift+A`: convert to a new tab.
- `Ctrl+Shift+D`: show conversion diff.

### Use The AHK Sidebar

Open the **AHK** icon in the VS Code activity bar for the bundled workflow views:

| View | Purpose |
| --- | --- |
| **Toolbox** | Quick actions, settings, and common AHK development commands. |
| **Dependency Manager** | Search, install, update, remove, and include AHK libraries. |
| **Code Map** | Browse symbols and jump through the active script structure. |
| **Dependency Map** | Inspect `#Include` relationships and unresolved dependencies. |

### Ask Copilot With `@ahk`

When GitHub Copilot Chat is available, type `@ahk` in chat:

| Command | What It Does |
| --- | --- |
| `@ahk /convert` | Convert a v1 snippet and explain the migration. |
| `@ahk /fix` | Analyze active code, Problems diagnostics, and likely AHK v2 issues. |
| `@ahk /explain` | Explain an AHK v2 concept or syntax pattern. |
| `@ahk /example` | Generate a focused AHK v2 example. |
| `@ahk /codemap` | Summarize symbols in the active file. |
| `@ahk /dependencies` | Summarize include relationships. |
| `@ahk /workspace` | Combine code map and dependency context. |
| `@ahk /syntax` | Look for v1 contamination and v2 syntax problems. |
| `@ahk /refactor` | Suggest safer structure and modern v2 idioms. |
| `@ahk /test` | Draft tests and edge cases for functions. |

You can also ask normal questions, such as:

```text
@ahk why is this GUI not showing?
@ahk convert this hotkey block to v2
@ahk explain ComObject vs ComObjActive
```

## Settings

Common settings:

| Setting | Purpose |
| --- | --- |
| `ahkConverter.autoHotkeyV2Path` | Path to `AutoHotkey64.exe`. Empty uses PATH. |
| `ahkConverter.converterScriptPath` | Path to the bundled or custom v1-to-v2 converter script. |
| `ahkConverter.strictWindowsOnly` | Warn when running outside Windows. |
| `ahkConverter.enableEnhancedDiff` | Enable the enhanced conversion diff view. |
| `ahkConverter.defaultOutputNaming` | Choose suffix, directory, or prompt naming for batch conversion. |
| `ahkConverter.validationLevel` | Use strict, normal, or lenient validation. |
| `ahkv2Toolbox.includeFormat` | Template for inserted `#Include` paths. |
| `ahkv2Toolbox.userLibraryPaths` | Local library folders to index for quick includes. |
| `ahkv2Toolbox.userLibraryIncludeFormat` | Template used when inserting user-library includes. |

## Documentation

- [Package Search Guide](docs/PACKAGE_SEARCH_GUIDE.md)
- [Best OOP Examples](docs/BEST_OOP_EXAMPLES.md)
- [Dependency Tree Active File Mode](docs/DEPENDENCY_TREE_ACTIVE_FILE.md)
- [JSDoc Generation Guide](docs/JSDOC_GENERATION_GUIDE.md)
- [Advanced Features](docs/ADVANCED_FEATURES.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)

## Troubleshooting

### AutoHotkey v2 executable not found

Install AutoHotkey v2, then set `ahkConverter.autoHotkeyV2Path` if `AutoHotkey64.exe` is not on PATH.

### Converter script not found

Leave `ahkConverter.converterScriptPath` on the default bundled path unless you intentionally use a custom converter.

### The AHK sidebar is missing

Reload VS Code after installing or updating the extension. The activity bar item is titled **AHK** and uses the extension's sidebar icon.

### Copilot commands do not respond

Make sure GitHub Copilot Chat is installed and active, then type `@ahk` in the Copilot Chat input.

## License

MIT
