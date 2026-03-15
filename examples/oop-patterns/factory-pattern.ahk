#Requires AutoHotkey v2.0
#SingleInstance Force

/**
 * Factory Pattern Example
 * 
 * Demonstrates:
 * - Factory pattern for object creation
 * - Encapsulated object instantiation
 * - Configuration-driven object creation
 * - Error handling in factories
 * - Static factory methods
 */

/**
 * Base Database Connection class
 */
class DatabaseConnection {
    connectionString := ""
    isConnected := false
    dbType := ""

    __New(connectionString, dbType) {
        this.connectionString := connectionString
        this.dbType := dbType
    }

    /**
     * Connect to database (override in derived classes)
     */
    Connect() {
        throw Error("Abstract method Connect() must be implemented")
    }

    /**
     * Execute query (override in derived classes)
     */
    Query(sql) {
        throw Error("Abstract method Query() must be implemented")
    }

    /**
     * Close connection
     */
    Close() {
        this.isConnected := false
    }

    /**
     * Get connection info
     */
    GetInfo() {
        return Format("Database: {1}, Connected: {2}", this.dbType, this.isConnected)
    }
}

/**
 * MySQL Connection implementation
 */
class MySQLConnection extends DatabaseConnection {
    port := 3306

    __New(host, database, username, password, port := 3306) {
        connectionString := Format("Server={1};Database={2};User={3};Password=***;Port={4}",
            host, database, username, port)
        super.__New(connectionString, "MySQL")
        this.port := port
    }

    Connect() {
        ; Simulate connection
        this.isConnected := true
        return true
    }

    Query(sql) {
        if (!this.isConnected) {
            throw Error("Not connected to MySQL database")
        }
        ; Simulate query execution
        return Format("MySQL Query executed: {1}", sql)
    }
}

/**
 * PostgreSQL Connection implementation
 */
class PostgreSQLConnection extends DatabaseConnection {
    port := 5432

    __New(host, database, username, password, port := 5432) {
        connectionString := Format("Host={1};Database={2};Username={3};Password=***;Port={4}",
            host, database, username, port)
        super.__New(connectionString, "PostgreSQL")
        this.port := port
    }

    Connect() {
        ; Simulate connection
        this.isConnected := true
        return true
    }

    Query(sql) {
        if (!this.isConnected) {
            throw Error("Not connected to PostgreSQL database")
        }
        ; Simulate query execution
        return Format("PostgreSQL Query executed: {1}", sql)
    }
}

/**
 * SQLite Connection implementation
 */
class SQLiteConnection extends DatabaseConnection {
    filePath := ""

    __New(filePath) {
        connectionString := Format("Data Source={1}", filePath)
        super.__New(connectionString, "SQLite")
        this.filePath := filePath
    }

    Connect() {
        ; Simulate connection
        this.isConnected := true
        return true
    }

    Query(sql) {
        if (!this.isConnected) {
            throw Error("Not connected to SQLite database")
        }
        ; Simulate query execution
        return Format("SQLite Query executed: {1}", sql)
    }
}

/**
 * Database Factory - Creates database connections based on configuration
 * This is the Factory Pattern implementation
 */
class DatabaseFactory {
    /**
     * Create a database connection based on type and configuration
     * @param type - Database type ("mysql", "postgresql", "sqlite")
     * @param config - Configuration map with connection details
     * @returns DatabaseConnection instance
     */
    static Create(type, config) {
        ; Normalize type to lowercase
        type := StrLower(type)

        ; Create appropriate connection type
        switch type {
            case "mysql":
                return DatabaseFactory.CreateMySQL(config)
            case "postgresql", "postgres":
                return DatabaseFactory.CreatePostgreSQL(config)
            case "sqlite":
                return DatabaseFactory.CreateSQLite(config)
            default:
                throw ValueError("Unknown database type: " . type)
        }
    }

    /**
     * Create MySQL connection from config
     */
    static CreateMySQL(config) {
        ; Validate required config
        if (!config.Has("host")) {
            throw ValueError("MySQL config missing 'host'")
        }
        if (!config.Has("database")) {
            throw ValueError("MySQL config missing 'database'")
        }
        if (!config.Has("username")) {
            throw ValueError("MySQL config missing 'username'")
        }

        ; Get values with defaults
        host := config["host"]
        database := config["database"]
        username := config["username"]
        password := config.Has("password") ? config["password"] : ""
        port := config.Has("port") ? config["port"] : 3306

        return MySQLConnection(host, database, username, password, port)
    }

    /**
     * Create PostgreSQL connection from config
     */
    static CreatePostgreSQL(config) {
        ; Validate required config
        if (!config.Has("host")) {
            throw ValueError("PostgreSQL config missing 'host'")
        }
        if (!config.Has("database")) {
            throw ValueError("PostgreSQL config missing 'database'")
        }
        if (!config.Has("username")) {
            throw ValueError("PostgreSQL config missing 'username'")
        }

        ; Get values with defaults
        host := config["host"]
        database := config["database"]
        username := config["username"]
        password := config.Has("password") ? config["password"] : ""
        port := config.Has("port") ? config["port"] : 5432

        return PostgreSQLConnection(host, database, username, password, port)
    }

    /**
     * Create SQLite connection from config
     */
    static CreateSQLite(config) {
        ; Validate required config
        if (!config.Has("filePath") && !config.Has("file")) {
            throw ValueError("SQLite config missing 'filePath' or 'file'")
        }

        filePath := config.Has("filePath") ? config["filePath"] : config["file"]
        return SQLiteConnection(filePath)
    }

    /**
     * Create connection from connection string URL
     * Format: dbtype://host:port/database?user=username&password=password
     */
    static CreateFromUrl(url) {
        ; Simple URL parser (demo purposes)
        if (RegExMatch(url, "^(\w+)://(.+)$", &match)) {
            type := match[1]
            
            ; For simplicity, create SQLite for file paths
            if (type = "sqlite") {
                config := Map("filePath", match[2])
                return DatabaseFactory.CreateSQLite(config)
            }
        }

        throw ValueError("Invalid connection URL format")
    }
}

/**
 * Demo: Basic Factory Usage
 */
DemoBasicFactory() {
    result := "Factory Pattern - Basic Usage`n`n"

    try {
        ; Create MySQL connection using factory
        mysqlConfig := Map(
            "host", "localhost",
            "database", "myapp",
            "username", "root",
            "password", "secret",
            "port", 3306
        )
        db := DatabaseFactory.Create("mysql", mysqlConfig)
        db.Connect()
        result .= "✓ Created MySQL connection`n"
        result .= db.GetInfo() . "`n`n"

        ; Create PostgreSQL connection using factory
        postgresConfig := Map(
            "host", "localhost",
            "database", "myapp",
            "username", "admin",
            "password", "secret"
        )
        db2 := DatabaseFactory.Create("postgresql", postgresConfig)
        db2.Connect()
        result .= "✓ Created PostgreSQL connection`n"
        result .= db2.GetInfo() . "`n`n"

        ; Create SQLite connection using factory
        sqliteConfig := Map(
            "filePath", "C:\data\myapp.db"
        )
        db3 := DatabaseFactory.Create("sqlite", sqliteConfig)
        db3.Connect()
        result .= "✓ Created SQLite connection`n"
        result .= db3.GetInfo() . "`n"

    } catch Error as e {
        result .= "`n❌ Error: " . e.Message
    }

    MsgBox(result, "Factory Pattern Demo")
}

/**
 * Demo: Configuration-Driven Creation
 */
DemoConfigDriven() {
    result := "Configuration-Driven Object Creation`n`n"

    ; Simulate loading config from file/environment
    appConfigs := [
        Map("type", "mysql", "host", "db1.example.com", "database", "app1", "username", "user1"),
        Map("type", "postgresql", "host", "db2.example.com", "database", "app2", "username", "user2"),
        Map("type", "sqlite", "filePath", "C:\data\app.db")
    ]

    ; Create connections based on configurations
    for index, config in appConfigs {
        try {
            dbType := config["type"]
            db := DatabaseFactory.Create(dbType, config)
            db.Connect()
            result .= Format("Environment {1}: {2} ✓`n", index, db.GetInfo())
        } catch Error as e {
            result .= Format("Environment {1}: Error - {2}`n", index, e.Message)
        }
    }

    result .= "`nKey Point: Factory pattern allows creating different`n"
    result .= "object types from configuration without changing code!"

    MsgBox(result, "Config-Driven Demo")
}

/**
 * Demo: Error Handling
 */
DemoErrorHandling() {
    result := "Factory Error Handling`n`n"

    ; Try invalid database type
    try {
        db := DatabaseFactory.Create("oracle", Map())
        result .= "Created connection (unexpected!)`n"
    } catch ValueError as e {
        result .= "✓ Caught invalid type error:`n"
        result .= "  " . e.Message . "`n`n"
    }

    ; Try missing required config
    try {
        db := DatabaseFactory.Create("mysql", Map("host", "localhost"))  ; Missing database, username
        result .= "Created connection (unexpected!)`n"
    } catch ValueError as e {
        result .= "✓ Caught config validation error:`n"
        result .= "  " . e.Message . "`n"
    }

    MsgBox(result, "Error Handling Demo")
}

/**
 * Main demo
 */
Main() {
    choice := MsgBox(
        "Factory Pattern Demo`n`n"
        "This example demonstrates:`n"
        "• Factory pattern for object creation`n"
        "• Encapsulated instantiation logic`n"
        "• Configuration-driven design`n"
        "• Static factory methods`n"
        "• Error handling and validation`n`n"
        "Choose a demo:`n`n"
        "Yes = Basic Factory Usage`n"
        "No = Configuration-Driven`n"
        "Cancel = Error Handling",
        "Factory Pattern Example",
        "YesNoCancel"
    )

    switch choice {
        case "Yes":
            DemoBasicFactory()
        case "No":
            DemoConfigDriven()
        case "Cancel":
            DemoErrorHandling()
    }
}

; Run the demo
Main()

/**
 * Key Learning Points:
 * 
 * 1. FACTORY PATTERN BENEFITS
 *    - Centralizes object creation logic
 *    - Client code doesn't need to know concrete classes
 *    - Easy to add new database types
 *    - Configuration-driven instantiation
 * 
 * 2. WHEN TO USE FACTORY
 *    - Creating objects based on configuration
 *    - Multiple related classes with common interface
 *    - Complex object initialization
 *    - Need to switch implementations at runtime
 * 
 * 3. IMPLEMENTATION PATTERNS
 *    - Static factory methods (DatabaseFactory.Create)
 *    - Switch statement for type selection
 *    - Separate creation methods per type
 *    - Config validation in factory
 * 
 * 4. ERROR HANDLING
 *    - Validate configurations before creating objects
 *    - Throw meaningful errors for invalid types
 *    - Check for required config parameters
 * 
 * 5. EXTENSIBILITY
 *    - Add new database type: Create new class + update factory
 *    - No changes to client code needed
 *    - Factory encapsulates creation complexity
 * 
 * BEST PRACTICES DEMONSTRATED:
 * ✓ Static factory methods
 * ✓ Configuration validation
 * ✓ Meaningful error messages
 * ✓ Separation of concerns
 * ✓ Consistent interface across products
 * ✓ Defensive programming
 */
