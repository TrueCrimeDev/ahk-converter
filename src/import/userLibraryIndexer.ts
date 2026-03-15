import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { SymbolIndex, SymbolInfo } from './symbolIndex';
import { ModuleResolver } from './moduleResolver';

export interface UserLibraryEntry {
  moduleName: string;
  filePath: string;
  exports: SymbolInfo[];
}

/**
 * Indexes user-level AutoHotkey libraries (e.g., %USERPROFILE%/AutoHotkey/v2/Lib)
 * so they are available for includes, imports, and IntelliSense.
 */
export class UserLibraryIndexer {
  private readonly symbolIndex: SymbolIndex;
  private readonly moduleResolver: ModuleResolver;
  private watchers: vscode.FileSystemWatcher[] = [];
  private libraryEntries: Map<string, UserLibraryEntry> = new Map();
  private libraryRoots: string[] = [];
  private initialized = false;

  constructor(symbolIndex: SymbolIndex) {
    this.symbolIndex = symbolIndex;
    this.moduleResolver = ModuleResolver.getInstance();
  }

  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.reindex();
    this.registerWatchers(context);
    this.initialized = true;
  }

  public async reindex(): Promise<void> {
    this.libraryEntries.clear();
    this.libraryRoots = this.resolveLibraryRoots();

    for (const root of this.libraryRoots) {
      const files = await this.collectAhkFiles(root);
      for (const filePath of files) {
        await this.indexLibraryFile(filePath);
      }
    }
  }

  public getLibraries(): UserLibraryEntry[] {
    return Array.from(this.libraryEntries.values()).sort((a, b) =>
      a.moduleName.localeCompare(b.moduleName)
    );
  }

  public dispose(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    this.libraryEntries.clear();
  }

  private async indexLibraryFile(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      await this.symbolIndex.indexFile(uri);
      const moduleName = this.moduleResolver.getModuleName(filePath);
      const exports = this.symbolIndex.getModuleExports(moduleName);
      this.libraryEntries.set(filePath, { moduleName, filePath, exports });
    } catch (error) {
      console.warn(`Failed to index user library ${filePath}:`, error);
    }
  }

  private registerWatchers(context: vscode.ExtensionContext): void {
    for (const root of this.libraryRoots) {
      if (!fs.existsSync(root)) {
        continue;
      }

      const pattern = new vscode.RelativePattern(vscode.Uri.file(root), '**/*.ahk');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidCreate(async (uri) => {
        await this.indexLibraryFile(uri.fsPath);
      });

      watcher.onDidChange(async (uri) => {
        await this.indexLibraryFile(uri.fsPath);
      });

      watcher.onDidDelete(async (uri) => {
        this.libraryEntries.delete(uri.fsPath);
        this.symbolIndex.removeFileFromIndex(uri);
      });

      this.watchers.push(watcher);
      context.subscriptions.push(watcher);
    }
  }

  private resolveLibraryRoots(): string[] {
    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
    const configured = config.get<string[]>('userLibraryPaths', []);
    const roots = (configured.length > 0 ? configured : this.getDefaultRoots())
      .map(p => this.expandPath(p))
      .filter(p => !!p && fs.existsSync(p));

    const unique = Array.from(new Set(roots));
    return unique;
  }

  private getDefaultRoots(): string[] {
    const home = os.homedir();
    return [
      path.join(home, 'AutoHotkey', 'v2', 'Lib'),
      path.join(home, 'AutoHotkey', 'Lib'),
      path.join(home, 'Documents', 'AutoHotkey', 'v2', 'Lib'),
      path.join(home, 'Documents', 'AutoHotkey', 'Lib')
    ];
  }

  private expandPath(input: string): string {
    if (!input) {
      return input;
    }

    let expanded = input.trim();
    expanded = expanded.replace(/^~(?=$|[\\/])/, os.homedir());
    expanded = expanded.replace(/\${home}/gi, os.homedir());
    expanded = expanded.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');

    if (!path.isAbsolute(expanded)) {
      expanded = path.join(os.homedir(), expanded);
    }

    return path.normalize(expanded);
  }

  private async collectAhkFiles(root: string): Promise<string[]> {
    const files: string[] = [];

    const traverse = async (dir: string) => {
      try {
        const dirEntries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of dirEntries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await traverse(entryPath);
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.ahk')) {
            files.push(entryPath);
          }
        }
      } catch (error) {
        // Ignore permission errors or missing directories
        console.debug(`Unable to read directory ${dir}:`, error);
      }
    };

    if (fs.existsSync(root)) {
      await traverse(root);
    }

    return files;
  }
}
