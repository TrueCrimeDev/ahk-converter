import * as vscode from 'vscode';

/**
 * Integration with thqby's vscode-autohotkey2-lsp extension
 * This allows us to use their proper lexer/parser instead of regex-based parsing
 */
export class AHKLSPIntegration {
  private static instance: AHKLSPIntegration;
  private lspExtension: vscode.Extension<any> | undefined;
  private isAvailable: boolean = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): AHKLSPIntegration {
    if (!AHKLSPIntegration.instance) {
      AHKLSPIntegration.instance = new AHKLSPIntegration();
    }
    return AHKLSPIntegration.instance;
  }

  private async initialize() {
    // Check if thqby's LSP extension is installed
    this.lspExtension = vscode.extensions.getExtension('thqby.vscode-autohotkey2-lsp');

    if (this.lspExtension) {
      if (!this.lspExtension.isActive) {
        try {
          await this.lspExtension.activate();
        } catch (error) {
          console.error('Failed to activate AHK LSP extension:', error);
          return;
        }
      }
      this.isAvailable = true;
      console.log('AHK LSP extension integration enabled');
    } else {
      console.warn('thqby AHK LSP extension not found - falling back to basic parsing');
    }
  }

  /**
   * Check if the LSP extension is available
   */
  public async isLSPAvailable(): Promise<boolean> {
    if (!this.lspExtension) {
      this.lspExtension = vscode.extensions.getExtension('thqby.vscode-autohotkey2-lsp');
    }

    if (this.lspExtension) {
      if (!this.lspExtension.isActive) {
        try {
          await this.lspExtension.activate();
          this.isAvailable = true;
        } catch {
          this.isAvailable = false;
        }
      } else {
        this.isAvailable = true;
      }
    }

    return this.isAvailable;
  }

  /**
   * Get document symbols from the LSP
   * This provides proper parsed structure of the document
   */
  public async getDocumentSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    if (!await this.isLSPAvailable()) {
      return [];
    }

    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );
      if (symbols && symbols.length > 0) {
        return symbols;
      }
    } catch (error) {
      console.error('Failed to get document symbols from LSP:', error);
    }

    // Fallback: lightweight parser for tests or when LSP returns nothing
    return this.basicSymbolExtraction(document);
  }

  /**
   * Get all functions from the document using LSP
   */
  public async getFunctions(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    const symbols = await this.getDocumentSymbols(document);
    return this.filterSymbolsByKind(symbols, [
      vscode.SymbolKind.Function,
      vscode.SymbolKind.Method
    ]);
  }

  /**
   * Get detailed information about a symbol at a specific position
   */
  public async getSymbolAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.DocumentSymbol | undefined> {
    const symbols = await this.getDocumentSymbols(document);
    return this.findSymbolAtPosition(symbols, position);
  }

  /**
   * Get hover information from LSP (includes type info, documentation, etc.)
   */
  public async getHoverInfo(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover[]> {
    if (!await this.isLSPAvailable()) {
      return [];
    }

    try {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        document.uri,
        position
      );
      return hovers || [];
    } catch (error) {
      console.error('Failed to get hover info from LSP:', error);
      return [];
    }
  }

  /**
   * Get completion items (useful for understanding available symbols)
   */
  public async getCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionList | undefined> {
    if (!await this.isLSPAvailable()) {
      return undefined;
    }

    try {
      const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        document.uri,
        position
      );
      return completions;
    } catch (error) {
      console.error('Failed to get completions from LSP:', error);
      return undefined;
    }
  }

  /**
   * Recursively filter symbols by kind
   */
  private filterSymbolsByKind(
    symbols: vscode.DocumentSymbol[],
    kinds: vscode.SymbolKind[]
  ): vscode.DocumentSymbol[] {
    const result: vscode.DocumentSymbol[] = [];

    for (const symbol of symbols) {
      if (kinds.includes(symbol.kind)) {
        result.push(symbol);
      }

      // Recursively check children
      if (symbol.children && symbol.children.length > 0) {
        result.push(...this.filterSymbolsByKind(symbol.children, kinds));
      }
    }

    return result;
  }

  /**
   * Find symbol at a specific position
   */
  private findSymbolAtPosition(
    symbols: vscode.DocumentSymbol[],
    position: vscode.Position
  ): vscode.DocumentSymbol | undefined {
    for (const symbol of symbols) {
      if (symbol.range.contains(position)) {
        // Check children first (more specific)
        if (symbol.children && symbol.children.length > 0) {
          const childSymbol = this.findSymbolAtPosition(symbol.children, position);
          if (childSymbol) {
            return childSymbol;
          }
        }
        return symbol;
      }
    }
    return undefined;
  }

  /**
   * Get all variables within a function
   */
  public async getFunctionVariables(
    document: vscode.TextDocument,
    functionSymbol: vscode.DocumentSymbol
  ): Promise<{ static: vscode.DocumentSymbol[]; local: vscode.DocumentSymbol[] }> {
    const staticVars: vscode.DocumentSymbol[] = [];
    const localVars: vscode.DocumentSymbol[] = [];

    if (!functionSymbol.children) {
      return { static: staticVars, local: localVars };
    }

    for (const child of functionSymbol.children) {
      if (child.kind === vscode.SymbolKind.Variable || child.kind === vscode.SymbolKind.Property) {
        // Check if it's static by examining the detail or name
        if (child.detail?.toLowerCase().includes('static')) {
          staticVars.push(child);
        } else {
          localVars.push(child);
        }
      }
    }

    return { static: staticVars, local: localVars };
  }

  /**
   * Get function parameters
   */
  public getFunctionParameters(functionSymbol: vscode.DocumentSymbol): vscode.DocumentSymbol[] {
    if (!functionSymbol.children) {
      return [];
    }

    return functionSymbol.children.filter(
      child => child.kind === vscode.SymbolKind.Variable &&
               child.range.isEqual(functionSymbol.selectionRange)
    );
  }

  /**
   * Show a warning if LSP extension is not installed
   */
  public async showLSPNotInstalledWarning(): Promise<void> {
    // Check if already installed
    if (await this.isLSPAvailable()) {
      vscode.window.showInformationMessage(
        'AutoHotkey v2 LSP extension is already installed and active!'
      );
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      'For the best experience with AHKv2 Toolbox, install the "AutoHotkey v2 Language Support" extension by thqby.\n\nThis provides:\n• Accurate parsing and AST generation\n• IntelliSense and code completion\n• Syntax highlighting and diagnostics\n• Go to definition and hover info',
      'Install Extension',
      'Open Extension Page',
      'Dismiss'
    );

    if (choice === 'Install Extension') {
      try {
        await vscode.commands.executeCommand(
          'workbench.extensions.installExtension',
          'thqby.vscode-autohotkey2-lsp'
        );

        const reload = await vscode.window.showInformationMessage(
          'AutoHotkey v2 LSP extension installed successfully! Please reload VS Code to activate it.',
          'Reload Now',
          'Later'
        );

        if (reload === 'Reload Now') {
          await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          'Failed to install extension automatically. Please install manually from the Extensions view.',
          'Open Extensions'
        ).then(choice => {
          if (choice === 'Open Extensions') {
            vscode.commands.executeCommand('workbench.extensions.search', 'thqby.vscode-autohotkey2-lsp');
          }
        });
      }
    } else if (choice === 'Open Extension Page') {
      await vscode.commands.executeCommand(
        'workbench.extensions.search',
        'thqby.vscode-autohotkey2-lsp'
      );
    }
  }

  /**
   * Fallback document symbol extraction using simple heuristics.
   * Provides basic symbols for tests when the full LSP is unavailable.
   */
  private basicSymbolExtraction(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    const lines = document.getText().split(/\r?\n/);

    const classPattern = /^\s*class\s+(\w+)/i;
    const functionPattern = /^\s*(\w+)\s*\(/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const classMatch = line.match(classPattern);
      if (classMatch) {
        const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length));
        const symbol = new vscode.DocumentSymbol(
          classMatch[1],
          '',
          vscode.SymbolKind.Class,
          range,
          range
        );
        symbols.push(symbol);
        continue;
      }

      const functionMatch = line.match(functionPattern);
      if (functionMatch) {
        const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length));
        const symbol = new vscode.DocumentSymbol(
          functionMatch[1],
          '',
          vscode.SymbolKind.Function,
          range,
          range
        );
        symbols.push(symbol);
      }
    }

    return symbols;
  }
}
