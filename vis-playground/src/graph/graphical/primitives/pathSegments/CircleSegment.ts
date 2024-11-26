import { Circle, Point } from "2d-geometry";
import { Anchor } from "../Anchor";
import { SvgPathSegment } from "./PathSegment";
import { EllipticArc } from "./EllipticArc";
import { QuadraticBezierCurve } from "./BezierCurve";
import { ShapeUtil } from "src/graph/layouter/utils/shapeUtil";

export class CircleSegmentConnection implements SvgPathSegment {

    get start(): Point {
        return this.startAnchor.anchorPoint;
    }
    get end(): Point {
        return this.endAnchor!.anchorPoint;
    }

    startAnchor: Anchor;
    circle: Circle;
    endAnchor?: Anchor;

    constructor(
        startAnchor: Anchor,
        circle: Circle,
    ) {
        this.startAnchor = startAnchor;
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

        if (!endAnchor) {
            return "";
        }
        const startPoint = startAnchor.anchorPoint;
        const endPoint = endAnchor.anchorPoint;

        const radius = this.circle.r;
        const radiusAtStart = startPoint.distanceTo(this.circle.center)[0];
        const radiusAtEnd = endPoint.distanceTo(this.circle.center)[0];

        const startDelta = Math.abs(radius - radiusAtStart);
        const endDelta = Math.abs(radius - radiusAtEnd);

        const startControlPoint = startAnchor.getPointInDirection(startDelta);
        const endControlPoint = endAnchor.getPointInDirection(-endDelta);

        const startCircleForIntersection = new Circle(startControlPoint, startDelta);
        const endCircleForIntersection = new Circle(endControlPoint, endDelta);

        const startIntersections = startCircleForIntersection.intersect(this.circle);
        const endIntersections = endCircleForIntersection.intersect(this.circle);

        const startIntersection = ShapeUtil.getClosestShapeToPoint(startIntersections, endAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);
        const endIntersection = ShapeUtil.getClosestShapeToPoint(endIntersections, startAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);

        const arc = new EllipticArc(startIntersection, endIntersection);
        arc.radius(radius);

        console.log({
            circle: this.circle,
            startPoint,
            endPoint,
            startControlPoint,
            endControlPoint,
            startIntersection,
            endIntersection,
        })

        const startCurve = new QuadraticBezierCurve(startPoint, startControlPoint, startIntersection);
        const endCurve = new QuadraticBezierCurve(endIntersection, endControlPoint, endPoint);

        return `${startCurve.getSvgPath()} ${arc.getSvgPath()} ${endCurve.getSvgPath()}`;
    }

}
