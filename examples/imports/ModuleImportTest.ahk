#Requires AutoHotkey v2.1-alpha.17
#SingleInstance Force

; ═══════════════════════════════════════════════════════════════
; TEST: #Include vs import in AHK v2.1-alpha module system
; ═══════════════════════════════════════════════════════════════

; Step 1: Include loads the module file (defines #Module ArrayHelpers)
#Include ../../ImportArrayHelpersExample.ahk

results := ''

; TEST A: Is Sum() available after #Include only?
results .= 'After #Include only:`n'
results .= '  Sum: ' (IsSet(Sum) ? 'YES' : 'NO') '`n'
results .= '  ArrayHelpers: ' (IsSet(ArrayHelpers) ? 'YES' : 'NO') '`n`n'

; Step 2: Now import the module
import * from ArrayHelpers
import ArrayHelpers as ArrMod

; TEST B: Is Sum() available after import?
results .= 'After import * from ArrayHelpers:`n'
results .= '  Sum: ' (IsSet(Sum) ? 'YES' : 'NO') '`n'
results .= '  ArrayHelpers (module): ' (IsSet(ArrMod) ? 'YES' : 'NO') '`n`n'

; TEST C: Can we actually call them?
results .= 'Function calls:`n'
results .= '  Sum([1,2,3]) = ' Sum([1,2,3]) '`n'
results .= '  ArrMod([1,2,3])[`'sum`'] = ' ArrMod([1,2,3])['sum'] '`n'

MsgBox(results, 'Module Import Test Results')
