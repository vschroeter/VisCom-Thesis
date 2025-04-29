import { Circle, Point, Segment } from "2d-geometry";
import { Anchor } from "../Anchor";
import { PathSegment } from "./PathSegment";
import { EllipticArc } from "./EllipticArc";
import { CubicBezierCurve, QuadraticBezierCurve } from "./BezierCurve";
import { ShapeUtil } from "src/graph/layouter/utils/shapeUtil";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { RadialUtils } from "src/graph/layouter/utils/radialUtils";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { SmoothSplineSegment } from "./SmoothSpline";

export class CircleSegmentSegment extends PathSegment {

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

    /** The node the circle segment belongs to */
    parentNode?: LayoutNode;

    /** The circle of the circle segment */
    circle: Circle;

    /** If the path should cross a node */
    crossNode?: LayoutNode;

    _startAnchor?: Anchor;
    _endAnchor?: Anchor;

    set startAnchor(anchor: Anchor | undefined) {
        this._startAnchor = anchor;
    }

    set endAnchor(anchor: Anchor | undefined) {
        this._endAnchor = anchor;
    }

    get startAnchor(): Anchor | undefined {
        return this._startAnchor ?? this.intermediateStartAnchor;
    }

    get endAnchor(): Anchor | undefined {
        return this._endAnchor ?? this.intermediateEndAnchor;
    }

    intermediateStartAnchor?: Anchor;
    intermediateEndAnchor?: Anchor;

    intermediateStartCurve?: SmoothSplineSegment;
    intermediateEndCurve?: SmoothSplineSegment;
    startCurve?: CubicBezierCurve;
    endCurve?: CubicBezierCurve;
    circleArc?: EllipticArc;
    directConnectionCurve?: PathSegment;

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
            return [
                this.intermediateStartCurve?.getSvgPath(),
                this.directConnectionCurve.getSvgPath(),
                this.intermediateEndCurve?.getSvgPath(),
            ].join(" ");
        }

        return [
            this.intermediateStartCurve?.getSvgPath(),
            this.startCurve?.getSvgPath(),
            this.circleArc?.getSvgPath(),
            this.endCurve?.getSvgPath(),
            this.intermediateEndCurve?.getSvgPath(),
        ].filter((s) => s).join(" ");


        // return `${this.startCurve?.getSvgPath()} ${this.circleArc?.getSvgPath()} ${this.endCurve?.getSvgPath()}`;
    }
    calculate(force = false): string {
        if (this._calculated && !force) {
            return this.getSvgPath();
        }

        this._calculated = true;

        // Contains 3 forms:
        // - a start connection quadratic bezier curve from the start anchor to the circle
        // - a circle arc
        // - a end connection quadratic bezier curve from the circle to the end anchor

        if (!this.endAnchor || !this.startAnchor) {
            return "";
        }

        // let intermediateStartCurve: SmoothSplineSegment | undefined = undefined;
        // let intermediateEndCurve: SmoothSplineSegment | undefined = undefined;

        if (this.startAnchor && this.intermediateStartAnchor) {
            this.intermediateStartCurve = new SmoothSplineSegment(this.connection, this.startAnchor, this.intermediateStartAnchor, 0.4);
        }
        if (this.endAnchor && this.intermediateEndAnchor) {
            this.intermediateEndCurve = new SmoothSplineSegment(this.connection, this.intermediateEndAnchor, this.endAnchor, 0.4);
        }

        const startAnchor = this.intermediateStartAnchor ?? this.startAnchor;
        const endAnchor = this.intermediateEndAnchor ?? this.endAnchor;

        const startPoint = startAnchor.anchorPoint;
        const endPoint = endAnchor.anchorPoint;

        const center = this.circle.center;
        const radius = this.circle.r;
        const radiusAtStart = startPoint.distanceTo(this.circle.center)[0];
        const radiusAtEnd = endPoint.distanceTo(this.circle.center)[0];

        const startDelta = radius - radiusAtStart;
        const endDelta = radius - radiusAtEnd;

        const absStartDelta = Math.abs(startDelta) * 2;
        const absEndDelta = Math.abs(endDelta) * 2;

        // In the normal case, we want to have the center of the intersection circles to be on the parent circle
        // So we calculate the intersection of the anchor and the parent circle
        const _startCircleCenterPointIntersections = startAnchor.getRay().intersect(this.circle);
        const _endCircleCenterPointIntersections = endAnchor.getRay(true).intersect(this.circle);

        // this.connection.debugShapes.push(startAnchor.getRay());
        // this.connection.debugShapes.push(endAnchor.getRay(true));

        if (_startCircleCenterPointIntersections.length === 0 || _endCircleCenterPointIntersections.length === 0) {
            // throw new Error("No intersection found");

            // if (this.connection?.source.id == "11car_simulator" && this.connection.target.id == "11traffic_light_detection") {
            //     this.connection.debugShapes.push(startAnchor.getRay());
            //     this.connection.debugShapes.push(endAnchor.getRay(true));
            //     this.connection.debugShapes.push(endAnchor);
            //     this.connection.debugShapes.push(startAnchor);
            //     this.connection.debugShapes.push(this.circle);
            // }

            console.error("No intersection found", this.connection.id, _startCircleCenterPointIntersections, _endCircleCenterPointIntersections);
            return "";
        }


        const startCircleCenterPoint = _startCircleCenterPointIntersections[0];
        const endCircleCenterPoint = _endCircleCenterPointIntersections[0];

        // The circle is then defined by the intersection point as center and the distance to the anchor point as radius
        const startCircleForIntersection = new Circle(startCircleCenterPoint, startCircleCenterPoint.distanceTo(startPoint)[0]);
        const endCircleForIntersection = new Circle(endCircleCenterPoint, endCircleCenterPoint.distanceTo(endPoint)[0]);


        // let startCircleCenterPoint =
        //     radiusAtStart < radius ?
        //         startAnchor.getPointAwayFromReference(absStartDelta, center) :
        //         startAnchor.getPointTowardsReference(absStartDelta, center);
        // let endCircleCenterPoint =
        //     radiusAtEnd < radius ?
        //         endAnchor.getPointAwayFromReference(absEndDelta, center) :
        //         endAnchor.getPointTowardsReference(absEndDelta, center);

        // If there is a cross node defined, we want the center of the intersection circles to be closer to the cross node center
        // if (this.crossNode) {
        //     startCircleCenterPoint = startAnchor.getPointTowardsReference(absStartDelta, this.crossNode.center);
        //     endCircleCenterPoint = endAnchor.getPointTowardsReference(absEndDelta, this.crossNode.center);
        // }

        // const startCircleCenterPoint = startAnchor.getPointTowardsReference(absStartDelta, endPoint);
        // const endCircleCenterPoint = endAnchor.getPointTowardsReference(absEndDelta, startPoint);

        // const startCircleForIntersection = new Circle(startCircleCenterPoint, absStartDelta);
        // const endCircleForIntersection = new Circle(endCircleCenterPoint, absEndDelta);




        // If the the start and end circle are close together and intersect, we just draw a cubic bezier curve
        const startEndIntersections = startCircleForIntersection.intersect(endCircleForIntersection);
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

        if (startEndIntersections.length > 0 || startContainsEnd || endContainsStart) {
            const segment = new SmoothSplineSegment(this.connection, startAnchor, endAnchor, 0.4);
            this.directConnectionCurve = segment;
            return segment.getSvgPath();
        }


        const startIntersections = startCircleForIntersection.intersect(this.circle);
        const endIntersections = endCircleForIntersection.intersect(this.circle);

        const combinations: [Point, Point][] = [
            [startIntersections[0], endIntersections[0]],
            [startIntersections[0], endIntersections[1]],
            [startIntersections[1], endIntersections[0]],
            [startIntersections[1], endIntersections[1]],
        ]

        // Find the combination with the smallest radial distance between the points
        let minDistance = Number.MAX_VALUE;
        let minCombination: [Point, Point] | undefined = undefined;
        for (const combination of combinations) {

            const rad1 = RadialUtils.radOfPoint(combination[0], this.circle.center);
            const rad2 = RadialUtils.radOfPoint(combination[1], this.circle.center);

            const dist1 = RadialUtils.normalizeRad(RadialUtils.radBetweenPoints(combination[0], combination[1], this.circle.center), true);
            const dist2 = RadialUtils.normalizeRad(RadialUtils.radBetweenPoints(combination[1], combination[0], this.circle.center), true);

            // const dist1 = RadialUtils.radialDistance(rad1, rad2, this.circle.r);
            // const dist2 = RadialUtils.radialDistance(rad2, rad1, this.circle.r);
            const dist = Math.min(dist1, dist2);

            if (dist < minDistance) {
                minDistance = dist;
                minCombination = combination;
            }
        }

        const arcStartPoint = minCombination![0];
        const arcEndPoint = minCombination![1];


        // let arcStartPoint = ShapeUtil.getClosestShapeToPoint(startIntersections, endAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);
        // let arcEndPoint = ShapeUtil.getClosestShapeToPoint(endIntersections, startAnchor.anchorPoint, (p) => p) ?? new Point(0, 0);

        // if (this.crossNode) {

        //     const startSlopes = [
        //         RadialUtils.getEnclosingAngle(startAnchor.anchorPoint, this.crossNode.center, startIntersections[0]),
        //         RadialUtils.getEnclosingAngle(startAnchor.anchorPoint, this.crossNode.center, startIntersections[1]),
        //     ]

        //     const endSlopes = [
        //         RadialUtils.getEnclosingAngle(endAnchor.anchorPoint, this.crossNode.center, endIntersections[0]),
        //         RadialUtils.getEnclosingAngle(endAnchor.anchorPoint, this.crossNode.center, endIntersections[1]),
        //     ]

        //     arcStartPoint = startSlopes[0] > startSlopes[1] ? startIntersections[0] : startIntersections[1];
        //     arcEndPoint = endSlopes[0] > endSlopes[1] ? endIntersections[0] : endIntersections[1];
        // }

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

        let debug = false;
        if (this.connection?.source.id == "11car_simulator" && this.connection.target.id == "11traffic_light_detection ") {
        // if (this.connection?.source.id == "drive_manager" && this.connection.target.id == "camera") {
            debug = true;
        }
        if (debug) {
            const getRandomColor = () => {
                return "#" + Math.floor(Math.random() * 16777215).toString(16);
            }
            const randomColor = getRandomColor();
            this.stroke = randomColor;

            startCircleForIntersection._data = { stroke: randomColor };
            endCircleForIntersection._data = { stroke: randomColor };
            startPoint._data = { fill: randomColor };
            endPoint._data = { fill: randomColor };
            arcStartPoint._data = { fill: randomColor };
            arcEndPoint._data = { fill: randomColor };

            this.connection.debugShapes.push(startCircleForIntersection);
            this.connection.debugShapes.push(endCircleForIntersection);
            this.connection.debugShapes.push(startPoint);
            this.connection.debugShapes.push(endPoint);
            this.connection.debugShapes.push(arcStartPoint);
            this.connection.debugShapes.push(arcEndPoint);
            this.connection.debugShapes.push(startAnchor);
            this.connection.debugShapes.push(endAnchor);
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

        return this.getSvgPath();

        // return `${startCurve.getSvgPath()} ${arc.getSvgPath()} ${endCurve.getSvgPath()}`;
    }

}
