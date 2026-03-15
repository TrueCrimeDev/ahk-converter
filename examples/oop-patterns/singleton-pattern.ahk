#Requires AutoHotkey v2.0
#SingleInstance Force

/**
 * Singleton Pattern Example
 * 
 * Demonstrates:
 * - Singleton pattern for single-instance classes
 * - Static instance management
 * - Thread-safe instance creation
 * - Lazy initialization
 * - Global state management
 */

/**
 * Configuration Manager - Singleton Pattern
 * Ensures only one configuration instance exists globally
 */
class ConfigManager {
    static _instance := ""  ; Holds the single instance
    
    ; Configuration data
    settings := Map()
    isInitialized := false
    configPath := ""

    /**
     * Private constructor - prevents direct instantiation
     * To get instance, use ConfigManager.GetInstance()
     */
    __New() {
        ; Prevent multiple instances
        if (ConfigManager._instance) {
            throw Error("ConfigManager is a singleton. Use ConfigManager.GetInstance() instead of new ConfigManager()")
        }
        
        ; Initialize with default settings
        this.settings := Map(
            "appName", "My Application",
            "version", "1.0.0",
            "debug", false,
            "maxConnections", 10,
            "timeout", 30
        )
        this.configPath := A_ScriptDir . "\config.ini"
        this.isInitialized := true
    }

    /**
     * Get the singleton instance (creates if doesn't exist)
     * This is the only way to get a ConfigManager instance
     * @returns The single ConfigManager instance
     */
    static GetInstance() {
        if (!ConfigManager._instance) {
            ConfigManager._instance := ConfigManager()
        }
        return ConfigManager._instance
    }

    /**
     * Get a configuration value
     * @param key - Setting key
     * @param defaultValue - Default if key doesn't exist
     * @returns Configuration value
     */
    Get(key, defaultValue := "") {
        if (this.settings.Has(key)) {
            return this.settings[key]
        }
        return defaultValue
    }

    /**
     * Set a configuration value
     * @param key - Setting key
     * @param value - Setting value
     */
    Set(key, value) {
        this.settings[key] := value
    }

    /**
     * Get all settings
     */
    GetAll() {
        return this.settings.Clone()
    }

    /**
     * Save settings to file
     */
    Save() {
        content := "; Configuration File`n"
        content .= "; Generated: " . FormatTime(, "yyyy-MM-dd HH:mm:ss") . "`n`n"
        content .= "[Settings]`n"
        
        for key, value in this.settings {
            content .= Format("{1}={2}`n", key, value)
        }

        try {
            FileDelete(this.configPath)
        }
        FileAppend(content, this.configPath)
    }

    /**
     * Reset to default settings
     */
    Reset() {
        this.__New()  ; Re-initialize with defaults
    }
}

/**
 * Logger - Another Singleton Example
 * Ensures all parts of application use same logger
 */
class Logger {
    static _instance := ""
    
    logFile := ""
    logLevel := "INFO"
    levels := Map("DEBUG", 0, "INFO", 1, "WARN", 2, "ERROR", 3)

    __New() {
        if (Logger._instance) {
            throw Error("Logger is a singleton. Use Logger.GetInstance()")
        }
        
        this.logFile := A_ScriptDir . "\app.log"
    }

    static GetInstance() {
        if (!Logger._instance) {
            Logger._instance := Logger()
        }
        return Logger._instance
    }

    /**
     * Set minimum log level
     */
    SetLevel(level) {
        if (this.levels.Has(level)) {
            this.logLevel := level
        }
    }

    /**
     * Write log entry
     */
    Log(level, message) {
        ; Check if this level should be logged
        if (this.levels[level] < this.levels[this.logLevel]) {
            return
        }

        timestamp := FormatTime(A_Now, "yyyy-MM-dd HH:mm:ss")
        logLine := Format("[{1}] [{2}] {3}`n", timestamp, level, message)
        
        try {
            FileAppend(logLine, this.logFile)
        } catch Error as e {
            MsgBox("Failed to write to log: " . e.Message)
        }
    }

    Debug(msg) => this.Log("DEBUG", msg)
    Info(msg) => this.Log("INFO", msg)
    Warn(msg) => this.Log("WARN", msg)
    Error(msg) => this.Log("ERROR", msg)
}

/**
 * Application State - Thread-safe Singleton with Initialization
 */
class AppState {
    static _instance := ""
    static _isInitializing := false
    
    currentUser := ""
    isAuthenticated := false
    sessionId := ""
    startTime := ""
    stats := Map()

    __New() {
        if (AppState._instance) {
            throw Error("AppState is a singleton. Use AppState.GetInstance()")
        }

        this.startTime := A_Now
        this.sessionId := this.GenerateSessionId()
        this.stats := Map(
            "requests", 0,
            "errors", 0,
            "startTime", this.startTime
        )
    }

    static GetInstance() {
        ; Thread-safe initialization (simulated)
        if (!AppState._instance && !AppState._isInitializing) {
            AppState._isInitializing := true
            AppState._instance := AppState()
            AppState._isInitializing := false
        }
        
        ; Wait if another thread is initializing
        while (AppState._isInitializing) {
            Sleep(10)
        }
        
        return AppState._instance
    }

    /**
     * Generate unique session ID
     */
    GenerateSessionId() {
        return Format("{1}-{2}", A_TickCount, Random(1000, 9999))
    }

    /**
     * Set current user
     */
    Login(username) {
        this.currentUser := username
        this.isAuthenticated := true
        Logger.GetInstance().Info("User logged in: " . username)
    }

    /**
     * Clear current user
     */
    Logout() {
        Logger.GetInstance().Info("User logged out: " . this.currentUser)
        this.currentUser := ""
        this.isAuthenticated := false
    }

    /**
     * Increment stat counter
     */
    IncrementStat(statName) {
        if (!this.stats.Has(statName)) {
            this.stats[statName] := 0
        }
        this.stats[statName]++
    }

    /**
     * Get application uptime
     */
    GetUptime() {
        diff := DateDiff(A_Now, this.startTime, "Seconds")
        hours := Floor(diff / 3600)
        minutes := Floor(Mod(diff, 3600) / 60)
        seconds := Mod(diff, 60)
        return Format("{1}h {2}m {3}s", hours, minutes, seconds)
    }
}

/**
 * Demo: Basic Singleton Usage
 */
DemoBasicSingleton() {
    result := "Singleton Pattern - Basic Usage`n`n"

    ; Get first instance
    config1 := ConfigManager.GetInstance()
    config1.Set("username", "Alice")
    result .= "Instance 1 - Set username to 'Alice'`n"

    ; Get second "instance" - actually same instance!
    config2 := ConfigManager.GetInstance()
    username := config2.Get("username")
    result .= "Instance 2 - Get username: '" . username . "'`n`n"

    ; Verify they are the same instance
    if (config1 === config2) {
        result .= "✓ Both variables point to same instance!`n"
        result .= "  This is the Singleton pattern in action.`n"
    } else {
        result .= "✗ Different instances (shouldn't happen!)"
    }

    MsgBox(result, "Singleton Pattern Demo")
}

/**
 * Demo: Multiple Singletons Working Together
 */
DemoMultipleSingletons() {
    result := "Multiple Singletons Demo`n`n"

    ; Initialize singletons
    config := ConfigManager.GetInstance()
    logger := Logger.GetInstance()
    state := AppState.GetInstance()

    ; Configure application
    config.Set("appName", "Singleton Demo")
    config.Set("debug", true)
    
    logger.SetLevel("DEBUG")
    
    ; Simulate user actions
    state.Login("Bob")
    logger.Info("Application started")
    
    state.IncrementStat("requests")
    state.IncrementStat("requests")
    state.IncrementStat("requests")
    
    ; Get data from all singletons
    result .= "Configuration:`n"
    result .= "  App Name: " . config.Get("appName") . "`n"
    result .= "  Debug: " . config.Get("debug") . "`n`n"
    
    result .= "Application State:`n"
    result .= "  Current User: " . state.currentUser . "`n"
    result .= "  Session ID: " . state.sessionId . "`n"
    result .= "  Uptime: " . state.GetUptime() . "`n"
    result .= "  Requests: " . state.stats["requests"] . "`n`n"
    
    result .= "✓ All singletons working together!"

    MsgBox(result, "Multiple Singletons Demo")
}

/**
 * Demo: Error on Direct Instantiation
 */
DemoInstantiationError() {
    result := "Preventing Direct Instantiation`n`n"

    ; Try to create instance directly (should fail!)
    try {
        config := ConfigManager()  ; Wrong way!
        result .= "✗ Created instance directly (shouldn't happen!)`n"
    } catch Error as e {
        result .= "✓ Caught error on direct instantiation:`n"
        result .= "  " . e.Message . "`n`n"
    }

    ; Show correct way
    result .= "Correct way:`n"
    result .= "  config := ConfigManager.GetInstance()`n`n"
    
    config := ConfigManager.GetInstance()
    result .= "✓ Got instance correctly via GetInstance()"

    MsgBox(result, "Instantiation Demo")
}

/**
 * Main demo
 */
Main() {
    choice := MsgBox(
        "Singleton Pattern Demo`n`n"
        "This example demonstrates:`n"
        "• Singleton pattern for single instances`n"
        "• Static instance management`n"
        "• Private constructor pattern`n"
        "• Thread-safe initialization`n"
        "• Global state management`n`n"
        "Choose a demo:`n`n"
        "Yes = Basic Singleton`n"
        "No = Multiple Singletons`n"
        "Cancel = Instantiation Error",
        "Singleton Pattern Example",
        "YesNoCancel"
    )

    switch choice {
        case "Yes":
            DemoBasicSingleton()
        case "No":
            DemoMultipleSingletons()
        case "Cancel":
            DemoInstantiationError()
    }
}

; Run the demo
Main()

/**
 * Key Learning Points:
 * 
 * 1. SINGLETON PATTERN PURPOSE
 *    - Ensures only ONE instance of a class exists
 *    - Provides global access point to that instance
 *    - Useful for: Config, Logger, Database connections
 * 
 * 2. IMPLEMENTATION STEPS
 *    - Static variable to hold the instance
 *    - Private constructor (throw if called directly)
 *    - Static GetInstance() method
 *    - Lazy initialization (create on first access)
 * 
 * 3. BENEFITS
 *    - Controlled access to single instance
 *    - Reduced memory footprint
 *    - Global state management
 *    - Consistent behavior across application
 * 
 * 4. WHEN TO USE
 *    ✓ Configuration management
 *    ✓ Logging systems
 *    ✓ Database connections
 *    ✓ Application state
 *    ✓ Resource pools
 * 
 * 5. WHEN NOT TO USE
 *    ✗ When you need multiple instances
 *    ✗ For stateless utilities (use static class)
 *    ✗ When testing requires different instances
 *    ✗ Over-use leads to global state issues
 * 
 * 6. THREAD SAFETY (AHK v2 single-threaded, but good practice)
 *    - Check _isInitializing flag
 *    - Prevent race conditions
 *    - Defensive programming
 * 
 * BEST PRACTICES DEMONSTRATED:
 * ✓ Static instance variable
 * ✓ Private constructor pattern
 * ✓ Lazy initialization
 * ✓ Error on direct instantiation
 * ✓ Clear GetInstance() method
 * ✓ Thread-safe initialization
 * ✓ Meaningful error messages
 */
