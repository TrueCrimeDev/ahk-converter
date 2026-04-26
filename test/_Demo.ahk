#Requires AutoHotkey v2.1-alpha.17
#SingleInstance Force

#Include Library_lvl1.ahk

globalCounter := 0

/**
 * Demonstrates AHK v2 method types with various variable scopes.
 * Manages both instance and class-level counters with logging.
 */
class MethodDemo {
    static classCounter := 0
    instanceCounter := 0

    __New() {
        this.instanceCounter := 0
        MethodDemo.classCounter++
        globalCounter++
    }

    /**
     * Increments instance counter and returns current value.
     * @returns {Integer} Current instance counter value
     */
    IncrementInstance() {
        localVar := 1
        this.instanceCounter += localVar
        return this.instanceCounter
    }

    /**
     * Increments class counter and logs all counter states.
     * @returns {Integer} Current class counter value
     */
    static IncrementClass() {
        MethodDemo.classCounter++
        return MethodDemo.classCounter
    }

    /**
     * Displays current state of all counters.
     */
    ShowStatus() {
        status := "Instance: " this.instanceCounter
            . "`nClass: " MethodDemo.classCounter
            . "`nGlobal: " globalCounter
        MsgBox(status)
    }
}

