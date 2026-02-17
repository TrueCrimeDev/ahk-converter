"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const packageSearchService_1 = require("../../dist/src/packageSearchService");
const arisPackageInstaller_1 = require("../../dist/src/arisPackageInstaller");
suite('Aris Package Manager Compatibility Suite', () => {
    let searchService;
    let searchServiceAny;
    let originalGetArisIndexPackages;
    let originalSearchGitHub;
    setup(() => {
        searchService = packageSearchService_1.PackageSearchService.getInstance();
        searchService.clearCache();
        searchServiceAny = searchService;
        originalGetArisIndexPackages = searchServiceAny.getArisIndexPackages;
        originalSearchGitHub = searchServiceAny.searchGitHub;
        searchServiceAny.getArisIndexPackages = async () => [];
        searchServiceAny.searchGitHub = async () => [];
    });
    teardown(() => {
        searchServiceAny.getArisIndexPackages = originalGetArisIndexPackages;
        searchServiceAny.searchGitHub = originalSearchGitHub;
        searchService.clearCache();
    });
    test('Parses github shorthand with version range', async () => {
        const results = await searchService.searchPackages('thqby/JSON@^1.2.0', undefined, 5);
        assert.strictEqual(results.length, 1);
        const result = results[0];
        assert.strictEqual(result.sourceType, 'github');
        assert.strictEqual(result.source?.type, 'github');
        assert.strictEqual(result.source?.repository, 'thqby/JSON');
        assert.strictEqual(result.source?.version, '^1.2.0');
        assert.strictEqual(result.installSpec, 'thqby/JSON@^1.2.0');
    });
    test('Parses github shorthand with branch', async () => {
        const results = await searchService.searchPackages('thqby/JSON/main', undefined, 5);
        assert.strictEqual(results.length, 1);
        const result = results[0];
        assert.strictEqual(result.sourceType, 'github');
        assert.strictEqual(result.source?.type, 'github');
        assert.strictEqual(result.source?.repository, 'thqby/JSON');
        assert.strictEqual(result.source?.branch, 'main');
        assert.strictEqual(result.source?.version, 'latest');
    });
    test('Parses gist spec with explicit file', async () => {
        const spec = 'gist:7cce378c9dfdaf733cb3ca6df345b140/GetUrl.ahk';
        const results = await searchService.searchPackages(spec, undefined, 5);
        assert.strictEqual(results.length, 1);
        const result = results[0];
        assert.strictEqual(result.sourceType, 'gist');
        assert.strictEqual(result.source?.type, 'gist');
        assert.strictEqual(result.source?.gistId, '7cce378c9dfdaf733cb3ca6df345b140');
        assert.strictEqual(result.source?.gistFile, 'GetUrl.ahk');
    });
    test('Parses forums spec with codebox', async () => {
        const results = await searchService.searchPackages('forums:t=12345&codebox=2', undefined, 5);
        assert.strictEqual(results.length, 1);
        const result = results[0];
        assert.strictEqual(result.sourceType, 'forums');
        assert.strictEqual(result.source?.type, 'forums');
        assert.strictEqual(result.source?.threadId, '12345');
        assert.strictEqual(result.source?.codeBox, 2);
        assert.ok((result.source?.url || '').includes('viewtopic.php?t=12345'));
    });
    test('Parses archive URL source', async () => {
        const results = await searchService.searchPackages('https://example.com/my-lib.zip', undefined, 5);
        assert.strictEqual(results.length, 1);
        const result = results[0];
        assert.strictEqual(result.sourceType, 'archive');
        assert.strictEqual(result.source?.type, 'archive');
        assert.strictEqual(result.source?.url, 'https://example.com/my-lib.zip');
    });
    test('Resolves Author/Name from index and carries source metadata', async () => {
        searchServiceAny.getArisIndexPackages = async () => [
            {
                packageName: 'thqby/JSON',
                author: 'thqby',
                name: 'JSON',
                description: 'JSON parser',
                main: 'JSON.ahk',
                files: ['JSON.ahk'],
                keywords: ['json'],
                repository: {
                    type: 'github',
                    url: 'thqby/ahk2_lib'
                }
            }
        ];
        const results = await searchService.searchPackages('thqby/JSON/main@2.0.0', undefined, 5);
        assert.strictEqual(results.length, 1);
        const result = results[0];
        assert.strictEqual(result.sourceType, 'index');
        assert.strictEqual(result.source?.type, 'github');
        assert.strictEqual(result.source?.repository, 'thqby/ahk2_lib');
        assert.strictEqual(result.source?.branch, 'main');
        assert.strictEqual(result.source?.version, '2.0.0');
        assert.strictEqual(result.source?.fromIndex, true);
    });
});
suite('Aris Package Installer Helpers Suite', () => {
    let installerAny;
    setup(() => {
        installerAny = new arisPackageInstaller_1.ArisPackageInstaller();
    });
    test('Matches highest release for a semver range', () => {
        const releases = [
            { tag_name: 'v1.0.0', zipball_url: 'https://example.com/v1.zip' },
            { tag_name: 'v1.5.1', zipball_url: 'https://example.com/v151.zip' },
            { tag_name: 'v2.0.0', zipball_url: 'https://example.com/v2.zip' }
        ];
        const match = installerAny.findMatchingRelease(releases, '^1.0.0');
        assert.ok(match);
        assert.strictEqual(match.tag_name, 'v1.5.1');
    });
    test('Treats commit hash version as direct GitHub ref', async () => {
        const source = {
            type: 'github',
            spec: 'thqby/JSON@abc1234',
            repository: 'thqby/JSON',
            version: 'abc1234'
        };
        const resolution = await installerAny.resolveGitHubRef('thqby', 'JSON', source);
        assert.strictEqual(resolution.ref, 'abc1234');
        assert.strictEqual(resolution.versionLabel, 'abc1234');
    });
    test('Decodes forum HTML entities and line breaks', () => {
        const decoded = installerAny.decodeHtmlEntities('a&amp;b<br>c&#x41;&#66;');
        assert.strictEqual(decoded, 'a&b\ncAB');
    });
    test('Selects preferred AHK file from extracted archive paths', () => {
        const files = [
            'C:\\temp\\pkg\\README.ahk',
            'C:\\temp\\pkg\\Lib\\JSON.ahk'
        ];
        const selected = installerAny.selectPreferredAhkFile(files, ['Lib/JSON.ahk'], 'JSON');
        const normalized = selected.replace(/\\/g, '/');
        assert.ok(normalized.endsWith('/Lib/JSON.ahk'));
    });
});
