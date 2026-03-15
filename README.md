

# AHKv2 Toolbox v0.4.3

Comprehensive AutoHotkey v2 development toolbox with v1→v2 conversion, function metadata, and productivity tools inside VS Code

## Features

### Language Support

Integrated LSP Parsing - Uses thqby’s AutoHotkey v2 LSP extension for accurate parsing

Code Map Explorer - Enhanced tree view with advanced features:

Shows all functions, classes, methods, and variables with proper static detection

Diagnostic integration: displays errors/warnings from Problems panel with badges

Color-coded icons (red for errors, yellow for warnings)

Enhanced tooltips showing diagnostic messages

Golden/orange color scheme for better function visibility

Enhanced Function Metadata Extraction - Advanced introspection system:

Parameter Analysis: Detects byref (&amp;), optional (?), variadic (*), and type hints

Default Value Classification: Distinguishes constants from expressions (e.g., Random(1, 6))

Variable Detection: Captures static/local/global variables, assignment chains

Type Hints Support: Parses AHK v2.1+ type annotations for parameters and return values

See Function Metadata Guide for details

Smart Code Navigation - Jump to definition, hover information, and symbol outline

Fallback Parser - Works without LSP using built-in regex parser

### Core Conversion Features

Convert AHK v1 to v2 using the community converter and AutoHotkey v2

Multiple output options: open in new tab, replace current file, or show enhanced diff

Batch processing: convert multiple files at once with progress tracking

Enhanced diff view: side-by-side comparison with color-coded changes

Works offline once AutoHotkey v2 is installed

### User Experience Enhancements

Enhanced error messages with actionable recovery suggestions

“Learn More” links to documentation for common errors

Visual indicators with different message types (info, warning, error)

Conversion statistics showing lines processed, warnings, errors, and timing

Progress indicators for long-running operations

Context menu integration for quick access

Keyboard shortcuts for power users

### Advanced Features

Input validation with detailed warnings and error reporting

Conversion validation to ensure output quality

Configurable validation levels (strict, normal, lenient)

Customizable diff view options

Batch output directory management

Auto-save options for converted files

**Package Search & Discovery** ⭐ **NEW** - Find interesting AHK v2 scripts and libraries:

Search GitHub for AHK v2 packages by name, keyword, or browse popular packages

Filter by category (GUI, Networking, Parsing, System, Testing, etc.)

Sort by popularity (stars), recent updates, or alphabetically

View rich metadata: stars, author, category, description

One-click installation with automatic `#Include` insertion

Integrated with GitHub API with smart caching

See [Package Search Guide](docs/PACKAGE_SEARCH_GUIDE.md) for details

**Best OOP Examples Collection** 📚 **NEW** - Learn from high-quality code:

Curated collection of excellent object-oriented AHK v2 scripts

Examples categorized by type (Complete Apps, Class Design, Inheritance, Patterns)

Real-world code from popular repositories with explanations

Learning points and best practices for each example

Code snippets showing common OOP patterns in AHK v2

See [Best OOP Examples](docs/BEST_OOP_EXAMPLES.md) for the full collection

Auto-Add #Include - Automatically insert #Include statements when installing packages:

Smart placement based on directive anchors (#SingleInstance, #Requires)

Intelligent duplicate detection (case-insensitive, path-agnostic)

Preserves file formatting (EOL style, spacing, alignment)

Optional header auto-insertion (#Requires, #SingleInstance)

Configurable include path templates (Lib/, vendor/, custom)

See Auto-Add #Include Guide for details

User Library Indexing & Quick Include ⭐ **NEW**

Automatically scans `%USERPROFILE%/AutoHotkey/**/Lib` (configurable) so scripts like `ArrayHelpers.ahk` and `StringHelpers.ahk` show up in import completions and diagnostics.

Command Palette action **AHK: Include User Library** inserts a username-agnostic `#Include` (default uses `%A_AppData%/../../AutoHotkey/v2/Lib/{name}.ahk`) and can drop ready-to-edit stubs for the exports you pick.

Fully configurable via `ahkv2Toolbox.userLibraryPaths` and `ahkv2Toolbox.userLibraryIncludeFormat`.

Library Attribution - Automatically discover and fill in missing library metadata:

Searches GitHub for library information based on filename

Extracts metadata from file headers, README files, and repository info

Never overwrites existing metadata fields

One-click quick fix leverages GitHub Copilot to insert a JSON metadata block that satisfies validation diagnostics

Supports GitHub Personal Access Token for higher rate limits

See Library Attribution Guide for details

### AI-Powered Chat Assistance

GitHub Copilot Chat Integration - Get intelligent AHK v2 coding help right in VS Code:

Requirements:

VS Code 1.90 or later

GitHub Copilot extension installed and active

Using the Chat Assistant:Type @ahk in the GitHub Copilot Chat view to activate the AHK v2 assistant. It provides expert guidance on AutoHotkey v2 development with deep knowledge of v2 syntax rules and v1-to-v2 migration patterns.

Available Commands:

Code Analysis &amp; Navigation:

@ahk /codemap - Display code structure overview

Shows classes, functions, methods, variables, hotkeys

ASCII tree visualization

Symbol counts and statistics

@ahk /dependencies - Show #Include dependency tree

Visualizes all includes and their relationships

Detects unresolved includes

Reports dependency depth and statistics

@ahk /workspace - Combined code map and dependency overview

Complete workspace context in one command

Ideal for starting new conversations

@ahk /symbols - Quick symbol navigation

Symbol counts by type (classes, functions, methods, etc.)

Tree structure visualization

Navigation tips

@ahk /syntax - Validate AHK v2 syntax

Detects v1 contamination patterns

Integrates VS Code diagnostics

Line-by-line issue reporting

Success confirmation for clean code

Code Development:

@ahk /convert - Convert AHK v1 code snippet to v2 syntax

Identifies v1 patterns and provides accurate v2 equivalents

Explains WHY each conversion is needed

Example: @ahk /convert MsgBox, Hello World

@ahk /explain - Explain AHK v2 syntax or concepts

Clear, educational explanations with examples

References official v2 documentation

Example: @ahk /explain What are property descriptors?

@ahk /fix - Analyze and fix AHK v2 code issues

Identifies syntax errors, logic issues, and anti-patterns

Provides corrected code with explanations

Automatically reads from VS Code’s Problems panel

Includes context from active editor

Example: @ahk /fix Why doesn't this GUI show?

@ahk /optimize - Suggest performance optimizations

Recommends modern v2 idioms and best practices

Explains benefits of each optimization

Example: @ahk /optimize How can I make this loop faster?

@ahk /example - Generate practical code examples

Provides working, ready-to-use code snippets

Includes clear comments

Example: @ahk /example Show me how to create a GUI with tabs

Code Quality:

@ahk /refactor - Suggest refactoring improvements

Identifies code duplication

Suggests function extraction

Recommends simplification and modern v2 idioms

Works on active file or provided snippet

@ahk /best-practices - Review against AHK v2 best practices

Checks naming conventions

Validates error handling

Reviews resource management

Provides constructive feedback with examples

@ahk /test - Generate test cases for functions

Analyzes function signatures

Creates positive and negative tests

Identifies edge cases

Includes function metadata context

General Queries:You can also ask questions without slash commands:

@ahk How do I parse JSON in v2?

@ahk What's the difference between ComObject and ComObjActive?

@ahk Why is my script not working?

Context-Aware Assistance:The chat assistant automatically provides context from:

Your currently active AHK file

File name and language version

Function signatures and parameters from your code

Documentation strings for functions

#Include dependencies in your files

Workspace structure and symbols

Built-in Custom Instructions:This extension includes specialized custom instructions for GitHub Copilot that automatically apply to all .ahk and .ahk2 files. These instructions ensure AI-generated code follows AutoHotkey v2 best practices:

Enforces v2 syntax rules (:= for assignment, ComObject() vs ComObjCreate(), etc.)

Prevents common v1-to-v2 migration mistakes

Promotes proper error handling, GUI patterns, and code style

Located in .github/instructions/autohotkey-v2.instructions.md

Automatically activates when editing AHK files (requires VS Code 1.90+ with Copilot)

Selected code or entire file (for smaller files)

VS Code Problems panel (errors, warnings, and info diagnostics)

Problems Panel Integration:When you use /fix or ask about errors, the assistant automatically reads diagnostics from VS Code’s Problems panel:

❌ Errors: Syntax errors, undefined variables, invalid function calls

⚠️ Warnings: Deprecated syntax, potential issues, code smells

ℹ️ Info: Suggestions, style recommendations

Output Window Integration:The assistant can also read runtime errors from the VS Code Output window:

🔴 Runtime Errors: Errors that occur when running your AHK script

Automatic Parsing: Detects error messages, file paths, and line numbers

Recent History: Remembers errors from the last 5 minutes

File Filtering: Only shows errors relevant to your current file

Example Runtime Error Detection:

C:\Users\...\Object_Literal_Error.ahk (7) : ==&gt; Missing "propertyname:" in object literal.
The assistant automatically parses this to identify:

File: Object_Literal_Error.ahk

Line: 7

Error: Missing "propertyname:" in object literal

How to Use:

Run your AHK script and see the error in Output window

Copy the error output from the Output panel

Run command: AHK: Add Output to Chat Monitor (or Ctrl+Shift+P)

Type @ahk /fix in Copilot Chat

The assistant sees both static diagnostics AND runtime errors!

This means you can simply type:

@ahk /fix - Automatically sees all problems and runtime errors

@ahk why is my script broken? - Reads Problems panel and Output window

@ahk what does this error mean? - Provides context-specific explanations with full context

Key AHK v2 Rules the Assistant Knows:

Use := for ALL assignments (never =)

Arrays are 1-indexed (not 0-indexed)

All control flow uses expressions (no legacy command syntax)

String concatenation uses the . operator

Use ComObject() not ComObjCreate()

Classes use modern OOP syntax with __New() constructor

GUI uses object-based approach with Gui() constructor

## Installation

Install AutoHotkey v2 from autohotkey.com

Install the AutoHotkey v2 LSP extension (recommended):

Search for “AutoHotkey v2 Language Support” by thqby

This provides accurate parsing, IntelliSense, and syntax highlighting

AHKv2 Toolbox will automatically detect and use it

Install this VS Code extension:

From VS Code Marketplace: Search for “AHKv2 Toolbox”

From VSIX: Download and install the .vsix file

From source: Open this folder in VS Code and press F5 to launch the Extension Host

Configure settings (optional) - see Settings section below

Note: The extension will work without the LSP extension, but with limited parsing capabilities.

## Usage

### Single File Conversion

Open a v1 .ahk file in VS Code

Use one of the following methods:

Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

AHK: Convert v1 to v2 - open in new tab

AHK: Convert v1 to v2 - replace current file

AHK: Convert v1 to v2 - show enhanced diff

Context Menu (right-click on .ahk file):

Convert v1 to v2 - open in new tab

Convert v1 to v2 - replace current file

Convert v1 to v2 - show enhanced diff

Keyboard Shortcuts:

Ctrl+Shift+A (Windows/Linux) or Cmd+Shift+A (Mac): Convert to new tab

Ctrl+Shift+D (Windows/Linux) or Cmd+Shift+D (Mac): Show diff

### Batch Conversion

From Command Palette: Run AHK: Convert multiple files (batch)

From Explorer: Select multiple .ahk files, right-click, choose batch conversion

Select files in the file picker dialog

Monitor progress with the progress indicator

Review results and choose save options:

Save All (including failed conversions with error logs)

Save Successful Only

Cancel (don’t save)

### Enhanced Diff View

The enhanced diff view provides:

Side-by-side comparison of original vs converted code

Color-coded changes for easy identification

Line numbers for reference

Context lines around changes

Accept/Reject options for individual changes

Action buttons for accepting all or selected changes

### Profile Management

The extension includes a comprehensive profile management system for customizing conversion behavior:

Built-in Profiles:

Conservative: Minimal changes, preserves most v1 syntax

Aggressive: Maximizes v2 syntax adoption

Custom: Fully customizable base profile

Managing Profiles:

Open Command Palette: Ctrl+Shift+P / Cmd+Shift+P

Run: AHK: Manage Conversion Profiles

Choose from:

Create New Profile: Build custom profile from a base

Edit Existing Profile: Modify profile settings

Delete Profile: Remove custom profiles

Import Profile: Load profile from JSON file

Export Profile: Save profile to JSON file

Profile Editor Features:

Name &amp; Description: Rename and document your profiles

Manage Rules: Add, edit, enable/disable conversion rules

Configure rule priority, patterns, and replacements

Organize by category (syntax, functions, variables, commands, directives)

Selective Conversion: Choose which constructs to convert

Toggle individual construct types (functions, variables, commands, etc.)

Manage include/exclude patterns with regex

Performance Settings: Tune for large files

Enable/disable streaming processing

Adjust chunk size (100-5000 lines)

Set memory limits (50-1000 MB)

Control progress tracking and cancellation

Validation Settings: Configure quality checks

Set validation level (strict, normal, lenient)

Enable/disable syntax, semantic, and performance checks

Add custom validation rules with patterns and severity levels

Note: Predefined profiles (conservative, aggressive, custom) cannot be edited directly. The editor will offer to create an editable copy instead.

### Package Manager &amp; Auto-Add #Include

The Dependency Manager provides a streamlined workflow for managing AHK libraries with automatic #Include insertion.

Installing a Package:

Open the Dependency Manager sidebar view

Browse Available Libraries or Installed Libraries

Click the install button (cloud download icon) on any package

When installation completes, choose an action:

Add #Include - Automatically insert the #Include line

Open - Open the library file

Dismiss - Close the notification

Auto-Add #Include Workflow:

Click “Add #Include” after installing a package

If an .ahk file is active → Include is added immediately

If no .ahk file is active → Select from workspace files

The include line is inserted following smart rules:

Placed after #SingleInstance or #Requires directives

Appended to existing include block (never sorts)

Creates new block if none exists (with proper spacing)

Prevents duplicates (case-insensitive comparison)

Example Result:

#Requires AutoHotkey v2.1
#SingleInstance Force

#Include Lib/Arrays.ahk
#Include Lib/JSON.ahk      ; ← Newly added

; Your code here
MsgBox("Libraries loaded!")
Configuration:

ahkv2Toolbox.includeFormat - Template for include paths (default: Lib/{name}.ahk)

ahkv2Toolbox.autoInsertHeaders - Auto-add directives if missing (default: false)

ahkv2Toolbox.headerOrder - Order of directives to insert

See Auto-Add #Include Guide for complete documentation.

### Learning from OOP Examples

The extension includes curated examples of object-oriented programming in AHK v2:

**View Curated Examples:**

Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)

Run: `AHK: Find Best OOP Examples` to see the latest collection

Browse [Best OOP Examples](docs/BEST_OOP_EXAMPLES.md) directly

**Run Local Examples:**

Navigate to `examples/oop-patterns/` in your workspace

Three complete working examples included:

- `shapes-inheritance.ahk` - Inheritance, polymorphism, abstract classes
- `factory-pattern.ahk` - Factory pattern for object creation
- `singleton-pattern.ahk` - Singleton pattern for single instances

Run any example with AutoHotkey v2:
```
AutoHotkey64.exe examples/oop-patterns/shapes-inheritance.ahk
```

**What You'll Learn:**

Class design and inheritance patterns

Design patterns (Factory, Singleton, Observer)

Best practices from high-quality GitHub repositories

Real-world OOP examples with complete documentation

See [examples/oop-patterns/README.md](examples/oop-patterns/README.md) for detailed guide

### Error Handling

When errors occur, you’ll see:

User-friendly error messages explaining what went wrong

Recovery suggestions with actionable steps

“Learn More” links to relevant documentation

“Show Details” option to view technical information in output channel

## Settings

### Core Settings

ahkConverter.autoHotkeyV2Path: Path to AutoHotkey v2 executable. If empty, uses AutoHotkey64.exe from PATH.

ahkConverter.converterScriptPath: Path to v2converter.ahk. Defaults to the bundled file at ${extensionPath}/vendor/v2converter.ahk.

ahkConverter.strictWindowsOnly: If true, warn on non-Windows platforms.

### User Experience Settings

ahkConverter.enableEnhancedDiff: Enable enhanced diff view with better highlighting and options. (Default: true)

ahkConverter.showConversionStats: Show detailed conversion statistics in status bar. (Default: true)

ahkConverter.enableNotifications: Show enhanced notifications with actionable options. (Default: true)

### Batch Processing Settings

ahkConverter.defaultOutputNaming: How to name converted files in batch mode.

suffix: Add ‘_v2’ suffix to original filename (default)

directory: Save to a separate ‘v2’ subdirectory

prompt: Prompt for filename each time

ahkConverter.batchOutputDirectory: Default output directory for batch conversions. If empty, prompts for directory.

ahkConverter.autoSaveAfterConversion: Automatically save files after successful conversion. (Default: false)

### Validation Settings

ahkConverter.validationLevel: Level of validation to perform on AHK files.

strict: Strict validation with detailed checks

normal: Normal validation with standard checks (default)

lenient: Lenient validation with minimal checks

### Diff View Settings

ahkConverter.diffViewOptions: Options for diff view display.

showLineNumbers: Show line numbers in diff view. (Default: true)

highlightChanges: Highlight changes with color coding. (Default: true)

ignoreWhitespace: Ignore whitespace changes in diff. (Default: false)

contextLines: Number of context lines to show around changes. (Default: 3, range: 0-10)

### Package Manager Settings

ahkv2Toolbox.includeFormat: Template for #Include paths. Use {name} for package name. (Default: Lib/{name}.ahk)

Examples: vendor/{name}.ahk, &lt;{name}&gt;, ../libs/{name}.ahk

ahkv2Toolbox.autoInsertHeaders: Automatically insert #Requires and #SingleInstance headers when installing packages. (Default: false)

ahkv2Toolbox.headerOrder: Order of header directives to insert. (Default: ["#Requires AutoHotkey v2.1", "#SingleInstance Force"])

ahkv2Toolbox.defaultRequires: Default AutoHotkey version for #Requires directive. (Default: AutoHotkey v2.1)

ahkv2Toolbox.defaultSingleInstance: Default #SingleInstance mode. (Default: Force)

Options: Force, Ignore, Prompt, Off

ahkv2Toolbox.libFolders: Library search folders relative to workspace. (Default: ["Lib", "vendor"])

## Troubleshooting

### Common Issues

“AutoHotkey v2 executable not found”

Ensure AutoHotkey v2 is installed

Set the correct path in ahkConverter.autoHotkeyV2Path setting

Try using the “Open Settings” action in the error notification

“Converter script not found”

Verify the extension is properly installed

Check ahkConverter.converterScriptPath setting

Reinstall the extension if the file is missing

“Validation failed”

Check if the file contains AHK v1 syntax

Ensure the file is not empty or corrupted

Try with a simpler AHK file first

“Conversion failed”

Check the output channel for detailed error information

Verify AutoHotkey v2 is working correctly

Try converting a simpler file first

### Performance Issues

Slow conversion on large files

Consider using batch mode for multiple files

Disable enhanced diff view if not needed

Increase validation level to “lenient” for faster processing

Memory issues with batch processing

Process files in smaller batches

Close other applications to free memory

Restart VS Code if needed

### Getting Help

Check the output channel: View → Output → “AHKv2 Toolbox”

Review error notifications: Click “Show Details” for technical information

Visit documentation: Use “Learn More” links in error messages

Report issues: GitHub Issues

## Advanced Usage

### Custom Validation

You can adjust the validation level based on your needs:

Strict: Best for critical production code

Normal: Good balance of safety and performance

Lenient: Fastest, minimal checks

### Batch Workflow

For large projects:

Organize AHK files in logical groups

Use batch conversion with directory output naming

Review conversion statistics for quality assessment

Test converted files before deployment

### Integration with Other Tools

The extension works well with:

AutoHotkey LSP for syntax highlighting and IntelliSense

Git for version control of converted files

Build tools for automated conversion workflows

## Development & Publishing

### Building Locally

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run package      # Create VSIX package
```

### Publishing to VS Code Marketplace

The extension uses GitHub Actions for automated publishing. To publish:

1. **Configure VSCE_PAT secret** in GitHub repository settings:
   - Go to [Azure DevOps](https://dev.azure.com/) → User Settings → Personal Access Tokens
   - Create a token with **Marketplace (Manage)** scope
   - Add as `VSCE_PAT` in GitHub repo → Settings → Secrets → Actions

2. **Publish via git tag**:
   ```bash
   # Update version in package.json
   npm version patch  # or minor/major
   git push origin main --tags
   ```
   GitHub Actions will automatically publish on tag push.

3. **Manual publish** (requires local VSCE_PAT):
   ```bash
   export VSCE_PAT=your-token
   npm run publish
   ```

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.

## Changelog

See CHANGELOG.md for version history and updates.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

AutoHotkey Community for the v2 converter script

AutoHotkey Team for the v2 language and tools

VS Code Team for the extension API and platform

## Support

📖 [Documentation](docs/)

📚 [Best OOP Examples](docs/BEST_OOP_EXAMPLES.md) - Learn from high-quality object-oriented AHK v2 code

🐛 Issue Tracker

💬 Discussions

📧 Email Support

Enjoy converting your AHK scripts! 🚀


