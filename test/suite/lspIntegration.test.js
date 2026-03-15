"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const lspIntegration_1 = require("../../dist/src/lspIntegration");
suite('LSP Integration Test Suite', () => {
    test('LSP Integration should be singleton', () => {
        const instance1 = lspIntegration_1.AHKLSPIntegration.getInstance();
        const instance2 = lspIntegration_1.AHKLSPIntegration.getInstance();
        assert.strictEqual(instance1, instance2);
    });
    test('Should detect LSP extension availability', async () => {
        const lsp = lspIntegration_1.AHKLSPIntegration.getInstance();
        const isAvailable = await lsp.isLSPAvailable();
        const lspExtension = vscode.extensions.getExtension('thqby.vscode-autohotkey2-lsp');
        if (lspExtension) {
            assert.strictEqual(isAvailable, true, 'LSP should be available when extension is installed');
        }
        else {
            assert.strictEqual(isAvailable, false, 'LSP should not be available when extension is missing');
        }
    });
    test('Should return empty array when LSP unavailable', async () => {
        const lsp = lspIntegration_1.AHKLSPIntegration.getInstance();
        const isAvailable = await lsp.isLSPAvailable();
        if (!isAvailable) {
            const doc = await vscode.workspace.openTextDocument({
                content: 'SimpleFunction() { return 1 }',
                language: 'ahk2'
            });
            const symbols = await lsp.getDocumentSymbols(doc);
            assert.strictEqual(symbols.length, 0, 'Should return empty array when LSP unavailable');
        }
    });
    test('Should get document symbols when LSP available', async () => {
        const lsp = lspIntegration_1.AHKLSPIntegration.getInstance();
        const isAvailable = await lsp.isLSPAvailable();
        if (isAvailable) {
            const doc = await vscode.workspace.openTextDocument({
                content: `MyFunction(param) {
  return param
}

MyClass {
  Method() {
    return 1
  }
}`,
                language: 'ahk2'
            });
            const symbols = await lsp.getDocumentSymbols(doc);
            assert.ok(symbols.length > 0, 'Should return symbols when LSP is available');
            const functionSymbol = symbols.find(s => s.name === 'MyFunction');
            const classSymbol = symbols.find(s => s.name === 'MyClass');
            if (functionSymbol) {
                assert.strictEqual(functionSymbol.kind, vscode.SymbolKind.Function);
            }
            if (classSymbol) {
                assert.strictEqual(classSymbol.kind, vscode.SymbolKind.Class);
            }
        }
    });
    test('Should handle errors gracefully', async () => {
        const lsp = lspIntegration_1.AHKLSPIntegration.getInstance();
        const invalidDoc = {
            uri: vscode.Uri.file('/nonexistent/file.ahk'),
            getText: () => '',
            languageId: 'ahk2'
        };
        const symbols = await lsp.getDocumentSymbols(invalidDoc);
        assert.ok(Array.isArray(symbols));
    });
});
//# sourceMappingURL=lspIntegration.test.js.map
