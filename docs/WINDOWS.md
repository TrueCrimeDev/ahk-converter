# UI Windows & Views

This document lists the UI “windows” (views, panels, and other visible surfaces) created by this extension, where they appear in VS Code, and which source files own them.

## At a glance

### Activity Bar container: **AHKv2 Toolbox** (`ahkv2-toolbox`)

- **Toolbox** (`ahkv2Toolbox`) — Webview view (sidebar)
  - Internal sub-views: Main, Settings, Edit Metadata (sidebar)
- **Dependency Manager** (`ahkPackageManager`) — Tree view (sidebar)
- **Code Map** (`codeMap`) — Tree view (sidebar)
- **Dependency Map** (`ahkDependencyTree`) — Tree view (sidebar)

### Editor tabs (panels / diff)

- **Library Details** (`ahkLibraryDetail`) — WebviewPanel
- **Edit Metadata** (`ahkMetadataEditor`) — WebviewPanel
- **AHK v2 Imports & Modules Guide** (`ahkImportsGuide`) — WebviewPanel
- **Script Analysis** (`ahkScriptAnalysis`) — WebviewPanel
- **Conversion Diff** (`vscode.diff`) — Diff editor tab

## Sidebar container + views (Activity Bar)

### Container: `ahkv2-toolbox`

Defined in `package.json` under `contributes.viewsContainers.activitybar`.

#### View: Toolbox (webview)

- **View id:** `ahkv2Toolbox`
- **UI location:** Activity Bar → AHKv2 Toolbox → Toolbox
- **Type:** `WebviewViewProvider`
- **Source:** `src/toolboxSidebarProvider.ts` (`ToolboxSidebarProvider`)
- **Navigation model:** a single webview that swaps internal HTML “sub-views”
  - Main menu: `currentView = 'main'`
  - Settings: `currentView = 'settings'`
  - Metadata editor (sidebar): `currentView = 'metadata'`
- **Key webview → extension messages (via `vscode.postMessage`)**
  - `executeCommand`, `editActiveFileMetadata`, `showMetadataEditor`, `showSettings`, `showMain`, `saveMetadata`, `saveSettings`

#### View: Dependency Manager (tree)

- **View id:** `ahkPackageManager`
- **UI location:** Activity Bar → AHKv2 Toolbox → Dependency Manager
- **Type:** Tree view
- **Source:** `src/packageManagerProvider.ts` (`PackageManagerProvider`)
- **Related editor panels:** Library Details (`ahkLibraryDetail`), Edit Metadata (`ahkMetadataEditor`)

#### View: Code Map (tree)

- **View id:** `codeMap`
- **UI location:** Activity Bar → AHKv2 Toolbox → Code Map
- **Type:** Tree view
- **Source:** `src/functionTreeProvider.ts` (`FunctionTreeProvider`)

#### View: Dependency Map (tree)

- **View id:** `ahkDependencyTree`
- **UI location:** Activity Bar → AHKv2 Toolbox → Dependency Map
- **Type:** Tree view
- **Source:** `src/dependencyTreeProvider.ts` (`DependencyTreeProvider`)

## Webview panels (editor tabs)

These are VS Code editor tabs created with `vscode.window.createWebviewPanel(...)`.

### Panel: Library Details

- **Panel id:** `ahkLibraryDetail`
- **Title:** `Library Details - <name>`
- **Source:** `src/libraryDetailPanel.ts` (`LibraryDetailPanel`)
- **Typically opened from:** Dependency Manager tree view (installed library click / context menu)

### Panel: Edit Metadata (standalone panel)

- **Panel id:** `ahkMetadataEditor`
- **Title:** `Edit Metadata - <filename>`
- **Source:** `src/metadataEditorProvider.ts` (`MetadataEditorProvider`)
- **Opened from:**
  - Dependency Manager → context action: `ahkPackageManager.editMetadata`
  - Command: `ahkv2Toolbox.openLibraryMetadataPage`
- **Important:** this is a different UI from the Toolbox sidebar’s “Edit Metadata” sub-view.

### Panel: AHK v2 Imports & Modules Guide

- **Panel id:** `ahkImportsGuide`
- **Title:** `AHK v2 Imports & Modules Guide`
- **Source:** `src/importsGuidePanel.ts` (`ImportsGuidePanel`)
- **Opened from:** Command `ahkv2Toolbox.showImportsGuide`

### Panel: Script Analysis

- **Panel id:** `ahkScriptAnalysis`
- **Title:** `Script Analysis`
- **Source:** `src/smartScriptSaver.ts` (`previewScriptAnalysis`)
- **Opened from:** Command `ahk.previewScriptAnalysis`

### Legacy panel: Toolbox (possible duplicate / legacy)

- **Panel id:** `ahkv2Toolbox`
- **Title:** `AHKv2 Toolbox`
- **Source:** `src/sidebarWebview.ts` (`AHKv2ToolboxWebview`)
- **Note:** this panel id collides with the **Toolbox sidebar view id** (`ahkv2Toolbox`). As of the current `src/` code, this class does not appear to be wired to a registered command.

## Editor tabs opened by commands (non-webview)

These are standard VS Code editor tabs, not custom webviews.

- **Diff editor:** conversion preview uses `vscode.diff` with an `untitled:Converted.ahk` right-side document (`src/extension.ts`)
- **Converted output tab:** conversion “open in new tab” uses `vscode.workspace.openTextDocument({ language: 'ahk', content })` (`src/extension.ts`)
- **Other documents:** various commands open files (docs, generated markdown, etc.) using `vscode.workspace.openTextDocument(...)` then `vscode.window.showTextDocument(...)` (mostly `src/extension.ts`)

## Output channels (Output panel)

These appear under **View → Output** and are created via `vscode.window.createOutputChannel(...)`.

- `AHKv2 Toolbox` — `src/extension.ts`
- `AHK Examples Curator` — `src/examplesCurator.ts`
- `AHK Alpha Bridge` — `src/alphaBridge.ts`
- `AHK Diagnostics` — `src/alpha/DiagnosticAggregator.ts`

## “Edit Metadata” troubleshooting: which window are you in?

There are two different “Edit Metadata” UIs:

1) **Toolbox sidebar “Edit Metadata” sub-view**
- **Where:** inside the **Toolbox** sidebar view (`ahkv2Toolbox`)
- **Source:** `src/toolboxSidebarProvider.ts`
- **Back button element id:** `back-btn`
- **Back action pattern:** `vscode.postMessage({ type: 'showMain' })`

2) **Standalone “Edit Metadata - <filename>” editor tab (panel)**
- **Where:** an editor tab (webview panel)
- **Source:** `src/metadataEditorProvider.ts`
- **Back button element id:** `backButton` (text button: “← Back”)
- **Back action pattern:** `vscode.postMessage({ type: 'back' })` (handled by the extension)

If you updated the `back-btn` handler but you’re still seeing “← Back” / `backButton`, you’re editing the *standalone panel* code path, not the Toolbox sidebar sub-view.

## Known overlaps / potential confusion points

- `src/settingsWebviewProvider.ts` registers a `WebviewViewProvider` with view id `ahkv2Toolbox.settings`, but `package.json` does not currently contribute a view with that id, so it may not be reachable via the UI.
- `package.json` contributes a command `ahkv2Toolbox.open`, but the current `src/` code does not appear to register a handler for that command.
- `src/sidebarWebview.ts` defines a Toolbox webview *panel* using id `ahkv2Toolbox`, which collides with the Toolbox *sidebar view* id `ahkv2Toolbox`.

