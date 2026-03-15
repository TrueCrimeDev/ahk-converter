"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const path = require("path");
const Mocha = require("mocha");
const glob_1 = require("glob");
async function run() {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000
    });
    const testsRoot = __dirname;
    try {
        const files = await (0, glob_1.glob)('**/*.test.js', { cwd: testsRoot });
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
        return new Promise((resolve, reject) => {
            try {
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }
    catch (err) {
        console.error(err);
        throw err;
    }
}
//# sourceMappingURL=index.js.map
