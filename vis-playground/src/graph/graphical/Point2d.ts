import { Vector2D } from "./Vector2d";

export class Point2D {
  constructor(
    public x: number,
    public y: number,
  ) {}

  add(other: Vector2D): Point2D {
    return new Point2D(this.x + other.x, this.y + other.y);
  }

  subtract(other: Point2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  midPoint(other: Point2D): Point2D {
    return new Point2D((this.x + other.x) / 2, (this.y + other.y) / 2);
  }

  
}
