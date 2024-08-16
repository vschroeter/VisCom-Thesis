import { Point2D } from "./Point2d";

export class EllipticArc {

    // Radius of the ellipse in the x direction
    _rx: number = 0;
    // Radius of the ellipse in the y direction
    _ry: number = 0;

    /** Rotation of the ellipse in degrees
     *  
     */
    _rotation: number = 0;

    // If true, the ellipse will take the long way around to hit the points. If false, the ellipse will take the short way around.
    _largeArc: 0 | 1 = 0;

    // If true, the arc will be drawn in a "positive-angle" direction, i.e., the arc will be drawn in the direction of increasing angles.
    _sweep: 0 | 1 = 1;

    // The start point of the arc. If not set, the arc will start at the current / last point of the path. 
    _start?: Point2D;

    // The end point of the arc
    _end?: Point2D;

    /**
     * Creates an instance of EllipticArc.
     * 
     * @param start Start point of the arc. If not set, the arc will start at the current / last point of the path.
     * @param end End point of the arc
     * @param rx Radius of the ellipse in the x direction
     * @param ry Radius of the ellipse in the y direction
     * @param rotation Rotation of the ellipse in degrees
     * @param largeArc If true, the ellipse will take the long way around to hit the points. If false, the ellipse will take the short way around.
     * @param sweep If true, the arc will be drawn in a "positive-angle" direction, i.e., the arc will be drawn in the direction of increasing angles.
     */
    constructor(
        start?: Point2D,
        end?: Point2D,
        rx?: number,
        ry?: number,
        rotation: number = 0,
        largeArc: 0 | 1 = 0,
        sweep: 0 | 1 = 1
    ) {
        this._start = start;
        this._end = end;
        this._rx = rx ?? 0;
        this._ry = ry ?? 0;
        this._rotation = rotation;
        this._largeArc = largeArc;
        this._sweep = sweep;
    }

    radius(r: number): EllipticArc;
    radius(rx: number, ry?: number): EllipticArc {
        this._rx = rx;
        if (ry) {
            this._ry = ry;
        } else {
            this._ry = rx;
        }
        return this;
    }

    startPoint(start: Point2D): EllipticArc {
        this._start = start.clone();
        return this;
    }

    endPoint(end: Point2D): EllipticArc {
        this._end = end.clone();
        return this;
    }

    rotation(r: number): EllipticArc {
        this._rotation = r;
        return this;
    }

    largeArc(l: 0 | 1): EllipticArc {
        this._largeArc = l;
        return this;
    }

    direction(direction: 0 | 1 | "clockwise" | "counter-clockwise"): EllipticArc {
        if (direction === "clockwise") {
            this._sweep = 1;
        } else if (direction === "counter-clockwise") {
            this._sweep = 0;
        } else {
            this._sweep = direction;
        }
        return this;
    }


    private checkIfValid() {

        if (!this._end) {
            throw new Error("End point is not set");
        }
        if (!this._rx || !this._ry) {
            throw new Error("Radius is not set");
        }
    }

    getSvgPath(): string {
        return this.toString();
    }

    toString() {
        this.checkIfValid();

        let s = "";
        if (this._start) {
            s = `M ${this._start.x} ${this._start.y} `;
        }
        return s + `A ${this._rx} ${this._ry} ${this._rotation} ${this._largeArc} ${this._sweep} ${this._end!.x} ${this._end!.y}`
    }

    // static fromRadial({
    //     start,
    //     end,
    //     rx,
    //     ry,
    //     largeArc = 0,
    //     sweep = 0
    // }: {
    //     start: Point2D,
    //     end: Point2D,
    //     rx: number,
    //     ry: number,
    //     largeArc?: 0 | 1,
    //     sweep?: 0 | 1
    // }
    // ) {
    //     return new EllipticArc({
    //         start: start,
    //         end: end,
    //         rx: rx,
    //         ry: ry,
    //         largeArc: largeArc,
    //         sweep: sweep
    //     })
    // }
}
