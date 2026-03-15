import * as vscode from 'vscode';
import { MetadataExtractor, LibraryMetadata } from './metadataExtractor';
import { LibraryAttributionParticipant } from './libraryAttributionParticipant';

/**
 * Diagnostic provider for library metadata validation
 * Automatically detects missing metadata fields and suggests attribution
 */
export class MetadataValidationProvider implements vscode.CodeActionProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private readonly enabled: boolean;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ahkv2-library-metadata');

    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
    this.enabled = config.get<boolean>('libraryAttribution.autoValidate', true);
  }

  /**
   * Provide code actions for missing metadata diagnostics
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const actions: vscode.CodeAction[] = [];

    // Check if there are metadata-related diagnostics in the range
    const metadataDiagnostics = context.diagnostics.filter(
      d => d.source === 'ahkv2-library-metadata'
    );

    if (metadataDiagnostics.length === 0) {
      return actions;
    }

    // Create quick fix action to discover metadata
    const discoverAction = new vscode.CodeAction(
      'Discover library metadata from GitHub',
      vscode.CodeActionKind.QuickFix
    );
    discoverAction.command = {
      title: 'Discover Library Metadata',
      command: 'ahkv2Toolbox.attributeLibrary',
      arguments: [vscode.Uri.file(document.fileName)]
    };
    discoverAction.diagnostics = metadataDiagnostics;
    discoverAction.isPreferred = true;
    actions.push(discoverAction);

    const chatAction = new vscode.CodeAction(
      'Generate metadata JSON with Copilot',
      vscode.CodeActionKind.QuickFix
    );
    chatAction.command = {
      title: 'Generate metadata JSON with Copilot',
      command: 'ahkv2Toolbox.generateMetadataJsonComment',
      arguments: [document.uri]
    };
    chatAction.diagnostics = metadataDiagnostics;
    actions.push(chatAction);

    // Create action to disable validation for this file
    const disableAction = new vscode.CodeAction(
      'Disable metadata validation for this file',
      vscode.CodeActionKind.QuickFix
    );
    disableAction.command = {
      title: 'Disable Metadata Validation',
      command: 'ahkv2Toolbox.disableMetadataValidation',
      arguments: [document.uri]
    };
    actions.push(disableAction);

    return actions;
  }

  /**
   * Validate a document and update diagnostics
   */
  public async validateDocument(document: vscode.TextDocument): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Only validate AHK files in Lib folders
    if (!this.isLibraryFile(document)) {
      this.diagnosticCollection.delete(document.uri);
      return;
    }

    try {
      const content = document.getText();
      const metadata = MetadataExtractor.extractFromFileContent(content);
      const missingFields = MetadataExtractor.getMissingFields(metadata);

      if (missingFields.length === 0) {
        // No missing fields, clear diagnostics
        this.diagnosticCollection.delete(document.uri);
        return;
      }

      // Create a diagnostic for missing metadata
      const diagnostic = this.createMissingMetadataDiagnostic(document, missingFields);
      this.diagnosticCollection.set(document.uri, [diagnostic]);
    } catch (error) {
      console.error('Error validating metadata:', error);
    }
  }

  /**
   * Create a diagnostic for missing metadata fields
   */
  private createMissingMetadataDiagnostic(
    document: vscode.TextDocument,
    missingFields: string[]
  ): vscode.Diagnostic {
    // Find the first non-empty line or position 0
    let range = new vscode.Range(0, 0, 0, 0);

    // Try to find existing JSDoc block
    const content = document.getText();
    const jsdocMatch = content.match(/^\/\*\*/m);
    if (jsdocMatch && jsdocMatch.index !== undefined) {
      const position = document.positionAt(jsdocMatch.index);
      range = new vscode.Range(position, position);
    }

    const message = `Missing library metadata fields: ${missingFields.map(f => `\`${f}\``).join(', ')}. ` +
                    `This appears because the file is inside a "Lib" folder. ` +
                    `Use "Discover Library Metadata" (Quick Fix) to auto-fill required fields.`;

    const diagnostic = new vscode.Diagnostic(
      range,
      message,
      vscode.DiagnosticSeverity.Information
    );
    diagnostic.source = 'ahkv2-library-metadata';
    diagnostic.code = 'missing-metadata';

    return diagnostic;
  }

  /**
   * Check if a document is a library file that should be validated
   */
  private isLibraryFile(document: vscode.TextDocument): boolean {
    // Check language
    if (document.languageId !== 'ahk' && document.languageId !== 'ahk2') {
      return false;
    }

    // Check if file is in a Lib folder
    const filePath = document.fileName;
    const normalizedPath = filePath.replace(/\\/g, '/');

    return normalizedPath.includes('/Lib/') || normalizedPath.includes('/lib/');
  }

  /**
   * Clear all diagnostics
   */
  public clear(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

/**
 * Register the metadata validation provider
 */
export function registerMetadataValidation(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const provider = new MetadataValidationProvider();

  // Register code action provider
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    ['ahk', 'ahk2'],
    provider,
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );

  // Validate on file open
  const onDidOpenDisposable = vscode.workspace.onDidOpenTextDocument(document => {
    provider.validateDocument(document);
  });

  // Validate on file save
  const onDidSaveDisposable = vscode.workspace.onDidSaveTextDocument(document => {
    provider.validateDocument(document);
  });

  // Validate on text change (debounced)
  let validationTimeout: NodeJS.Timeout | undefined;
  const onDidChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
    validationTimeout = setTimeout(() => {
      provider.validateDocument(event.document);
    }, 1000); // Debounce for 1 second
  });

  // Validate all open documents on activation
  vscode.workspace.textDocuments.forEach(document => {
    provider.validateDocument(document);
  });

  // Register command to disable validation for a file
  const disableValidationCommand = vscode.commands.registerCommand(
    'ahkv2Toolbox.disableMetadataValidation',
    async (uri: vscode.Uri) => {
      const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
      const excludedFiles = config.get<string[]>('libraryAttribution.excludeFiles', []);

      // Add this file to excluded list
      const relativePath = vscode.workspace.asRelativePath(uri);
      if (!excludedFiles.includes(relativePath)) {
        excludedFiles.push(relativePath);
        await config.update('libraryAttribution.excludeFiles', excludedFiles, vscode.ConfigurationTarget.Workspace);

        // Clear diagnostics for this file
        provider.validateDocument(await vscode.workspace.openTextDocument(uri));

        vscode.window.showInformationMessage(
          `Metadata validation disabled for ${relativePath}`
        );
      }
    }
  );

  // Register command to re-enable validation
  const enableValidationCommand = vscode.commands.registerCommand(
    'ahkv2Toolbox.enableMetadataValidation',
    async () => {
      const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
      await config.update('libraryAttribution.excludeFiles', [], vscode.ConfigurationTarget.Workspace);

      // Re-validate all open documents
      vscode.workspace.textDocuments.forEach(document => {
        provider.validateDocument(document);
      });

      vscode.window.showInformationMessage('Metadata validation re-enabled for all files');
    }
  );

  context.subscriptions.push(
    codeActionProvider,
    onDidOpenDisposable,
    onDidSaveDisposable,
    onDidChangeDisposable,
    disableValidationCommand,
    enableValidationCommand,
    provider
  );

  return {
    dispose: () => {
      provider.dispose();
    }
  };
}
