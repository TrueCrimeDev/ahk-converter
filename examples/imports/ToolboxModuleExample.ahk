#Requires AutoHotkey v2.1
#SingleInstance Force

; Example module demonstrating the AutoHotkeyModuleGuide rules.

#Module ToolboxDemo
; Import the built-in AHK module so we can intentionally shadow MsgBox.
import AHK

const LOG_PREFIX := '[ToolboxModuleExample]'
export Version := '0.1.0'

; Exported helper that formats a status line for the toolbox UI.
export BuildStatus(message, meta := Map()) {
    status := LOG_PREFIX ' ' message
    if meta.Has('module') && meta['module']
        status .= ' (' meta['module'] ')'
    return status
}

; Exported function that shows a toast while preserving access to the built-in MsgBox.
export ShowToast(message, title := 'Toolbox Demo') {
    MsgBox(message, title)
}

; Default export demonstrates returning structured data for other modules.
export default GetMetadata() {
    return Map(
        'name', 'ToolboxDemo',
        'version', Version,
        'exports', ['BuildStatus', 'ShowToast', 'MsgBox']
    )
}

; Shadow the global MsgBox inside this module but keep the built-in via AHK.MsgBox.
MsgBox(Text?, Title := 'Toolbox Demo', Options := 'Iconi') {
    return AHK.MsgBox(Text?, Title, Options)
}
