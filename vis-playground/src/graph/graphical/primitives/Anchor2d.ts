
import { Point, Vector } from "2d-geometry";

export class Anchor {
  /** The point, where the anchor is located */
  anchorPoint: Point;

  /** The direction, in which the anchor is pointing. This is orthogonal to the edge at the anchor point */
  direction: Vector;

  constructor(anchorPoint: Point, direction: Vector) {
    this.anchorPoint = anchorPoint;
    this.direction = direction.length > 0 ? direction.normalize() : direction;
  }

  /**
   * Returns a point in the direction of the anchor point
   * @param distance The distance from the anchor point in the direction of the anchor point
   * @returns The point in the direction of the anchor point
   * 
   * @example
   * const anchor = new Anchor2d(new Point2D(0, 0), new Vector2D(1, 0));
   * const point = anchor.getPointInDirection(10);
   * console.log(point); // Point2D { x: 10, y: 0 }
   */
  getPointInDirection(distance: number): Point {
    return this.anchorPoint.translate(this.direction.multiply(distance));
  }
}
