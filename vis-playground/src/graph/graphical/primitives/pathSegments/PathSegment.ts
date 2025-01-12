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

    connection: LayoutConnection;
    constructor(connection: LayoutConnection) {
        this.connection = connection;
    }

    /** The start anchor of the path segment */
    abstract startAnchor?: Anchor;

    /** The end anchor of the path segment */
    abstract endAnchor?: Anchor;

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
        return new Anchor(this.connection!.source.center, this.connection!.target.center);
    }

    get endAnchor(): Anchor | undefined {
        return new Anchor(this.connection!.target.center, new Vector(this.connection!.source.center, this.connection!.target.center));
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

    get startAnchor(): Anchor | undefined {
        if (this.segments.length === 0) {
            return undefined;
        }
        return this.segments[0].startAnchor;
    }

    get endAnchor(): Anchor | undefined {
        if (this.segments.length === 0) {
            return undefined;
        }
        return this.segments[this.segments.length - 1].endAnchor;
    }

    override getSvgPath(): string {
        return this.segments.map(s => s.getSvgPath()).join(" ");
    }
}
