import * as vscode from 'vscode';
import { ModuleResolver } from './moduleResolver';
import { ImportParser, ExportStatement, ImportStatement } from './importParser';

/**
 * Information about a module and its exports
 */
export interface ModuleInfo {
  /** URI of the module file */
  uri: vscode.Uri;
  /** Module name */
  name: string;
  /** List of exported symbols */
  exports: ExportStatement[];
  /** List of imports (to track dependencies) */
  imports: ImportStatement[];
  /** Whether this module has been indexed */
  indexed: boolean;
  /** Last modification time */
  lastModified: number;
}

/**
 * Information about a symbol available in the workspace
 */
export interface SymbolInfo {
  /** Symbol name */
  name: string;
  /** Module that exports this symbol */
  moduleName: string;
  /** Module URI */
  moduleUri: vscode.Uri;
  /** Symbol type */
  type: 'function' | 'class' | 'variable';
  /** Location of the symbol definition */
  location: vscode.Location;
}

/**
 * Workspace-wide symbol index for tracking module exports and imports
 */
export class SymbolIndex {
  private static instance: SymbolIndex;
  private modules: Map<string, ModuleInfo> = new Map();
  private symbolsByModule: Map<string, SymbolInfo[]> = new Map();
  private symbolsByName: Map<string, SymbolInfo[]> = new Map();
  /** Track wildcard imports per document: document URI -> module names */
  private wildcardImportsByDocument: Map<string, string[]> = new Map();
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private indexingInProgress = false;

  private constructor() {
    this.initializeWatcher();
  }

  public static getInstance(): SymbolIndex {
    if (!SymbolIndex.instance) {
      SymbolIndex.instance = new SymbolIndex();
    }
    return SymbolIndex.instance;
  }

  /**
   * Initialize file system watcher to track changes
   */
  private initializeWatcher(): void {
    // Watch all .ahk files in workspace
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.ahk');

    this.fileWatcher.onDidCreate(uri => this.indexFile(uri));
    this.fileWatcher.onDidChange(uri => this.indexFile(uri));
    this.fileWatcher.onDidDelete(uri => this.removeFile(uri));
  }

  /**
   * Index all files in the workspace
   */
  public async indexWorkspace(): Promise<void> {
    if (this.indexingInProgress) return;

    this.indexingInProgress = true;
    this.modules.clear();
    this.symbolsByModule.clear();
    this.symbolsByName.clear();
    this.wildcardImportsByDocument.clear();

    const files = await vscode.workspace.findFiles('**/*.ahk', '**/node_modules/**');

    const indexPromises = files.map(uri => this.indexFile(uri));
    await Promise.all(indexPromises);

    this.indexingInProgress = false;
  }

  /**
   * Index a single file
   */
  public async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const resolver = ModuleResolver.getInstance();

      // Check if this is a module
      const isModule = await resolver.isModule(document);
      if (!isModule) {
        // Still index non-module files for potential exports
        // They might be included with #Include
      }

      const moduleName = resolver.getModuleDirectiveName(document) ||
                        resolver.getModuleName(uri.fsPath);

      // Parse exports and imports
      const exports = ImportParser.parseExports(document);
      const imports = ImportParser.parseImports(document);

      const moduleInfo: ModuleInfo = {
        uri,
        name: moduleName,
        exports,
        imports,
        indexed: true,
        lastModified: Date.now()
      };

      this.modules.set(uri.fsPath, moduleInfo);

      // Index symbols
      this.indexSymbols(moduleInfo);

      // Track wildcard imports for this document
      this.indexWildcardImports(uri, imports);
    } catch (error) {
      console.error(`Failed to index file ${uri.fsPath}:`, error);
    }
  }

  /**
   * Index wildcard imports for a document
   */
  private indexWildcardImports(uri: vscode.Uri, imports: ImportStatement[]): void {
    const wildcardModules: string[] = [];

    for (const importStmt of imports) {
      if (importStmt.isWildcard) {
        wildcardModules.push(importStmt.moduleName);
      }
    }

    if (wildcardModules.length > 0) {
      this.wildcardImportsByDocument.set(uri.fsPath, wildcardModules);
    } else {
      this.wildcardImportsByDocument.delete(uri.fsPath);
    }
  }

  /**
   * Index symbols from a module
   */
  private indexSymbols(moduleInfo: ModuleInfo): void {
    const symbols: SymbolInfo[] = [];

    for (const exportStmt of moduleInfo.exports) {
      const symbol: SymbolInfo = {
        name: exportStmt.symbolName,
        moduleName: moduleInfo.name,
        moduleUri: moduleInfo.uri,
        type: exportStmt.symbolType as 'function' | 'class' | 'variable',
        location: new vscode.Location(moduleInfo.uri, exportStmt.range)
      };

      symbols.push(symbol);

      // Add to name-based index
      if (!this.symbolsByName.has(symbol.name)) {
        this.symbolsByName.set(symbol.name, []);
      }
      this.symbolsByName.get(symbol.name)!.push(symbol);
    }

    this.symbolsByModule.set(moduleInfo.name, symbols);
  }

  /**
   * Remove a file from the index
   */
  private removeFile(uri: vscode.Uri): void {
    const moduleInfo = this.modules.get(uri.fsPath);
    if (!moduleInfo) return;

    // Remove symbols
    this.symbolsByModule.delete(moduleInfo.name);

    for (const exportStmt of moduleInfo.exports) {
      const symbols = this.symbolsByName.get(exportStmt.symbolName);
      if (symbols) {
        const filtered = symbols.filter(s => s.moduleUri.fsPath !== uri.fsPath);
        if (filtered.length > 0) {
          this.symbolsByName.set(exportStmt.symbolName, filtered);
        } else {
          this.symbolsByName.delete(exportStmt.symbolName);
        }
      }
    }

    this.modules.delete(uri.fsPath);
  }

  /**
   * Get all exports from a module
   */
  public getModuleExports(moduleName: string): SymbolInfo[] {
    return this.symbolsByModule.get(moduleName) || [];
  }

  /**
   * Get all symbols with a specific name
   */
  public getSymbolsByName(name: string): SymbolInfo[] {
    return this.symbolsByName.get(name) || [];
  }

  /**
   * Get module info by name
   */
  public getModuleByName(moduleName: string): ModuleInfo | undefined {
    for (const module of this.modules.values()) {
      if (module.name === moduleName) {
        return module;
      }
    }
    return undefined;
  }

  /**
   * Get module info by URI
   */
  public getModuleByUri(uri: vscode.Uri): ModuleInfo | undefined {
    return this.modules.get(uri.fsPath);
  }

  /**
   * Check if a symbol is exported by a module
   */
  public isSymbolExportedBy(symbolName: string, moduleName: string): boolean {
    const exports = this.getModuleExports(moduleName);
    return exports.some(s => s.name === symbolName);
  }

  /**
   * Find which module exports a symbol
   */
  public findModuleExportingSymbol(symbolName: string): string[] {
    const modules: string[] = [];

    for (const [moduleName, symbols] of this.symbolsByModule.entries()) {
      if (symbols.some(s => s.name === symbolName)) {
        modules.push(moduleName);
      }
    }

    return modules;
  }

  /**
   * Get all available modules
   */
  public getAllModules(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get all available symbol names
   */
  public getAllSymbolNames(): string[] {
    return Array.from(this.symbolsByName.keys()).sort();
  }

  /**
   * Remove a file from the index (exposed for external watchers)
   */
  public removeFileFromIndex(uri: vscode.Uri): void {
    this.removeFile(uri);
  }

  /**
   * Get all symbols available via wildcard imports for a document
   */
  public getWildcardImportedSymbols(uri: vscode.Uri): SymbolInfo[] {
    const wildcardModules = this.wildcardImportsByDocument.get(uri.fsPath);
    if (!wildcardModules || wildcardModules.length === 0) {
      return [];
    }

    const symbols: SymbolInfo[] = [];
    for (const moduleName of wildcardModules) {
      const moduleSymbols = this.getModuleExports(moduleName);
      symbols.push(...moduleSymbols);
    }

    return symbols;
  }

  /**
   * Check if a symbol is available via wildcard import in a document
   */
  public isSymbolFromWildcardImport(uri: vscode.Uri, symbolName: string): boolean {
    const wildcardSymbols = this.getWildcardImportedSymbols(uri);
    return wildcardSymbols.some(s => s.name === symbolName);
  }

  /**
   * Get the module that provides a symbol via wildcard import
   */
  public getWildcardImportSourceModule(uri: vscode.Uri, symbolName: string): string | undefined {
    const wildcardModules = this.wildcardImportsByDocument.get(uri.fsPath);
    if (!wildcardModules) return undefined;

    for (const moduleName of wildcardModules) {
      if (this.isSymbolExportedBy(symbolName, moduleName)) {
        return moduleName;
      }
    }

    return undefined;
  }

  /**
   * Detect circular dependencies
   */
  public detectCircularDependencies(startModule: string): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (moduleName: string) => {
      if (path.includes(moduleName)) {
        // Found a cycle
        const cycleStart = path.indexOf(moduleName);
        cycles.push([...path.slice(cycleStart), moduleName]);
        return;
      }

      if (visited.has(moduleName)) return;

      visited.add(moduleName);
      path.push(moduleName);

      const module = this.getModuleByName(moduleName);
      if (module) {
        for (const importStmt of module.imports) {
          dfs(importStmt.moduleName);
        }
      }

      path.pop();
    };

    dfs(startModule);
    return cycles;
  }

  /**
   * Get unused imports in a document
   */
  public async getUnusedImports(document: vscode.TextDocument): Promise<ImportStatement[]> {
    const imports = ImportParser.parseImports(document);
    const text = document.getText();
    const unused: ImportStatement[] = [];

    for (const importStmt of imports) {
      // For wildcard imports, harder to detect if used
      if (importStmt.isWildcard) continue;

      // For default imports, check if module name is used
      if (importStmt.type === 'default') {
        const moduleNameRegex = new RegExp(`\\b${importStmt.moduleName}\\\.`, 'g');
        if (!moduleNameRegex.test(text)) {
          unused.push(importStmt);
        }
        continue;
      }

      // For named imports, check each symbol
      if (importStmt.type === 'named') {
        let allUnused = true;
        for (const symbol of importStmt.symbols) {
          const symbolName = symbol.alias || symbol.name;
          const symbolRegex = new RegExp(`\\b${symbolName}\\b`, 'g');

          // Count occurrences (should be more than 1 - the import itself)
          const matches = text.match(symbolRegex);
          if (matches && matches.length > 1) {
            allUnused = false;
            break;
          }
        }

        if (allUnused) {
          unused.push(importStmt);
        }
      }
    }

    return unused;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }
  }
}
