import * as vscode from 'vscode';

/**
 * Provides hover information for library metadata diagnostics
 */
export class MetadataHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const metadataDiagnostic = diagnostics.find(diag =>
      diag.source === 'ahkv2-library-metadata' && diag.range.contains(position)
    );

    if (!metadataDiagnostic) {
      return;
    }

    const hoverMarkdown = new vscode.MarkdownString(undefined, true);
    hoverMarkdown.isTrusted = true;

    const openSettingsLink = this.buildCommandLink(
      'workbench.action.openSettings',
      ['ahkv2Toolbox.libraryAttribution.autoValidate'],
      'Open setting to disable validation'
    );

    hoverMarkdown.appendMarkdown('$(info) **Library Metadata Validation**\n\n');
    hoverMarkdown.appendMarkdown(
      'This file lives inside a `Lib` folder, so the toolbox validates its metadata automatically.\n\n'
    );
    hoverMarkdown.appendMarkdown(
      `${openSettingsLink} or add this file to the exclusion list via the quick fix menu if you want to silence the warning.`
    );

    return new vscode.Hover(hoverMarkdown, metadataDiagnostic.range);
  }

  private buildCommandLink(command: string, args: unknown[], label: string): string {
    const encodedArgs = encodeURIComponent(JSON.stringify(args));
    return `[${label}](command:${command}?${encodedArgs})`;
  }
}
