import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = [
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, './fixtures/extensions/thqby.vscode-autohotkey2-lsp')
    ];
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu'
      ]
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
