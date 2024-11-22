import { Point } from "2d-geometry";
import { SvgPathSegment } from "./PathSegment";


export class CubicBezierCurve implements SvgPathSegment {

    // The start point of the curve
    start: Point;
    // The end point of the curve
    end: Point;
    // The first control point of the curve (closer to the start point)
    control1: Point;
    // The second control point of the curve (closer to the end point)
    control2: Point;

    constructor(start: Point, control1: Point, control2: Point, end: Point) {
        this.start = start;
        this.control1 = control1;
        this.control2 = control2;
        this.end = end;
    }

    getSvgPath(): string {
        // return `C ${this.control1.x} ${this.control1.y}, ${this.control2.x} ${this.control2.y}, ${this.end.x} ${this.end.y}`;
        return `M ${this.start.x} ${this.start.y} C ${this.control1.x} ${this.control1.y}, ${this.control2.x} ${this.control2.y}, ${this.end.x} ${this.end.y}`;
    }

}