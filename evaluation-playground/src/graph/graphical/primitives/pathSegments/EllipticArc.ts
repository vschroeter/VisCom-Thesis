import { Point, Vector } from "2d-geometry";
import { PathSegment } from "./PathSegment";
import { Anchor } from "../Anchor";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";



/**
 * Computes the angle in radians between two 2D vectors
 * @param vx The x component of the first vector
 * @param vy The y component of the first vector
 * @param ux The x component of the second vector
 * @param uy The y component of the second vector
 * @returns The angle in radians between the two vectors
 */
function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
    const dotProduct = ux * vx + uy * vy;
    const magnitudeU = Math.sqrt(ux * ux + uy * uy);
    const magnitudeV = Math.sqrt(vx * vx + vy * vy);

    let cosTheta = dotProduct / (magnitudeU * magnitudeV);

    // Fix rounding errors leading to NaN
    if (cosTheta > 1) {
        cosTheta = 1;
    } else if (cosTheta < -1) {
        cosTheta = -1;
    }

    const angle = Math.acos(cosTheta);

    // Determine the sign based on cross product (ux * vy - uy * vx)
    const sign = (ux * vy - uy * vx) >= 0 ? 1 : -1;

    return sign * angle;
}

export class EllipticArc extends PathSegment {

    static SWEEP_CLOCKWISE: 0 | 1 = 1;
    static SWEEP_COUNTER_CLOCKWISE: 0 | 1 = 0;

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
    _start?: Point;

    // The end point of the arc
    _end?: Point;

    get startAnchor(): Anchor {
        const params = this.getCenterParameters();
        const _start = this._start ?? new Point(0, 0);
        const _startVector = new Vector(params.startAngleGlobal);
        if (this._sweep === EllipticArc.SWEEP_CLOCKWISE) {
            return new Anchor(_start, _startVector.rotate90CW());
        }

        return new Anchor(_start, _startVector.rotate90CCW());
    }

    set startAnchor(anchor: Anchor | undefined) {
        this._start = anchor?.anchorPoint ?? new Point(0, 0);
    }

    get endAnchor(): Anchor {
        const params = this.getCenterParameters();
        const _end = this._end ?? new Point(0, 0);
        const _endVector = new Vector(params.endAngleGlobal);
        if (this._sweep === EllipticArc.SWEEP_CLOCKWISE) {
            return new Anchor(_end, _endVector.rotate90CW());
        }

        return new Anchor(_end, _endVector.rotate90CCW());
    }

    set endAnchor(anchor: Anchor | undefined) {
        this._end = anchor?.anchorPoint;
    }

    // get length(): number {
    //     const params = this.getCenterParameters();
    //     return Math.abs(params.deltaAngle * params.rx);
    // }

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
        connection: LayoutConnection,
        start?: Point,
        end?: Point,
        rx?: number,
        ry?: number,
        rotation: number = 0,
        largeArc: 0 | 1 = 0,
        sweep: 0 | 1 = 1
    ) {
        super(connection);
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

    startPoint(start: Point): EllipticArc {
        this._start = start.clone();
        return this;
    }

    endPoint(end: Point): EllipticArc {
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

    override toString() {
        try {
            this.checkIfValid();
        } catch (e) {
            return "";
        }

        let s = "";
        if (this._start) {
            s = `M ${this._start.x} ${this._start.y} `;
        }
        return s + `A ${this._rx} ${this._ry} ${this._rotation} ${this._largeArc} ${this._sweep} ${this._end!.x} ${this._end!.y}`
    }

    /**
     * Calculate the center of the ellipse for the arc.
     *
     * Based on the official W3C formula: https://www.w3.org/TR/SVG11/implnote.html#ArcConversionEndpointToCenter
     */
    getCenterParameters() {

        const x1 = this._start?.x ?? 0;
        const y1 = this._start?.y ?? 0;
        const x2 = this._end?.x ?? 0;
        const y2 = this._end?.y ?? 0;
        const fA = this._largeArc == 1;
        const fS = this._sweep == 1;
        let rx = Math.abs(this._rx); // Step 0.2: Ensure radii are positive
        let ry = Math.abs(this._ry); // Step 0.2: Ensure radii are positive

        /**
         * if rx===ry x-axis rotation is ignored
         * otherwise convert degrees to radians
         */
        const phi = rx === ry ? 0 : (this._rotation * Math.PI) / 180;

        // Step 0: Ensure valid parameters
        // F.6.6

        // Step 0.1: Ensure radii are non-zero
        if (rx === 0 || ry === 0) {
            // Treat as a straight line and stop further processing
            return {
                center: new Point((x1 + x2) / 2, (y1 + y2) / 2),
                startAngle: 0,
                deltaAngle: 0,
                endAngle: 0,
                startAngleGlobal: 0,
                deltaAngleGlobal: 0,
                endAngleGlobal: 0,
                startAngleDeg: 0,
                deltaAngleDeg: 0,
                endAngleDeg: 0,
                rx: 0,
                ry: 0
            };
        }

        // Step 1: Compute (x1′, y1′)
        // F.6.5.1

        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        const dx = (x1 - x2) / 2;
        const dy = (y1 - y2) / 2;

        const x1Prime = cosPhi * dx + sinPhi * dy;
        const y1Prime = -sinPhi * dx + cosPhi * dy;

        // Step 2: Compute (cx′, cy′)
        // F.6.5.2

        // Compute the square of radii
        const rx2 = rx * rx;
        const ry2 = ry * ry;

        // Compute the square of the transformed points
        const x1Prime2 = x1Prime * x1Prime;
        const y1Prime2 = y1Prime * y1Prime;


        // Step 0.3: Ensure radii are large enough
        const Lambda = (x1Prime2 / (rx * rx)) + (y1Prime2 / (ry * ry));

        if (Lambda > 1) {
            const scale = Math.sqrt(Lambda);
            rx *= scale;
            ry *= scale;
        }

        // Compute the denominator
        const denom = rx2 * y1Prime2 + ry2 * x1Prime2;

        // Compute the numerator
        const num = rx2 * ry2 - rx2 * y1Prime2 - ry2 * x1Prime2;

        // Handle the case where the numerator becomes negative, which would result in an imaginary number
        // This can happen if the radii are too small. So we clamp the number to 0 if it's negative.
        const adjustedNum = Math.max(num, 0);

        // Choose the sign for the square root based on fA and fS
        const sign = fA !== fS ? 1 : -1;

        // Compute (cx', cy')
        const sqrtTerm = sign * Math.sqrt(adjustedNum / denom);

        const cxPrime = sqrtTerm * (rx * y1Prime / ry);
        const cyPrime = sqrtTerm * (-ry * x1Prime / rx);


        // Step 3: Compute (cx, cy) from (cx', cy')
        // F.6.5.3

        // Compute the midpoints of the endpoints
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // Calculate (cx, cy)
        const cx = cosPhi * cxPrime - sinPhi * cyPrime + midX;
        const cy = sinPhi * cxPrime + cosPhi * cyPrime + midY;

        // Step 4: Compute theta1 and deltaTheta

        // F.6.5.5
        // Compute theta1
        // CAUTION: This does not result in the correct angle if rx and ry are different
        // const theta1 = vectorAngle(1, 0, (x1Prime - cxPrime) / rx, (y1Prime - cyPrime) / ry);

        const theta1 = vectorAngle(1, 0, (x1Prime - cxPrime), (y1Prime - cyPrime));

        // For global points rotate the vector (1, 0) by phi
        const rotatedXVector = [Math.cos(-phi), Math.sin(-phi)];
        const globalTheta1 = vectorAngle(rotatedXVector[0], rotatedXVector[1], (x1Prime - cxPrime), (y1Prime - cyPrime));

        // F.6.5.6
        // Compute deltaTheta

        // CAUTION: This does not result in the correct angle if rx and ry are different
        // const deltaTheta = vectorAngle(
        //     (x1Prime - cxPrime) / rx, (y1Prime - cyPrime) / ry,
        //     (-x1Prime - cxPrime) / rx, (-y1Prime - cyPrime) / ry
        // );

        const deltaTheta = vectorAngle(
            (x1Prime - cxPrime), (y1Prime - cyPrime),
            (-x1Prime - cxPrime), (-y1Prime - cyPrime)
        );

        // Modulo deltaTheta by 360 degrees
        let deltaThetaDegrees = deltaTheta * (180 / Math.PI) % 360;
        let globalTheta1Degrees = globalTheta1 * (180 / Math.PI) % 360;

        // Adjust deltaTheta based on the sweep flag fS
        if (!fS && deltaThetaDegrees > 0) {
            deltaThetaDegrees -= 360;
        } else if (fS && deltaThetaDegrees < 0) {
            deltaThetaDegrees += 360;
        }

        if (!fS && globalTheta1Degrees > 0) {
            globalTheta1Degrees -= 360;
        } else if (fS && globalTheta1Degrees < 0) {
            globalTheta1Degrees += 360;
        }

        // Convert theta1 to degrees
        const theta1Degrees = theta1 * (180 / Math.PI);
        // const globalTheta1Degrees = globalTheta1 * (180 / Math.PI);

        return {
            center: new Point(cx, cy),
            rx: rx,
            ry: ry,
            deltaAngleDeg: deltaThetaDegrees,
            startAngleDeg: theta1Degrees,
            endAngleDeg: theta1Degrees + deltaThetaDegrees,
            startAngle: theta1,
            deltaAngle: deltaTheta,
            endAngle: theta1 + deltaTheta,
            startAngleGlobal: globalTheta1,
            deltaAngleGlobal: deltaTheta,
            endAngleGlobal: globalTheta1 + deltaTheta
        };
    }
}
