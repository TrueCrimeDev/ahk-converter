/**
 * Alpha Interpreter Bridge
 *
 * Bridges the AutoHotkey Alpha interpreter with VS Code diagnostics.
 * Uses /ErrorStdOut=JSON for structured error output.
 *
 * @module alphaBridge
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

// Import helper classes
import {
    AlphaDiagnostic,
    AlphaValidationResult,
    AlphaConfig,
    getProcessRunner,
    getErrorParser,
    getDiagnosticCache,
    getConfigManager,
    getDiagnosticAggregator
} from './alpha';

// Re-export types for backwards compatibility
export type { AlphaDiagnostic, AlphaValidationResult };

/**
 * Configuration for the Alpha bridge (legacy interface)
 */
export interface AlphaBridgeConfig {
    interpreterPath: string;
    timeout?: number;
    encoding?: string;
}

/**
 * Alpha Interpreter Bridge class
 *
 * Provides integration between the AutoHotkey Alpha interpreter
 * and VS Code's diagnostic system.
 */
export class AlphaBridge {
    private interpreterPath: string;
    private timeout: number;
    private encoding: string;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private outputChannel: vscode.OutputChannel;

    constructor(config: AlphaBridgeConfig) {
        this.interpreterPath = config.interpreterPath;
        this.timeout = config.timeout || 30000;
        this.encoding = config.encoding || 'utf8';
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ahk-alpha');
        this.outputChannel = vscode.window.createOutputChannel('AHK Alpha Bridge');
    }

    /**
     * Validates a script file using the Alpha interpreter
     *
     * @param filePath - Path to the .ahk file to validate
     * @returns Promise<AlphaValidationResult>
     */
    async validateFile(filePath: string): Promise<AlphaValidationResult> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.interpreterPath)) {
                reject(new Error(`Alpha interpreter not found: ${this.interpreterPath}`));
                return;
            }

            if (!fs.existsSync(filePath)) {
                reject(new Error(`Script file not found: ${filePath}`));
                return;
            }

            const args = ['/ErrorStdOut=JSON', '/validate', filePath];

            this.outputChannel.appendLine(`[Alpha] Validating: ${filePath}`);
            this.outputChannel.appendLine(`[Alpha] Command: ${this.interpreterPath} ${args.join(' ')}`);

            let stdout = '';
            let stderr = '';

            const proc = cp.spawn(this.interpreterPath, args, {
                cwd: path.dirname(filePath),
                windowsHide: true
            });

            proc.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            const timeoutId = setTimeout(() => {
                proc.kill();
                reject(new Error(`Validation timed out after ${this.timeout}ms`));
            }, this.timeout);

            proc.on('close', (code: number | null) => {
                clearTimeout(timeoutId);

                // Alpha outputs JSON to stderr when using /ErrorStdOut=JSON
                const output = stderr || stdout;

                this.outputChannel.appendLine(`[Alpha] Exit code: ${code}`);
                this.outputChannel.appendLine(`[Alpha] Output: ${output.substring(0, 500)}...`);

                try {
                    const result = this.parseJsonOutput(output);
                    resolve(result);
                } catch (parseError) {
                    // Fallback: try to parse as traditional error format
                    this.outputChannel.appendLine(`[Alpha] JSON parse failed, trying traditional format`);
                    const fallbackResult = this.parseTraditionalOutput(output, filePath);
                    resolve(fallbackResult);
                }
            });

            proc.on('error', (err: Error) => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    }

    /**
     * Parse JSON format output from Alpha
     */
    private parseJsonOutput(output: string): AlphaValidationResult {
        // Find the JSON object in the output
        const jsonMatch = output.match(/\{[\s\S]*"errors"[\s\S]*\}/);
        if (!jsonMatch) {
            // If no errors, return empty result
            return { errors: [], count: 0 };
        }

        const result = JSON.parse(jsonMatch[0]) as AlphaValidationResult;
        return result;
    }

    /**
     * Parse traditional error format as fallback
     * Format: FILE (LINE) : ==> [Warning: ]ERROR_MESSAGE
     */
    private parseTraditionalOutput(output: string, defaultFile: string): AlphaValidationResult {
        const errors: AlphaDiagnostic[] = [];
        const lines = output.split('\n');

        // Pattern: FILE (LINE) : ==> [Warning: ]MESSAGE
        const errorPattern = /^(.+?)\s+\((\d+)\)\s*:\s*==>\s*(Warning:\s*)?(.+)$/;
        const specificPattern = /^\s*Specifically:\s*(.+)$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const match = line.match(errorPattern);

            if (match) {
                const [, file, lineNum, isWarning, message] = match;

                const diagnostic: AlphaDiagnostic = {
                    file: file || defaultFile,
                    line: parseInt(lineNum, 10),
                    column: 1,
                    endLine: parseInt(lineNum, 10),
                    endColumn: 1,
                    severity: isWarning ? 'warning' : 'error',
                    message: message.trim(),
                    source: 'ahk-alpha'
                };

                // Check next line for "Specifically:" detail
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    const specificMatch = nextLine.match(specificPattern);
                    if (specificMatch) {
                        diagnostic.extra = specificMatch[1];
                        i++; // Skip the specifically line
                    }
                }

                errors.push(diagnostic);
            }
        }

        return {
            errors,
            count: errors.length
        };
    }

    /**
     * Convert Alpha diagnostics to VS Code diagnostics and update collection
     */
    updateDiagnostics(uri: vscode.Uri, result: AlphaValidationResult): void {
        const diagnostics: vscode.Diagnostic[] = result.errors
            .filter(e => this.normalizeFilePath(e.file) === this.normalizeFilePath(uri.fsPath))
            .map(e => this.toDiagnostic(e));

        this.diagnosticCollection.set(uri, diagnostics);

        this.outputChannel.appendLine(
            `[Alpha] Updated ${diagnostics.length} diagnostics for ${path.basename(uri.fsPath)}`
        );
    }

    /**
     * Convert AlphaDiagnostic to vscode.Diagnostic
     */
    private toDiagnostic(d: AlphaDiagnostic): vscode.Diagnostic {
        const range = new vscode.Range(
            Math.max(0, d.line - 1), Math.max(0, d.column - 1),
            Math.max(0, d.endLine - 1), Math.max(0, d.endColumn - 1 || 999)
        );

        const severity = this.toSeverity(d.severity);

        let message = d.message;
        if (d.extra) {
            message += `\nSpecifically: ${d.extra}`;
        }

        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = 'ahk-alpha';

        // Add code for potential quick fixes
        diagnostic.code = {
            value: d.severity,
            target: vscode.Uri.parse('https://www.autohotkey.com/docs/v2/')
        };

        return diagnostic;
    }

    /**
     * Map severity string to VS Code DiagnosticSeverity
     */
    private toSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            case 'hint': return vscode.DiagnosticSeverity.Hint;
            default: return vscode.DiagnosticSeverity.Error;
        }
    }

    /**
     * Normalize file path for comparison
     */
    private normalizeFilePath(filePath: string): string {
        return path.normalize(filePath).toLowerCase();
    }

    /**
     * Clear all diagnostics
     */
    clearDiagnostics(uri?: vscode.Uri): void {
        if (uri) {
            this.diagnosticCollection.delete(uri);
        } else {
            this.diagnosticCollection.clear();
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.diagnosticCollection.dispose();
        this.outputChannel.dispose();
    }
}

/**
 * Alpha Bridge Diagnostic Provider
 *
 * Implements VS Code diagnostic provider using the Alpha interpreter
 */
export class AlphaDiagnosticProvider implements vscode.Disposable {
    private bridge: AlphaBridge;
    private disposables: vscode.Disposable[] = [];
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private debounceMs: number;

    constructor(config: AlphaBridgeConfig, debounceMs: number = 500) {
        this.bridge = new AlphaBridge(config);
        this.debounceMs = debounceMs;
    }

    /**
     * Register the diagnostic provider for AHK documents
     */
    register(): vscode.Disposable[] {
        // Validate on document open
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(doc => this.onDocument(doc))
        );

        // Validate on document save
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => this.onDocument(doc))
        );

        // Validate on document change (debounced)
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChange(e))
        );

        // Clear diagnostics when document closes
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                if (this.isAhkDocument(doc)) {
                    this.bridge.clearDiagnostics(doc.uri);
                }
            })
        );

        // Validate all open AHK documents
        vscode.workspace.textDocuments.forEach(doc => this.onDocument(doc));

        return this.disposables;
    }

    /**
     * Check if document is an AHK file
     */
    private isAhkDocument(doc: vscode.TextDocument): boolean {
        return doc.languageId === 'ahk2' ||
               doc.languageId === 'ahk' ||
               doc.fileName.endsWith('.ahk');
    }

    /**
     * Handle document open/save
     */
    private async onDocument(doc: vscode.TextDocument): Promise<void> {
        if (!this.isAhkDocument(doc)) return;

        try {
            const result = await this.bridge.validateFile(doc.uri.fsPath);
            this.bridge.updateDiagnostics(doc.uri, result);
        } catch (error) {
            console.error('[Alpha Bridge] Validation error:', error);
        }
    }

    /**
     * Handle document change (debounced)
     */
    private onDocumentChange(e: vscode.TextDocumentChangeEvent): void {
        if (!this.isAhkDocument(e.document)) return;

        const key = e.document.uri.toString();

        // Clear existing timer
        const existing = this.debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        // Set new debounced timer
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            this.onDocument(e.document);
        }, this.debounceMs);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Manually trigger validation for a document
     */
    async validateDocument(doc: vscode.TextDocument): Promise<AlphaValidationResult | undefined> {
        if (!this.isAhkDocument(doc)) return undefined;

        try {
            const result = await this.bridge.validateFile(doc.uri.fsPath);
            this.bridge.updateDiagnostics(doc.uri, result);
            return result;
        } catch (error) {
            console.error('[Alpha Bridge] Validation error:', error);
            return undefined;
        }
    }

    /**
     * Get the underlying bridge instance
     */
    getBridge(): AlphaBridge {
        return this.bridge;
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.debounceTimers.forEach(t => clearTimeout(t));
        this.debounceTimers.clear();
        this.bridge.dispose();
    }
}

/**
 * Detect Alpha interpreter path
 *
 * Searches common locations for the Alpha.exe interpreter
 */
export function detectAlphaPath(): string | undefined {
    const possiblePaths = [
        // Workspace-relative
        path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'bin', 'Alpha.exe'),
        // User Documents
        path.join(process.env.USERPROFILE || '', 'Documents', 'AutoHotkey', 'Alpha', 'Alpha.exe'),
        // Program Files
        path.join(process.env.PROGRAMFILES || '', 'AutoHotkey', 'Alpha', 'Alpha.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'AutoHotkey', 'Alpha', 'Alpha.exe'),
        // Common development paths
        path.join(process.env.USERPROFILE || '', 'Documents', 'Design', 'Coding', 'AHK_v2a', 'bin', 'Alpha.exe'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return undefined;
}

/**
 * Create and register the Alpha diagnostic provider
 *
 * @param context - VS Code extension context
 * @param interpreterPath - Optional path to Alpha.exe (auto-detected if not provided)
 * @returns The diagnostic provider instance or undefined if Alpha not found
 */
export function createAlphaDiagnosticProvider(
    context: vscode.ExtensionContext,
    interpreterPath?: string
): AlphaDiagnosticProvider | undefined {
    const alphaPath = interpreterPath || detectAlphaPath();

    if (!alphaPath) {
        vscode.window.showWarningMessage(
            'Alpha interpreter not found. Set the path in settings to enable interpreter-based diagnostics.'
        );
        return undefined;
    }

    const provider = new AlphaDiagnosticProvider({
        interpreterPath: alphaPath,
        timeout: 30000
    });

    const disposables = provider.register();
    context.subscriptions.push(...disposables);
    context.subscriptions.push(provider);

    vscode.window.showInformationMessage(`AHK Alpha Bridge: Using interpreter at ${alphaPath}`);

    return provider;
}
