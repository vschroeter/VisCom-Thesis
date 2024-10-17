import { CommunicationGraph } from '../commGraph';
import { CommunicationChannel, CommunicationDirection } from './channel';
import { CommunicationNode } from './node';
import { CommunicationTopic } from './topic';


export class NodeToNodeConnection {
  fromId: string;
  toId: string;
  weight: number;
  topic: CommunicationTopic;
  
  constructor(from: string, to: string, topic: CommunicationTopic, weight: number) {
    this.fromId = from;
    this.toId = to;
    this.topic = topic;
    this.weight = weight;
  }

  static getCombinedWeight(connections: NodeToNodeConnection[]): number {
    return connections.reduce((acc, connection) => acc + connection.weight, 0);
  }
}

export class NodeToNodeConnections {
  fromId: string;
  toId: string;
  
  connections: NodeToNodeConnection[] = [];

  get topics(): CommunicationTopic[] {
    return this.connections.map(c => c.topic);
  }

  constructor(fromNodeId: string, toNodeId: string, connections: NodeToNodeConnection[]) {
    this.fromId = fromNodeId;
    this.toId = toNodeId;
    this.connections = connections;
  }

  get combinedWeight(): number {
    return this.connections.reduce((acc, connection) => acc + connection.weight, 0);
  }
}

/**
 * A single link in a communication graph between two nodes.
 * The link is on a specific channel and on a given topic, has a direction and a weight.
 */
export class CommunicationLink {
  topic: CommunicationTopic;

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
   * @param topic The topic of the communication
   * @param fromId The id of the source node
   * @param toId The id of the target node
   * @param channel The channel of the communication
   * @param direction The direction of the communication
   * @param graph Reference to the communication graph
   * @param weight The weight of the communication
   */
  constructor(
    topic: CommunicationTopic,
    fromId: string,
    toId: string,
    channel: CommunicationChannel,
    direction: CommunicationDirection,
    graph: CommunicationGraph,
    weight: number = 1
  ) {
    this.topic = topic;
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
