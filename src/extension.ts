import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversionProfileManager, ConversionProfile } from './conversionProfiles';
import { PerformanceOptimizer, PerformanceReporter } from './performanceOptimizer';
import { TelemetryManager, getTelemetryManager } from './telemetry';
import { DebuggerIntegration } from './debuggerIntegration';
import { FunctionHoverProvider } from './functionHoverProvider';
import { ToolboxSidebarProvider } from './toolboxSidebarProvider';
import { FunctionMetadataHandler } from './functionMetadataHandler';
import { FunctionAnalyzer } from './functionAnalyzer';
import { registerTestCommand } from './test/testCommand';
import { AHKCodeFormatter } from './ahkCodeFormatter';
import { AHKCodeFixProvider } from './ahkCodeFixProvider';
import { FunctionTreeProvider } from './functionTreeProvider';
import { AHKLSPIntegration } from './lspIntegration';
import { DependencyTreeProvider } from './dependencyTreeProvider';
import { PackageManagerProvider } from './packageManagerProvider';
import { registerAHKChatParticipant } from './chatParticipant';
import { registerLibraryAttributionParticipant } from './libraryAttributionParticipant';
import { ImportManager } from './import';
import { registerMetadataQuickFix } from './metadataQuickFix';
import { MetadataHoverProvider } from './metadataHoverProvider';
import { ImportsGuidePanel } from './importsGuidePanel';

type RunResult = { stdout: string; stderr: string; code: number };

// Enhanced error types for better error handling with user-friendly messages
class AHKConverterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
    public readonly userMessage?: string,
    public readonly learnMoreUrl?: string,
    public readonly recoveryActions?: string[]
  ) {
    super(message);
    this.name = 'AHKConverterError';
  }
}

class ValidationError extends AHKConverterError {
  constructor(message: string, details?: any) {
    const userMessage = 'The AHK file could not be validated for conversion.';
    const learnMoreUrl = 'https://www.autohotkey.com/docs/v2/v1-to-v2.htm';
    const recoveryActions = ['Check file syntax', 'Ensure file contains AHK v1 code', 'View error details'];
    super(message, 'VALIDATION_ERROR', details, userMessage, learnMoreUrl, recoveryActions);
    this.name = 'ValidationError';
  }
}

class ConversionError extends AHKConverterError {
  constructor(message: string, details?: any) {
    const userMessage = 'The conversion process encountered an error.';
    const learnMoreUrl = 'https://www.autohotkey.com/docs/v2/v1-to-v2.htm#common-issues';
    const recoveryActions = ['Check AHK v2 installation', 'Try simpler conversion', 'View error details'];
    super(message, 'CONVERSION_ERROR', details, userMessage, learnMoreUrl, recoveryActions);
    this.name = 'ConversionError';
  }
}

class FileOperationError extends AHKConverterError {
  constructor(message: string, details?: any) {
    const userMessage = 'File operation failed during conversion.';
    const recoveryActions = ['Check file permissions', 'Ensure file is not locked', 'Try saving file first'];
    super(message, 'FILE_OPERATION_ERROR', details, userMessage, undefined, recoveryActions);
    this.name = 'FileOperationError';
  }
}

class ConfigurationError extends AHKConverterError {
  constructor(message: string, details?: any) {
    const userMessage = 'Extension configuration is incomplete or incorrect.';
    const learnMoreUrl = 'https://github.com/TrueCrimeAudit/ahk-converter#configuration';
    const recoveryActions = ['Open Settings', 'Check AHK v2 path', 'Reset to defaults'];
    super(message, 'CONFIGURATION_ERROR', details, userMessage, learnMoreUrl, recoveryActions);
    this.name = 'ConfigurationError';
  }
}

// Enhanced notification system
interface NotificationOptions {
  type: 'info' | 'warning' | 'error';
  message: string;
  details?: string;
  actions?: string[];
  learnMoreUrl?: string;
  showOutputChannel?: boolean;
}

class NotificationManager {
  private static instance: NotificationManager;
  private outputChannel: vscode.OutputChannel;

  private constructor() {
    // Share the main extension output channel to avoid duplicate Output entries with the same name.
    this.outputChannel = getOutput();
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async showNotification(options: NotificationOptions): Promise<string | undefined> {
    const { type, message, details, actions = [], learnMoreUrl, showOutputChannel = false } = options;

    // Log to output channel
    this.outputChannel.appendLine(`[${type.toUpperCase()}] ${message}`);
    if (details) {
      this.outputChannel.appendLine(`Details: ${details}`);
    }

    // Prepare actions
    const notificationActions = [...actions];
    if (learnMoreUrl) {
      notificationActions.push('Learn More');
    }
    if (showOutputChannel) {
      notificationActions.push('Show Details');
    }

    let result: string | undefined;

    switch (type) {
      case 'error':
        result = await vscode.window.showErrorMessage(message, ...notificationActions);
        break;
      case 'warning':
        result = await vscode.window.showWarningMessage(message, ...notificationActions);
        break;
      case 'info':
        result = await vscode.window.showInformationMessage(message, ...notificationActions);
        break;
    }

    // Handle actions
    if (result === 'Learn More' && learnMoreUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(learnMoreUrl));
    } else if (result === 'Show Details' || showOutputChannel) {
      this.outputChannel.show();
    }

    return result;
  }

  getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }

  appendLine(message: string): void {
    this.outputChannel.appendLine(message);
  }

  show(): void {
    this.outputChannel.show();
  }
}

// Conversion statistics interface
interface ConversionStats {
  linesProcessed: number;
  warnings: number;
  errors: number;
  conversionTime: number;
}

// Batch conversion result interface
interface BatchConversionResult {
  file: string;
  success: boolean;
  result?: string;
  error?: string;
  stats?: ConversionStats;
}

// Enhanced diff view options
interface DiffViewOptions {
  showLineNumbers: boolean;
  highlightChanges: boolean;
  ignoreWhitespace: boolean;
  contextLines: number;
}
let output: vscode.OutputChannel | undefined;
let lastDiffLeftUri: vscode.Uri | undefined;
let lastDiffRightUri: vscode.Uri | undefined;
let notificationManager: NotificationManager;
let profileManager: ConversionProfileManager;
let telemetryManager: TelemetryManager;
let debuggerIntegration: DebuggerIntegration;



function getOutput(): vscode.OutputChannel {
  if (!output) output = vscode.window.createOutputChannel('AHKv2 Toolbox');
  return output;
}

function getNotificationManager(): NotificationManager {
  if (!notificationManager) notificationManager = NotificationManager.getInstance();
  return notificationManager;
}

function spawnRun(cmd: string, args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    getOutput().appendLine(`[spawn] ${cmd} ${args.map(a => (a.includes(' ') ? '"' + a + '"' : a)).join(' ')}${cwd ? ` (cwd=${cwd})` : ''}`);
    const child = cp.spawn(cmd, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      stderr += String(err);
      getOutput().appendLine(`[error] ${String(err)}`);
      resolve({ stdout, stderr, code: -1 });
    });
    child.on('close', code => {
      if (stderr.trim()) getOutput().appendLine(`[stderr] ${stderr.trim()}`);
      if (stdout.trim()) getOutput().appendLine(`[stdout] ${stdout.trim()}`);
      getOutput().appendLine(`[exit] code=${code ?? -1}`);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}

async function ensureWindowsIfStrict(): Promise<boolean> {
  try {
    const cfg = vscode.workspace.getConfiguration('ahkConverter');
    if (cfg.get<boolean>('strictWindowsOnly') && process.platform !== 'win32') {
      const choice = await vscode.window.showWarningMessage(
        'AHK v1 to v2 Converter is designed for Windows. Continue anyway?',
        'Continue',
        'Cancel'
      );
      return choice === 'Continue';
    }
    return true;
  } catch (error) {
    throw new ConfigurationError('Failed to check Windows strict mode setting', error);
  }
}

async function getPaths(ctx: vscode.ExtensionContext): Promise<{ ahkExe: string; converter: string }> {
  try {
    const cfg = vscode.workspace.getConfiguration('ahkConverter');
    const configuredAhk = (cfg.get<string>('autoHotkeyV2Path') || '').replace(/"/g, '');
    const ahkCandidates: string[] = [];
    if (configuredAhk) ahkCandidates.push(configuredAhk);

    // Common installs
    ahkCandidates.push(
      'AutoHotkey64.exe',
      path.join(process.env['ProgramFiles'] || 'C:/Program Files', 'AutoHotkey', 'v2', 'AutoHotkey64.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'AutoHotkey', 'v2', 'AutoHotkey64.exe'),
      path.join(process.env['LOCALAPPDATA'] || 'C:/Users/Default/AppData/Local', 'Programs', 'AutoHotkey', 'v2', 'AutoHotkey64.exe')
    );

    async function promptForAhkExe(suggest: string): Promise<string | undefined> {
      try {
        const defaultUri = vscode.Uri.file(path.isAbsolute(suggest) ? path.dirname(suggest) : suggest);
        const picks = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          defaultUri,
          filters: { Executable: ['exe'] },
          openLabel: 'Use this AutoHotkey64.exe',
          title: 'Select AutoHotkey v2 executable (AutoHotkey64.exe)'
        });
        if (picks && picks[0]) {
          const selected = picks[0].fsPath;
          await cfg.update('autoHotkeyV2Path', selected, vscode.ConfigurationTarget.Workspace);
          return selected;
        }
        return undefined;
      } catch (error) {
        throw new ConfigurationError('Failed to prompt for AutoHotkey executable', error);
      }
    }

    async function findExisting(exes: string[]): Promise<string | undefined> {
      for (const exe of exes) {
        try {
          // If it is not an absolute path, rely on PATH resolution by trying to spawn "where"
          if (!path.isAbsolute(exe)) {
            const whereCmd = process.platform === 'win32' ? 'where' : 'which';
            const result = await spawnRun(whereCmd, [exe]);
            if (result.code === 0 && result.stdout.trim()) return exe;
          } else {
            await fs.promises.access(exe, fs.constants.X_OK | fs.constants.F_OK);
            return exe;
          }
        } catch (error) {
          // Log for debugging but continue trying other paths
          const errorMessage = error instanceof Error ? error.message : String(error);
          getOutput().appendLine(`[findExisting] Failed to validate ${exe}: ${errorMessage}`);
        }
      }
      return undefined;
    }

    let ahkExe = await findExisting(ahkCandidates);
    if (!ahkExe) {
      const suggested = ahkCandidates.find((p: string) => path.isAbsolute(p)) || 'C:/Program Files/AutoHotkey/v2/AutoHotkey64.exe';
      const picked = await promptForAhkExe(suggested);
      if (picked) {
        ahkExe = picked;
      } else {
        const choice = await vscode.window.showErrorMessage(
          'AutoHotkey v2 executable not found. Set "ahkConverter.autoHotkeyV2Path" to your AutoHotkey64.exe.',
          'Open Settings'
        );
        if (choice === 'Open Settings') {
          await vscode.commands.executeCommand('workbench.action.openSettings', 'ahkConverter.autoHotkeyV2Path');
        }
        throw new ConfigurationError('AutoHotkey v2 not found');
      }
    }

    const configuredConverter = (cfg.get<string>('converterScriptPath') || '').replace(/"/g, '');
    let resolvedConverter = configuredConverter
      ? configuredConverter.replace('${extensionPath}', ctx.extensionPath)
      : path.join(ctx.extensionPath, 'vendor', 'v2converter.ahk');
    try {
      await fs.promises.access(resolvedConverter, fs.constants.F_OK);
    } catch {
      const fallback = path.join(ctx.extensionPath, 'vendor', 'v2converter_silent.ahk');
      try {
        await fs.promises.access(fallback, fs.constants.F_OK);
        resolvedConverter = fallback;
      } catch {
        throw new ConfigurationError(`Converter script not found at: ${resolvedConverter} or ${fallback}`);
      }
    }
    return { ahkExe, converter: resolvedConverter };
  } catch (error) {
    if (error instanceof AHKConverterError) {
      throw error;
    }
    throw new ConfigurationError('Failed to get paths configuration', error);
  }
}

// Input validation for AHK files
function validateAHKFile(content: string, filePath?: string): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Check if file is empty
    if (!content || content.trim().length === 0) {
      errors.push('File is empty');
      return { isValid: false, warnings, errors };
    }

    // Check for binary content
    const hasBinaryContent = /[\x00-\x08\x0E-\x1F\x7F]/.test(content);
    if (hasBinaryContent) {
      errors.push('File appears to contain binary content');
      return { isValid: false, warnings, errors };
    }

    // Check for common AHK v1 patterns
    const lines = content.split('\n');
    let hasAHKPatterns = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments and empty lines
      if (line.startsWith(';') || line === '') continue;

      // Check for AHK v1 specific patterns
      if (/#NoEnv/i.test(line) ||
          /MsgBox,\s*/.test(line) ||
          /If\s+/i.test(line) ||
          /%\w+%/.test(line) ||
          /:=\s*/.test(line) ||
          /Return\s*/.test(line)) {
        hasAHKPatterns = true;
      }

      // Check for potential issues
      if (line.includes('MsgBox,') && !line.includes('MsgBox(')) {
        warnings.push(`Line ${i + 1}: Old MsgBox syntax detected - should be converted to function call`);
      }

      if (line.includes('If ') && !line.includes('If (')) {
        warnings.push(`Line ${i + 1}: Legacy If statement detected - may need conversion`);
      }
    }

    if (!hasAHKPatterns) {
      warnings.push('File may not contain AHK v1 syntax patterns');
    }

    return { isValid: errors.length === 0, warnings, errors };
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { isValid: false, warnings, errors };
  }
}

// Conversion validation
function validateConversionResult(originalContent: string, convertedContent: string): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    if (!convertedContent || convertedContent.trim().length === 0) {
      errors.push('Conversion resulted in empty content');
      return { isValid: false, warnings, errors };
    }

    // Check for common conversion errors
    if (convertedContent.includes('MsgBox,')) {
      warnings.push('Converted file still contains old MsgBox syntax');
    }

    if (convertedContent.includes('#NoEnv')) {
      warnings.push('Converted file still contains deprecated #NoEnv directive');
    }

    // Check for syntax validation patterns
    const lines = convertedContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments and empty lines
      if (line.startsWith(';') || line === '') continue;

      // Basic syntax checks
      if (line.includes('If ') && !line.includes('If (') && !line.includes('{')) {
        warnings.push(`Line ${i + 1}: Potential syntax issue with If statement`);
      }
    }

    return { isValid: errors.length === 0, warnings, errors };
  } catch (error) {
    errors.push(`Conversion validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { isValid: false, warnings, errors };
  }
}

async function convertText(ctx: vscode.ExtensionContext, srcText: string): Promise<{ result: string; stats: ConversionStats }> {
  const startTime = Date.now();
  const stats: ConversionStats = {
    linesProcessed: 0,
    warnings: 0,
    errors: 0,
    conversionTime: 0
  };

  try {
    // Input validation
    const validation = validateAHKFile(srcText);
    stats.warnings += validation.warnings.length;
    stats.errors += validation.errors.length;

    if (!validation.isValid) {
      throw new ValidationError('Input validation failed', { errors: validation.errors, warnings: validation.warnings });
    }

    if (validation.warnings.length > 0) {
      getOutput().appendLine('[validation] Warnings:');
      validation.warnings.forEach(warning => getOutput().appendLine(`  - ${warning}`));
    }

    if (!srcText.trim()) {
      throw new ValidationError('File is empty');
    }

    stats.linesProcessed = srcText.split('\n').length;

    const { ahkExe, converter } = await getPaths(ctx);

    // Ensure converter exists
    try {
      await fs.promises.access(converter, fs.constants.F_OK);
    } catch {
      throw new ConfigurationError(`Converter script not found at: ${converter}`);
    }

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ahkconv-'));
    const inPath = path.join(tmpDir, 'input.ahk');
    await fs.promises.writeFile(inPath, srcText, 'utf8');

    const expectedOut = path.join(tmpDir, 'input_newV2.ahk');

    const progressOpts = { location: vscode.ProgressLocation.Window, title: 'Converting to AHK v2...' };
    return await vscode.window.withProgress(progressOpts, async () => {
      const args = ['/ErrorStdOut', converter, inPath];
      const { code, stderr } = await spawnRun(ahkExe, args, tmpDir);

      if (code !== 0) {
        throw new ConversionError(`Converter failed with code ${code}${stderr ? ': ' + stderr : ''}`, { code, stderr });
      }

      // Wait for output file to appear; the converter writes alongside input
      try {
        // Read as Buffer first to detect actual encoding from BOM
        const buffer = await fs.promises.readFile(expectedOut);

        // Detect encoding from BOM bytes
        let encoding: BufferEncoding = 'utf8';
        let bomLength = 0;

        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          // UTF-8 BOM: EF BB BF
          encoding = 'utf8';
          bomLength = 3;
          getOutput().appendLine('[converter] Detected UTF-8 BOM');
        } else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
          // UTF-16 LE BOM: FF FE
          encoding = 'utf16le';
          bomLength = 2;
          getOutput().appendLine('[converter] Detected UTF-16 LE BOM');
        } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
          // UTF-16 BE BOM: FE FF
          encoding = 'utf16le';
          bomLength = 2;
          getOutput().appendLine('[converter] Warning: UTF-16 BE detected, decoding as UTF-16 LE');
        }

        // Decode with correct encoding and strip BOM
        const outTextBuffer = buffer.slice(bomLength);
        const outText = outTextBuffer.toString(encoding);

        if (bomLength > 0) {
          getOutput().appendLine(`[converter] Stripped ${encoding} BOM (${bomLength} bytes)`);
        }

        // Validate conversion result
        const conversionValidation = validateConversionResult(srcText, outText);
        stats.warnings += conversionValidation.warnings.length;
        stats.errors += conversionValidation.errors.length;

        if (!conversionValidation.isValid) {
          throw new ConversionError('Conversion validation failed', { errors: conversionValidation.errors, warnings: conversionValidation.warnings });
        }

        if (conversionValidation.warnings.length > 0) {
          getOutput().appendLine('[conversion-validation] Warnings:');
          conversionValidation.warnings.forEach(warning => getOutput().appendLine(`  - ${warning}`));
        }

        stats.conversionTime = Date.now() - startTime;

        // Clean up temp directory
        try {
          await fs.promises.rm(tmpDir, { recursive: true, force: true });
        } catch (cleanupError) {
          getOutput().appendLine(`[cleanup] Failed to clean up temp directory: ${cleanupError}`);
        }

        return { result: outText, stats };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ConversionError(
          `Failed to read converted output: ${expectedOut}`,
          { originalError: errorMessage, stderr }
        );
      }
    });
  } catch (error) {
    stats.conversionTime = Date.now() - startTime;
    if (error instanceof AHKConverterError) {
      throw error;
    }
    throw new ConversionError('Unexpected error during conversion', error);
  }
}

// Enhanced diff view with better options
async function showEnhancedDiff(outText: string, left: vscode.TextDocument, options?: Partial<DiffViewOptions>): Promise<void> {
  try {
    const defaultOptions: DiffViewOptions = {
      showLineNumbers: true,
      highlightChanges: true,
      ignoreWhitespace: false,
      contextLines: 3
    };

    const diffOptions = { ...defaultOptions, ...options };

    const rightUri = vscode.Uri.parse('untitled:Converted.ahk');
    const rightDoc = await vscode.workspace.openTextDocument(rightUri);
    await vscode.window.showTextDocument(rightDoc, { preview: true });
    const edit = new vscode.WorkspaceEdit();
    edit.insert(rightUri, new vscode.Position(0, 0), outText);
    await vscode.workspace.applyEdit(edit);

    const title = 'AHK v1 ↔ v2 Conversion Preview';
    await vscode.commands.executeCommand('vscode.diff', left.uri, rightUri, title);

    lastDiffLeftUri = left.uri;
    lastDiffRightUri = rightUri;

    // Show diff options notification
    const notificationManager = getNotificationManager();
    await notificationManager.showNotification({
      type: 'info',
      message: 'Review the conversion changes in the diff view',
      actions: ['Accept All', 'Accept Selected', 'Reject'],
      showOutputChannel: true
    });
  } catch (error) {
    throw new FileOperationError('Failed to show enhanced diff view', error);
  }
}

async function openInNewTab(outText: string) {
  try {
    const doc = await vscode.workspace.openTextDocument({ language: 'ahk', content: outText });
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (error) {
    throw new FileOperationError('Failed to open converted file in new tab', error);
  }
}

async function replaceCurrentEditor(outText: string, editor: vscode.TextEditor) {
  try {
    const start = new vscode.Position(0, 0);
    const end = new vscode.Position(editor.document.lineCount, 0);
    const fullRange = new vscode.Range(start, end);
    await editor.edit(e => e.replace(fullRange, outText));
  } catch (error) {
    throw new FileOperationError('Failed to replace current editor content', error);
  }
}

function showConversionStats(stats: ConversionStats) {
  const message = `Conversion completed: ${stats.linesProcessed} lines processed, ${stats.warnings} warnings, ${stats.errors} errors (${stats.conversionTime}ms)`;
  vscode.window.setStatusBarMessage(`AHKv2 Toolbox: ${message}`, 5000);
  getOutput().appendLine(`[stats] ${message}`);
}

// Enhanced error handling with user-friendly messages
async function handleError(error: any, context: string): Promise<void> {
  const notificationManager = getNotificationManager();

  if (error instanceof ValidationError) {
    await notificationManager.showNotification({
      type: 'error',
      message: error.userMessage || 'Validation failed',
      details: error.message,
      actions: error.recoveryActions,
      learnMoreUrl: error.learnMoreUrl,
      showOutputChannel: true
    });
  } else if (error instanceof ConversionError) {
    await notificationManager.showNotification({
      type: 'error',
      message: error.userMessage || 'Conversion failed',
      details: error.message,
      actions: error.recoveryActions,
      learnMoreUrl: error.learnMoreUrl,
      showOutputChannel: true
    });
  } else if (error instanceof FileOperationError) {
    await notificationManager.showNotification({
      type: 'error',
      message: error.userMessage || 'File operation failed',
      details: error.message,
      actions: error.recoveryActions,
      showOutputChannel: true
    });
  } else if (error instanceof ConfigurationError) {
    await notificationManager.showNotification({
      type: 'error',
      message: error.userMessage || 'Configuration error',
      details: error.message,
      actions: error.recoveryActions,
      learnMoreUrl: error.learnMoreUrl,
      showOutputChannel: true
    });
  } else {
    await notificationManager.showNotification({
      type: 'error',
      message: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error),
      actions: ['View Details'],
      showOutputChannel: true
    });
  }
}

// Batch processing functionality
async function convertMultipleFiles(ctx: vscode.ExtensionContext, uris: vscode.Uri[]): Promise<BatchConversionResult[]> {
  const results: BatchConversionResult[] = [];
  const notificationManager = getNotificationManager();

  const progressOptions = {
    location: vscode.ProgressLocation.Notification,
    title: 'Converting multiple AHK files...',
    cancellable: true
  };

  await vscode.window.withProgress(progressOptions, async (progress, token) => {
    for (let i = 0; i < uris.length; i++) {
      if (token.isCancellationRequested) {
        break;
      }

      const uri = uris[i];
      const fileName = path.basename(uri.fsPath);

      progress.report({
        increment: (100 / uris.length),
        message: `Converting ${fileName} (${i + 1}/${uris.length})`
      });

      try {
        const content = await fs.promises.readFile(uri.fsPath, 'utf8');
        const { result, stats } = await convertText(ctx, content);

        results.push({
          file: fileName,
          success: true,
          result,
          stats
        });
      } catch (error) {
        results.push({
          file: fileName,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  // Show batch conversion summary
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;

  await notificationManager.showNotification({
    type: failed > 0 ? 'warning' : 'info',
    message: `Batch conversion completed: ${successful} successful, ${failed} failed`,
    details: `Processed ${results.length} files total`,
    actions: ['View Results', 'Save Successful'],
    showOutputChannel: true
  });

  return results;
}

// Save batch conversion results
async function saveBatchResults(results: BatchConversionResult[], outputDirectory?: string): Promise<void> {
  if (!outputDirectory) {
    const uri = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select output directory',
      title: 'Choose where to save converted files'
    });

    if (!uri || uri.length === 0) {
      return;
    }

    outputDirectory = uri[0].fsPath;
  }

  const successfulResults = results.filter(r => r.success && r.result);

  for (const result of successfulResults) {
    const outputPath = path.join(outputDirectory, result.file.replace('.ahk', '_v2.ahk'));
    await fs.promises.writeFile(outputPath, result.result!, 'utf8');
  }

  const notificationManager = getNotificationManager();
  await notificationManager.showNotification({
    type: 'info',
    message: `Saved ${successfulResults.length} converted files to ${outputDirectory}`,
    actions: ['Open Folder']
  });
}

export async function activate(ctx: vscode.ExtensionContext) {
  // Check for LSP extension and show notification if not found
  const lspIntegration = AHKLSPIntegration.getInstance();

  // Check LSP availability after a short delay to let other extensions activate
  setTimeout(async () => {
    const isAvailable = await lspIntegration.isLSPAvailable();
    if (!isAvailable) {
      // Check if user has dismissed this warning before
      const dontShowAgain = ctx.globalState.get('ahkv2-toolbox.dontShowLSPWarning', false);

      if (!dontShowAgain) {
        if (ctx.extensionMode === vscode.ExtensionMode.Test) {
          return;
        }
        const choice = await vscode.window.showInformationMessage(
          'AHKv2 Toolbox works best with the "AutoHotkey v2 Language Support" extension by thqby for accurate parsing and IntelliSense.',
          'Install Extension',
          'Don\'t Show Again',
          'Dismiss'
        );

        if (choice === 'Install Extension') {
          try {
            await vscode.commands.executeCommand(
              'workbench.extensions.installExtension',
              'thqby.vscode-autohotkey2-lsp'
            );
            vscode.window.showInformationMessage(
              'AutoHotkey v2 LSP extension installed! Please reload VS Code to activate it.',
              'Reload Now'
            ).then(reload => {
              if (reload === 'Reload Now') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
              }
            });
          } catch (error) {
            vscode.window.showErrorMessage('Failed to install extension. Please install manually from the Extensions view.');
          }
        } else if (choice === 'Don\'t Show Again') {
          await ctx.globalState.update('ahkv2-toolbox.dontShowLSPWarning', true);
        }
      }
    }
  }, 2000);

  // Initialize Import Manager for AHK v2 module system
  const importManager = ImportManager.getInstance();
  await importManager.initialize(ctx);
  ctx.subscriptions.push({
    dispose: () => importManager.dispose()
  });

  registerMetadataQuickFix(ctx);

  // Initialize Toolbox Sidebar Provider
  const toolboxProvider = new ToolboxSidebarProvider(ctx, ctx.extension.id);
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider('ahkv2Toolbox', toolboxProvider),
    vscode.commands.registerCommand('ahkv2Toolbox.showMain', async () => {
      const log = getOutput();
      log.appendLine('[showMain] command entered');
      await vscode.commands.executeCommand('workbench.view.extension.ahkv2-toolbox');
      log.appendLine('[showMain] view revealed');
      toolboxProvider.showMainView();
      log.appendLine('[showMain] showMainView called');
    })
  );

  // Initialize Code Map Tree Provider
  const codeMapProvider = new FunctionTreeProvider(ctx);
  const codeMapView = vscode.window.createTreeView('codeMap', {
    treeDataProvider: codeMapProvider,
    showCollapseAll: true,
    canSelectMany: true,  // Enable multi-select
    dragAndDropController: codeMapProvider,  // Enable drag & drop
  });

  ctx.subscriptions.push(
    codeMapView,
    vscode.commands.registerCommand('codeMap.refresh', () => {
      codeMapProvider.refresh();
    }),
    vscode.commands.registerCommand('codeMap.jumpToDefinition', (item) => {
      codeMapProvider.jumpToDefinition(item);
    }),
    vscode.commands.registerCommand('codeMap.jumpToInclude', (item) => {
      codeMapProvider.jumpToInclude(item);
    }),
    // Filter commands
    vscode.commands.registerCommand('codeMap.showAll', () => {
      codeMapProvider.showAll();
      vscode.window.showInformationMessage('Code Map: Showing all items');
    }),
    vscode.commands.registerCommand('codeMap.showOnlyFunctions', () => {
      codeMapProvider.showOnly('function');
      codeMapProvider.toggleFilter('method'); // Include methods with functions
      vscode.window.showInformationMessage('Code Map: Showing only functions and methods');
    }),
    vscode.commands.registerCommand('codeMap.toggleFilter', (filter) => {
      codeMapProvider.toggleFilter(filter);
    }),
    // Scoping commands
    vscode.commands.registerCommand('codeMap.scopeToItem', (item) => {
      codeMapProvider.scopeToItem(item);
      vscode.window.showInformationMessage(`Code Map: Scoped to ${item.label}`);
    }),
    vscode.commands.registerCommand('codeMap.clearScope', () => {
      codeMapProvider.clearScope();
      vscode.window.showInformationMessage('Code Map: Scope cleared');
    }),
    // Export command
    vscode.commands.registerCommand('codeMap.exportAsAsciiTree', async () => {
      await codeMapProvider.exportAsAsciiTree();
    }),
    vscode.commands.registerCommand('ahkv2Toolbox.installLSP', async () => {
      await lspIntegration.showLSPNotInstalledWarning();
    }),
    vscode.commands.registerCommand('ahkv2Toolbox.showImportsGuide', () => {
      ImportsGuidePanel.show(ctx);
    }),
    vscode.commands.registerCommand('ahkv2Toolbox.testChatParticipant', async () => {
      // Test command for chat participant functionality
      const testInstructions = [
        '# AHK Chat Participant Test Guide',
        '',
        '## Quick Tests',
        '',
        '### 1. Basic Chat Test',
        'Open the chat panel and try:',
        '```',
        '@ahk Hello! Can you help me with AutoHotkey?',
        '```',
        '',
        '### 2. Test Commands',
        '',
        '**Convert Command:**',
        '```',
        '@ahk /convert MsgBox % "Hello"',
        '```',
        '',
        '**Explain Command:**',
        '```',
        '@ahk /explain What is the difference between := and = in v2?',
        '```',
        '',
        '**Fix Command:**',
        '```',
        '@ahk /fix My GUI is not showing up',
        '```',
        '',
        '**Optimize Command:**',
        '```',
        '@ahk /optimize Loop, 1000 { result .= A_Index }',
        '```',
        '',
        '**Example Command:**',
        '```',
        '@ahk /example Create a simple GUI with a button',
        '```',
        '',
        '**Attribution Command (requires Lib file open):**',
        '```',
        '@ahk /attribute',
        '```',
        '',
        '## Expected Behavior',
        '',
        '✅ Chat participant should respond with AHK v2-specific guidance',
        '✅ Commands should be recognized and handled appropriately',
        '✅ Responses should use modern v2 syntax (`:=`, not `=`)',
        '✅ Error context should be included when relevant',
        '',
        '## Verification Checklist',
        '',
        '- [ ] Chat participant appears in chat panel (@ahk)',
        '- [ ] Base queries work without slash commands',
        '- [ ] Each slash command works correctly',
        '- [ ] Error handling shows helpful messages',
        '- [ ] Responses include v2 best practices',
        '- [ ] Attribution command discovers metadata',
        '',
        '## Troubleshooting',
        '',
        'If chat participant doesn\'t appear:',
        '1. Check GitHub Copilot Chat is installed and active',
        '2. Reload VS Code window (Ctrl+Shift+P → Developer: Reload Window)',
        '3. Check extension is activated (should activate when opening .ahk files)',
        '4. Check Output panel for errors (View → Output → AHKv2 Toolbox)',
        '',
        '## Testing Attribution',
        '',
        '1. Create or open a file in the Lib folder (e.g., Lib/TestLib.ahk)',
        '2. Open chat: `@ahk /attribute`',
        '3. Should discover metadata from GitHub',
        '4. Check for proper markdown formatting',
        '',
        '## Next Steps',
        '',
        'After testing, check:',
        '- Extension Output for any errors',
        '- Developer Console (Help → Toggle Developer Tools)',
        '- Test results against expected behavior above'
      ].join('\n');

      // Show test instructions in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: testInstructions,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: false });

      // Show info message with quick action
      const action = await vscode.window.showInformationMessage(
        'Chat Participant Test Guide opened. Open the chat panel to start testing.',
        'Open Chat Panel',
        'Dismiss'
      );

      if (action === 'Open Chat Panel') {
        // Open the chat panel
        await vscode.commands.executeCommand('workbench.action.chat.open');
      }
    })
  );

  // Initialize Dependency Tree Provider
  let dependencyTreeProvider: DependencyTreeProvider | undefined;
  try {
    dependencyTreeProvider = new DependencyTreeProvider(ctx);
    const provider = dependencyTreeProvider;
    const dependencyTreeView = vscode.window.createTreeView('ahkDependencyTree', {
      treeDataProvider: provider,
      showCollapseAll: true
    });

    ctx.subscriptions.push(
      dependencyTreeView,
      vscode.commands.registerCommand('ahkDependencyTree.refresh', () => {
        provider.refresh();
      }),
      vscode.commands.registerCommand('ahkDependencyTree.openFile', async (filePath: string) => {
        try {
          // Open the clicked file
          const doc = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(doc);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
        }
      }),
      vscode.commands.registerCommand('ahkDependencyTree.pin', () => {
        provider.pinCurrentFile();
      }),
      vscode.commands.registerCommand('ahkDependencyTree.unpin', () => {
        provider.clearPin();
      })
    );
  } catch (error) {
    // If no workspace, dependency tree won't work - that's OK
    console.log('Dependency tree not initialized (no workspace folder)');
  }

  // Initialize Package Manager Provider
  try {
    const packageManagerProvider = new PackageManagerProvider(ctx);
    const packageManagerView = vscode.window.createTreeView('ahkPackageManager', {
      treeDataProvider: packageManagerProvider,
      showCollapseAll: true
    });

    ctx.subscriptions.push(
      packageManagerView,
      vscode.commands.registerCommand('ahkPackageManager.refresh', () => {
        packageManagerProvider.refresh();
      }),
      vscode.commands.registerCommand('ahkPackageManager.installPackage', async (packageItem) => {
        if (packageItem) {
          await packageManagerProvider.installPackage(packageItem);
        }
      }),
      vscode.commands.registerCommand('ahkPackageManager.uninstallPackage', async (packageItem) => {
        if (packageItem) {
          await packageManagerProvider.uninstallPackage(packageItem);
        }
      }),
      vscode.commands.registerCommand('ahkPackageManager.updatePackage', async (packageItem) => {
        if (packageItem) {
          await packageManagerProvider.updatePackage(packageItem);
        }
      }),
      vscode.commands.registerCommand('ahkPackageManager.showPackageDetails', async (packageItem) => {
        if (packageItem) {
          await packageManagerProvider.showPackageDetails(packageItem);
        }
      }),
      vscode.commands.registerCommand('ahkPackageManager.searchPackages', async () => {
        await packageManagerProvider.searchPackages();
      }),
      vscode.commands.registerCommand('ahkPackageManager.clearSearch', async () => {
        packageManagerProvider.clearSearch();
      }),
      vscode.commands.registerCommand('ahkPackageManager.openRepository', async (packageItem) => {
        if (packageItem) {
          await packageManagerProvider.openRepository(packageItem);
        }
      }),
      vscode.commands.registerCommand('ahkPackageManager.generateJSDocHeader', async (packageItem) => {
        if (packageItem && packageItem.packagePath.endsWith('.ahk')) {
          vscode.window.showInformationMessage(
            'AI JSDoc generation coming soon! See docs/JSDOC_GENERATION_GUIDE.md for manual guidelines.',
            'Open Guide'
          ).then(selection => {
            if (selection === 'Open Guide') {
              const guidePath = path.join(ctx.extensionPath, 'docs', 'JSDOC_GENERATION_GUIDE.md');
              vscode.workspace.openTextDocument(guidePath).then(doc => {
                vscode.window.showTextDocument(doc);
              });
            }
          });
        }
      })
    );
  } catch (error) {
    console.log('Package Manager not initialized:', error);
  }

  // Register Examples Curator command
  try {
    const { ExamplesCurator } = await import('./examplesCurator');
    ctx.subscriptions.push(
      vscode.commands.registerCommand('ahkv2Toolbox.findBestOOPExamples', async () => {
        const curator = ExamplesCurator.getInstance();

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Searching for best OOP AHK v2 examples...',
            cancellable: false
          },
          async (progress) => {
            try {
              curator.showOutput();
              progress.report({ message: 'Searching GitHub...' });

              const examples = await curator.findBestOOPExamples(20);

              progress.report({ message: 'Generating documentation...' });
              const markdown = curator.generateDocumentation(examples);

              // Save to docs directory
              const docsPath = path.join(ctx.extensionPath, 'docs', 'BEST_OOP_EXAMPLES.md');
              fs.writeFileSync(docsPath, markdown, 'utf-8');

              // Open the document
              const doc = await vscode.workspace.openTextDocument(docsPath);
              await vscode.window.showTextDocument(doc);

              vscode.window.showInformationMessage(
                `Found ${examples.length} high-quality OOP examples!`,
                'View Examples'
              ).then(selection => {
                if (selection === 'View Examples') {
                  vscode.commands.executeCommand('markdown.showPreview', doc.uri);
                }
              });
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to find examples: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }
        );
      }),
      vscode.commands.registerCommand('ahkv2Toolbox.refreshOOPExamples', async () => {
        // Force refresh by clearing any cache and re-running the search
        const curator = ExamplesCurator.getInstance();
        await vscode.commands.executeCommand('ahkv2Toolbox.findBestOOPExamples');
      })
    );
  } catch (error) {
    console.log('Examples Curator not initialized:', error);
  }

  // Register settings command against the toolbox sidebar view.
  try {
    ctx.subscriptions.push(
      vscode.commands.registerCommand('ahkv2Toolbox.openSettings', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.ahkv2-toolbox');
        await toolboxProvider.showSettings();
      })
    );
  } catch (error) {
    console.log('Settings command not initialized:', error);
  }

  // Activate LSP Output Capture
  try {
    const { activateLSPCapture } = await import('./utils/lspOutputCapture');
    activateLSPCapture(ctx);
  } catch (error) {
    console.log('LSP Output Capture not initialized:', error);
  }

  // Register AHK v2 Chat Participant
  try {
    const chatParticipant = registerAHKChatParticipant(
      ctx,
      {
        codeMapProvider,
        dependencyTreeProvider
      }
    );
    ctx.subscriptions.push(chatParticipant);
    console.log('AHK v2 Chat Participant registered');
  } catch (error) {
    console.log('Chat Participant not initialized (requires VS Code 1.90+ and GitHub Copilot):', error);
  }

  // Register Library Attribution Participant
  try {
    const libraryAttributionParticipant = registerLibraryAttributionParticipant(ctx);
    ctx.subscriptions.push(libraryAttributionParticipant);
    console.log('Library Attribution Participant registered');
  } catch (error) {
    console.log('Library Attribution Participant not initialized:', error);
  }

  // Register Metadata Validation Provider
  try {
    const { registerMetadataValidation } = await import('./metadataValidationProvider');
  const metadataValidation = registerMetadataValidation(ctx);
  const metadataHover = vscode.languages.registerHoverProvider(
    ['ahk', 'ahk2'],
    new MetadataHoverProvider()
  );

  ctx.subscriptions.push(metadataValidation, metadataHover);
    console.log('Metadata Validation Provider registered');
  } catch (error) {
    console.log('Metadata Validation Provider not initialized:', error);
  }

  // Register command to manually add output for testing
  ctx.subscriptions.push(
    vscode.commands.registerCommand('ahkv2Toolbox.addTestOutput', async () => {
      const { getOutputChannelMonitor } = await import('./utils/outputChannelMonitor');
      const { LSPOutputCapture } = await import('./utils/lspOutputCapture');
      const monitor = getOutputChannelMonitor();

      // Get test output from clipboard or input box
      const clipboardText = await vscode.env.clipboard.readText();

      if (clipboardText && clipboardText.includes('.ahk')) {
        // Add to monitor as if from "AutoHotkey v2 LSP" channel
        const lines = clipboardText.split('\n');
        monitor.addOutputLines('AutoHotkey v2 LSP', lines);

        // Also notify LSP capture service
        const lspCapture = LSPOutputCapture.getInstance();
        lspCapture.captureOutput(clipboardText);

        const stats = monitor.getStats();
        vscode.window.showInformationMessage(
          `✅ Added ${lines.length} lines to output monitor. ${stats.recentErrors} errors tracked.`
        );
      } else {
        vscode.window.showWarningMessage('⚠️ No valid AHK output found in clipboard. Copy error output first.');
      }
    })
  );

  // Register command to show output capture stats
  ctx.subscriptions.push(
    vscode.commands.registerCommand('ahkv2Toolbox.showOutputStats', async () => {
      const { getOutputChannelMonitor } = await import('./utils/outputChannelMonitor');
      const { LSPOutputCapture } = await import('./utils/lspOutputCapture');
      const monitor = getOutputChannelMonitor();
      const lspCapture = LSPOutputCapture.getInstance();

      const stats = monitor.getStats();
      const isLSPActive = await lspCapture.isAvailable();

      const message = `📊 Output Capture Stats:
• Channels: ${stats.channels}
• Total Lines: ${stats.totalLines}
• Recent Errors: ${stats.recentErrors}
• LSP Integration: ${isLSPActive ? '✅ Active' : '❌ Not Available'}`;

      vscode.window.showInformationMessage(message, { modal: false });
    })
  );

  // Compile and Reload Debugger Command
  ctx.subscriptions.push(
    vscode.commands.registerCommand('ahk.compileAndReload', async () => {
      try {
        // Show progress
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Compiling and reloading...",
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0, message: "Compiling TypeScript..." });

          // Run compile task
          const tasks = await vscode.tasks.fetchTasks();
          const compileTask = tasks.find(task =>
            task.name === 'npm: compile' || task.name === 'compile'
          );

          if (compileTask) {
            await vscode.tasks.executeTask(compileTask);

            // Wait for task to complete
            await new Promise<void>((resolve) => {
              const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
                if (e.execution.task === compileTask) {
                  disposable.dispose();
                  resolve();
                }
              });
            });

            progress.report({ increment: 50, message: "Restarting debugger..." });

            // Restart debugger if running, otherwise just notify
            const debugSession = vscode.debug.activeDebugSession;
            if (debugSession) {
              await vscode.commands.executeCommand('workbench.action.debug.restart');
              vscode.window.showInformationMessage('✅ Compiled and debugger restarted!');
            } else {
              vscode.window.showInformationMessage('✅ Compiled! Press F5 to start debugging.');
            }
          } else {
            vscode.window.showErrorMessage('Compile task not found!');
          }
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to compile and reload: ${error}`);
      }
    })
  );

  // Function Metadata Extraction
  ctx.subscriptions.push(
    vscode.commands.registerCommand('ahk.extractFunctionMetadata', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'No active editor found',
            details: 'Please open an AHK file before extracting metadata'
          });
          return;
        }

        const metadata = FunctionAnalyzer.extractFunctionMetadata(editor.document);

        // Create a markdown view for the metadata
        const metadataContent = metadata.map((func) => {
          const params = func.parameters
            .map((p) => `${p.isByRef ? '&' : ''}${p.name}${p.hasDefault ? ` = ${p.defaultValue}` : ''}`)
            .join(', ');

          return [
            `## Function: ${func.name}`,
            '',
            `- **Parameters**: ${params}`,
            `- **Static Variables**: ${func.staticVariables.map((v) => v.name).join(', ')}`,
            `- **Local Variables**: ${func.localVariables.map((v) => v.name).join(', ')}`,
            `- **Location**: Line ${func.location.startLine + 1} - ${func.location.endLine + 1}`
          ].join('\n');
        }).join('\n\n');

        const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: metadataContent });
        await vscode.window.showTextDocument(doc, { preview: false });

        await getNotificationManager().showNotification({
          type: 'info',
          message: `Extracted metadata for ${metadata.length} function(s)`,
          details: `Found functions: ${metadata.map(f => f.name).join(', ')}`
        });
      } catch (error) {
        await handleError(error, 'Extract Function Metadata');
      }
    })
  );
  output = getOutput();
  notificationManager = NotificationManager.getInstance();

  // Register test command
  registerTestCommand(ctx);
  // Initialize advanced features
  profileManager = ConversionProfileManager.getInstance(ctx);
  telemetryManager = getTelemetryManager(ctx);
  debuggerIntegration = DebuggerIntegration.getInstance(ctx);

  const doConvert = async (mode: 'new' | 'replace' | 'diff') => {
    try {
      if (!(await ensureWindowsIfStrict())) return;

      const ed = vscode.window.activeTextEditor;
      if (!ed) {
        await getNotificationManager().showNotification({
          type: 'error',
          message: 'No active editor found',
          details: 'Please open an AHK file before attempting conversion'
        });
        return;
      }

      const { result: outText, stats } = await convertText(ctx, ed.document.getText());

      showConversionStats(stats);

      if (mode === 'replace') {
        await replaceCurrentEditor(outText, ed);
        vscode.window.setStatusBarMessage('AHKv2 Toolbox: replaced with v2 output', 3000);
      } else if (mode === 'diff') {
        await showEnhancedDiff(outText, ed.document);
        vscode.window.setStatusBarMessage('AHKv2 Toolbox: opened enhanced diff (v1 ↔ v2)', 3000);
      } else {
        await openInNewTab(outText);
        vscode.window.setStatusBarMessage('AHKv2 Toolbox: opened v2 output in new tab', 3000);
      }

      // Show warnings if any
      if (stats.warnings > 0) {
        await getNotificationManager().showNotification({
          type: 'warning',
          message: `Conversion completed with ${stats.warnings} warning(s)`,
          details: 'Check the output channel for details',
          actions: ['View Details'],
          showOutputChannel: true
        });
      }
    } catch (error) {
      await handleError(error, 'Conversion');
    }
  };

  // Register formatting providers
  ctx.subscriptions.push(
    AHKCodeFormatter.registerFormattingProvider(),
    AHKCodeFixProvider.registerCodeActionProvider(),
    vscode.languages.registerHoverProvider('ahk', new FunctionHoverProvider())
  );

  // Register Function Metadata Handler
  FunctionMetadataHandler.registerFunctionMetadataRequest(ctx);

  ctx.subscriptions.push(
    vscode.commands.registerCommand('ahk.convertV1toV2', () => doConvert('new')),
    vscode.commands.registerCommand('ahk.convertV1toV2.replace', () => doConvert('replace')),
    vscode.commands.registerCommand('ahk.convertV1toV2.diff', () => doConvert('diff')),
    vscode.commands.registerCommand('ahk.convertV1toV2.acceptDiff', async () => {
      try {
        if (!lastDiffLeftUri || !lastDiffRightUri) {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'No conversion diff to accept',
            details: 'Please run a conversion with diff view first'
          });
          return;
        }
        const leftDoc = await vscode.workspace.openTextDocument(lastDiffLeftUri);
        const rightDoc = await vscode.workspace.openTextDocument(lastDiffRightUri);
        const replaceRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(leftDoc.lineCount, 0));
        const we = new vscode.WorkspaceEdit();
        we.replace(leftDoc.uri, replaceRange, rightDoc.getText());
        const ok = await vscode.workspace.applyEdit(we);
        if (ok) {
          await leftDoc.save();
          await getNotificationManager().showNotification({
            type: 'info',
            message: 'Successfully accepted conversion into file',
            actions: ['Open File']
          });
        }
      } catch (error) {
        await handleError(error, 'Accept Diff');
      }
    }),
    // New batch conversion command
    vscode.commands.registerCommand('ahk.convertV1toV2.batch', async () => {
      try {
        if (!(await ensureWindowsIfStrict())) return;

        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: true,
          filters: { 'AutoHotkey Files': ['ahk'] },
          openLabel: 'Convert selected files',
          title: 'Select AHK v1 files to convert'
        });

        if (!uris || uris.length === 0) {
          return;
        }

        const results = await convertMultipleFiles(ctx, uris);

        // Ask if user wants to save results
        const saveChoice = await vscode.window.showInformationMessage(
          'Do you want to save the converted files?',
          'Save All', 'Save Successful Only', 'Cancel'
        );

        if (saveChoice === 'Save All' || saveChoice === 'Save Successful Only') {
          await saveBatchResults(results);
        }
      } catch (error) {
        await handleError(error, 'Batch Conversion');
      }
    }),
    vscode.commands.registerCommand('ahk.launchDebugReader', async () => {
      try {
        if (!(await ensureWindowsIfStrict())) return;
        const readerPath = path.join(ctx.extensionPath, 'resources', 'DebuggerWindowReader.ahk');
        const { ahkExe } = await getPaths(ctx);
        await spawnRun(ahkExe, [readerPath]);
      } catch (error) {
        await handleError(error, 'Launch Debug Reader');
      }
    }),
    // Advanced conversion profiles commands
    vscode.commands.registerCommand('ahk.selectProfile', async () => {
      try {
        const profiles = profileManager.getAllProfiles();
        const profileNames = profiles.map(p => p.name);


        const selected = await vscode.window.showQuickPick(
          profileNames,
          {
            placeHolder: 'Select conversion profile',
            title: 'AHK Conversion Profiles'
          }
        );

        if (selected) {
          const config = vscode.workspace.getConfiguration('ahkConverter');
          await config.update('selectedProfile', selected, vscode.ConfigurationTarget.Workspace);

          await getNotificationManager().showNotification({
            type: 'info',
            message: `Selected profile: ${selected}`,
            details: `Profile: ${selected}`
          });
        }
      } catch (error) {
        await handleError(error, 'Select Profile');
      }
    }),
    vscode.commands.registerCommand('ahk.manageProfiles', async () => {
      try {
        const action = await vscode.window.showQuickPick(
          ['Create New Profile', 'Edit Existing Profile', 'Delete Profile', 'Import Profile', 'Export Profile'],
          {
            placeHolder: 'Choose action',
            title: 'Manage Conversion Profiles'
          }
        );

        switch (action) {
          case 'Create New Profile':
            await showCreateProfileDialog();
            break;
          case 'Edit Existing Profile':
            await showEditProfileDialog();
            break;
          case 'Delete Profile':
            await showDeleteProfileDialog();
            break;
          case 'Import Profile':
            await showImportProfileDialog();
            break;
          case 'Export Profile':
            await showExportProfileDialog();
            break;
        }
      } catch (error) {
        await handleError(error, 'Manage Profiles');
      }
    }),
    vscode.commands.registerCommand('ahk.convertWithProfile', async () => {
      try {
        if (!(await ensureWindowsIfStrict())) return;

        const ed = vscode.window.activeTextEditor;
        if (!ed) {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'No active editor found',
            details: 'Please open an AHK file before attempting conversion'
          });
          return;
        }

        const startTime = Date.now();
        telemetryManager.recordConversion({
          fileSize: ed.document.getText().length,
          lineCount: ed.document.lineCount,
          processingTime: 0,
          profileUsed: 'normal',
          success: false,
          warnings: 0,
          errors: 0,
          conversionMode: 'new'
        } as any);

        const config = vscode.workspace.getConfiguration('ahkConverter');
        const selectedProfile = config.get<string>('selectedProfile', 'normal');
        const profile = profileManager.getProfile(selectedProfile);

        if (!profile) {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'Selected profile not found',
            details: `Profile: ${selectedProfile}`
          });
          return;
        }

        const { result: outText, stats } = await convertWithProfile(ctx, ed.document.getText(), profile);

        stats.processingTime = Date.now() - startTime;
        telemetryManager.recordConversion({
          ...stats,
          profileUsed: selectedProfile,
          conversionMode: 'new'
        });

        showConversionStats(stats);
        await openInNewTab(outText);

        if (stats.warnings > 0) {
          await getNotificationManager().showNotification({
            type: 'warning',
            message: `Conversion completed with ${stats.warnings} warning(s)`,
            details: 'Check the output channel for details',
            actions: ['View Details'],
            showOutputChannel: true
          });
        }
      } catch (error) {
        await handleError(error, 'Convert with Profile');
      }
    }),
    vscode.commands.registerCommand('ahk.showTelemetry', async () => {
      try {
        const stats = await telemetryManager.getConversionStats(7);
        const errorStats = await telemetryManager.getErrorStats(7);
        const perfStats = await telemetryManager.getPerformanceStats(7);

        const message = `
Conversion Statistics (7 days):
- Total conversions: ${stats?.total || 0}
- Success rate: ${stats?.successRate || 0}%
- Average processing time: ${stats?.avgProcessingTime || 0}ms

Error Statistics (7 days):
- Total errors: ${errorStats?.total || 0}
- Most common error: ${errorStats?.mostCommon || 'None'}

Performance Statistics (7 days):
- Average duration: ${perfStats?.avgDuration || 0}ms
- Average memory usage: ${perfStats?.avgMemoryUsage || 0}MB
        `;

        const doc = await vscode.workspace.openTextDocument({
          language: 'markdown',
          content: message
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (error) {
        await handleError(error, 'Show Telemetry');
      }
    }),
    vscode.commands.registerCommand('ahk.clearTelemetry', async () => {
      try {
        const confirm = await vscode.window.showWarningMessage(
          'Are you sure you want to clear all telemetry data?',
          'Clear Data',
          'Cancel'
        );

        if (confirm === 'Clear Data') {
          await telemetryManager.clearData();
          await getNotificationManager().showNotification({
            type: 'info',
            message: 'Telemetry data cleared successfully'
          });
        }
      } catch (error) {
        await handleError(error, 'Clear Telemetry');
      }
    }),
    vscode.commands.registerCommand('ahk.exportTelemetry', async () => {
      try {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('ahk-telemetry-export.json'),
          filters: { 'JSON Files': ['json'] },
          saveLabel: 'Export Telemetry Data'
        });

        if (uri) {
          const success = await telemetryManager.exportData(uri.fsPath);
          if (success) {
            await getNotificationManager().showNotification({
              type: 'info',
              message: 'Telemetry data exported successfully',
              actions: ['Open Folder']
            });
          } else {
            await getNotificationManager().showNotification({
              type: 'error',
              message: 'Failed to export telemetry data'
            });
          }
        }
      } catch (error) {
        await handleError(error, 'Export Telemetry');
      }
    }),
    vscode.commands.registerCommand('ahk.assistWithDebugging', async () => {
      try {
        if (!(await ensureWindowsIfStrict())) return;

        const ed = vscode.window.activeTextEditor;
        if (!ed) {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'No active editor found',
            details: 'Please open an AHK file before attempting conversion'
          });
          return;
        }

        const originalCode = ed.document.getText();
        const { result: convertedCode } = await convertText(ctx, originalCode);

        const debugData = await debuggerIntegration.assistWithConversion(originalCode, convertedCode);

        // Show debug assistance
        const assistance = await debuggerIntegration.getDebuggingAssistance(convertedCode);
        const assistanceMessage = `
Debugging Assistance:
- Suggested breakpoints: ${assistance.breakpoints.join(', ')}
- Variables to watch: ${assistance.watchVariables.join(', ')}
- Recommendations: ${assistance.recommendations.join('\n')}

Issues Found: ${debugData.debugData.issues.length}
Suggestions: ${debugData.debugData.suggestions.length}
        `;

        await getNotificationManager().showNotification({
          type: 'info',
          message: 'Debugging assistance generated',
          details: assistanceMessage,
          actions: ['View Details'],
          showOutputChannel: true
        });
      } catch (error) {
        await handleError(error, 'Assist with Debugging');
      }
    }),
    vscode.commands.registerCommand('ahk.formatDocument', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'No active editor found',
            details: 'Please open an AHK file before formatting'
          });
          return;
        }

        const edits = await AHKCodeFormatter.formatDocument(editor.document);
        if (edits.length > 0) {
          await vscode.workspace.applyEdit(new vscode.WorkspaceEdit());
          await getNotificationManager().showNotification({
            type: 'info',
            message: 'Document formatted successfully'
          });
        } else {
          await getNotificationManager().showNotification({
            type: 'info',
            message: 'Document is already properly formatted'
          });
        }
      } catch (error) {
        await handleError(error, 'Format Document');
      }
    }),
    vscode.commands.registerCommand('ahk.applyFormattingFix', async (document: vscode.TextDocument, range: vscode.Range, fixTitle: string) => {
      try {
        await AHKCodeFixProvider.applyCodeFix(document, range, fixTitle);
        await getNotificationManager().showNotification({
          type: 'info',
          message: `Applied formatting fix: ${fixTitle}`
        });
      } catch (error) {
        await handleError(error, 'Apply Formatting Fix');
      }
    }),
    vscode.commands.registerCommand('ahk.updateHeader', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'No active editor found',
            details: 'Please open an AHK file before updating header'
          });
          return;
        }

        const document = editor.document;
        const text = document.getText();
        const lines = text.split('\n');

        const targetRequires = '#Requires AutoHotkey v2.1-alpha.17';
        const targetSingleInstance = '#SingleInstance Force';

        // Find existing directives
        let requiresLineIndex = -1;
        let requiresVersion = '';
        let singleInstanceLineIndex = -1;
        let singleInstanceValue = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Check for #Requires directive
          const requiresMatch = line.match(/^#Requires\s+AutoHotkey\s+(.+)/i);
          if (requiresMatch && requiresLineIndex === -1) {
            requiresLineIndex = i;
            requiresVersion = requiresMatch[1].trim();
          }

          // Check for #SingleInstance directive
          const singleInstanceMatch = line.match(/^#SingleInstance\s+(.+)/i);
          if (singleInstanceMatch && singleInstanceLineIndex === -1) {
            singleInstanceLineIndex = i;
            singleInstanceValue = singleInstanceMatch[1].trim();
          }
        }

        const hasCorrectRequires = requiresVersion === 'v2.1-alpha.17';
        const hasCorrectSingleInstance = singleInstanceValue === 'Force';

        // Check if everything is already correct
        if (hasCorrectRequires && hasCorrectSingleInstance) {
          await getNotificationManager().showNotification({
            type: 'info',
            message: 'Header directives are already up to date'
          });
          return;
        }

        const edit = new vscode.WorkspaceEdit();
        let updateMessage: string[] = [];

        // Handle #Requires directive
        if (requiresLineIndex !== -1 && !hasCorrectRequires) {
          // Found an outdated version, ask to update
          const choice = await vscode.window.showInformationMessage(
            `Found outdated #Requires directive: AutoHotkey ${requiresVersion}. Update to v2.1-alpha.17?`,
            'Update',
            'Skip'
          );

          if (choice === 'Update') {
            const lineRange = new vscode.Range(
              new vscode.Position(requiresLineIndex, 0),
              new vscode.Position(requiresLineIndex, lines[requiresLineIndex].length)
            );
            edit.replace(document.uri, lineRange, targetRequires);
            updateMessage.push('Updated #Requires to v2.1-alpha.17');
          }
        } else if (requiresLineIndex === -1) {
          // No #Requires directive found, add it
          edit.insert(document.uri, new vscode.Position(0, 0), targetRequires + '\n');
          updateMessage.push('Added #Requires AutoHotkey v2.1-alpha.17');
        }

        // Handle #SingleInstance directive
        if (singleInstanceLineIndex !== -1 && !hasCorrectSingleInstance) {
          // Found a different SingleInstance setting, ask to update
          const choice = await vscode.window.showInformationMessage(
            `Found #SingleInstance ${singleInstanceValue}. Update to Force?`,
            'Update',
            'Skip'
          );

          if (choice === 'Update') {
            const lineRange = new vscode.Range(
              new vscode.Position(singleInstanceLineIndex, 0),
              new vscode.Position(singleInstanceLineIndex, lines[singleInstanceLineIndex].length)
            );
            edit.replace(document.uri, lineRange, targetSingleInstance);
            updateMessage.push('Updated #SingleInstance to Force');
          }
        } else if (singleInstanceLineIndex === -1) {
          // No #SingleInstance directive found, add it
          const insertPosition = requiresLineIndex !== -1 ? requiresLineIndex + 1 : 0;
          edit.insert(document.uri, new vscode.Position(insertPosition, 0), targetSingleInstance + '\n');
          updateMessage.push('Added #SingleInstance Force');
        }

        if (updateMessage.length === 0) {
          await getNotificationManager().showNotification({
            type: 'info',
            message: 'No changes made'
          });
          return;
        }

        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
          await getNotificationManager().showNotification({
            type: 'info',
            message: 'Header updated successfully',
            details: updateMessage.join('\n')
          });
        } else {
          await getNotificationManager().showNotification({
            type: 'error',
            message: 'Failed to update header'
          });
        }
      } catch (error) {
        await handleError(error, 'Update Header');
      }
    }),

    // Smart Save commands
    vscode.commands.registerCommand('ahk.smartSaveScript', async () => {
      try {
        const { smartSaveScript } = await import('./smartScriptSaver');
        await smartSaveScript();
      } catch (error) {
        await handleError(error, 'Smart Save Script');
      }
    }),

    vscode.commands.registerCommand('ahk.configureExamplesFolder', async () => {
      try {
        const { configureExamplesFolder } = await import('./smartScriptSaver');
        await configureExamplesFolder();
      } catch (error) {
        await handleError(error, 'Configure Examples Folder');
      }
    }),

    vscode.commands.registerCommand('ahk.previewScriptAnalysis', async () => {
      try {
        const { previewScriptAnalysis } = await import('./smartScriptSaver');
        await previewScriptAnalysis();
      } catch (error) {
        await handleError(error, 'Preview Script Analysis');
      }
    })
  );
}

// Helper functions for profile management
async function showCreateProfileDialog(): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Enter profile name',
    placeHolder: 'My Custom Profile',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Profile name is required';
      }
      if (profileManager.getProfile(value)) {
        return 'A profile with this name already exists';
      }
      return null;
    }
  });

  if (name) {
    const baseProfile = await vscode.window.showQuickPick(
      ['conservative', 'aggressive', 'custom'],
      {
        placeHolder: 'Select base profile',
        title: 'Base Profile'
      }
    );

    if (baseProfile) {
      profileManager.createCustomProfile(name, baseProfile);
      await getNotificationManager().showNotification({
        type: 'info',
        message: `Created profile: ${name}`,
        details: `Based on: ${baseProfile}`
      });
    }
  }
}

async function showEditProfileDialog(): Promise<void> {
  const profiles = profileManager.getAllProfiles();
  const profileNames = profiles.map(p => p.name);

  const selected = await vscode.window.showQuickPick(
    profileNames,
    {
      placeHolder: 'Select profile to edit',
      title: 'Edit Profile'
    }
  );

  if (selected) {
    const profile = profileManager.getProfile(selected);
    if (!profile) {
      await getNotificationManager().showNotification({
        type: 'error',
        message: 'Profile not found'
      });
      return;
    }

    // Check if it's a predefined profile - warn user they can't edit it directly
    const isPredefined = ['conservative', 'aggressive', 'custom'].includes(selected);
    if (isPredefined) {
      const action = await vscode.window.showWarningMessage(
        `Cannot edit predefined profile "${selected}". Would you like to create a copy to edit instead?`,
        'Create Copy',
        'Cancel'
      );

      if (action === 'Create Copy') {
        const newName = await vscode.window.showInputBox({
          prompt: `Enter name for copy of "${selected}"`,
          placeHolder: `${selected}_copy`,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) return 'Profile name is required';
            // Check if name already exists (and it's not the current profile)
            const existing = profileManager.getProfile(value);
            if (existing && value !== profile.name) return 'A profile with this name already exists';
            return null;
          }
        });

        if (newName) {
          const newProfile = profileManager.createCustomProfile(newName, selected);
          await getNotificationManager().showNotification({
            type: 'info',
            message: `Created copy: ${newName}`
          });
          // Continue editing the new profile
          await showProfileEditorMenu(newProfile);
        }
      }
      return;
    }

    // Show editor menu for custom profiles
    await showProfileEditorMenu(profile);
  }
}

// These editors are referenced by the profile menu but were missing, which breaks compilation.
// Implement minimal no-op editors so the menu is functional and the extension builds.
async function editSelectiveConversion(_profile: ConversionProfile): Promise<void> {
  await vscode.window.showInformationMessage('Selective Conversion editor is not implemented yet.');
}

async function editPerformanceSettings(_profile: ConversionProfile): Promise<void> {
  await vscode.window.showInformationMessage('Performance Settings editor is not implemented yet.');
}

async function editValidationSettings(_profile: ConversionProfile): Promise<void> {
  await vscode.window.showInformationMessage('Validation Settings editor is not implemented yet.');
}

async function showProfileEditorMenu(profile: ConversionProfile): Promise<void> {
  while (true) {
    const action = await vscode.window.showQuickPick(
      [
        { label: '$(edit) Edit Name & Description', value: 'name' },
        { label: '$(list-unordered) Manage Rules', value: 'rules' },
        { label: '$(arrow-left) Back', value: 'back' }
      ],
      {
        placeHolder: 'What would you like to edit?',
        title: `Edit: ${profile.name}`
      }
    );

    if (!action || action.value === 'back') {
      return;
    }

    if (action.value === 'name') {
      await editProfileNameDescription(profile);
      continue;
    }

    if (action.value === 'rules') {
      await editProfileRules(profile);
      continue;
    }
  }
}

async function editProfileNameDescription(profile: ConversionProfile): Promise<void> {
  const action = await vscode.window.showQuickPick(
    [
      { label: '$(edit) Edit Name', value: 'name' },
      { label: '$(note) Edit Description', value: 'description' },
      { label: '$(arrow-left) Back', value: 'back' }
    ],
    {
      placeHolder: 'What would you like to edit?',
      title: `Edit: ${profile.name}`
    }
  );

  if (!action || action.value === 'back') {
    return;
  }

  if (action.value === 'name') {
    const newName = await vscode.window.showInputBox({
      prompt: 'Enter new profile name',
      value: profile.name,
      placeHolder: 'Choose a new profile name',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) return 'Profile name is required';
        // Check if name already exists (and it's not the current profile)
        const existing = profileManager.getProfile(value);
        if (existing && value !== profile.name) return 'A profile with this name already exists';
        return null;
      }
    });

    if (newName) {
      profile.name = newName;
      profile.description = `Conversion profile "${profile.name}" with optimized settings`;
      await getNotificationManager().showNotification({
        type: 'info',
        message: `Profile renamed to: ${newName}`
      });
    }
  } else if (action.value === 'description') {
    const newDescription = await vscode.window.showInputBox({
      prompt: 'Enter new description',
      placeHolder: 'Describe what this profile does',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) return 'Description cannot be empty';
        if (profile.rules.some(r => r.description === value)) return 'Rule description already exists';
        return null;
      }
    });

    if (newDescription) {
      profile.description = newDescription;
      await getNotificationManager().showNotification({
        type: 'info',
        message: 'Description updated'
      });
    }
  }
}

async function editProfileRules(profile: ConversionProfile): Promise<void> {
  while (true) {
    const ruleItems = profile.rules.map(rule => ({
      label: `${rule.enabled ? '$(check)' : '$(circle-slash)'}  ${rule.name}`,
      description: `Priority: ${rule.priority} | Category: ${rule.category}`,
      detail: rule.description,
      value: rule.id
    }));

    ruleItems.push(
      { label: '$(add) Add New Rule', description: '', detail: '', value: '_ADD' },
      { label: '$(arrow-left) Back', description: '', detail: '', value: '__back__' }
    );

    const selected = await vscode.window.showQuickPick(ruleItems, {
      placeHolder: 'Select a rule to edit or add a new one',
      title: `Manage Rules: ${profile.name}`
    });

    if (!selected || selected.value === '__back__') {
      return;
    }

    if (selected.value === '_ADD') {
      await addNewRule(profile);
      continue;
    }

    // Edit selected rule
    const rule = profile.rules.find(r => r.id === selected.value);
    if (rule) {
      await editSingleRule(profile, rule);
    }
  }
}

async function addNewRule(profile: ConversionProfile): Promise<void> {
  const id = await vscode.window.showInputBox({
    prompt: 'Enter rule ID (unique identifier)',
    placeHolder: 'my-custom-rule',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) return 'Rule ID is required';
      if (profile.rules.some(r => r.id === value)) return 'A rule with this ID already exists';
      return null;
    }
  });

  if (!id) return;

  const name = await vscode.window.showInputBox({
    prompt: 'Enter rule name',
    placeHolder: 'My Custom Rule',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) return 'Rule name is required';
      if (profile.rules.some(r => r.name === value)) return 'Rule name already exists';
      return null;
    }
  });

  if (!name) return;

  const description = await vscode.window.showInputBox({
    prompt: 'Enter rule description',
    placeHolder: 'What does this rule do?',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) return 'Description is required';
      if (profile.rules.some(r => r.description === value)) return 'Rule description already exists';
      return null;
    }
  });

  if (!description) return;

  const category = await vscode.window.showQuickPick(
    ['syntax', 'functions', 'variables', 'commands', 'directives'],
    {
      placeHolder: 'Select rule category',
      title: 'Rule Category'
    }
  );

  if (!category) return;

  const priorityInput = await vscode.window.showInputBox({
    prompt: 'Enter rule priority (1-100, higher = runs first)',
    placeHolder: '50',
    validateInput: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 1 && num <= 100 ? null : 'Priority must be between 1 and 100';
    }
  });

  if (!priorityInput) return;

  const newRule = {
    id,
    name,
    description,
    enabled: true,
    priority: parseInt(priorityInput),
    category: category as 'syntax' | 'functions' | 'variables' | 'commands' | 'directives'
  };

  profile.rules.push(newRule);
  await getNotificationManager().showNotification({
    type: 'info',
    message: `Added rule: ${name}`
  });
}

async function editSingleRule(profile: ConversionProfile, rule: any): Promise<void> {
  while (true) {
    const action = await vscode.window.showQuickPick(
      [
        { label: `$(${rule.enabled ? 'check' : 'circle-slash'}) ${rule.enabled ? 'Disable' : 'Enable'} Rule`, value: 'toggle' },
        { label: '$(edit) Edit Name', value: 'name' },
        { label: '$(note) Edit Description', value: 'description' },
        { label: '$(list-ordered) Edit Priority', value: 'priority' },
        { label: '$(replace) Edit Replacement', value: 'replacement' },
        { label: '$(symbol-string) Edit Pattern', value: 'pattern' },
        { label: '$(arrow-left) Back', value: 'back' }
      ],
      {
        placeHolder: `Editing: ${rule.name}`,
        title: 'Edit Rule'
      }
    );

    if (!action || action.value === 'back') {
      return;
    }

    if (action.value === 'separator') continue;

    switch (action.value) {
      case 'toggle':
        rule.enabled = !rule.enabled;
        break;

      case 'name':
        const newName = await vscode.window.showInputBox({
          prompt: 'Enter new rule name',
          value: rule.name,
          placeHolder: 'Enter a new rule name',
          validateInput: (value) => {
            if (!value || value.trim().length === 0) return 'Rule name is required';
            if (profile.rules.some(r => r.name === value)) return 'Rule name already exists';
            return null;
          }
        });

        if (newName) {
          rule.name = newName;
        }
        break;

      case 'description':
        const newDesc = await vscode.window.showInputBox({
          prompt: 'Enter new description',
          value: rule.description,
          placeHolder: 'Enter a new description',
          validateInput: (value) => {
            if (!value || value.trim().length === 0) return 'Description cannot be empty';
            if (profile.rules.some(r => r.description === value)) return 'Rule name already exists';
            return null;
          }
        });

        if (newDesc) {
          rule.description = newDesc;
        }
        break;

      case 'priority':
        const newPriority = await vscode.window.showInputBox({
          prompt: 'Enter new priority (1-100)',
          placeHolder: 'Enter a new priority (1-100)',
          validateInput: (value) => {
            const num = parseInt(value);
            return !isNaN(num) && num >= 1 && num <= 100 ? null : 'Priority must be between 1 and 100';
          }
        });

        if (newPriority) {
          rule.priority = parseInt(newPriority);
        }
        break;

      case 'pattern':
      case 'replacement':
      case 'category':
        // These handled via the main edit function
        return;

      case 'remove':
        const confirm = await vscode.window.showWarningMessage(
          `Remove rule "${rule.name}"?`,
          'Remove',
          'Cancel'
        );

        if (confirm === 'Remove') {
          profile.rules = profile.rules.filter(r => r.id !== rule.id);
          await getNotificationManager().showNotification({
            type: 'info',
            message: `Removed rule: ${rule.name}`
          });
          return;
        }
    }
  }
}

async function showDeleteProfileDialog(): Promise<void> {
  const profiles = profileManager.getCustomProfiles();
  const profileNames = profiles.map(p => p.name);

  const selected = await vscode.window.showQuickPick(
    profileNames,
    {
      placeHolder: 'Select profile to delete',
      title: 'Delete Profile'
    }
  );

  if (selected) {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete profile: ${selected}?`,
      'Delete',
      'Cancel'
    );

    if (confirm === 'Delete') {
      const success = profileManager.deleteProfile(selected);
      if (success) {
        await getNotificationManager().showNotification({
          type: 'info',
          message: `Deleted profile: ${selected}`
        });
      } else {
        await getNotificationManager().showNotification({
          type: 'error',
          message: `Cannot delete predefined profile: ${selected}`
        });
      }
    }
  }
}

async function showImportProfileDialog(): Promise<void> {
  const uri = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { 'JSON Files': ['json'] },
    openLabel: 'Import Profile'
  });

  if (uri && uri.length > 0) {
    const profile = profileManager.importProfile(uri[0].fsPath);
    if (profile) {
      await getNotificationManager().showNotification({
        type: 'info',
        message: `Imported profile: ${profile.name}`
      });
    } else {
      await getNotificationManager().showNotification({
        type: 'error',
        message: 'Failed to import profile'
      });
    }
  }
}

async function showExportProfileDialog(): Promise<void> {
  const profiles = profileManager.getAllProfiles();
  const profileNames = profiles.map(p => p.name);

  const selected = await vscode.window.showQuickPick(
    profileNames,
    {
      placeHolder: 'Select profile to export',
      title: 'Export Profile'
    }
  );

  if (selected) {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${selected}-profile.json`),
      filters: { 'JSON Files': ['json'] },
      saveLabel: 'Export Profile'
    });

    if (uri) {
      const success = profileManager.exportProfile(selected, uri.fsPath);
      if (success) {
        await getNotificationManager().showNotification({
          type: 'info',
          message: `Exported profile: ${selected}`
        });
      } else {
        await getNotificationManager().showNotification({
          type: 'error',
          message: 'Failed to export profile'
        });
      }
    }
  }
}

// Enhanced conversion with profile support
async function convertWithProfile(ctx: vscode.ExtensionContext, content: string, profile: ConversionProfile): Promise<{ result: string; stats: any }> {
  const startTime = Date.now();

  // Use performance optimizer for large files
  const optimizer = new PerformanceOptimizer(profile.performance, profile);
  const shouldUseOptimizer = content.split('\n').length > 1000;

  if (shouldUseOptimizer) {
    const progressOptions = {
      location: vscode.ProgressLocation.Window,
      title: 'Converting with performance optimization...',
      cancellable: true
    };

    const result = await vscode.window.withProgress(progressOptions, async (progress, token) => {
      return await optimizer.processLargeFile(content, progress, token);
    });

    return { result: result.result, stats: result.metrics };
  } else {
    // Use existing conversion logic for smaller files
    return await convertText(ctx, content);
  }
}

// Export validation functions for testing
export { validateAHKFile, validateConversionResult };

export function deactivate() {
  // Clean up any resources if needed
}
