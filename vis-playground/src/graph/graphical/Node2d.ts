import _ from 'lodash';
import { CommunicationNode } from '../commGraph';
import { NodeCommunities } from '../commGraph/community';
import { RenderArgs } from '../layouter/layouter';
import { Anchor2d } from './';
import { StrokeStyle } from './primitives/StrokeStyle';

import * as d3 from 'd3';
import { SvgRenderable } from './Renderable';
import mitt from 'mitt';
import { Circle, Point, Vector } from '2d-geometry';

export interface Node2dData {
  id: string;
  score?: number;
  successorCount?: number;
  predecessorCount?: number;
  outDegree?: number;
  inDegree?: number;
  communities?: NodeCommunities;
}

export class Node2d<T extends Node2dData = Node2dData> extends SvgRenderable { // <NodeData>

  // Center of the node
  center: Point;

  // The (abstract communication graph's node) data of the node
  // data?: CommunicationNode // NodeData;
  data: T;

  // The id of the node
  get id() {
    return this.data.id;
  }

  // The radius of the node. Can also have an abstract meaning for non-circular nodes.
  private _radius: number = 10;
  get radius() {
    return this._radius;
  }
  set radius(value: number) {
    this.updatePositionAndSize(undefined, undefined, this.radius);
    // this._radius = value;
  }

  // The circle object representing the node
  get circle() {
    return new Circle(this.center, this.radius);
  }

  // x velocity of the node (for force-directed simulations)
  vx: number = 0;
  // y velocity of the node (for force-directed simulations)
  vy: number = 0;
  // fixed x position of the node (for force-directed simulations)
  fx: number | null = null;
  // fixed y position of the node (for force-directed simulations
  fy: number | null = null;

  // The score of the node (e.g. for ranking the significance of nodes)
  score: number = 0;

  // Reference to the node communities
  communities?: NodeCommunities;

  // The fill color of the node
  fill: string = 'red';

  // Whether the node should be filled
  filled: boolean = true;

  // The stroke style of the node
  strokeStyle: StrokeStyle = new StrokeStyle();

  // The opacity of the node
  opacity: number = 1;

  // X coordinate of the node's center
  get x() {
    return this.center.x;
  }

  // Set the x coordinate of the node's center
  set x(value: number) {
    this.updatePositionAndSize(value);
    // this.center.x = value;
  }

  // Y coordinate of the node's center
  get y() {
    return this.center.y;
  }
  // Set the y coordinate of the node's center
  set y(value: number) {
    this.updatePositionAndSize(undefined, value);
    // this.center.y = value;
  }

  emitter = mitt<{
    positionUpdated: void
  }>();

  constructor(data: T, center?: Point | null) {

    super("circle", "node2d");

    this.center = center || new Point(0, 0);
    this.data = data;

    this.updateCallbacks.push(...[this.renderStyleFill, this.renderStyleStroke, this.renderStyleOpacity, this.renderPositionAndSize]);
  }

  requireUpdate({
    position = false,
    fill = false,
    stroke = false,
    opacity = false,
  }: {
    position?: boolean,
    fill?: boolean,
    stroke?: boolean,
    opacity?: boolean,
  } = {position: true, fill: true, stroke: true, opacity: true}) {
    if (position) {
      this.addUpdateCallback(this.renderPositionAndSize)
    }
    if (fill) {
      this.addUpdateCallback(this.renderStyleFill)
    }
    if (stroke) {
      this.addUpdateCallback(this.renderStyleStroke)
    }
    if (opacity) {
      this.addUpdateCallback(this.renderStyleOpacity)
    }
  }

  ////////////////////////////////////////////////////////////////////////////
  // Anchor methods
  ////////////////////////////////////////////////////////////////////////////


  /**
   * Get the anchor of the node directed towards a given point
   * @param point The point, towards which the anchor should be directed
   */
  getAnchor(point: Point): Anchor2d;
  /**
   * Get the anchor of the node directed towards a given vector
   * @param vector The vector originating from the node's center, towards which the anchor should be directed
   */
  getAnchor(vector: Vector): Anchor2d;
  getAnchor(param: Point | Vector): Anchor2d {

    let vector: Vector | null = null;
    if (param instanceof Point) {
      vector = new Vector(param.x - this.center.x, param.y - this.center.y);
    } else if (param instanceof Vector) {
      vector = param;
    }

    if (!vector) {
      throw new Error("Invalid parameter type");
    }

    // For the abstract circle node, the direction is the same as the vector
    // The anchor point is the intersection of the circle and the vector

    const direction = vector;
    // console.log('[NODE] getAnchor', direction, this);
    let anchorPoint: Point;
    if (direction.length == 0) {
      anchorPoint = this.center;
    } else {
      anchorPoint = this.center.translate(direction.normalize().multiply(this.radius));
    }
    return new Anchor2d(anchorPoint, direction);

  }

  //++++ Fill ++++//

  renderStyleFill() {
    // console.log('[NODE] renderStyleFill', this.fill, this.selectElement());
    this.selectElement().attr('fill', this.fill);
  }

  updateStyleFill(fill: string) {
    this.checkValueAndAddUpdateCallback([{
      currentValuePath: 'fill', newValue: fill
    }], this.renderStyleFill);
  }

  //++++ Stroke ++++//

  renderStyleStroke() {
    // console.log('[NODE] renderStyleStroke', this.strokeStyle);
    this.selectElement()
      .attr('stroke', this.strokeStyle.stroke ?? "white")
      .attr('stroke-width', this.strokeStyle.strokeWidth)
      .attr('stroke-opacity', this.strokeStyle.strokeOpacity ?? 1);
  }

  updateStyleStroke(stroke?: string, strokeWidth?: number, strokeOpacity?: number) {
    this.checkValueAndAddUpdateCallback([
      { currentValuePath: 'strokeStyle.stroke', newValue: stroke },
      { currentValuePath: 'strokeStyle.strokeWidth', newValue: strokeWidth },
      { currentValuePath: 'strokeStyle.strokeOpacity', newValue: strokeOpacity }
    ], this.renderStyleFill);
  }

  //++++ Opacity ++++//

  renderStyleOpacity() {
    // console.log('[NODE] renderStyleOpacity', this.opacity);
    this.selectElement().attr('opacity', this.opacity);
  }
  updateStyleOpacity(opacity: number) {
    this.checkValueAndAddUpdateCallback([
      { currentValuePath: 'opacity', newValue: opacity }
    ], this.renderStyleOpacity);
  }

  //++++ Position and size ++++//

  renderPositionAndSize() {
    // console.log('[NODE] renderPositionAndSize', this.x, this.y, this.radius);
    this.selectElement()
      .attr('cx', this.x)
      .attr('cy', this.y)
      .attr('r', this.radius);
  }
  updatePositionAndSize(x?: number, y?: number, radius?: number) {
    const updated = this.checkValueAndAddUpdateCallback([
      { currentValuePath: 'center.x', newValue: x },
      { currentValuePath: 'center.y', newValue: y },
      { currentValuePath: '_radius', newValue: radius }
    ], this.renderPositionAndSize);
    if (updated) {
      this.emitter.emit("positionUpdated");
    }
  }

}
