# AHK v2 OOP Pattern Examples

This directory contains working examples demonstrating object-oriented programming patterns in AutoHotkey v2.

## Available Examples

### 1. Shapes Inheritance (`shapes-inheritance.ahk`)

**Concepts Demonstrated:**
- Inheritance with `extends` keyword
- Abstract base class pattern
- Method overriding
- Constructor chaining with `super.__New()`
- Polymorphism

**Classes:**
- `Shape` - Abstract base class
- `Circle` - Derived class with area calculation
- `Rectangle` - Derived class with additional `IsSquare()` method
- `Triangle` - Derived class demonstrating constructor chaining

**Run it:**
```
AutoHotkey64.exe shapes-inheritance.ahk
```

**Key Learning:**
- How inheritance creates "is-a" relationships
- When to use abstract base classes
- How polymorphism enables treating different types uniformly

---

### 2. Factory Pattern (`factory-pattern.ahk`)

**Concepts Demonstrated:**
- Factory pattern for object creation
- Static factory methods
- Configuration-driven instantiation
- Error handling and validation
- Encapsulated creation logic

**Classes:**
- `DatabaseConnection` - Abstract base class
- `MySQLConnection`, `PostgreSQLConnection`, `SQLiteConnection` - Concrete implementations
- `DatabaseFactory` - Factory with static creation methods

**Run it:**
```
AutoHotkey64.exe factory-pattern.ahk
```

**Key Learning:**
- How to centralize object creation
- Configuration-driven design
- Adding new types without changing client code

---

### 3. Singleton Pattern (`singleton-pattern.ahk`)

**Concepts Demonstrated:**
- Singleton pattern for single-instance classes
- Static instance management
- Private constructor pattern
- Lazy initialization
- Thread-safe initialization

**Classes:**
- `ConfigManager` - Configuration singleton
- `Logger` - Logging singleton
- `AppState` - Application state singleton

**Run it:**
```
AutoHotkey64.exe singleton-pattern.ahk
```

**Key Learning:**
- When one instance is enough
- Global state management
- Preventing duplicate instances

---

## How to Use These Examples

1. **Read the Code First**: Each file has extensive comments explaining the concepts
2. **Run the Scripts**: See the patterns in action
3. **Modify and Experiment**: Change the code to understand how it works
4. **Apply to Your Projects**: Use these patterns in your own AHK scripts

## Learning Path

**Beginner:**
1. Start with `shapes-inheritance.ahk` to understand basic OOP
2. Learn about classes, inheritance, and polymorphism
3. Practice creating your own class hierarchies

**Intermediate:**
4. Study `factory-pattern.ahk` for creation patterns
5. Understand when factories are useful
6. Apply to your own object creation needs

**Advanced:**
7. Explore `singleton-pattern.ahk` for advanced patterns
8. Learn about design patterns in general
9. Combine patterns to solve complex problems

## Additional Resources

- [Best OOP Examples](../docs/BEST_OOP_EXAMPLES.md) - Curated collection of real-world examples
- [AutoHotkey v2 Objects Guide](https://www.autohotkey.com/docs/v2/Objects.htm)
- [AHK v2 Classes Documentation](https://www.autohotkey.com/docs/v2/Language.htm#classes)

## Common OOP Patterns in AHK v2

### Basic Class
```ahk
class Person {
    name := ""
    
    __New(name) {
        this.name := name
    }
    
    Greet() {
        return "Hello, I'm " . this.name
    }
}
```

### Inheritance
```ahk
class Employee extends Person {
    jobTitle := ""
    
    __New(name, jobTitle) {
        super.__New(name)  ; Call parent constructor
        this.jobTitle := jobTitle
    }
}
```

### Static Methods
```ahk
class MathUtils {
    static Square(n) {
        return n * n
    }
}

result := MathUtils.Square(5)  ; No instance needed
```

### Properties
```ahk
class Rectangle {
    width := 0
    height := 0
    
    Area {
        get => this.width * this.height
    }
}
```

## Tips for Writing OOP in AHK v2

1. **Use `:=` for all assignments** (never `=`)
2. **Call parent constructors with `super.__New()`**
3. **Use `this.` to access instance members**
4. **Static members with `static` keyword**
5. **Properties use `get =>` and `set => value`**
6. **Always include `#Requires AutoHotkey v2.0`**
7. **Document classes and methods with JSDoc-style comments**

## Contributing

Have an example of a great OOP pattern in AHK v2? Feel free to contribute!

1. Create a new `.ahk` file in this directory
2. Follow the existing format (comments, demos, learning points)
3. Add it to this README
4. Submit a pull request

## Questions?

- Check the [Best OOP Examples](../docs/BEST_OOP_EXAMPLES.md) for more examples
- Visit the [AHK Forum](https://www.autohotkey.com/boards/)
- Read the official [AHK v2 documentation](https://www.autohotkey.com/docs/v2/)
