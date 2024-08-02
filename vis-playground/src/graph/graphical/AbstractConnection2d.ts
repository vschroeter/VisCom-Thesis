import { Point2D } from "./Point2d";

export type CurveStyle = "linear" | "basis" | "natural" | d3.CurveFactory

export class AbstractConnection2d {

    /** The points that make up the connection */
    points: Point2D[] = []

    /** The style of the curve */
    curveStyle: CurveStyle = "linear"

    constructor(
    ) {}

    get startPoint(): Point2D | undefined {
        if (this.points.length == 0) {
            return undefined
        }

        return this.points[0]
    }

    get endPoint(): Point2D | undefined {
        if (this.points.length == 0) {
            return undefined
        }

        return this.points[this.points.length - 1]
    }


  }
  