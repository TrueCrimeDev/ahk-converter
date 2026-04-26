/**
 * DllCall Completion and Hover Provider
 *
 * Provides IntelliSense for common Win32 DllCall signatures.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface DllParam {
    name: string;
    type: string;
    desc: string;
}

interface DllSignature {
    params: DllParam[];
    return: string;
    desc: string;
}

type SignatureDb = Record<string, Record<string, DllSignature>>;
type SignatureIndexEntry = { dll: string; fn: string; sig: DllSignature };

const AHK_TYPES = [
    'Str', 'AStr', 'WStr',
    'Int', 'Int64', 'Short', 'Char',
    'UInt', 'UInt64', 'UShort', 'UChar',
    'Float', 'Double',
    'Ptr', 'UPtr',
];

let db: SignatureDb | undefined;

function loadDb(extensionPath: string): SignatureDb {
    if (db) { return db; }
    const distPath = path.join(extensionPath, 'dist', 'src', 'dllcall-signatures.json');
    const srcPath = path.join(extensionPath, 'src', 'dllcall-signatures.json');
    const jsonPath = fs.existsSync(distPath) ? distPath : srcPath;
    const raw = fs.readFileSync(jsonPath, 'utf8');
    db = JSON.parse(raw) as SignatureDb;
    return db;
}

function buildIndex(sigs: SignatureDb): Map<string, SignatureIndexEntry> {
    const index = new Map<string, SignatureIndexEntry>();
    for (const [dll, funcs] of Object.entries(sigs)) {
        for (const [fn, sig] of Object.entries(funcs)) {
            index.set(`${dll}\\${fn}`.toLowerCase(), { dll, fn, sig });
        }
    }
    return index;
}

function formatSignature(dll: string, fn: string, sig: DllSignature): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**${dll}\\\\${fn}**\n\n`);
    md.appendMarkdown(`${sig.desc}\n\n`);

    const params = sig.params.map(p => `"${p.type}", ${p.name}`).join(', ');
    const ret = sig.return === 'void' ? '' : `, "${sig.return}"`;
    md.appendCodeblock(`DllCall("${dll}\\${fn}"${params ? ', ' + params : ''}${ret})`, 'autohotkey');

    if (sig.params.length > 0) {
        md.appendMarkdown('\n\n| Type | Name | Description |\n|------|------|-------------|\n');
        for (const p of sig.params) {
            md.appendMarkdown(`| \`${p.type}\` | ${p.name} | ${p.desc} |\n`);
        }
    }
    md.appendMarkdown(`\n**Returns:** \`${sig.return}\``);
    return md;
}

function getDllCallContext(
    document: vscode.TextDocument,
    position: vscode.Position,
): { argIndex: number } | undefined {
    const textBefore = document.lineAt(position.line).text.substring(0, position.character);
    let fullText = textBefore;
    for (let i = position.line - 1; i >= Math.max(0, position.line - 5); i--) {
        fullText = `${document.lineAt(i).text}\n${fullText}`;
    }

    const match = fullText.match(/DllCall\s*\(([^)]*$)/i);
    if (!match) { return undefined; }

    let commaCount = 0;
    let inString = false;
    let stringChar = '';
    for (const ch of match[1]) {
        if (inString) {
            if (ch === stringChar) { inString = false; }
            continue;
        }
        if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch;
            continue;
        }
        if (ch === ',') { commaCount++; }
    }
    return { argIndex: commaCount };
}

export class DllCallCompletionProvider implements vscode.CompletionItemProvider {
    private index: Map<string, SignatureIndexEntry> | undefined;
    private sigs: SignatureDb | undefined;

    constructor(private readonly extensionPath: string) {}

    private ensureLoaded(): void {
        if (!this.sigs) {
            this.sigs = loadDb(this.extensionPath);
            this.index = buildIndex(this.sigs);
        }
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
        this.ensureLoaded();
        if (!this.index) { return undefined; }

        const ctx = getDllCallContext(document, position);
        if (!ctx) { return undefined; }
        if (ctx.argIndex === 0) { return this.functionCompletions(); }
        if (ctx.argIndex % 2 === 1) { return this.typeCompletions(); }
        return undefined;
    }

    private functionCompletions(): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        for (const entry of this.index!.values()) {
            const item = new vscode.CompletionItem(`${entry.dll}\\${entry.fn}`, vscode.CompletionItemKind.Function);
            item.detail = entry.sig.desc;
            item.documentation = formatSignature(entry.dll, entry.fn, entry.sig);
            const params = entry.sig.params.map((p, i) => `, "${p.type}", \${${i + 1}:${p.name}}`).join('');
            const ret = entry.sig.return === 'void' ? '' : `, "${entry.sig.return}"`;
            item.insertText = new vscode.SnippetString(`"${entry.dll}\\\\${entry.fn}"${params}${ret}`);
            item.sortText = `0-${entry.dll}-${entry.fn}`;
            items.push(item);
        }
        return items;
    }

    private typeCompletions(): vscode.CompletionItem[] {
        return AHK_TYPES.map(t => {
            const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
            item.detail = 'AHK DllCall type';
            item.insertText = `"${t}"`;
            item.sortText = `0-${t}`;
            return item;
        });
    }
}

export class DllCallHoverProvider implements vscode.HoverProvider {
    private index: Map<string, SignatureIndexEntry> | undefined;
    private sigs: SignatureDb | undefined;

    constructor(private readonly extensionPath: string) {}

    private ensureLoaded(): void {
        if (!this.sigs) {
            this.sigs = loadDb(this.extensionPath);
            this.index = buildIndex(this.sigs);
        }
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        this.ensureLoaded();
        if (!this.index) { return undefined; }

        const range = document.getWordRangeAtPosition(position, /"[^"]+"/);
        if (!range) { return undefined; }

        const word = document.getText(range).replace(/"/g, '');
        if (!word.includes('\\')) { return undefined; }

        const ctx = getDllCallContext(document, position);
        if (!ctx || ctx.argIndex !== 0) { return undefined; }

        const entry = this.index.get(word.toLowerCase());
        if (!entry) { return undefined; }

        return new vscode.Hover(formatSignature(entry.dll, entry.fn, entry.sig), range);
    }
}

export function registerDllCallProviders(context: vscode.ExtensionContext): vscode.Disposable {
    const selector: vscode.DocumentSelector = [
        { language: 'ahk2' },
        { language: 'ahk' },
        { pattern: '**/*.ahk' },
    ];

    const completion = vscode.languages.registerCompletionItemProvider(
        selector,
        new DllCallCompletionProvider(context.extensionPath),
        '"',
    );
    const hover = vscode.languages.registerHoverProvider(
        selector,
        new DllCallHoverProvider(context.extensionPath),
    );

    const disposable = vscode.Disposable.from(completion, hover);
    context.subscriptions.push(disposable);
    return disposable;
}
