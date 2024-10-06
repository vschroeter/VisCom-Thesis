import { CommunicationGraph } from '../commGraph';
import { CommunicationChannel, CommunicationDirection } from './channel';
import { CommunicationNode } from './node';
import { CommunicationTopic } from './topic';

export class CommunicationLink {
  topicId: string;

  /** The id of the source node */
  fromId: string;
  /** The id of the target node */
  toId: string;

  /** The channel of the communication */
  channel: CommunicationChannel;

  /** The direction of the communication */
  direction: CommunicationDirection;

  /** The weight of the communication */
  weight: number = 1;

  /** Reference to the communication graph to get the nodes */
  private graph: CommunicationGraph;

  /**
   * Create a new communication link
   * @param fromId The id of the source node
   * @param toId The id of the target node
   * @param channel The channel of the communication
   * @param direction The direction of the communication
   * @param graph Reference to the communication graph
   * @param weight The weight of the communication
   */
  constructor(
    topicId: string,
    fromId: string,
    toId: string,
    channel: CommunicationChannel,
    direction: CommunicationDirection,
    graph: CommunicationGraph,
    weight = 1
  ) {
    this.topicId = topicId;
    this.fromId = fromId;
    this.toId = toId;
    this.channel = channel;
    this.direction = direction;
    this.graph = graph;
    this.weight = weight;
  }

  /** The source node of the link */
  get fromNode(): CommunicationNode {
    return this.graph.nodesById.get(this.fromId)!;
  }

  /** The target node of the link */
  get toNode(): CommunicationNode {
    return this.graph.nodesById.get(this.toId)!;
  }

}

export class ChannelGraphLinkData {
  constructor(
    public topic: CommunicationTopic,
    public channel: CommunicationChannel,
  ) {}
}
