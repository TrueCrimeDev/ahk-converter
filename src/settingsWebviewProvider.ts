import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Settings webview provider for AHKv2 Toolbox configuration
 */
export class SettingsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ahkv2Toolbox.settings';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveSettings':
          await this.saveSettings(data.settings);
          break;
        case 'browseFolder':
          await this.browseFolder(data.settingKey);
          break;
      }
    });

    // Load current settings
    this.loadSettings();
  }

  private async saveSettings(settings: any) {
    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');

    try {
      // Header settings
      if (settings.headerSettings) {
        await config.update('autoInsertHeaders', settings.headerSettings.autoInsert, vscode.ConfigurationTarget.Global);
        await config.update('headerOrder', settings.headerSettings.order, vscode.ConfigurationTarget.Global);
        await config.update('defaultRequires', settings.headerSettings.defaultRequires, vscode.ConfigurationTarget.Global);
        await config.update('defaultSingleInstance', settings.headerSettings.defaultSingleInstance, vscode.ConfigurationTarget.Global);
      }

      // Lib folder settings
      if (settings.libFolderSettings) {
        await config.update('libFolders', settings.libFolderSettings.folders, vscode.ConfigurationTarget.Global);
        await config.update('includeFormat', settings.libFolderSettings.includeFormat, vscode.ConfigurationTarget.Global);
      }

      vscode.window.showInformationMessage('Settings saved successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save settings: ${error}`);
    }
  }

  private async browseFolder(settingKey: string) {
    const result = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select Folder'
    });

    if (result && result[0]) {
      const folderPath = result[0].fsPath;
      this._view?.webview.postMessage({
        type: 'folderSelected',
        settingKey,
        path: folderPath
      });
    }
  }

  private loadSettings() {
    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');

    const settings = {
      headerSettings: {
        autoInsert: config.get('autoInsertHeaders', false),
        order: config.get('headerOrder', ['#Requires AutoHotkey v2.1', '#SingleInstance Force']),
        defaultRequires: config.get('defaultRequires', 'AutoHotkey v2.1'),
        defaultSingleInstance: config.get('defaultSingleInstance', 'Force')
      },
      libFolderSettings: {
        folders: config.get('libFolders', ['Lib', 'vendor']),
        includeFormat: config.get('includeFormat', 'Lib/{name}.ahk')
      }
    };

    this._view?.webview.postMessage({
      type: 'settingsLoaded',
      settings
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AHKv2 Toolbox Settings</title>
  <style>
    body {
      padding: 20px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    h2 {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
      margin-top: 24px;
      margin-bottom: 16px;
    }
    .section {
      margin-bottom: 24px;
    }
    .field {
      margin-bottom: 12px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
    }
    input[type="text"],
    input[type="url"],
    textarea,
    select {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    input[type="checkbox"] {
      margin-right: 6px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 14px;
      border-radius: 2px;
      cursor: pointer;
      font-size: var(--vscode-font-size);
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .list-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      margin-bottom: 4px;
      background: var(--vscode-list-hoverBackground);
      border-radius: 2px;
    }
    .list-item-content {
      flex: 1;
    }
    .list-item-title {
      font-weight: 500;
    }
    .list-item-desc {
      font-size: 0.9em;
      opacity: 0.8;
    }
    .button-group {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .folder-input-group {
      display: flex;
      gap: 4px;
    }
    .folder-input-group input {
      flex: 1;
    }
    .help-text {
      font-size: 0.9em;
      opacity: 0.7;
      margin-top: 4px;
    }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }
    .tag {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.85em;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .tag button {
      background: transparent;
      border: none;
      color: inherit;
      padding: 0;
      margin: 0;
      cursor: pointer;
      font-size: 1.2em;
      line-height: 1;
    }
  </style>
</head>
<body>
  <h1>⚙️ AHKv2 Toolbox Settings</h1>

  <!-- Header Settings -->
  <div class="section">
    <h2>📝 Header Settings</h2>

    <div class="field">
      <label>
        <input type="checkbox" id="autoInsertHeaders" />
        Auto-insert headers when creating new files
      </label>
      <div class="help-text">Automatically add #Requires and #SingleInstance directives</div>
    </div>

    <div class="field">
      <label for="defaultRequires">Default #Requires Version</label>
      <input type="text" id="defaultRequires" placeholder="AutoHotkey v2.1" />
    </div>

    <div class="field">
      <label for="defaultSingleInstance">Default #SingleInstance Mode</label>
      <select id="defaultSingleInstance">
        <option value="Force">Force</option>
        <option value="Ignore">Ignore</option>
        <option value="Prompt">Prompt</option>
        <option value="Off">Off</option>
      </select>
    </div>

    <div class="field">
      <label>Header Order</label>
      <div id="headerOrderList"></div>
      <div class="help-text">Drag to reorder header directives</div>
    </div>
  </div>

  <!-- Lib Folder Settings -->
  <div class="section">
    <h2>📁 Library Folder Settings</h2>

    <div class="field">
      <label>Library Search Folders</label>
      <div id="libFoldersList"></div>
      <button class="secondary" onclick="addLibFolder()">+ Add Folder</button>
      <div class="help-text">Folders to search for AHK libraries (relative to workspace)</div>
    </div>

    <div class="field">
      <label for="includeFormat">#Include Format Template</label>
      <input type="text" id="includeFormat" placeholder="Lib/{name}.ahk" />
      <div class="help-text">Template for #Include paths. Use {name} for package name</div>
    </div>
  </div>

  <!-- Save Button -->
  <div class="button-group" style="margin-top: 32px;">
    <button onclick="saveSettings()">💾 Save Settings</button>
    <button class="secondary" onclick="resetToDefaults()">🔄 Reset to Defaults</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentSettings = null;

    // Load settings
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'settingsLoaded':
          currentSettings = message.settings;
          populateSettings(message.settings);
          break;
        case 'folderSelected':
          handleFolderSelected(message.settingKey, message.path);
          break;
      }
    });

    function populateSettings(settings) {
      // Header settings
      document.getElementById('autoInsertHeaders').checked = settings.headerSettings.autoInsert;
      document.getElementById('defaultRequires').value = settings.headerSettings.defaultRequires;
      document.getElementById('defaultSingleInstance').value = settings.headerSettings.defaultSingleInstance;

      renderHeaderOrder(settings.headerSettings.order);
      renderLibFolders(settings.libFolderSettings.folders);

      document.getElementById('includeFormat').value = settings.libFolderSettings.includeFormat;
    }

    function renderHeaderOrder(order) {
      const container = document.getElementById('headerOrderList');
      container.innerHTML = order.map(item =>
        \`<div class="tag">\${item}<button onclick="removeHeaderItem('\${item}')">×</button></div>\`
      ).join('');
    }

    function renderLibFolders(folders) {
      const container = document.getElementById('libFoldersList');
      container.innerHTML = folders.map(folder =>
        \`<div class="tag">\${folder}<button onclick="removeLibFolder('\${folder}')">×</button></div>\`
      ).join('');
    }

    function addLibFolder() {
      vscode.postMessage({ type: 'browseFolder', settingKey: 'libFolder' });
    }

    function handleFolderSelected(settingKey, folderPath) {
      if (settingKey === 'libFolder' && currentSettings) {
        if (!currentSettings.libFolderSettings.folders.includes(folderPath)) {
          currentSettings.libFolderSettings.folders.push(folderPath);
          renderLibFolders(currentSettings.libFolderSettings.folders);
        }
      }
    }

    function removeLibFolder(folder) {
      if (currentSettings) {
        currentSettings.libFolderSettings.folders =
          currentSettings.libFolderSettings.folders.filter(f => f !== folder);
        renderLibFolders(currentSettings.libFolderSettings.folders);
      }
    }

    function removeHeaderItem(item) {
      if (currentSettings) {
        currentSettings.headerSettings.order =
          currentSettings.headerSettings.order.filter(i => i !== item);
        renderHeaderOrder(currentSettings.headerSettings.order);
      }
    }

    function saveSettings() {
      const settings = {
        headerSettings: {
          autoInsert: document.getElementById('autoInsertHeaders').checked,
          order: currentSettings.headerSettings.order,
          defaultRequires: document.getElementById('defaultRequires').value,
          defaultSingleInstance: document.getElementById('defaultSingleInstance').value
        },
        libFolderSettings: {
          folders: currentSettings.libFolderSettings.folders,
          includeFormat: document.getElementById('includeFormat').value
        }
      };

      vscode.postMessage({
        type: 'saveSettings',
        settings
      });
    }

    function resetToDefaults() {
      if (confirm('Reset all settings to defaults? This cannot be undone.')) {
        // Will trigger reload with default values
        location.reload();
      }
    }
  </script>
</body>
</html>`;
  }
}
