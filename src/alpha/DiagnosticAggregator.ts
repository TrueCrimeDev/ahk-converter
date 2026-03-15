/**
 * Diagnostic Aggregator
 *
 * Aggregates diagnostics from multiple sources (Alpha interpreter, LSP,
 * static analysis) and manages the VS Code diagnostic collection.
 *
 * @module alpha/DiagnosticAggregator
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AlphaDiagnostic, DiagnosticSource, AggregatedDiagnostic, DiagnosticSeverity } from './types';
import { SymbolIndex } from '../import/symbolIndex';

/**
 * Priority mapping for diagnostic sources
 * Lower number = higher priority
 */
const SOURCE_PRIORITY: Record<DiagnosticSource, number> = {
    'alpha': 1,    // Interpreter diagnostics are most authoritative
    'lsp': 2,      // LSP diagnostics are second
    'static': 3,   // Static analysis third
    'custom': 4    // Custom diagnostics lowest
};

/**
 * Diagnostic Aggregator class
 */
export class DiagnosticAggregator implements vscode.Disposable {
    private collections: Map<DiagnosticSource, vscode.DiagnosticCollection>;
    private diagnostics: Map<string, Map<DiagnosticSource, vscode.Diagnostic[]>>;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.collections = new Map();
        this.diagnostics = new Map();
        this.outputChannel = vscode.window.createOutputChannel('AHK Diagnostics');

        // Create collections for each source
        for (const source of ['alpha', 'lsp', 'static', 'custom'] as DiagnosticSource[]) {
            this.collections.set(
                source,
                vscode.languages.createDiagnosticCollection(`ahk-${source}`)
            );
        }
    }

    /**
     * Add diagnostics from a source for a file
     */
    setDiagnostics(
        uri: vscode.Uri,
        source: DiagnosticSource,
        diagnostics: vscode.Diagnostic[]
    ): void {
        const key = this.normalizeUri(uri);

        // Get or create file diagnostics map
        let fileDiagnostics = this.diagnostics.get(key);
        if (!fileDiagnostics) {
            fileDiagnostics = new Map();
            this.diagnostics.set(key, fileDiagnostics);
        }

        // Store diagnostics for this source
        fileDiagnostics.set(source, diagnostics);

        // Update the collection
        const collection = this.collections.get(source);
        if (collection) {
            collection.set(uri, diagnostics);
        }

        this.log(`Set ${diagnostics.length} ${source} diagnostics for ${path.basename(uri.fsPath)}`);
    }

    /**
     * Add Alpha diagnostics (converts from AlphaDiagnostic format)
     */
    setAlphaDiagnostics(uri: vscode.Uri, alphaDiagnostics: AlphaDiagnostic[]): void {
        const diagnostics = alphaDiagnostics
            .filter(d => this.normalizeFilePath(d.file) === this.normalizeFilePath(uri.fsPath))
            .filter(d => !this.isWildcardImportSymbolWarning(uri, d))
            .map(d => this.convertAlphaDiagnostic(d));

        this.setDiagnostics(uri, 'alpha', diagnostics);
    }

    /**
     * Check if a diagnostic is a "Variable never assigned" warning for a wildcard-imported symbol
     */
    private isWildcardImportSymbolWarning(uri: vscode.Uri, diagnostic: AlphaDiagnostic): boolean {
        // Check if this is a "Variable appears to never be assigned" warning
        if (!diagnostic.message.includes('appears to never be assigned')) {
            return false;
        }

        // Extract variable name from message like "Variable 'Sum' appears to never be assigned"
        const match = diagnostic.message.match(/Variable '(\w+)'/);
        if (!match) {
            return false;
        }

        const variableName = match[1];

        // Check if this symbol comes from a wildcard import
        const symbolIndex = SymbolIndex.getInstance();
        return symbolIndex.isSymbolFromWildcardImport(uri, variableName);
    }

    /**
     * Get all diagnostics for a file (from all sources)
     */
    getDiagnostics(uri: vscode.Uri): AggregatedDiagnostic[] {
        const key = this.normalizeUri(uri);
        const fileDiagnostics = this.diagnostics.get(key);

        if (!fileDiagnostics) {
            return [];
        }

        const result: AggregatedDiagnostic[] = [];

        for (const [source, diagnostics] of fileDiagnostics) {
            for (const diagnostic of diagnostics) {
                result.push({
                    diagnostic,
                    source,
                    priority: SOURCE_PRIORITY[source]
                });
            }
        }

        // Sort by priority then by line
        return result.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.diagnostic.range.start.line - b.diagnostic.range.start.line;
        });
    }

    /**
     * Get diagnostics from a specific source
     */
    getDiagnosticsFromSource(uri: vscode.Uri, source: DiagnosticSource): vscode.Diagnostic[] {
        const key = this.normalizeUri(uri);
        const fileDiagnostics = this.diagnostics.get(key);
        return fileDiagnostics?.get(source) || [];
    }

    /**
     * Clear diagnostics for a file
     */
    clearDiagnostics(uri: vscode.Uri, source?: DiagnosticSource): void {
        const key = this.normalizeUri(uri);

        if (source) {
            // Clear specific source
            const fileDiagnostics = this.diagnostics.get(key);
            if (fileDiagnostics) {
                fileDiagnostics.delete(source);
            }
            const collection = this.collections.get(source);
            if (collection) {
                collection.delete(uri);
            }
        } else {
            // Clear all sources
            this.diagnostics.delete(key);
            for (const collection of this.collections.values()) {
                collection.delete(uri);
            }
        }
    }

    /**
     * Clear all diagnostics
     */
    clearAll(): void {
        this.diagnostics.clear();
        for (const collection of this.collections.values()) {
            collection.clear();
        }
    }

    /**
     * Get deduplicated diagnostics (removes duplicates across sources)
     */
    getDeduplicatedDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
        const aggregated = this.getDiagnostics(uri);
        const seen = new Map<string, vscode.Diagnostic>();

        for (const { diagnostic } of aggregated) {
            const key = this.diagnosticKey(diagnostic);
            if (!seen.has(key)) {
                seen.set(key, diagnostic);
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Get diagnostic counts by severity
     */
    getCounts(uri?: vscode.Uri): { errors: number; warnings: number; info: number; hints: number } {
        const counts = { errors: 0, warnings: 0, info: 0, hints: 0 };

        const iterate = (diagnostics: vscode.Diagnostic[]) => {
            for (const d of diagnostics) {
                switch (d.severity) {
                    case vscode.DiagnosticSeverity.Error:
                        counts.errors++;
                        break;
                    case vscode.DiagnosticSeverity.Warning:
                        counts.warnings++;
                        break;
                    case vscode.DiagnosticSeverity.Information:
                        counts.info++;
                        break;
                    case vscode.DiagnosticSeverity.Hint:
                        counts.hints++;
                        break;
                }
            }
        };

        if (uri) {
            const key = this.normalizeUri(uri);
            const fileDiagnostics = this.diagnostics.get(key);
            if (fileDiagnostics) {
                for (const diagnostics of fileDiagnostics.values()) {
                    iterate(diagnostics);
                }
            }
        } else {
            for (const fileDiagnostics of this.diagnostics.values()) {
                for (const diagnostics of fileDiagnostics.values()) {
                    iterate(diagnostics);
                }
            }
        }

        return counts;
    }

    /**
     * Check if a file has any errors
     */
    hasErrors(uri: vscode.Uri): boolean {
        const counts = this.getCounts(uri);
        return counts.errors > 0;
    }

    /**
     * Convert AlphaDiagnostic to VS Code Diagnostic
     */
    private convertAlphaDiagnostic(d: AlphaDiagnostic): vscode.Diagnostic {
        const range = new vscode.Range(
            Math.max(0, d.line - 1),
            Math.max(0, d.column - 1),
            Math.max(0, d.endLine - 1),
            Math.max(0, d.endColumn - 1) || 999
        );

        let message = d.message;
        if (d.extra) {
            message += `\nSpecifically: ${d.extra}`;
        }

        const diagnostic = new vscode.Diagnostic(
            range,
            message,
            this.toVsCodeSeverity(d.severity)
        );

        diagnostic.source = d.source || 'ahk-alpha';

        if (d.code) {
            diagnostic.code = {
                value: d.code,
                target: vscode.Uri.parse('https://www.autohotkey.com/docs/v2/')
            };
        }

        return diagnostic;
    }

    /**
     * Convert severity to VS Code severity
     */
    private toVsCodeSeverity(severity: DiagnosticSeverity): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            case 'hint': return vscode.DiagnosticSeverity.Hint;
            default: return vscode.DiagnosticSeverity.Error;
        }
    }

    /**
     * Create a unique key for a diagnostic
     */
    private diagnosticKey(d: vscode.Diagnostic): string {
        return `${d.range.start.line}:${d.range.start.character}:${d.message.substring(0, 50)}`;
    }

    /**
     * Normalize URI for use as map key
     */
    private normalizeUri(uri: vscode.Uri): string {
        return uri.fsPath.toLowerCase().replace(/\\/g, '/');
    }

    /**
     * Normalize file path for comparison
     */
    private normalizeFilePath(filePath: string): string {
        return path.normalize(filePath).toLowerCase();
    }

    /**
     * Log message to output channel
     */
    private log(message: string): void {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    /**
     * Show output channel
     */
    showOutput(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        for (const collection of this.collections.values()) {
            collection.dispose();
        }
        this.outputChannel.dispose();
    }
}

/**
 * Singleton instance for shared use
 */
let defaultAggregator: DiagnosticAggregator | null = null;

export function getDiagnosticAggregator(): DiagnosticAggregator {
    if (!defaultAggregator) {
        defaultAggregator = new DiagnosticAggregator();
    }
    return defaultAggregator;
}
