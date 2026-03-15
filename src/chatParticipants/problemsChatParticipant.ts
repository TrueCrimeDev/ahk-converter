import * as vscode from 'vscode';
import { ConversionProfileManager } from '../conversionProfiles';

/**
 * VS Code Problems Chat Participant
 * Specializes in diagnosing and explaining VS Code diagnostics, errors, and warnings
 */
export class ProblemsChatParticipant {
  private static instance: ProblemsChatParticipant;
  private conversionProfileManager: ConversionProfileManager | undefined;

  private constructor() {
    // Don't instantiate ConversionProfileManager directly
  }

  public static getInstance(): ProblemsChatParticipant {
    if (!ProblemsChatParticipant.instance) {
      ProblemsChatParticipant.instance = new ProblemsChatParticipant();
    }
    return ProblemsChatParticipant.instance;
  }

  /**
   * Set references to extension services for context-aware assistance
   */
  public setServices(conversionProfileManager?: ConversionProfileManager) {
    this.conversionProfileManager = conversionProfileManager;
  }

  /**
   * Handle chat requests for problems and diagnostics
   */
  public async handleRequest(
    query: string,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      // Provide problem context and ask focused questions
      const problemContext = this.getProblemContext();

      if (problemContext) {
        stream.markdown(problemContext);
        stream.markdown('\n\nWhat specific problems would you like help with?\n');
        stream.markdown('**Available commands:**\n');
        stream.markdown('- "Explain errors" - Get detailed explanations of current errors\n');
        stream.markdown('- "Fix warnings" - Get suggestions for fixing warnings\n');
        stream.markdown('- "Analyze file" - Analyze problems in the current file\n');
        stream.markdown('- "Clear problems" - Instructions to clear all problems\n');
        return;
      }

      // Handle specific problem-related queries
      const lowerQuery = query.toLowerCase();

      if (lowerQuery.includes('error') || lowerQuery.includes('wrong') || lowerQuery.includes('broken')) {
        await this.explainErrors(stream);
      } else if (lowerQuery.includes('warning') || lowerQuery.includes('suggestion')) {
        await this.explainWarnings(stream);
      } else if (lowerQuery.includes('analyze') || lowerQuery.includes('diagnostic')) {
        await this.analyzeFileProblems(stream);
      } else if (lowerQuery.includes('clear') || lowerQuery.includes('remove')) {
        await this.clearProblems(stream);
      } else {
        stream.markdown('I specialize in helping with VS Code diagnostics and problems. Ask me about:\n');
        stream.markdown('- Current errors and warnings in your files\n');
        stream.markdown('- How to fix specific diagnostic messages\n');
        stream.markdown('- Code quality issues and suggestions\n');
        stream.markdown('- Analysis of diagnostic patterns\n');
      }

    } catch (error) {
      stream.markdown(`❌ **Error analyzing problems:** ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get diagnostics (problems) from the active document
   */
  private getProblemContext(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }

    const targetUri = editor.document.uri;
    // Get all diagnostics for this document
    const diagnostics = vscode.languages.getDiagnostics(targetUri);

    if (diagnostics.length === 0) {
      return '🎉 **No problems detected in current file!**\n\nYour code looks clean with no VS Code diagnostics.';
    }

    // Separate by severity
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
    const infos = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Information);

    let output = '**Problems detected in this file:**\n\n';

    if (errors.length > 0) {
      output += `❌ **Errors (${errors.length}):**\n`;
      errors.forEach((diag, idx) => {
        output += `${idx + 1}. Line ${diag.range.start.line + 1}: ${diag.message}\n`;
        if (diag.source) {
          output += `   Source: ${diag.source}\n`;
        }
      });
      output += '\n';
    }

    if (warnings.length > 0) {
      output += `⚠️ **Warnings (${warnings.length}):**\n`;
      warnings.forEach((diag, idx) => {
        output += `${idx + 1}. Line ${diag.range.start.line + 1}: ${diag.message}\n`;
        if (diag.source) {
          output += `   Source: ${diag.source}\n`;
        }
      });
      output += '\n';
    }

    if (infos.length > 0) {
      output += `ℹ️ **Info (${infos.length}):**\n`;
      infos.slice(0, 5).forEach((diag, idx) => {
        output += `${idx + 1}. Line ${diag.range.start.line + 1}: ${diag.message}\n`;
      });
      if (infos.length > 5) {
        output += `   ... and ${infos.length - 5} more\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Explain current errors in detail
   */
  private async explainErrors(stream: vscode.ChatResponseStream): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      stream.markdown('❌ Please open an AHK file to analyze errors.');
      return;
    }

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

    if (errors.length === 0) {
      stream.markdown('🎉 No errors found in the current file!');
      return;
    }

    stream.markdown(`**Error Analysis (${errors.length} error${errors.length > 1 ? 's' : ''}):**\n`);

    errors.forEach((error, idx) => {
      stream.markdown(`\n### ${idx + 1}. ${error.message}`);
      stream.markdown(`**Location:** Line ${error.range.start.line + 1}\n`);

      if (error.source) {
        stream.markdown(`**Source:** ${error.source}\n`);
      }

      // Provide contextual help based on error patterns
      const message = error.message.toLowerCase();
      let suggestion = '';

      if (message.includes('undefined') && message.includes('variable')) {
        suggestion = 'This variable is not defined. Check for typos or ensure the variable is declared before use.';
      } else if (message.includes('function') && message.includes('undefined')) {
        suggestion = 'This function is not defined. Check the function name spelling or ensure it\'s included from a library.';
      } else if (message.includes('syntax')) {
        suggestion = 'Check for missing quotes, parentheses, or semicolons. AutoHotkey v2 has strict syntax requirements.';
      } else {
        suggestion = 'Review the line for syntax errors, undefined variables, or missing includes.';
      }

      stream.markdown(`**💡 Suggestion:** ${suggestion}\n`);
    });
  }

  /**
   * Explain current warnings
   */
  private async explainWarnings(stream: vscode.ChatResponseStream): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      stream.markdown('❌ Please open an AHK file to analyze warnings.');
      return;
    }

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);

    if (warnings.length === 0) {
      stream.markdown('🎉 No warnings found in the current file!');
      return;
    }

    stream.markdown(`**Warning Analysis (${warnings.length} warning${warnings.length > 1 ? 's' : ''}):**\n`);

    warnings.forEach((warning, idx) => {
      stream.markdown(`\n### ${idx + 1}. ${warning.message}`);
      stream.markdown(`**Location:** Line ${warning.range.start.line + 1}\n`);

      // Provide contextual help for warnings
      const message = warning.message.toLowerCase();
      let suggestion = '';

      if (message.includes('deprecated')) {
        suggestion = 'This syntax is deprecated in AutoHotkey v2. Use the recommended alternative syntax.';
      } else if (message.includes('unused') && message.includes('variable')) {
        suggestion = 'This variable is declared but not used. Consider removing it or using it to avoid warnings.';
      } else if (message.includes('performance')) {
        suggestion = 'Consider optimizing this code for better performance.';
      } else {
        suggestion = 'Review this warning and consider following the suggested improvements.';
      }

      stream.markdown(`**💡 Suggestion:** ${suggestion}\n`);
    });
  }

  /**
   * Analyze problems in current file
   */
  private async analyzeFileProblems(stream: vscode.ChatResponseStream): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      stream.markdown('❌ Please open an AHK file to analyze.');
      return;
    }

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

    if (diagnostics.length === 0) {
      stream.markdown('🎉 **File Analysis Complete:** No problems detected!\n');
      stream.markdown('Your AHK code is clean and follows VS Code\'s diagnostic standards.');
      return;
    }

    stream.markdown(`**📊 File Problem Analysis:**\n`);
    stream.markdown(`- **Total Issues:** ${diagnostics.length}\n`);

    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
    const infos = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Information);

    stream.markdown(`- **Errors:** ${errors.length}\n`);
    stream.markdown(`- **Warnings:** ${warnings.length}\n`);
    stream.markdown(`- **Info:** ${infos.length}\n\n`);

    // Analyze patterns
    const sources = diagnostics.map(d => d.source).filter(Boolean);
    const sourceCounts = sources.reduce((acc, source) => {
      acc[source!] = (acc[source!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(sourceCounts).length > 0) {
      stream.markdown('**Problem Sources:**\n');
      Object.entries(sourceCounts).forEach(([source, count]) => {
        stream.markdown(`- ${source}: ${count} issue${count > 1 ? 's' : ''}\n`);
      });
      stream.markdown('\n');
    }

    stream.markdown('**🔧 Recommended Actions:**\n');
    if (errors.length > 0) {
      stream.markdown('1. **Fix errors first** - These prevent your script from working properly\n');
    }
    if (warnings.length > 0) {
      stream.markdown('2. **Address warnings** - These indicate potential issues or best practice violations\n');
    }
    if (infos.length > 0) {
      stream.markdown('3. **Review info messages** - These provide helpful suggestions\n');
    }
  }

  /**
   * Instructions for clearing problems
   */
  private async clearProblems(stream: vscode.ChatResponseStream): Promise<void> {
    stream.markdown('**🧹 How to Clear VS Code Problems:**\n\n');
    stream.markdown('**Option 1: Auto-fix (if available)**\n');
    stream.markdown('- Hover over a problem and click the lightbulb 💡 icon\n');
    stream.markdown('- Select "Quick Fix" to automatically resolve the issue\n\n');

    stream.markdown('**Option 2: Manual fixes**\n');
    stream.markdown('- Open the Problems panel (View → Problems)\n');
    stream.markdown('- Click on each problem to jump to its location\n');
    stream.markdown('- Fix the code manually\n\n');

    stream.markdown('**Option 3: Restart language services**\n');
    stream.markdown('- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)\n');
    stream.markdown('- Type "AutoHotkey v2: Restart Language Server"\n');
    stream.markdown('- Select the command to restart LSP services\n\n');

    stream.markdown('**Option 4: Clear all problems**\n');
    stream.markdown('- Open the Problems panel\n');
    stream.markdown('- Click the "Clear" button (trash icon)\n\n');

    stream.markdown('💡 **Tip:** Problems usually clear automatically when you fix the underlying issues in your code.');
  }

  /**
   * Register the chat participant
   */
  public static register(context: vscode.ExtensionContext): void {
    const participant = new ProblemsChatParticipant();

    const chatParticipant = vscode.chat.createChatParticipant('ahkv2-toolbox.problems-assistant', async (request, context, stream, token) => {
      await participant.handleRequest(request.prompt, context, stream, token);
    });
    chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'autohotkey2.svg');

    context.subscriptions.push(chatParticipant);
  }
}
