/**
 * AHK Console Diagnostics
 *
 * Runs `AutoHotkey64.exe check /Diag=json <file>` on save and publishes
 * structured diagnostics to the VS Code Problems panel.
 *
 * Source label: "ahk-console" — visually distinct from thqby's LSP
 * diagnostics which show as "AutoHotkey2".
 *
 * @module alphaBridge
 */

import { execFile } from 'child_process';
import * as vscode from 'vscode';

/** Shape of one JSON diagnostic line emitted on stderr by the interpreter. */
interface AhkDiagnostic {
    kind: string;
    severity: 'error' | 'warning' | 'critical';
    code: number;
    message: string;
    extra: string;
    file: string;
    line: number;
    source: string;
    stack: string;
}

/** Resolve the AutoHotkey exe path from settings, falling back to PATH. */
function getAhkExe(): string {
    const cfg = vscode.workspace.getConfiguration('ahkConverter');
    const configured = (cfg.get<string>('autoHotkeyV2Path') || '').replace(/"/g, '');
    return configured || 'AutoHotkey64.exe';
}

/**
 * Shell out to the interpreter's `check` subcommand and collect diagnostics.
 * Diagnostics arrive as one JSON object per line on stderr.
 */
function runCheck(filePath: string): Promise<AhkDiagnostic[]> {
    return new Promise((resolve) => {
        const exe = getAhkExe();
        execFile(exe, ['check', '/Diag=json', filePath], { timeout: 10_000 }, (_err, _stdout, stderr) => {
            const results: AhkDiagnostic[] = [];
            const output = stderr || '';
            for (const line of output.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('{')) { continue; }
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.kind === 'diagnostic') {
                        results.push(parsed);
                    }
                } catch { /* skip non-JSON lines */ }
            }
            resolve(results);
        });
    });
}

/**
 * High-value diagnostic patterns — things the interpreter catches that
 * thqby's LSP TypeScript parser does NOT:
 *
 *  - #Requires version validation against the actual interpreter build
 *  - DllCall type validation (invalid arg/return types at load time)
 *  - Export/global conflicts in the module system
 *  - Encoding warnings (non-UTF-8 files)
 *
 * NOT included (the LSP already catches these):
 *  - #Import module-not-found
 *  - Struct type annotations (LSP misreads them as variables, but still flags)
 *  - Hotkey validation (invalid key names, duplicates, prefix rules)
 *  - #Warn diagnostics (LocalSameAsGlobal, Unreachable, VarUnset)
 *  - #Include missing files
 *  - Basic syntax errors
 *
 * Errors and criticals are always surfaced — the LSP is unlikely to catch
 * those anyway. Warnings are filtered to avoid duplicating what the LSP
 * already reports.
 */
const HIGH_VALUE_PATTERNS = [
    /#requires/i,
    /invalid arg type/i,
    /invalid return type/i,
    /dllcall/i,
    /UTF-8/i,
    /encoding/i,
    /export.*global/i,
];

function isHighValue(diag: AhkDiagnostic): boolean {
    // Errors and criticals always pass — those are real problems the LSP may miss
    if (diag.severity === 'error' || diag.severity === 'critical') { return true; }
    // Warnings only pass if they match an interpreter-specific pattern
    const text = `${diag.message} ${diag.extra}`;
    return HIGH_VALUE_PATTERNS.some(p => p.test(text));
}

function mapSeverity(sev: string): vscode.DiagnosticSeverity {
    switch (sev) {
        case 'warning': return vscode.DiagnosticSeverity.Warning;
        case 'critical': return vscode.DiagnosticSeverity.Error;
        default: return vscode.DiagnosticSeverity.Error;
    }
}

/**
 * Validate an AHK document and publish results to the diagnostic collection.
 * Groups by file so errors in #Include'd files are attributed correctly.
 */
async function validateDocument(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection,
    channel: vscode.OutputChannel,
): Promise<void> {
    if (document.languageId !== 'ahk2' && !document.fileName.endsWith('.ahk')) { return; }

    const timestamp = new Date().toLocaleTimeString();
    channel.appendLine(`[${timestamp}] Checking: ${document.fileName}`);

    const raw = await runCheck(document.fileName);

    // Drop warnings the LSP already covers to avoid duplicate Problems entries
    const diags = raw.filter(isHighValue);
    for (const d of raw) {
        const icon = d.severity === 'error' || d.severity === 'critical' ? 'x' : '!';
        const detail = d.extra ? `: ${d.extra}` : '';
        channel.appendLine(`  ${icon} L${d.line} [${d.severity}] ${d.message}${detail}`);
    }
    const filtered = raw.length - diags.length;
    channel.appendLine(`  ${raw.length} total, ${diags.length} surfaced, ${filtered} filtered (LSP covers)`);
    if (raw.length === 0) {
        channel.appendLine('  OK No issues found');
    }

    // Group by file — check can report errors in #Include'd files
    const byFile = new Map<string, vscode.Diagnostic[]>();

    for (const d of diags) {
        const uri = d.file || document.fileName;
        if (!byFile.has(uri)) { byFile.set(uri, []); }

        const line = Math.max(0, d.line - 1); // AHK 1-indexed → VS Code 0-indexed
        const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);

        const msg = d.extra ? `${d.message}: ${d.extra}` : d.message;
        const diagnostic = new vscode.Diagnostic(range, msg, mapSeverity(d.severity));
        diagnostic.source = 'ahk-console';

        byFile.get(uri)!.push(diagnostic);
    }

    // Clear previous and set new
    collection.clear();
    for (const [filePath, fileDiags] of byFile) {
        collection.set(vscode.Uri.file(filePath), fileDiags);
    }
}

/**
 * Register the on-save diagnostic provider.
 * Call once from `activate()` and push the returned disposable into
 * `context.subscriptions`.
 */
export function registerConsoleDiagnostics(context: vscode.ExtensionContext): vscode.Disposable {
    const collection = vscode.languages.createDiagnosticCollection('ahk-console');
    const channel = vscode.window.createOutputChannel('AHK Console Diagnostics');

    const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
        validateDocument(doc, collection, channel);
    });

    const disposable = vscode.Disposable.from(collection, onSave, channel);
    context.subscriptions.push(disposable);
    return disposable;
}
