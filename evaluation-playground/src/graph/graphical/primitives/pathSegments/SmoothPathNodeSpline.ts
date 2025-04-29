////////////////////////////////////////////////////////////////////////////
// #region Spline Class
////////////////////////////////////////////////////////////////////////////

import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { Anchor } from "../Anchor";
import { CubicBezierCurve } from "./BezierCurve";
import { PathSegment } from "./PathSegment";
import { Circle, Line, Point, Segment } from "2d-geometry";
import { ShapeUtil } from "src/graph/layouter/utils/shapeUtil";
import { SmoothSplineSegment } from "./SmoothSpline";

export class SmoothPathNodeSplineSegment extends PathSegment {
    override startAnchor?: Anchor | undefined;
    override endAnchor?: Anchor | undefined;

    nodeCircle: Circle;

    controlPointDistanceFactor = 0.4;

    extendArrow: boolean;
    extendStart: boolean;

    constructor(connection: LayoutConnection, startAnchor: Anchor, endAnchor: Anchor, nodeCircle: Circle, smoothness = 0.4, extendArrow = true, extendStart = false) {
        super(connection);
        this.connection = connection;
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
        this.controlPointDistanceFactor = smoothness;
        this.extendArrow = extendArrow;
        this.extendStart = extendStart;
        this.nodeCircle = nodeCircle;
    }

    get arrowLength(): number {
        return this.connection.arrowLength;
    }

    get arrowStartPoint(): Point {
        return this.endAnchor?.getPointInDirection(-this.arrowLength) ?? new Point(0, 0);
    }

    get extendedStartPoint(): Point {
        return this.startAnchor?.getPointInDirection(this.arrowLength) ?? new Point(0, 0);
    }

    getArrowStartPoint(maxLength: number): Point {
        return this.endAnchor?.getPointInDirection(-Math.min(maxLength, this.arrowLength)) ?? new Point(0, 0);
    }

    getExtendedStartPoint(maxLength: number): Point {
        return this.startAnchor?.getPointInDirection(Math.min(maxLength, this.arrowLength)) ?? new Point(0, 0);
    }

    override getSvgPath(): string {
        const startAnchor = this.startAnchor;
        const endAnchor = this.endAnchor;

        if (!startAnchor || !endAnchor) {
            return "";
        }

        const nodeAnchor = ShapeUtil.getClosestShapeToPoint([startAnchor, endAnchor], this.nodeCircle.center, a => a.anchorPoint)!;
        const pathAnchor = nodeAnchor === startAnchor ? endAnchor : startAnchor;

        const dir = pathAnchor == startAnchor ? "pathToNode" : "nodeToPath";


        // We define the following constants in the construction of the smooth spline:
        const AP = pathAnchor.anchorPoint;
        const NP = nodeAnchor.anchorPoint;
        const CC = this.nodeCircle.center;
        const r = this.nodeCircle.r;

        const d_AP_CC = AP.distanceTo(CC)[0];
        const d_AP_CC_r = d_AP_CC - r;

        const factor_anchorControlPoint = this.controlPointDistanceFactor;
        const d_AP_CP_anchor = d_AP_CC_r * factor_anchorControlPoint;
        const CP_pathAnchor = pathAnchor.getPointInDirection(dir == "pathToNode" ? d_AP_CP_anchor : -d_AP_CP_anchor);

        // The connection between the anchor control point and the center of the node circle
        const l_AP_CC = new Segment(AP, CC);
        // ... and the orthogonal line to this connection
        const l_o_AP_CC = new Line(CC, l_AP_CC.vector);

        const _c = new Circle(CC, d_AP_CC);
        const [i1, i2] = l_o_AP_CC.intersect(_c);
        const i_closer = ShapeUtil.getClosestShapeToPoint([i1, i2], NP, p => p)!;



        // This both lines are the lines between the anchor control point and the intersection points and built a triangle
        const l_AP_i1 = new Segment(CP_pathAnchor, i1);
        const l_AP_i2 = new Segment(CP_pathAnchor, i2);

        const l_for_nodeAnchor = new Segment(CP_pathAnchor, i_closer);

        // The control point of the node will be on l_for_nodeAnchor (so l_AP_i1 or l_AP_i2)
        // The control point of the path will be on the direction line of the path anchor

        const nodeAnchorLine = new Line(NP, nodeAnchor.direction.rotate90CW());
        const CP_nodeAnchor_intersections = nodeAnchorLine.intersect(l_for_nodeAnchor);

        if (CP_nodeAnchor_intersections.length === 0) {
            // throw new Error("No intersection found between node anchor line and helper line");
            return new SmoothSplineSegment(this.connection, this.startAnchor, this.endAnchor, this.controlPointDistanceFactor, this.extendArrow, this.extendStart).getSvgPath();
        }

        const CP_nodeAnchor = CP_nodeAnchor_intersections[0];

        const startControlPoint = startAnchor == pathAnchor ? CP_pathAnchor : CP_nodeAnchor;
        const endControlPoint = endAnchor == pathAnchor ? CP_pathAnchor : CP_nodeAnchor;

        const startControlPointDistance = startControlPoint.distanceTo(startAnchor.anchorPoint)[0];
        const endControlPointDistance = endControlPoint.distanceTo(endAnchor.anchorPoint)[0];

        const curveStartPoint = this.extendStart ? this.getExtendedStartPoint(startControlPointDistance / 3) : startAnchor.anchorPoint;
        const adaptedStartAnchor = new Anchor(curveStartPoint, startAnchor.direction);

        const curveEndPoint = this.extendArrow ? this.getArrowStartPoint(endControlPointDistance / 2) : endAnchor.anchorPoint;
        const adaptedEndAnchor = new Anchor(curveEndPoint, endAnchor.direction);


        let debug = false;
        debug = false;
        if (debug) {

            const _l_i1_i2 = new Segment(i1, i2);

            this.connection.debugShapes.push(_l_i1_i2);
            this.connection.debugShapes.push(l_for_nodeAnchor);
            this.connection.debugShapes.push(l_AP_CC);
            this.connection.debugShapes.push(_c);
            this.connection.debugShapes.push(nodeAnchor);
            this.connection.debugShapes.push(pathAnchor);
            this.connection.debugShapes.push(startControlPoint);
            this.connection.debugShapes.push(endControlPoint);
            this.connection.debugShapes.push(adaptedStartAnchor);
            this.connection.debugShapes.push(adaptedEndAnchor);
        }


        const bezierCurve = new CubicBezierCurve(this.connection, adaptedStartAnchor.anchorPoint, startControlPoint, endControlPoint, adaptedEndAnchor.anchorPoint);

        let s = "";

        if (this.extendStart) {
            s = `M ${startAnchor.anchorPoint.x} ${startAnchor.anchorPoint.y} L ${curveStartPoint.x} ${curveStartPoint.y}`;
        }

        if (this.extendArrow) {
            s += bezierCurve.getSvgPath() + ` L ${endAnchor.anchorPoint.x} ${endAnchor.anchorPoint.y}`;
        } else {
            s += bezierCurve.getSvgPath();
        }

        return s;





        // // Distance dr: The distance between the anchor point and the center of the node circle
        // // Distance d: dr minus the radius of the node circle
        // // Distance ds: d * this.controlPointDistanceFactor
        // const dr = AP.distanceTo(this.nodeCircle.center)[0];
        // const d = dr - this.nodeCircle.r;
        // const ds = d * this.controlPointDistanceFactor;
        // const dsr = ds + this.nodeCircle.r;




        // // The node anchor is the anchor closer to the node circle
        // // The path anchor is the anchor further away from the node circle


        // // For a smooth and consistent path between a path anchor and a node anchor, we construct a consistent helper line the following way:
        // // Distance dr: The distance between the anchor point and the center of the node circle
        // // Distance d: dr minus the radius of the node circle
        // // Distance ds: d * this.controlPointDistanceFactor
        // // const dr = pathAnchor.anchorPoint.distanceTo(this.nodeCircle.center)[0];
        // // const d = dr - this.nodeCircle.r;
        // // const ds = d * this.controlPointDistanceFactor;
        // // const dsr = ds + this.nodeCircle.r;

        // // The first control point is in the path anchor direction with a distance of ds
        // const pathAnchorControlPoint = pathAnchor.getPointInDirection(dir == "pathToNode" ? ds : -ds);

        // // Line l: The line between the anchor point and the center of the node circle
        // // Line o: The orthogonal line to l, starting at the center of the node circle

        // const l = new Segment(this.nodeCircle.center, pathAnchor.anchorPoint);
        // const o = new Line(this.nodeCircle.center, l.vector);

        // // Points p1 and p2: The both points on o with distance ds from the center of the node circle

        // const _c = new Circle(this.nodeCircle.center, dr);
        // const [p1, p2] = o.intersect(_c);

        // const p = ShapeUtil.getClosestShapeToPoint([p1, p2], nodeAnchor.anchorPoint, p => p)!;

        // // The relevant helper line is chosen based on which point is closer to the node anchor
        // // Helper line h1: The line between the anchor control point and p1
        // // Helper line h2: The line between the anchor control point and p2
        // // Helper line h: The chosen helper line

        // const h = new Line(pathAnchorControlPoint, p);

        // const _s = new Segment(pathAnchorControlPoint, p);


        // // The intersection of the helper line with the node anchor direction line is the node control point
        // const nodeAnchorLine = new Line(nodeAnchor.anchorPoint, nodeAnchor.direction.rotate90CW());
        // const nodeAnchorIntersections = h.intersect(nodeAnchorLine);

        // let fallback = false;
        // if (nodeAnchorIntersections.length === 0) {
        //     // throw new Error("No intersection found between node anchor line and helper line");
        //     fallback = true;
        // }

        // const nodeAnchorControlPoint = nodeAnchorIntersections[0];


        // // Check, if the circle _c contains the node anchor control point
        // // Otherwise, we return a normal smooth spline
        // if (!_c.contains(nodeAnchorControlPoint)) {
        //     fallback = true;
        // }

        // if (fallback) {
        //     return new SmoothSplineSegment(this.connection, this.startAnchor, this.endAnchor, this.controlPointDistanceFactor, this.extendArrow, this.extendStart).getSvgPath();
        // }

        // // this.connection.debugShapes.push(_s);
        // // this.connection.debugShapes.push(l);
        // // this.connection.debugShapes.push(_c);
        // // this.connection.debugShapes.push(nodeAnchor);
        // // this.connection.debugShapes.push(pathAnchor);
        // // this.connection.debugShapes.push(pathAnchorControlPoint);
        // // this.connection.debugShapes.push(nodeAnchorControlPoint);

        // const startControlPoint = startAnchor == pathAnchor ? pathAnchorControlPoint : nodeAnchorControlPoint;
        // const endControlPoint = endAnchor == pathAnchor ? pathAnchorControlPoint : nodeAnchorControlPoint;

        // const startControlPointDistance = startControlPoint.distanceTo(startAnchor.anchorPoint)[0];
        // const endControlPointDistance = endControlPoint.distanceTo(endAnchor.anchorPoint)[0];

        // const curveStartPoint = this.extendStart ? this.getExtendedStartPoint(startControlPointDistance / 2) : startAnchor.anchorPoint;
        // const adaptedStartAnchor = new Anchor(curveStartPoint, startAnchor.direction);

        // const curveEndPoint = this.extendArrow ? this.getArrowStartPoint(endControlPointDistance / 2) : endAnchor.anchorPoint;
        // const adaptedEndAnchor = new Anchor(curveEndPoint, endAnchor.direction);

        // // // When having the anchors, we want to add two control points for the spline
        // // // These control points depend on the distance between the anchor points
        // // const distanceBetweenAnchors = adaptedStartAnchor.anchorPoint.distanceTo(curveEndPoint)[0];
        // // const distanceToControlPoint = distanceBetweenAnchors * this.controlPointDistanceFactor;

        // // const startControlPoint = adaptedStartAnchor.getPointInDirection(distanceToControlPoint);
        // // const endControlPoint = endAnchor.getPointInDirection(-Math.max(this.extendArrow ? this.arrowLength : 0, distanceToControlPoint));

        // // this.connection.debugShapes.push(new Point(startAnchor.anchorPoint.x, startAnchor.anchorPoint.y));
        // // this.connection.debugShapes.push(new Point(endAnchor.anchorPoint.x, endAnchor.anchorPoint.y));
        // // this.connection.debugShapes.push(new Point(startControlPoint.x, startControlPoint.y));
        // // this.connection.debugShapes.push(new Point(endControlPoint.x, endControlPoint.y));

        // // if (this.cId === "flint_node->robot_smalltalk") {

        // //     const ap = curveEndPoint;
        // //     ap._data = { fill: "blue" };

        // //     this.connection.debugShapes.push(this.start);
        // //     this.connection.debugShapes.push(startControlPoint);
        // //     this.connection.debugShapes.push(endControlPoint);
        // //     this.connection.debugShapes.push(this.end);
        // //     this.connection.debugShapes.push(ap);
        // //     console.warn("Debug shapes updated for arrow:", ap, this.arrowLength);
        // // }



        // const bezierCurve = new CubicBezierCurve(this.connection, adaptedStartAnchor.anchorPoint, startControlPoint, endControlPoint, adaptedEndAnchor.anchorPoint);

        // let s = "";

        // if (this.extendStart) {
        //     s = `M ${startAnchor.anchorPoint.x} ${startAnchor.anchorPoint.y} L ${curveStartPoint.x} ${curveStartPoint.y}`;
        // }

        // if (this.extendArrow) {
        //     s += bezierCurve.getSvgPath() + ` L ${endAnchor.anchorPoint.x} ${endAnchor.anchorPoint.y}`;
        // } else {
        //     s += bezierCurve.getSvgPath();
        // }

        // return s;
    }

    getSvgPathOld(): string {
        const startAnchor = this.startAnchor;
        const endAnchor = this.endAnchor;

        if (!startAnchor || !endAnchor) {
            return "";
        }

        // The node anchor is the anchor closer to the node circle
        // The path anchor is the anchor further away from the node circle

        const nodeAnchor = ShapeUtil.getClosestShapeToPoint([startAnchor, endAnchor], this.nodeCircle.center, a => a.anchorPoint)!;
        const pathAnchor = nodeAnchor === startAnchor ? endAnchor : startAnchor;

        const dir = pathAnchor == startAnchor ? "pathToNode" : "nodeToPath";

        // For a smooth and consistent path between a path anchor and a node anchor, we construct a consistent helper line the following way:
        // Distance dr: The distance between the anchor point and the center of the node circle
        // Distance d: dr minus the radius of the node circle
        // Distance ds: d * this.controlPointDistanceFactor
        const dr = pathAnchor.anchorPoint.distanceTo(this.nodeCircle.center)[0];
        const d = dr - this.nodeCircle.r;
        const ds = d * this.controlPointDistanceFactor;
        const dsr = ds + this.nodeCircle.r;

        // The first control point is in the path anchor direction with a distance of ds
        const pathAnchorControlPoint = pathAnchor.getPointInDirection(dir == "pathToNode" ? ds : -ds);

        // Line l: The line between the anchor point and the center of the node circle
        // Line o: The orthogonal line to l, starting at the center of the node circle

        const l = new Segment(this.nodeCircle.center, pathAnchor.anchorPoint);
        const o = new Line(this.nodeCircle.center, l.vector);

        // Points p1 and p2: The both points on o with distance ds from the center of the node circle

        const _c = new Circle(this.nodeCircle.center, dr);
        const [p1, p2] = o.intersect(_c);

        const p = ShapeUtil.getClosestShapeToPoint([p1, p2], nodeAnchor.anchorPoint, p => p)!;

        // The relevant helper line is chosen based on which point is closer to the node anchor
        // Helper line h1: The line between the anchor control point and p1
        // Helper line h2: The line between the anchor control point and p2
        // Helper line h: The chosen helper line

        const h = new Line(pathAnchorControlPoint, p);

        const _s = new Segment(pathAnchorControlPoint, p);


        // The intersection of the helper line with the node anchor direction line is the node control point
        const nodeAnchorLine = new Line(nodeAnchor.anchorPoint, nodeAnchor.direction.rotate90CW());
        const nodeAnchorIntersections = h.intersect(nodeAnchorLine);

        let fallback = false;
        if (nodeAnchorIntersections.length === 0) {
            // throw new Error("No intersection found between node anchor line and helper line");
            fallback = true;
        }

        const nodeAnchorControlPoint = nodeAnchorIntersections[0];


        // Check, if the circle _c contains the node anchor control point
        // Otherwise, we return a normal smooth spline
        if (!_c.contains(nodeAnchorControlPoint)) {
            fallback = true;
        }

        if (fallback) {
            return new SmoothSplineSegment(this.connection, this.startAnchor, this.endAnchor, this.controlPointDistanceFactor, this.extendArrow, this.extendStart).getSvgPath();
        }

        // this.connection.debugShapes.push(_s);
        // this.connection.debugShapes.push(l);
        // this.connection.debugShapes.push(_c);
        // this.connection.debugShapes.push(nodeAnchor);
        // this.connection.debugShapes.push(pathAnchor);
        // this.connection.debugShapes.push(pathAnchorControlPoint);
        // this.connection.debugShapes.push(nodeAnchorControlPoint);

        const startControlPoint = startAnchor == pathAnchor ? pathAnchorControlPoint : nodeAnchorControlPoint;
        const endControlPoint = endAnchor == pathAnchor ? pathAnchorControlPoint : nodeAnchorControlPoint;

        const startControlPointDistance = startControlPoint.distanceTo(startAnchor.anchorPoint)[0];
        const endControlPointDistance = endControlPoint.distanceTo(endAnchor.anchorPoint)[0];

        const curveStartPoint = this.extendStart ? this.getExtendedStartPoint(startControlPointDistance / 2) : startAnchor.anchorPoint;
        const adaptedStartAnchor = new Anchor(curveStartPoint, startAnchor.direction);

        const curveEndPoint = this.extendArrow ? this.getArrowStartPoint(endControlPointDistance / 2) : endAnchor.anchorPoint;
        const adaptedEndAnchor = new Anchor(curveEndPoint, endAnchor.direction);

        // // When having the anchors, we want to add two control points for the spline
        // // These control points depend on the distance between the anchor points
        // const distanceBetweenAnchors = adaptedStartAnchor.anchorPoint.distanceTo(curveEndPoint)[0];
        // const distanceToControlPoint = distanceBetweenAnchors * this.controlPointDistanceFactor;

        // const startControlPoint = adaptedStartAnchor.getPointInDirection(distanceToControlPoint);
        // const endControlPoint = endAnchor.getPointInDirection(-Math.max(this.extendArrow ? this.arrowLength : 0, distanceToControlPoint));

        // this.connection.debugShapes.push(new Point(startAnchor.anchorPoint.x, startAnchor.anchorPoint.y));
        // this.connection.debugShapes.push(new Point(endAnchor.anchorPoint.x, endAnchor.anchorPoint.y));
        // this.connection.debugShapes.push(new Point(startControlPoint.x, startControlPoint.y));
        // this.connection.debugShapes.push(new Point(endControlPoint.x, endControlPoint.y));

        // if (this.cId === "flint_node->robot_smalltalk") {

        //     const ap = curveEndPoint;
        //     ap._data = { fill: "blue" };

        //     this.connection.debugShapes.push(this.start);
        //     this.connection.debugShapes.push(startControlPoint);
        //     this.connection.debugShapes.push(endControlPoint);
        //     this.connection.debugShapes.push(this.end);
        //     this.connection.debugShapes.push(ap);
        //     console.warn("Debug shapes updated for arrow:", ap, this.arrowLength);
        // }



        const bezierCurve = new CubicBezierCurve(this.connection, adaptedStartAnchor.anchorPoint, startControlPoint, endControlPoint, adaptedEndAnchor.anchorPoint);

        let s = "";

        if (this.extendStart) {
            s = `M ${startAnchor.anchorPoint.x} ${startAnchor.anchorPoint.y} L ${curveStartPoint.x} ${curveStartPoint.y}`;
        }

        if (this.extendArrow) {
            s += bezierCurve.getSvgPath() + ` L ${endAnchor.anchorPoint.x} ${endAnchor.anchorPoint.y}`;
        } else {
            s += bezierCurve.getSvgPath();
        }

        return s;
    }

}
