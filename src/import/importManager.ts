import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SymbolIndex, SymbolInfo } from './symbolIndex';
import { ModuleResolver } from './moduleResolver';
import { ImportCompletionProvider } from './completionProvider';
import { ImportHoverProvider } from './hoverProvider';
import { ImportDiagnosticProvider } from './diagnosticProvider';
import { ImportCodeActionProvider } from './codeActionProvider';
import {
  ImportDefinitionProvider,
  ImportReferenceProvider,
  ImportPeekDefinitionProvider
} from './definitionProvider';
import { UserLibraryIndexer, UserLibraryEntry } from './userLibraryIndexer';
import { insertIncludeLine } from '../includeLineInserter';

/**
 * Main manager for the import library feature
 * Coordinates all import-related functionality
 */
export class ImportManager {
  private static instance: ImportManager;
  private symbolIndex: SymbolIndex;
  private moduleResolver: ModuleResolver;
  private diagnosticProvider: ImportDiagnosticProvider;
  private userLibraryIndexer: UserLibraryIndexer;
  private subscriptions: vscode.Disposable[] = [];
  private isInitialized = false;

  private constructor() {
    this.symbolIndex = SymbolIndex.getInstance();
    this.moduleResolver = ModuleResolver.getInstance();
    this.diagnosticProvider = new ImportDiagnosticProvider(
      this.symbolIndex,
      this.moduleResolver
    );
    this.userLibraryIndexer = new UserLibraryIndexer(this.symbolIndex);
  }

  public static getInstance(): ImportManager {
    if (!ImportManager.instance) {
      ImportManager.instance = new ImportManager();
    }
    return ImportManager.instance;
  }

  /**
   * Initialize the import manager and register all providers
   */
  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing AHK Import Manager...');

    // Index workspace on startup
    await this.symbolIndex.indexWorkspace();

    // Register all providers
    this.registerProviders(context);

    await this.userLibraryIndexer.initialize(context);

    // Register commands
    this.registerCommands(context);

    // Set up document listeners
    this.setupDocumentListeners();

    // Validate all open documents
    for (const document of vscode.workspace.textDocuments) {
      if (document.languageId === 'ahk' || document.languageId === 'ahk2') {
        await this.diagnosticProvider.validateDocument(document);
      }
    }

    this.isInitialized = true;
    console.log('AHK Import Manager initialized successfully');
  }

  /**
   * Register all language providers
   */
  private registerProviders(context: vscode.ExtensionContext): void {
    const ahkSelector: vscode.DocumentSelector = [
      { language: 'ahk', scheme: 'file' },
      { language: 'ahk2', scheme: 'file' }
    ];

    // Completion provider
    const completionProvider = new ImportCompletionProvider(
      this.symbolIndex,
      this.moduleResolver
    );

    this.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        ahkSelector,
        completionProvider,
        '{', ',', ' ', 'from'
      )
    );

    // Hover provider
    const hoverProvider = new ImportHoverProvider(
      this.symbolIndex,
      this.moduleResolver
    );

    this.subscriptions.push(
      vscode.languages.registerHoverProvider(ahkSelector, hoverProvider)
    );

    // Code action provider
    const codeActionProvider = new ImportCodeActionProvider(
      this.symbolIndex,
      this.moduleResolver
    );

    this.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        ahkSelector,
        codeActionProvider,
        {
          providedCodeActionKinds: ImportCodeActionProvider.providedCodeActionKinds
        }
      )
    );

    // Definition provider
    const definitionProvider = new ImportDefinitionProvider(
      this.symbolIndex,
      this.moduleResolver
    );

    this.subscriptions.push(
      vscode.languages.registerDefinitionProvider(ahkSelector, definitionProvider)
    );

    // Reference provider
    const referenceProvider = new ImportReferenceProvider(this.symbolIndex);

    this.subscriptions.push(
      vscode.languages.registerReferenceProvider(ahkSelector, referenceProvider)
    );

    // Peek definition provider
    const peekProvider = new ImportPeekDefinitionProvider(
      this.symbolIndex,
      this.moduleResolver
    );

    this.subscriptions.push(
      vscode.languages.registerDefinitionProvider(ahkSelector, peekProvider)
    );

    console.log('All import providers registered');
  }

  /**
   * Register commands
   */
  private registerCommands(context: vscode.ExtensionContext): void {
    // Organize imports command
    this.subscriptions.push(
      vscode.commands.registerCommand('ahk.organizeImports', async (uri?: vscode.Uri) => {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!targetUri) {
          return;
        }

        await this.organizeImports(targetUri);
      })
    );

    // Reindex workspace command
    this.subscriptions.push(
      vscode.commands.registerCommand('ahk.reindexWorkspace', async () => {
        await this.reindexWorkspace();
      })
    );

    // Show module exports command
    this.subscriptions.push(
      vscode.commands.registerCommand('ahk.showModuleExports', async () => {
        await this.showModuleExports();
      })
    );

    // Add import command
    this.subscriptions.push(
      vscode.commands.registerCommand('ahk.addImport', async () => {
        await this.addImport();
      })
    );

    // Include user library command
    this.subscriptions.push(
      vscode.commands.registerCommand('ahk.includeUserLibrary', async () => {
        await this.includeUserLibrary();
      })
    );

    // Show module search paths command (for debugging)
    this.subscriptions.push(
      vscode.commands.registerCommand('ahk.showModuleSearchPaths', async () => {
        await this.showModuleSearchPaths();
      })
    );

    console.log('Import commands registered');
  }

  /**
   * Setup document event listeners
   */
  private setupDocumentListeners(): void {
    // Validate document on open
    this.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (document.languageId === 'ahk' || document.languageId === 'ahk2') {
          await this.diagnosticProvider.validateDocument(document);
        }
      })
    );

    // Validate document on save
    this.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === 'ahk' || document.languageId === 'ahk2') {
          await this.symbolIndex.indexFile(document.uri);
          await this.diagnosticProvider.validateDocument(document);
        }
      })
    );

    // Validate document on change (debounced)
    let changeTimeout: NodeJS.Timeout;
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'ahk' || event.document.languageId === 'ahk2') {
          clearTimeout(changeTimeout);
          changeTimeout = setTimeout(async () => {
            await this.diagnosticProvider.validateDocument(event.document);
          }, 500);
        }
      })
    );

    // Clear diagnostics on close
    this.subscriptions.push(
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.diagnosticProvider.clearDiagnostics(document);
      })
    );
  }

  /**
   * Organize imports in a document
   */
  private async organizeImports(uri: vscode.Uri): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();

    // Get imports and sort them
    const imports = await import('./importParser').then(m => m.ImportParser.parseImports(document));

    if (imports.length === 0) {
      vscode.window.showInformationMessage('No imports to organize');
      return;
    }

    // Remove unused imports
    const unusedImports = await this.symbolIndex.getUnusedImports(document);
    const usedImports = imports.filter(
      imp => !unusedImports.some(unused => unused.line === imp.line)
    );

    // Sort by module name
    const sortedImports = usedImports.sort((a, b) =>
      a.moduleName.localeCompare(b.moduleName)
    );

    // Delete old import block
    const firstImport = imports[0];
    const lastImport = imports[imports.length - 1];
    const deleteRange = new vscode.Range(
      firstImport.line, 0,
      lastImport.line + 1, 0
    );
    edit.delete(uri, deleteRange);

    // Insert organized imports
    const importText = sortedImports.map(imp => imp.text).join('\n') + '\n';
    edit.insert(uri, new vscode.Position(firstImport.line, 0), importText);

    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage('Imports organized successfully');
  }

  /**
   * Reindex the entire workspace
   */
  private async reindexWorkspace(): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Reindexing AutoHotkey workspace...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // Refresh module resolver search paths and clear cache
        this.moduleResolver.refreshSearchPaths();

        // Reindex all files
        await this.symbolIndex.indexWorkspace();
        await this.userLibraryIndexer.reindex();

        progress.report({ increment: 100 });
        vscode.window.showInformationMessage('Workspace reindexed successfully');
      }
    );
  }

  /**
   * Show exports from a module
   */
  private async showModuleExports(): Promise<void> {
    // Get all modules
    const modules = this.symbolIndex.getAllModules();
    const moduleNames = modules.map(m => m.name).sort();

    if (moduleNames.length === 0) {
      vscode.window.showInformationMessage('No modules found in workspace');
      return;
    }

    // Let user select a module
    const selected = await vscode.window.showQuickPick(moduleNames, {
      placeHolder: 'Select a module to view its exports'
    });

    if (!selected) {
      return;
    }

    // Show exports
    const exports = this.symbolIndex.getModuleExports(selected);

    if (exports.length === 0) {
      vscode.window.showInformationMessage(`Module '${selected}' has no exports`);
      return;
    }

    const items = exports.map(exp => ({
      label: `$(symbol-${exp.type}) ${exp.name}`,
      description: exp.type,
      detail: exp.location.uri.fsPath
    }));

    const selectedExport = await vscode.window.showQuickPick(items, {
      placeHolder: `Exports from module '${selected}'`
    });

    if (selectedExport) {
      // Navigate to the selected export
      const exp = exports.find(e => e.name === selectedExport.label.split(' ')[1]);
      if (exp) {
        const document = await vscode.workspace.openTextDocument(exp.location.uri);
        await vscode.window.showTextDocument(document, {
          selection: exp.location.range
        });
      }
    }
  }

  /**
   * Add an import statement interactively
   */
  private async addImport(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Get all available symbols
    const allSymbols = this.symbolIndex.getAllSymbolNames();

    if (allSymbols.length === 0) {
      vscode.window.showInformationMessage('No symbols found in workspace');
      return;
    }

    // Let user select a symbol
    const selected = await vscode.window.showQuickPick(allSymbols, {
      placeHolder: 'Select a symbol to import'
    });

    if (!selected) {
      return;
    }

    // Find modules that export this symbol
    const modules = this.symbolIndex.findModuleExportingSymbol(selected);

    let moduleName: string;
    if (modules.length === 1) {
      moduleName = modules[0];
    } else {
      const selectedModule = await vscode.window.showQuickPick(modules, {
        placeHolder: `Select module to import '${selected}' from`
      });

      if (!selectedModule) {
        return;
      }

      moduleName = selectedModule;
    }

    // Insert import statement
    const importStatement = `import {${selected}} from ${moduleName}\n`;

    // Find insert position
    const { ImportParser } = await import('./importParser');
    const imports = ImportParser.parseImports(editor.document);

    let insertPosition: vscode.Position;
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      insertPosition = new vscode.Position(lastImport.line + 1, 0);
    } else {
      insertPosition = new vscode.Position(0, 0);
    }

    await editor.edit(editBuilder => {
      editBuilder.insert(insertPosition, importStatement);
    });

    vscode.window.showInformationMessage(
      `Added import: ${selected} from ${moduleName}`
    );
  }

  /**
   * Show current module search paths for debugging
   */
  private async showModuleSearchPaths(): Promise<void> {
    const searchPaths = this.moduleResolver.getSearchPaths();

    if (searchPaths.length === 0) {
      vscode.window.showInformationMessage('No module search paths configured');
      return;
    }

    const items = searchPaths.map((searchPath, index) => ({
      label: `${index + 1}. ${searchPath}`,
      description: fs.existsSync(searchPath) ? '✓ exists' : '✗ not found',
      detail: searchPath
    }));

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Module search paths (in order of priority)',
      canPickMany: false
    });
  }

  private async includeUserLibrary(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open an AutoHotkey file to insert #Include statements.');
      return;
    }

    const libraries = this.userLibraryIndexer.getLibraries();
    if (libraries.length === 0) {
      vscode.window.showWarningMessage('No user libraries were found. Configure ahkv2Toolbox.userLibraryPaths if needed.');
      return;
    }

    const items = libraries.map(lib => this.toQuickPickItem(lib));
    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a user library to #Include',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selection) {
      return;
    }

    const template = this.getUserIncludeTemplate();
    const includeFormat = this.applyIncludeTemplate(template, selection.library);
    const includeResult = await insertIncludeLine(editor.document, {
      packageName: selection.library.moduleName,
      includeFormat,
      autoInsertHeaders: true
    });

    if (includeResult.status === 'error') {
      vscode.window.showErrorMessage(`Failed to insert #Include: ${includeResult.message}`);
      return;
    }

    vscode.window.showInformationMessage(`Added #Include for ${selection.library.moduleName}.`);

    if (selection.library.exports.length === 0) {
      return;
    }

    const exportPick = await vscode.window.showQuickPick(
      selection.library.exports.map(symbol => ({
        label: symbol.name,
        description: symbol.type,
        symbol
      })),
      {
        placeHolder: 'Select exports to insert into the script (optional)',
        canPickMany: true
      }
    );

    if (!exportPick || exportPick.length === 0) {
      return;
    }

    const snippet = this.buildExportSnippet(
      selection.library.moduleName,
      exportPick.map(item => item.symbol),
      editor.document
    );

    await editor.edit(builder => {
      builder.insert(editor.selection.active, snippet);
    });
  }

  private toQuickPickItem(library: UserLibraryEntry): (vscode.QuickPickItem & { library: UserLibraryEntry }) {
    return {
      label: library.moduleName,
      description: this.toTildePath(library.filePath),
      detail: this.formatExportPreview(library),
      library
    };
  }

  private toTildePath(filePath: string): string {
    const relative = path.relative(os.homedir(), filePath);
    if (!relative.startsWith('..')) {
      return path.join('~', relative);
    }
    return filePath;
  }

  private formatExportPreview(entry: UserLibraryEntry): string {
    if (entry.exports.length === 0) {
      return 'No exports detected';
    }

    const names = entry.exports.map(exp => exp.name);
    const preview = names.slice(0, 3).join(', ');
    const suffix = names.length > 3 ? ` (+${names.length - 3} more)` : '';
    return `Exports: ${preview}${suffix}`;
  }

  private getUserIncludeTemplate(): string {
    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
    return config.get<string>('userLibraryIncludeFormat', '%A_AppData%/../../AutoHotkey/v2/Lib/{name}.ahk');
  }

  private applyIncludeTemplate(template: string, library: UserLibraryEntry): string {
    const normalizedPath = this.toPosixPath(library.filePath);
    return template.replace('{filePath}', normalizedPath);
  }

  private toPosixPath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  private buildExportSnippet(
    moduleName: string,
    symbols: SymbolInfo[],
    document: vscode.TextDocument
  ): string {
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const lines: string[] = ['', `; Exports from ${moduleName}`];

    for (const symbol of symbols) {
      if (symbol.type === 'class') {
        lines.push(`${symbol.name}Instance := ${symbol.name}()`);
      } else if (symbol.type === 'variable') {
        lines.push(`; Access ${symbol.name}`);
        lines.push(symbol.name);
      } else {
        lines.push(`${symbol.name}()`);
      }
    }

    lines.push('');
    return lines.join(eol);
  }

  /**
   * Get symbol index (for external use)
   */
  public getSymbolIndex(): SymbolIndex {
    return this.symbolIndex;
  }

  /**
   * Get module resolver (for external use)
   */
  public getModuleResolver(): ModuleResolver {
    return this.moduleResolver;
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }

    this.diagnosticProvider.dispose();
    this.symbolIndex.dispose();
    this.userLibraryIndexer.dispose();

    this.isInitialized = false;
    console.log('AHK Import Manager disposed');
  }
}
