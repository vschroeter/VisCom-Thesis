import _ from 'lodash';
import { CommunicationNode } from '../commGraph';
import { NodeCommunities } from '../commGraph/community';
import { RenderArgs } from '../layouter/layouter';
import { Anchor } from './';
import { StrokeStyle } from './primitives/StrokeStyle';

import * as d3 from 'd3';
import mitt from 'mitt';
import { Circle, Point, Vector } from '2d-geometry';
import { LayoutNode } from '../visGraph/layoutNode';
import { BoundingBox, SvgRenderable } from '../visGraph/renderer/renderer';
import { Label2d } from './Label2d';

export interface Node2dData {
  id: string;
  x?: number;
  y?: number;
  score?: number;
  successorCount?: number;
  predecessorCount?: number;
  outDegree?: number;
  inDegree?: number;
  communities?: NodeCommunities;
}

// export class Node2d<T extends Node2dData = Node2dData> extends SvgRenderable { // <NodeData>
export class Node2d extends SvgRenderable { // <NodeData>

  // Center of the node
  center: Point;

  // The (abstract communication graph's node) data of the node
  // data?: CommunicationNode // NodeData;
  // data: T;

  // The related layout node defining this node's properties
  layoutNode: LayoutNode

  elNode?: d3.Selection<SVGCircleElement, unknown, null, undefined>;
  elLabel?: d3.Selection<SVGGElement, unknown, null, undefined>;

  label?: Label2d;

  // The id of the node
  get id() {
    return this.layoutNode.id;
  }

  // The radius of the node. Can also have an abstract meaning for non-circular nodes.
  private _radius: number = 10;
  get radius() {
    return this._radius;
  }
  set radius(value: number) {
    this.updatePositionAndSize(undefined, undefined, value);
  }

  // The circle object representing the node
  get circle() {
    return new Circle(this.center, this.radius);
  }

  // The score of the node (e.g. for ranking the significance of nodes)
  // score: number = 0;
  get score() {
    return this.layoutNode.score;
  }

  // Reference to the node communities
  communities?: NodeCommunities;

  // The fill color of the node
  fill: string = 'red';

  // Whether the node should be filled
  get filled(): boolean {
    return this.layoutNode.filled;
  }

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

  constructor(layoutNode: LayoutNode) {

    // super("circle", "node2d");
    super(layoutNode.visGraph.renderer);

    this.center = new Point(0, 0);
    // this.center.x = data.x ?? 0;
    // this.center.y = data.y ?? 0;

    this.layoutNode = layoutNode;

    this.updateBoundingBox();
    this.updateCallbacks.push(...[this.renderStyleFill, this.renderStyleStroke, this.renderStyleOpacity, this.renderPositionAndSize, this.renderLabel]);
  }

  requireUpdate({
    position = false,
    fill = false,
    stroke = false,
    opacity = false,
    label = false
  }: {
    position?: boolean,
    fill?: boolean,
    stroke?: boolean,
    opacity?: boolean,
    label?: boolean
  } = { position: true, fill: true, stroke: true, opacity: true }) {
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
    if (label) {
      this.addUpdateCallback(this.renderLabel)
    }
  }

  updateBoundingBox() {
    this.setBoundingBox({
      x: this.center.x - this.radius,
      y: this.center.y - this.radius,
      w: this.radius * 2,
      h: this.radius * 2
    })
  }

  override subElementsExist(): boolean {
    return this.elNode !== undefined && this.elLabel !== undefined;
  }

  override addSubElements(): void {
    this.elNode = this.elNode ?? this.addSubElement('circle', 'node')
      .on("mouseenter", () => {

        const id = this.id;
        if (id) {
          const visGraph = this.layoutNode.visGraph;
          const userInteractions = visGraph?.userInteractions;
          if (!userInteractions) {
            console.error("No user interactions found for ", visGraph);
            return
          }
          userInteractions.addHoveredNode(id, true)
        }
      })
      .on("mouseleave", () => {

        const id = this.id;
        if (id) {
          const visGraph = this.layoutNode.visGraph;
          const userInteractions = visGraph?.userInteractions;
          if (!userInteractions) {
            console.error("No user interactions found for ", visGraph);
            return
          }
          userInteractions.removeHoveredNode(id, true)
        }

      })


    this.elLabel = this.elLabel ?? this.addSubElement('g', 'node-label')

    this.label = new Label2d(this.elLabel)
    this.label!.isVisible = this.layoutNode.showLabel;

  }

  override removeSubElements(): void {
    this.elNode?.remove();
    this.label?.removeSubElements();
    this.elLabel?.remove();

    this.elNode = this.elLabel = this.label = undefined;
  }

  fontSize: number = 20;
  override updateVisibleArea(visibleArea: BoundingBox): void {
    // const fontSize = Math.min(20, this.layoutNode.radius * 2 * 0.6) * visibleArea.w / 500;

    if (this.label) {

      const r = this.layoutNode.radius * 0.9;
      const heightWhenInNode = Math.min(this.label?.getHeightForWidth(r * 2) ?? 0, r * 2);
      const widthWhenOutsideNode = this.label?.getWidthForHeight(r) ?? -1;
      if (heightWhenInNode / visibleArea.h > 0.02 || widthWhenOutsideNode > visibleArea.w * 0.66) {

        this.label?.setHeight(heightWhenInNode).setAlignment("center").setAnchorPos(this.center.x, this.center.y);
      } else {
        const textHeight = r;

        if (this.layoutNode.parent) {
          if (this.center.x > this.layoutNode.parent.x) {
            this.label?.setAlignment("center-left").setAnchorPos(this.center.x + this.layoutNode.radius * 1.1, this.center.y);
          } else {
            this.label?.setAlignment("center-right").setAnchorPos(this.center.x - this.layoutNode.radius * 1.1, this.center.y);
          }
        } else {
          this.label?.setAlignment("center").setAnchorPos(this.center.x, this.center.y);
        }
        this.label?.setHeight(textHeight)
      }
      this.label?.text(this.layoutNode.label ?? this.layoutNode.id);
    }
    // this.updateLabel(fontSize);
  }

  //++++ Fill ++++//

  renderStyleFill() {
    // console.log('[NODE] renderStyleFill', this.fill, this.selectElement());
    this.elNode?.attr('fill', this.filled ? this.fill : 'none');
  }

  updateStyleFill(fill: string) {
    this.checkValueAndAddUpdateCallback([{
      currentValuePath: 'fill', newValue: fill
    }], this.renderStyleFill);
  }

  //++++ Stroke ++++//

  renderStyleStroke() {
    // console.log('[NODE] renderStyleStroke', this.strokeStyle);
    this.elNode?.attr('stroke', this.strokeStyle.stroke ?? "white")
      .attr('stroke-width', this.strokeStyle.strokeWidth)
      .attr('stroke-opacity', this.strokeStyle.strokeOpacity ?? 1);
  }

  updateStyleStroke(stroke?: string, strokeWidth?: number, strokeOpacity?: number) {
    this.checkValueAndAddUpdateCallback([
      { currentValuePath: 'strokeStyle.stroke', newValue: stroke },
      { currentValuePath: 'strokeStyle.strokeWidth', newValue: strokeWidth },
      { currentValuePath: 'strokeStyle.strokeOpacity', newValue: strokeOpacity }
    ], this.renderStyleStroke);
  }

  //++++ Opacity ++++//

  renderStyleOpacity() {
    // console.log('[NODE] renderStyleOpacity', this.opacity);
    this.elNode?.attr('opacity', this.opacity);
    this.elLabel?.attr('opacity', this.opacity);
  }
  updateStyleOpacity(opacity: number) {
    this.checkValueAndAddUpdateCallback([
      { currentValuePath: 'opacity', newValue: opacity }
    ], this.renderStyleOpacity);
  }

  //++++ Position and size ++++//

  renderPositionAndSize() {
    // console.log('[NODE] renderPositionAndSize', this.x, this.y, this.radius);
    this.elNode?.attr('cx', this.x)
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
      this.updateBoundingBox();
      this.emitter.emit("positionUpdated");
    }
  }

  //++++ Label ++++//
  renderLabel() {
    // this.elLabel?.text(this.layoutNode.label ?? this.layoutNode.id)
    //   .attr('font-size', this.fontSize)

    // // Get the size of the label
    // const bbox = this.elLabel?.node()?.getBBox();

    // // If the label fits in the node, center it
    // if (bbox) {

    //   if (bbox.width > this.radius * 2) {
    //     this.elLabel?.attr('x', this.center.x - bbox.width / 2)
    //       .attr('y', this.center.y + bbox.height / 4);
    //   } else {
    //     this.elLabel?.attr('x', this.center.x)
    //       .attr('y', this.center.y + bbox.height / 4);
    //   }

    // }
  }

  updateLabel(fontSize: number) {
    this.checkValueAndAddUpdateCallback([
      { currentValuePath: 'fontSize', newValue: fontSize }
    ], this.renderLabel);
  }

}
