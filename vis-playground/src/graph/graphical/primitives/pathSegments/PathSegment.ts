import { Point, Vector } from "2d-geometry";
import { Anchor } from "../Anchor";

// export interface SvgPathSegment {
//     start: Point;
//     end: Point;
//     getSvgPath(): string;
// }

export abstract class PathSegment {

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
}
