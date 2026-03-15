/**
 * Error Parser
 *
 * Parses error output from the Alpha interpreter in both JSON
 * and traditional text formats.
 *
 * @module alpha/ErrorParser
 */

import { AlphaDiagnostic, AlphaValidationResult, DiagnosticSeverity } from './types';

/**
 * Error Parser class for Alpha interpreter output
 */
export class ErrorParser {
    /**
     * Parse Alpha output, auto-detecting format
     */
    parse(output: string, defaultFile: string = ''): AlphaValidationResult {
        const trimmed = output.trim();

        // Try JSON format first
        if (trimmed.startsWith('{')) {
            try {
                return this.parseJson(trimmed);
            } catch {
                // Fall through to traditional format
            }
        }

        // Try traditional format
        return this.parseTraditional(output, defaultFile);
    }

    /**
     * Parse JSON format output from Alpha
     */
    parseJson(output: string): AlphaValidationResult {
        // Find the JSON object in the output (may have extra content before/after)
        const jsonMatch = output.match(/\{[\s\S]*"errors"[\s\S]*\}/);
        if (!jsonMatch) {
            return { errors: [], count: 0 };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and normalize the structure
        const result: AlphaValidationResult = {
            errors: [],
            count: parsed.count || 0
        };

        if (Array.isArray(parsed.errors)) {
            result.errors = parsed.errors.map((e: any) => this.normalizeError(e));
            result.count = result.errors.length;
        }

        return result;
    }

    /**
     * Parse traditional error format
     * Format: FILE (LINE) : ==> [Warning: ]ERROR_MESSAGE
     */
    parseTraditional(output: string, defaultFile: string): AlphaValidationResult {
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
     * Normalize an error object to ensure all fields are present
     */
    private normalizeError(error: any): AlphaDiagnostic {
        return {
            file: String(error.file || ''),
            line: Number(error.line) || 1,
            column: Number(error.column) || 1,
            endLine: Number(error.endLine) || Number(error.line) || 1,
            endColumn: Number(error.endColumn) || 1,
            severity: this.normalizeSeverity(error.severity),
            message: String(error.message || 'Unknown error'),
            extra: error.extra ? String(error.extra) : undefined,
            source: String(error.source || 'ahk'),
            code: error.code ? String(error.code) : undefined
        };
    }

    /**
     * Normalize severity string
     */
    private normalizeSeverity(severity: any): DiagnosticSeverity {
        const s = String(severity).toLowerCase();
        switch (s) {
            case 'error':
            case 'err':
                return 'error';
            case 'warning':
            case 'warn':
                return 'warning';
            case 'info':
            case 'information':
                return 'info';
            case 'hint':
                return 'hint';
            default:
                return 'error';
        }
    }

    /**
     * Extract error code from message if present
     */
    extractErrorCode(message: string): { code: string | undefined; cleanMessage: string } {
        // Pattern: [E001] Message or Error 001: Message
        const codePattern = /^\[([A-Z]\d+)\]\s*(.+)$/;
        const errorNumPattern = /^(Error|Warning)\s+(\d+):\s*(.+)$/i;

        let match = message.match(codePattern);
        if (match) {
            return { code: match[1], cleanMessage: match[2] };
        }

        match = message.match(errorNumPattern);
        if (match) {
            const prefix = match[1].toLowerCase() === 'error' ? 'E' : 'W';
            return { code: `${prefix}${match[2]}`, cleanMessage: match[3] };
        }

        return { code: undefined, cleanMessage: message };
    }

    /**
     * Group errors by file
     */
    groupByFile(errors: AlphaDiagnostic[]): Map<string, AlphaDiagnostic[]> {
        const groups = new Map<string, AlphaDiagnostic[]>();

        for (const error of errors) {
            const file = error.file.toLowerCase();
            const existing = groups.get(file) || [];
            existing.push(error);
            groups.set(file, existing);
        }

        return groups;
    }

    /**
     * Sort errors by line number
     */
    sortByLine(errors: AlphaDiagnostic[]): AlphaDiagnostic[] {
        return [...errors].sort((a, b) => {
            if (a.file !== b.file) {
                return a.file.localeCompare(b.file);
            }
            if (a.line !== b.line) {
                return a.line - b.line;
            }
            return a.column - b.column;
        });
    }

    /**
     * Filter errors by severity
     */
    filterBySeverity(
        errors: AlphaDiagnostic[],
        severities: DiagnosticSeverity[]
    ): AlphaDiagnostic[] {
        return errors.filter(e => severities.includes(e.severity));
    }
}

/**
 * Singleton instance for shared use
 */
let defaultParser: ErrorParser | null = null;

export function getErrorParser(): ErrorParser {
    if (!defaultParser) {
        defaultParser = new ErrorParser();
    }
    return defaultParser;
}
