
import { Circle, Line, Point, Ray, Segment, Vector } from "2d-geometry";
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

  move(distance: number) {
    const clone = this.clone();
    clone.anchorPoint = clone.getPointInDirection(distance);
    return clone;
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


  ////////////////////////////////////////////////////////////////////////////
  // #region Static construction methods
  ////////////////////////////////////////////////////////////////////////////

  static mean(anchors: (Anchor | undefined)[], circle?: Circle, preserveAnchorPoint = false): Anchor | undefined {
    const filteredAnchors = anchors.filter(a => a !== undefined) as Anchor[];
    if (filteredAnchors.length === 0) {
      return undefined;
    }

    // In this case, we just take the mean of the anchor directions
    if (circle === undefined) {
      let vector = new Vector(0, 0);
      filteredAnchors.forEach(anchor => {
        if (anchor === undefined) return;
        vector = vector.add(anchor.direction);
      });

      if (!preserveAnchorPoint) return new Anchor(new Point(0, 0), vector);
      return new Anchor(filteredAnchors[0].anchorPoint, vector);
    }

    // For each anchor get the rad on the circle
    const angles = filteredAnchors.map(anchor => {
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
    if (circle.contains(filteredAnchors[0].getPointInDirection(circle.r))) {
      return a;
    }

    return a.cloneReversed();
  }

  /**
   * Constructs the midpoint between an anchor with a direction and an arbitrary point.
   * The midpoint has the same distance to the anchor point as the point.
   * The midpoint is guaranteed to lie on the direction line of the anchor. 
   * @param point 
   * @param anchor 
   */
  static getMidPointBetweenPointAndAnchor(point: Point, anchor: Anchor) {
    const distance = point.distanceTo(anchor.anchorPoint)[0];

    // 2 Circles to create the intersection line
    const circle1 = new Circle(point, distance);
    const circle2 = new Circle(anchor.anchorPoint, distance);
    const intersections = circle1.intersect(circle2);

    if (intersections.length != 2) {
      throw new Error("No intersection found");
    }
    // The intersection line is then intersected with the anchor line to get the midpoint
    const circleIntersectionLine = new Segment(intersections[0], intersections[1]);
    const intersectionsWithAnchor = anchor.getLine().intersect(circleIntersectionLine);
    if (intersectionsWithAnchor.length != 1) {
      throw new Error("No intersection with anchor found");
    }

    return intersectionsWithAnchor[0];

  }

}
