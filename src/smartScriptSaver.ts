/**
 * Smart Script Saver - AI-powered file naming and organization
 *
 * Analyzes AHK scripts and generates intelligent filenames based on:
 * - Script type (GUI, Hotkey, Class, Function, Tool)
 * - Primary functionality (Clipboard, Window, File, Text, etc.)
 * - Specific purpose (Transform, Cleaner, Manager, Viewer, etc.)
 *
 * Example outputs:
 * - GUI_Clipboard_Transform.ahk
 * - GUI_Window_Manager.ahk
 * - Hotkey_Text_Expander.ahk
 * - Class_JSON_Parser.ahk
 * - Tool_File_Renamer.ahk
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script analysis result
 */
interface ScriptAnalysis {
  /** Primary type: GUI, Hotkey, Class, Function, Tool, Script */
  type: string;
  /** Domain: Clipboard, Window, File, Text, System, Network, etc. */
  domain: string;
  /** Purpose: what it does (Transform, Manager, Viewer, etc.) */
  purpose: string;
  /** Suggested filename without extension */
  suggestedName: string;
  /** Generated description for JSDoc */
  description: string;
  /** Detected exports/main functions */
  exports: string[];
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Pattern definitions for script analysis
 */
const PATTERNS = {
  // Script type detection
  types: [
    { pattern: /\bGui\s*\(|\.Add\s*\(|\.Show\s*\(/i, type: 'GUI', weight: 10 },
    { pattern: /^[#!^+<>*~$]+\w+::/m, type: 'Hotkey', weight: 8 },
    { pattern: /^:[\*\?]?:[^:]+::/m, type: 'Hotstring', weight: 8 },
    { pattern: /^class\s+\w+/mi, type: 'Class', weight: 7 },
    { pattern: /^\w+\s*\([^)]*\)\s*\{/m, type: 'Function', weight: 5 },
    { pattern: /SetTimer|Loop\s*\{|Loop\s+\d+/i, type: 'Tool', weight: 4 },
  ],

  // Domain detection (what area it works with)
  domains: [
    { pattern: /Clipboard|A_Clipboard|ClipboardAll|OnClipboardChange/i, domain: 'Clipboard', weight: 10 },
    { pattern: /WinActivate|WinExist|WinGet|WinSet|WinMove|WinClose|ahk_class|ahk_exe/i, domain: 'Window', weight: 9 },
    { pattern: /FileRead|FileAppend|FileCopy|FileMove|FileDelete|FileSelect|DirSelect/i, domain: 'File', weight: 9 },
    { pattern: /RegEx|StrReplace|StrSplit|SubStr|InStr|StrLen|StrLower|StrUpper/i, domain: 'Text', weight: 7 },
    { pattern: /Run\s*\(|RunWait|ProcessExist|ProcessClose|ComObject/i, domain: 'System', weight: 6 },
    { pattern: /Download|HttpRequest|WinHttp|URLDownloadToFile/i, domain: 'Network', weight: 8 },
    { pattern: /IniRead|IniWrite|RegRead|RegWrite/i, domain: 'Config', weight: 7 },
    { pattern: /SoundPlay|SoundGet|SoundSet/i, domain: 'Audio', weight: 8 },
    { pattern: /ImageSearch|PixelGetColor|PixelSearch/i, domain: 'Image', weight: 8 },
    { pattern: /MouseMove|MouseClick|MouseGetPos|Click|Send\s*\{/i, domain: 'Input', weight: 5 },
    { pattern: /MsgBox|ToolTip|TrayTip|InputBox/i, domain: 'Dialog', weight: 4 },
    { pattern: /Menu|Tray|A_TrayMenu/i, domain: 'Menu', weight: 6 },
    { pattern: /Hotkey|HotIf|Suspend/i, domain: 'Hotkey', weight: 5 },
    { pattern: /JSON|Map\s*\(|Array|Object/i, domain: 'Data', weight: 4 },
  ],

  // Purpose detection (what action it performs)
  purposes: [
    { pattern: /transform|convert|format|parse/i, purpose: 'Transform', weight: 8 },
    { pattern: /clean|sanitize|strip|remove|filter/i, purpose: 'Cleaner', weight: 8 },
    { pattern: /manage|handler|controller|organiz/i, purpose: 'Manager', weight: 7 },
    { pattern: /view|display|show|preview|list/i, purpose: 'Viewer', weight: 6 },
    { pattern: /history|log|record|track/i, purpose: 'History', weight: 7 },
    { pattern: /search|find|locate|lookup/i, purpose: 'Search', weight: 7 },
    { pattern: /copy|paste|duplicate|clone/i, purpose: 'Copier', weight: 6 },
    { pattern: /edit|modify|update|change/i, purpose: 'Editor', weight: 5 },
    { pattern: /create|generate|build|make/i, purpose: 'Generator', weight: 6 },
    { pattern: /delete|remove|clear|reset/i, purpose: 'Remover', weight: 5 },
    { pattern: /backup|save|export|dump/i, purpose: 'Backup', weight: 6 },
    { pattern: /restore|import|load|recover/i, purpose: 'Restore', weight: 6 },
    { pattern: /monitor|watch|observe|detect/i, purpose: 'Monitor', weight: 7 },
    { pattern: /automat|batch|bulk|mass/i, purpose: 'Automator', weight: 7 },
    { pattern: /test|debug|diagnos|check/i, purpose: 'Tester', weight: 5 },
    { pattern: /helper|util|tool|assist/i, purpose: 'Helper', weight: 4 },
    { pattern: /launcher|starter|opener|runner/i, purpose: 'Launcher', weight: 6 },
    { pattern: /picker|selector|chooser/i, purpose: 'Picker', weight: 6 },
    { pattern: /timer|scheduler|reminder|alarm/i, purpose: 'Timer', weight: 7 },
    { pattern: /encrypt|decrypt|secure|protect/i, purpose: 'Security', weight: 7 },
  ],
};

/**
 * Analyzes an AHK script and generates naming suggestions
 */
export function analyzeScript(content: string): ScriptAnalysis {
  const scores = {
    types: new Map<string, number>(),
    domains: new Map<string, number>(),
    purposes: new Map<string, number>(),
  };

  // Score types
  for (const { pattern, type, weight } of PATTERNS.types) {
    const matches = content.match(new RegExp(pattern.source, 'gmi'));
    if (matches) {
      const current = scores.types.get(type) || 0;
      scores.types.set(type, current + matches.length * weight);
    }
  }

  // Score domains
  for (const { pattern, domain, weight } of PATTERNS.domains) {
    const matches = content.match(new RegExp(pattern.source, 'gmi'));
    if (matches) {
      const current = scores.domains.get(domain) || 0;
      scores.domains.set(domain, current + matches.length * weight);
    }
  }

  // Score purposes
  for (const { pattern, purpose, weight } of PATTERNS.purposes) {
    const matches = content.match(new RegExp(pattern.source, 'gmi'));
    if (matches) {
      const current = scores.purposes.get(purpose) || 0;
      scores.purposes.set(purpose, current + matches.length * weight);
    }
  }

  // Get top results
  const topType = getTopScored(scores.types) || 'Script';
  const topDomain = getTopScored(scores.domains) || 'General';
  const topPurpose = getTopScored(scores.purposes) || 'Utility';

  // Extract exports/main functions
  const exports = extractExports(content);

  // Calculate confidence
  const totalScore =
    (scores.types.get(topType) || 0) +
    (scores.domains.get(topDomain) || 0) +
    (scores.purposes.get(topPurpose) || 0);
  const confidence = Math.min(1, totalScore / 50);

  // Generate suggested name
  const suggestedName = `${topType}_${topDomain}_${topPurpose}`;

  // Generate description
  const description = generateDescription(topType, topDomain, topPurpose, exports);

  return {
    type: topType,
    domain: topDomain,
    purpose: topPurpose,
    suggestedName,
    description,
    exports,
    confidence,
  };
}

/**
 * Get highest scored item from a map
 */
function getTopScored(scores: Map<string, number>): string | null {
  let top: string | null = null;
  let topScore = 0;

  for (const [key, score] of scores) {
    if (score > topScore) {
      topScore = score;
      top = key;
    }
  }

  return top;
}

/**
 * Extract exported functions and classes
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];

  // Find class names
  const classMatches = content.matchAll(/^class\s+(\w+)/gmi);
  for (const match of classMatches) {
    exports.push(match[1]);
  }

  // Find top-level function names
  const funcMatches = content.matchAll(/^(\w+)\s*\([^)]*\)\s*\{/gm);
  for (const match of funcMatches) {
    if (!['if', 'while', 'for', 'switch', 'try', 'catch'].includes(match[1].toLowerCase())) {
      exports.push(match[1]);
    }
  }

  return [...new Set(exports)].slice(0, 5);
}

/**
 * Generate a description based on analysis
 */
function generateDescription(type: string, domain: string, purpose: string, exports: string[]): string {
  const typeDesc: Record<string, string> = {
    GUI: 'Graphical user interface',
    Hotkey: 'Keyboard shortcut automation',
    Hotstring: 'Text expansion',
    Class: 'Object-oriented',
    Function: 'Reusable function',
    Tool: 'Automation tool',
    Script: 'AutoHotkey script',
  };

  const domainDesc: Record<string, string> = {
    Clipboard: 'clipboard operations',
    Window: 'window management',
    File: 'file operations',
    Text: 'text processing',
    System: 'system utilities',
    Network: 'network operations',
    Config: 'configuration management',
    Audio: 'audio control',
    Image: 'image operations',
    Input: 'input automation',
    Dialog: 'user dialogs',
    Menu: 'menu operations',
    Hotkey: 'hotkey management',
    Data: 'data structures',
    General: 'general utilities',
  };

  const purposeDesc: Record<string, string> = {
    Transform: 'transforms and converts data',
    Cleaner: 'cleans and sanitizes content',
    Manager: 'manages and organizes resources',
    Viewer: 'displays and previews content',
    History: 'tracks and logs activity',
    Search: 'searches and finds items',
    Copier: 'copies and duplicates content',
    Editor: 'edits and modifies content',
    Generator: 'creates and generates content',
    Remover: 'removes and deletes items',
    Backup: 'backs up and exports data',
    Restore: 'restores and imports data',
    Monitor: 'monitors and observes changes',
    Automator: 'automates repetitive tasks',
    Tester: 'tests and diagnoses issues',
    Helper: 'provides utility functions',
    Launcher: 'launches and runs applications',
    Picker: 'selects and chooses items',
    Timer: 'schedules and times operations',
    Security: 'secures and protects data',
    Utility: 'provides general utility',
  };

  let desc = `${typeDesc[type] || type} for ${domainDesc[domain] || domain} that ${purposeDesc[purpose] || 'provides utility functions'}`;

  if (exports.length > 0) {
    desc += `. Main components: ${exports.join(', ')}`;
  }

  return desc;
}

/**
 * Configuration interface
 */
interface SmartSaveConfig {
  examplesFolder: string;
  autoCreateFolder: boolean;
  includeTimestamp: boolean;
  addJSDoc: boolean;
}

/**
 * Get configuration
 */
function getConfig(): SmartSaveConfig {
  const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
  return {
    examplesFolder: config.get<string>('smartSave.examplesFolder', 'Examples'),
    autoCreateFolder: config.get<boolean>('smartSave.autoCreateFolder', false),
    includeTimestamp: config.get<boolean>('smartSave.includeTimestamp', false),
    addJSDoc: config.get<boolean>('smartSave.addJSDoc', true),
  };
}

/**
 * Generate JSDoc header for the script
 */
function generateJSDocHeader(analysis: ScriptAnalysis, filename: string): string {
  const date = new Date().toISOString().split('T')[0];

  return `/************************************************************************
 * @file: ${filename}
 * @description: ${analysis.description}
 * @author: ${process.env.USERNAME || process.env.USER || 'Author'}
 * @version: 1.0.0
 * @date: ${date}
 * @ahk-version: v2.0+
 * @category: ${analysis.domain}
 * @type: ${analysis.type}
 * @exports: ${analysis.exports.join(', ') || 'N/A'}
 ***********************************************************************/

`;
}

/**
 * Check if content already has a JSDoc header
 */
function hasJSDocHeader(content: string): boolean {
  return /^\/\*{2,}[\s\S]*?\*\//.test(content.trim());
}

/**
 * Main command: Smart Save Script
 */
export async function smartSaveScript(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor. Open an AHK script first.');
    return;
  }

  const document = editor.document;
  if (document.languageId !== 'ahk' && document.languageId !== 'ahk2') {
    vscode.window.showWarningMessage('This command only works with AutoHotkey files.');
    return;
  }

  const content = document.getText();
  const config = getConfig();

  // Analyze the script
  const analysis = analyzeScript(content);

  // Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  // Determine target folder
  let targetFolder = path.join(workspaceRoot, config.examplesFolder);

  // Check if folder exists
  if (!fs.existsSync(targetFolder)) {
    const action = await vscode.window.showInformationMessage(
      `The "${config.examplesFolder}" folder doesn't exist. What would you like to do?`,
      'Create It',
      'Choose Different Folder',
      'Cancel'
    );

    if (action === 'Create It') {
      fs.mkdirSync(targetFolder, { recursive: true });
    } else if (action === 'Choose Different Folder') {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Folder',
        title: 'Choose folder for saving scripts'
      });

      if (!selected || selected.length === 0) {
        return;
      }

      targetFolder = selected[0].fsPath;
    } else {
      return;
    }
  }

  // Show naming preview and let user customize
  const suggestedFilename = config.includeTimestamp
    ? `${analysis.suggestedName}_${Date.now()}.ahk`
    : `${analysis.suggestedName}.ahk`;

  const customName = await vscode.window.showInputBox({
    prompt: 'Enter filename (AI suggestion shown)',
    value: suggestedFilename,
    valueSelection: [0, suggestedFilename.length - 4], // Select name without .ahk
    placeHolder: 'e.g., GUI_Clipboard_Transform.ahk',
    title: `Smart Save - Confidence: ${Math.round(analysis.confidence * 100)}%`,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Filename cannot be empty';
      }
      if (!/^[\w\-_.]+\.ahk$/i.test(value)) {
        return 'Invalid filename. Use letters, numbers, underscores, hyphens.';
      }
      return null;
    }
  });

  if (!customName) {
    return; // User cancelled
  }

  const targetPath = path.join(targetFolder, customName);

  // Check if file already exists
  if (fs.existsSync(targetPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      `File "${customName}" already exists. Overwrite?`,
      'Overwrite',
      'Cancel'
    );

    if (overwrite !== 'Overwrite') {
      return;
    }
  }

  // Prepare content with JSDoc if needed
  let finalContent = content;
  if (config.addJSDoc && !hasJSDocHeader(content)) {
    const header = generateJSDocHeader(analysis, customName);
    finalContent = header + content;
  }

  // Save the file
  try {
    fs.writeFileSync(targetPath, finalContent, 'utf-8');

    // Show success with options
    const action = await vscode.window.showInformationMessage(
      `Saved as "${customName}" to ${path.basename(targetFolder)}/`,
      'Open File',
      'Reveal in Explorer',
      'Done'
    );

    if (action === 'Open File') {
      const doc = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(doc);
    } else if (action === 'Reveal in Explorer') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(targetPath));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to save file: ${message}`);
  }
}

/**
 * Command: Configure Examples Folder
 */
export async function configureExamplesFolder(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const options = [
    { label: 'Examples', description: 'Default folder for example scripts' },
    { label: 'Scripts', description: 'General scripts folder' },
    { label: 'Samples', description: 'Sample code folder' },
    { label: 'Snippets', description: 'Code snippets folder' },
    { label: '$(folder) Choose Custom Folder...', description: 'Browse for a folder' },
  ];

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: 'Select or create a folder for smart-saved scripts',
    title: 'Configure Examples Folder'
  });

  if (!selected) {
    return;
  }

  let folderName: string;

  if (selected.label.includes('Choose Custom')) {
    const customFolder = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(workspaceRoot),
      openLabel: 'Select Folder',
      title: 'Choose folder for saving scripts'
    });

    if (!customFolder || customFolder.length === 0) {
      return;
    }

    // Get relative path from workspace
    folderName = path.relative(workspaceRoot, customFolder[0].fsPath);
  } else {
    folderName = selected.label;
  }

  // Update configuration
  const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
  await config.update('smartSave.examplesFolder', folderName, vscode.ConfigurationTarget.Workspace);

  // Create folder if it doesn't exist
  const fullPath = path.join(workspaceRoot, folderName);
  if (!fs.existsSync(fullPath)) {
    const create = await vscode.window.showInformationMessage(
      `Create "${folderName}" folder now?`,
      'Yes',
      'No'
    );

    if (create === 'Yes') {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  vscode.window.showInformationMessage(`Examples folder set to: ${folderName}`);
}

/**
 * Command: Preview Script Analysis
 */
export async function previewScriptAnalysis(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor. Open an AHK script first.');
    return;
  }

  const content = editor.document.getText();
  const analysis = analyzeScript(content);

  const panel = vscode.window.createWebviewPanel(
    'ahkScriptAnalysis',
    'Script Analysis',
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h1 { color: var(--vscode-textLink-foreground); }
    .card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .value {
      font-size: 18px;
      font-weight: 600;
    }
    .filename {
      font-family: monospace;
      background: var(--vscode-textCodeBlock-background);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 16px;
    }
    .confidence {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      background: ${analysis.confidence > 0.7 ? 'var(--vscode-testing-iconPassed)' : analysis.confidence > 0.4 ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-errorForeground)'};
      color: white;
    }
    .exports {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .export-tag {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>Script Analysis</h1>

  <div class="card">
    <div class="label">Suggested Filename</div>
    <div class="filename">${analysis.suggestedName}.ahk</div>
  </div>

  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
    <div class="card">
      <div class="label">Type</div>
      <div class="value">${analysis.type}</div>
    </div>
    <div class="card">
      <div class="label">Domain</div>
      <div class="value">${analysis.domain}</div>
    </div>
    <div class="card">
      <div class="label">Purpose</div>
      <div class="value">${analysis.purpose}</div>
    </div>
  </div>

  <div class="card">
    <div class="label">Confidence</div>
    <span class="confidence">${Math.round(analysis.confidence * 100)}%</span>
  </div>

  <div class="card">
    <div class="label">Description</div>
    <p>${analysis.description}</p>
  </div>

  ${analysis.exports.length > 0 ? `
  <div class="card">
    <div class="label">Detected Exports</div>
    <div class="exports">
      ${analysis.exports.map(e => `<span class="export-tag">${e}</span>`).join('')}
    </div>
  </div>
  ` : ''}
</body>
</html>`;
}
