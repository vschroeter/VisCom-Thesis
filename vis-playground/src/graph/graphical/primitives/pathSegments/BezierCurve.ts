import { Point, Vector } from "2d-geometry";
import { PathSegment } from "./PathSegment";
import { Anchor } from "../Anchor";
import { LayoutConnection } from "src/graph/visGraph/layoutConnection";

export class QuadraticBezierCurve extends PathSegment {

    startAnchor: Anchor;
    endAnchor: Anchor;

    _control: Point;

    /** The control point of the curve */
    get control(): Point {
        return this._control;
    }

    /** The control point of the curve */
    set control(value: Point) {
        this._control = value;
        this.startAnchor.direction = new Vector(this.start, value);
        this.endAnchor.direction = new Vector(this.end, value);
    }

    override set start(value: Point) {
        this.startAnchor = new Anchor(value, this.control);
    }

    override set end(value: Point) {
        this.endAnchor = new Anchor(this.control, value);
    }

    constructor(connection: LayoutConnection ,start: Point, control: Point, end: Point) {
        super(connection);
        this.startAnchor = new Anchor(start, control);
        this.endAnchor = new Anchor(control, end);
        this._control = control;
    }

    getSvgPath(): string {
        return `M ${this.start.x} ${this.start.y} Q ${this._control.x} ${this._control.y}, ${this.end.x} ${this.end.y}`;
    }

}

export class CubicBezierCurve extends PathSegment {

    startAnchor: Anchor;
    endAnchor: Anchor;

    /** The first control point of the curve (closer to the start point) */
    _control1: Point;
    /** The second control point of the curve (closer to the end point) */
    _control2: Point;

    get control1(): Point {
        return this._control1;
    }

    set control1(value: Point) {
        this._control1 = value;
        this.startAnchor.direction = new Vector(this.start, value);
    }

    get control2(): Point {
        return this._control2;
    }

    set control2(value: Point) {
        this._control2 = value;
        this.endAnchor.direction = new Vector(value, this.end);
    }

    constructor(connection: LayoutConnection, start: Point, control1: Point, control2: Point, end: Point) {
        super(connection);
        this.startAnchor = new Anchor(start, control1);
        this.endAnchor = new Anchor(end, new Vector(control2, end));

        this._control1 = control1;
        this._control2 = control2;
    }

    getSvgPath(): string {
        return `M ${this.start.x} ${this.start.y} C ${this.control1.x} ${this.control1.y}, ${this.control2.x} ${this.control2.y}, ${this.end.x} ${this.end.y}`;
    }

}
