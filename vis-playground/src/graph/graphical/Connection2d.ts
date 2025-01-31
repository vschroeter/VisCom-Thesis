import { Anchor } from "./";

import * as d3 from "d3"
// import { SvgRenderable } from "./Renderable";
import { Point, ShapeTag } from "2d-geometry";
import { CurveStyle, LayoutConnection, LayoutConnectionPoint } from "../visGraph/layoutConnection";
import { LayoutNode } from "../visGraph/layoutNode";
import { PathSegment } from "./primitives/pathSegments/PathSegment";
import { BoundingBox, SvgRenderable } from "../visGraph/renderer/renderer";

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

    /** The path segment of the connection */
    get pathSegment(): PathSegment {
        return this.layoutConnection.pathOrDefault
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
    visibilityOpacity: number = 1
    // stroke?: string

    get stroke(): string | undefined {
        return this.layoutConnection.pathSegment?.stroke;
    }

    set stroke(value: string | undefined) {
        if (!this.layoutConnection.pathSegment) {
            return;
        }
        this.layoutConnection.pathSegment.stroke = value;
    }

    strokeWidth: number = 1

    maxWidth = 10

    elGroup?: d3.Selection<SVGGElement, unknown, null, undefined>
    elPath?: d3.Selection<SVGPathElement, unknown, null, undefined>
    elArrow?: d3.Selection<SVGPathElement, unknown, null, undefined>

    constructor(
        layoutConnection: LayoutConnection,
    ) {
        super(layoutConnection.source.visGraph.renderer);

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

    get startPoint(): Point {
        return this.pathSegment.start;
    }

    get endPoint(): Point {
        return this.pathSegment.end;
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
                    path += (point as PathSegment).getSvgPath() + " "
                }
            });

            return path + (currentPoints.length > 0 ? pointLine(currentPoints) : "")
        }


    }

    getSvgPath(): string {
        return this.pathSegment.getSvgPath();
        // let points = this.points
        // if (points.length == 0) {
        //     // points = [this.source.center, this.target.center]
        //     points = [this.startPoint, this.endPoint]
        // }
        // const path = this.pathGenerator(points) ?? ""
        // return path
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

    updateBoundingBox() {

        const bbox = this.elPath?.node()?.getBBox();
        if (bbox) {
            this.setBoundingBox({
                x: bbox.x,
                y: bbox.y,
                w: bbox.width,
                h: bbox.height
            })
        }
    }

    //++++ Path ++++//
    renderPath() {
        // Check the length of the connection and scale down the arrow if necessary
        const length = this.length

        const baseSize = 5 * this.strokeWidth;
        const size = Math.min(baseSize, length / 2 * 0.6)
        this.arrow.size = size

        // Combine this for better .pdf export
        this.elPath?.attr('d', this.getSvgPath() + " " + this.getArrowPath())
        // this.elArrow?.attr('d', this.getArrowPath())

        this.updateBoundingBox();
    }


    updatePath() {
        this.addUpdateCallback(this.renderPath)
    }

    //++++ Opacity ++++//

    renderStyleOpacity() {
        this.elGroup?.attr('opacity', this.opacity * this.visibilityOpacity);
    }
    updateStyleOpacity(opacity: number) {
        this.checkValueAndAddUpdateCallback([
            { currentValuePath: 'opacity', newValue: opacity },
        ], this.renderStyleOpacity);
    }

    updateStyleVisibilityOpacity(opacity: number) {
        this.checkValueAndAddUpdateCallback([
            { currentValuePath: 'visibilityOpacity', newValue: opacity },
        ], this.renderStyleOpacity);
    }

    //++++ Stroke ++++//

    private applyStrokeAttributes(selection?: d3.Selection<any, unknown, null, undefined>) {
        if (!selection) {
            return selection
        }
        selection
            .attr('stroke', this.stroke ?? "black")
            .attr('stroke-width', this.strokeWidth)
        return selection
    }

    renderStyleStroke() {
        this.applyStrokeAttributes(this.elPath);
        this.applyStrokeAttributes(this.elArrow)?.attr('fill', this.stroke ?? "none");

        this.renderPath()
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
        this.elGroup = this.elGroup ?? this.addSubElement('g', 'connection')
            .on("mouseenter", () => {

                const id = this.id;
                if (id) {
                    const visGraph = this.layoutConnection.source.visGraph;
                    const userInteractions = visGraph?.userInteractions;
                    if (!userInteractions) {
                        console.error("No user interactions found for ", visGraph);
                        return
                    }
                    userInteractions.addHoveredConnection(this.layoutConnection, true)
                }
            })
            .on("mouseleave", () => {

                const id = this.id;
                if (id) {
                    const visGraph = this.layoutConnection.source.visGraph;
                    const userInteractions = visGraph?.userInteractions;
                    if (!userInteractions) {
                        console.error("No user interactions found for ", visGraph);
                        return
                    }
                    userInteractions.removeHoveredConnection(this.layoutConnection, true)
                }

            })

        this.elPath = this.elPath ?? this.addSubElement('path', 'link', this.elGroup)
            .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "miter").attr("stroke-miterlimit", 1)
        // .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
        this.elArrow = this.elArrow ?? this.addSubElement('path', 'arrow', this.elGroup)
            // .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
            .attr('fill', 'none').attr("stroke-linecap", "round").attr("stroke-linejoin", "miter").attr("stroke-miterlimit", 1)
    }

    override updateVisibleArea(visibleArea: BoundingBox): void {

        if (this.layoutConnection.isThroughVirtualNodes) {

            if (!this.boundingBox) {
                this.updateBoundingBox();
            }

            const bbox = {
                x: this.boundingBox!.x,
                y: this.boundingBox!.y,
                w: this.boundingBox!.w,
                h: this.boundingBox!.h,
            }

            // Calculate the visible part of the connection
            const x0 = Math.max(visibleArea.x, bbox.x);
            const y0 = Math.max(visibleArea.y, bbox.y);

            const x1 = Math.min(visibleArea.x + visibleArea.w, bbox.x + bbox.w);
            const y1 = Math.min(visibleArea.y + visibleArea.h, bbox.y + bbox.h);

            const w = x1 - x0;
            const h = y1 - y0;

            let opacity = 1;

            if (w < 0 || h < 0) {
                opacity = 0;                
            } else {
                const area = w * h;
                const totalArea = bbox.w * bbox.h;
                opacity = (area / (totalArea)) ** 2;
            }

            if (this.layoutConnection.id == "drive_manager->camera") {
                console.log({
                    bbox,
                    visibleArea,
                    opacity
                });
            }
            opacity = 1;
            this.updateStyleVisibilityOpacity(opacity);
        }

    }


    override subElementsExist(): boolean {
        return this.elPath !== undefined && this.elArrow !== undefined && this.elGroup !== undefined;
    }
    override removeSubElements(): void {
        this.elPath?.remove();
        this.elArrow?.remove();
        this.elGroup?.remove();

        this.elPath = this.elArrow = this.elGroup = undefined;
    }
}
