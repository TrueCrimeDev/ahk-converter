"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const manifest = require("../../package.json");
suite('Extension Test Suite', () => {
    const extensionId = `${manifest.publisher}.${manifest.name}`;
    vscode.window.showInformationMessage('Start all tests.');
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension(extensionId));
    });
    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension(extensionId);
        assert.ok(ext);
        await ext.activate();
        assert.strictEqual(ext.isActive, true);
    });
    test('All commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const extensionCommands = [
            'ahkv2Toolbox.open',
            'ahk.convertV1toV2',
            'ahk.convertV1toV2.replace',
            'ahk.convertV1toV2.diff',
            'ahk.convertV1toV2.batch',
            'ahk.extractFunctionMetadata',
            'codeMap.refresh',
            'ahkDependencyTree.refresh',
            'ahkPackageManager.refresh',
        ];
        for (const cmd of extensionCommands) {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });
    test('Configuration defaults should be correct', () => {
        const config = vscode.workspace.getConfiguration('ahkConverter');
        assert.strictEqual(config.get('strictWindowsOnly'), true);
        assert.strictEqual(config.get('defaultOutputNaming'), 'suffix');
        assert.strictEqual(config.get('enableEnhancedDiff'), true);
        assert.strictEqual(config.get('showConversionStats'), true);
        assert.strictEqual(config.get('validationLevel'), 'normal');
    });
    test('TreeView providers should be registered', async () => {
        const ext = vscode.extensions.getExtension(extensionId);
        await ext?.activate();
        const packageJSON = ext?.packageJSON;
        assert.ok(packageJSON?.contributes?.views?.['ahkv2-toolbox']);
        const views = packageJSON.contributes.views['ahkv2-toolbox'];
        const viewIds = views.map((v) => v.id);
        assert.ok(viewIds.includes('ahkv2Toolbox'));
        assert.ok(viewIds.includes('codeMap'));
        assert.ok(viewIds.includes('ahkDependencyTree'));
        assert.ok(viewIds.includes('ahkPackageManager'));
    });
});
//# sourceMappingURL=extension.test.js.map
