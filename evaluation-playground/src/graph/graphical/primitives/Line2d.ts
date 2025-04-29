// import { Point2D } from './Point2d';
// import { Vector2D } from './Vector2d';

// export class Line2D {
//     anchor: Point2D;
//     direction: Vector2D;

//     constructor(anchor: Point2D, direction: Vector2D) {
//         this.anchor = anchor;
//         this.direction = direction.unity();
//     }

//     /**
//      * Create a line from two points
//      * @param p1 The first point
//      * @param p2 The second point
//      * @returns A new Line2D instance
//      */
//     static fromPoints(p1: Point2D, p2: Point2D): Line2D {
//         const direction = p2.subtract(p1);
//         return new Line2D(p1, direction);
//     }

//     /**
//      * Check if two lines are parallel
//      * @param other The other line to check against
//      * @returns True if the lines are parallel, false otherwise
//      */
//     isParallelTo(other: Line2D): boolean {
//         return this.direction.cross(other.direction) === 0;
//     }

//     /**
//      * Calculate the intersection point of two lines
//      * @param other The other line to intersect with
//      * @returns The intersection point or null if the lines are parallel
//      */
//     intersectionWith(other: Line2D): Point2D | null {
//         const det = this.direction.cross(other.direction);
//         if (det === 0) {
//             return null; // Lines are parallel
//         }
//         const diff = other.anchor.subtract(this.anchor);
//         const t = diff.cross(other.direction) / det;
//         return this.anchor.add(this.direction.multiply(t));
//     }

//     /**
//      * Get the orthogonal line at a given point
//      * @param point The point at which to get the orthogonal line
//      * @returns A new Line2D instance representing the orthogonal line
//      */
//     getOrthogonalAt(point: Point2D): Line2D {
//         const orthogonalDirection = new Vector2D(-this.direction.y, this.direction.x);
//         return new Line2D(point, orthogonalDirection);
//     }

//     /**
//      * Rotate the line by a given angle at a given point
//      * @param angleDeg The angle in degrees to rotate the line
//      * @param origin The point around which to rotate the line
//      * @returns A new Line2D instance representing the rotated line
//      */
//     rotate(angleDeg: number, origin: Point2D): Line2D {
//         const rotatedAnchor = this.anchor.rotate(angleDeg, origin);
//         const rotatedDirection = this.direction.rotateDeg(angleDeg);
//         return new Line2D(rotatedAnchor, rotatedDirection);
//     }

//     /**
//      * Get a point on the line at a given distance from the anchor point
//      * @param distance The distance from the anchor point
//      * @returns The point on the line
//      */
//     getPointAtDistance(distance: number): Point2D {
//         return this.anchor.add(this.direction.multiply(distance));
//     }
// }