import * as vscode from 'vscode';
import * as fs from 'fs/promises';

const toolboxLog = vscode.window.createOutputChannel('AHKv2 Toolbox Sidebar');

/**
 * Library metadata from JSDoc comments
 */
interface LibraryMetadata {
  file?: string;
  description?: string;
  author?: string;
  date?: string;
  version?: string;
  license?: string;
  repository?: string;
  requires?: string[];
  [key: string]: string | string[] | undefined;
}

interface ToolboxSettings {
  autoInsertHeaders?: boolean;
  defaultRequires?: string;
  defaultSingleInstance?: string;
  includeFormat?: string;
  libFolders?: string[];
  githubToken?: string;
}

interface ToolboxSettingsMessage {
  headerSettings?: {
    autoInsert: boolean;
    defaultRequires: string;
    singleInstance: string;
  };
  libFolderSettings?: {
    searchFolders: string[];
    includeFormat: string;
  };
  githubToken?: string;
}

const enum WebviewMessageType {
  ExecuteCommand = 'executeCommand',
  ShowSettings = 'showSettings',
  ShowEditForm = 'showEditForm',
  ShowMain = 'showMain',
  SaveSettings = 'saveSettings',
  SaveLibraryMetadata = 'saveLibraryMetadata'
}

interface WebviewMessage {
  type: WebviewMessageType | string;
  command?: string;
  args?: any[];
  settings?: ToolboxSettingsMessage;
  filePath?: string;
  metadata?: LibraryMetadata;
}

/**
 * Enhanced AHKv2 Toolbox sidebar webview provider
 * Supports multiple views: main toolbox, settings
 */
export class ToolboxSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ahkv2Toolbox';

  private _view?: vscode.WebviewView;
  private pendingRoute?: 'main';
  private currentView: 'main' | 'settings' | 'editForm' = 'main';

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly extensionId: string
  ) {}

  private get _extensionUri(): vscode.Uri {
    return this._extensionContext.extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    toolboxLog.appendLine('[sidebar] resolveWebviewView');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this.getMainViewHtml();

    const log = toolboxLog;
    log.appendLine('[toolbox] handler attached');

    if (this.pendingRoute === 'main') {
      log.appendLine('[sidebar] applied pendingRoute=main');
      this.pendingRoute = undefined;
      this.showMainView();
    }

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data: WebviewMessage) => {
      log.appendLine('[sidebar] recv ' + (data?.type ?? 'unknown'));
      console.log('[sidebar] Received message:', data.type, data);
      try {
        switch (data.type) {
          case 'executeCommand':
          case WebviewMessageType.ExecuteCommand:
            if (data.command) {
              await vscode.commands.executeCommand(data.command, ...(data.args || []));
            }
            break;
          case 'showSettings':
          case WebviewMessageType.ShowSettings:
            await this.showSettings();
            break;
          case 'showEditForm':
          case WebviewMessageType.ShowEditForm:
            this.showEditForm();
            break;
          case 'showMain':
          case WebviewMessageType.ShowMain:
            log.appendLine('[sidebar] recv showMain - calling showMainView');
            this.showMainView();
            log.appendLine('[sidebar] showMainView returned');
            break;
          case 'back':
            log.appendLine('[sidebar] recv back - calling showMainView');
            this.showMainView();
            log.appendLine('[sidebar] showMainView returned');
            break;
          case 'saveSettings':
          case WebviewMessageType.SaveSettings:
            if (data.settings) {
              await this.saveSettings(data.settings);
            }
            break;
          case 'saveLibraryMetadata':
          case WebviewMessageType.SaveLibraryMetadata:
            if (data.filePath && data.metadata) {
              await this.saveLibraryMetadata(data.filePath, data.metadata);
            }
            break;
          default:
            console.log('[Toolbox] Unknown message type:', data.type);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Webview action failed: ${errorMessage}`);
      }
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;');
  }

  private getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Show settings view
   */
  public async showSettings() {
    if (!this._view) {
      return;
    }

    this.currentView = 'settings';

    // Load current settings from VS Code
    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
    const currentSettings = {
      autoInsertHeaders: config.get('autoInsertHeaders', false),
      defaultRequires: config.get('defaultRequires', 'AutoHotkey v2.1'),
      defaultSingleInstance: config.get('defaultSingleInstance', 'Force'),
      includeFormat: config.get('includeFormat', 'Lib/{name}.ahk'),
      libFolders: config.get('libFolders', ['Lib', 'vendor']),
      githubToken: config.get('githubToken', '')
    };

    this._view.webview.html = this.getSettingsHtml(currentSettings);
  }

  /**
   * Show main toolbox view
   */
  public showMainView() {
    toolboxLog.appendLine('[sidebar] showMainView invoked');
    if (!this._view) {
      this.pendingRoute = 'main';
      toolboxLog.appendLine('[sidebar] pendingRoute=main queued');
      return;
    }

    this.currentView = 'main';
    this._view.webview.html = this.getMainViewHtml();
  }

  /**
   * Show edit form view
   */
  public async showEditForm() {
    if (!this._view) {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    let metadata: LibraryMetadata = {};
    let filePath = '';

    if (activeEditor) {
      filePath = activeEditor.document.uri.fsPath;
      if (filePath.endsWith('.ahk') || filePath.endsWith('.ahk2')) {
        metadata = await this.parseJSDoc(filePath);
        metadata.file = metadata.file || require('path').basename(filePath);
        metadata.repository = metadata.repository || (typeof metadata.link === 'string' ? metadata.link : '');
      }
    }

    this.currentView = 'editForm';
    this._view.webview.html = this.getEditFormHtml(metadata, filePath);
  }

  /**
   * Parse JSDoc header from AHK file
   */
  private async parseJSDoc(filePath: string): Promise<LibraryMetadata> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const metadata: LibraryMetadata = {};
      let inJSDoc = false;
      let currentTag: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Start of JSDoc block
        if (trimmed.startsWith('/**') || trimmed.startsWith('/***')) {
          inJSDoc = true;
          continue;
        }

        // End of JSDoc block
        if (inJSDoc && (trimmed.endsWith('*/') || trimmed.endsWith('***/'))) {
          break;
        }

        if (!inJSDoc) {
          continue;
        }

        // Match JSDoc tag line: * @tagname: value or * @tagname value
        const tagMatch = trimmed.match(/^\*\s*@(\w+[-\w]*)\s*[:：]?\s*(.*)$/);
        if (tagMatch) {
          const tag = tagMatch[1].toLowerCase();
          const value = tagMatch[2].trim();
          currentTag = tag;

          // Handle array-type tags
          if (tag === 'requires') {
            if (!metadata.requires) {
              metadata.requires = [];
            }
            if (value) {
              metadata.requires.push(value);
            }
          } else {
            metadata[tag] = value;
          }
        } else if (currentTag && trimmed.startsWith('*')) {
          // Continuation line
          const continuationText = trimmed.replace(/^\*\s*/, '');
          if (continuationText && metadata[currentTag]) {
            metadata[currentTag] += ' ' + continuationText;
          }
        }
      }

      return metadata;
    } catch (error) {
      console.error('Failed to parse JSDoc:', error);
      return {};
    }
  }

  /**
   * Save settings
   */
  private async saveSettings(settings: ToolboxSettingsMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');

    try {
      if (settings.headerSettings) {
        await config.update('autoInsertHeaders', settings.headerSettings.autoInsert, vscode.ConfigurationTarget.Global);
        await config.update('defaultRequires', settings.headerSettings.defaultRequires, vscode.ConfigurationTarget.Global);
        await config.update('defaultSingleInstance', settings.headerSettings.singleInstance, vscode.ConfigurationTarget.Global);
      }

      if (settings.libFolderSettings) {
        await config.update('libFolders', settings.libFolderSettings.searchFolders, vscode.ConfigurationTarget.Global);
        await config.update('includeFormat', settings.libFolderSettings.includeFormat, vscode.ConfigurationTarget.Global);
      }

      if (typeof settings.githubToken === 'string') {
        await config.update('githubToken', settings.githubToken.trim(), vscode.ConfigurationTarget.Global);
      }

      vscode.window.showInformationMessage('Settings saved successfully!');
      this.showMainView();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save settings: ${errorMessage}`);
    }
  }

  /**
   * Save library metadata to the selected file.
   */
  private async saveLibraryMetadata(filePath: string, metadata: LibraryMetadata): Promise<void> {
    if (!filePath || (!filePath.endsWith('.ahk') && !filePath.endsWith('.ahk2'))) {
      throw new Error('Open an AutoHotkey library file before updating metadata.');
    }

    const normalized = this.normalizeLibraryMetadata(metadata, filePath);
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const metadataBlock = this.buildMetadataCommentBlock(normalized, eol);

    const originalText = document.getText();
    const updatedText = this.upsertMetadataBlock(originalText, metadataBlock, eol);

    if (updatedText === originalText) {
      vscode.window.showInformationMessage('No metadata changes to apply.');
      this.showMainView();
      return;
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(originalText.length)
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, fullRange, updatedText);

    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      throw new Error('Failed to apply metadata changes.');
    }

    await document.save();
    vscode.window.showInformationMessage(`Updated library metadata in ${require('path').basename(filePath)}.`);
    this.showMainView();
  }

  private normalizeLibraryMetadata(input: LibraryMetadata, filePath: string): LibraryMetadata {
    const trimValue = (value: unknown): string => {
      if (typeof value !== 'string') {
        return '';
      }
      return value.trim();
    };

    const normalizeSingleLine = (value: unknown): string => trimValue(value).replace(/\s+/g, ' ');
    const normalizeMultiline = (value: unknown): string =>
      trimValue(value)
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n');

    const rawRequires = Array.isArray(input.requires) ? input.requires : [];
    const requires = rawRequires
      .map((item: string) => item.trim())
      .filter((item: string) => Boolean(item));

    return {
      file: normalizeSingleLine(input.file) || require('path').basename(filePath),
      description: normalizeMultiline(input.description),
      author: normalizeSingleLine(input.author),
      version: normalizeSingleLine(input.version),
      date: normalizeSingleLine(input.date),
      license: normalizeSingleLine(input.license),
      repository: normalizeSingleLine(input.repository),
      requires
    };
  }

  private buildMetadataCommentBlock(metadata: LibraryMetadata, eol: string): string {
    const lines: string[] = ['/**'];

    const appendTag = (tag: string, value?: string): void => {
      if (!value) {
        return;
      }
      const normalized = value
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      if (normalized.length === 0) {
        return;
      }
      lines.push(` * @${tag} ${normalized[0]}`);
      for (let i = 1; i < normalized.length; i++) {
        lines.push(` * ${normalized[i]}`);
      }
    };

    appendTag('file', metadata.file);
    appendTag('description', metadata.description);
    appendTag('author', metadata.author);
    appendTag('version', metadata.version);
    appendTag('date', metadata.date);
    appendTag('license', metadata.license);
    appendTag('repository', metadata.repository);

    for (const dep of metadata.requires || []) {
      appendTag('requires', dep);
    }

    lines.push(' */');
    return lines.join(eol);
  }

  private upsertMetadataBlock(content: string, metadataBlock: string, eol: string): string {
    const existing = this.findExistingMetadataBlock(content);
    if (existing) {
      return `${content.slice(0, existing.start)}${metadataBlock}${content.slice(existing.end)}`;
    }

    const insertOffset = content.startsWith('\uFEFF') ? 1 : 0;
    const prefix = content.slice(0, insertOffset);
    const suffix = content.slice(insertOffset);
    return `${prefix}${metadataBlock}${eol}${eol}${suffix}`;
  }

  private findExistingMetadataBlock(content: string): { start: number; end: number } | null {
    const commentRegex = /\/\*{2,}[\s\S]*?\*\//g;
    const metadataTagPattern = /@(file|description|author|version|date|license|repository|requires|link)\b/i;
    let match: RegExpExecArray | null;

    while ((match = commentRegex.exec(content)) !== null) {
      const block = match[0];
      if (metadataTagPattern.test(block)) {
        return {
          start: match.index,
          end: match.index + block.length
        };
      }
    }

    return null;
  }

  /**
   * Get common HTML template wrapper
   */
  private getHtmlTemplate(params: {
    title: string;
    additionalStyles?: string;
    bodyContent: string;
    scriptContent: string;
  }): string {
    if (!this._view) {
      throw new Error('Webview not initialized');
    }

    const webview = this._view.webview;
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js')
    );
    const codiconsUri = 'https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.32/dist/codicon.css';
    const scriptNonce = this.getNonce();

    const cacheBuster = Date.now();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'nonce-${scriptNonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>${params.title} - ${cacheBuster}</title>
  <link rel="stylesheet" href="${codiconsUri}">
  <script type="module" nonce="${scriptNonce}" src="${toolkitUri}"></script>
  <style>
    ${this.getCommonStyles()}
    ${params.additionalStyles || ''}
  </style>
</head>
<body>
  ${params.bodyContent}
  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
    ${params.scriptContent}
  </script>
</body>
</html>`;
  }

  /**
   * Get common CSS styles used across all views
   */
  private getCommonStyles(): string {
    return `
      body {
        padding: 0;
        margin: 0;
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
      }

      .menu-section {
        margin-bottom: 16px;
        padding: 8px 24px;
      }

      .section-header {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--vscode-sideBarTitle-foreground);
        margin: 0 0 12px 0;
        padding: 0;
        opacity: 0.8;
      }

      vscode-button {
        width: 100%;
        margin-bottom: 5px;
      }

      .button-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 7px 14px;
        align-items: stretch;
      }

      .button-grid vscode-button {
        width: 100%;
        height: 32px;
        overflow: hidden;
      }

      .button-grid vscode-button::part(control) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .button-stack {
        display: flex;
        flex-direction: column;
        row-gap: 7px;
      }

      .button-with-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 7px;
      }

      .button-with-info vscode-button {
        flex: 1;
        margin-bottom: 0;
      }

      .info-badge {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        white-space: nowrap;
        display: none;
      }
    `;
  }

  /**
   * Get main toolbox view HTML
   */
  private getMainViewHtml(): string {
    if (!this._view) {
      return '';
    }

    const webview = this._view.webview;
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js')
    );
    const codiconsUri = 'https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.32/dist/codicon.css';
    const scriptNonce = this.getNonce();
    const cacheBuster = Date.now();
    const extensionSettingsQuery = `@ext:${this.extensionId}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'nonce-${scriptNonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>AHKv2 Toolbox - ${cacheBuster}</title>
  <link rel="stylesheet" href="${codiconsUri}">
  <script type="module" nonce="${scriptNonce}" src="${toolkitUri}"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      line-height: 1.5;
      overflow-y: scroll;
      width: 100%;
      box-sizing: border-box;
    }

    /* Force consistent width regardless of scrollbar */
    .sidebar-content,
    .menu-section {
      box-sizing: border-box;
    }

    .sidebar-content {
      padding: 12px 0;
    }

    .menu-section {
      margin-bottom: 12px;
      padding: 0 24px;
    }

    .section-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #969696;
      margin: 0 0 12px 0;
      padding: 0;
    }

    /* 2x2 Grid layout for Script Converter */
    .button-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .button-grid vscode-button {
      width: 100%;
      height: 32px;
      margin: 0;
    }

    /* Button container: flex column with gap */
    .button-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .button-container vscode-button {
      margin: 0;
    }

    /* Button with info text layout */
    .button-with-info {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .button-with-info:last-child {
      margin-bottom: 0;
    }

    .button-with-info vscode-button {
      flex: 1 1 0;
      margin: 0;
      height: 32px;
      min-width: 0;
    }

    .info-badge {
      font-size: 13px;
      padding: 2px 12px 2px 6px;
      border-radius: 3px;
      background: #4d4d4d;
      color: #cccccc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 400;
      flex: 1 1 0;
      text-align: right;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-width: 0;
    }

    .info-badge.has-metadata {
      background: #1a7f37;
      color: #ffffff;
    }

    /* Darker button background - 12% darker than VS Code default */
    vscode-button {
      width: 100%;
      background: #2e2e2e;
      color: #cccccc;
      border: 1px solid #3c3c3c;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 400;
      text-align: center;
      cursor: pointer;
      border-radius: 2px;
      transition: background 0.15s ease, border-color 0.15s ease;
      min-height: 28px;
    }

    vscode-button::part(control) {
      background: #2e2e2e;
      color: #cccccc;
      border: 1px solid #3c3c3c;
      font-size: 13px;
      font-weight: 400;
      padding: 6px 12px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    vscode-button:hover::part(control) {
      background: #3a3a3a !important;
      border-color: #505050 !important;
    }

    vscode-button:active::part(control) {
      background: #242424;
    }

    vscode-button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    .divider {
      height: 1px;
      background: #3c3c3c;
      margin: 12px 0;
    }

    vscode-divider {
      margin: 12px 0;
    }
  </style>
</head>
<body>
  <div class="sidebar-content">
    <section class="menu-section">
      <h3 class="section-header">Script Converter</h3>
      <div class="button-grid">
        <vscode-button appearance="secondary" id="convertNewTab" title="Convert v1 to v2 in new tab">
          New Tab
        </vscode-button>
        <vscode-button appearance="secondary" id="convertDiff" title="Show diff between v1 and v2">
          Diff
        </vscode-button>
        <vscode-button appearance="secondary" id="convertReplace" title="Convert and replace current file">
          Replace
        </vscode-button>
        <vscode-button appearance="secondary" id="convertBatch" title="Batch convert multiple files">
          Batch
        </vscode-button>
      </div>
    </section>

    <vscode-divider></vscode-divider>

    <section class="menu-section">
      <h3 class="section-header">Library Manager</h3>
      <div class="button-grid">
        <vscode-button appearance="secondary" id="viewDependencies" title="View installed libraries">
          View
        </vscode-button>
        <vscode-button appearance="secondary" id="installPackage" title="Install a new library">
          Install
        </vscode-button>
        <vscode-button appearance="secondary" id="updatePackages" title="Check for library updates">
          Update
        </vscode-button>
        <vscode-button appearance="secondary" id="editLibrary" title="Edit library metadata">
          Edit
        </vscode-button>
      </div>
    </section>

    <vscode-divider></vscode-divider>

    <section class="menu-section">
      <h3 class="section-header">Tools</h3>
      <div class="button-grid">
        <vscode-button appearance="secondary" id="extractMetadata" title="Extract function metadata">
          Extract
        </vscode-button>
        <vscode-button appearance="secondary" id="showImportsGuide" title="Show imports & modules guide">
          Imports
        </vscode-button>
        <vscode-button appearance="secondary" id="updateHeader" title="Update script header directives">
          Header
        </vscode-button>
        <vscode-button appearance="secondary" id="generateJSDoc" title="Generate JSDoc header">
          JSDoc
        </vscode-button>
      </div>
    </section>

    <vscode-divider></vscode-divider>

    <section class="menu-section">
      <h3 class="section-header">Settings</h3>
      <div class="button-grid">
        <vscode-button appearance="secondary" id="toolboxSettings" title="Open toolbox settings">
          Toolbox
        </vscode-button>
        <vscode-button appearance="secondary" id="extensionSettings" title="Open extension settings">
          Extension
        </vscode-button>
      </div>
    </section>
  </div>

  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();

    const actionMap = {
      'convertNewTab': { type: 'executeCommand', command: 'ahk.convertV1toV2' },
      'convertDiff': { type: 'executeCommand', command: 'ahk.convertV1toV2.diff' },
      'convertReplace': { type: 'executeCommand', command: 'ahk.convertV1toV2.replace' },
      'convertBatch': { type: 'executeCommand', command: 'ahk.convertV1toV2.batch' },
      'extractMetadata': { type: 'executeCommand', command: 'ahk.extractFunctionMetadata' },
      'viewDependencies': { type: 'executeCommand', command: 'workbench.view.extension.ahkv2-toolbox' },
      'installPackage': { type: 'executeCommand', command: 'ahkPackageManager.installPackage' },
      'updatePackages': { type: 'executeCommand', command: 'ahkPackageManager.updatePackage' },
      'editLibrary': { type: 'showEditForm' },
      'updateHeader': { type: 'executeCommand', command: 'ahk.updateHeader' },
      'generateJSDoc': { type: 'executeCommand', command: 'ahkPackageManager.generateJSDocHeader' },
      'showImportsGuide': { type: 'executeCommand', command: 'ahkv2Toolbox.showImportsGuide' },
      'toolboxSettings': { type: 'showSettings' },
      'extensionSettings': { type: 'executeCommand', command: 'workbench.action.openSettings', args: ['${extensionSettingsQuery}'] }
    };

    document.querySelectorAll('vscode-button').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const action = actionMap[button.id];
        if (action) {
          vscode.postMessage(action);
        }
      }, { passive: true });

      // Add hover effects by targeting shadow DOM control element
      button.addEventListener('mouseenter', () => {
        const control = button.shadowRoot?.querySelector('.control');
        if (control) {
          const isIcon = button.getAttribute('appearance') === 'icon';
          const isPrimary = button.getAttribute('appearance') === 'primary';
          if (isIcon) {
            control.style.background = 'rgba(255, 255, 255, 0.15)';
            control.style.borderRadius = '4px';
          } else if (isPrimary) {
            control.style.background = 'var(--vscode-button-hoverBackground)';
          } else {
            control.style.background = '#3a3a3a';
            control.style.borderColor = '#505050';
          }
        }
      });
      button.addEventListener('mouseleave', () => {
        const control = button.shadowRoot?.querySelector('.control');
        if (control) {
          control.style.background = '';
          control.style.borderColor = '';
          control.style.borderRadius = '';
        }
      });
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get settings view HTML
   */
  private getSettingsHtml(settings: ToolboxSettings): string {
    if (!this._view) {
      return '';
    }

    const webview = this._view.webview;
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js')
    );
    const codiconsUri = 'https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.32/dist/codicon.css';
    const scriptNonce = this.getNonce();
    const escapedGithubToken = this.escapeAttribute(settings.githubToken || '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'nonce-${scriptNonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
  <title>Settings</title>
  <link rel="stylesheet" href="${codiconsUri}">
  <script type="module" nonce="${scriptNonce}" src="${toolkitUri}"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      line-height: 1.5;
      overflow-y: scroll;
      width: 100%;
      box-sizing: border-box;
    }

    /* Force consistent width regardless of scrollbar */
    .sidebar-content,
    .menu-section {
      box-sizing: border-box;
    }

    .header {
      padding: 12px 16px;
      background: var(--vscode-sideBarSectionHeader-background);
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .header h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-sideBarTitle-foreground);
      flex: 1;
    }

    vscode-button[appearance="icon"] {
      width: 32px;
      height: 32px;
      min-width: 32px;
      min-height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    vscode-button[appearance="icon"]::part(control) {
      background: transparent;
      border: none;
      padding: 0;
      transition: background 0.1s ease;
      cursor: pointer;
    }

    vscode-button[appearance="icon"].hovered::part(control) {
      background: rgba(255, 255, 255, 0.15) !important;
      border-radius: 4px;
    }

    vscode-button[appearance="icon"]:active::part(control) {
      background: rgba(255, 255, 255, 0.05);
    }

    .settings-container {
      padding: 12px 0;
    }

    .settings-section {
      margin-bottom: 12px;
      padding: 0 24px;
    }

    /* Match mockup section headers: 11px, uppercase, #969696 */
    .section-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #969696;
      margin: 0 0 12px 0;
      padding: 0;
    }

    .setting-row {
      margin-bottom: 12px;
    }

    .setting-label {
      font-weight: 500;
      font-size: 12px;
      color: var(--vscode-foreground);
      margin-bottom: 6px;
      display: block;
    }

    .setting-control {
      width: 100%;
    }

    .setting-description {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
      line-height: 1.4;
      opacity: 0.8;
    }

    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 12px;
    }

    .checkbox-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    /* Native HTML form controls */
    input[type="text"],
    select {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #3e3e42);
      padding: 4px 8px;
      font-size: 12px;
      font-family: inherit;
      border-radius: 2px;
      height: 26px;
      transition: border-color 0.15s ease, outline 0.15s ease;
      box-sizing: border-box;
    }

    select {
      cursor: pointer;
      padding: 2px 8px;
    }

    input[type="text"]:focus,
    select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
      border-color: var(--vscode-focusBorder);
    }

    input[type="text"]::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      margin-top: 2px;
      accent-color: var(--vscode-button-background, #0e639c);
      background-color: var(--vscode-checkbox-background, #3c3c3c);
      border: 1px solid var(--vscode-checkbox-border, #6b6b6b);
      border-radius: 3px;
      appearance: none;
      -webkit-appearance: none;
      position: relative;
    }

    input[type="checkbox"]:checked {
      background-color: var(--vscode-button-background, #0e639c);
      border-color: var(--vscode-button-background, #0e639c);
    }

    input[type="checkbox"]:checked::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 4px;
      height: 8px;
      border: solid var(--vscode-button-foreground, #ffffff);
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    input[type="checkbox"]:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    input[type="checkbox"]:hover {
      border-color: var(--vscode-focusBorder);
    }

    .checkbox-row label {
      cursor: pointer;
      font-size: 12px;
      line-height: 1.4;
    }

    /* Divider styling to match mockup */
    .divider {
      height: 1px;
      background: #3c3c3c;
      margin: 12px 0;
    }

    vscode-divider {
      margin: 12px 0;
      border-top: 1px solid var(--vscode-widget-border, #3c3c3c);
    }

    vscode-divider::part(root) {
      border-color: var(--vscode-widget-border, #3c3c3c);
    }

    /* Button group with vertical stack */
    .button-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 16px;
    }

    .button-group vscode-button {
      width: 100%;
      height: 32px;
      margin: 0;
    }

    /* Match button styling from mockup */
    vscode-button::part(control) {
      background: #2e2e2e;
      color: #cccccc;
      border: 1px solid #3c3c3c;
      font-size: 13px;
      font-weight: 400;
      padding: 6px 12px;
      height: 32px;
    }

    vscode-button.hovered::part(control) {
      background: #3a3a3a !important;
      border-color: #505050 !important;
    }

    vscode-button:active::part(control) {
      background: #242424;
    }

    vscode-button[appearance="primary"]::part(control) {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
    }

    vscode-button[appearance="primary"]:hover::part(control) {
      background: var(--vscode-button-hoverBackground);
    }

    /* Back button (icon style) */
    .back-btn {
      width: 28px;
      height: 28px;
      min-width: 28px;
      min-height: 28px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--vscode-foreground);
      transition: background 0.15s ease;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .back-btn:active {
      background: rgba(255, 255, 255, 0.05);
    }

    /* Native HTML button styling */
    button.button-primary,
    button.button-secondary {
      width: 100%;
      height: 32px;
      margin: 0;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 400;
      font-family: inherit;
      text-align: center;
      cursor: pointer;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s ease;
      border: none;
    }

    button.button-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    button.button-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button.button-primary:active {
      background: var(--vscode-button-background);
      opacity: 0.9;
    }

    button.button-secondary {
      background: #2e2e2e;
      color: #cccccc;
      border: 1px solid #3c3c3c;
    }

    button.button-secondary:hover {
      background: #3a3a3a;
      border-color: #505050;
    }

    button.button-secondary:active {
      background: #242424;
    }
  </style>
</head>
<body>
  <div class="header">
    <button class="back-btn" id="back-btn" title="Back to toolbox" aria-label="Back to main">
      <span class="codicon codicon-arrow-left"></span>
    </button>
    <h2>Settings</h2>
  </div>

  <div class="settings-container">
    <!-- Header Configuration Section -->
    <section class="settings-section" role="region" aria-label="Header Configuration">
      <h3 class="section-header">Header Configuration</h3>

      <div class="setting-row checkbox-row">
        <input type="checkbox" id="auto-insert" ${settings.autoInsertHeaders ? 'checked' : ''}>
        <label for="auto-insert">Auto-insert headers when installing packages</label>
      </div>
      <div class="setting-description" style="margin-bottom: 12px;">
        Automatically adds #Requires and #Include directives to your script
      </div>

      <div class="setting-row">
        <label for="requires-version" class="setting-label">Default Version</label>
        <input
          type="text"
          id="requires-version"
          value="${settings.defaultRequires}"
          placeholder="e.g., AutoHotkey v2.1"
          class="setting-control">
        <div class="setting-description">
          Version string for #Requires directive
        </div>
      </div>

      <div class="setting-row">
        <label for="single-instance" class="setting-label">Single Instance Mode</label>
        <select id="single-instance" class="setting-control">
          <option value="Force" ${settings.defaultSingleInstance === 'Force' ? 'selected' : ''}>Force</option>
          <option value="Ignore" ${settings.defaultSingleInstance === 'Ignore' ? 'selected' : ''}>Ignore</option>
          <option value="Prompt" ${settings.defaultSingleInstance === 'Prompt' ? 'selected' : ''}>Prompt</option>
          <option value="Off" ${settings.defaultSingleInstance === 'Off' ? 'selected' : ''}>Off</option>
        </select>
        <div class="setting-description">
          Default #SingleInstance mode for new scripts
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <!-- Library Folders Section -->
    <section class="settings-section" role="region" aria-label="Library Folders">
      <h3 class="section-header">Library Folders</h3>

      <div class="setting-row">
        <label for="include-format" class="setting-label">Include Path Format</label>
        <input
          type="text"
          id="include-format"
          value="${settings.includeFormat}"
          placeholder="Lib/{name}.ahk"
          class="setting-control">
        <div class="setting-description">
          Template for #Include paths. Use {name} as placeholder for package name
        </div>
      </div>

      <div class="setting-row">
        <label for="lib-folders" class="setting-label">Search Folders</label>
        <input
          type="text"
          id="lib-folders"
          value="${settings.libFolders?.join(', ') || ''}"
          placeholder="Lib, vendor"
          class="setting-control">
        <div class="setting-description">
          Comma-separated list of library search folders (relative to workspace)
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <section class="settings-section" role="region" aria-label="GitHub API">
      <h3 class="section-header">GitHub API</h3>

      <div class="setting-row">
        <label for="github-token" class="setting-label">GitHub Token</label>
        <input
          type="password"
          id="github-token"
          value="${escapedGithubToken}"
          placeholder="ghp_..."
          class="setting-control">
        <div class="setting-description">
          Optional personal access token used for higher GitHub API rate limits.
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <!-- Action Buttons -->
    <section class="settings-section">
      <div class="button-group">
        <button id="save-btn" class="button-primary" title="Save all settings (Ctrl+S)">
          Save Settings
        </button>
        <button id="reset-btn" class="button-secondary" title="Reset to default values">
          Reset to Defaults
        </button>
      </div>
    </section>
  </div>

  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();

    // Load saved settings
    window.addEventListener('load', () => {
      loadSettings();
    });

    function loadSettings() {
      // TODO: Load settings from extension storage
      // For now, using defaults
    }

    function handleSaveSettings() {
      const settings = {
        headerSettings: {
          autoInsert: document.getElementById('auto-insert').checked,
          defaultRequires: document.getElementById('requires-version').value,
          singleInstance: document.getElementById('single-instance').value
        },
        libFolderSettings: {
          includeFormat: document.getElementById('include-format').value,
          searchFolders: document.getElementById('lib-folders').value.split(',').map(s => s.trim())
        },
        githubToken: document.getElementById('github-token').value
      };

      vscode.postMessage({ type: 'saveSettings', settings });

      // Show feedback
      const saveBtn = document.getElementById('save-btn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '✓ Saved';
      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 2000);
    }

    function handleResetSettings() {
      document.getElementById('auto-insert').checked = false;
      document.getElementById('requires-version').value = 'AutoHotkey v2.1';
      document.getElementById('single-instance').value = 'Force';
      document.getElementById('include-format').value = 'Lib/{name}.ahk';
      document.getElementById('lib-folders').value = 'Lib, vendor';
      document.getElementById('github-token').value = '';
    }

    // Button click handlers
    document.getElementById('back-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'showMain' });
    });

    document.getElementById('save-btn')?.addEventListener('click', () => {
      handleSaveSettings();
    });

    document.getElementById('reset-btn')?.addEventListener('click', () => {
      handleResetSettings();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          handleSaveSettings();
        }
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get edit form HTML
   */
  private getEditFormHtml(metadata: LibraryMetadata, filePath: string): string {
    if (!this._view) {
      return '';
    }

    const webview = this._view.webview;
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js')
    );
    const codiconsUri = 'https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.32/dist/codicon.css';
    const scriptNonce = this.getNonce();

    const escapeAttr = (value?: string) => this.escapeAttribute(value || '');
    const escapeText = (value?: string) => this.escapeHtml(value || '');
    const fileName = filePath ? require('path').basename(filePath) : 'No file open';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'nonce-${scriptNonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
  <title>Edit Library</title>
  <link rel="stylesheet" href="${codiconsUri}">
  <script type="module" nonce="${scriptNonce}" src="${toolkitUri}"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      line-height: 1.5;
      overflow-y: auto;
      width: 100%;
    }

    .header {
      padding: 12px 16px;
      background: var(--vscode-sideBarSectionHeader-background);
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-sideBarTitle-foreground);
      flex: 1;
    }

    .back-btn {
      width: 28px;
      height: 28px;
      min-width: 28px;
      min-height: 28px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--vscode-foreground);
      transition: background 0.15s ease;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .file-info {
      padding: 8px 24px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    }

    .file-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .file-path {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .form-container {
      padding: 16px 24px;
    }

    .form-section {
      margin-bottom: 16px;
    }

    .section-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #969696;
      margin: 0 0 12px 0;
    }

    .form-field {
      margin-bottom: 12px;
    }

    .form-field label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--vscode-foreground);
    }

    .form-field input,
    .form-field textarea {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #3e3e42);
      border-radius: 2px;
      font-size: 12px;
      font-family: inherit;
    }

    .form-field textarea {
      min-height: 60px;
      resize: vertical;
    }

    .form-field input:focus,
    .form-field textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .divider {
      height: 1px;
      background: #3c3c3c;
      margin: 16px 0;
    }

    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    .button-group button {
      flex: 1;
      height: 32px;
      padding: 0 16px;
      font-size: 13px;
      font-family: inherit;
      border-radius: 2px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
    }

    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background: #2e2e2e;
      color: #cccccc;
      border: 1px solid #3c3c3c;
    }

    .btn-secondary:hover {
      background: #3a3a3a;
      border-color: #505050;
    }

    .no-file-warning {
      padding: 12px;
      background: var(--vscode-inputValidation-warningBackground);
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <button class="back-btn" id="back-btn" title="Back to main" aria-label="Back">
      <span class="codicon codicon-arrow-left"></span>
    </button>
    <h2>Edit Library</h2>
  </div>

  <div class="file-info">
    <div class="file-name">${escapeText(fileName)}</div>
    <div class="file-path">${escapeText(filePath || 'No AHK file open')}</div>
  </div>

  <div class="form-container">
    ${!filePath ? '<div class="no-file-warning">⚠️ Open an AHK file to edit its metadata</div>' : ''}

    <div class="form-section">
      <h3 class="section-header">Basic Information</h3>

      <div class="form-field">
        <label for="lib-file">File</label>
        <input type="text" id="lib-file" value="${escapeAttr(metadata.file)}" placeholder="filename.ahk">
      </div>

      <div class="form-field">
        <label for="lib-description">Description</label>
        <textarea id="lib-description" placeholder="Library description">${escapeText(metadata.description)}</textarea>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="lib-author">Author</label>
          <input type="text" id="lib-author" value="${escapeAttr(metadata.author)}" placeholder="Author name">
        </div>

        <div class="form-field">
          <label for="lib-version">Version</label>
          <input type="text" id="lib-version" value="${escapeAttr(metadata.version)}" placeholder="1.0.0">
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="lib-date">Date</label>
          <input type="text" id="lib-date" value="${escapeAttr(metadata.date)}" placeholder="YYYY/MM/DD">
        </div>

        <div class="form-field">
          <label for="lib-license">License</label>
          <input type="text" id="lib-license" value="${escapeAttr(metadata.license)}" placeholder="MIT, GPL, etc.">
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="form-section">
      <h3 class="section-header">Links & Dependencies</h3>

      <div class="form-field">
        <label for="lib-repository">Repository</label>
        <input type="text" id="lib-repository" value="${escapeAttr(metadata.repository)}" placeholder="https://github.com/...">
      </div>

      <div class="form-field">
        <label for="lib-requires">Requires</label>
        <input type="text" id="lib-requires" value="${escapeAttr(metadata.requires?.join(', '))}" placeholder="AutoHotkey v2.0+">
      </div>
    </div>

    <div class="divider"></div>

    <div class="button-group">
      <button class="btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn-primary" id="update-btn" ${filePath ? '' : 'disabled'}>Update</button>
    </div>
  </div>

  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
    const libraryFilePath = ${JSON.stringify(filePath || '')};

    document.getElementById('back-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'showMain' });
    });

    document.getElementById('cancel-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'showMain' });
    });

    document.getElementById('update-btn')?.addEventListener('click', () => {
      if (!libraryFilePath) {
        vscode.postMessage({ type: 'showMain' });
        return;
      }

      const getValue = (id) => (document.getElementById(id)?.value || '').trim();
      const requires = getValue('lib-requires')
        .split(/[,\\n]/)
        .map(item => item.trim())
        .filter(Boolean);

      vscode.postMessage({
        type: 'saveLibraryMetadata',
        filePath: libraryFilePath,
        metadata: {
          file: getValue('lib-file'),
          description: getValue('lib-description'),
          author: getValue('lib-author'),
          version: getValue('lib-version'),
          date: getValue('lib-date'),
          license: getValue('lib-license'),
          repository: getValue('lib-repository'),
          requires
        }
      });
    });
  </script>
</body>
</html>`;
  }
}
