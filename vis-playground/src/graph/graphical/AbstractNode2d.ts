import { CommunicationNode } from '../commGraph';
import { Point2D } from './Point2d';

export class AbstractNode2d { // <NodeData>
  center: Point2D;
  data?: CommunicationNode // NodeData;

  vx: number = 0;
  vy: number = 0;
  fx: number | null = null;
  fy: number | null = null;

  get x() {
    return this.center.x;
  }
  set x(value: number) {
    this.center.x = value;
  }

  get y() {
    return this.center.y;
  }
  set y(value: number) {
    this.center.y = value;
  }

  constructor(center?: Point2D | null, data?: CommunicationNode) {
    this.center = center || new Point2D(0, 0);
    this.data = data;
  }
}
