#Requires AutoHotkey v2.0
#SingleInstance Force

/**
 * Shapes Inheritance Example
 * 
 * Demonstrates:
 * - Abstract base class pattern
 * - Inheritance with method overriding
 * - Polymorphism
 * - Constructor chaining with super
 * - Property definitions
 */

/**
 * Base Shape class (abstract pattern)
 * All shapes must implement Area() and Perimeter()
 */
class Shape {
    name := ""
    color := "Black"

    /**
     * Constructor - initializes common properties
     * @param name - Name of the shape
     * @param color - Color of the shape
     */
    __New(name := "Unnamed Shape", color := "Black") {
        this.name := name
        this.color := color
    }

    /**
     * Abstract method - must be overridden by derived classes
     * @returns Area of the shape
     */
    Area() {
        throw Error("Abstract method Area() must be implemented by derived class")
    }

    /**
     * Abstract method - must be overridden by derived classes
     * @returns Perimeter of the shape
     */
    Perimeter() {
        throw Error("Abstract method Perimeter() must be implemented by derived class")
    }

    /**
     * Concrete method - shared by all shapes
     * @returns String description of the shape
     */
    Describe() {
        return Format("This is a {1} {2} with area {3:0.2f} and perimeter {4:0.2f}",
            this.color, this.name, this.Area(), this.Perimeter())
    }

    /**
     * Virtual method - can be overridden but has default implementation
     * @returns String representation
     */
    ToString() {
        return this.name
    }
}

/**
 * Circle - inherits from Shape
 */
class Circle extends Shape {
    radius := 0

    /**
     * Constructor
     * @param radius - Radius of the circle
     * @param color - Color (optional, defaults to "Blue")
     */
    __New(radius, color := "Blue") {
        super.__New("Circle", color)  ; Call parent constructor
        this.radius := radius
    }

    /**
     * Override abstract method
     * @returns Area using π × r²
     */
    Area() {
        return 3.14159 * this.radius ** 2
    }

    /**
     * Override abstract method
     * @returns Circumference using 2 × π × r
     */
    Perimeter() {
        return 2 * 3.14159 * this.radius
    }

    /**
     * Override ToString for custom representation
     */
    ToString() {
        return Format("Circle(r={1})", this.radius)
    }
}

/**
 * Rectangle - inherits from Shape
 */
class Rectangle extends Shape {
    width := 0
    height := 0

    /**
     * Constructor
     * @param width - Width of rectangle
     * @param height - Height of rectangle
     * @param color - Color (optional, defaults to "Red")
     */
    __New(width, height, color := "Red") {
        super.__New("Rectangle", color)
        this.width := width
        this.height := height
    }

    /**
     * Override abstract method
     * @returns Area using width × height
     */
    Area() {
        return this.width * this.height
    }

    /**
     * Override abstract method
     * @returns Perimeter using 2 × (width + height)
     */
    Perimeter() {
        return 2 * (this.width + this.height)
    }

    /**
     * Override ToString
     */
    ToString() {
        return Format("Rectangle({1}×{2})", this.width, this.height)
    }

    /**
     * Additional method specific to Rectangle
     * @returns True if rectangle is a square
     */
    IsSquare() {
        return this.width == this.height
    }
}

/**
 * Triangle - inherits from Shape
 */
class Triangle extends Shape {
    base := 0
    height := 0
    side1 := 0
    side2 := 0

    /**
     * Constructor
     * @param base - Base of triangle
     * @param height - Height of triangle
     * @param side1 - First side length
     * @param side2 - Second side length
     * @param color - Color (optional, defaults to "Green")
     */
    __New(base, height, side1, side2, color := "Green") {
        super.__New("Triangle", color)
        this.base := base
        this.height := height
        this.side1 := side1
        this.side2 := side2
    }

    /**
     * Override abstract method
     * @returns Area using (base × height) / 2
     */
    Area() {
        return (this.base * this.height) / 2
    }

    /**
     * Override abstract method
     * @returns Perimeter as sum of all sides
     */
    Perimeter() {
        return this.base + this.side1 + this.side2
    }

    /**
     * Override ToString
     */
    ToString() {
        return Format("Triangle(base={1}, height={2})", this.base, this.height)
    }
}

/**
 * Demonstrate polymorphism - same interface, different implementations
 */
DemoPolymorphism() {
    ; Create array of different shapes
    shapes := [
        Circle(5),
        Rectangle(10, 5),
        Triangle(6, 4, 5, 5)
    ]

    result := "Polymorphism Demo:`n`n"

    ; Call same methods on different types - polymorphism!
    for shape in shapes {
        result .= shape.Describe() . "`n`n"
    }

    ; Calculate total area of all shapes
    totalArea := 0
    for shape in shapes {
        totalArea += shape.Area()
    }
    result .= Format("Total area of all shapes: {1:0.2f}", totalArea)

    MsgBox(result, "Polymorphism Example")
}

/**
 * Demonstrate inheritance and constructor chaining
 */
DemoInheritance() {
    ; Create shapes with different colors
    redCircle := Circle(10, "Red")
    blueRectangle := Rectangle(8, 6, "Blue")
    
    result := "Inheritance Demo:`n`n"
    result .= "Red Circle:`n" . redCircle.Describe() . "`n`n"
    result .= "Blue Rectangle:`n" . blueRectangle.Describe() . "`n"
    
    ; Show that IsSquare only exists on Rectangle (specific to derived class)
    if (blueRectangle.IsSquare()) {
        result .= "`nThis rectangle is actually a square!"
    } else {
        result .= "`nThis rectangle is NOT a square."
    }

    MsgBox(result, "Inheritance Example")
}

/**
 * Demonstrate that base class methods cannot be instantiated
 */
DemoAbstractClass() {
    try {
        ; Try to create a base Shape - this works
        shape := Shape("Generic Shape")
        
        ; But calling abstract methods throws errors
        try {
            area := shape.Area()
        } catch Error as e {
            MsgBox(
                "Abstract Method Example:`n`n"
                "Cannot call Area() on base Shape class!`n`n"
                "Error: " . e.Message,
                "Abstract Class Pattern"
            )
        }
    }
}

/**
 * Main demo - show a menu
 */
Main() {
    choice := MsgBox(
        "Shape Inheritance Demo`n`n"
        "This example demonstrates OOP concepts:`n"
        "• Inheritance (Shape base class)`n"
        "• Polymorphism (same interface, different behavior)`n"
        "• Constructor chaining (super.__New)`n"
        "• Abstract methods (must override)`n"
        "• Method overriding (custom implementations)`n`n"
        "Choose a demo:`n`n"
        "Yes = Polymorphism Demo`n"
        "No = Inheritance Demo`n"
        "Cancel = Abstract Class Demo",
        "OOP Shapes Example",
        "YesNoCancel"
    )

    switch choice {
        case "Yes":
            DemoPolymorphism()
        case "No":
            DemoInheritance()
        case "Cancel":
            DemoAbstractClass()
    }
}

; Run the demo
Main()

/**
 * Key Learning Points:
 * 
 * 1. INHERITANCE
 *    - Circle, Rectangle, Triangle all inherit from Shape
 *    - Use "extends" keyword to create inheritance
 *    - Child classes get all parent properties and methods
 * 
 * 2. CONSTRUCTOR CHAINING
 *    - Use super.__New() to call parent constructor
 *    - Parent constructor runs first, then child constructor
 *    - Pass parameters up the chain as needed
 * 
 * 3. ABSTRACT METHODS
 *    - Base class defines interface with throw Error()
 *    - All derived classes MUST implement these methods
 *    - Enforces consistent interface across types
 * 
 * 4. POLYMORPHISM
 *    - Loop through array of different shape types
 *    - Call same method (Area, Describe) on each
 *    - Each type provides its own implementation
 *    - Code works with "Shape" interface, not specific types
 * 
 * 5. METHOD OVERRIDING
 *    - Child class provides new implementation
 *    - Replaces parent method entirely
 *    - Use super.MethodName() to call parent version if needed
 * 
 * 6. ADDITIONAL METHODS
 *    - Derived classes can add new methods (e.g., IsSquare)
 *    - These are specific to that type only
 *    - Shows how to extend functionality beyond base class
 * 
 * BEST PRACTICES DEMONSTRATED:
 * ✓ Clear class hierarchy (one base, multiple derived)
 * ✓ Abstract base class pattern for interfaces
 * ✓ Proper constructor chaining
 * ✓ Meaningful method names
 * ✓ Comprehensive JSDoc comments
 * ✓ Defensive programming (throw on abstract methods)
 * ✓ Type-specific extensions (IsSquare)
 */
