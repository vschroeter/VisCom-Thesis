import _ from 'lodash';
import { CommunicationNode } from '../commGraph';
import { NodeCommunities } from '../commGraph/community';
import { RenderArgs } from '../layouter/layouter';
import { Anchor2d } from './Anchor2d';
import { Point2D } from './Point2d';
import { StrokeStyle } from './StrokeStyle';
import { Vector2D } from './Vector2d';

import * as d3 from 'd3';

export interface Node2dData {
  id: string;
  score?: number;
  successorCount?: number;
  predecessorCount?: number;
  outDegree?: number;
  inDegree?: number;
  communities?: NodeCommunities;
}

export class Node2d<T extends Node2dData = Node2dData> { // <NodeData>

  // Center of the node
  center: Point2D;

  // The (abstract communication graph's node) data of the node
  // data?: CommunicationNode // NodeData;
  data: T;

  // The id of the node
  get id() {
    return this.data.id;
  }

  // The radius of the node. Can also have an abstract meaning for non-circular nodes.
  radius: number = 10;

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

  updateCallbacks: ((selection: d3.Selection<any, any, any, any>) => void)[] = [];

  // X coordinate of the node's center
  get x() {
    return this.center.x;
  }

  // Set the x coordinate of the node's center
  set x(value: number) {
    this.center.x = value;
  }

  // Y coordinate of the node's center
  get y() {
    return this.center.y;
  }
  // Set the y coordinate of the node's center
  set y(value: number) {
    this.center.y = value;
  }

  constructor(data: T, center?: Point2D | null) {
    this.center = center || new Point2D(0, 0);
    this.data = data;

    this.updateCallbacks.push(...[this.renderStyleFill, this.renderStyleStroke, this.renderStyleOpacity, this.renderPositionAndSize]);
  }


  ////////////////////////////////////////////////////////////////////////////
  // Anchor methods
  ////////////////////////////////////////////////////////////////////////////


  /**
   * Get the anchor of the node directed towards a given point
   * @param point The point, towards which the anchor should be directed
   */
  getAnchor(point: Point2D): Anchor2d;
  /**
   * Get the anchor of the node directed towards a given vector
   * @param vector The vector originating from the node's center, towards which the anchor should be directed
   */
  getAnchor(vector: Vector2D): Anchor2d;
  getAnchor(param: Point2D | Vector2D): Anchor2d {

    let vector: Vector2D | null = null;
    if (param instanceof Point2D) {
      vector = new Vector2D(param.x - this.center.x, param.y - this.center.y);
    } else if (param instanceof Vector2D) {
      vector = param;
    }

    if (!vector) {
      throw new Error("Invalid parameter type");
    }

    // For the abstract circle node, the direction is the same as the vector
    // The anchor point is the intersection of the circle and the vector

    const direction = vector;
    const anchorPoint = this.center.add(direction.unity().multiply(this.radius));

    return new Anchor2d(anchorPoint, direction);

  }

  ////////////////////////////////////////////////////////////////////////////
  // Stype update methods
  ////////////////////////////////////////////////////////////////////////////

  private checkAndAddUpdate(oldValueField: string, newValue?: any, updateCallback?: (selection: d3.Selection<any, any, any, any>) => void) {
    if (newValue === undefined) {
      return;
    }

    if (_.get(this, oldValueField) !== newValue) {
      _.set(this, oldValueField, newValue);

      if (updateCallback) {
        // Check if callback is already in the list
        if (!this.updateCallbacks.includes(updateCallback)) {
          this.updateCallbacks.push(updateCallback);
        }
      }
    }
  }

  //++++ Fill ++++//

  renderStyleFill(selection: d3.Selection<any, any, any, any>) {
    selection.attr('fill', this.fill);
  }

  updateStyleFill(fill: string) {
    this.checkAndAddUpdate('fill', fill, this.renderStyleFill);
  }

  //++++ Stroke ++++//

  renderStyleStroke(selection: d3.Selection<any, any, any, any>) {
    selection
      .attr('stroke', this.strokeStyle.stroke ?? "white")
      .attr('stroke-width', this.strokeStyle.strokeWidth)
      .attr('stroke-opacity', this.strokeStyle.strokeOpacity ?? 1);
    
    const x = 5;
  }

  updateStyleStroke(stroke?: string, strokeWidth?: number, strokeOpacity?: number) {
    this.checkAndAddUpdate('strokeStyle.stroke', stroke, this.renderStyleStroke);
    this.checkAndAddUpdate('strokeStyle.strokeWidth', strokeWidth, this.renderStyleStroke);
    this.checkAndAddUpdate('strokeStyle.strokeOpacity', strokeOpacity, this.renderStyleStroke);
  }

  //++++ Opacity ++++//

  renderStyleOpacity(selection: d3.Selection<any, any, any, any>) {
    selection.attr('opacity', this.opacity);
  }
  updateStyleOpacity(opacity: number) {
    this.checkAndAddUpdate('opacity', opacity, this.renderStyleOpacity);
  }

  //++++ Position and size ++++//

  renderPositionAndSize(selection: d3.Selection<any, any, any, any>) {
    selection
      .attr('cx', this.x)
      .attr('cy', this.y)
      .attr('r', this.radius);
  }
  updatePositionAndSize(x: number, y: number, radius: number) {
    this.checkAndAddUpdate('x', x, this.renderPositionAndSize);
    this.checkAndAddUpdate('y', y, this.renderPositionAndSize);
    this.checkAndAddUpdate('radius', radius, this.renderPositionAndSize);
  }


  ////////////////////////////////////////////////////////////////////////////
  // Render methods
  ////////////////////////////////////////////////////////////////////////////

  enter(selection: d3.Selection<SVGGElement | any, any, any, any>): void {
    selection.append('circle')


    this.update(selection);
  }

  exit(selection: d3.Selection<SVGGElement | any, any, any, any>): void {
    selection.remove();
  }

  update(selection: d3.Selection<SVGGElement | any, any, any, any>): void {
    // console.log(`Update node with ${this.updateCallbacks.length} callbacks`);
    const nodeSelection = selection.selectAll('circle');
    // this.updateCallbacks.forEach(callback => callback(nodeSelection));

    // Call all update callbacks
    this.updateCallbacks.forEach(callback => nodeSelection.call(callback.bind(this)));

    // Clear the update callbacks
    this.updateCallbacks = [];
  }

}
