import { Point2D } from './Point2d';
import { Vector2D } from './Vector2d';

export class Anchor2d {
  /** The point, where the anchor is located */
  anchorPoint: Point2D;

  /** The direction, in which the anchor is pointing. This is orthogonal to the edge at the anchor point */
  direction: Vector2D;

  constructor(anchorPoint: Point2D, direction: Vector2D) {
    this.anchorPoint = anchorPoint;
    this.direction = direction.unity();
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
  getPointInDirection(distance: number): Point2D {
    return this.anchorPoint.add(this.direction.multiply(distance));
  }
}
