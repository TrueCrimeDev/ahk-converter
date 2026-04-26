#Requires AutoHotkey v2.1-alpha.25
#SingleInstance Force

; =============================================================================
; Console Diagnostics Demo
;
; Save this file to trigger `AutoHotkey64.exe check /Diag=json`.
; Every section here has ZERO coverage from thqby's LSP.
; =============================================================================


; ---------------------------------------------------------------------------
; 1. #Requires version mismatch
;    The LSP syntax-highlights this directive but never validates the version
;    against the actual interpreter build.  If the installed interpreter is
;    older than alpha.25, check /Diag=json will flag it.
; ---------------------------------------------------------------------------
; (The #Requires v2.1-alpha.25 at line 1 is the trigger.)


; ---------------------------------------------------------------------------
; 2. DllCall type validation — invalid arg/return types at load time
;    The LSP treats DllCall arguments as plain strings and never checks them
;    against the interpreter's known type table.
; ---------------------------------------------------------------------------
result1 := DllCall("User32\MessageBoxW"
    , "Ptr", 0
    , "FakeType", "Hello"                  ; invalid arg type
    , "Str", "Title"
    , "UInt", 0)

result2 := DllCall("Kernel32\GetTickCount"
    , "BadReturn")                         ; invalid return type


; ---------------------------------------------------------------------------
; 3. Export / global conflicts (module system)
;    The LSP has no understanding of module exports.  The interpreter detects
;    when `export global` clashes with an existing `global`.
; ---------------------------------------------------------------------------
global g := "module-level global"
; export global g := "conflict"            ; uncomment to trigger the clash


; ---------------------------------------------------------------------------
; DllCall IntelliSense Test
;
; Place your cursor inside the DllCall quotes and trigger completions
; (Ctrl+Space) to see the signature database in action.
;
; Hover over "User32\FindWindowW" to see the full signature tooltip.
; ---------------------------------------------------------------------------
testHwnd := DllCall("User32\FindWindowW", "Str", "", "Str", "Untitled - Notepad", "Ptr")

; Type DllCall(" here and trigger completions to browse available functions:
; DllCall("

; Hover over this to see the full signature:
testResult := DllCall("Kernel32\GetTickCount64", "UInt64")
