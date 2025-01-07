import { CommunicationLink } from "../commGraph";
import { Node2d } from "./";
import { Anchor } from "./";
import { EllipticArc } from "./";
// import { Point } from "./";

import * as d3 from "d3"
import { SvgRenderable } from "./Renderable";
import { Point, ShapeTag } from "2d-geometry";
import { CurveStyle, LayoutConnection, LayoutConnectionPoint } from "../visGraph/layoutConnection";
import { LayoutNode } from "../visGraph/layoutNode";
import { SvgPathSegment } from "./primitives/pathSegments/PathSegment";

export class Arrow2D {

    width: number = 10
    height: number = 10
    filled: boolean = false
    // closed: boolean = true

    static readonly normalPoints = [
        new Point(1, -0.5),
        new Point(0, 0),
        new Point(1, 0.5),
    ]

    static readonly narrowPoints = [
        new Point(1, -0.25),
        new Point(0, 0),
        new Point(1, 0.25),
    ]

    set size(size: number) {
        this.width = size
        this.height = size
    }

    getSvgPath(anchor: Anchor) {

        const startPoint = anchor.anchorPoint
        const direction = anchor.direction.rotate(Math.PI) // Rotate by 180 degrees

        const points = Array.from(Arrow2D.narrowPoints);
        // if (this.closed) {
        //     points.push(points[0])
        // }

        const scaledPoints = points.map(p => p.scale(this.width, this.height))
        const rotatedPoints = scaledPoints.map(p => p.rotate(direction.slope, { x: 0, y: 0 }))

        const path = d3.line<Point>()
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

// export class Connection2d<T extends Connection2dData = Connection2dData> extends SvgRenderable {
export class Connection2d extends SvgRenderable {


    /** The defining layout connection */
    layoutConnection: LayoutConnection;

    get id(): string {
        return this.layoutConnection.id
    }

    // /** The points defining the connection */
    get points(): LayoutConnectionPoint[] {
        return this.layoutConnection.points
    }

    get startAnchor(): Anchor | undefined {
        return this.layoutConnection.startAnchor;
    }

    get endAnchor(): Anchor | undefined {
        return this.layoutConnection.endAnchor;
    }

    get curveStyle(): CurveStyle {
        return this.layoutConnection.curveStyle
    }

    /** The source node of the connection */
    source: LayoutNode
    /** The target node of the connection */
    target: LayoutNode


    arrow: Arrow2D = new Arrow2D()

    opacity: number = 1
    stroke?: string
    strokeWidth: number = 1

    maxWidth = 10

    constructor(
        layoutConnection: LayoutConnection,
    ) {
        super('g', 'connection2d');

        this.layoutConnection = layoutConnection
        this.source = layoutConnection.source
        this.target = layoutConnection.target

        // this.source.emitter.on("positionUpdated", () => this.addUpdateCallback(this.renderPath))
        // this.target.emitter.on("positionUpdated", () => this.addUpdateCallback(this.renderPath))

        this.updateCallbacks.push(...[this.renderPath, this.renderStyleOpacity, this.renderStyleStroke])

    }

    requireUpdate({
        path = false,
        stroke = false,
        opacity = false,
    }: {
        path?: boolean,
        stroke?: boolean,
        opacity?: boolean,
    } = { path: true, stroke: true, opacity: true }) {
        if (path) {
            this.addUpdateCallback(this.renderPath)
        }
        if (stroke) {
            this.addUpdateCallback(this.renderStyleStroke)
        }
        if (opacity) {
            this.addUpdateCallback(this.renderStyleOpacity)
        }
    }

    /** The weight of the connection */
    get weight() {
        return this.layoutConnection.weight ?? 1
    }

    /** The start point of the connection (either the first defined point or the source node) */
    get startPoint(): Point {
        if (this.points.length == 0) {
            if (this.source == this.target) {
                return this.source.center
            }
            return this.source.getAnchor(this.target.center).anchorPoint;
        }

        if ((this.points[0] as Point).tag == ShapeTag.Point) {
            return this.points[0] as Point
        }

        // if (this.points[0] instanceof EllipticArc) {
        //     return (this.points[0] as EllipticArc)._start ?? this.source.center
        // }

        if (this.points[0] instanceof Anchor) {
            return (this.points[0] as Anchor).anchorPoint
        }

        // Otherwise, it will be a PathSegment
        if ((this.points[0] as SvgPathSegment).start) {
            return (this.points[0] as SvgPathSegment).start
        }

        return this.source.center
    }

    /** The end point of the connection (either the last defined point or the target node) */
    get endPoint(): Point {
        if (this.points.length == 0) {
            if (this.source == this.target) {
                return this.source.center
            }
            return this.target.getAnchor(this.source.center).anchorPoint;
        }

        const lastPoint = this.points[this.points.length - 1]


        if ((lastPoint as Point).tag == ShapeTag.Point) {
            return lastPoint as Point
        }

        if (lastPoint instanceof Anchor) {
            return lastPoint.anchorPoint
        }

        // Otherwise, it will be a PathSegment
        if ((lastPoint as SvgPathSegment).end) {
            return (lastPoint as SvgPathSegment).end
        }

        return this.target.center
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
        const pointLine = d3.line<Point>()
            .x(d => d.x)
            .y(d => d.y)
            .curve(this.curveFactory)

        return (points: LayoutConnectionPoint[]) => {
            let path = ""
            let currentPoints: Point[] = []
            points.forEach((point, i) => {

                if ((point as Point).tag == ShapeTag.Point) {
                    currentPoints.push(point as Point)
                } else if (point instanceof Anchor) {
                    currentPoints.push(point.anchorPoint)
                }
                // Otherwise, it will be a PathSegment
                else {
                    if (currentPoints.length > 0) {
                        path += pointLine(currentPoints) + " "
                        currentPoints = []
                    }
                    path += (point as SvgPathSegment).getSvgPath() + " "
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
        let targetAnchor: Anchor;
        if (this.endAnchor) {
            targetAnchor = this.endAnchor;
        } else {
            targetAnchor = this.target.getAnchor(this.source.center);
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

    updatePath() {
        this.addUpdateCallback(this.renderPath)
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

        this.renderPath(selection)
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
