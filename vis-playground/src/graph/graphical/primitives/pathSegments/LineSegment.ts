import { Point, Vector } from "2d-geometry";
import { Anchor } from "../Anchor";
import { PathSegment } from "./PathSegment";

export class StraightLineSegment extends PathSegment {
    startAnchor: Anchor;
    endAnchor: Anchor;

    constructor(start: Point, end: Point) {
        super();
        this.startAnchor = new Anchor(start, end);
        this.endAnchor = new Anchor(end, new Vector(start, end));
    }

    getSvgPath(): string {
        return `M ${this.start.x} ${this.start.y} L ${this.end.x} ${this.end.y}`;
    }
}