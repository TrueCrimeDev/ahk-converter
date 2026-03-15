"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const test_electron_1 = require("@vscode/test-electron");
async function main() {
    try {
        const extensionDevelopmentPath = [
            path.resolve(__dirname, '..'),
            path.resolve(__dirname, './fixtures/extensions/thqby.vscode-autohotkey2-lsp')
        ];
        const extensionTestsPath = path.resolve(__dirname, './suite/index');
        await (0, test_electron_1.runTests)({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions',
                '--disable-gpu'
            ]
        });
    }
    catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=runTest.js.map
