#Requires AutoHotkey v2.1-alpha.17

; String helper module for native import system
; Note: No #Module directive needed - file becomes module when imported

export TitleCase(text) {
    words := StrSplit(text, ' ')
    for index, word in words {
        words[index] := StrLen(word)
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

export Pad(text, length, padChar := ' ') {
    if StrLen(text) >= length {
        return text
    }
    needed := length - StrLen(text)
    padding := ''
    loop needed {
        padding .= padChar
    }
    return text . padding
}

export default BuildLabel(text) {
    return Map(
        'title', TitleCase(text),
        'slug', Slugify(text),
        'padded', Pad(text, 20, '.')
    )
}
