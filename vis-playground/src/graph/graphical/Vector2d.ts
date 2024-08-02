export class Vector2D {
    constructor(
      public x: number,
      public y: number,
    ) {}

    get length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    add(other: Vector2D): Vector2D {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    negative(): Vector2D {
        return new Vector2D(-this.x, -this.y);
    }

    multiply(factor: number): Vector2D {
        return new Vector2D(this.x * factor, this.y * factor);
    }

    unity(): Vector2D {
        return this.multiply(1 / this.length);
    }
  }
  