import { CommunicationGraph } from '.';
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

  static copyFromLink(link: CommunicationLink): CommunicationLink {
    return new CommunicationLink(
      link.topic,
      link.fromId,
      link.toId,
      link.channel,
      link.direction,
      link.graph,
      link.weight
    );
  }

  /** The source node of the link */
  get fromNode(): CommunicationNode {
    return this.graph.nodesById.get(this.fromId)!;
  }

  /** The target node of the link */
  get toNode(): CommunicationNode {
    return this.graph.nodesById.get(this.toId)!;
  }

  static mergeLinks(links: CommunicationLink[]): CommunicationLink[] {
    const mergedLinks: CommunicationLink[] = [];

    const mapFromIdToToIdToLink = new Map<string, Map<string, CommunicationLink>>();

    links.forEach(link => {
      if (!mapFromIdToToIdToLink.has(link.fromId)) {
        mapFromIdToToIdToLink.set(link.fromId, new Map());
      }
      const mapToIdToLink = mapFromIdToToIdToLink.get(link.fromId)!;
      if (!mapToIdToLink.has(link.toId)) {
        mapToIdToLink.set(link.toId, CommunicationLink.copyFromLink(link));
      } else {
        const existingLink = mapToIdToLink.get(link.toId)!;
        existingLink.weight += link.weight;
      }
    });

    mapFromIdToToIdToLink.forEach(mapToIdToLink => {
      mapToIdToLink.forEach(link => {
        mergedLinks.push(link);
      });
    });

    return mergedLinks;
  }

  /**
   * Combine the in and out links of a node into a single link.
   * The weights of the links are combined by taking the difference of the in and out links.
   * @param links
   */
  static combineInAndOutLinks(links: CommunicationLink[]): CommunicationLink[] {

    const combinedLinks: CommunicationLink[] = [];

    const mapFromIdToToIdToLink = new Map<string, Map<string, CommunicationLink>>();
    links.forEach(link => {
      if (!mapFromIdToToIdToLink.has(link.fromId)) {
        mapFromIdToToIdToLink.set(link.fromId, new Map());
      }
      const mapToIdToLink = mapFromIdToToIdToLink.get(link.fromId)!;
      if (!mapToIdToLink.has(link.toId)) {
        mapToIdToLink.set(link.toId, CommunicationLink.copyFromLink(link));
      } else {
        const existingLink = mapToIdToLink.get(link.toId)!;
        existingLink.weight += link.weight;
      }
    })

    const mergedLinks: CommunicationLink[] = [];
    mapFromIdToToIdToLink.forEach(mapToIdToLink => {
      mapToIdToLink.forEach(link => {
        mergedLinks.push(link);
      });
    });

    const combinedLinksMap = new Map<string, Map<string, CommunicationLink>>();

    mergedLinks.forEach(link => {
      if (!combinedLinksMap.has(link.fromId)) {
        combinedLinksMap.set(link.fromId, new Map());
      }

      combinedLinksMap.get(link.fromId)!.set(link.toId, CommunicationLink.copyFromLink(link));
    })


    const epsilon = 0.001;
    mergedLinks.forEach(_link => {
      const link = combinedLinksMap.get(_link.fromId)?.get(_link.toId);
      const oppositeLink = combinedLinksMap.get(_link.toId)?.get(_link.fromId);

      if (!link && !oppositeLink) {
        return;
      }

      if (link && oppositeLink) {

        const weight = link.weight - oppositeLink.weight;

        if (weight > epsilon) {
          link.weight = weight;
          combinedLinks.push(link);
        } else if (weight < -epsilon) {
          oppositeLink.weight = -weight;
          combinedLinks.push(oppositeLink);
        }

        combinedLinksMap.get(link.fromId)?.delete(link.toId);
        combinedLinksMap.get(link.toId)?.delete(link.fromId);
        return;
      }

      if (!link && oppositeLink) {
        combinedLinks.push(oppositeLink!);
        combinedLinksMap.get(oppositeLink.fromId)?.delete(oppositeLink.toId);
        return;
      }

      if (!oppositeLink && link) {
        combinedLinks.push(link);
        combinedLinksMap.get(link.fromId)?.delete(link.toId);
        return;
      }

    });

    // console.log("Combined links", combinedLinks.sort((a, b) => a.fromId.localeCompare(b.fromId) || a.toId.localeCompare(b.toId)).map(l => `${l.fromId} -> ${l.toId}: ${l.weight}`));

    return combinedLinks;
  }

  static filterLinksByWeight(links: CommunicationLink[], minWeight: number): CommunicationLink[] {
    return links.filter(link => link.weight >= minWeight);
  }

}

export class ChannelGraphLinkData {
  constructor(
    public topic: CommunicationTopic,
    public channel: CommunicationChannel,
  ) { }
}
