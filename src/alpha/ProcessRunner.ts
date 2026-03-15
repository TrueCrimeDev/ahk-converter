/**
 * Process Runner
 *
 * Manages execution of external processes with timeout handling,
 * output buffering, and proper cleanup.
 *
 * @module alpha/ProcessRunner
 */

import * as cp from 'child_process';
import * as path from 'path';
import { ProcessOptions, ProcessResult } from './types';

/**
 * Process Runner class for executing external commands
 */
export class ProcessRunner {
    private defaultTimeout: number;
    private defaultEncoding: BufferEncoding;

    constructor(options: { timeout?: number; encoding?: BufferEncoding } = {}) {
        this.defaultTimeout = options.timeout || 30000;
        this.defaultEncoding = options.encoding || 'utf8';
    }

    /**
     * Execute a command and return the result
     */
    async run(
        command: string,
        args: string[],
        options: ProcessOptions = {}
    ): Promise<ProcessResult> {
        const startTime = Date.now();
        const timeout = options.timeout || this.defaultTimeout;
        const encoding = options.encoding || this.defaultEncoding;

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;

            const proc = cp.spawn(command, args, {
                cwd: options.cwd,
                env: options.env || process.env,
                windowsHide: options.windowsHide ?? true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            const timeoutId = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
                // Force kill after grace period
                setTimeout(() => {
                    if (!proc.killed) {
                        proc.kill('SIGKILL');
                    }
                }, 1000);
            }, timeout);

            proc.stdout.setEncoding(encoding);
            proc.stderr.setEncoding(encoding);

            proc.stdout.on('data', (data: string) => {
                stdout += data;
            });

            proc.stderr.on('data', (data: string) => {
                stderr += data;
            });

            proc.on('close', (code, signal) => {
                clearTimeout(timeoutId);
                resolve({
                    stdout,
                    stderr,
                    exitCode: code,
                    signal,
                    duration: Date.now() - startTime,
                    timedOut
                });
            });

            proc.on('error', (err) => {
                clearTimeout(timeoutId);
                resolve({
                    stdout,
                    stderr: stderr + '\n' + err.message,
                    exitCode: -1,
                    signal: null,
                    duration: Date.now() - startTime,
                    timedOut: false
                });
            });
        });
    }

    /**
     * Execute Alpha interpreter with validation flags
     */
    async runAlpha(
        interpreterPath: string,
        scriptPath: string,
        options: ProcessOptions = {}
    ): Promise<ProcessResult> {
        const args = ['/ErrorStdOut=JSON', '/validate', scriptPath];
        const cwd = options.cwd || path.dirname(scriptPath);

        return this.run(interpreterPath, args, { ...options, cwd });
    }

    /**
     * Execute Alpha interpreter with custom arguments
     */
    async runAlphaCustom(
        interpreterPath: string,
        args: string[],
        options: ProcessOptions = {}
    ): Promise<ProcessResult> {
        return this.run(interpreterPath, args, options);
    }

    /**
     * Check if a path is executable
     */
    async isExecutable(filePath: string): Promise<boolean> {
        try {
            const result = await this.run(filePath, ['/?'], { timeout: 5000 });
            return result.exitCode !== -1;
        } catch {
            return false;
        }
    }
}

/**
 * Singleton instance for shared use
 */
let defaultRunner: ProcessRunner | null = null;

export function getProcessRunner(options?: { timeout?: number; encoding?: BufferEncoding }): ProcessRunner {
    if (!defaultRunner) {
        defaultRunner = new ProcessRunner(options);
    }
    return defaultRunner;
}
