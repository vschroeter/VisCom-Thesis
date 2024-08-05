import { CommunicationLink } from "../commGraph";
import { AbstractNode2d } from "./AbstractNode2d";
import { Point2D } from "./Point2d";

export type CurveStyle = "linear" | "basis" | "natural" | d3.CurveFactory

export class AbstractConnection2d {

    /** The points that make up the connection */
    points: Point2D[] = []

    /** The style of the curve */
    curveStyle: CurveStyle = "linear"

    /** The data of the link */
    data?: CommunicationLink

    source: AbstractNode2d
    target: AbstractNode2d

    constructor(
        source: AbstractNode2d,
        target: AbstractNode2d,
        data?: CommunicationLink,
    ) {
        this.source = source
        this.target = target
        this.data = data
    }

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
