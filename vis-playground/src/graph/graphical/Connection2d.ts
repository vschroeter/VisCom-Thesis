import { CommunicationLink } from "../commGraph";
import { Node2d } from "./Node2d";
import { Anchor2d } from "./Anchor2d";
import { EllipticArc } from "./EllipticArc";
import { Point2D } from "./Point2d";

import * as d3 from "d3"
import { SvgRenderable } from "./Renderable";

export type CurveStyle = "linear" | "basis" | "natural" | d3.CurveFactory

export class Arrow2D {

    width: number = 10
    height: number = 10
    filled: boolean = false
    // closed: boolean = true

    static readonly normalPoints = [
        new Point2D(1, -0.5),
        new Point2D(0, 0),
        new Point2D(1, 0.5),
    ]

    static readonly narrowPoints = [
        new Point2D(1, -0.25),
        new Point2D(0, 0),
        new Point2D(1, 0.25),
    ]

    set size(size: number) {
        this.width = size
        this.height = size
    }

    getSvgPath(anchor: Anchor2d) {

        const startPoint = anchor.anchorPoint
        const direction = anchor.direction

        const points = Array.from(Arrow2D.narrowPoints);
        // if (this.closed) {
        //     points.push(points[0])
        // }

        const scaledPoints = points.map(p => p.scale(this.width, this.height))
        const rotatedPoints = scaledPoints.map(p => p.rotate(-direction.degBetween(), { x: 0, y: 0 }))

        const path = d3.line<Point2D>()
            .x(d => d.x + startPoint.x)
            .y(d => d.y + startPoint.y)
            .curve(d3.curveLinear)

        return path(rotatedPoints)!;
    }

    // getAnchorPoint


}

export interface Connection2dData {
    /** The id of the source node */
    fromId: string;
    /** The id of the target node */
    toId: string;

    /** The weight of the link */
    weight?: number;
}

export class Connection2d<T extends Connection2dData = Connection2dData> extends SvgRenderable {

    /** The points that make up the connection */
    points: (Point2D | EllipticArc | Anchor2d)[] = []

    /** The style of the curve */
    curveStyle: CurveStyle = "linear"

    /** The data of the link */
    data: T

    /** The source node of the connection */
    source: Node2d
    /** The target node of the connection */
    target: Node2d


    arrow: Arrow2D = new Arrow2D()

    opacity: number = 1
    stroke?: string
    strokeWidth: number = 1


    constructor(
        source: Node2d,
        target: Node2d,
        data: T,
    ) {
        super('g', 'connection2d');

        this.source = source
        this.target = target
        this.data = data

        this.source.emitter.on("positionUpdated", () => this.addUpdateCallback(this.renderPath))
        this.target.emitter.on("positionUpdated", () => this.addUpdateCallback(this.renderPath))

        this.updateCallbacks.push(...[this.renderPath, this.renderStyleOpacity, this.renderStyleStroke])

    }

    /** The weight of the connection */
    get weight() {
        return this.data.weight ?? 1
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


    ////////////////////////////////////////////////////////////////////////////
    // Style update methods
    ////////////////////////////////////////////////////////////////////////////

    //++++ Path ++++//
    renderPath(selection: d3.Selection<any, any, any, any>) {
        this.selectSubElement('path.link').attr('d', this.getSvgPath())

        // Check the length of the connection and scale down the arrow if necessary
        const length = this.length

        const baseSize = 5 * this.strokeWidth;
        const size = Math.min(baseSize, length / 2 * 0.6)
        this.arrow.size = size
        
        this.selectSubElement('path.arrow').attr('d', this.getArrowPath())
    }

    //++++ Opacity ++++//

    renderStyleOpacity(selection: d3.Selection<any, any, any, any>) {
        selection.attr('opacity', this.opacity);
    }
    updateStyleOpacity(opacity: number) {
        this.checkValueAndAddUpdateCallback([
            { currentValuePath: 'opacity', newValue: opacity },
        ], this.renderStyleOpacity);
    }

    //++++ Stroke ++++//

    private applyStrokeAttributs(selection: d3.Selection<any, any, any, any>) {
        selection
            .attr('stroke', this.stroke ?? "black")
            .attr('stroke-width', this.strokeWidth)
        return selection
    }

    renderStyleStroke(selection: d3.Selection<any, any, any, any>) {
        this.applyStrokeAttributs(this.selectSubElement('path.link'));
        this.applyStrokeAttributs(this.selectSubElement('path.arrow')).attr('fill', this.stroke ?? "none");
    }

    updateStyleStroke(stroke?: string, strokeWidth?: number) {
        this.checkValueAndAddUpdateCallback([
            { currentValuePath: 'stroke', newValue: stroke },
            { currentValuePath: 'strokeWidth', newValue: strokeWidth },
        ], this.renderStyleStroke);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Render methods
    ////////////////////////////////////////////////////////////////////////////

    override addSubElements(): void {
        this.addSubElement('path', 'link')
            .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "miter").attr("stroke-miterlimit", 1)
            // .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
        this.addSubElement('path', 'arrow')
            // .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
            .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "miter").attr("stroke-miterlimit", 1)
    }
}
