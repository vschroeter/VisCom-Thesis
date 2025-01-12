////////////////////////////////////////////////////////////////////////////
// #region Spline Class
////////////////////////////////////////////////////////////////////////////

import { LayoutConnection } from "src/graph/visGraph/layoutConnection";
import { Anchor } from "../Anchor";
import { CubicBezierCurve } from "./BezierCurve";
import { PathSegment } from "./PathSegment";
import { Point } from "2d-geometry";

export class SplineSegment extends PathSegment {
    override startAnchor?: Anchor | undefined;
    override endAnchor?: Anchor | undefined;

    controlPointDistanceFactor = 0.4;

    constructor(connection: LayoutConnection ,startAnchor?: Anchor, endAnchor?: Anchor) {
        super(connection);
        this.connection = connection;
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
    }

    override getSvgPath(): string {
        const startAnchor = this.startAnchor;
        const endAnchor = this.endAnchor;

        if (!startAnchor || !endAnchor) {
            return "";
        }

        // When having the anchors, we want to add two control points for the spline
        // These control points depend on the distance between the anchor points
        const distanceBetweenAnchors = startAnchor.anchorPoint.distanceTo(endAnchor.anchorPoint)[0];
        const distanceToControlPoint = distanceBetweenAnchors * this.controlPointDistanceFactor;

        const startControlPoint = startAnchor.getPointInDirection(distanceToControlPoint);
        const endControlPoint = endAnchor.getPointInDirection(-distanceToControlPoint);

        // this.connection.debugShapes.push(new Point(startAnchor.anchorPoint.x, startAnchor.anchorPoint.y));
        // this.connection.debugShapes.push(new Point(endAnchor.anchorPoint.x, endAnchor.anchorPoint.y));
        // this.connection.debugShapes.push(new Point(startControlPoint.x, startControlPoint.y));
        // this.connection.debugShapes.push(new Point(endControlPoint.x, endControlPoint.y));
        
        const bezierCurve = new CubicBezierCurve(this.connection, startAnchor.anchorPoint, startControlPoint, endControlPoint, endAnchor.anchorPoint);
        return bezierCurve.getSvgPath();
    }

}
