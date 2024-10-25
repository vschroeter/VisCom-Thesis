import { Vector2D } from "./Vector2d";

export type Point2DLike = { x: number, y: number };

export class Point2D {
  constructor(
    public x: number,
    public y: number,
  ) { }

  clone(): Point2D {
    return new Point2D(this.x, this.y);
  }

  add(other: Vector2D): Point2D {
    return new Point2D(this.x + other.x, this.y + other.y);
  }

  subtract(other: Point2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  midPoint(other: Point2D): Point2D {
    return new Point2D((this.x + other.x) / 2, (this.y + other.y) / 2);
  }

  scale(fx: number, fy: number = fx, origin: Point2DLike = { x: 0, y: 0 }): Point2D {
    return new Point2D((this.x - origin.x) * fx + origin.x, (this.y - origin.y) * fy + origin.y);
  }

  rotate(angleDeg: number, origin: Point2DLike): Point2D {
    const angleRad = angleDeg * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const x = this.x - origin.x;
    const y = this.y - origin.y;

    return new Point2D(
      x * cos - y * sin + origin.x,
      x * sin + y * cos + origin.y,
    );

  }



}
