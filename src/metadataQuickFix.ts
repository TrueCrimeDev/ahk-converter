import * as vscode from 'vscode';
import * as path from 'path';
import { MetadataExtractor, LibraryMetadata } from './metadataExtractor';

const REQUIRED_FIELDS: (keyof LibraryMetadata)[] = ['description', 'file', 'author', 'link', 'date', 'version'];

/**
 * Helper service that asks Copilot Chat to draft metadata JSON blocks
 */
class MetadataQuickFixService {
  private readonly marker = MetadataExtractor.JSON_METADATA_MARKER;

  public async run(uri?: vscode.Uri): Promise<void> {
    const document = await this.getDocument(uri);
    const metadata = MetadataExtractor.extractFromFileContent(document.getText());
    const missing = MetadataExtractor.getMissingFields(metadata);

    if (missing.length === 0) {
      vscode.window.showInformationMessage('All library metadata fields are already filled.');
      return;
    }

    await vscode.window.withProgress({
      title: 'Generating library metadata with Copilot',
      location: vscode.ProgressLocation.Notification,
      cancellable: false
    }, async () => {
      const generated = await this.generateMetadata(document, missing);
      if (!generated) {
        throw new Error('Copilot did not return metadata.');
      }

      const merged = this.mergeMetadata(metadata, generated, path.basename(document.fileName));
      await this.applyMetadataBlock(document, merged);
      vscode.window.showInformationMessage('Inserted ahkv2 metadata JSON block.');
    });
  }

  private async getDocument(uri?: vscode.Uri): Promise<vscode.TextDocument> {
    if (uri) {
      return vscode.workspace.openTextDocument(uri);
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('Open an AutoHotkey library file first.');
    }
    return editor.document;
  }

  private async generateMetadata(
    document: vscode.TextDocument,
    missing: (keyof LibraryMetadata)[]
  ): Promise<Partial<LibraryMetadata> | null> {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4' });
    if (models.length === 0) {
      throw new Error('No Copilot chat models available.');
    }

    const model = models[0];
    const fileName = path.basename(document.fileName);
    const fileSnippet = this.getFileSnippet(document.getText());

    const systemPrompt = [
      'You extract metadata for AutoHotkey v2 libraries.',
      'Return JSON ONLY, no markdown.',
      'Use keys: description, file, author, link, date, version.',
      'Infer values from the provided file snippet. If unknown, set "TODO" but keep key present.',
      'Format dates as YYYY/MM/DD when available.'
    ].join('\n');

    const userPrompt = [
      `File: ${fileName}`,
      `Missing fields: ${missing.join(', ')}`,
      'File excerpt:' ,
      '"""',
      fileSnippet,
      '"""'
    ].join('\n');

    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const response = await model.sendRequest([
      vscode.LanguageModelChatMessage.User(combinedPrompt)
    ], {});

    let output = '';
    for await (const fragment of response.text) {
      output += fragment;
    }

    return this.parseMetadataJson(output);
  }

  private getFileSnippet(content: string): string {
    const limit = 4000;
    if (content.length <= limit) {
      return content;
    }
    return content.slice(0, limit) + '\n...';
  }

  private parseMetadataJson(raw: string): Partial<LibraryMetadata> | null {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const cleaned: Partial<LibraryMetadata> = {};
      for (const key of REQUIRED_FIELDS) {
        const value = parsed[key];
        if (typeof value === 'string' && value.trim() !== '') {
          cleaned[key] = value.trim();
        }
      }
      return cleaned;
    } catch (error) {
      console.error('Failed to parse metadata JSON:', error, raw);
      return null;
    }
  }

  private mergeMetadata(
    existing: Partial<LibraryMetadata>,
    generated: Partial<LibraryMetadata>,
    fallbackFileName: string
  ): LibraryMetadata {
    const merged: LibraryMetadata = { ...generated } as LibraryMetadata;
    for (const key of REQUIRED_FIELDS) {
      const current = merged[key];
      if (!current || current.trim() === '') {
        const fallback = existing[key];
        if (fallback && fallback.trim() !== '') {
          merged[key] = fallback.trim();
        } else if (key === 'file' && !merged.file) {
          merged.file = existing.file || fallbackFileName;
        }
      }
    }

    // Ensure file name is present at minimum
    if (!merged.file || merged.file.trim() === '') {
      merged.file = fallbackFileName;
    }

    // Fill final TODOs for any remaining missing fields
    for (const key of REQUIRED_FIELDS) {
      if (!merged[key] || merged[key]!.trim() === '') {
        merged[key] = 'TODO';
      }
    }

    return merged;
  }

  private async applyMetadataBlock(
    document: vscode.TextDocument,
    metadata: LibraryMetadata
  ): Promise<void> {
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const block = this.buildMetadataBlock(metadata, eol);
    const fullText = document.getText();
    const existingRange = this.findExistingBlock(fullText, document);

    const edit = new vscode.WorkspaceEdit();
    if (existingRange) {
      edit.replace(document.uri, existingRange, block + eol);
    } else {
      const insertPos = this.getInsertPosition(document);
      edit.insert(document.uri, insertPos, block + eol + eol);
    }

    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      throw new Error('Failed to update metadata block.');
    }
  }

  private buildMetadataBlock(metadata: LibraryMetadata, eol: string): string {
    const json = JSON.stringify(metadata, null, 2);
    return [`/* ${this.marker}`, json, '*/'].join(eol);
  }

  private findExistingBlock(text: string, document: vscode.TextDocument): vscode.Range | null {
    const regex = new RegExp(`/\\*+\s*${this.marker}[\\s\\S]*?\\*+/`, 'i');
    const match = text.match(regex);
    if (!match || match.index === undefined) {
      return null;
    }

    const start = document.positionAt(match.index);
    const end = document.positionAt(match.index + match[0].length);
    return new vscode.Range(start, end);
  }

  private getInsertPosition(document: vscode.TextDocument): vscode.Position {
    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;
      if (i === 0 && lineText.startsWith('#!')) {
        continue;
      }
      if (lineText.trim() === '') {
        continue;
      }
      return new vscode.Position(i, 0);
    }
    return new vscode.Position(0, 0);
  }
}

/**
 * Register metadata quick fix command
 */
export function registerMetadataQuickFix(context: vscode.ExtensionContext): void {
  const service = new MetadataQuickFixService();
  const disposable = vscode.commands.registerCommand(
    'ahkv2Toolbox.generateMetadataJsonComment',
    async (uri?: vscode.Uri) => {
      try {
        await service.run(uri);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to generate metadata JSON: ${message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}
