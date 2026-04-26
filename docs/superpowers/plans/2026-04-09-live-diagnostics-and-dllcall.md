# Live Diagnostics Channel & DllCall Signature Database

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live output channel showing raw `check /Diag=json` results on save, and a DllCall completion/hover provider backed by a bundled Win32 signature database.

**Architecture:** Feature 1 extends `alphaBridge.ts` with an OutputChannel that logs timestamped raw JSON on each save. Feature 2 adds a standalone `dllcallProvider.ts` that reads a bundled JSON signature file and registers both a CompletionItemProvider (triggers inside `DllCall()` calls) and a HoverProvider (shows signature on hover over `DllCall` function names). Both features wire into `extension.ts` during `activate()`.

**Tech Stack:** VS Code Extension API (CompletionItemProvider, HoverProvider, OutputChannel), TypeScript, bundled JSON data file.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/alphaBridge.ts` | Add OutputChannel, log raw JSON on each check run |
| Create | `src/dllcall-signatures.json` | Bundled Win32 DllCall signature database |
| Create | `src/dllcallProvider.ts` | CompletionItemProvider + HoverProvider for DllCall |
| Modify | `src/extension.ts` | Wire up DllCall providers in `activate()` |
| Modify | `test/console-diag-demo.ahk` | Add DllCall examples for manual testing |

---

### Task 1: Live Diagnostics Output Channel

**Files:**
- Modify: `src/alphaBridge.ts`

The existing `alphaBridge.ts` has `runCheck()` and `validateDocument()` but no output channel. Add one that shows timestamped raw JSON for each save.

- [ ] **Step 1: Add OutputChannel creation to `registerConsoleDiagnostics`**

In `src/alphaBridge.ts`, modify the `registerConsoleDiagnostics` function to create an output channel and pass it through:

```typescript
export function registerConsoleDiagnostics(context: vscode.ExtensionContext): vscode.Disposable {
    const collection = vscode.languages.createDiagnosticCollection('ahk-console');
    const channel = vscode.window.createOutputChannel('AHK Console Diagnostics');

    const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
        validateDocument(doc, collection, channel);
    });

    const disposable = vscode.Disposable.from(collection, onSave, channel);
    context.subscriptions.push(disposable);
    return disposable;
}
```

- [ ] **Step 2: Update `validateDocument` to accept and use the channel**

Update the signature and add logging before/after the check:

```typescript
async function validateDocument(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection,
    channel: vscode.OutputChannel,
): Promise<void> {
    if (document.languageId !== 'ahk2' && !document.fileName.endsWith('.ahk')) { return; }

    const timestamp = new Date().toLocaleTimeString();
    channel.appendLine(`[${timestamp}] Checking: ${document.fileName}`);

    const raw = await runCheck(document.fileName);

    // Log every raw diagnostic to the channel
    for (const d of raw) {
        const icon = d.severity === 'error' || d.severity === 'critical' ? '\u2716' : '\u26A0';
        channel.appendLine(`  ${icon} L${d.line} [${d.severity}] ${d.message}${d.extra ? ': ' + d.extra : ''}`);
    }

    const diags = raw.filter(isHighValue);
    const filtered = raw.length - diags.length;
    channel.appendLine(`  ${raw.length} total, ${diags.length} surfaced, ${filtered} filtered (LSP covers)`);

    // ... rest of grouping/publishing logic unchanged ...
```

- [ ] **Step 3: Log pass/empty results**

After the filter, if `raw.length === 0`:

```typescript
    if (raw.length === 0) {
        channel.appendLine(`  \u2714 No issues found`);
    }
```

- [ ] **Step 4: Compile and verify**

Run: `npx tsc --noEmit`
Expected: Exit code 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/alphaBridge.ts
git commit -m "feat: add live AHK Console Diagnostics output channel"
```

---

### Task 2: DllCall Signature Database

**Files:**
- Create: `src/dllcall-signatures.json`

Build the bundled JSON file containing common Win32 DllCall signatures that AHK users actually reach for. Each entry has the DLL, function name, parameters (name, type, description), return type, and a one-line description.

Valid AHK v2 DllCall types: `Str`, `AStr`, `WStr`, `Int`, `Int64`, `Short`, `Char`, `UInt`, `UInt64`, `UShort`, `UChar`, `Float`, `Double`, `Ptr`, `UPtr`.

- [ ] **Step 1: Create the signature file**

Create `src/dllcall-signatures.json` with this structure and initial entries:

```json
{
  "User32": {
    "MessageBoxW": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to owner window, 0 for no owner" },
        { "name": "lpText", "type": "Str", "desc": "Message text" },
        { "name": "lpCaption", "type": "Str", "desc": "Dialog title" },
        { "name": "uType", "type": "UInt", "desc": "Dialog type flags (0=OK, 1=OK/Cancel, 4=Yes/No)" }
      ],
      "return": "Int",
      "desc": "Displays a modal dialog box with a message and buttons"
    },
    "FindWindowW": {
      "params": [
        { "name": "lpClassName", "type": "Str", "desc": "Window class name, or empty string" },
        { "name": "lpWindowName", "type": "Str", "desc": "Window title text" }
      ],
      "return": "Ptr",
      "desc": "Retrieves handle to top-level window by class/title"
    },
    "GetForegroundWindow": {
      "params": [],
      "return": "Ptr",
      "desc": "Retrieves handle to the foreground window"
    },
    "SetForegroundWindow": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window to activate" }
      ],
      "return": "Int",
      "desc": "Brings the specified window to the foreground"
    },
    "SendMessageW": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the target window" },
        { "name": "Msg", "type": "UInt", "desc": "Message identifier" },
        { "name": "wParam", "type": "Ptr", "desc": "Additional message-specific info" },
        { "name": "lParam", "type": "Ptr", "desc": "Additional message-specific info" }
      ],
      "return": "Ptr",
      "desc": "Sends a message to a window and waits for processing"
    },
    "PostMessageW": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the target window" },
        { "name": "Msg", "type": "UInt", "desc": "Message identifier" },
        { "name": "wParam", "type": "Ptr", "desc": "Additional message-specific info" },
        { "name": "lParam", "type": "Ptr", "desc": "Additional message-specific info" }
      ],
      "return": "Int",
      "desc": "Posts a message to a window's message queue and returns immediately"
    },
    "GetWindowTextW": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "lpString", "type": "Str", "desc": "Buffer to receive text" },
        { "name": "nMaxCount", "type": "Int", "desc": "Max characters to copy including null" }
      ],
      "return": "Int",
      "desc": "Copies the title bar text of a window into a buffer"
    },
    "ShowWindow": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "nCmdShow", "type": "Int", "desc": "Show state (0=Hide, 1=Normal, 2=Minimized, 3=Maximized)" }
      ],
      "return": "Int",
      "desc": "Sets the show state of a window"
    },
    "MoveWindow": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "X", "type": "Int", "desc": "New left position" },
        { "name": "Y", "type": "Int", "desc": "New top position" },
        { "name": "nWidth", "type": "Int", "desc": "New width" },
        { "name": "nHeight", "type": "Int", "desc": "New height" },
        { "name": "bRepaint", "type": "Int", "desc": "1 to repaint, 0 to skip" }
      ],
      "return": "Int",
      "desc": "Changes the position and dimensions of a window"
    },
    "GetCursorPos": {
      "params": [
        { "name": "lpPoint", "type": "Ptr", "desc": "Pointer to POINT struct receiving coordinates" }
      ],
      "return": "Int",
      "desc": "Retrieves the cursor position in screen coordinates"
    },
    "SetCursorPos": {
      "params": [
        { "name": "X", "type": "Int", "desc": "New X coordinate in screen pixels" },
        { "name": "Y", "type": "Int", "desc": "New Y coordinate in screen pixels" }
      ],
      "return": "Int",
      "desc": "Sets the cursor position in screen coordinates"
    },
    "GetAsyncKeyState": {
      "params": [
        { "name": "vKey", "type": "Int", "desc": "Virtual-key code" }
      ],
      "return": "Short",
      "desc": "Determines whether a key is pressed at the time of the call"
    },
    "GetClientRect": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "lpRect", "type": "Ptr", "desc": "Pointer to RECT struct receiving client area" }
      ],
      "return": "Int",
      "desc": "Retrieves the client area coordinates of a window"
    },
    "GetWindowRect": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "lpRect", "type": "Ptr", "desc": "Pointer to RECT struct receiving window area" }
      ],
      "return": "Int",
      "desc": "Retrieves the bounding rectangle of a window in screen coordinates"
    },
    "SetWindowPos": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "hWndInsertAfter", "type": "Ptr", "desc": "Z-order handle (-1=TopMost, -2=NoTopMost)" },
        { "name": "X", "type": "Int", "desc": "New left position" },
        { "name": "Y", "type": "Int", "desc": "New top position" },
        { "name": "cx", "type": "Int", "desc": "New width" },
        { "name": "cy", "type": "Int", "desc": "New height" },
        { "name": "uFlags", "type": "UInt", "desc": "Positioning flags (0x0001=NoSize, 0x0002=NoMove)" }
      ],
      "return": "Int",
      "desc": "Changes size, position, and Z-order of a window"
    },
    "SetLayeredWindowAttributes": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the layered window" },
        { "name": "crKey", "type": "UInt", "desc": "Transparency color key (RGB)" },
        { "name": "bAlpha", "type": "UChar", "desc": "Alpha value 0-255" },
        { "name": "dwFlags", "type": "UInt", "desc": "1=ColorKey, 2=Alpha, 3=Both" }
      ],
      "return": "Int",
      "desc": "Sets opacity and transparency color key of a layered window"
    },
    "SystemParametersInfoW": {
      "params": [
        { "name": "uiAction", "type": "UInt", "desc": "System parameter to query or set" },
        { "name": "uiParam", "type": "UInt", "desc": "Depends on uiAction" },
        { "name": "pvParam", "type": "Ptr", "desc": "Depends on uiAction" },
        { "name": "fWinIni", "type": "UInt", "desc": "User profile update flag" }
      ],
      "return": "Int",
      "desc": "Queries or sets system-wide parameters"
    },
    "GetDC": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to window, 0 for entire screen" }
      ],
      "return": "Ptr",
      "desc": "Retrieves a device context for the client area of a window"
    },
    "ReleaseDC": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "hDC", "type": "Ptr", "desc": "Handle to the device context" }
      ],
      "return": "Int",
      "desc": "Releases a device context obtained by GetDC"
    },
    "GetClassName": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "lpClassName", "type": "Str", "desc": "Buffer to receive class name" },
        { "name": "nMaxCount", "type": "Int", "desc": "Max length of buffer" }
      ],
      "return": "Int",
      "desc": "Retrieves the name of the class to which a window belongs"
    },
    "IsWindowVisible": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" }
      ],
      "return": "Int",
      "desc": "Determines whether the specified window is visible"
    },
    "IsWindow": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to test" }
      ],
      "return": "Int",
      "desc": "Determines whether the specified handle is a valid window"
    },
    "GetDesktopWindow": {
      "params": [],
      "return": "Ptr",
      "desc": "Retrieves a handle to the desktop window"
    }
  },
  "Kernel32": {
    "GetTickCount": {
      "params": [],
      "return": "UInt",
      "desc": "Retrieves milliseconds since system start (wraps after ~49 days)"
    },
    "GetTickCount64": {
      "params": [],
      "return": "UInt64",
      "desc": "Retrieves milliseconds since system start (no wrap)"
    },
    "Sleep": {
      "params": [
        { "name": "dwMilliseconds", "type": "UInt", "desc": "Milliseconds to sleep" }
      ],
      "return": "void",
      "desc": "Suspends the current thread for the specified time"
    },
    "GetLastError": {
      "params": [],
      "return": "UInt",
      "desc": "Retrieves the calling thread's last error code"
    },
    "GetModuleHandleW": {
      "params": [
        { "name": "lpModuleName", "type": "Str", "desc": "Module name, or empty for calling process" }
      ],
      "return": "Ptr",
      "desc": "Retrieves a module handle for the specified module"
    },
    "LoadLibraryW": {
      "params": [
        { "name": "lpLibFileName", "type": "Str", "desc": "Name or path of the DLL" }
      ],
      "return": "Ptr",
      "desc": "Loads a DLL into the calling process"
    },
    "FreeLibrary": {
      "params": [
        { "name": "hLibModule", "type": "Ptr", "desc": "Handle to the loaded DLL" }
      ],
      "return": "Int",
      "desc": "Frees a loaded DLL module"
    },
    "GetProcAddress": {
      "params": [
        { "name": "hModule", "type": "Ptr", "desc": "Handle to the DLL" },
        { "name": "lpProcName", "type": "AStr", "desc": "Function or variable name" }
      ],
      "return": "Ptr",
      "desc": "Retrieves the address of a function from a DLL"
    },
    "GetCurrentProcessId": {
      "params": [],
      "return": "UInt",
      "desc": "Retrieves the process ID of the calling process"
    },
    "OpenProcess": {
      "params": [
        { "name": "dwDesiredAccess", "type": "UInt", "desc": "Access rights (0x1F0FFF for PROCESS_ALL_ACCESS)" },
        { "name": "bInheritHandle", "type": "Int", "desc": "1 to inherit handle" },
        { "name": "dwProcessId", "type": "UInt", "desc": "Process identifier" }
      ],
      "return": "Ptr",
      "desc": "Opens a handle to an existing process"
    },
    "CloseHandle": {
      "params": [
        { "name": "hObject", "type": "Ptr", "desc": "Handle to close" }
      ],
      "return": "Int",
      "desc": "Closes an open object handle"
    },
    "GlobalAlloc": {
      "params": [
        { "name": "uFlags", "type": "UInt", "desc": "Allocation flags (0x0040=GPTR)" },
        { "name": "dwBytes", "type": "UPtr", "desc": "Number of bytes to allocate" }
      ],
      "return": "Ptr",
      "desc": "Allocates memory from the global heap"
    },
    "GlobalFree": {
      "params": [
        { "name": "hMem", "type": "Ptr", "desc": "Handle to global memory" }
      ],
      "return": "Ptr",
      "desc": "Frees global memory (returns 0 on success)"
    },
    "VirtualAlloc": {
      "params": [
        { "name": "lpAddress", "type": "Ptr", "desc": "Starting address, 0 for system choice" },
        { "name": "dwSize", "type": "UPtr", "desc": "Size in bytes" },
        { "name": "flAllocationType", "type": "UInt", "desc": "Allocation type (0x1000=MEM_COMMIT, 0x2000=MEM_RESERVE)" },
        { "name": "flProtect", "type": "UInt", "desc": "Memory protection (0x04=PAGE_READWRITE)" }
      ],
      "return": "Ptr",
      "desc": "Reserves/commits a region of virtual memory"
    },
    "VirtualFree": {
      "params": [
        { "name": "lpAddress", "type": "Ptr", "desc": "Starting address" },
        { "name": "dwSize", "type": "UPtr", "desc": "Size in bytes (0 for MEM_RELEASE)" },
        { "name": "dwFreeType", "type": "UInt", "desc": "Free type (0x8000=MEM_RELEASE)" }
      ],
      "return": "Int",
      "desc": "Releases/decommits a region of virtual memory"
    },
    "QueryPerformanceCounter": {
      "params": [
        { "name": "lpPerformanceCount", "type": "Ptr", "desc": "Pointer to Int64 receiving counter value" }
      ],
      "return": "Int",
      "desc": "Retrieves the current high-resolution performance counter value"
    },
    "QueryPerformanceFrequency": {
      "params": [
        { "name": "lpFrequency", "type": "Ptr", "desc": "Pointer to Int64 receiving counts per second" }
      ],
      "return": "Int",
      "desc": "Retrieves the performance counter frequency"
    },
    "GetEnvironmentVariableW": {
      "params": [
        { "name": "lpName", "type": "Str", "desc": "Environment variable name" },
        { "name": "lpBuffer", "type": "Str", "desc": "Buffer to receive value" },
        { "name": "nSize", "type": "UInt", "desc": "Buffer size in characters" }
      ],
      "return": "UInt",
      "desc": "Retrieves the value of an environment variable"
    },
    "SetEnvironmentVariableW": {
      "params": [
        { "name": "lpName", "type": "Str", "desc": "Variable name" },
        { "name": "lpValue", "type": "Str", "desc": "New value, or empty to delete" }
      ],
      "return": "Int",
      "desc": "Sets the value of an environment variable"
    },
    "GetTempPathW": {
      "params": [
        { "name": "nBufferLength", "type": "UInt", "desc": "Buffer size in characters" },
        { "name": "lpBuffer", "type": "Str", "desc": "Buffer to receive path" }
      ],
      "return": "UInt",
      "desc": "Retrieves the path of the temporary file directory"
    },
    "MultiByteToWideChar": {
      "params": [
        { "name": "CodePage", "type": "UInt", "desc": "Code page (65001=UTF-8)" },
        { "name": "dwFlags", "type": "UInt", "desc": "Conversion flags" },
        { "name": "lpMultiByteStr", "type": "Ptr", "desc": "Pointer to byte string" },
        { "name": "cbMultiByte", "type": "Int", "desc": "Byte string length, -1 for null-terminated" },
        { "name": "lpWideCharStr", "type": "Ptr", "desc": "Pointer to wide-char buffer" },
        { "name": "cchWideChar", "type": "Int", "desc": "Buffer size in characters, 0 to query" }
      ],
      "return": "Int",
      "desc": "Maps a multibyte string to a UTF-16 wide-character string"
    },
    "CreateFileW": {
      "params": [
        { "name": "lpFileName", "type": "Str", "desc": "File or device name" },
        { "name": "dwDesiredAccess", "type": "UInt", "desc": "Access mode (0x80000000=READ, 0x40000000=WRITE)" },
        { "name": "dwShareMode", "type": "UInt", "desc": "Sharing mode" },
        { "name": "lpSecurityAttributes", "type": "Ptr", "desc": "Security attributes, usually 0" },
        { "name": "dwCreationDisposition", "type": "UInt", "desc": "Action (1=CREATE_NEW, 2=CREATE_ALWAYS, 3=OPEN_EXISTING)" },
        { "name": "dwFlagsAndAttributes", "type": "UInt", "desc": "File attributes and flags" },
        { "name": "hTemplateFile", "type": "Ptr", "desc": "Template file handle, usually 0" }
      ],
      "return": "Ptr",
      "desc": "Creates or opens a file or I/O device"
    },
    "ReadFile": {
      "params": [
        { "name": "hFile", "type": "Ptr", "desc": "Handle to the file" },
        { "name": "lpBuffer", "type": "Ptr", "desc": "Buffer to receive data" },
        { "name": "nNumberOfBytesToRead", "type": "UInt", "desc": "Bytes to read" },
        { "name": "lpNumberOfBytesRead", "type": "Ptr", "desc": "Pointer to UInt receiving bytes read" },
        { "name": "lpOverlapped", "type": "Ptr", "desc": "Overlapped struct, usually 0" }
      ],
      "return": "Int",
      "desc": "Reads data from a file"
    },
    "WriteFile": {
      "params": [
        { "name": "hFile", "type": "Ptr", "desc": "Handle to the file" },
        { "name": "lpBuffer", "type": "Ptr", "desc": "Buffer containing data to write" },
        { "name": "nNumberOfBytesToWrite", "type": "UInt", "desc": "Bytes to write" },
        { "name": "lpNumberOfBytesWritten", "type": "Ptr", "desc": "Pointer to UInt receiving bytes written" },
        { "name": "lpOverlapped", "type": "Ptr", "desc": "Overlapped struct, usually 0" }
      ],
      "return": "Int",
      "desc": "Writes data to a file"
    },
    "WaitForSingleObject": {
      "params": [
        { "name": "hHandle", "type": "Ptr", "desc": "Handle to the object" },
        { "name": "dwMilliseconds", "type": "UInt", "desc": "Timeout in ms (0xFFFFFFFF=INFINITE)" }
      ],
      "return": "UInt",
      "desc": "Waits for a single object to be signaled"
    }
  },
  "Gdi32": {
    "BitBlt": {
      "params": [
        { "name": "hdc", "type": "Ptr", "desc": "Destination device context" },
        { "name": "x", "type": "Int", "desc": "Destination X" },
        { "name": "y", "type": "Int", "desc": "Destination Y" },
        { "name": "cx", "type": "Int", "desc": "Width" },
        { "name": "cy", "type": "Int", "desc": "Height" },
        { "name": "hdcSrc", "type": "Ptr", "desc": "Source device context" },
        { "name": "x1", "type": "Int", "desc": "Source X" },
        { "name": "y1", "type": "Int", "desc": "Source Y" },
        { "name": "rop", "type": "UInt", "desc": "Raster operation (0x00CC0020=SRCCOPY)" }
      ],
      "return": "Int",
      "desc": "Performs bit-block transfer of color data between device contexts"
    },
    "CreateCompatibleDC": {
      "params": [
        { "name": "hdc", "type": "Ptr", "desc": "Handle to existing DC, 0 for screen" }
      ],
      "return": "Ptr",
      "desc": "Creates a memory device context compatible with the specified device"
    },
    "CreateCompatibleBitmap": {
      "params": [
        { "name": "hdc", "type": "Ptr", "desc": "Handle to device context" },
        { "name": "cx", "type": "Int", "desc": "Bitmap width" },
        { "name": "cy", "type": "Int", "desc": "Bitmap height" }
      ],
      "return": "Ptr",
      "desc": "Creates a bitmap compatible with the specified device context"
    },
    "SelectObject": {
      "params": [
        { "name": "hdc", "type": "Ptr", "desc": "Handle to device context" },
        { "name": "h", "type": "Ptr", "desc": "Handle to the GDI object" }
      ],
      "return": "Ptr",
      "desc": "Selects a GDI object into a device context, returns previous object"
    },
    "DeleteObject": {
      "params": [
        { "name": "ho", "type": "Ptr", "desc": "Handle to GDI object" }
      ],
      "return": "Int",
      "desc": "Deletes a GDI object (pen, brush, bitmap, font, region)"
    },
    "DeleteDC": {
      "params": [
        { "name": "hdc", "type": "Ptr", "desc": "Handle to device context" }
      ],
      "return": "Int",
      "desc": "Deletes the specified device context"
    },
    "GetPixel": {
      "params": [
        { "name": "hdc", "type": "Ptr", "desc": "Handle to device context" },
        { "name": "x", "type": "Int", "desc": "X coordinate" },
        { "name": "y", "type": "Int", "desc": "Y coordinate" }
      ],
      "return": "UInt",
      "desc": "Retrieves the RGB color value of the pixel at the specified coordinates"
    },
    "SetPixel": {
      "params": [
        { "name": "hdc", "type": "Ptr", "desc": "Handle to device context" },
        { "name": "x", "type": "Int", "desc": "X coordinate" },
        { "name": "y", "type": "Int", "desc": "Y coordinate" },
        { "name": "color", "type": "UInt", "desc": "RGB color value" }
      ],
      "return": "UInt",
      "desc": "Sets the pixel at the specified coordinates to the specified color"
    }
  },
  "Shell32": {
    "ShellExecuteW": {
      "params": [
        { "name": "hwnd", "type": "Ptr", "desc": "Parent window handle" },
        { "name": "lpOperation", "type": "Str", "desc": "Action: 'open', 'runas', 'print', 'edit'" },
        { "name": "lpFile", "type": "Str", "desc": "File or URL to act on" },
        { "name": "lpParameters", "type": "Str", "desc": "Command line parameters" },
        { "name": "lpDirectory", "type": "Str", "desc": "Working directory" },
        { "name": "nShowCmd", "type": "Int", "desc": "Show state (1=Normal, 0=Hide, 3=Maximized)" }
      ],
      "return": "Ptr",
      "desc": "Opens, prints, or launches a file or URL"
    },
    "Shell_NotifyIconW": {
      "params": [
        { "name": "dwMessage", "type": "UInt", "desc": "Action (0=Add, 1=Modify, 2=Delete)" },
        { "name": "lpData", "type": "Ptr", "desc": "Pointer to NOTIFYICONDATA struct" }
      ],
      "return": "Int",
      "desc": "Sends a message to the system tray"
    },
    "SHGetFolderPathW": {
      "params": [
        { "name": "hwnd", "type": "Ptr", "desc": "Reserved, use 0" },
        { "name": "csidl", "type": "Int", "desc": "CSIDL folder ID (0x001A=AppData, 0x0024=Windows)" },
        { "name": "hToken", "type": "Ptr", "desc": "Access token, 0 for current user" },
        { "name": "dwFlags", "type": "UInt", "desc": "0 for current path" },
        { "name": "pszPath", "type": "Str", "desc": "Buffer to receive path (MAX_PATH)" }
      ],
      "return": "Int",
      "desc": "Retrieves the path of a special folder by CSIDL value"
    }
  },
  "Dwmapi": {
    "DwmSetWindowAttribute": {
      "params": [
        { "name": "hwnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "dwAttribute", "type": "UInt", "desc": "Attribute to set (20=DWMWA_USE_IMMERSIVE_DARK_MODE)" },
        { "name": "pvAttribute", "type": "Ptr", "desc": "Pointer to attribute value" },
        { "name": "cbAttribute", "type": "UInt", "desc": "Size of attribute value in bytes" }
      ],
      "return": "Int",
      "desc": "Sets Desktop Window Manager rendering attributes for a window"
    },
    "DwmExtendFrameIntoClientArea": {
      "params": [
        { "name": "hWnd", "type": "Ptr", "desc": "Handle to the window" },
        { "name": "pMarInset", "type": "Ptr", "desc": "Pointer to MARGINS struct" }
      ],
      "return": "Int",
      "desc": "Extends the window frame into the client area"
    }
  },
  "Advapi32": {
    "RegOpenKeyExW": {
      "params": [
        { "name": "hKey", "type": "Ptr", "desc": "Handle to open key (0x80000001=HKCU, 0x80000002=HKLM)" },
        { "name": "lpSubKey", "type": "Str", "desc": "Subkey name" },
        { "name": "ulOptions", "type": "UInt", "desc": "Reserved, use 0" },
        { "name": "samDesired", "type": "UInt", "desc": "Access mask (0x20019=KEY_READ)" },
        { "name": "phkResult", "type": "Ptr", "desc": "Pointer to Ptr receiving opened key handle" }
      ],
      "return": "Int",
      "desc": "Opens a registry key"
    },
    "RegCloseKey": {
      "params": [
        { "name": "hKey", "type": "Ptr", "desc": "Handle to the open key" }
      ],
      "return": "Int",
      "desc": "Closes a registry key handle"
    },
    "RegQueryValueExW": {
      "params": [
        { "name": "hKey", "type": "Ptr", "desc": "Handle to the open key" },
        { "name": "lpValueName", "type": "Str", "desc": "Value name" },
        { "name": "lpReserved", "type": "Ptr", "desc": "Reserved, use 0" },
        { "name": "lpType", "type": "Ptr", "desc": "Pointer to UInt receiving type" },
        { "name": "lpData", "type": "Ptr", "desc": "Pointer to buffer receiving data" },
        { "name": "lpcbData", "type": "Ptr", "desc": "Pointer to UInt with buffer size" }
      ],
      "return": "Int",
      "desc": "Retrieves the type and data for a registry value"
    },
    "OpenProcessToken": {
      "params": [
        { "name": "ProcessHandle", "type": "Ptr", "desc": "Handle to the process" },
        { "name": "DesiredAccess", "type": "UInt", "desc": "Access rights (0x0008=TOKEN_QUERY)" },
        { "name": "TokenHandle", "type": "Ptr", "desc": "Pointer to Ptr receiving token handle" }
      ],
      "return": "Int",
      "desc": "Opens the access token associated with a process"
    }
  },
  "Ole32": {
    "CoInitialize": {
      "params": [
        { "name": "pvReserved", "type": "Ptr", "desc": "Reserved, must be 0" }
      ],
      "return": "Int",
      "desc": "Initializes the COM library on the current thread"
    },
    "CoUninitialize": {
      "params": [],
      "return": "void",
      "desc": "Closes the COM library on the current thread"
    },
    "CoTaskMemFree": {
      "params": [
        { "name": "pv", "type": "Ptr", "desc": "Pointer to memory block to free" }
      ],
      "return": "void",
      "desc": "Frees a block of COM task memory"
    }
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/dllcall-signatures.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/dllcall-signatures.json
git commit -m "feat: add Win32 DllCall signature database"
```

---

### Task 3: DllCall Completion & Hover Provider

**Files:**
- Create: `src/dllcallProvider.ts`

This provider does two things:
1. **Completions** — Inside `DllCall(` suggests `"DLL\Function"` names as the first arg, and valid AHK types in type-argument positions.
2. **Hover** — Over the first string argument of `DllCall(`, shows the full signature and description.

- [ ] **Step 1: Create the provider file with signature loading**

Create `src/dllcallProvider.ts`:

```typescript
/**
 * DllCall Completion & Hover Provider
 *
 * Provides IntelliSense for DllCall() using a bundled Win32 signature database.
 * The LSP treats DllCall arguments as plain strings — this fills the gap.
 *
 * @module dllcallProvider
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

/** Valid AHK v2 DllCall types. */
const AHK_TYPES = [
    'Str', 'AStr', 'WStr',
    'Int', 'Int64', 'Short', 'Char',
    'UInt', 'UInt64', 'UShort', 'UChar',
    'Float', 'Double',
    'Ptr', 'UPtr',
    'HRESULT',
];

let db: SignatureDb | undefined;

function loadDb(extensionPath: string): SignatureDb {
    if (db) { return db; }
    const jsonPath = path.join(extensionPath, 'dist', 'src', 'dllcall-signatures.json');
    const raw = fs.readFileSync(jsonPath, 'utf8');
    db = JSON.parse(raw) as SignatureDb;
    return db;
}

/** Build a flat lookup: "User32\\MessageBoxW" → DllSignature */
function buildIndex(sigs: SignatureDb): Map<string, { dll: string; fn: string; sig: DllSignature }> {
    const index = new Map<string, { dll: string; fn: string; sig: DllSignature }>();
    for (const [dll, funcs] of Object.entries(sigs)) {
        for (const [fn, sig] of Object.entries(funcs)) {
            index.set(`${dll}\\${fn}`.toLowerCase(), { dll, fn, sig });
        }
    }
    return index;
}

/**
 * Format a DllSignature into a readable Markdown block.
 */
function formatSignature(dll: string, fn: string, sig: DllSignature): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    // Header
    md.appendMarkdown(`**${dll}\\\\${fn}**\n\n`);
    md.appendMarkdown(`${sig.desc}\n\n`);

    // Signature line
    const paramStr = sig.params.map(p => `"${p.type}", ${p.name}`).join(', ');
    const retStr = sig.return === 'void' ? '' : `, "${sig.return}"`;
    md.appendCodeblock(`DllCall("${dll}\\${fn}"${paramStr ? ', ' + paramStr : ''}${retStr})`, 'autohotkey');

    // Parameter table
    if (sig.params.length > 0) {
        md.appendMarkdown('\n\n| Type | Name | Description |\n|------|------|-------------|\n');
        for (const p of sig.params) {
            md.appendMarkdown(`| \`${p.type}\` | ${p.name} | ${p.desc} |\n`);
        }
    }

    // Return
    md.appendMarkdown(`\n**Returns:** \`${sig.return}\``);

    return md;
}

/**
 * Detect if the cursor is inside a DllCall() and return context.
 * Returns undefined if not in a DllCall, or { argIndex } for the
 * 0-based argument position.
 */
function getDllCallContext(document: vscode.TextDocument, position: vscode.Position): { argIndex: number; lineText: string } | undefined {
    const lineText = document.lineAt(position.line).text;
    const textBefore = lineText.substring(0, position.character);

    // Walk backwards across lines to find DllCall(
    // Simple approach: scan current line and up to 5 lines above
    let fullText = textBefore;
    for (let i = position.line - 1; i >= Math.max(0, position.line - 5); i--) {
        fullText = document.lineAt(i).text + '\n' + fullText;
    }

    // Find the last DllCall( that hasn't been closed
    const dllCallMatch = fullText.match(/DllCall\s*\(([^)]*$)/i);
    if (!dllCallMatch) { return undefined; }

    const argsText = dllCallMatch[1];
    // Count commas to determine argument index (rough but effective)
    let commaCount = 0;
    let inString = false;
    let stringChar = '';
    for (const ch of argsText) {
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

    return { argIndex: commaCount, lineText };
}

export class DllCallCompletionProvider implements vscode.CompletionItemProvider {
    private index: Map<string, { dll: string; fn: string; sig: DllSignature }> | undefined;
    private sigs: SignatureDb | undefined;

    constructor(private extensionPath: string) {}

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
        if (!this.sigs || !this.index) { return undefined; }

        const ctx = getDllCallContext(document, position);
        if (!ctx) { return undefined; }

        // Arg 0 = function name → suggest "DLL\Function" entries
        if (ctx.argIndex === 0) {
            return this.functionCompletions();
        }

        // Odd args (1, 3, 5...) = type positions → suggest AHK types
        if (ctx.argIndex % 2 === 1) {
            return this.typeCompletions();
        }

        return undefined;
    }

    private functionCompletions(): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        for (const [, entry] of this.index!) {
            const item = new vscode.CompletionItem(
                `${entry.dll}\\${entry.fn}`,
                vscode.CompletionItemKind.Function,
            );
            item.detail = entry.sig.desc;
            item.documentation = formatSignature(entry.dll, entry.fn, entry.sig);

            // Insert the full DllCall snippet with all params
            const paramSnippet = entry.sig.params.map((p, i) =>
                `, "${p.type}", \${${i + 1}:${p.name}}`
            ).join('');
            const retSnippet = entry.sig.return !== 'void'
                ? `, "${entry.sig.return}"` : '';
            item.insertText = new vscode.SnippetString(
                `"${entry.dll}\\\\${entry.fn}"${paramSnippet}${retSnippet}`
            );

            // Replace just the current arg so the snippet lands cleanly
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
    private index: Map<string, { dll: string; fn: string; sig: DllSignature }> | undefined;
    private sigs: SignatureDb | undefined;

    constructor(private extensionPath: string) {}

    private ensureLoaded(): void {
        if (!this.sigs) {
            this.sigs = loadDb(this.extensionPath);
            this.index = buildIndex(this.sigs);
        }
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Hover | undefined {
        this.ensureLoaded();
        if (!this.index) { return undefined; }

        const range = document.getWordRangeAtPosition(position, /"[^"]+"/);
        if (!range) { return undefined; }

        const word = document.getText(range).replace(/"/g, '');

        // Check if this looks like a DLL\Function reference
        if (!word.includes('\\')) { return undefined; }

        // Verify we're inside a DllCall
        const ctx = getDllCallContext(document, position);
        if (!ctx || ctx.argIndex !== 0) { return undefined; }

        const entry = this.index.get(word.toLowerCase());
        if (!entry) { return undefined; }

        return new vscode.Hover(formatSignature(entry.dll, entry.fn, entry.sig), range);
    }
}

/**
 * Register DllCall completion and hover providers.
 * Call from activate() and push the returned disposable.
 */
export function registerDllCallProviders(context: vscode.ExtensionContext): vscode.Disposable {
    const extPath = context.extensionPath;
    const selector: vscode.DocumentSelector = [
        { language: 'ahk2' },
        { language: 'ahk' },
        { pattern: '**/*.ahk' },
    ];

    const completion = vscode.languages.registerCompletionItemProvider(
        selector,
        new DllCallCompletionProvider(extPath),
        '"',  // trigger on opening quote
    );

    const hover = vscode.languages.registerHoverProvider(
        selector,
        new DllCallHoverProvider(extPath),
    );

    const disposable = vscode.Disposable.from(completion, hover);
    context.subscriptions.push(disposable);
    return disposable;
}
```

- [ ] **Step 2: Compile and verify**

Run: `npx tsc --noEmit`
Expected: Exit code 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/dllcallProvider.ts
git commit -m "feat: add DllCall completion and hover provider"
```

---

### Task 4: Wire Providers into Extension Activation

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Add import and registration call**

At the top of `src/extension.ts`, add the import next to the existing `alphaBridge` import (line 28):

```typescript
import { registerDllCallProviders } from './dllcallProvider';
```

In the `activate()` function, after the `registerConsoleDiagnostics(ctx)` call (line 835), add:

```typescript
  // Register DllCall completion and hover providers
  registerDllCallProviders(ctx);
```

- [ ] **Step 2: Compile and verify**

Run: `npx tsc --noEmit`
Expected: Exit code 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire DllCall providers into extension activation"
```

---

### Task 5: Update Demo File and Manual Test

**Files:**
- Modify: `test/console-diag-demo.ahk`

- [ ] **Step 1: Add DllCall completion test section to the demo**

Append to `test/console-diag-demo.ahk`:

```autohotkey

; ---------------------------------------------------------------------------
; DllCall IntelliSense Test
;
; Place your cursor inside the DllCall quotes and trigger completions
; (Ctrl+Space) to see the signature database in action.
;
; Hover over "User32\MessageBoxW" to see the full signature tooltip.
; ---------------------------------------------------------------------------
testHwnd := DllCall("User32\FindWindowW", "Str", "", "Str", "Untitled - Notepad", "Ptr")

; Type DllCall(" here and trigger completions to browse available functions:
; DllCall("

; Hover over this to see the full signature:
testResult := DllCall("Kernel32\GetTickCount64", "UInt64")
```

- [ ] **Step 2: Full build and manual test**

Run: `npm run compile`
Expected: Clean build. Then reload the extension in VS Code (F5 or `Developer: Reload Window`) and:
1. Open `test/console-diag-demo.ahk`
2. Save it — check the "AHK Console Diagnostics" output channel for raw JSON
3. Type `DllCall("` and trigger Ctrl+Space — verify function suggestions appear
4. Hover over `"User32\FindWindowW"` — verify the signature tooltip appears
5. Check the Problems panel for `ahk-console` diagnostics

- [ ] **Step 3: Commit**

```bash
git add test/console-diag-demo.ahk
git commit -m "docs: add DllCall IntelliSense examples to demo file"
```

---

### Task 6: Ensure JSON File is Included in Build Output

**Files:**
- Modify: `tsconfig.json` (if needed)

The TypeScript compiler won't copy `.json` files to `dist/` unless `resolveJsonModule` is enabled, and even then only for imported JSON. Since we load the file at runtime via `fs.readFileSync`, we need to make sure it ends up in the build output.

- [ ] **Step 1: Add a copy step or adjust the load path**

Option A (simpler): Change the `loadDb` function in `dllcallProvider.ts` to look for the JSON relative to `extensionPath` root instead of `dist/`:

```typescript
function loadDb(extensionPath: string): SignatureDb {
    if (db) { return db; }
    // Try dist path first (compiled), fall back to src (dev)
    const distPath = path.join(extensionPath, 'dist', 'src', 'dllcall-signatures.json');
    const srcPath = path.join(extensionPath, 'src', 'dllcall-signatures.json');
    const jsonPath = fs.existsSync(distPath) ? distPath : srcPath;
    const raw = fs.readFileSync(jsonPath, 'utf8');
    db = JSON.parse(raw) as SignatureDb;
    return db;
}
```

Option B (proper): Add a copy script to `package.json` scripts:

```json
"compile": "tsc -p ./ && cp src/dllcall-signatures.json dist/src/dllcall-signatures.json"
```

Go with Option A for now — it works in both dev and packaged modes and requires no build tooling changes.

- [ ] **Step 2: Verify the JSON loads in both paths**

Run: `npm run compile && ls dist/src/ | grep dllcall`
If the JSON is NOT in dist (expected with pure tsc), verify `src/dllcall-signatures.json` exists as fallback.

Run: `node -e "const p=require('path'); const fs=require('fs'); const f=p.join('.','src','dllcall-signatures.json'); console.log(fs.existsSync(f) ? 'OK: src fallback exists' : 'MISSING')"`
Expected: `OK: src fallback exists`

- [ ] **Step 3: Commit**

```bash
git add src/dllcallProvider.ts
git commit -m "fix: support both dist and src paths for dllcall-signatures.json"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-04-09-live-diagnostics-and-dllcall.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?