
import { CommunicationGraph } from '.';
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

  /** The score of the node */
  score = 0;

  get communities() {
    return this.graph?.communities;
  }

  get degree() {
    return this.inDegree + this.outDegree;
  }

  get inDegree() {
    return this.getIncomingLinks().length;
  }

  get outDegree() {
    return this.getOutgoingLinks().length;
  }

  get successorCount() {
    return this.getSuccessors().length;
  }

  get predecessorCount() {
    return this.getPredecessors().length;
  }


  /**
   * Create a new communication node
   * @param id The id of the node
   * @param data Additional data of the node
   */
  constructor(id: string, data?: NodeData) {
    this.id = id;
    this.data = data;
  }

  ////////////////////////////////////////////////////////////////////////////
  // Topic Methods
  ////////////////////////////////////////////////////////////////////////////

  addTopic(topic: CommunicationTopic, ignoreExisting = true) {

    // Check if the ID is correct
    if (topic.nodeID !== this.id) {
      throw new Error('Topic does not belong to the node');
    }

    // Check if the topic already exists
    for (const existingTopic of this.topics) {
      if (existingTopic.id === topic.id && existingTopic.channel === topic.channel && existingTopic.direction === topic.direction) {

        // Check if distances differ
        const existingDistance = existingTopic.distance;
        const newDistance = topic.distance;

        if (existingDistance !== newDistance) {
          throw new Error(`Topic with id ${topic.id} (${topic.channel.type}, ${topic.direction}) already exists with different distance`);
        }

        if (ignoreExisting) return;

        throw new Error(`Topic with id ${topic.id} (${topic.channel.type}, ${topic.direction}) already exists`);
      }
    }

    // console.log('Adding topic', topic);
    this.topics.push(topic);
  }

  ////////////////////////////////////////////////////////////////////////////
  // Node methods
  ////////////////////////////////////////////////////////////////////////////

  /**
   * Get a list of connected nodes according to the direction and the channels.
   * @param direction The direction of the connections
   * @param channels The channels of the connections
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

  /**
   * Get a list of successors of the node.
   * @param channels The channels of the connections
   * @returns The list of successors
   */
  getSuccessors(channels?: string | string[] | CommunicationChannel[]): CommunicationNode<NodeData>[] {
    return this.getConnectedNodes("outgoing", channels);
  }

  /**
   * Get a list of predecessors of the node.
   * @param channels The channels of the connections
   * @returns The list of predecessors
   */
  getPredecessors(channels?: string | string[] | CommunicationChannel[]): CommunicationNode<NodeData>[] {
    return this.getConnectedNodes("incoming", channels);
  }


  ////////////////////////////////////////////////////////////////////////////
  // Link methods
  ////////////////////////////////////////////////////////////////////////////

  /**
   * Get a list of links according to the direction and the channels.
   * @param direction The direction of the links
   * @param channels The channels of the links
   * @returns The list of links
   */
  getLinks(direction: CommunicationDirection, channels?: string | string[] | CommunicationChannel[]) {
    if (this.graph === undefined) {
      throw new Error('Graph not set');
    }
    return this.graph.getLinksAccordingToDirection(this, direction, channels);
  }

  /**
   * Get a list of outgoing links of the node.
   * @param channels The channels of the links
   * @returns The list of outgoing links
   */
  getOutgoingLinks(channels?: string | string[] | CommunicationChannel[]) {
    return this.getLinks("outgoing", channels);
  }

  /**
   * Get a list of incoming links of the node.
   * @param channels The channels of the links
   * @returns The list of incoming links
   */
  getIncomingLinks(channels?: string | string[] | CommunicationChannel[]) {
    return this.getLinks("incoming", channels);
  }

}
