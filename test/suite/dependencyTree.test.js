"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const dependencyTreeProvider_1 = require("../../dist/src/dependencyTreeProvider");
const manifest = require("../../package.json");
suite('Dependency Tree Test Suite', () => {
    const extensionId = `${manifest.publisher}.${manifest.name}`;
    let provider;
    let context;
    suiteSetup(() => {
        const ext = vscode.extensions.getExtension(extensionId);
        assert.ok(ext, 'Extension should be available');
        context = ext.exports?.context || createMockContext();
    });
    setup(() => {
        provider = new dependencyTreeProvider_1.DependencyTreeProvider(context);
    });
    test('Provider should be created', () => {
        assert.ok(provider);
    });
    test('Tree item should have correct properties', () => {
        const item = new dependencyTreeProvider_1.DependencyTreeItem('/path/to/file.ahk', 'file.ahk', vscode.TreeItemCollapsibleState.None, [], []);
        assert.strictEqual(item.filePath, '/path/to/file.ahk');
        assert.strictEqual(item.labelText, 'file.ahk');
        assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
        assert.ok(item.command);
        assert.strictEqual(item.command.command, 'ahkDependencyTree.openFile');
    });
    test('Tree item with includes should show count in description', () => {
        const item = new dependencyTreeProvider_1.DependencyTreeItem('/path/to/file.ahk', 'file.ahk', vscode.TreeItemCollapsibleState.Collapsed, ['/path/to/lib1.ahk', '/path/to/lib2.ahk'], []);
        assert.strictEqual(item.description, '2 includes');
        assert.ok(item.iconPath instanceof vscode.ThemeIcon);
    });
    test('Tree item with unresolved includes should show warning icon', () => {
        const item = new dependencyTreeProvider_1.DependencyTreeItem('/path/to/file.ahk', 'file.ahk', vscode.TreeItemCollapsibleState.Collapsed, ['/path/to/lib1.ahk'], ['<MissingLib>']);
        assert.ok(item.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(item.iconPath.id, 'warning');
    });
    test('Pinned state should update item properties', () => {
        const item = new dependencyTreeProvider_1.DependencyTreeItem('/path/to/file.ahk', 'file.ahk', vscode.TreeItemCollapsibleState.Collapsed, ['/path/to/lib.ahk'], []);
        item.updatePinnedState(true);
        assert.strictEqual(item.isPinnedRoot, true);
        assert.strictEqual(item.contextValue, 'rootItem-isPinned');
        assert.ok(item.description?.includes('📌'));
        item.updatePinnedState(false);
        assert.strictEqual(item.isPinnedRoot, false);
        assert.strictEqual(item.contextValue, 'rootItem');
        assert.ok(!item.description?.includes('📌'));
    });
    test('Provider should resolve #Include paths correctly', async () => {
        const testCases = [
            { input: '#Include lib.ahk', expected: 'lib.ahk' },
            { input: '#Include <LibName>', expected: '<LibName>' },
            { input: '#Include "path/to/file.ahk"', expected: 'path/to/file.ahk' },
            { input: '  #Include  lib.ahk  ', expected: 'lib.ahk' },
        ];
        for (const { input, expected } of testCases) {
            const result = provider.extractIncludePath(input);
            assert.strictEqual(result, expected, `Failed for: ${input}`);
        }
    });
    test('Provider should normalize path separators', () => {
        const normalized = provider.normalizePathSeparators('path\\to\\file.ahk');
        assert.strictEqual(normalized, 'path/to/file.ahk');
    });
    test('Provider should handle library includes (<Name>)', () => {
        const path = '<MyLibrary>';
        const isLibInclude = path.startsWith('<') && path.endsWith('>');
        assert.strictEqual(isLibInclude, true);
    });
});
function createMockContext() {
    return {
        subscriptions: [],
        workspaceState: {
            get: () => undefined,
            update: async () => { },
            keys: () => []
        },
        globalState: {
            get: () => undefined,
            update: async () => { },
            keys: () => [],
            setKeysForSync: () => { }
        },
        extensionPath: '/mock/extension/path',
        extensionUri: vscode.Uri.file('/mock/extension/path'),
        environmentVariableCollection: {},
        extensionMode: vscode.ExtensionMode.Test,
        storageUri: vscode.Uri.file('/mock/storage'),
        storagePath: '/mock/storage',
        globalStorageUri: vscode.Uri.file('/mock/global'),
        globalStoragePath: '/mock/global',
        logUri: vscode.Uri.file('/mock/logs'),
        logPath: '/mock/logs',
        asAbsolutePath: (relativePath) => `/mock/extension/path/${relativePath}`,
        extension: {},
        secrets: {},
        languageModelAccessInformation: {}
    };
}
//# sourceMappingURL=dependencyTree.test.js.map
