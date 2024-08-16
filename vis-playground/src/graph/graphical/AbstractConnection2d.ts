import { CommunicationLink } from "../commGraph";
import { AbstractNode2d } from "./AbstractNode2d";
import { Anchor2d } from "./Anchor2d";
import { EllipticArc } from "./EllipticArc";
import { Point2D } from "./Point2d";

import * as d3 from "d3"

export type CurveStyle = "linear" | "basis" | "natural" | d3.CurveFactory

export class Arrow2D {

    width: number = 10
    height: number = 10
    filled: boolean = false

    static readonly normalPoints = [
        new Point2D(1, -0.5),
        new Point2D(0, 0),
        new Point2D(1, 0.5),
    ]

    set size(size: number) {
        this.width = size
        this.height = size
    }

    getSvgPath(anchor: Anchor2d) {

        const startPoint = anchor.anchorPoint
        const direction = anchor.direction

        const scaledPoints = Arrow2D.normalPoints.map(p => p.scale(this.width, this.height))
        const rotatedPoints = scaledPoints.map(p => p.rotate(-direction.degBetween(), {x: 0, y: 0}))

        const path = d3.line<Point2D>()
            .x(d => d.x + startPoint.x)
            .y(d => d.y + startPoint.y)
            .curve(d3.curveLinear)
        
        return path(rotatedPoints)!;
    }

    // getAnchorPoint


}

export class AbstractConnection2d {

    /** The points that make up the connection */
    points: (Point2D | EllipticArc | Anchor2d)[] = []

    /** The style of the curve */
    curveStyle: CurveStyle = "linear"

    /** The data of the link */
    data?: CommunicationLink

    /** The source node of the connection */
    source: AbstractNode2d
    /** The target node of the connection */
    target: AbstractNode2d

    /** The width of the stroke */
    strokeWeight = 1

    
    arrow: Arrow2D = new Arrow2D()
        
    
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
            return this.source.getAnchor(this.target.center).anchorPoint;
            // return this.source.center
        }

        if (this.points[0] instanceof EllipticArc) {
            return (this.points[0] as EllipticArc)._start ?? this.source.center
        }

        if (this.points[0] instanceof Anchor2d) {
            return (this.points[0] as Anchor2d).anchorPoint
        }

        return this.points[0]
    }

    /** The end point of the connection (either the last defined point or the target node) */
    get endPoint(): Point2D {
        if (this.points.length == 0) {
            return this.target.getAnchor(this.source.center).anchorPoint;
            // return this.target.center
        }

        const lastPoint = this.points[this.points.length - 1]

        if (lastPoint instanceof EllipticArc) {
            return lastPoint._end ?? this.target.center
        }

        if (lastPoint instanceof Anchor2d) {
            return lastPoint.anchorPoint
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
        
        return (points: (Point2D | EllipticArc | Anchor2d)[]) => {
            let path = ""
            let currentPoints: Point2D[] = []
            points.forEach((point, i) => {
                if (point instanceof EllipticArc) {
                    if (currentPoints.length > 0) {
                        path += pointLine(currentPoints) + " "
                        currentPoints = []
                    }
                    path += point.getSvgPath() + " "
                } else if (point instanceof Point2D) {
                    currentPoints.push(point)
                } else if (point instanceof Anchor2d) {
                    currentPoints.push(point.anchorPoint)
                }
            });

            return path + (currentPoints.length > 0 ? pointLine(currentPoints) : "")
        }

        
    }

    getSvgPath(): string {
        let points = this.points
        if (points.length == 0) {
            // points = [this.source.center, this.target.center]
            points = [this.startPoint, this.endPoint]
        }
        const path = this.pathGenerator(points) ?? ""
        return path
    }

    getArrowPath(): string {
        // return this.arrow.getSvgPath(this.target.getAnchor(this.source.center))
        let targetAnchor = this.target.getAnchor(this.source.center);
        if (this.points.length > 0 && this.points[this.points.length - 1] instanceof Anchor2d) {
            targetAnchor = this.points[this.points.length - 1] as Anchor2d
        }
        return this.arrow.getSvgPath(targetAnchor)
    }

    get length(): number {
        const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
        tempPath.setAttribute("d", this.getSvgPath())
        return tempPath.getTotalLength()
    }

}
