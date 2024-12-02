import { Circle, Point } from "2d-geometry";
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

        const startControlPoint =
            radiusAtStart < radius ?
                startAnchor.getPointAwayFromReference(absStartDelta, center) :
                startAnchor.getPointTowardsReference(absStartDelta, center);
        const endControlPoint =
            radiusAtEnd < radius ?
                endAnchor.getPointAwayFromReference(absEndDelta, center) :
                endAnchor.getPointTowardsReference(absEndDelta, center);

        const startCircleForIntersection = new Circle(startControlPoint, absStartDelta);
        const endCircleForIntersection = new Circle(endControlPoint, absEndDelta);

        // If the the start and end circle are close together and intersect, we just draw a cubic bezier curve
        const intersections = startCircleForIntersection.intersect(endCircleForIntersection);
        const startContainsEnd = startCircleForIntersection.contains(endCircleForIntersection);
        const endContainsStart = endCircleForIntersection.contains(startCircleForIntersection);

        if (this.debug) {
            this.node?.debugShapes.push(startCircleForIntersection);
            this.node?.debugShapes.push(endCircleForIntersection);
        }

        if (intersections.length > 0 || startContainsEnd || endContainsStart) {
            // The control points are the same like in the normal spline connection
            const distanceBetweenAnchors = startAnchor.anchorPoint.distanceTo(endAnchor.anchorPoint)[0];
            const anchorDistanceFactor = 0.4
            const distanceToControlPoint = distanceBetweenAnchors * anchorDistanceFactor;

            const startControlPoint = startAnchor.getPointInDirection(distanceToControlPoint);
            const endControlPoint = endAnchor.getPointInDirection(-distanceToControlPoint);

            const curve = new CubicBezierCurve(startAnchor.anchorPoint, startControlPoint, endControlPoint, endAnchor.anchorPoint);
            return curve.getSvgPath();
        }


        const startIntersections = startCircleForIntersection.intersect(this.circle);
        const endIntersections = endCircleForIntersection.intersect(this.circle);

        const startIntersection = ShapeUtil.getClosestShapeToPoint(startIntersections, endAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);
        const endIntersection = ShapeUtil.getClosestShapeToPoint(endIntersections, startAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);

        const arc = new EllipticArc(startIntersection, endIntersection);
        arc.radius(radius);

        const startRad = RadialUtils.radOfPoint(startIntersection, this.circle.center);
        const endRad = RadialUtils.radOfPoint(endIntersection, this.circle.center);

        let radDiff = (endRad - startRad);
        if (radDiff < -Math.PI) {
            radDiff += Math.PI * 2;
        }

        if (radDiff > Math.PI) {
            radDiff -= Math.PI * 2;
        }
        
        const arcDirection = radDiff > 0 ? "clockwise" : "counter-clockwise";
        // const arcDirection = radDiff > 0 ? "counter-clockwise" : "clockwise";
        arc.direction(arcDirection);

        // console.log({
        //     id: this.node?.id,
        //     connection: this.connection
        // })

        const startCurve = new QuadraticBezierCurve(startPoint, startControlPoint, startIntersection);
        const endCurve = new QuadraticBezierCurve(endIntersection, endControlPoint, endPoint);

        return `${startCurve.getSvgPath()} ${arc.getSvgPath()} ${endCurve.getSvgPath()}`;
    }

}
