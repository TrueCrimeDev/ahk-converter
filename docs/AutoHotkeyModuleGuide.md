# AutoHotkey v2.1 Module System — Working Guide

This document consolidates the requirements gathered from the in-progress v2.1 module-system specification so we have a single reference while upgrading the AHKv2 Toolbox extension. It treats the current 0.4.x behavior as “legacy” and records the desired end state for parsing, symbol indexing, module resolution, and diagnostics.

---

## 1. Core Concepts

- **Module Definition**: A module is “a script within a script.” Each module owns its own global namespace (variables, functions, classes), its own auto-execute body, and a list of explicitly exported members.
- **Naming**: Every module has an identifying name. When no `#Module` directive is present, all code belongs to the implicit `__Main` module.
- **Built-in Module**: There is an always-available `AHK` module that supplies all built-in classes, variables, and functions. Scripts may `import AHK` to shadow built-ins intentionally (`MsgBox()` wrapper example).
- **Default Behavior**: Globals and code go to `__Main` unless enclosed in another module. Built-ins remain accessible unless shadowed.

---

## 2. Module Creation (`#Module`)

| Directive | Rule |
|-----------|------|
| `#Module ModuleName` | Ends the current module, begins a new one with its own namespace and auto-execute section. Think of it as closing the current file and starting `Lib\ModuleName.ahk`. |

- `#Module` can appear anywhere; everything before it belongs to the prior module (often `__Main`).
- Future ideas: reopening existing modules, automatic end-at-file-boundary behavior for dedicated module files, and block syntax (`module X { }`)—but those are not implemented yet.
- Example:
  ```ahk
  MyVar := 1
  ShowVar()

  #Module Other
  MyVar := 2
  export ShowVar() => MsgBox("Other MyVar = " MyVar)
  ```

---

## 3. Import System

### 3.1 Basic Forms

| Syntax | Meaning |
|--------|---------|
| `import ModuleName` | Bind the module object to `ModuleName`. Access exports via `ModuleName.Export`. |
| `import RealName as Alias` | Bind module to `Alias` to avoid conflicts. |
| `import {a, b as x} from ModuleName` | Import named exports individually with optional aliasing. |
| `import * from ModuleName` | Bring all exports directly into the current module namespace (risk of conflicts). |
| `import {} from ModuleName` | Load the module for side effects without importing names. |
| `import "ModuleName"` | Load module without adding it to the namespace (side-effect only). |

### 3.2 Package & Relative Imports

- **Dotted Names**: `import a.b` should search `Lib\a\b\__Init.ahk`, `Lib\a\b.ahk`, and `Lib\a\__Init.ahk`, binding `a` in the caller’s namespace.
- **Package-Relative (Python-like)**:
  - `import .sibling`
  - `import ..parentModule`
  - `import * from .` (all exports from current package)
- **Module Declaration**: `#Module a.b` should create/extend package `a` and export nested module `b`. (Not yet implemented in AHK but recorded here for planning.)

### 3.3 Resolution Order (v2.1-alpha.17+)

1. Seed search paths from `AhkImportPath` if provided; otherwise use `.;%A_MyDocuments%\AutoHotkey;%A_AhkPath%\..`.
2. Expand `%VAR%` tokens; allow absolute paths or paths relative to `A_ScriptDir`.
3. Lookup order for `import ModuleName`:
   1. `ModuleName` (exact path/file)
   2. `ModuleName\__Init.ahk`
   3. `ModuleName.ahk`
4. Module names map to module objects, not automatically to sibling packages. No implicit access: `Lib\a\b.ahk` cannot see module `a` without an explicit import.

### 3.4 Shadowing Built-ins

- `AHK` can be imported like any module to intentionally shadow built-ins. Example:
  ```ahk
  import AHK

  MsgBox(Text?, Title?, Options := "") {
      return AHK.MsgBox(Text?, Title?, "Iconi " Options)
  }
  ```
- Diagnostics should differentiate between implicit built-in access and explicit overrides.

---

## 4. Export Declarations

| Form | Example |
|------|---------|
| Function | `export FuncName(params) { }` |
| Class | `export class MyClass { }` |
| Variable | `export MyValue := 42` |
| Default | `export default FuncName(params) { }` |

- Only explicitly exported names are visible to importers (no automatic leaking of internals).
- Exports are discovered via static analysis at load time.
- Importing binds to exports **before** executing module bodies, allowing cyclic imports (with caveats; see Execution).
- v2.0-compatible libraries cannot have exports inline. Workaround: create a module wrapper that `#Include`s the legacy library and adds `export` statements.

---

## 5. Namespaces & Scope

- Each module owns its own globals—no cross-module bleed.
- Built-in `AHK` exports are available unless explicitly shadowed in the current module.
- Module names occupy their own namespace; aliasing (`as`) resolves conflicts.
- Module-specific globals example:
  ```ahk
  import Other
  MyVar := 1
  ShowVar()          ; Main's MyVar = 1
  Other.ShowVar()    ; Other's MyVar = 2
  ```

---

## 6. Module Execution Model

Execution order is stack-like:

1. Start with the most recently defined/loaded module.
2. For each module:
   - Execute imported modules first (if they have not run yet).
   - Execute the module’s auto-execute body.
3. Walk backward through the module list.

Special cases:
- **Cyclic Imports**: Execution order may not satisfy every dependency; tooling should warn.
- **`__Main` Imports**: If a module imports `__Main`, ensure `__Main` executes before that module (best practice is to extract shared code into its own module instead).

---

## 7. Packages & Future Enhancements

- Packages (dotted modules) are planned but not fully implemented yet.
- No implicit lexical access: `Lib\a\b.ahk` does **not** inherit from `module a`.
- Lexical nesting (`module a { module b { } }`) is mentioned but not active.
- Importing `a.b` should **not** auto-load `Lib\a\c.ahk`.

---

## 8. Module Interface as Objects

Current implementation: modules act like late-bound dynamic objects (get/set/invoke exported values).

Planned upgrade:
- Treat modules as objects with properties for each export; allows enumeration and debugger reflection.
- Properties are not ordinary value/method properties—`GetOwnPropDesc` should reveal opaque getters.
- Calling an exported function does **not** pass the module object implicitly.

---

## 9. Backward Compatibility

- Empty scripts default to v2.0 mode.
- Goal: v2.1.0 must execute v2.0 scripts unchanged.
- Recommended migration approach: place legacy code into dedicated modules and port incrementally.
- Reserved words: “Module” and “Import” stay usable in v2.0 contexts (not reserved).
- Version targeting per module is planned but undecided; v2.0 compatibility remains the baseline.

---

## 10. Directive Scope Rules

| Directive | Behavior |
|-----------|----------|
| `#Include` | Runs once **per module**. Including the same file in different modules yields separate scopes. |
| `#Warn` | Module-scoped: enabling/disabling warnings affects only the active module. |
| `#HotIf` | Module-scoped; expressions reference variables in the current module. |

---

## 11. Debugging Considerations (v2.1-alpha.11)

- Module exports cannot currently be enumerated via debugger queries.
- `property_get`/`property_set` work for direct access, but `context_get` only returns:
  - Current module’s globals
  - Explicitly imported names
  - **Not** names brought in via `import *` or implicit built-ins
- vscode-autohotkey-debug v1.11.0 cannot display properties that aren’t listed by the parent object and refuses exports via module references. Implicitly imported variables remain hidden.

---

## 12. Common Patterns & Best Practices

- **Resolving conflicts**:
  ```ahk
  import {Calculate as CalculateX} from X
  import * from Y
  Calculate() => 1      ; local wins
  MsgBox CalculateX()   ; explicit alias
  ```
- **Shadowing built-ins**: `import AHK`, qualify calls via `AHK.SomeFunc`.
- **Module detection heuristics** for tooling:
  - Lines with `#Module`
  - Any `import` statement
  - `export` declarations
  - `ModuleName.Export` references
- **Syntax validation** reminders:
  - Module names are identifiers (packages append dots).
  - Named imports require braces (`import {name} from module`).
  - Use `export` prefix; module instantiation happens via `import`, not constructor calls.
- **Common errors**:
  - Assuming cross-module globals
  - Forgetting aliases
  - Accidental shadowing
  - Circular dependencies
  - Missing exports

---

## 13. Implementation TODOs for AHKv2 Toolbox

- [ ] Extend parser to capture multiple modules per file, implicit `__Main`, explicit exports, and package-relative imports.
- [ ] Update symbol index to track module-level namespaces and dependency edges (including execution ordering constraints such as `__Main` imports).
- [ ] Teach module resolver about `AHK`, packages, dotted names, and Python-like relative imports.
- [ ] Enhance diagnostics to cover shadowing, missing exports, wildcard collisions, cyclic execution risks, and misuse of `import {}`/`import *`.
- [ ] Surface module metadata in completions, hovers, definition/peek, and reference providers.
- [ ] Document debugger limitations and provide user guidance for `import AHK` patterns.
- [ ] Build sample scripts/tests illustrating every construct above (multi-module files, package-relative imports, wildcard conflicts, module-scoped directives).

This guide should evolve as the AutoHotkey v2.1 spec stabilizes; treat the checklist above as the authoritative baseline for future implementation work.
