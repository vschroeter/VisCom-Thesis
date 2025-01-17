
import { Circle, Line, Point, Ray, Vector } from "2d-geometry";
import { RadialUtils } from "src/graph/layouter/utils/radialUtils";

export class Anchor {
  tag = "Anchor";

  /** The point, where the anchor is located */
  anchorPoint: Point;

  /** The direction, in which the anchor is pointing. This is orthogonal to the edge at the anchor point */
  direction: Vector;


  constructor(anchorPoint: Point, directionalPoint: Point);
  constructor(anchorPoint: Point, directionalVector: Vector);
  constructor(anchorPoint: Point, direction: Vector | Point) {
    this.anchorPoint = anchorPoint;

    if (direction instanceof Point) {
      this.direction = new Vector(anchorPoint, direction);
    } else {
      this.direction = direction;
    }

    this.direction = this.direction.length > 0 ? this.direction.normalize() : this.direction;
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

  getPointAwayFromReference(distance: number, referencePoint?: Point) {

    const reference = referencePoint ?? this.anchorPoint;

    const p1 = this.getPointInDirection(distance);
    const p2 = this.getPointInDirection(-distance);

    if (reference === this.anchorPoint) {
      return p1;
    } 

    return p1.distanceTo(reference)[0] > p2.distanceTo(reference)[0] ? p1 : p2;
  }

  getPointTowardsReference(distance: number, referencePoint?: Point) {
    const reference = referencePoint ?? this.anchorPoint;

    const p1 = this.getPointInDirection(distance);
    const p2 = this.getPointInDirection(-distance);

    if (reference === this.anchorPoint) {
      return p1;
    } 

    return p1.distanceTo(reference)[0] < p2.distanceTo(reference)[0] ? p1 : p2;
  }

  clone() {
    return new Anchor(this.anchorPoint.clone(), this.direction.clone());
  }

  cloneReversed() {
    return new Anchor(this.anchorPoint.clone(), this.direction.clone().multiply(-1));
  }

  getLine() {
    return new Line(this.anchorPoint, this.direction.rotate90CW());
  }

  getRay(reversed = false) {
    if (reversed) {
      return new Ray(this.anchorPoint, this.direction.multiply(-1).rotate90CW());
    }
    return new Ray(this.anchorPoint, this.direction.rotate90CW());
  }

  static mean(anchors: Anchor[], circle?: Circle) {
    if (anchors.length === 0) {
      return new Anchor(new Point(0, 0), new Vector(0, 0));
    }

    // In this case, we just take the mean of the anchor directions
    if (circle === undefined) {
      let vector = new Vector(0, 0);
      anchors.forEach(anchor => {
        vector = vector.add(anchor.direction);
      });
      return new Anchor(new Point(0, 0), vector);
    }

    // For each anchor get the rad on the circle
    const angles = anchors.map(anchor => {
      return RadialUtils.radOfPoint(anchor.anchorPoint, circle.center);
    });

    // Calculate the mean angle
    const meanAngle = angles.reduce((acc, angle) => {
      return acc + angle;
    }, 0) / angles.length;

    // Calculate the mean point
    const meanPoint = RadialUtils.positionOnCircleAtRad(meanAngle, circle.r, circle.center);

    const a = new Anchor(meanPoint, new Vector(meanPoint, circle.center));

    // If the anchors were away from the circle, the direction is inverted
    if (circle.contains(anchors[0].getPointInDirection(circle.r))) {
      return a;
    }

    return a.cloneReversed();
  }

}
