import { Circle, Point, Segment } from "2d-geometry";
import { Anchor } from "../Anchor";
import { PathSegment } from "./PathSegment";
import { EllipticArc } from "./EllipticArc";
import { CubicBezierCurve, QuadraticBezierCurve } from "./BezierCurve";
import { ShapeUtil } from "src/graph/layouter/utils/shapeUtil";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "src/graph/layouter/utils/radialUtils";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export class CircleSegmentConnection extends PathSegment {

    debug: boolean = false;

    protected _calculated: boolean = false;
    get calculated(): boolean {
        return this._calculated;
    }
    set calculated(value: boolean) {
        this._calculated = value;
        this.startCurve = undefined;
        this.endCurve = undefined;
        this.circleArc = undefined;
        this.directConnectionCurve = undefined;
    }

    parentNode?: LayoutNode;

    circle: Circle;
    startAnchor?: Anchor;
    endAnchor?: Anchor;

    startCurve?: CubicBezierCurve;
    endCurve?: CubicBezierCurve;
    circleArc?: EllipticArc;
    directConnectionCurve?: CubicBezierCurve;

    constructor(
        connection: LayoutConnection,
        startAnchor?: Anchor,
        endAnchor?: Anchor,
        circle?: Circle,
    ) {
        super(connection);
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
        this.circle = circle?.clone() ?? new Circle(new Point(0, 0), 0);
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

    get isOnCircle() {
        if (!this._calculated) {
            this.calculate();
        }

        return this.directConnectionCurve === undefined;
    }

    getSvgPath(): string {
        if (!this._calculated) {
            this.calculate();
        }

        if (this.directConnectionCurve) {
            return this.directConnectionCurve.getSvgPath();
        }

        return `${this.startCurve?.getSvgPath()} ${this.circleArc?.getSvgPath()} ${this.endCurve?.getSvgPath()}`;
    }
    calculate(force = false): string {
        if (this._calculated && !force) {
            return this.getSvgPath();
        }
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

        const startDelta = radius - radiusAtStart;
        const endDelta = radius - radiusAtEnd;

        const absStartDelta = Math.abs(startDelta);
        const absEndDelta = Math.abs(endDelta);

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
            this.parentNode?.debugShapes.push(this.circle);
            this.parentNode?.debugShapes.push(startPoint);
            this.parentNode?.debugShapes.push(endPoint);
            this.parentNode?.debugShapes.push(startCircleForIntersection);
            this.parentNode?.debugShapes.push(endCircleForIntersection);
            this.parentNode?.debugShapes.push(startCircleCenterPoint);
            this.parentNode?.debugShapes.push(endCircleCenterPoint);
        }

        if (intersections.length > 0 || startContainsEnd || endContainsStart) {

            // The control points are the same like in the normal spline connection
            const distanceBetweenAnchors = startAnchor.anchorPoint.distanceTo(endAnchor.anchorPoint)[0];
            const anchorDistanceFactor = 0.4
            const distanceToControlPoint = distanceBetweenAnchors * anchorDistanceFactor;

            const startControlPoint = startAnchor.getPointTowardsReference(distanceToControlPoint, endPoint);
            const endControlPoint = endAnchor.getPointTowardsReference(distanceToControlPoint, startPoint);

            const curve = new CubicBezierCurve(this.connection, startAnchor.anchorPoint, startControlPoint, endControlPoint, endAnchor.anchorPoint);
            this.directConnectionCurve = curve;
            return curve.getSvgPath();
        }


        const startIntersections = startCircleForIntersection.intersect(this.circle);
        const endIntersections = endCircleForIntersection.intersect(this.circle);

        const arcStartPoint = ShapeUtil.getClosestShapeToPoint(startIntersections, endAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);
        const arcEndPoint = ShapeUtil.getClosestShapeToPoint(endIntersections, startAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);

        const arc = new EllipticArc(this.connection, arcStartPoint, arcEndPoint);
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

        // this.parentNode?.debugShapes.push(new Segment(startAnchor.anchorPoint, startAnchor.getPointInDirection(10)));
        // this.parentNode?.debugShapes.push(startAnchor.anchorPoint)

        // const s = new Segment(endAnchor.anchorPoint, endAnchor.getPointInDirection(10));
        // s._data = { stroke: "red" };
        // this.parentNode?.debugShapes.push(s);
        // this.parentNode?.debugShapes.push(endAnchor.anchorPoint)


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

        const startCurve = new CubicBezierCurve(this.connection, startPoint, startControlPoint1, startControlPoint2, arcStartPoint);
        const endCurve = new CubicBezierCurve(this.connection, arcEndPoint, endControlPoint1, endControlPoint2, endPoint);

        this.startCurve = startCurve;
        this.endCurve = endCurve;
        this.circleArc = arc;
        return `${startCurve.getSvgPath()} ${arc.getSvgPath()} ${endCurve.getSvgPath()}`;
    }

}
