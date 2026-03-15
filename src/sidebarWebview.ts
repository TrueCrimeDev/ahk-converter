import * as vscode from 'vscode';
import * as path from 'path';

export class AHKv2ToolboxWebview {
  private static instance: AHKv2ToolboxWebview;
  private _panel: vscode.WebviewPanel | undefined;
  private _context: vscode.ExtensionContext;
  private readonly extensionId: string;

  private constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.extensionId = context.extension.id;
  }

  public static getInstance(context: vscode.ExtensionContext): AHKv2ToolboxWebview {
    if (!this.instance) {
      this.instance = new AHKv2ToolboxWebview(context);
    }
    return this.instance;
  }

  public createOrShowPanel() {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const iconPath = vscode.Uri.file(path.join(this._context.extensionPath, 'media', 'autohotkey2.svg'));
    this._panel = vscode.window.createWebviewPanel(
      'ahkv2Toolbox',
      'AHKv2 Toolbox',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this._context.extensionPath, 'media')),
          vscode.Uri.file(path.join(this._context.extensionPath, 'src'))
        ]
      }
    );
    
    // Set the webview panel's icon
    this._panel.iconPath = {
      light: iconPath,
      dark: iconPath
    };

    this._panel.webview.html = this.getWebviewContent();

    const extensionSettingsQuery = `@ext:${this.extensionId}`;

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'scriptConverter':
            vscode.commands.executeCommand('ahk.convertV1toV2');
            return;
          case 'functionMetadata':
            vscode.commands.executeCommand('ahk.extractFunctionMetadata');
            return;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', extensionSettingsQuery);
            return;
          case 'libraryManager':
            vscode.window.showInformationMessage('Library Manager - Coming soon!');
            return;
          case 'updateHeader':
            vscode.commands.executeCommand('ahk.updateHeader');
            return;
          case 'settings':
            vscode.commands.executeCommand('workbench.action.openSettings', extensionSettingsQuery);
            return;
          case 'quickFixes':
            vscode.window.showInformationMessage('Quick Fixes - Coming soon!');
            return;
        }
      },
      undefined,
      this._context.subscriptions
    );

    this._panel.onDidDispose(
      () => {
        this._panel = undefined;
      },
      null,
      this._context.subscriptions
    );
  }

  public getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AHKv2 Toolbox</title>
        <script type=\"module\" src=\"@vscode/webview-ui-toolkit/dist/toolkit.js\"></script>
        <style>
          body {
            padding: 16px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
          }
          .section {
            margin-bottom: 24px;
          }
          .button-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          vscode-button {
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class=\"section\">
          <h2>Tools</h2>
          <div class=\"button-group\">
            <vscode-button onclick=\"vscode.postMessage({command: 'scriptConverter'})\">Script Converter</vscode-button>
            <vscode-button onclick=\"vscode.postMessage({command: 'functionMetadata'})\">Function Metadata</vscode-button>
            <vscode-button onclick=\"vscode.postMessage({command: 'libraryManager'})\">Library Manager</vscode-button>
            <vscode-button onclick=\"vscode.postMessage({command: 'updateHeader'})\">Update Header</vscode-button>
            <vscode-button onclick=\"vscode.postMessage({command: 'quickFixes'})\">Quick Fixes</vscode-button>
          </div>
        </div>
        <vscode-divider></vscode-divider>
        <div class=\"section\">
          <h2>Settings</h2>
          <div class=\"button-group\">
            <vscode-button appearance=\"secondary\" onclick=\"vscode.postMessage({command: 'openSettings'})\">Extension Settings</vscode-button>
          </div>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
        </script>
      </body>
      </html>
    `;
  }
}
