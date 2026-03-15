#Requires AutoHotkey v2.0

; Test different include formats
#Include lib/utils.ahk
#Include <MyLib>

MsgBox "Main script loaded"
Utils()
MyLib()
