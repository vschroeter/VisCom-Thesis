import { Point2D } from './Point2d';

export class AbstractNode2d<NodeData> {
  center: Point2D;
  data: NodeData;

  constructor(center: Point2D, data: NodeData) {
    this.center = center;
    this.data = data;
  }
}
