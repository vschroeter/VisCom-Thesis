import { Circle, Point, Segment } from "2d-geometry";
import { Anchor } from "../Anchor";
import { SvgPathSegment } from "./PathSegment";
import { EllipticArc } from "./EllipticArc";
import { CubicBezierCurve, QuadraticBezierCurve } from "./BezierCurve";
import { ShapeUtil } from "src/graph/layouter/utils/shapeUtil";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "src/graph/layouter/utils/radialUtils";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export class CircleSegmentConnection implements SvgPathSegment {

    debug: boolean = false;

    node?: LayoutNode;
    connection?: LayoutConnection;

    get start(): Point {
        return this.startAnchor?.anchorPoint ?? new Point(0, 0);
    }
    get end(): Point {
        return this.endAnchor?.anchorPoint ?? new Point(0, 0);
    }

    circle: Circle;
    startAnchor?: Anchor;
    endAnchor?: Anchor;

    constructor(
        circle: Circle,
    ) {
        // this.startAnchor = startAnchor;
        this.circle = circle.clone();
        // this.endAnchor = new Anchor(circle.center, new Vector(circle.center, startAnchor.anchorPoint).rotate90CW());
    }

    set radius(radius: number) {
        this.circle.r = radius;
    }
    get radius(): number {
        return this.circle.r;
    }

    set center(center: Point) {
        this.circle = this.circle.translate(center.x - this.circle.center.x, center.y - this.circle.center.y);
    }
    get center(): Point {
        return this.circle.center;
    }

    setStartAnchor(startAnchor: Anchor) {
        this.startAnchor = startAnchor;
    }

    setEndAnchor(endAnchor: Anchor) {
        this.endAnchor = endAnchor;
    }

    getSvgPath(): string {

        // Contains 3 forms:
        // - a start connection quadratic bezier curve from the start anchor to the circle
        // - a circle arc
        // - a end connection quadratic bezier curve from the circle to the end anchor

        const startAnchor = this.startAnchor;
        const endAnchor = this.endAnchor;

        if (!endAnchor || !startAnchor) {
            return "";
        }

        if (this.connection?.source.id == "1" && this.connection.target.id == "3") {
            const x = 5;
        }

        const startPoint = startAnchor.anchorPoint;
        const endPoint = endAnchor.anchorPoint;

        const center = this.circle.center;
        const radius = this.circle.r;
        const radiusAtStart = startPoint.distanceTo(this.circle.center)[0];
        const radiusAtEnd = endPoint.distanceTo(this.circle.center)[0];

        // const startDelta = Math.abs(radius - radiusAtStart);
        // const endDelta = Math.abs(radius - radiusAtEnd);

        const startDelta = radius - radiusAtStart;
        const endDelta = radius - radiusAtEnd;

        const absStartDelta = Math.abs(startDelta);
        const absEndDelta = Math.abs(endDelta);

        // const startControlPointDelta = radiusAtStart > radius ? absStartDelta : -absStartDelta;
        // const endControlPointDelta = radiusAtEnd > radius ? absEndDelta : -absEndDelta;

        const startCircleCenterPoint =
            radiusAtStart < radius ?
                startAnchor.getPointAwayFromReference(absStartDelta, center) :
                startAnchor.getPointTowardsReference(absStartDelta, center);
        const endCircleCenterPoint =
            radiusAtEnd < radius ?
                endAnchor.getPointAwayFromReference(absEndDelta, center) :
                endAnchor.getPointTowardsReference(absEndDelta, center);

        const startCircleForIntersection = new Circle(startCircleCenterPoint, absStartDelta);
        const endCircleForIntersection = new Circle(endCircleCenterPoint, absEndDelta);

        // If the the start and end circle are close together and intersect, we just draw a cubic bezier curve
        const intersections = startCircleForIntersection.intersect(endCircleForIntersection);
        const startContainsEnd = startCircleForIntersection.contains(endCircleForIntersection);
        const endContainsStart = endCircleForIntersection.contains(startCircleForIntersection);

        if (this.debug) {
            startCircleForIntersection._data = { stroke: "red" };
            this.node?.debugShapes.push(this.circle);
            this.node?.debugShapes.push(startPoint);
            this.node?.debugShapes.push(endPoint);
            this.node?.debugShapes.push(startCircleForIntersection);
            this.node?.debugShapes.push(endCircleForIntersection);
            this.node?.debugShapes.push(startCircleCenterPoint);
            this.node?.debugShapes.push(endCircleCenterPoint);
        }

        if (intersections.length > 0 || startContainsEnd || endContainsStart) {
            // The control points are the same like in the normal spline connection
            const distanceBetweenAnchors = startAnchor.anchorPoint.distanceTo(endAnchor.anchorPoint)[0];
            const anchorDistanceFactor = 0.4
            const distanceToControlPoint = distanceBetweenAnchors * anchorDistanceFactor;

            // const startControlPoint = startAnchor.getPointInDirection(distanceToControlPoint);
            // const endControlPoint = endAnchor.getPointInDirection(-distanceToControlPoint);

            const startControlPoint = startAnchor.getPointTowardsReference(distanceToControlPoint, endPoint);
            const endControlPoint = endAnchor.getPointTowardsReference(-distanceToControlPoint, startPoint);

            const curve = new CubicBezierCurve(startAnchor.anchorPoint, startControlPoint, endControlPoint, endAnchor.anchorPoint);
            return curve.getSvgPath();
        }


        const startIntersections = startCircleForIntersection.intersect(this.circle);
        const endIntersections = endCircleForIntersection.intersect(this.circle);

        const arcStartPoint = ShapeUtil.getClosestShapeToPoint(startIntersections, endAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);
        const arcEndPoint = ShapeUtil.getClosestShapeToPoint(endIntersections, startAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);

        const arc = new EllipticArc(arcStartPoint, arcEndPoint);
        arc.radius(radius);

        const arcStartRad = RadialUtils.radOfPoint(arcStartPoint, this.circle.center);
        const arcEndRad = RadialUtils.radOfPoint(arcEndPoint, this.circle.center);

        let radDiff = (arcEndRad - arcStartRad);
        if (radDiff < -Math.PI) {
            radDiff += Math.PI * 2;
        }

        if (radDiff > Math.PI) {
            radDiff -= Math.PI * 2;
        }

        const arcDirection = radDiff > 0 ? "clockwise" : "counter-clockwise";
        arc.direction(arcDirection);

        const arcStartVector = RadialUtils.radToVector(arcStartRad);
        const arcEndVector = RadialUtils.radToVector(arcEndRad);

        const distanceStartToArcStart = startAnchor.anchorPoint.distanceTo(arcStartPoint)[0];
        const distanceEndToArcEnd = endAnchor.anchorPoint.distanceTo(arcEndPoint)[0];
        const distanceFactor = 0.5;

        const startControlPoint1 = startPoint.translate(startAnchor.direction.multiply(distanceStartToArcStart * distanceFactor));
        const startControlPoint2 = arcStartPoint.translate(
            arcDirection === "clockwise" ?
                arcStartVector.rotate90CCW().multiply(distanceStartToArcStart * distanceFactor) :
                arcStartVector.rotate90CW().multiply(distanceStartToArcStart * distanceFactor)
        );

        const endControlPoint1 = arcEndPoint.translate(
            arcDirection === "clockwise" ?
                arcEndVector.rotate90CW().multiply(distanceEndToArcEnd * distanceFactor) :
                arcEndVector.rotate90CCW().multiply(distanceEndToArcEnd * distanceFactor)
        );
        const endControlPoint2 = endPoint.translate(endAnchor.direction.rotate(Math.PI).multiply(distanceEndToArcEnd * distanceFactor));

        const startCurve = new CubicBezierCurve(startPoint, startControlPoint1, startControlPoint2, arcStartPoint);
        const endCurve = new CubicBezierCurve(arcEndPoint, endControlPoint1, endControlPoint2, endPoint);

        return `${startCurve.getSvgPath()} ${arc.getSvgPath()} ${endCurve.getSvgPath()}`;
    }

}
