import { Point, Vector } from "2d-geometry";
import { Anchor } from "../Anchor";
import { PathSegment } from "./PathSegment";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export class StraightLineSegment extends PathSegment {
    startAnchor: Anchor;
    endAnchor: Anchor;
    ignoreMoveCmd: boolean;

    constructor(connection: LayoutConnection, start: Point, end: Point, ignoreMoveCmd = false) {
        super(connection);
        this.startAnchor = new Anchor(start, end);
        this.endAnchor = new Anchor(end, new Vector(start, end));
        this.ignoreMoveCmd = ignoreMoveCmd;
    }

    getSvgPath(): string {
        if (this.ignoreMoveCmd) {
            return `L ${this.end.x} ${this.end.y}`;
        }
        return `M ${this.start.x} ${this.start.y} L ${this.end.x} ${this.end.y}`;
    }
}