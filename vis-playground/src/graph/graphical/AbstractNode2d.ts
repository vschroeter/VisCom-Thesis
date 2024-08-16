import { CommunicationNode } from '../commGraph';
import { Anchor2d } from './Anchor2d';
import { Point2D } from './Point2d';
import { Vector2D } from './Vector2d';

export class AbstractNode2d { // <NodeData>
  
  // Center of the node
  center: Point2D;

  // The (abstract communication graph's node) data of the node
  data?: CommunicationNode // NodeData;

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

  constructor(center?: Point2D | null, data?: CommunicationNode) {
    this.center = center || new Point2D(0, 0);
    this.data = data;
  }

  
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


}
