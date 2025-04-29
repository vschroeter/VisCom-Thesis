import { Point, Vector } from "2d-geometry";
import { Anchor } from "../Anchor";
import { LayoutNode } from "src/graph/visGraph/layoutNode";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

// export interface SvgPathSegment {
//     start: Point;
//     end: Point;
//     getSvgPath(): string;
// }

export abstract class PathSegment {
    stroke?: string;

    cId: string

    connection: LayoutConnection;
    constructor(connection: LayoutConnection) {
        this.connection = connection;
        this.cId = connection.id;
    }

    /** The start anchor of the path segment */
    abstract startAnchor?: Anchor;

    /** The end anchor of the path segment */
    abstract endAnchor?: Anchor;

    /** The start node of the path segment */
    get startNode(): LayoutNode {
        return this.connection.source;
    }

    /** The end node of the path segment */
    get endNode(): LayoutNode {
        return this.connection.target;
    }

    get target(): LayoutNode {
        return this.endNode;
    }

    get source(): LayoutNode {
        return this.startNode;
    }

    /** The start point of the segment */
    get start(): Point {
        return this.startAnchor?.anchorPoint ?? new Point(0, 0);
    }

    /** The end point of the segment */
    get end(): Point {
        return this.endAnchor?.anchorPoint ?? new Point(0, 0);
    }

    /** The start vector of the segment */
    get startVector(): Vector {
        return this.startAnchor?.direction ?? new Vector(0, 0);
    }

    /** The end vector of the segment */
    get endVector(): Vector {
        return this.endAnchor?.direction ?? new Vector(0, 0);
    }

    /** THe svg path string of the segment */
    abstract getSvgPath(): string;

    get svgPath(): string {
        return this.getSvgPath();
    }
}

export class DefaultPathSegment extends PathSegment {

    get startAnchor(): Anchor | undefined {
        return this.connection.source.getAnchor(this.connection.target.center).move(this.connection.source.outerRadius - this.connection.source.radius);
    }

    get endAnchor(): Anchor | undefined {
        return this.connection.target.getAnchor(this.connection.source.center).move(this.connection.target.outerRadius - this.connection.target.radius).cloneReversed();;
    }

    constructor(layoutConnection: LayoutConnection) {
        super(layoutConnection);
        this.connection = layoutConnection;
    }

    getSvgPath(): string {
        return `M ${this.start.x} ${this.start.y} L ${this.end.x} ${this.end.y}`;
    }

}

export class CombinedPathSegment extends PathSegment {

    segments: PathSegment[] = [];

    constructor(connection: LayoutConnection, segments?: PathSegment[]) {
        super(connection);
        this.segments = segments ?? [];
    }

    get startAnchor(): Anchor | undefined {
        if (this.segments.length === 0) {
            return new DefaultPathSegment(this.connection).startAnchor;
        }
        return this.segments[0].startAnchor;
    }

    get endAnchor(): Anchor | undefined {
        if (this.segments.length === 0) {
            return new DefaultPathSegment(this.connection).endAnchor;
        }
        return this.segments[this.segments.length - 1].endAnchor;
    }

    override getSvgPath(): string {
        if (this.segments.length === 0) {
            return new DefaultPathSegment(this.connection).getSvgPath();
        }

        return this.segments.filter(s => s !== undefined).map(s => s.getSvgPath()).join(" ");
    }
}

export class StringSegment extends PathSegment {

    pathString: string;

    startAnchor: Anchor | undefined;
    endAnchor: Anchor | undefined;

    constructor(layoutConnection: LayoutConnection, pathString: string, startAnchor?: Anchor, endAnchor?: Anchor) {
        super(layoutConnection);
        this.pathString = pathString;
        this.startAnchor = startAnchor;
        this.endAnchor = endAnchor;
    }

    getSvgPath(): string {

        return this.pathString;
    }
}
