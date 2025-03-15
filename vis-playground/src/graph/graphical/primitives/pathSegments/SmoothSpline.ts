////////////////////////////////////////////////////////////////////////////
// #region Spline Class
////////////////////////////////////////////////////////////////////////////

import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { Anchor } from "../Anchor";
import { CubicBezierCurve } from "./BezierCurve";
import { PathSegment } from "./PathSegment";
import { Point } from "2d-geometry";

export class SmoothSplineSegment extends PathSegment {
    override startAnchor?: Anchor | undefined;
    override endAnchor?: Anchor | undefined;

    controlPointDistanceFactor = 0.4;

    extendArrow: boolean;
    extendStart: boolean;

    constructor(connection: LayoutConnection, startAnchor?: Anchor, endAnchor?: Anchor, smoothness = 0.4, extendArrow = true, extendStart = false) {
        super(connection);
        this.connection = connection;
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
        this.controlPointDistanceFactor = smoothness;
        this.extendArrow = extendArrow;
        this.extendStart = extendStart;
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


    override getSvgPath(): string {
        const startAnchor = this.startAnchor;
        const endAnchor = this.endAnchor;

        if (!startAnchor || !endAnchor) {
            return "";
        }

        const curveStartPoint = this.extendStart ? this.extendedStartPoint : startAnchor.anchorPoint;
        const adaptedStartAnchor = new Anchor(curveStartPoint, startAnchor.direction);

        const curveEndPoint = this.extendArrow ? this.arrowStartPoint : endAnchor.anchorPoint;
        const adaptedEndAnchor = new Anchor(curveEndPoint, endAnchor.direction);

        // When having the anchors, we want to add two control points for the spline
        // These control points depend on the distance between the anchor points
        const distanceBetweenAnchors = adaptedStartAnchor.anchorPoint.distanceTo(curveEndPoint)[0];
        const distanceToControlPoint = distanceBetweenAnchors * this.controlPointDistanceFactor;

        const startControlPoint = adaptedStartAnchor.getPointInDirection(distanceToControlPoint);
        const endControlPoint = endAnchor.getPointInDirection(-Math.max(this.extendArrow ? this.arrowLength : 0, distanceToControlPoint));

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
