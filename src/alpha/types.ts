/**
 * Alpha Bridge Type Definitions
 *
 * Common types used across the Alpha integration modules.
 *
 * @module alpha/types
 */

import * as vscode from 'vscode';

/**
 * Severity levels for diagnostics
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Diagnostic information from the Alpha interpreter
 */
export interface AlphaDiagnostic {
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    severity: DiagnosticSeverity;
    message: string;
    extra?: string;
    source: string;
    code?: string;
}

/**
 * Response from Alpha interpreter in JSON mode
 */
export interface AlphaValidationResult {
    errors: AlphaDiagnostic[];
    count: number;
    duration?: number;
    cached?: boolean;
}

/**
 * Configuration for the Alpha bridge
 */
export interface AlphaConfig {
    interpreterPath: string;
    timeout?: number;
    encoding?: string;
    enableCache?: boolean;
    cacheTTL?: number;
    maxCacheSize?: number;
    debounceMs?: number;
}

/**
 * Process execution options
 */
export interface ProcessOptions {
    cwd?: string;
    timeout?: number;
    encoding?: BufferEncoding;
    windowsHide?: boolean;
    env?: NodeJS.ProcessEnv;
}

/**
 * Process execution result
 */
export interface ProcessResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    duration: number;
    timedOut: boolean;
}

/**
 * Cache entry for diagnostic results
 */
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    fileHash?: string;
    fileMtime?: number;
}

/**
 * Diagnostic source identifier
 */
export type DiagnosticSource = 'alpha' | 'lsp' | 'static' | 'custom';

/**
 * Aggregated diagnostic with source tracking
 */
export interface AggregatedDiagnostic {
    diagnostic: vscode.Diagnostic;
    source: DiagnosticSource;
    priority: number;
}

/**
 * File validation request
 */
export interface ValidationRequest {
    uri: vscode.Uri;
    content?: string;
    force?: boolean;
}

/**
 * Event emitter types for Alpha bridge events
 */
export interface AlphaEvents {
    'validation:start': ValidationRequest;
    'validation:complete': { uri: vscode.Uri; result: AlphaValidationResult };
    'validation:error': { uri: vscode.Uri; error: Error };
    'cache:hit': { uri: vscode.Uri };
    'cache:miss': { uri: vscode.Uri };
    'config:changed': AlphaConfig;
}
