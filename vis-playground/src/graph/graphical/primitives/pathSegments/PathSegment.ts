import { Point } from "2d-geometry";

export interface SvgPathSegment {
    start: Point;
    end: Point;
    getSvgPath(): string;
}
