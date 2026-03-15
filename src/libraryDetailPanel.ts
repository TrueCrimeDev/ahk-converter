import * as vscode from 'vscode';

export interface LibraryDetailData {
  name: string;
  version: string;
  description?: string;
  packageType: 'installed' | 'available' | 'updates';
  absolutePath?: string;
  relativePath?: string;
  includePreview?: string;
  author?: string;
  category?: string;
  stars?: number;
  repositoryUrl?: string;
  lastModifiedLabel?: string;
  sizeLabel?: string;
}

export interface LibraryDetailPanelActions {
  onAddInclude?: () => Thenable<void> | void;
  onOpenFile?: () => Thenable<void> | void;
  onRevealInExplorer?: () => Thenable<void> | void;
  onOpenRepository?: () => Thenable<void> | void;
  onCopyPath?: () => Thenable<void> | void;
}

interface PanelMessage {
  command: 'addInclude' | 'openFile' | 'reveal' | 'openRepository' | 'copyPath';
}

export class LibraryDetailPanel {
  private static currentPanel: LibraryDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private data: LibraryDetailData;
  private actions: LibraryDetailPanelActions;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel,
    data: LibraryDetailData,
    actions: LibraryDetailPanelActions
  ) {
    this.panel = panel;
    this.data = data;
    this.actions = actions;

    this.panel.onDidDispose(() => this.dispose(), undefined, this.context.subscriptions);
    this.panel.webview.onDidReceiveMessage(
      async (message: PanelMessage) => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    this.updateWebview();
  }

  public static show(
    context: vscode.ExtensionContext,
    data: LibraryDetailData,
    actions: LibraryDetailPanelActions
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (LibraryDetailPanel.currentPanel) {
      LibraryDetailPanel.currentPanel.update(data, actions);
      LibraryDetailPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'ahkLibraryDetail',
      `Library Details - ${data.name}`,
      column ?? vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri]
      }
    );

    LibraryDetailPanel.currentPanel = new LibraryDetailPanel(context, panel, data, actions);
  }

  private update(data: LibraryDetailData, actions: LibraryDetailPanelActions): void {
    this.data = data;
    this.actions = actions;
    this.panel.title = `Library Details - ${data.name}`;
    this.updateWebview();
  }

  private async handleMessage(message: PanelMessage): Promise<void> {
    try {
      switch (message.command) {
        case 'addInclude':
          if (this.actions.onAddInclude) {
            await this.actions.onAddInclude();
          }
          break;
        case 'openFile':
          if (this.actions.onOpenFile) {
            await this.actions.onOpenFile();
          }
          break;
        case 'reveal':
          if (this.actions.onRevealInExplorer) {
            await this.actions.onRevealInExplorer();
          }
          break;
        case 'openRepository':
          if (this.actions.onOpenRepository) {
            await this.actions.onOpenRepository();
          }
          break;
        case 'copyPath':
          if (this.actions.onCopyPath) {
            await this.actions.onCopyPath();
          }
          break;
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Library detail action failed: ${messageText}`);
    }
  }

  private updateWebview(): void {
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
  }

  private dispose(): void {
    if (LibraryDetailPanel.currentPanel === this) {
      LibraryDetailPanel.currentPanel = undefined;
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'node_modules',
        '@vscode',
        'webview-ui-toolkit',
        'dist',
        'toolkit.js'
      )
    );

    const codiconsUri = 'https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css';

    const hasAddInclude = !!this.actions.onAddInclude;
    const hasOpenFile = !!this.actions.onOpenFile;
    const hasReveal = !!this.actions.onRevealInExplorer;
    const hasRepository = !!this.actions.onOpenRepository;
    const hasCopyPath = !!this.actions.onCopyPath;

    const sections: string[] = [];

    if (this.data.author) {
      sections.push(this.renderMetaRow('Author', this.data.author));
    }
    if (this.data.category) {
      sections.push(this.renderMetaRow('Category', this.data.category));
    }
    if (typeof this.data.stars === 'number') {
      sections.push(this.renderMetaRow('Stars', `${this.data.stars.toLocaleString()} ★`));
    }
    if (this.data.lastModifiedLabel) {
      sections.push(this.renderMetaRow('Last Modified', this.data.lastModifiedLabel));
    }
    if (this.data.sizeLabel) {
      sections.push(this.renderMetaRow('File Size', this.data.sizeLabel));
    }

    const pathDisplay = this.data.relativePath || this.data.absolutePath || 'Not available';
    const escapedPath = this.escapeHtml(pathDisplay);

    const includePreview = this.data.includePreview
      ? `<code class="code-block">${this.escapeHtml(this.data.includePreview)}</code>`
      : '';

    const repositoryLink = hasRepository && this.data.repositoryUrl
      ? `<a class="link" href="${this.escapeAttribute(this.data.repositoryUrl)}" target="_blank" rel="noreferrer noopener">${this.escapeHtml(this.data.repositoryUrl)}</a>`
      : this.data.repositoryUrl
        ? this.escapeHtml(this.data.repositoryUrl)
        : 'Not available';

    const repositoryRow = this.data.repositoryUrl
      ? this.renderMetaRow('Repository', repositoryLink, true)
      : '';

    const descriptionHtml = this.data.description
      ? `<p class="description">${this.escapeHtml(this.data.description)}</p>`
      : '<p class="description muted">No description available.</p>';

    const scriptNonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src 'unsafe-inline' ${webview.cspSource} ${codiconsUri}; script-src 'nonce-${scriptNonce}'; font-src ${webview.cspSource} https:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Library Details</title>
  <link rel="stylesheet" href="${codiconsUri}" />
  <script type="module" nonce="${scriptNonce}" src="${toolkitUri}"></script>
  <style>
    :root {
      color-scheme: var(--vscode-color-scheme, dark);
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
    }

    .container {
      padding: 16px 24px 32px;
      max-width: 760px;
      margin: 0 auto;
    }

    .heading {
      margin-bottom: 4px;
      font-size: 20px;
      font-weight: 600;
    }

    .subheading {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 12px;
      margin-top: 12px;
    }

    .description {
      margin: 16px 0 20px;
      line-height: 1.5;
    }

    .description.muted {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    .meta-grid {
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 16px;
      background: var(--vscode-sideBar-background);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .meta-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .meta-label {
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .meta-value {
      font-size: 13px;
      word-break: break-all;
    }

    .link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }

    .link:hover {
      text-decoration: underline;
    }

    .code-block {
      display: block;
      padding: 8px 12px;
      background: rgba(128, 128, 128, 0.12);
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family, "Consolas", "Courier New", monospace);
      font-size: 12px;
      margin-top: 4px;
      word-break: break-all;
    }

    .actions {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    vscode-button::part(control) {
      font-size: 13px;
      justify-content: center;
    }

    .section-title {
      margin-top: 24px;
      font-size: 14px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="heading">${this.escapeHtml(this.data.name)}</div>
    <p class="subheading">Version ${this.escapeHtml(this.data.version)} · ${this.escapeHtml(this.capitalize(this.data.packageType))}</p>
    <div class="badge">
      <span class="codicon codicon-package"></span>
      Library Detail
    </div>

    ${descriptionHtml}

    <div class="meta-grid">
      <div class="meta-row">
        <div class="meta-label">Location</div>
        <div class="meta-value">${escapedPath}</div>
        ${hasCopyPath ? '<vscode-button appearance="secondary" id="copyPath">Copy Path</vscode-button>' : ''}
      </div>
      ${sections.join('')}
      ${repositoryRow}
      ${includePreview ? `<div class="meta-row"><div class="meta-label">Include Preview</div>${includePreview}</div>` : ''}
    </div>

    <div class="section-title">Actions</div>
    <div class="actions">
      <vscode-button id="addInclude" ${hasAddInclude ? '' : 'disabled'}>Add #Include</vscode-button>
      <vscode-button id="openFile" ${hasOpenFile ? '' : 'disabled'}>Open File</vscode-button>
      <vscode-button id="reveal" ${hasReveal ? '' : 'disabled'}>Reveal in Explorer</vscode-button>
      <vscode-button id="openRepository" ${hasRepository ? '' : 'disabled'}>Open Repository</vscode-button>
    </div>
  </div>

  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
    const buttons = [
      { id: 'addInclude', command: 'addInclude' },
      { id: 'openFile', command: 'openFile' },
      { id: 'reveal', command: 'reveal' },
      { id: 'openRepository', command: 'openRepository' },
      { id: 'copyPath', command: 'copyPath' }
    ];

    for (const btn of buttons) {
      const element = document.getElementById(btn.id);
      if (!element || element.hasAttribute('disabled')) {
        continue;
      }

      element.addEventListener('click', () => {
        vscode.postMessage({ command: btn.command });
      });
    }
  </script>
</body>
</html>`;
  }

  private renderMetaRow(label: string, value: string, allowHtml: boolean = false): string {
    return `
      <div class="meta-row">
        <div class="meta-label">${this.escapeHtml(label)}</div>
        <div class="meta-value">${allowHtml ? value : this.escapeHtml(value)}</div>
      </div>
    `;
  }

  private capitalize(text: string): string {
    if (!text) {
      return '';
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }

  private getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => possible.charAt(Math.floor(Math.random() * possible.length))).join('');
  }
}
