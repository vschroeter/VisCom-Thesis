import { CommunicationLink } from "../commGraph";
import { AbstractNode2d } from "./AbstractNode2d";
import { EllipticArc } from "./EllipticArc";
import { Point2D } from "./Point2d";

import * as d3 from "d3"

export type CurveStyle = "linear" | "basis" | "natural" | d3.CurveFactory

export class AbstractConnection2d {

    /** The points that make up the connection */
    points: (Point2D | EllipticArc)[] = []

    /** The style of the curve */
    curveStyle: CurveStyle = "linear"

    /** The data of the link */
    data?: CommunicationLink

    /** The source node of the connection */
    source: AbstractNode2d
    /** The target node of the connection */
    target: AbstractNode2d

    constructor(
        source: AbstractNode2d,
        target: AbstractNode2d,
        data?: CommunicationLink,
    ) {
        this.source = source
        this.target = target
        this.data = data
    }

    /** The start point of the connection (either the first defined point or the source node) */
    get startPoint(): Point2D {
        if (this.points.length == 0) {
            return this.source.center
        }

        if (this.points[0] instanceof EllipticArc) {
            return (this.points[0] as EllipticArc)._start ?? this.source.center
        }

        return this.points[0]
    }

    /** The end point of the connection (either the last defined point or the target node) */
    get endPoint(): Point2D {
        if (this.points.length == 0) {
            return this.target.center
        }

        const lastPoint = this.points[this.points.length - 1]

        if (lastPoint instanceof EllipticArc) {
            return lastPoint._end ?? this.target.center
        }

        return lastPoint
    }

    /** The curve factory to use for the line */
    get curveFactory(): d3.CurveFactory {
        switch (this.curveStyle) {
            case "linear":
                return d3.curveLinear
            case "basis":
                return d3.curveBasis
            case "natural":
                return d3.curveNatural
            default:
                return this.curveStyle
        }
    }

    /** The path generator to use for the line */
    get pathGenerator() {
        const pointLine = d3.line<Point2D>()
            .x(d => d.x)
            .y(d => d.y)
            .curve(this.curveFactory)
        
        return (points: (Point2D | EllipticArc)[]) => {
            let path = ""
            let currentPoints: Point2D[] = []
            points.forEach((point, i) => {
                if (point instanceof EllipticArc) {
                    if (currentPoints.length > 0) {
                        path += pointLine(currentPoints) + " "
                        currentPoints = []
                    }
                    path += point.getSvgPath() + " "
                } else {
                    currentPoints.push(point)
                }
            });

            return path + (currentPoints.length > 0 ? pointLine(currentPoints) : "")
        }

        
    }

    getSvgPath(): string {
        let points = this.points
        if (points.length == 0) {
            points = [this.source.center, this.target.center]
        }
        const path = this.pathGenerator(points) ?? ""
        return path
    }

    get length(): number {
        const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
        tempPath.setAttribute("d", this.getSvgPath())
        return tempPath.getTotalLength()
    }

}
