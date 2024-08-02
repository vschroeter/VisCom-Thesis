
import { CommunicationGraph } from '../commGraph';
import { CommunicationChannel, CommunicationDirection } from './channel';
import { CommunicationTopic } from './topic';

/**
 * Class representing a node in a communication graph.
 * A node can have multiple topics on different communication channels.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export class CommunicationNode<NodeData = any> {
  /** The id of the node */
  id: string;

  /** The topics of the node */
  topics: CommunicationTopic[] = [];

  /** Additional data of the node */
  data: NodeData | undefined;

  /** The graph that the node belongs to */
  graph?: CommunicationGraph<NodeData>;

  /**
   * Create a new communication node
   * @param id The id of the node
   * @param data Additional data of the node
   */
  constructor(id: string, data?: NodeData) {
    this.id = id;
    this.data = data;
  }

  /**
   * Get a list of connected nodes according to the direction and the channels.
   * @param direction
   * @param channels
   * @returns
   */
  getConnectedNodes(
    direction: CommunicationDirection,
    channels?: string | string[] | CommunicationChannel[],
  ): CommunicationNode<NodeData>[] {
    if (this.graph === undefined) {
      throw new Error('Graph not set');
    }
    return this.graph.getSuccesscorsAccordingToDirection(
      this,
      direction,
      channels,
    );
  }
}
