"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const functionAnalyzer_1 = require("../../dist/src/functionAnalyzer");
const functionMetadata_1 = require("../../dist/src/models/functionMetadata");
suite('Function Analyzer Test Suite', () => {
    test('Should parse simple function with no parameters', () => {
        const code = `SimpleFunction() {
  return "test"
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].name, 'SimpleFunction');
        assert.strictEqual(metadata[0].parameters.length, 0);
        assert.strictEqual(metadata[0].minParams, 0);
        assert.strictEqual(metadata[0].maxParams, 0);
    });
    test('Should parse function with basic parameters', () => {
        const code = `MyFunction(param1, param2) {
  return param1 + param2
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].name, 'MyFunction');
        assert.strictEqual(metadata[0].parameters.length, 2);
        assert.strictEqual(metadata[0].parameters[0].name, 'param1');
        assert.strictEqual(metadata[0].parameters[1].name, 'param2');
        assert.strictEqual(metadata[0].minParams, 2);
        assert.strictEqual(metadata[0].maxParams, 2);
    });
    test('Should detect ByRef parameters', () => {
        const code = `ModifyByRef(&param1, param2) {
  param1 := "modified"
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].parameters.length, 2);
        assert.strictEqual(metadata[0].parameters[0].isByRef, true);
        assert.strictEqual(metadata[0].parameters[1].isByRef, false);
    });
    test('Should detect optional parameters', () => {
        const code = `OptionalParams(required, optional?) {
  return required
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].parameters.length, 2);
        assert.strictEqual(metadata[0].parameters[0].isOptional, false);
        assert.strictEqual(metadata[0].parameters[1].isOptional, true);
        assert.strictEqual(metadata[0].minParams, 1);
    });
    test('Should detect parameters with default values', () => {
        const code = `WithDefaults(name, count := 5, text := "default") {
  return text
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].parameters.length, 3);
        assert.strictEqual(metadata[0].parameters[0].hasDefault, false);
        assert.strictEqual(metadata[0].parameters[1].hasDefault, true);
        assert.strictEqual(metadata[0].parameters[1].defaultValue, '5');
        assert.strictEqual(metadata[0].parameters[2].hasDefault, true);
        assert.strictEqual(metadata[0].parameters[2].defaultValue, '"default"');
        assert.strictEqual(metadata[0].minParams, 1);
    });
    test('Should classify default value types (constant vs expression)', () => {
        const code = `ComplexDefaults(str := "text", num := 42, expr := Random(1, 10), unsetVal := unset) {
  return str
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        const params = metadata[0].parameters;
        assert.strictEqual(params[0].defaultValueType, functionMetadata_1.DefaultValueType.Constant);
        assert.strictEqual(params[1].defaultValueType, functionMetadata_1.DefaultValueType.Constant);
        assert.strictEqual(params[2].defaultValueType, functionMetadata_1.DefaultValueType.Expression);
        assert.strictEqual(params[3].defaultValueType, functionMetadata_1.DefaultValueType.Constant);
    });
    test('Should detect variadic parameters', () => {
        const code = `VariadicFunc(required, params*) {
  return params.Length
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].isVariadic, true);
        assert.strictEqual(metadata[0].maxParams, 'variadic');
        assert.strictEqual(metadata[0].parameters[1].name, 'params*');
    });
    test('Should detect type hints', () => {
        const code = `TypedFunction(name: String, count: Integer) => String {
  return name
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].parameters[0].typeHint, 'String');
        assert.strictEqual(metadata[0].parameters[1].typeHint, 'Integer');
        assert.strictEqual(metadata[0].returnType, 'String');
    });
    test('Should detect static variables', () => {
        const code = `WithStatics() {
  static counter := 0
  static initialized, name := "test"
  counter++
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.ok(metadata[0].staticVariables);
        assert.strictEqual(metadata[0].staticVariables.length >= 2, true);
        const counter = metadata[0].staticVariables.find(v => v.name === 'counter');
        assert.ok(counter);
        assert.strictEqual(counter.scopeValue, functionMetadata_1.VariableScope.Static);
        assert.strictEqual(counter.hasInitializer, true);
    });
    test('Should detect local variables in assignment chains', () => {
        const code = `ChainAssignments() {
  a := b := c := 0
  x := "value"
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.ok(metadata[0].localVariables);
        assert.strictEqual(metadata[0].localVariables.length >= 3, true);
        const varNames = metadata[0].localVariables.map(v => v.name);
        assert.ok(varNames.includes('a'));
        assert.ok(varNames.includes('b'));
        assert.ok(varNames.includes('c'));
    });
    test('Should handle multiple functions in same file', () => {
        const code = `Function1(param1) {
  return param1
}

Function2(param2, param3) {
  return param2 + param3
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 2);
        assert.strictEqual(metadata[0].name, 'Function1');
        assert.strictEqual(metadata[1].name, 'Function2');
    });
    test('Should skip comments', () => {
        const code = `; This is a comment
/* Multi-line
   comment */
RealFunction(param) {
  ; Another comment
  return param
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 1);
        assert.strictEqual(metadata[0].name, 'RealFunction');
    });
    test('Should track function location', () => {
        const code = `FirstFunction() {
  return 1
}

SecondFunction() {
  return 2
}`;
        const doc = createMockDocument(code);
        const metadata = functionAnalyzer_1.FunctionAnalyzer.extractFunctionMetadata(doc);
        assert.strictEqual(metadata.length, 2);
        assert.strictEqual(metadata[0].location.startLine, 0);
        assert.ok(metadata[0].location.endLine > metadata[0].location.startLine);
        assert.strictEqual(metadata[1].location.startLine, 4);
    });
});
function createMockDocument(content) {
    return {
        getText: () => content,
        lineCount: content.split('\n').length,
        languageId: 'ahk2',
        uri: vscode.Uri.file('/test/mock.ahk'),
        fileName: '/test/mock.ahk',
        isUntitled: false,
        isDirty: false,
        isClosed: false,
        version: 1,
        eol: vscode.EndOfLine.LF,
        save: async () => true,
        lineAt: (line) => ({
            lineNumber: line,
            text: content.split('\n')[line],
            range: new vscode.Range(line, 0, line, 0),
            rangeIncludingLineBreak: new vscode.Range(line, 0, line, 0),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false
        }),
        offsetAt: () => 0,
        positionAt: () => new vscode.Position(0, 0),
        getWordRangeAtPosition: () => undefined,
        validateRange: (range) => range,
        validatePosition: (pos) => pos
    };
}
//# sourceMappingURL=functionAnalyzer.test.js.map
