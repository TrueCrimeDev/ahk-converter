import * as vscode from 'vscode';

export class ImportsGuidePanel {
  private static currentPanel: ImportsGuidePanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel
  ) {
    this.panel = panel;

    this.panel.onDidDispose(() => this.dispose(), undefined, this.context.subscriptions);
    this.updateWebview();
  }

  public static show(context: vscode.ExtensionContext): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (ImportsGuidePanel.currentPanel) {
      ImportsGuidePanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'ahkImportsGuide',
      'AHK v2 Imports & Modules Guide',
      column ?? vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri]
      }
    );

    ImportsGuidePanel.currentPanel = new ImportsGuidePanel(context, panel);
  }

  private updateWebview(): void {
    this.panel.webview.html = this.getHtmlContent();
  }

  private dispose(): void {
    ImportsGuidePanel.currentPanel = undefined;
    this.panel.dispose();
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AHK v2 Imports & Modules Guide</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      padding: 24px;
      line-height: 1.6;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-textLink-foreground);
    }

    h2 {
      font-size: 22px;
      font-weight: 600;
      margin-top: 32px;
      margin-bottom: 16px;
      color: var(--vscode-textLink-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 12px;
      color: var(--vscode-textPreformat-foreground);
    }

    h4 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 16px;
      margin-bottom: 8px;
      color: var(--vscode-textPreformat-foreground);
    }

    p {
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }

    ul, ol {
      margin-left: 24px;
      margin-bottom: 16px;
    }

    li {
      margin-bottom: 8px;
    }

    code {
      font-family: 'Consolas', 'Courier New', monospace;
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }

    pre {
      background-color: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 16px;
      margin: 16px 0;
      overflow-x: auto;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
    }

    pre code {
      background-color: transparent;
      padding: 0;
      border-radius: 0;
      font-size: inherit;
    }

    .info-box {
      background-color: var(--vscode-textBlockQuote-background);
      border-left: 4px solid var(--vscode-textLink-foreground);
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }

    .warning-box {
      background-color: var(--vscode-inputValidation-warningBackground);
      border-left: 4px solid var(--vscode-inputValidation-warningBorder);
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }

    .example-box {
      background-color: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }

    .badge {
      display: inline-block;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }

    .nav-toc {
      background-color: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 16px;
      margin: 24px 0;
    }

    .nav-toc h3 {
      margin-top: 0;
      margin-bottom: 12px;
    }

    .nav-toc ul {
      margin-left: 16px;
      margin-bottom: 0;
    }

    .nav-toc li {
      margin-bottom: 4px;
    }

    .nav-toc a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }

    .nav-toc a:hover {
      text-decoration: underline;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }

    th, td {
      border: 1px solid var(--vscode-panel-border);
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: var(--vscode-editorWidget-background);
      font-weight: 600;
    }

    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AHK v2 Imports & Modules Guide</h1>
    <p>Complete guide to the module system and import utilities in AutoHotkey v2</p>

    <div class="nav-toc">
      <h3>Table of Contents</h3>
      <ul>
        <li><a href="#toolbox-imports">Toolbox Import System</a></li>
        <li><a href="#ahk-modules">Official AHK v2 Modules</a></li>
        <li><a href="#utility-libraries">Utility Libraries (Array, String, Utils, Validate)</a></li>
        <li><a href="#examples">Practical Examples</a></li>
      </ul>
    </div>

    <h2 id="toolbox-imports">Toolbox Import System</h2>

    <div class="info-box">
      <strong>Custom Import System:</strong> The AHK v2 Toolbox provides a comprehensive import management system with IntelliSense, auto-completion, diagnostics, and quick actions for organizing your code.
    </div>

    <h3>Features</h3>
    <ul>
      <li><strong>Symbol Index:</strong> Workspace-wide indexing of all exports and imports</li>
      <li><strong>Module Resolution:</strong> Automatic path resolution for <code>#Include &lt;LibraryName&gt;</code></li>
      <li><strong>Import Completion:</strong> IntelliSense for available symbols and modules</li>
      <li><strong>Quick Actions:</strong> Code actions for adding imports and organizing them</li>
      <li><strong>User Library Support:</strong> Indexes libraries from AHK v2 Lib paths</li>
    </ul>

    <h3>Standard Library Paths</h3>
    <p>The toolbox searches for libraries in this order:</p>
    <ol>
      <li><strong>Local Script Library</strong> (highest priority): <code>%A_ScriptDir%\\Lib\\</code></li>
      <li><strong>User Library:</strong> <code>%A_MyDocuments%\\AutoHotkey\\Lib\\</code></li>
      <li><strong>System Library:</strong> <code>%A_AhkPath%\\..\\Lib\\</code> (AutoHotkey installation)</li>
      <li><strong>Workspace Folders:</strong> Any folders in your VS Code workspace</li>
    </ol>

    <div class="example-box">
      <h4>Example: Using Standard Library</h4>
      <pre><code class="language-cpp">; File: Lib/Array.ahk
class Array {
    static Join(array, separator := ", ") {
        ; Implementation
    }
}

; File: MyScript.ahk
#Include &lt;Array&gt;

myArray := [1, 2, 3, 4, 5]
result := Array.Join(myArray, ", ")
MsgBox(result)  ; "1, 2, 3, 4, 5"</code></pre>
    </div>

    <h3>Commands</h3>
    <ul>
      <li><code>AHK Development: Show Module Search Paths</code> - View all configured search paths</li>
      <li><code>AHK Development: Reindex Workspace</code> - Refresh the symbol index</li>
      <li><code>AHK Development: Include User Library</code> - Browse and include libraries</li>
      <li><code>AHK Development: Add Import</code> - Interactively add import statements</li>
    </ul>

    <h2 id="ahk-modules">Official AHK v2 Modules <span class="badge">v2.1-alpha.11+</span></h2>

    <div class="info-box">
      <strong>Native Feature:</strong> AutoHotkey v2.1-alpha.11 introduced native module support with <code>#Module</code> directive and <code>import</code>/<code>export</code> statements.
    </div>

    <h3>What is a Module?</h3>
    <p>A module is a script within a script. Each module has its own:</p>
    <ul>
      <li><strong>Global namespace</strong> for variables, functions, and classes</li>
      <li><strong>Body</strong> (auto-execute section)</li>
      <li><strong>Exports</strong> that can be imported by other modules</li>
      <li><strong>Unique name</strong> used for imports</li>
    </ul>

    <h3>Key Concepts</h3>

    <h4>Default Module (__Main)</h4>
    <p>All code is added to the <code>__Main</code> module by default. You can create new modules with <code>#Module</code>.</p>

    <h4>Module Isolation</h4>
    <p>Each module has its own global variables - variables in one module don't affect another unless explicitly imported/exported.</p>

    <h4>Built-in AHK Module</h4>
    <p>All modules implicitly import from the built-in "AHK" module containing built-in functions. You can shadow these by declaring your own, then access originals via <code>AHK.FunctionName()</code>.</p>

    <h3>Syntax</h3>

    <h4>Creating a Module</h4>
    <pre><code class="language-cpp">#Module ModuleName

; Module code here
MyVar := "value"

export MyFunction() {
    return MyVar
}</code></pre>

    <h4>Importing a Module</h4>
    <pre><code class="language-cpp">; Import entire module
import ModuleName

; Import specific exports
import {FunctionName, ClassName} from ModuleName

; Import with alias
import {Calculate as CalculateX} from X

; Import all exports
import * from ModuleName

; Import module without adding to namespace
import "ModuleName"</code></pre>

    <h4>Exporting Symbols</h4>
    <pre><code class="language-cpp">export MyFunction() {
    ; Function implementation
}

export class MyClass {
    ; Class implementation
}

export MyVariable := "value"

; Default export
export default BuildLabel(text) {
    return Map("title", text)
}</code></pre>

    <h3>Module Search Path <span class="badge">v2.1-alpha.17+</span></h3>

    <p>Modules are searched from the <code>AhkImportPath</code> environment variable, or defaults to:</p>
    <pre><code class="language-cpp">.;%A_MyDocuments%\\AutoHotkey;%A_AhkPath%\\..</code></pre>

    <p>Files are considered in this order:</p>
    <ol>
      <li><code>ModuleName</code> (exact file name)</li>
      <li><code>ModuleName\\__Init.ahk</code> (folder with init file)</li>
      <li><code>ModuleName.ahk</code> (with .ahk extension)</li>
    </ol>

    <h3>Execution Order</h3>
    <p>Modules execute at startup in this order:</p>
    <ol>
      <li>Most recently-defined module executes first</li>
      <li>For each module, imported modules execute before the importing module</li>
      <li>Main module (<code>__Main</code>) typically executes last</li>
    </ol>

    <div class="warning-box">
      <strong>Cyclic Imports:</strong> If modules have circular dependencies, execution order may not be ideal. Avoid importing <code>__Main</code> from other modules when possible.
    </div>

    <h2 id="utility-libraries">Utility Libraries</h2>

    <p>The toolbox provides comprehensive utility libraries that fill AHK's missing functionality:</p>

    <h3>Array.ahk</h3>
    <p>Advanced array operations found in modern languages:</p>
    <ul>
      <li><code>Join(array, separator, lastSeparator?)</code> - Join array elements into string</li>
      <li><code>FlatMap(array, callback)</code> - Map and flatten results</li>
      <li><code>GroupBy(array, keySelector)</code> - Group elements by key function</li>
      <li><code>Partition(array, predicate)</code> - Split into passing/failing arrays</li>
      <li><code>Zip(arrays*)</code> - Combine multiple arrays element-wise</li>
      <li><code>Chunk(array, size)</code> - Split into chunks</li>
      <li><code>UniqueBy(array, keySelector?)</code> - Remove duplicates</li>
      <li><code>Difference(array1, array2)</code> - Elements in array1 but not array2</li>
      <li><code>Intersection(arrays*)</code> - Elements present in all arrays</li>
      <li><code>Union(arrays*)</code> - All unique elements from all arrays</li>
    </ul>

    <div class="example-box">
      <h4>Example: Array.Join</h4>
      <pre><code class="language-cpp">#Include &lt;Array&gt;

numbers := [1, 2, 3]
result := Array.Join(numbers, ", ")
MsgBox(result)  ; "1, 2, 3"

; With custom last separator
items := ["apples", "oranges", "bananas"]
result := Array.Join(items, ", ", " and ")
MsgBox(result)  ; "apples, oranges, and bananas"</code></pre>
    </div>

    <h3>String.ahk</h3>
    <p>Advanced string manipulation:</p>
    <ul>
      <li><code>Template(template, values*)</code> - Simple template strings</li>
      <li><code>PadStart(str, length, padString?)</code> - Pad at start</li>
      <li><code>PadEnd(str, length, padString?)</code> - Pad at end</li>
      <li><code>Truncate(str, length, suffix?)</code> - Truncate with suffix</li>
      <li><code>ToTitleCase(str)</code> - Convert to Title Case</li>
      <li><code>ToSnakeCase(str)</code> - Convert to snake_case</li>
      <li><code>ToCamelCase(str)</code> - Convert to camelCase</li>
      <li><code>WordWrap(str, width)</code> - Word wrap text</li>
    </ul>

    <h3>Utils.ahk</h3>
    <p>Functional programming utilities:</p>
    <ul>
      <li><code>Compose(functions*)</code> - Compose functions right-to-left</li>
      <li><code>Pipe(functions*)</code> - Pipe functions left-to-right</li>
      <li><code>Memoize(func)</code> - Cache function results</li>
      <li><code>Debounce(func, delay)</code> - Debounce function calls</li>
      <li><code>Throttle(func, limit)</code> - Throttle function calls</li>
      <li><code>Once(func)</code> - Call function only once</li>
      <li><code>Partial(func, boundArgs*)</code> - Partial application</li>
    </ul>

    <h3>Validate.ahk</h3>
    <p>Common validation patterns:</p>
    <ul>
      <li><code>IsEmail(str)</code> - Validate email address</li>
      <li><code>IsURL(str)</code> - Validate URL</li>
      <li><code>IsPhoneNumber(str, format?)</code> - Validate phone numbers</li>
      <li><code>IsIPAddress(str)</code> - Validate IPv4 address</li>
      <li><code>IsInRange(value, min, max)</code> - Check if value in range</li>
      <li><code>Matches(str, pattern)</code> - Check if string matches pattern</li>
      <li><code>IsCreditCard(str)</code> - Validate credit card (Luhn algorithm)</li>
    </ul>

    <h3>Master Include (All.ahk)</h3>
    <p>Include all utilities at once:</p>
    <pre><code class="language-cpp">#Include &lt;All&gt;

; Now all utilities are available
result := Array.Join([1, 2, 3], ", ")
formatted := String.Template("Hello {0}!", "World")
valid := Validate.IsEmail("test@example.com")</code></pre>

    <h2 id="examples">Practical Examples</h2>

    <h3>Example 1: Module Isolation</h3>
    <div class="example-box">
      <pre><code class="language-cpp">; Each module has its own global variables
import Other

MyVar := 1
ShowVar()        ; Our MyVar is 1
Other.ShowVar()  ; Other MyVar is 2

ShowVar() => MsgBox("Main MyVar = " MyVar)

#Module Other
MyVar := 2
export ShowVar() => MsgBox("Other MyVar = " MyVar)</code></pre>
    </div>

    <h3>Example 2: Alias Conflicts</h3>
    <div class="example-box">
      <pre><code class="language-cpp">; Use alias to resolve name conflicts
import {Calculate as CalculateX} from X
import * from Y

MsgBox Calculate()   ; Uses local Calculate (1)
MsgBox CalculateX()  ; Uses X.Calculate (2)

Calculate() => 1

#Module X
export Calculate() => 2

#Module Y
export Calculate() => 3</code></pre>
    </div>

    <h3>Example 3: Shadowing Built-ins</h3>
    <div class="example-box">
      <pre><code class="language-cpp">; Override built-in functions, access originals via AHK module
import AHK

MsgBox "Hello, world!",, "T2"

; Add Info icon by default to all MsgBox calls
MsgBox(Text?, Title?, Options:="") {
    return AHK.MsgBox(Text?, Title?, "Iconi " Options)
}

#Module Other
; Other module still has original MsgBox
MsgBox "Other has the original.",, "T2"</code></pre>
    </div>

    <h3>Example 4: Using Utility Libraries</h3>
    <div class="example-box">
      <pre><code class="language-cpp">#Include &lt;Array&gt;
#Include &lt;String&gt;
#Include &lt;Validate&gt;

; Process form data
ProcessForm(data) {
    ; Validate email
    if !Validate.IsEmail(data.email)
        throw ValueError("Invalid email address")

    ; Join tags
    tags := Array.Join(data.tags, ", ")

    ; Format name
    name := String.ToTitleCase(data.name)

    return Map(
        "email", data.email,
        "name", name,
        "tags", tags
    )
}</code></pre>
    </div>

    <h3>Example 5: StringHelpers Module</h3>
    <div class="example-box">
      <pre><code class="language-cpp">#Requires AutoHotkey v2.1
#SingleInstance Force

; Example using the StringHelpers module
#Module StringHelpers

export TitleCase(text) {
    words := StrSplit(text, ' ')
    for index, word in words {
        words[index] := word.Length
            ? StrUpper(SubStr(word, 1, 1)) . StrLower(SubStr(word, 2))
            : ''
    }
    result := ''
    for index, word in words {
        result .= (index > 1 ? ' ' : '') . word
    }
    return result
}

export Slugify(text) {
    cleaned := RegExReplace(text, '[^\w\s-]', '')
    cleaned := RegExReplace(cleaned, '\s+', '-')
    return StrLower(Trim(cleaned, '-'))
}

export default BuildLabel(text) {
    return Map(
        'title', TitleCase(text),
        'slug', Slugify(text)
    )
}</code></pre>
    </div>

    <div class="footer">
      <p>For more information, see the <strong>Module_ImportSystem.md</strong> documentation.</p>
      <p>AutoHotkey v2 documentation: <a href="https://www.autohotkey.com">www.autohotkey.com</a></p>
    </div>
  </div>
</body>
</html>`;
  }
}
