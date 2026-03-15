/**
 * Configuration Manager
 *
 * Manages Alpha interpreter configuration with VS Code settings integration,
 * auto-detection of interpreter paths, and configuration change events.
 *
 * @module alpha/ConfigManager
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AlphaConfig } from './types';

/**
 * Default configuration values
 */
const DEFAULTS: Required<AlphaConfig> = {
    interpreterPath: '',
    timeout: 30000,
    encoding: 'utf8',
    enableCache: true,
    cacheTTL: 60000,
    maxCacheSize: 100,
    debounceMs: 500
};

/**
 * Configuration Manager class
 */
export class ConfigManager implements vscode.Disposable {
    private config: AlphaConfig;
    private disposables: vscode.Disposable[] = [];
    private changeEmitter = new vscode.EventEmitter<AlphaConfig>();

    /**
     * Event fired when configuration changes
     */
    readonly onConfigChanged = this.changeEmitter.event;

    constructor() {
        this.config = { ...DEFAULTS };
        this.loadFromSettings();

        // Watch for settings changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('ahkAlpha')) {
                    this.loadFromSettings();
                    this.changeEmitter.fire(this.config);
                }
            })
        );
    }

    /**
     * Load configuration from VS Code settings
     */
    private loadFromSettings(): void {
        const settings = vscode.workspace.getConfiguration('ahkAlpha');

        this.config = {
            interpreterPath: settings.get('interpreterPath', '') || this.detectInterpreterPath() || '',
            timeout: settings.get('timeout', DEFAULTS.timeout),
            encoding: settings.get('encoding', DEFAULTS.encoding),
            enableCache: settings.get('enableCache', DEFAULTS.enableCache),
            cacheTTL: settings.get('cacheTTL', DEFAULTS.cacheTTL),
            maxCacheSize: settings.get('maxCacheSize', DEFAULTS.maxCacheSize),
            debounceMs: settings.get('debounceMs', DEFAULTS.debounceMs)
        };
    }

    /**
     * Get current configuration
     */
    getConfig(): Readonly<AlphaConfig> {
        return { ...this.config };
    }

    /**
     * Get a specific config value
     */
    get<K extends keyof AlphaConfig>(key: K): AlphaConfig[K] {
        return this.config[key];
    }

    /**
     * Update a config value (persists to VS Code settings)
     */
    async set<K extends keyof AlphaConfig>(key: K, value: AlphaConfig[K]): Promise<void> {
        const settings = vscode.workspace.getConfiguration('ahkAlpha');
        await settings.update(key, value, vscode.ConfigurationTarget.Global);
        this.config[key] = value;
    }

    /**
     * Check if interpreter is configured and available
     */
    isConfigured(): boolean {
        return !!this.config.interpreterPath && fs.existsSync(this.config.interpreterPath);
    }

    /**
     * Get interpreter path, auto-detecting if not set
     */
    getInterpreterPath(): string | undefined {
        if (this.config.interpreterPath && fs.existsSync(this.config.interpreterPath)) {
            return this.config.interpreterPath;
        }

        const detected = this.detectInterpreterPath();
        if (detected) {
            this.config.interpreterPath = detected;
            return detected;
        }

        return undefined;
    }

    /**
     * Auto-detect Alpha interpreter path
     */
    detectInterpreterPath(): string | undefined {
        const possiblePaths = this.getPossiblePaths();

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return undefined;
    }

    /**
     * Get list of possible interpreter paths
     */
    private getPossiblePaths(): string[] {
        const paths: string[] = [];
        const userProfile = process.env.USERPROFILE || process.env.HOME || '';
        const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
        const programFiles86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

        // Workspace-relative paths
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                paths.push(
                    path.join(folder.uri.fsPath, 'bin', 'Alpha.exe'),
                    path.join(folder.uri.fsPath, 'Alpha.exe'),
                    path.join(folder.uri.fsPath, '..', 'AHK_v2a', 'bin', 'Alpha.exe')
                );
            }
        }

        // User Documents
        paths.push(
            path.join(userProfile, 'Documents', 'AutoHotkey', 'Alpha', 'Alpha.exe'),
            path.join(userProfile, 'Documents', 'Design', 'Coding', 'AHK_v2a', 'bin', 'Alpha.exe')
        );

        // Program Files
        paths.push(
            path.join(programFiles, 'AutoHotkey', 'Alpha', 'Alpha.exe'),
            path.join(programFiles, 'AutoHotkey', 'v2', 'Alpha.exe'),
            path.join(programFiles86, 'AutoHotkey', 'Alpha', 'Alpha.exe')
        );

        // Common development locations
        paths.push(
            'C:\\AHK\\Alpha.exe',
            'C:\\AutoHotkey\\Alpha.exe'
        );

        return paths;
    }

    /**
     * Prompt user to configure interpreter path
     */
    async promptForInterpreterPath(): Promise<string | undefined> {
        const detected = this.detectInterpreterPath();

        const options: vscode.QuickPickItem[] = [];

        if (detected) {
            options.push({
                label: '$(check) Use detected path',
                description: detected,
                detail: 'Auto-detected Alpha interpreter'
            });
        }

        options.push({
            label: '$(folder-opened) Browse...',
            description: 'Select Alpha.exe manually',
            detail: 'Open file browser to locate Alpha.exe'
        });

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select Alpha interpreter path',
            title: 'Configure AHK Alpha Interpreter'
        });

        if (!selected) {
            return undefined;
        }

        if (selected.label.includes('detected')) {
            await this.set('interpreterPath', detected!);
            return detected;
        }

        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Executable': ['exe'] },
            title: 'Select Alpha.exe'
        });

        if (files && files.length > 0) {
            const selectedPath = files[0].fsPath;
            await this.set('interpreterPath', selectedPath);
            return selectedPath;
        }

        return undefined;
    }

    /**
     * Validate current configuration
     */
    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!this.config.interpreterPath) {
            errors.push('Interpreter path not configured');
        } else if (!fs.existsSync(this.config.interpreterPath)) {
            errors.push(`Interpreter not found: ${this.config.interpreterPath}`);
        }

        if (this.config.timeout && this.config.timeout < 1000) {
            errors.push('Timeout should be at least 1000ms');
        }

        if (this.config.cacheTTL && this.config.cacheTTL < 0) {
            errors.push('Cache TTL must be non-negative');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Reset configuration to defaults
     */
    async reset(): Promise<void> {
        const settings = vscode.workspace.getConfiguration('ahkAlpha');
        for (const key of Object.keys(DEFAULTS) as (keyof AlphaConfig)[]) {
            await settings.update(key, undefined, vscode.ConfigurationTarget.Global);
        }
        this.config = { ...DEFAULTS };
        this.changeEmitter.fire(this.config);
    }

    /**
     * Export configuration as JSON
     */
    exportConfig(): string {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    async importConfig(json: string): Promise<void> {
        const imported = JSON.parse(json) as Partial<AlphaConfig>;
        for (const [key, value] of Object.entries(imported)) {
            if (key in DEFAULTS) {
                await this.set(key as keyof AlphaConfig, value);
            }
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.changeEmitter.dispose();
    }
}

/**
 * Singleton instance for shared use
 */
let defaultManager: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
    if (!defaultManager) {
        defaultManager = new ConfigManager();
    }
    return defaultManager;
}
