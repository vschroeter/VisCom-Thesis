
import { Circle, Line, Point, Ray, Segment, Vector } from "2d-geometry";
import { RadialUtils } from "src/graph/layouter/utils/radialUtils";
import { LayoutNode } from "src/graph/visGraph/layoutNode";

export class Anchor {

    tag = "Anchor";

    /** The point, where the anchor is located */
    anchorPoint: Point;

    /** The direction, in which the anchor is pointing. This is orthogonal to the edge at the anchor point */
    direction: Vector;
    _data?: { stroke?: string; length?: number, strokeWidth?: number, opacity?: number };

    get x() {
        return this.anchorPoint.x;
    }
    get y() {
        return this.anchorPoint.y;
    }

    get dx() {
        return this.direction.x;
    }

    get dy() {
        return this.direction.y;
    }

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

    rotate(angle: number) {
        const clone = this.clone();
        clone.direction = clone.direction.rotate(angle);
        return clone;
    }

    rotate90CW() {
        return this.rotate(Math.PI / 2);
    }

    rotate90CCW() {
        return this.rotate(-Math.PI / 2);
    }

    rotate180() {
        return this.rotate(Math.PI);
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

    isSimilarTo(endStartAnchor: Anchor | undefined, epsilon = 0.0001) {
        if (endStartAnchor === undefined) return false;

        // Check if the points are similar
        const point1 = this.anchorPoint;
        const point2 = endStartAnchor.anchorPoint;

        if (point1.distanceTo(point2)[0] > epsilon) return false;

        // Check if the directions are similar
        const direction1 = this.direction;
        const direction2 = endStartAnchor.direction;

        const angleDifference = Math.abs(direction1.slope - direction2.slope);
        return angleDifference < epsilon;
    }

    getDirectionRegardingCircle(circle: Circle): "clockwise" | "counter-clockwise" {
        // To test whether the direction is clockwise or counter-clockwise, we can just check another point in the direction of the anchor
        // If the angle diff between the anchor point and the helper point regarding the circle is positive, the direction is clockwise, otherwise counter-clockwise

        const helperPoint = this.getPointInDirection(circle.r / 2);
        const angleDiff = RadialUtils.radBetweenPoints(this.anchorPoint, helperPoint, circle.center);

        return angleDiff > 0 ? "clockwise" : "counter-clockwise";
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
    static getMidPointBetweenPointAndAnchor(point: Point, anchor: Anchor): Point | undefined {
        const distance = point.distanceTo(anchor.anchorPoint)[0];

        // 2 Circles to create the intersection line
        const circle1 = new Circle(point, distance);
        const circle2 = new Circle(anchor.anchorPoint, distance);
        const intersections = circle1.intersect(circle2);

        if (intersections.length != 2) {
            return undefined;
        }
        // The intersection line is then intersected with the anchor line to get the midpoint
        const circleIntersectionLine = new Line(intersections[0], intersections[1]);
        const intersectionsWithAnchor = anchor.getLine().intersect(circleIntersectionLine);
        if (intersectionsWithAnchor.length < 1) {
            return undefined;
        }

        return intersectionsWithAnchor[0];
    }


    /**
     * Constructs an anchor on a circle at a given angle. The anchor is tangential to the circle, pointing in the given direction.
     * @param circle The circle on which the anchor is located
     * @param angleRad The angle in radians, where the anchor is located
     * @param direction The direction in which the anchor is pointing
     */
    static getAnchorOnCircle(circle: Circle, angleRad: number, direction: "clockwise" | "counter-clockwise"): Anchor {
        const point = RadialUtils.positionOnCircleAtRad(angleRad, circle.r, circle.center);
        const vector = new Vector(point, circle.center).rotate90CW();
        const anchor = new Anchor(point, vector);

        if (direction == anchor.getDirectionRegardingCircle(circle)) {
            return anchor;
        }

        return anchor.cloneReversed();
    }



}


////////////////////////////////////////////////////////////////////////////
// #region Node Anchor
////////////////////////////////////////////////////////////////////////////

export class NodeAnchor {


    // The parent node of the anchor
    node: LayoutNode

    readonly nodeId: string

    anchor: Anchor
    curvingAnchor?: Anchor

    constructor(node: LayoutNode, anchor: Anchor, curvingAnchor?: Anchor) {
        this.node = node;
        this.nodeId = node.id;
        this.anchor = anchor;
        this.curvingAnchor = curvingAnchor;
    }

    get circle() {
        return this.node.outerCircle;
    }
}



export class RadialAnchor {


    // The parent node of the anchor
    node: LayoutNode

    readonly nodeId: string

    // The anchor's angle in radians (relative to the node's center)
    angle: number

    constructor(node: LayoutNode, angle?: number) {
        this.node = node;
        this.nodeId = node.id;

        if (angle) this.angle = angle;
        else {

            const validRange = node.getValidOuterRadRange();

            this.angle = validRange[0] + (RadialUtils.forwardRadBetweenAngles(validRange[0], validRange[1]) / 2);

        }

    }

    get circle() {
        return this.node.outerCircle;
    }

    rotate(angle: number) {
        return new RadialAnchor(this.node, this.angle + angle);
    }

    rotate90CW() {
        return this.rotate(Math.PI / 2);
    }

    rotate90CCW() {
        return this.rotate(-Math.PI / 2);
    }

    rotate180() {
        return this.rotate(Math.PI);
    }

    static fromAnchor(sourceNode: LayoutNode, startAnchor: Anchor): RadialAnchor {
        const angle = RadialUtils.radOfPoint(startAnchor.anchorPoint, sourceNode.center);
        return new RadialAnchor(sourceNode, angle);
    }

    getAnchor(): Anchor {
        const a = new Anchor(this.node.center, new Vector(this.angle));
        a.anchorPoint = a.getPointInDirection(this.node.outerRadius);
        return a;
    }


}

