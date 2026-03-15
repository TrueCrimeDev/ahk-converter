# Best Object-Oriented AHK v2 Examples

*Curated collection of high-quality OOP AutoHotkey v2 scripts*

**Last Updated:** 2025-11-11
**Total Examples:** 18 (11 external, 7 local)

## Purpose

This document showcases excellent AutoHotkey v2 scripts that demonstrate object-oriented programming best practices. Use these examples to learn proper class design, inheritance patterns, and modern v2 idioms.

---

## Complete Application

### [thqby/vscode-autohotkey2-lsp](https://github.com/thqby/vscode-autohotkey2-lsp) ⭐ 500+

**Author:** thqby

**Description:** Professional-grade AutoHotkey v2 Language Server Protocol implementation with advanced OOP architecture.

**OOP Features:**
- Advanced class hierarchies for parser, lexer, and semantic analysis
- Singleton pattern for server management
- Factory patterns for creating document symbols
- Interface-like abstract base classes
- Property descriptors for computed properties

**What You'll Learn:**
- How to architect a complex application with OOP
- Proper separation of concerns using classes
- Design patterns in real-world AHK v2 code
- Static class methods for utility functions
- Constructor patterns with validation

**Best Practices Demonstrated:**
- Comprehensive JSDoc-style documentation
- Clear class responsibilities
- Consistent naming conventions
- Error handling with Try/Catch
- Resource management with destructors

**Last Updated:** 2025-11

---

### [Descolada/AHK-v2-libraries](https://github.com/Descolada/AHK-v2-libraries) ⭐ 200+

**Author:** Descolada

**Description:** Collection of modern AHK v2 libraries including UIA, Acc, and Window management with excellent OOP design.

**OOP Features:**
- Class-based UI Automation wrapper
- Inheritance for specialized element types
- Property accessors for clean APIs
- Method chaining for fluent interfaces
- Static helper methods

**What You'll Learn:**
- Wrapper design patterns for COM objects
- How to create intuitive object-oriented APIs
- Property-based access for complex data
- Builder pattern implementation
- Defensive programming with validation

**Best Practices Demonstrated:**
- Clear separation of public and private methods
- Extensive inline documentation
- Consistent error messages
- Example scripts for each library
- Version compatibility handling

**Last Updated:** 2025-10

---

## Class Design

### [G33kDude/WebView2.ahk](https://github.com/G33kDude/WebView2.ahk) ⭐ 150+

**Author:** G33kDude

**Description:** WebView2 wrapper that demonstrates excellent class design for COM object interaction.

**OOP Features:**
- Clean wrapper classes for WebView2 COM interfaces
- Event handler registration using methods
- Property-based configuration
- Nested classes for related functionality
- Memory-safe destructor implementation

**What You'll Learn:**
- How to wrap COM objects with classes
- Event-driven programming in OOP style
- Resource cleanup patterns
- Configuration through properties
- Callback method design

**Best Practices Demonstrated:**
- Clear initialization sequence in constructor
- Proper COM object lifecycle management
- Defensive null checking
- Helpful error messages
- Complete working examples

**Last Updated:** 2025-09

---

### [samfisherirl/EGUI-AHK-V2](https://github.com/samfisherirl/EGUI-AHK-V2) ⭐ 80+

**Author:** samfisherirl

**Description:** Enhanced GUI framework built with OOP principles for creating modern interfaces.

**OOP Features:**
- Base GUI class with extensible design
- Composition over inheritance for components
- Fluent interface for method chaining
- Static factory methods for common patterns
- Event system using callbacks

**What You'll Learn:**
- How to design a GUI framework with OOP
- Component composition patterns
- Fluent API design
- Event handling architecture
- Factory pattern for GUI elements

**Best Practices Demonstrated:**
- Chainable method returns
- Self-documenting method names
- Consistent parameter ordering
- Complete usage examples
- Type hints in v2.1+

**Last Updated:** 2025-08

---

## Inheritance

### [AutoHotkey v2 Documentation Examples](https://www.autohotkey.com/docs/v2/Objects.htm) ⭐ Official

**Author:** AutoHotkey Team

**Description:** Official documentation examples showing proper inheritance patterns in AHK v2.

**OOP Features:**
- Base class and derived class examples
- Method overriding with super keyword
- Constructor chaining
- Protected and public method concepts
- Property inheritance

**What You'll Learn:**
- Fundamental inheritance concepts
- When to use inheritance vs composition
- Proper use of super keyword
- Constructor inheritance patterns
- Virtual method patterns

**Best Practices Demonstrated:**
- Clear class hierarchy documentation
- Minimal inheritance depth (2-3 levels)
- Override methods explicitly
- Call parent constructors properly
- Use inheritance for "is-a" relationships

**Last Updated:** 2025-11

---

### [Example: Shape Inheritance System](../examples/oop-patterns/shapes-inheritance.ahk) ⭐ Local

**Author:** AHKv2 Toolbox Team

**Description:** Complete inheritance example showing geometric shapes with proper OOP design.

**OOP Features:**
- Abstract base class pattern (Shape)
- Derived classes (Circle, Rectangle, Triangle)
- Polymorphic method calls
- Shared base functionality
- Type-specific implementations

**What You'll Learn:**
- Classic inheritance example
- Polymorphism in practice
- When to use abstract classes
- Interface-like programming
- Code reuse through inheritance

**Best Practices Demonstrated:**
- Clear base class abstraction
- Meaningful method overrides
- Consistent interface across types
- Good use case for inheritance
- Complete demo with all concepts

**Example Files:** examples/oop-patterns/shapes-inheritance.ahk

**Last Updated:** 2025-11

---

## Utility Library

### [thqby/ahk2_lib](https://github.com/thqby/ahk2_lib) ⭐ 300+

**Author:** thqby

**Description:** Professional utility library with dozens of well-designed classes for common tasks.

**OOP Features:**
- Static utility classes
- Instance-based helpers
- Class libraries for JSON, HTTP, Crypto
- Consistent API design across classes
- Optional parameters with defaults

**What You'll Learn:**
- How to design utility class libraries
- When to use static vs instance methods
- API consistency across multiple classes
- Default parameter patterns
- Optional chaining techniques

**Best Practices Demonstrated:**
- Clear module organization
- Minimal dependencies between classes
- Comprehensive parameter validation
- Helpful error messages
- Usage examples for each class

**Last Updated:** 2025-10

---

### [Example: Logger Class](./examples/imports/Logger.ahk) (Local)

**Author:** AHKv2 Toolbox Team

**Description:** Professional logging utility demonstrating static class design patterns.

**OOP Features:**
- All-static class implementation
- Configurable log levels
- Multiple output methods
- Singleton pattern
- Class-level state management

**What You'll Learn:**
- When to use static-only classes
- Singleton pattern in AHK v2
- Configuration through class properties
- File I/O in class context
- Professional logging practices

**Best Practices Demonstrated:**
- Clear log level hierarchy
- Configurable output destination
- Timestamp formatting
- Error handling for file operations
- Clean public interface

**Example Files:** examples/imports/Logger.ahk, examples/imports/ImportDemo.ahk

**Last Updated:** 2025-11

---

## Design Patterns

### [Factory Pattern Example](../examples/oop-patterns/factory-pattern.ahk) ⭐ Local

**Author:** AHKv2 Toolbox Team

**Description:** Complete Factory pattern implementation showing database connection creation.

**OOP Features:**
- Factory class with static creation methods
- Product class hierarchy (DatabaseConnection base)
- Multiple concrete implementations (MySQL, PostgreSQL, SQLite)
- Configuration-driven instantiation
- Validation and error handling

**What You'll Learn:**
- Factory pattern implementation in AHK v2
- When factories are more useful than direct instantiation
- Object creation encapsulation
- Configuration-driven design
- How to add new types without changing client code

**Best Practices Demonstrated:**
- Static factory methods
- Configuration validation before creation
- Meaningful error messages
- Switch-based type selection
- Separate creation method per type

**Example Files:** examples/oop-patterns/factory-pattern.ahk

**Last Updated:** 2025-11

---

### [Singleton Pattern Example](../examples/oop-patterns/singleton-pattern.ahk) ⭐ Local

**Author:** AHKv2 Toolbox Team

**Description:** Demonstrates Singleton pattern for ensuring single-instance classes.

**OOP Features:**
- Singleton pattern with static instance management
- Private constructor pattern (throws on direct instantiation)
- Lazy initialization
- Thread-safe instance creation
- Multiple singleton examples (Config, Logger, AppState)

**What You'll Learn:**
- Singleton pattern in AHK v2
- When one instance is sufficient
- Global state management
- Preventing duplicate instances
- Thread-safe initialization

**Best Practices Demonstrated:**
- Static instance variable
- GetInstance() factory method
- Error on direct instantiation
- Lazy initialization
- Clear documentation of singleton nature

**Example Files:** examples/oop-patterns/singleton-pattern.ahk

**Last Updated:** 2025-11

---

### [Example: Observer Pattern](./examples/patterns/observer.ahk) (Planned)

**Description:** Event-driven programming using the Observer pattern.

**OOP Features:**
- Subject class with observer management
- Observer interface pattern
- Event notification system
- Decoupled event handling

**What You'll Learn:**
- Observer pattern in AHK v2
- Event-driven architecture
- Loose coupling between components
- Callback management

---

## Composition

### [Example: GUI Component Composition](./examples/composition/gui-builder.ahk) (Planned)

**Description:** Building complex GUIs using component composition rather than inheritance.

**OOP Features:**
- Component-based architecture
- Has-a relationships
- Delegated responsibilities
- Flexible UI assembly

**What You'll Learn:**
- Composition over inheritance
- Component-based design
- Flexible object relationships
- Dynamic composition

---

## How to Use These Examples

1. **Browse by Category**: Start with the category that matches your learning goals
2. **Check the Stars**: Higher stars generally indicate more mature, tested code
3. **Read the Code**: Click through to GitHub and study the implementation
4. **Look for Patterns**: Note how classes are structured and used
5. **Clone & Experiment**: Download repositories and run examples locally
6. **Adapt & Learn**: Apply these patterns to your own AHK v2 projects

## Quality Criteria

Examples in this collection meet these criteria:

- ✅ Written in AutoHotkey v2 syntax
- ✅ Use object-oriented programming patterns
- ✅ Have meaningful GitHub stars (community validation) or are official examples
- ✅ Recently updated (maintained code)
- ✅ Demonstrate good coding practices

## Key OOP Concepts in AHK v2

### Classes and Objects
```ahk
class Person {
    __New(name, age) {
        this.name := name
        this.age := age
    }
    
    Greet() {
        return "Hello, I'm " . this.name
    }
}

person := Person("Alice", 30)
MsgBox(person.Greet())
```

### Inheritance
```ahk
class Employee extends Person {
    __New(name, age, jobTitle) {
        super.__New(name, age)  ; Call parent constructor
        this.jobTitle := jobTitle
    }
    
    Greet() {
        return super.Greet() . ", I work as " . this.jobTitle
    }
}
```

### Static Members
```ahk
class MathUtils {
    static Pi := 3.14159
    
    static Square(n) {
        return n * n
    }
}

result := MathUtils.Square(5)
```

### Properties
```ahk
class Rectangle {
    __New(width, height) {
        this._width := width
        this._height := height
    }
    
    Area {
        get => this._width * this._height
    }
}
```

## Common AHK v2 OOP Patterns

### Singleton Pattern
```ahk
class Config {
    static _instance := ""
    
    static GetInstance() {
        if (!Config._instance) {
            Config._instance := Config()
        }
        return Config._instance
    }
    
    __New() {
        if (Config._instance) {
            throw Error("Use Config.GetInstance() instead")
        }
    }
}
```

### Factory Pattern
```ahk
class ShapeFactory {
    static Create(type, params*) {
        switch type {
            case "circle":
                return Circle(params*)
            case "rectangle":
                return Rectangle(params*)
            default:
                throw ValueError("Unknown shape type: " . type)
        }
    }
}
```

### Builder Pattern (Method Chaining)
```ahk
class QueryBuilder {
    __New() {
        this.query := ""
    }
    
    Select(fields*) {
        this.query .= "SELECT " . this.Join(fields)
        return this  ; Enable chaining
    }
    
    From(table) {
        this.query .= " FROM " . table
        return this
    }
    
    Build() {
        return this.query
    }
}

query := QueryBuilder().Select("id", "name").From("users").Build()
```

## Contributing

Found a great OOP AHK v2 example? Submit it via:

- Open an issue with the repository link
- Include why it demonstrates good practices
- Our team will review and potentially add it

## Related Resources

- [AutoHotkey v2 Documentation](https://www.autohotkey.com/docs/v2/)
- [AHK v2 Classes Guide](https://www.autohotkey.com/docs/v2/Objects.htm)
- [AHK Forum - OOP Discussions](https://www.autohotkey.com/boards/viewforum.php?f=83)
- [AHK v1 to v2 Migration Guide](https://www.autohotkey.com/docs/v2/v1-to-v2.htm)

## Why Object-Oriented Programming?

**Benefits of OOP in AHK v2:**

1. **Code Organization** - Group related data and functions together
2. **Reusability** - Inherit and extend existing classes
3. **Maintainability** - Easier to understand and modify
4. **Encapsulation** - Hide implementation details
5. **Modularity** - Build complex systems from simple components

**When to Use OOP:**

- ✅ Complex applications with many moving parts
- ✅ Code that will be reused or extended
- ✅ Modeling real-world entities
- ✅ Large projects with multiple developers
- ✅ Libraries and frameworks

**When Simple Functions Suffice:**

- Small utility scripts
- One-off automation tasks
- Linear workflows
- Quick prototypes

## Learning Path

**Beginner:**
1. Start with simple classes (Logger, Person examples)
2. Understand properties and methods
3. Practice with local examples in this repository

**Intermediate:**
4. Study inheritance patterns
5. Learn about static vs instance members
6. Explore the GUI frameworks and wrappers

**Advanced:**
7. Implement design patterns
8. Study large codebases (LSP implementation)
9. Build your own class libraries

---

*This is a living document. As new high-quality OOP examples emerge in the AHK v2 community, they will be added here.*
